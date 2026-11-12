/** Public, bounded catalogue contract; raw provider URLs/tokens stay server-side. */
export const mediaKinds = [
  "albums",
  "artists",
  "tracks",
  "playlists",
  "radios",
];
export function mediaImage(item) {
  const images = [
    ...(item?.image && typeof item.image === "object" ? [item.image] : []),
    ...(Array.isArray(item?.metadata?.images) ? item.metadata.images : []),
    ...(Array.isArray(item?.album?.metadata?.images)
      ? item.album.metadata.images
      : []),
  ];
  const image =
    images.find(
      (i) => i?.type === "thumb" && typeof i?.proxy_id === "string",
    ) || images[0];
  return typeof image?.proxy_id === "string" &&
    /^[a-f0-9]{64}$/i.test(image.proxy_id)
    ? image.proxy_id.toLowerCase()
    : null;
}
export function publicMedia(item, key) {
  const type = item.media_type;
  return {
    id: key,
    sources: mediaSources(item),
    type,
    name: String(item.name || item.title || "Naam onbekend").slice(0, 300),
    artist: (item.artists || [])
      .map((a) => a.name)
      .filter(Boolean)
      .join(", ")
      .slice(0, 300),
    album: String(item.album?.name || "").slice(0, 300),
    duration:
      Number.isFinite(item.duration) && item.duration > 0
        ? item.duration
        : null,
    available: item.available !== false,
    favorite: item.favorite === true,
    artwork: mediaImage(item) ? `/api/artwork/${mediaImage(item)}` : null,
  };
}

export function mediaSources(item){const values=[item?.provider,...(item?.provider_mappings||[]).map(p=>p.provider_domain||p.provider_instance)].filter(v=>typeof v==='string').map(v=>v.toLowerCase());return [...new Set(values.map(v=>/^filesystem(?:_|$)|^local(?:_|$)|^smb(?:_|$)|^sftp(?:_|$)/.test(v)?'local':v.startsWith('spotify')?'spotify':v.startsWith('tidal')?'tidal':null).filter(Boolean))];}
