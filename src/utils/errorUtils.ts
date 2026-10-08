/**
 * Converts technical upload errors into clean, presentable user-friendly messages.
 */
export function getPresentableUploadErrorMessage(
  err: any,
  fallbackMessage: string = 'Unable to upload image. Please try again.'
): string {
  if (!err) return fallbackMessage;

  // 1. HTTP Status code checks
  const status = err?.response?.status;
  if (status === 413) {
    return 'The selected image is too large. Please choose a smaller file.';
  }
  if (status === 415) {
    return 'The image format is not supported. Please select a JPG, PNG, or WebP image.';
  }
  if (status === 401 || status === 403) {
    return 'You do not have permission to upload files.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'The file storage service is temporarily unavailable. Please try again later.';
  }

  // 2. Network / SSL / Connection issues
  const code = err?.code || '';
  const messageStr = (err?.message || '').toLowerCase();
  if (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    messageStr.includes('network error') ||
    messageStr.includes('failed to fetch') ||
    messageStr.includes('certificate') ||
    messageStr.includes('cert_') ||
    messageStr.includes('timeout')
  ) {
    return 'Unable to reach the storage server. Please report to Bizgrip Solutions';
  }

  // 3. Check for API-provided message
  const serverMsg = err?.response?.data?.metadata?.message || err?.response?.data?.message || err?.message;
  if (serverMsg && typeof serverMsg === 'string') {
    const trimmed = serverMsg.trim();
    const lower = trimmed.toLowerCase();

    // Ignore raw stack traces, syntax dumps, or raw JSON
    const isRawTechnicalDump =
      lower.includes('exception') ||
      lower.includes('stacktrace') ||
      lower.includes('nullreference') ||
      lower.includes('at retailer.') ||
      lower.includes('http/1') ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('<');

    if (!isRawTechnicalDump && trimmed.length > 0 && trimmed.length < 150) {
      return trimmed;
    }
  }

  return fallbackMessage;
}
