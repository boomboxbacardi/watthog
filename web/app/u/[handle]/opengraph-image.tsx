import { ImageResponse } from "next/og";
import { getHoggerWithRank, outburnPct } from "@/lib/stats";
import { stageFor, fmtEquivalent, fmtWh } from "@/lib/equivalence";

export const alt = "A hogger's Watthog trough card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand palette, light values (OG cards render mode-agnostic, so we pin light).
const SURFACE = "#fafaf8";
const INK = "#1c1917";
const INK_MUTED = "#6b6560";
const ACCENT = "#c73667";
const ACCENT_SOFT = "#fbe3ec";
const VOLT = "#e09b07";
const PIG = "#f4a8c3";
const PIG_DARK = "#e87fa6";
const OUTLINE = "#2b2126";

type Props = { params: Promise<{ handle: string }> };

// A chunky geometric hog face, built from primitives Satori renders reliably
// (the illustrated mascot SVG is too transform-heavy for Satori).
function HogFace({ size: s }: { size: number }) {
  const ear = s * 0.26;
  return (
    <div style={{ display: "flex", position: "relative", width: s, height: s }}>
      {/* ears */}
      <div
        style={{
          position: "absolute", top: s * 0.02, left: s * 0.12,
          width: ear, height: ear, background: PIG_DARK,
          borderRadius: `${ear}px ${ear}px 0 ${ear}px`, transform: "rotate(8deg)",
          border: `${s * 0.03}px solid ${OUTLINE}`,
        }}
      />
      <div
        style={{
          position: "absolute", top: s * 0.02, right: s * 0.12,
          width: ear, height: ear, background: PIG_DARK,
          borderRadius: `${ear}px ${ear}px ${ear}px 0`, transform: "rotate(-8deg)",
          border: `${s * 0.03}px solid ${OUTLINE}`,
        }}
      />
      {/* head */}
      <div
        style={{
          position: "absolute", top: s * 0.14, left: s * 0.06,
          width: s * 0.88, height: s * 0.74, background: PIG,
          borderRadius: s, border: `${s * 0.035}px solid ${OUTLINE}`,
          display: "flex",
        }}
      />
      {/* eyes */}
      <div style={{ position: "absolute", top: s * 0.4, left: s * 0.3, width: s * 0.07, height: s * 0.07, background: OUTLINE, borderRadius: s }} />
      <div style={{ position: "absolute", top: s * 0.4, right: s * 0.3, width: s * 0.07, height: s * 0.07, background: OUTLINE, borderRadius: s }} />
      {/* snout */}
      <div
        style={{
          position: "absolute", top: s * 0.56, left: s * 0.33,
          width: s * 0.34, height: s * 0.24, background: PIG_DARK,
          borderRadius: s * 0.12, border: `${s * 0.03}px solid ${OUTLINE}`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: s * 0.06,
        }}
      >
        <div style={{ width: s * 0.06, height: s * 0.1, background: OUTLINE, borderRadius: s }} />
        <div style={{ width: s * 0.06, height: s * 0.1, background: OUTLINE, borderRadius: s }} />
      </div>
    </div>
  );
}

export default async function Image({ params }: Props) {
  const { handle } = await params;
  const data = await getHoggerWithRank(handle);

  // Fallback card for unknown handles so the OG never 500s on a bad link.
  const stage = data ? stageFor(data.entry.whPerDay) : { stage: 1 as const, name: "Piglet", minWhPerDay: 0 };
  const displayHandle = data?.entry.handle ?? handle;
  const kWhAll = data ? data.entry.kWhAllTime : 0;
  const rankWeek = data?.rankWeek ?? null;
  const total = data?.total ?? 0;
  const outburn = data ? outburnPct(data.rankAllTime, data.total) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          background: SURFACE, color: INK, padding: 72, justifyContent: "space-between",
          fontFamily: "sans-serif",
        }}
      >
        {/* top: wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 18, height: 18, background: ACCENT, borderRadius: 18 }} />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>watthog</div>
        </div>

        {/* middle: face + identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
          <div
            style={{
              display: "flex", padding: 36, background: ACCENT_SOFT,
              borderRadius: 999, border: `4px solid ${OUTLINE}`,
            }}
          >
            <HogFace size={200} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>
              {`@${displayHandle}`}
            </div>
            <div style={{ fontSize: 34, color: INK_MUTED, marginTop: 14 }}>
              {data
                ? `${stage.name} · rank #${rankWeek} of ${total} this week`
                : "hasn't fed yet"}
            </div>
          </div>
        </div>

        {/* bottom: the number */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 92, fontWeight: 700, color: VOLT, lineHeight: 1 }}>
              {data ? fmtWh(kWhAll * 1000) : "watthog.vercel.app"}
            </div>
            <div style={{ fontSize: 30, color: INK_MUTED, marginTop: 12 }}>
              {data
                ? outburn != null
                  ? `all-time · hungrier than ${outburn}% of the trough`
                  : `all-time · ≈ ${fmtEquivalent(kWhAll * 1000)}`
                : "estimate your AI's electricity"}
            </div>
          </div>
          <div style={{ fontSize: 26, color: INK_MUTED }}>watthog.vercel.app</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
