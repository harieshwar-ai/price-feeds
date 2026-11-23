/** Bot/challenge page detection (Cloudflare, captcha markers, hard blocks). */
export function isBotChallenge(html: string, status: number): boolean {
  if (status === 403 || status === 429) return true;
  const lower = html.slice(0, 8000).toLowerCase();
  return (
    lower.includes("just a moment") ||
    lower.includes("challenges.cloudflare.com") ||
    lower.includes("cdn-cgi/challenge-platform") ||
    lower.includes("dns points to prohibited ip") ||
    lower.includes("enable javascript and cookies") ||
    lower.includes("cf-error-details") ||
    /\bcaptcha\b/i.test(lower.slice(0, 4000))
  );
}

export function isRateLimitedStatus(status: number): boolean {
  return status === 429;
}

export function isBlockedStatus(status: number): boolean {
  return status === 403;
}

export function isTransientServerError(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}