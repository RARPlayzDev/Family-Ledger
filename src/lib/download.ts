/** Triggers a client-side file download (used by the CSV export). */
export function downloadTextFile(params: {
  fileName: string;
  content: string;
  mimeType?: string;
}): void {
  const { fileName, content, mimeType = 'text/csv;charset=utf-8' } = params;
  // A BOM keeps Excel from mangling non-ASCII characters (member names, notes).
  const blob = new Blob([`\uFEFF${content}`], { type: mimeType });
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
