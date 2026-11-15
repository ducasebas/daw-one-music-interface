/** Only video identifiers cross the API boundary; never arbitrary embed URLs. */
export function youtubeVideoId(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  const text = value.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    let id;
    if (host === 'youtu.be') id = url.pathname.slice(1);
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube-nocookie.com'].includes(host)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})\/?$/)?.[1];
    }
    return /^[\w-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}

/** Use a provider's exact recording, never a guessed title-search result. */
export function youtubeTrackVideoId(item) {
  const stream=item?.streamdetails;
  if ((stream?.provider_domain==='ytmusic'||/^ytmusic(?:--|$)/.test(stream?.provider||''))&&/^[\w-]{11}$/.test(stream?.item_id||'')) return stream.item_id;
  const media = item?.media_item || item;
  if (!media) return null;
  if (media.provider === 'ytmusic' && youtubeVideoId(media.item_id)) return media.item_id;
  const uri = typeof media.uri === 'string' ? media.uri.match(/^ytmusic[^:]*:\/\/track\/([\w-]{11})$/) : null;
  if (uri) return uri[1];
  const mapping = media.provider_mappings?.find?.(m => m.provider_domain === 'ytmusic' && m.available !== false && /^[\w-]{11}$/.test(m.item_id || ''));
  return mapping?.item_id || null;
}

export const youtubeDefaults = Object.freeze({revision: 0, providerId: null, consent: false, followCurrent: false});
export function youtubeSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !Object.hasOwn(youtubeDefaults, k))) throw Error('Invalid YouTube settings');
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.consent !== 'boolean' || typeof value.followCurrent !== 'boolean' || value.providerId !== null && (typeof value.providerId !== 'string' || !/^[\w.-]{1,150}$/.test(value.providerId))) throw Error('Invalid YouTube settings');
  if (value.followCurrent && !value.consent) throw Error('Allow YouTube video before following tracks automatically');
  return {...value};
}

/** IFrame API has discrete rates. Correct drift with bounded seeks, not fake rates. */
export function youtubeAdjustment({target, current, now, lastSeek = -Infinity, force = false}) {
  if (![target, current, now].every(Number.isFinite)) return false;
  return (force || Math.abs(target - current) > .85) && (force || now - lastSeek >= 2000);
}
