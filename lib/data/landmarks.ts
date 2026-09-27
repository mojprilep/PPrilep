/**
 * Well-known Prilep landmarks drawn on the location picker so people can orient
 * themselves when placing a pin for an issue, idea or initiative. Display-only:
 * they never capture taps.
 *
 * Mirrored in mojprilep-mobile/src/lib/data/landmarks.ts — keep both in sync.
 * Саат кула was pinned by the site owner (OSM has no node for the tower itself);
 * the rest come from OpenStreetMap.
 */
export type Landmark = {
  name: string;
  emoji: string;
  /** [lng, lat], MapLibre order. */
  lngLat: [number, number];
};

export const LANDMARKS: Landmark[] = [
  { name: "Саат кула", emoji: "🕰️", lngLat: [21.555031, 41.345955] },
  { name: "Болница", emoji: "🏥", lngLat: [21.56311, 41.34312] },
  { name: "Могила", emoji: "🏛️", lngLat: [21.55451, 41.33429] },
  { name: "Економски факултет", emoji: "🎓", lngLat: [21.541, 41.35396] },
  { name: "Автобуска станица", emoji: "🚌", lngLat: [21.54047, 41.34425] },
];
