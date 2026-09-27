package com.example.familyledger

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.RequiresApi
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.updatePadding
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import com.example.familyledger.databinding.ActivityMainBinding
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

/**
 * Thin shell around the FamilyLedger web app.
 *
 * Everything the user actually sees — sign-in, household, expenses, budgets,
 * settlements — is the React app at [START_URL]. This Activity owns only the
 * browser chrome around it:
 *
 *  * one [WebView], created in code so a crashed renderer can be swapped out
 *    without recreating the Activity;
 *  * edge-to-edge insets translated into native padding, so the page never
 *    fights the status bar or the on-screen keyboard;
 *  * a refresh whenever the app returns to the foreground, because the ledger
 *    is shared and another family member may have written to it while this
 *    phone sat in a pocket;
 *  * a native save bridge, because WebView ignores the HTML `download`
 *    attribute that the CSV export relies on.
 *
 * The web app keeps its session token in `localStorage`, so `domStorageEnabled`
 * must stay on: turning it off would look like being signed out on every
 * launch.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var fileChooser: ActivityResultLauncher<Intent>

    /** Null between a renderer crash and the next successful rebuild. */
    private var webView: WebView? = null

    private val mainHandler = Handler(Looper.getMainLooper())

    /** Flipped once the splash screen may be dismissed, for any reason. */
    private var pageReady = false

    /** Set when the document itself failed, so onPageFinished won't hide the panel. */
    private var mainFrameFailed = false

    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null

    /** 0 means "never backgrounded"; otherwise the time of the last onPause. */
    private var backgroundedAt = 0L

    private var exitArmed = false

    /**
     * False while the web app reports an open modal through the JS bridge.
     * Radix locks body scroll then, which makes the WebView look pinned to the
     * top — a swipe inside a dialog would otherwise become a pull-to-refresh
     * and reload the page over the user's unsaved input.
     */
    private var pullToRefreshEnabled = true

    private val resetExit = Runnable { exitArmed = false }
    private val giveUpOnSplash = Runnable { releaseSplash() }

    // ========================= Lifecycle =========================

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        // Hold the splash until the first paint lands, so the app opens on the
        // brand mark rather than a blank canvas.
        splashScreen.setKeepOnScreenCondition { !pageReady }

        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        fileChooser = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult(),
            ::onFileChooserResult,
        )

        applyEdgeToEdge()
        setUpSwipeToRefresh()
        setUpOfflinePanel()
        setUpBackNavigation()

        createWebView()
        if (savedInstanceState == null) {
            loadInitialUrl()
        } else {
            // configChanges already covers rotation; this path is for process
            // death, where the WebView's own back/forward list has to come back.
            if (webView?.restoreState(savedInstanceState) == null) loadInitialUrl()
        }

        mainHandler.postDelayed(giveUpOnSplash, SPLASH_TIMEOUT_MS)
    }

    override fun onResume() {
        super.onResume()
        val wasBackgrounded = backgroundedAt != 0L
        backgroundedAt = 0L
        webView?.onResume()
        if (wasBackgrounded) refreshAfterBackground()
    }

    override fun onPause() {
        webView?.onPause()
        backgroundedAt = System.currentTimeMillis()
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView?.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        mainHandler.removeCallbacksAndMessages(null)
        pendingFileCallback?.onReceiveValue(null)
        pendingFileCallback = null
        destroyWebView()
        super.onDestroy()
    }

    /**
     * A verified App Link while the app is already running (`singleTask`) is
     * delivered here rather than through onCreate.
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val deepLink = intent.data ?: return
        if (!isAppUrl(deepLink)) return
        if (webView == null) createWebView()
        webView?.loadUrl(deepLink.toString())
    }

    // ========================= Window & insets =========================

    /**
     * The WebView is laid out edge to edge and the inset gaps are applied as
     * padding on the root view.
     *
     * Doing it natively (rather than relying on CSS `env(safe-area-inset-*)`,
     * which a WebView only reports on recent versions) means the page's own
     * bottom navigation always clears the gesture handle, and the padding grows
     * with the IME so a focused amount field is never hidden behind the
     * keyboard.
     */
    private fun applyEdgeToEdge() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }

        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime(),
            )
            view.updatePadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
    }

    // ========================= Chrome around the page =========================

    private fun setUpSwipeToRefresh() {
        binding.swipeRefresh.setColorSchemeColors(
            ContextCompat.getColor(this, R.color.fl_accent),
        )
        binding.swipeRefresh.setProgressBackgroundColorSchemeColor(
            ContextCompat.getColor(this, R.color.fl_surface_raised),
        )
        binding.swipeRefresh.setOnRefreshListener {
            val view = webView
            if (view == null) {
                binding.swipeRefresh.isRefreshing = false
                return@setOnRefreshListener
            }
            // Re-read whatever route the user is looking at.
            if (view.url.isNullOrBlank()) loadHome() else view.reload()
        }

        // The default check asks the WebView whether it can still scroll up.
        // Radix locks body scroll while a dialog is open, so the page always
        // answers "I am at the top" and every swipe inside the dialog became a
        // refresh. The callback overrides that answer: no refresh while the
        // web app has a modal open or while the page itself could still scroll
        // up (the rule the default encodes).
        binding.swipeRefresh.setOnChildScrollUpCallback { _, _ ->
            val page = webView
            !pullToRefreshEnabled || page == null || page.canScrollVertically(-1)
        }
    }

    /**
     * Single writer for [pullToRefreshEnabled] and the widget's own enabled
     * flag: called from the JS bridge (posted to the main thread) and from the
     * WebView client (already on it).
     */
    private fun setPullToRefreshEnabled(enabled: Boolean) {
        pullToRefreshEnabled = enabled
        binding.swipeRefresh.isEnabled = enabled
        if (!enabled) binding.swipeRefresh.isRefreshing = false
    }

    private fun setUpOfflinePanel() {
        binding.offlineRetry.setOnClickListener { recover() }
        binding.offlineBrowser.setOnClickListener {
            openExternally((webView?.url ?: START_URL).toUri())
        }
    }

    private fun setUpBackNavigation() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    val view = webView
                    // Walk the SPA history first. Client-side route changes are
                    // same-document entries, which canGoBack() does see.
                    if (view != null && view.canGoBack()) {
                        view.goBack()
                        return
                    }
                    // Every screen is one tap from the home route, so exiting on
                    // the first press would be too easy to do by accident.
                    if (exitArmed) {
                        remove()
                        onBackPressedDispatcher.onBackPressed()
                        return
                    }
                    exitArmed = true
                    Toast.makeText(
                        this@MainActivity,
                        R.string.press_back_again,
                        Toast.LENGTH_SHORT,
                    ).show()
                    mainHandler.postDelayed(resetExit, DOUBLE_BACK_MS)
                }
            },
        )
    }

    // ========================= The WebView =========================

    /**
     * Builds a WebView, wires it up and attaches it under the
     * SwipeRefreshLayout. Called once on create and again if the renderer dies.
     */
    private fun createWebView() {
        val view = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            // Same colour as the page background, so a reload never flashes
            // white on a dark-mode device.
            setBackgroundColor(ContextCompat.getColor(context, R.color.fl_canvas))
        }

        configureSettings(view)

        view.webViewClient = familyLedgerWebViewClient
        view.webChromeClient = familyLedgerChromeClient
        view.addJavascriptInterface(DownloadBridge(), JS_BRIDGE_NAME)

        // Only genuine http(s) downloads reach this. The CSV export builds a
        // blob: URL, which WebView cannot hand to another process, so that path
        // goes through DownloadBridge instead.
        view.setDownloadListener { url, _, _, _, _ -> openExternally(url.toUri()) }

        binding.swipeRefresh.addView(view)
        webView = view
    }

    /**
     * WebView tuning. The JavaScript warning lint raises is accepted knowingly:
     * this shell renders exactly one origin — our own deployed app — and no
     * other host can ever load here (see [handleNavigation]), so the page has no
     * untrusted script to inject.
     */
    @SuppressLint("SetJavaScriptEnabled")
    private fun configureSettings(view: WebView) {
        with(view.settings) {
            // A single-page React bundle: with JS off there is nothing to show.
            javaScriptEnabled = true

            // The session token lives in localStorage under a key the web app
            // shares with its desktop build. Without this every launch would
            // look signed out.
            domStorageEnabled = true

            // target="_blank" invite links arrive as a window request; left off,
            // they are dropped silently.
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)

            mediaPlaybackRequiresUserGesture = true

            // HTTPS only, matching the manifest and network security config.
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

            // Honour <meta name="viewport" content="width=device-width"> so one
            // CSS pixel maps to one dp and the Tailwind breakpoints behave the
            // way they do in Chrome on the same phone.
            useWideViewPort = true
            loadWithOverviewMode = false

            // The shell needs no local files, so keeping these closed removes a
            // whole class of content:// attacks.
            allowFileAccess = false
            allowContentAccess = false

            // Lets the API tell an Android session apart from a desktop one, and
            // makes a support request traceable to a build.
            userAgentString =
                "$userAgentString AndroidFamilyLedger/${BuildConfig.VERSION_NAME}"

            if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                // No effect on our own pages (they declare color-scheme: dark)
                // but keeps any future light-mode plugin from flashing white.
                WebSettingsCompat.setAlgorithmicDarkeningAllowed(this, true)
            }
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            // Everything the app talks to is same-site, so third-party cookies
            // would only widen the surface.
            setAcceptThirdPartyCookies(view, false)
        }
    }

    /**
     * Tears the WebView down properly. `destroy()` is only safe once the view
     * is detached and the clients have stopped holding a reference to us.
     */
    private fun destroyWebView() {
        val view = webView ?: return
        webView = null
        (view.parent as? ViewGroup)?.removeView(view)
        view.stopLoading()
        view.clearHistory()
        view.removeJavascriptInterface(JS_BRIDGE_NAME)
        view.webChromeClient = null
        view.webViewClient = WebViewClient()
        view.destroy()
    }

    // ========================= WebView clients =========================

    private val familyLedgerWebViewClient = object : WebViewClient() {

        /**
         * Navigations inside the app stay in the WebView; anything else — a
         * maps link, an email, a `tel:` — is handed to the app that owns it, so
         * this shell never turns into a general-purpose browser.
         */
        override fun shouldOverrideUrlLoading(
            view: WebView,
            request: WebResourceRequest,
        ): Boolean = handleNavigation(request.url)

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            mainFrameFailed = false
            hideOffline()
            // A fresh document starts with no modal, so whatever the previous
            // page asked of the bridge no longer applies.
            setPullToRefreshEnabled(true)
            binding.pageProgress.apply {
                progress = 0
                visibility = View.VISIBLE
            }
        }

        override fun onPageFinished(view: WebView, url: String?) {
            binding.pageProgress.visibility = View.GONE
            binding.swipeRefresh.isRefreshing = false
            // A failed load also reaches onPageFinished (with the error page), so
            // only clear the panel when the document really loaded.
            if (!mainFrameFailed) hideOffline()
            releaseSplash()
        }

        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceError,
        ) {
            if (!request.isForMainFrame) return
            mainFrameFailed = true
            releaseSplash()
            Log.w(TAG, "Document failed: ${error.errorCode} ${error.description}")
            showOffline(
                getString(R.string.error_offline_title),
                getString(R.string.error_offline_body),
            )
        }

        override fun onReceivedHttpError(
            view: WebView,
            request: WebResourceRequest,
            errorResponse: WebResourceResponse,
        ) {
            // Only the document itself matters. A 404 on some optional asset
            // must not replace a working page with an error screen.
            val isDocument = request.isForMainFrame &&
                errorResponse.mimeType?.startsWith("text/html") == true
            if (!isDocument) return
            mainFrameFailed = true
            releaseSplash()
            Log.w(TAG, "Document returned HTTP ${errorResponse.statusCode}")
            showOffline(
                getString(R.string.error_http_title),
                getString(R.string.error_http_body, errorResponse.statusCode),
            )
        }

        /** Never continue past a certificate problem, whatever the cause. */
        override fun onReceivedSslError(
            view: WebView,
            handler: SslErrorHandler,
            error: SslError,
        ) {
            handler.cancel()
            mainFrameFailed = true
            releaseSplash()
            Log.e(TAG, "TLS rejected for ${error.url}")
            showOffline(
                getString(R.string.error_secure_title),
                getString(R.string.error_secure_body),
            )
        }

        /**
         * The out-of-process renderer was killed (usually memory pressure).
         * Returning true stops Android from tearing the whole app down, and we
         * give the user a fresh WebView instead of a dead grey rectangle.
         */
        override fun onRenderProcessGone(
            view: WebView,
            detail: RenderProcessGoneDetail,
        ): Boolean {
            Log.w(TAG, "Renderer gone: $detail")
            releaseSplash()
            destroyWebView()
            showOffline(
                getString(R.string.error_renderer_title),
                getString(R.string.error_renderer_body),
            )
            return true
        }
    }

    private val familyLedgerChromeClient = object : WebChromeClient() {

        override fun onProgressChanged(view: WebView, newProgress: Int) {
            binding.pageProgress.progress = newProgress
            if (newProgress >= 100) binding.pageProgress.visibility = View.GONE
        }

        /** Keeps target="_blank" links inside the app instead of dropping them. */
        override fun onCreateWindow(
            view: WebView,
            isDialog: Boolean,
            isUserGesture: Boolean,
            resultMsg: Message,
        ): Boolean {
            val transport = resultMsg.obj as? WebView.WebViewTransport ?: return false
            // A throwaway WebView exists only to receive the first URL; the URL
            // is then loaded into the real one, which owns the session.
            val popup = WebView(this@MainActivity).apply {
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        popupView: WebView,
                        request: WebResourceRequest,
                    ): Boolean {
                        this@MainActivity.webView?.loadUrl(request.url.toString())
                        return true
                    }
                }
            }
            transport.webView = popup
            resultMsg.sendToTarget()
            // Free the placeholder once the transport has been consumed.
            mainHandler.post { popup.destroy() }
            return true
        }

        override fun onShowFileChooser(
            view: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams,
        ): Boolean {
            // Exactly one callback may be outstanding at a time.
            pendingFileCallback?.onReceiveValue(null)
            pendingFileCallback = filePathCallback
            return try {
                fileChooser.launch(fileChooserParams.createIntent())
                true
            } catch (e: ActivityNotFoundException) {
                pendingFileCallback = null
                Log.w(TAG, "No activity can answer the file chooser", e)
                false
            }
        }

        /** The ledger never needs the device location, so always refuse. */
        override fun onGeolocationPermissionsShowPrompt(
            origin: String,
            callback: GeolocationPermissions.Callback,
        ) {
            callback.invoke(origin, false, false)
        }

        override fun onConsoleMessage(message: ConsoleMessage): Boolean {
            Log.d(
                TAG,
                "console: ${message.message()} (${message.sourceId()}:${message.lineNumber()})",
            )
            return true
        }
    }

    private fun onFileChooserResult(result: ActivityResult) {
        val callback = pendingFileCallback ?: return
        pendingFileCallback = null
        callback.onReceiveValue(
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data),
        )
    }

    // ========================= Loading & recovery =========================

    /**
     * Honours an App Link when present (`/onboarding?join=CODE` from a chat
     * message), otherwise opens the app root.
     */
    private fun loadInitialUrl() {
        val deepLink = intent?.data
        if (deepLink != null && isAppUrl(deepLink)) {
            webView?.loadUrl(deepLink.toString())
        } else {
            loadHome()
        }
    }

    private fun loadHome() {
        hideOffline()
        webView?.loadUrl(START_URL)
    }

    /** "Try again" on the error panel. */
    private fun recover() {
        hideOffline()
        if (webView == null) {
            // The renderer died; start from a clean slate.
            createWebView()
            loadHome()
            return
        }
        val current = webView?.url
        if (current.isNullOrBlank() || current.startsWith("about:")) {
            loadHome()
        } else {
            webView?.loadUrl(current)
        }
    }

    /**
     * The ledger is shared, so a phone coming back from the lock screen may be
     * looking at a stale day. Reload the current route — unless a modal is open,
     * because that means the user has unsaved input and a reload would discard
     * it. The probe is time-boxed: if the page cannot answer, refresh anyway.
     */
    private fun refreshAfterBackground() {
        val view = webView
        if (view == null) {
            createWebView()
            loadHome()
            return
        }

        val current = view.url
        if (current.isNullOrBlank() || current.startsWith("about:")) {
            loadHome()
            return
        }

        var answered = false
        val giveUp = Runnable {
            if (answered) return@Runnable
            answered = true
            view.reload()
        }
        mainHandler.postDelayed(giveUp, BUSY_PROBE_TIMEOUT_MS)

        view.evaluateJavascript(BUSY_PROBE_JS) { result ->
            if (answered) return@evaluateJavascript
            answered = true
            mainHandler.removeCallbacks(giveUp)
            if (result?.contains("busy") == true) {
                Log.d(TAG, "Resume refresh skipped: a dialog is open")
            } else {
                view.reload()
            }
        }
    }

    // ========================= Navigation policy =========================

    /**
     * @return true when the URL was dealt with outside the WebView.
     */
    private fun handleNavigation(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase()

        // about:blank, blob: previews and data: URIs are the page's own
        // business; bouncing them to another app would break the page.
        if (scheme == null || scheme == "about" || scheme == "data" || scheme == "blob") {
            return false
        }

        if (scheme == "http" || scheme == "https") {
            return if (isAppUrl(uri)) false else openExternally(uri)
        }

        // mailto:, tel:, sms:, whatsapp:, intent: … whatever owns it.
        return openExternally(uri)
    }

    private fun isAppUrl(uri: Uri): Boolean {
        val host = uri.host?.lowercase() ?: return false
        return host == APP_HOST || host.endsWith(".$APP_HOST")
    }

    private fun openExternally(uri: Uri): Boolean {
        if (uri.scheme?.lowercase() != "http" && uri.scheme?.lowercase() != "https") {
            return launchExternally(uri)
        }
        // Custom Tabs keeps the user in a browser they already trust and keeps a
        // foreign session well away from our WebView.
        return try {
            CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(this, uri)
            true
        } catch (e: ActivityNotFoundException) {
            Log.d(TAG, "No Custom Tabs provider, falling back to ACTION_VIEW", e)
            launchExternally(uri)
        }
    }

    private fun launchExternally(uri: Uri): Boolean {
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show()
            false
        } catch (e: SecurityException) {
            Log.w(TAG, "Not allowed to open $uri", e)
            false
        }
    }

    // ========================= Offline panel & splash =========================

    private fun showOffline(title: String, body: String) {
        binding.offlineTitle.text = title
        binding.offlineMessage.text = body
        binding.offlinePanel.visibility = View.VISIBLE
        binding.pageProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
    }

    private fun hideOffline() {
        binding.offlinePanel.visibility = View.GONE
    }

    /** Idempotent: the splash comes down once, for the first of many reasons. */
    private fun releaseSplash() {
        if (pageReady) return
        pageReady = true
        mainHandler.removeCallbacks(giveUpOnSplash)
    }

    // ========================= Native save bridge =========================

    /**
     * Native half of the shell bridge: CSV export and pull-to-refresh control.
     *
     * WebView silently ignores the HTML `download` attribute the web app uses,
     * so `src/lib/download.ts` looks for `window.FamilyLedgerAndroid` first and
     * hands the bytes over instead of building a blob: URL. Only our own origin
     * can reach this: [handleNavigation] keeps every other host out of the
     * WebView, and the bridge is not reachable from a page we never load.
     *
     * Methods run on the WebView's private JavaScript thread, so they touch no
     * view state and post their feedback back to the main thread.
     */
    private inner class DownloadBridge {

        /** @return "saved:<path>" or "error:<reason>", for the web app to log. */
        @JavascriptInterface
        fun saveBase64(fileName: String, mimeType: String, base64Content: String): String {
            return try {
                val bytes = Base64.decode(base64Content, Base64.DEFAULT)
                val safeName = sanitizeFileName(fileName)
                val safeType = sanitizeMimeType(mimeType)
                val location =
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        saveToDownloads(safeName, safeType, bytes)
                    } else {
                        saveToAppStorage(safeName, bytes)
                    }
                toast(getString(R.string.download_saved, location))
                "saved:$location"
            } catch (e: Exception) {
                Log.e(TAG, "Could not save $fileName", e)
                toast(getString(R.string.download_failed))
                "error:${e.message}"
            }
        }

        /** Lets the web app label a support request with the exact build. */
        @JavascriptInterface
        fun appVersion(): String = BuildConfig.VERSION_NAME

        /**
         * Lets the web app stand pull-to-refresh down while a modal is open
         * (`src/lib/native-bridge.ts`): the dialog has to scroll under the
         * finger instead of reloading the page. Runs on the WebView's private
         * JavaScript thread, so the view work is posted to the main thread.
         */
        @JavascriptInterface
        fun setPullToRefreshEnabled(enabled: Boolean) {
            mainHandler.post { this@MainActivity.setPullToRefreshEnabled(enabled) }
        }
    }

    /**
     * Public `Download/FamilyLedger` through MediaStore. API 29+ needs no
     * storage permission for this, and the file is visible in the Files app the
     * moment the pending flag is cleared.
     */
    @RequiresApi(Build.VERSION_CODES.Q)
    private fun saveToDownloads(fileName: String, mimeType: String, bytes: ByteArray): String {
        val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
            put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
            put(
                MediaStore.MediaColumns.RELATIVE_PATH,
                "${Environment.DIRECTORY_DOWNLOADS}/$DOWNLOAD_FOLDER",
            )
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }

        val resolver = contentResolver
        val uri = resolver.insert(collection, values)
            ?: throw IOException("MediaStore refused the export")

        try {
            val stream = resolver.openOutputStream(uri)
                ?: throw IOException("Could not open $uri")
            stream.use { it.write(bytes) }
        } catch (e: Exception) {
            // Don't leave a half-written entry behind.
            resolver.delete(uri, null, null)
            throw e
        }

        values.clear()
        values.put(MediaStore.MediaColumns.IS_PENDING, 0)
        resolver.update(uri, values, null, null)

        return "${Environment.DIRECTORY_DOWNLOADS}/$DOWNLOAD_FOLDER/$fileName"
    }

    /**
     * API 24-28 fallback.
     *
     * Rather than ask for WRITE_EXTERNAL_STORAGE — a permission Google Play
     * reviews closely, and one a ledger app cannot justify — the export goes to
     * this app's own external Downloads directory, which needs no permission at
     * all.
     */
    private fun saveToAppStorage(fileName: String, bytes: ByteArray): String {
        val root = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            ?: File(filesDir, Environment.DIRECTORY_DOWNLOADS)
        val folder = File(root, DOWNLOAD_FOLDER).apply { mkdirs() }
        val target = File(folder, fileName)
        FileOutputStream(target).use { it.write(bytes) }
        return target.absolutePath
    }

    /** Strips anything that could escape the target directory. */
    private fun sanitizeFileName(fileName: String): String {
        val cleaned = fileName.replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001F]"), "_").trim()
        if (cleaned.isEmpty()) return "familyledger-export.csv"
        if (cleaned.length <= MAX_FILE_NAME) return cleaned

        // Keep the extension when trimming: Android decides how to open a file
        // from its suffix, and a CSV without one is just unfamiliar bytes.
        val dot = cleaned.lastIndexOf('.')
        val extension = if (dot > 0 && cleaned.length - dot <= MAX_EXTENSION_LENGTH) {
            cleaned.substring(dot)
        } else {
            ""
        }
        return cleaned.take(MAX_FILE_NAME - extension.length) + extension
    }

    /**
     * MediaStore rejects a MIME type that carries parameters, and the web app
     * sends `text/csv;charset=utf-8` so a browser renders the file correctly.
     */
    private fun sanitizeMimeType(mimeType: String): String {
        val base = mimeType.substringBefore(';').trim()
        return if (base.contains('/')) base else "application/octet-stream"
    }

    private fun toast(message: String) {
        mainHandler.post {
            Toast.makeText(this@MainActivity, message, Toast.LENGTH_LONG).show()
        }
    }

    private companion object {
        const val TAG = "FamilyLedger"

        /** The deployed web app this shell wraps. */
        const val START_URL = "https://familyledger-eight.vercel.app/"
        const val APP_HOST = "familyledger-eight.vercel.app"

        /** Name the web app looks for on `window` to find the save bridge. */
        const val JS_BRIDGE_NAME = "FamilyLedgerAndroid"

        /** Sub-folder created inside the device's Downloads directory. */
        const val DOWNLOAD_FOLDER = "FamilyLedger"

        /**
         * Longest file name handed to MediaStore. Comfortably inside every
         * filesystem limit while leaving room for the extension.
         */
        const val MAX_FILE_NAME = 96

        /** Extensions longer than this are treated as part of the name. */
        const val MAX_EXTENSION_LENGTH = 8

        /** Past this, the first load is hung rather than slow, so unblock the splash. */
        const val SPLASH_TIMEOUT_MS = 12_000L

        /** Window in which a second back press exits. */
        const val DOUBLE_BACK_MS = 2_000L

        /** Time allowed for the page to answer the "is a dialog open" probe. */
        const val BUSY_PROBE_TIMEOUT_MS = 1_500L

        /**
         * ARIA-only probe, run before a resume refresh.
         *
         * If a modal (add expense, invite, delete confirmation) is on screen the
         * user has unsaved input, so the refresh stands down for one cycle
         * instead of throwing that input away. Querying the DOM by role keeps
         * this decoupled from the web app's internals.
         */
        const val BUSY_PROBE_JS =
            "(function(){try{return document.querySelector('[role=dialog],[role=alertdialog]')?'busy':'ok'}catch(e){return 'ok'}})()"
    }
}
