/** Staging CDN scripts resolve publications on the staging API. */
export function embedOrigin(scriptSrc: string | undefined): string {
  return stagingScript(scriptSrc) ? 'https://embed.staging.scenaro.io' : 'https://embed.scenaro.io';
}

export function apiOrigin(scriptSrc: string | undefined): string {
  return stagingScript(scriptSrc) ? 'https://api.staging.scenaro.io' : 'https://api.scenaro.io';
}

/** The experience address stored on the publication, plus the widget handoff. */
export function experienceUrl(iframeUrl: string, publicationId: string, language?: string): string {
  const url = new URL(iframeUrl);
  url.searchParams.set('scenario', publicationId);
  if (language) url.searchParams.set('language', language);
  url.searchParams.set('scenaroTransition', '1');
  return url.toString();
}

function stagingScript(scriptSrc: string | undefined): boolean {
  if (!scriptSrc) return false;
  try {
    return new URL(scriptSrc).hostname === 'cdn.staging.scenaro.io';
  } catch {
    return false;
  }
}
