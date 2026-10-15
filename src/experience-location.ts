/** Resolve from the matching environment, then pin the iframe to that URL. */
export function publicationApiOrigin(scriptSrc?: string): string {
  if (scriptSrc && new URL(scriptSrc).hostname === 'cdn.staging.scenaro.io') {
    return 'https://api.staging.scenaro.io';
  }
  return 'https://api.scenaro.io';
}

export function experienceLocation(address: string, publicationId: string, language?: string): string {
  const url = new URL(address);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Unsupported experience URL');
  }
  url.searchParams.set('scenario', publicationId);
  if (language) url.searchParams.set('language', language);
  url.searchParams.set('scenaroTransition', '1');
  return url.toString();
}

export async function locateExperience(publicationId: string, scriptSrc?: string, override?: string, language?: string): Promise<string> {
  if (override?.trim()) return experienceLocation(override.trim(), publicationId, language);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${publicationApiOrigin(scriptSrc)}/v1/public/publications/${encodeURIComponent(publicationId)}`, {
      credentials: 'omit', signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Publication lookup failed (${response.status})`);
    const publication = await response.json();
    const address = publication?.configuration?.iframe_url;
    if (typeof address !== 'string' || !address.trim()) throw new Error('Publication has no experience URL');
    return experienceLocation(address, publicationId, language);
  } finally {
    clearTimeout(timeout);
  }
}
