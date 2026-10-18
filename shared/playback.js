export const tracks = [
  {
    id: "aurora",
    title: "Weightless",
    artist: "Marconi Union",
    album: "Ambient Transmissions · Vol. 2",
    duration: 489,
  },
  {
    id: "horizon",
    title: "A Walk",
    artist: "Tycho",
    album: "Dive",
    duration: 316,
  },
  {
    id: "night",
    title: "Near Light",
    artist: "Ólafur Arnalds",
    album: "Living Room Songs",
    duration: 208,
  },
];
export function initialPlayback() {
  return {
    connected: true,
    playing: false,
    position: 0,
    observedAt: Date.now(),
    index: 0,
    queue: tracks,
  };
}
export function positionAt(s, now) {
  return Math.min(
    s.queue[s.index].duration,
    Math.max(0, s.position + (s.playing ? (now - s.observedAt) / 1000 : 0)),
  );
}
export function playbackEvent(s, e, now = Date.now()) {
  const n = { ...s, position: positionAt(s, now), observedAt: now };
  switch (e.type) {
    case "disconnect":
      n.connected = false;
      n.playing = false;
      break;
    case "reconnect":
      n.connected = true;
      break;
    case "play":
      if (n.connected) n.playing = true;
      break;
    case "pause":
      n.playing = false;
      break;
    case "seek":
      if (Number.isFinite(e.position))
        n.position = Math.max(
          0,
          Math.min(e.position, n.queue[n.index].duration),
        );
      break;
    case "next":
      n.index = (n.index + 1) % n.queue.length;
      n.position = 0;
      break;
    case "previous":
      n.index = (n.index + n.queue.length - 1) % n.queue.length;
      n.position = 0;
      break;
    case "queue":
      if (Array.isArray(e.queue) && e.queue.length) {
        n.queue = e.queue;
        n.index = 0;
        n.position = 0;
      }
      break;
    case "metadata":
      n.queue = n.queue.map((t, i) =>
        i === n.index ? { ...t, ...e.metadata } : t,
      );
      break;
  }
  return n;
}
