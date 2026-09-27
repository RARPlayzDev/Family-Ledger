/**
 * Helpers for the Android shell's JavaScript bridge (see
 * `mobile-app/app/src/main/java/com/example/familyledger/MainActivity.kt`).
 *
 * Every helper is a no-op in a plain browser: the shell injects
 * `window.FamilyLedgerAndroid` only inside the FamilyLedger WebView, and
 * `src/lib/download.ts` owns the global declaration.
 */

/**
 * Enables or disables the shell's pull-to-refresh gesture.
 *
 * `SwipeRefreshLayout` wraps the WebView and decides whether to take a
 * downward swipe for a refresh by asking whether the page can still scroll
 * up. Radix locks body scroll while a modal is open, so the page always
 * answers "I am at the top" — and a swipe inside the dialog would reload the
 * page instead of scrolling the dialog. Standing the refresh down for as long
 * as a modal is visible removes that ambiguity.
 *
 * Safe to call anywhere: without the shell the call does nothing.
 */
export function setPullToRefreshEnabled(enabled: boolean): void {
  window.FamilyLedgerAndroid?.setPullToRefreshEnabled?.(enabled);
}

/** Dialog and alert-dialog content; Radix portals both straight onto `<body>`. */
const MODAL_SELECTOR = '[role="dialog"], [role="alertdialog"]';

let observer: MutationObserver | null = null;

/**
 * Keeps the shell's pull-to-refresh flag in step with open modals: disabled
 * the moment a dialog mounts, re-enabled when the last one unmounts. Radix
 * keeps the portal in the DOM until the exit animation finishes, so the flag
 * comes back exactly when the dialog stops being interactive.
 *
 * Idempotent — calling it twice keeps the single observer.
 */
export function initPullToRefreshGuard(): void {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
  if (observer !== null || !document.body) return;

  const sync = () => {
    setPullToRefreshEnabled(document.querySelector(MODAL_SELECTOR) === null);
  };

  observer = new MutationObserver(sync);
  // `subtree` covers portals that nest their content below a wrapper div.
  observer.observe(document.body, { childList: true, subtree: true });
  sync();
}