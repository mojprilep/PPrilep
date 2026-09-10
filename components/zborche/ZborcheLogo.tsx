/**
 * ЗборЧе wordmark — the guessing board itself as the logo: a row of tiles with
 * the last two revealed, Ч in Prilep's teal (the letter the name leans on) and Е
 * filled dark. Pure SVG so it stays crisp at any size and themes cleanly.
 */

type Variant = "empty" | "accent" | "solid";
type Tile = { letter?: string; variant: Variant };

const BRAND = "#2aa99d";

// ЗБОРЧЕ is six letters, so six tiles: four blanks, then ЧЕ. Ч carries the
// accent because the whole name emphasises it ("ЗборЧе", Prilep dialect).
const DEFAULT_TILES: Tile[] = [
  { variant: "empty" },
  { variant: "empty" },
  { variant: "empty" },
  { variant: "empty" },
  { letter: "Ч", variant: "accent" },
  { letter: "Е", variant: "solid" },
];

export default function ZborcheLogo({
  tiles = DEFAULT_TILES,
  height = 40,
  className,
  title = "ЗборЧе",
}: {
  tiles?: Tile[];
  height?: number;
  className?: string;
  title?: string;
}) {
  const SIZE = 100; // tile side, in viewBox units
  const GAP = 14;
  const R = 16;
  const width = tiles.length * SIZE + (tiles.length - 1) * GAP;

  const fills: Record<Variant, { bg: string; fg: string; stroke: string }> = {
    empty: { bg: "transparent", fg: "transparent", stroke: "#d4d4d8" },
    accent: { bg: BRAND, fg: "#ffffff", stroke: BRAND },
    solid: { bg: "#18181b", fg: "#ffffff", stroke: "#18181b" },
  };

  return (
    <svg
      role="img"
      aria-label={title}
      className={className}
      height={height}
      viewBox={`0 0 ${width} ${SIZE}`}
      width={(width / SIZE) * height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      {tiles.map((t, i) => {
        const f = fills[t.variant];
        const x = i * (SIZE + GAP);
        return (
          <g key={i}>
            <rect
              x={x}
              y={0}
              width={SIZE}
              height={SIZE}
              rx={R}
              fill={f.bg}
              stroke={f.stroke}
              strokeWidth={t.variant === "empty" ? 6 : 0}
            />
            {t.letter && (
              <text
                x={x + SIZE / 2}
                y={SIZE / 2}
                fill={f.fg}
                fontSize={62}
                fontWeight={800}
                fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {t.letter}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
