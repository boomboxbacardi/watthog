// The hog's food and weather: equivalence objects drawn in the same chunky
// outline style as the mascot. Placeholders for the commissioned set.

export function ToastDoodle({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden>
      <path
        d="M5 18 Q4 7 12 7 Q14 2 20 4 Q26 2 28 7 Q36 7 35 18 L35 31 Q35 36 30 36 L10 36 Q5 36 5 31 Z"
        fill="#f0c879"
        stroke="var(--outline)"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path
        d="M10 19 Q9.5 12 14.5 12 Q16 9 20 10.2 Q24 9 25.5 12 Q30.5 12 30 19 L30 28 Q30 31 27 31 L13 31 Q10 31 10 28 Z"
        fill="#f8e3b0"
      />
    </svg>
  );
}

export function TroughDoodle({
  size = 90,
  className,
}: {
  size?: number;
  className?: string;
}) {
  // A chunky feeding trough, drawn snout-height so the hog can eat from it.
  // Amber-soft fill ties the trough to energy (the thing it's full of).
  return (
    <svg viewBox="0 0 80 56" width={size} height={(size * 56) / 80} className={className} aria-hidden>
      {/* legs */}
      <rect x={16} y={40} width={8} height={14} rx={3} fill="var(--outline)" />
      <rect x={56} y={40} width={8} height={14} rx={3} fill="var(--outline)" />
      {/* bowl: a trapezoid, wider at the rim */}
      <path
        d="M6 20 L74 20 L64 44 Q62 48 56 48 L24 48 Q18 48 16 44 Z"
        fill="var(--volt-soft)"
        stroke="var(--outline)"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      {/* rim highlight */}
      <path d="M10 20 L70 20" stroke="var(--outline)" strokeWidth={4} strokeLinecap="round" opacity={0.18} />
    </svg>
  );
}

export function SparkDoodle({
  size = 30,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 36 40" width={size} height={(size * 40) / 36} className={className} aria-hidden>
      <path
        d="M21 2 L7 22 L15 22 L13 38 L29 16 L19 16 Z"
        fill="var(--volt)"
        stroke="var(--outline)"
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </svg>
  );
}
