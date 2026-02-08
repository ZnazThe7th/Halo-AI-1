/**
 * Privacy-safe device fingerprinting.
 * Generates a random UUID on first run and persists in localStorage.
 * Sent as X-Device-Fingerprint header on savepoint requests.
 */

const STORAGE_KEY = 'halo_device_fingerprint';

function generateUUID(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDeviceFingerprint(): string {
  let fingerprint = localStorage.getItem(STORAGE_KEY);
  if (!fingerprint) {
    fingerprint = generateUUID();
    localStorage.setItem(STORAGE_KEY, fingerprint);
  }
  return fingerprint;
}
