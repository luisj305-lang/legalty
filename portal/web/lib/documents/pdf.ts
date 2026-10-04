// Isomorphic PDF guards shared by the browser form and the server finalizer.
// No Node-only imports: the same module runs in the browser and in Server Actions.
export const documentLimits = {
  maxFiles: 5,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 25 * 1024 * 1024,
} as const;

// A PDF must begin with the five bytes for `%PDF-` (0x25 0x50 0x44 0x46 0x2d).
export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

// Metadata is only a declaration; the real bytes are verified server-side later.
export function validateDocumentMetadata(items: { name: string; size: number }[]): boolean {
  if (!Array.isArray(items) || items.length > documentLimits.maxFiles) return false;
  let total = 0;
  for (const item of items) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.name !== 'string') return false;
    const name = item.name.trim();
    if (!name || [...name].length > 255) return false;
    if (!Number.isInteger(item.size) || item.size < 1 || item.size > documentLimits.maxFileBytes) return false;
    total += item.size;
  }
  return total <= documentLimits.maxTotalBytes;
}

// Validates the downloaded object against the recorded metadata exactly once.
export function validateDocumentBytes(name: string, expectedSize: number, bytes: Uint8Array): boolean {
  if (typeof name !== 'string' || !name.trim()) return false;
  if (!Number.isInteger(expectedSize) || expectedSize < 1 || expectedSize > documentLimits.maxFileBytes) return false;
  if (!bytes || bytes.length !== expectedSize) return false;
  return isPdf(bytes);
}
