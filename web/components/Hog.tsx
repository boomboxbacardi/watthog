// The mascot, drawn from geometric primitives so it scales as a logo mark.
// Real illustrated stages replace this once artwork is generated; the props
// API (stage, sleeping, size) is the contract that stays.

import type { Stage } from "@/lib/equivalence";

// Body grows with stage; the face stays the same so it reads as one pig.
const CHONK: Record<Stage, number> = { 1: 0.62, 2: 0.78, 3: 1, 4: 1.18, 5: 1.36 };

export function Hog({
  stage = 3,
  size = 200,
  sleeping = false,
  className,
}: {
  stage?: Stage;
  size?: number;
  sleeping?: boolean;
  className?: string;
}) {
  const c = CHONK[stage];
  const rx = 62 * c;
  const ry = 48 * c;
  const cx = 110;
  const cy = 102;
  const earY = cy - ry + 4;
  const legY = cy + ry - 8;

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
      <ellipse cx={cx} cy={158} rx={rx * 0.9} ry={7} fill="currentColor" opacity={0.08} />
      {/* tail */}
      <path
        d={`M ${cx - rx} ${cy} q -14 -6 -8 -16 q 5 -8 12 -3`}
        fill="none"
        stroke="var(--pig-dark)"
        strokeWidth={6}
        strokeLinecap="round"
      />
      {/* legs */}
      <rect x={cx - rx * 0.55} y={legY} width={16} height={22} rx={8} fill="var(--pig-dark)" />
      <rect x={cx + rx * 0.55 - 16} y={legY} width={16} height={22} rx={8} fill="var(--pig-dark)" />
      {/* ears */}
      <path
        d={`M ${cx + rx * 0.35} ${earY} q -2 -22 16 -24 q 8 12 -2 26 Z`}
        fill="var(--pig-dark)"
      />
      <path
        d={`M ${cx + rx * 0.72} ${earY + 6} q 4 -22 22 -20 q 5 13 -8 25 Z`}
        fill="var(--pig-dark)"
      />
      {/* body */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="var(--pig)" />
      {/* eyes */}
      {sleeping ? (
        <>
          <path d={`M ${cx + rx * 0.28} 88 q 5 5 10 0`} stroke="#2b2126" strokeWidth={4} fill="none" strokeLinecap="round" />
          <path d={`M ${cx + rx * 0.62} 88 q 5 5 10 0`} stroke="#2b2126" strokeWidth={4} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={cx + rx * 0.33} cy={88} r={5} fill="#2b2126" />
          <circle cx={cx + rx * 0.67} cy={88} r={5} fill="#2b2126" />
        </>
      )}
      {/* snout */}
      <ellipse cx={cx + rx * 0.82} cy={104} rx={20} ry={15} fill="var(--pig-dark)" />
      <ellipse cx={cx + rx * 0.82 - 6} cy={104} rx={3.2} ry={5} fill="#2b2126" opacity={0.55} />
      <ellipse cx={cx + rx * 0.82 + 6} cy={104} rx={3.2} ry={5} fill="#2b2126" opacity={0.55} />
      {/* cheek */}
      <circle cx={cx + rx * 0.25} cy={104} r={7} fill="var(--pig-dark)" opacity={0.45} />
    </svg>
  );
}

export function HogMark({ size = 28 }: { size?: number }) {
  return <Hog stage={3} size={size} />;
}
