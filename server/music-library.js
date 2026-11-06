import { createHash } from "node:crypto";
import { mediaKinds, publicMedia } from "../shared/media.js";
export class MusicLibrary {
  constructor(service) {
    this.service = service;
    this.items = new Map();
    this.pages = new Map();
  }
  remember(item) {
    if (
      !item ||
      !["album", "artist", "track", "playlist", "radio"].includes(
        item.media_type,
      ) ||
      typeof item.uri !== "string" ||
      item.uri.length > 2048
    )
      return null;
    const key = createHash("sha256")
      .update(item.media_type + ":" + item.uri)
      .digest("hex")
      .slice(0, 24);
    this.items.delete(key);
    this.items.set(key, {
      item: {
        uri: item.uri,
        item_id: item.item_id,
        provider: item.provider,
        media_type: item.media_type,
        available: item.available,
      },
      at: Date.now(),
    });
    while (this.items.size > 400)
      this.items.delete(this.items.keys().next().value);
    return publicMedia(item, key);
  }
  get(id) {
    const entry = this.items.get(id);
    if (!entry || Date.now() - entry.at > 600000)
      throw Error("Selectie verlopen; laad de bibliotheek opnieuw");
    return entry.item;
  }
  async browse({
    kind = "albums",
    q = "",
    offset = 0,
    parent = "",
    favorite = false,
  }) {
    if (this.service.status !== "connected")
      throw Error("Music Assistant is niet verbonden");
    if (
      !mediaKinds.includes(kind) ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 100000 ||
      typeof q !== "string" ||
      q.length > 120
    )
      throw Error("Ongeldige bibliotheekquery");
    const key = JSON.stringify([kind, q, offset, parent, favorite]);
    const cached = this.pages.get(key);
    if (cached && Date.now() - cached.at < 20000) return cached.result;
    let raw;
    if (parent) {
      const item = this.get(parent);
      const commands = {
        album: "music/albums/album_tracks",
        artist: "music/artists/artist_albums",
        playlist: "music/playlists/playlist_tracks",
      };
      if (!commands[item.media_type])
        throw Error("Geen onderliggende muziek beschikbaar");
      const rows = await this.service.transport.command(
        commands[item.media_type],
        {
          item_id: item.item_id,
          provider_instance_id_or_domain: item.provider,
        },
        { maxItems: 1000 },
      );
      raw = (Array.isArray(rows) ? rows : []).slice(offset, offset + 4);
    } else if (q.trim()) {
      const found = await this.service.transport.command("music/search", {
        search_query: q.trim(),
        media_types: ["album", "artist", "track", "playlist", "radio"],
        limit: 10,
      });
      raw = mediaKinds
        .flatMap((type) => (Array.isArray(found?.[type]) ? found[type] : []))
        .slice(offset, offset + 4);
    } else
      raw = await this.service.transport.command(
        `music/${kind}/library_items`,
        { limit: 4, offset, ...(favorite ? { favorite: true } : {}) },
      );
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.items)
        ? raw.items
        : null;
    if (!list) throw Error("Onverwacht bibliotheekantwoord");
    const result = {
      items: list
        .slice(0, 3)
        .map((i) => this.remember(i))
        .filter(Boolean),
      hasMore: list.length > 3,
      offset,
      limit: 3,
      source: "music-assistant",
    };
    this.pages.set(key, { at: Date.now(), result });
    while (this.pages.size > 40)
      this.pages.delete(this.pages.keys().next().value);
    return result;
  }
  async enqueue(id, option) {
    if (!["replace", "next", "add"].includes(option))
      throw Error("Onbekende wachtrijactie");
    const item = this.get(id),
      s = this.service;
    if (
      s.status !== "connected" ||
      !s.playback.connected ||
      !s.playerId ||
      !s.config.controlEnabled
    )
      throw Error("Speler niet beschikbaar of alleen-lezen");
    if (item.available === false || item.media_type === "artist")
      throw Error("Kies een beschikbaar album, nummer, playlist of station");
    if (
      !Number.isFinite(s.playback.volume) ||
      s.playback.volume > s.config.volumeLimit
    )
      throw Error("Controleer of verlaag eerst het spelervolume");
    const player = s.players.find((p) => p.player_id === s.playerId);
    if (!player || player.available === false)
      throw Error("Geselecteerde speler niet beschikbaar");
    if (player.synced_to && player.synced_to !== s.playerId)
      throw Error("Bedien de groepsleider voor deze wachtrij");
    const queue = s.queueId || s.playerId;
    await s.transport.command("player_queues/play_media", {
      queue_id: queue,
      media: item.uri,
      option,
    });
    await s.refresh();
    return { ok: true }; // Mutations are never retried.
  }
}
