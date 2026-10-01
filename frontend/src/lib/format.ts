/** "512 B", "2 KB", "1.5 MB": short sizes for the upload chip. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Number(kb.toFixed(1))} KB`;
  return `${Number((kb / 1024).toFixed(1))} MB`;
}
