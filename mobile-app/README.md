# FamilyLedger for Android

A production-shaped WebView shell around the deployed web app at
<https://familyledger-eight.vercel.app>. The React app does all the work; this
module is the native chrome — launcher icon, splash screen, status/navigation
bar handling, pull-to-refresh, offline recovery and the file-save bridge the CSV
export needs.

`minSdk 24` · `targetSdk 37` · Kotlin · AGP 9.4.1 · Gradle 9.6

---

## Quick start

Open the `mobile-app` folder in Android Studio and press **Run**, or from a
terminal:

```powershell
cd mobile-app
.\gradlew.bat :app:assembleDebug          # debug APK
.\gradlew.bat :app:installDebug           # build + install on a connected device
.\gradlew.bat :app:assembleRelease        # unsigned release APK
.\gradlew.bat :app:bundleRelease          # Play Store .aab
```

Outputs land in `app/build/outputs/apk/…` and `app/build/outputs/bundle/…`.

Everything the shell does is driven by three constants at the top of
`MainActivity.kt` — change the first one to point the app at a different
deployment:

| Constant | Purpose |
| -------- | ------- |
| `START_URL` | The page the app opens. |
| `APP_HOST` | Host kept inside the WebView; everything else opens externally. |
| `JS_BRIDGE_NAME` | `window` property the web app uses to find the save bridge. |

---

## What the shell actually does

### Branding

| Asset | Where | Notes |
| ----- | ----- | ----- |
| Adaptive icon (API 26+) | `res/drawable/ic_launcher_foreground.xml`, `ic_launcher_background.xml` | Vector, so it stays crisp at every density and inside every launcher mask. |
| Themed icon (Android 13+) | `res/drawable/ic_launcher_monochrome.xml` | Single-colour silhouette the launcher tints to match the wallpaper. |
| Legacy rasters (API 24–25) | `res/mipmap-*/ic_launcher.png`, `ic_launcher_round.png` | Generated, not hand-edited. |
| Play Store listing | `store/play-store-icon-512.png` | 512×512, upload to the Play Console. |
| Splash screen | `res/drawable/ic_logo.xml` + `Theme.FamilyLedger.Splash` | Held until the first page finishes loading. |
| Offline screen | `res/layout/activity_main.xml` | Reuses `ic_logo`, so the app stays recognisable when it cannot load. |

The geometry is the same ledger-card-and-accent-rule mark as the web app's
`public/favicon.svg`, and the palette in `res/values/colors.xml` mirrors
`tailwind.config.js` one-for-one — so the splash, progress bar and
pull-to-refresh spinner are indistinguishable from the page they sit next to.

Regenerate the rasters after changing the mark:

```powershell
powershell -ExecutionPolicy Bypass -File tools\generate-icons.ps1
```

### Refresh on every open

`onResume` reloads the current route whenever the app returns from the
background (`refreshAfterBackground()`), which is what stops a shared household
ledger from showing a stale day after the phone has been in a pocket.

One guard rail: before reloading, the page is asked whether a modal is open —

```js
document.querySelector('[role=dialog],[role=alertdialog]')
```

— and the refresh stands down for that cycle if one is. An in-progress
"add expense" form is therefore never wiped out by returning from the lock
screen or the file picker. The probe is ARIA-only, so it does not depend on the
web app's internal class names. If the page cannot answer within 1.5 s the
refresh happens anyway.

### Theming and insets

The app is deliberately **dark-only**: `res/values-night/themes.xml` was removed
rather than duplicated, because the web app ships a single dark palette and a
divergent night theme could only ever cause a colour flash.

The window is edge to edge and `MainActivity` applies `systemBars + ime` insets
as **native padding on the root view**. That is why the web app's `.pb-safe`
utilities resolve to `0` inside the app: the native padding already clears the
gesture handle, and it grows with the keyboard so a focused amount field is never
hidden behind it.

### Security posture

* `res/xml/network_security_config.xml` refuses cleartext outright; the manifest
  agrees.
* `allowBackup="false"` plus `data_extraction_rules.xml` — the WebView's
  `localStorage` holds the session token and must never leave the device.
* `allowFileAccess` / `allowContentAccess` are off, `mixedContentMode` is
  `NEVER_ALLOW`, and the file chooser is the only way bytes come in.
* Third-party cookies are refused; everything the app talks to is same-site.
* `onReceivedSslError` always calls `handler.cancel()`. There is no "continue
  anyway" path.
* Non-app hosts never load inside the WebView — they go to Custom Tabs — so the
  `@JavascriptInterface` bridge is unreachable from a foreign origin.

### Failure handling

| Failure | Behaviour |
| ------- | --------- |
| No connection / DNS failure | Branded screen with **Try again** and **Open in browser**. |
| HTTP >= 400 on the document | Same screen, naming the status code. |
| TLS problem | Same screen; never bypassed. |
| Renderer process killed | The dead WebView is destroyed and a fresh one is built on **Try again** — no app restart, no grey rectangle. |
| Hung first load | The splash releases itself after 12 s. |

### Native save bridge (CSV export)

