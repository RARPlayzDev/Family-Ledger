/**
 * Native bridge injected by the Android shell (see
 * `mobile-app/.../MainActivity.kt`) — CSV export, build label and
 * pull-to-refresh control. Absent in every browser, so the guards below keep
 * the web path untouched.
 */
type FamilyLedgerAndroidBridge = {
  /** @returns `"saved:<path>"` on success, `"error:<reason>"` otherwise. */
  saveBase64: (fileName: string, mimeType: string, base64Content: string) => string;
  appVersion: () => string;
  /**
   * Stands the shell's pull-to-refresh down while a modal is open (see
   * `src/lib/native-bridge.ts`). Optional, so an older shell build degrades
   * to a no-op instead of an exception.
   */
  setPullToRefreshEnabled?: (enabled: boolean) => void;
};

declare global {
  interface Window {
    FamilyLedgerAndroid?: FamilyLedgerAndroidBridge;
  }
}

function androidBridge(): FamilyLedgerAndroidBridge | null {
  const bridge = typeof window === 'undefined' ? undefined : window.FamilyLedgerAndroid;
  return bridge && typeof bridge.saveBase64 === 'function' ? bridge : null;
}

/** Strips the `data:` URL prefix; the bridge wants the payload only. */
function readAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the export.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const comma = dataUrl.indexOf(',');
      resolve(comma === -1 ? '' : dataUrl.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Triggers a client-side file download (used by the CSV export).
 *
 * On the web this is an anchor carrying a `download` attribute. Inside the
 * Android WebView that attribute is ignored — the blob URL would simply be
 * navigated to and the ledger would render as raw text — so when the shell is
 * detected the bytes are handed over for native saving instead.
 */
export function downloadTextFile(params: {
  fileName: string;
  content: string;
  mimeType?: string;
}): void {
  const { fileName, content, mimeType = 'text/csv;charset=utf-8' } = params;
  // A BOM keeps Excel from mangling non-ASCII characters (member names, notes).
  const blob = new Blob([`\uFEFF${content}`], { type: mimeType });

  const bridge = androidBridge();
  if (bridge) {
    // The shell raises its own confirmation toast and reports failures there,
    // so the return value only needs to reach the console for debugging.
    void readAsBase64(blob)
      .then((base64) => bridge.saveBase64(fileName, mimeType, base64))
      .catch((error: unknown) => {
        console.error('Could not hand the export to the Android shell', error);
      });
    return;
  }

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
