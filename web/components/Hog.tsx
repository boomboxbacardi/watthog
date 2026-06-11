// The mascot, drawn from geometric primitives so it scales as a logo mark.
// Chunky outlines per DESIGN.md ("children's book meets developer tool").
// Real illustrated stages replace this once artwork is generated; the props
// API (stage, sleeping, blink, eating, size) is the contract that stays.
//
// Pupils sit in a group translated by --pupil-x / --pupil-y so a client
// island (HeroHog) can make the pig watch the cursor without this file
// leaving the server.

import type { Stage } from "@/lib/equivalence";

// Body grows with stage; the face stays the same so it reads as one pig.
const CHONK: Record<Stage, number> = { 1: 0.62, 2: 0.78, 3: 1, 4: 1.18, 5: 1.36 };

const INK = "var(--outline)";

export function Hog({
  stage = 3,
  size = 200,
  sleeping = false,
  blink = false,
  eating = false,
  className,
}: {
  stage?: Stage;
  size?: number;
  sleeping?: boolean;
  blink?: boolean;
  eating?: boolean;
  className?: string;
}) {
  const c = CHONK[stage];
  const rx = 62 * c;
  const ry = 48 * c;
  const cx = 110;
  const cy = 102;
  const earY = cy - ry + 4;
  const legY = cy + ry - 10;
  const eyesClosed = sleeping || blink;
  const eyeY = 88;
  const e1x = cx + rx * 0.3;
  const e2x = cx + rx * 0.66;
  const snoutX = cx + rx * 0.84;
  const tail = `M ${cx - rx} ${cy} q -16 -8 -9 -19 q 6 -9 14 -3`;

  return (
    <svg
      viewBox="0 0 220 170"
      width={size}
      height={(size * 170) / 220}
      className={className}
      role="img"
      aria-label={sleeping ? "A sleeping pig" : "A pig"}
    >
      {/* ground shadow */}
      <ellipse cx={cx} cy={160} rx={rx * 0.9} ry={7} fill="currentColor" opacity={0.08} />
      {/* tail: outline pass under a fill pass for a chunky single curl */}
      <path d={tail} fill="none" stroke={INK} strokeWidth={10} strokeLinecap="round" />
      <path d={tail} fill="none" stroke="var(--pig)" strokeWidth={5} strokeLinecap="round" />
      {/* legs */}
      <rect x={cx - rx * 0.55} y={legY} width={17} height={26} rx={8.5} fill="var(--pig-dark)" stroke={INK} strokeWidth={3.5} />
      <rect x={cx + rx * 0.55 - 17} y={legY} width={17} height={26} rx={8.5} fill="var(--pig-dark)" stroke={INK} strokeWidth={3.5} />
      {/* body */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="var(--pig)" stroke={INK} strokeWidth={5} />
      {/* ears */}
      <path
        d={`M ${cx + rx * 0.35} ${earY} q -2 -22 16 -24 q 8 12 -2 26 Z`}
        fill="var(--pig)"
        stroke={INK}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path
        d={`M ${cx + rx * 0.72} ${earY + 6} q 4 -22 22 -20 q 5 13 -8 25 Z`}
        fill="var(--pig-dark)"
        stroke={INK}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      {/* eyes */}
      {eyesClosed ? (
        <>
          <path d={`M ${e1x - 5} ${eyeY} q 5 6 10 0`} stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
          <path d={`M ${e2x - 5} ${eyeY} q 5 6 10 0`} stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <g style={{ transform: "translate(var(--pupil-x, 0px), var(--pupil-y, 0px))" }}>
          <circle cx={e1x} cy={eyeY} r={5.5} fill={INK} />
          <circle cx={e2x} cy={eyeY} r={5.5} fill={INK} />
          <circle cx={e1x + 1.8} cy={eyeY - 1.8} r={1.6} fill="#fff" opacity={0.9} />
          <circle cx={e2x + 1.8} cy={eyeY - 1.8} r={1.6} fill="#fff" opacity={0.9} />
        </g>
      )}
      {/* cheek blush */}
      <circle cx={cx + rx * 0.16} cy={106} r={7.5} fill="var(--pig-dark)" opacity={0.5} />
      {/* mouth: a contented smile, or wide open when fed */}
      {eating ? (
        <ellipse cx={snoutX - 4} cy={123} rx={9} ry={7} fill={INK} />
      ) : (
        <path
          d={`M ${snoutX - 16} ${120} q 8 7 17 1`}
          stroke={INK}
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {/* snout */}
      <ellipse cx={snoutX} cy={103} rx={20} ry={15} fill="var(--pig-dark)" stroke={INK} strokeWidth={4} />
      <ellipse cx={snoutX - 6} cy={103} rx={3.2} ry={5.2} fill={INK} opacity={0.6} />
      <ellipse cx={snoutX + 6} cy={103} rx={3.2} ry={5.2} fill={INK} opacity={0.6} />
    </svg>
  );
}

export function HogMark({ size = 28 }: { size?: number }) {
  return <Hog stage={3} size={size} />;
}