WebView ignores the HTML `download` attribute, so the web app's export would
otherwise navigate to a `blob:` URL and render the ledger as raw text.
`src/lib/download.ts` therefore looks for `window.FamilyLedgerAndroid` first and
hands the bytes over:

```ts
window.FamilyLedgerAndroid.saveBase64(fileName, mimeType, base64Content);
// -> "saved:Download/FamilyLedger/familyledger-ledger-2026-09.csv"
```

On API 29+ the file goes to **Download/FamilyLedger** through MediaStore, which
needs no storage permission. On API 24–28 it falls back to this app's own
external Downloads directory — again with no permission, because asking for
`WRITE_EXTERNAL_STORAGE` is not something a ledger app could justify to Play.

### Pull-to-refresh vs. open dialogs

`SwipeRefreshLayout` wraps the WebView and only takes a swipe for a refresh
when the page cannot scroll up any further. Radix locks body scroll while a
dialog is open, which makes the page always look pinned to the top — so a
swipe inside a dialog would have reloaded the page instead of scrolling the
dialog.

The web app's `src/lib/native-bridge.ts` watches dialogs mounting and
unmounting and flips a flag through the same bridge:

```ts
window.FamilyLedgerAndroid.setPullToRefreshEnabled(false); // dialog open
window.FamilyLedgerAndroid.setPullToRefreshEnabled(true); // dialog closed
```

The shell applies the flag through `setOnChildScrollUpCallback`, which keeps
the default rule (refresh only when the page itself is at the top) and adds
"…and never while a modal is open". The dialog and sheet overlays also carry
`overscroll-contain touch-none`, so a fling inside a modal cannot chain-scroll
the page behind it either.

---

## Before you ship

1. **Change the application id.** `com.example.familyledger` in
   `app/build.gradle.kts` is the Android Studio default; pick a real
   `applicationId` (`dev.yourname.familyledger`) and update the App Links target
   to match.
2. **Add a release signing config** and keep the keystore out of git.
3. **Add the release certificate fingerprint to App Links** (see below). Until
   you do, an invite link opens in the browser instead of the app — harmless,
   just less good.
4. **Bump `versionCode` / `versionName`** in `app/build.gradle.kts`.
5. **Turn on the release optimiser** (`optimization { enable = true }`) once the
   build is stable; it is off by default so the first release stays debuggable.

## App Links (invite links)

The manifest claims `https://familyledger-eight.vercel.app`, so a message like
`…/onboarding?join=ABC123` opens straight in the app.

Verification needs two things to line up:

1. `public/.well-known/assetlinks.json` on the domain, listing the certificate
   the installed build is signed with.
2. `vercel.json` must not rewrite that path to `index.html` — the
   `\\.well-known/` exclusion in the rewrite pattern takes care of it.

The deployed file currently carries the **debug** fingerprint from this machine,
so debug builds can be tested immediately. Replace it before you release:

```powershell
powershell -ExecutionPolicy Bypass -File tools\print-signing-fingerprint.ps1 `
    -Keystore C:\keys\familyledger-release.jks -Alias familyledger
```

Then redeploy the web app and re-run verification on the device:

```powershell
adb shell pm verify-app-links --re-verify com.example.familyledger
adb shell pm get-app-links com.example.familyledger
```

`store/assetlinks.json.example` shows the full file shape.

---

## Testing against a local build of the web app

`network_security_config.xml` already allows cleartext to `10.0.2.2` and
`localhost`, so an emulator can reach a workstation:

```powershell
# in the repo root
npm run dev -- --host
```

Then temporarily point `START_URL` at `http://10.0.2.2:5173/` (emulator) or your
machine's LAN address (physical device). Pull-to-refresh, downloads and deep
links keep working, because only the source changed.

---

## Layout of this module

```
mobile-app/
├── app/
│   ├── build.gradle.kts            # namespace, SDK levels, viewBinding/buildConfig
│   └── src/main/
│       ├── AndroidManifest.xml     # permissions, App Links, configChanges, network policy
│       ├── java/com/example/familyledger/MainActivity.kt
│       └── res/
│           ├── drawable/           # ic_logo, adaptive-icon layers
│           ├── layout/activity_main.xml
│           ├── mipmap-*/           # generated rasters (API 24-25)
│           ├── mipmap-anydpi-v26/  # adaptive icons
│           ├── values/             # brand colours, strings, themes
│           └── xml/                # network + backup policy
├── gradle/libs.versions.toml       # dependency catalog
├── store/                          # Play listing icon + assetlinks template
└── tools/                          # icon generator, fingerprint helper
```

### Why the WebView is built in code

`SwipeRefreshLayout` starts childless in `activity_main.xml` and the WebView is
created in `createWebView()`. That is the only way to recover from
`onRenderProcessGone` without restarting the Activity: the dead instance is
detached and destroyed, and **Try again** builds a fresh one.

### Reading the code

`MainActivity.kt` is organised into labelled sections, in the order the app uses
them:

```
Lifecycle  ->  Window & insets  ->  Chrome around the page  ->  The WebView
           ->  WebView clients  ->  Loading & recovery  ->  Navigation policy
           ->  Offline panel & splash  ->  Native save bridge
```
