# Watthog.ai - Design Concept

> **Design read:** Consumer-devtool landing + leaderboard for developers, with a
> playful mascot-driven language (Tamagotchi/Duolingo energy, not a corporate
> climate dashboard), leaning toward Tailwind v4 + chunky rounded shapes + one
> warm accent. Dials: `DESIGN_VARIANCE 7 / MOTION_INTENSITY 6 / VISUAL_DENSITY 4`.

---

## 1. The Big Idea: your hog eats your watts

Watt-hours mean nothing to people. **A pig that gets fatter the more you prompt
means everything.** Every user has a hog. The hog eats electricity. Your usage
literally feeds it.

The product never shows a number without making it *physical*:

- Raw: `11.4 kWh`
- Watthog: **"Your hog has eaten 11.4 kWh this spring. That's 456 slices of
  toast."** (with a pile of toast next to the pig)

This one mechanic carries the brand, the virality and the pedagogy at once.

### Hog growth stages (the Tamagotchi loop)

The hog's size is computed from your rolling 7-day average Wh/day, so it can
both grow and slim down. Five stages, each with its own illustration:

| Stage | Name | Wh/day (7d avg) | Vibe |
|---|---|---|---|
| 1 | Piglet | < 10 | tiny, big eyes, one toast crumb |
| 2 | Hog | 10 - 100 | content, round |
| 3 | Chonk | 100 - 400 | visibly thriving, sweatband |
| 4 | Unit | 400 - 1500 | fills the card, smug |
| 5 | The Substation | > 1500 | colossal, tiny power lines bend toward it |

The stage names double as leaderboard tiers. People will screenshot
"I reached The Substation" without being asked to.

---

## 2. The Equivalence Engine (the core insight)

"11 Wh" says nothing, and "0.01 dishwasher runs" says even less. The engine
**auto-picks the unit where the number lands between roughly 1 and 500**, so
every figure is instantly graspable.

Ladder, small to large (Wh per unit):

| Unit | Wh | Works for |
|---|---|---|
| seconds of microwave | 0.3 | single messages |
| slices of toast | 25 | a session |
| phone charges | 12 | a day |
| pots of coffee | 100 | a heavy day |
| hours of gaming PC | 350 | a week |
| dishwasher runs | 1000 | a month |
| km in an electric car | 150 | totals |
| hot showers | 2500 | yearly totals |
| Swedish house-days | 25000 | the global counter |

Selection rule: walk the ladder, pick the largest unit where `value >= 1`,
display with one decimal max. A message shows "4 seconds of microwave", a
month shows "9 dishwasher runs", the global counter shows "house-days".

Each unit has a tiny matching illustration in the same style as the hog, so
equivalents read as *food and objects around the pig*, not as a stats table.

CO2 gets the same treatment with its own short ladder (meatballs of CO2e,
km by petrol car, one-way flights) and the grid picker matters: a toggle
between "Swedish grid (30 g/kWh)" and "global average (400 g/kWh)" makes the
13x difference a teachable moment, not a footnote.

---

## 3. Visual identity

**Mood:** children's book illustration meets developer tool. Soft, chunky,
sincere. The data is rigorous; the wrapper is huggable. Think Duolingo's
confidence, Tamagotchi's attachment loop, and a CLI that respects you.

### Color

One accent, locked across the page (light and dark mode from day one):

- **Hog Pink** `#F472A0`-family (desaturated, warm): the mascot, primary CTAs,
  links, active states. This is the accent.
- Neutrals: warm zinc. Light mode `#FAFAF8` surface / `#1C1917` text. Dark mode
  `#17151A` surface / `#F5F2EE` text. No pure black or white.
- **Volt Amber** `#F5B82E` is *functional data color only*: energy bars, the
  hog's "food", chart fills. Never on buttons or links, so it reads as
  "electricity", not as a second brand color.

### Typography

- **Display: Baloo 2** (chunky, rounded, friendly without being childish in
  body sizes). Headlines `text-4xl md:text-6xl`, weight 700.
- **Body: Outfit**, `text-base leading-relaxed max-w-[65ch]`.
- **Numbers: JetBrains Mono** for every stat, tabular figures. The contrast
  between cuddly display type and strict mono numbers IS the brand: cute
  outside, honest inside.

### Shape language

- One radius system: cards and tiles `rounded-3xl` (24px), buttons and pills
  full-pill, inputs `rounded-xl`. Everything chunky, nothing sharp.
- Borders over shadows: 2px tinted borders (`border-pink-200/50`), shadows only
  as soft ground-shadows under the hog illustrations.
- Illustrations: flat vector with thick outlines and tiny face details, same
  stroke weight as the icon set (Phosphor, duotone where it fits, stroke 2.0).

### Voice

Playful but never lying. The hog is greedy and proud of it; the numbers are
estimates and say so. Every page carries one honest line: "All figures are
estimates with ranges. The hog is not a scientist." Swedish market gets a
Swedish toggle later; launch copy is English.

---

## 4. Page architecture

Four surfaces: **Landing**, **Leaderboard**, **Profile** (public, shareable),
**My sty** (your dashboard). Landing and Profile are the viral loops.

### 4.1 Landing

```
┌────────────────────────────────────────────────────────────────┐
│  🐷 watthog        Leaderboard   Method   GitHub        [Login] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Your AI runs on               ┌──────────────────────┐        │
│   electricity.                  │                      │        │
│   Meet the pig that             │    (hog illustration │        │
│   counts it.                    │     sitting on a     │        │
│                                 │     pile of toast,   │        │
│   One command. Reads your       │     volt-amber       │        │
│   local agent logs. Nothing     │     sparks)          │        │
│   leaves your machine.          │                      │        │
│                                 └──────────────────────┘        │
│   ┌──────────────────────────┐                                  │
│   │ $ npx watthog        [⧉] │   [See the leaderboard]          │
│   └──────────────────────────┘                                  │
├────────────────────────────────────────────────────────────────┤
│   THE GLOBAL TROUGH                                             │
│   All hogs together have eaten                                  │
│   1 847 kWh  ≈  74 house-days    (live odometer, mono digits)   │
├─────────────────────────────────────────────────────────────────┤
│   "What does a watt-hour even mean?"                            │
│   Interactive slider: drag token count → hog + equivalence      │
│   update live. (one prompt → 4 s microwave; a workday →         │
│   31 toasts; your year → 2 dishwashers)                         │
├─────────────────────────────────────────────────────────────────┤
│   Three steps, illustrated: Run it → Read it → Feed the         │
│   leaderboard (opt-in). Privacy line under step 3.              │
├─────────────────────────────────────────────────────────────────┤
│   THIS WEEK'S HEAVIEST HOGS (top-3 teaser → full leaderboard)   │
├─────────────────────────────────────────────────────────────────┤
│   Honest method section: factors, ranges, sources. Plain        │
│   table, links to AI Energy Score / EcoLogits / Google paper.   │
├─────────────────────────────────────────────────────────────────┤
│   Footer: GitHub, npm, method, a small sleeping piglet.         │
└────────────────────────────────────────────────────────────────┘
```

Notes:
- Asymmetric split hero (no centered hero). Max 4 text elements. The terminal
  command is real and copyable; it IS the primary CTA.
- The interactive slider is the hero's real magic: it teaches the entire
  mental model in five seconds of dragging. Build it before any other motion.
- Section layout families: split hero / full-width counter strip / interactive
  panel / 3-step illustrated row / leaderboard teaser / prose table. Six
  sections, five layout families, no zigzag repetition.

### 4.2 Leaderboard ("The Trough")

```
┌────────────────────────────────────────────────────────────────┐
│  THE TROUGH                       [This week ▾] [All time]      │
│                                                                 │
│   1  ┌🐗 BIG┐  @hogfather_dev     31.2 kWh   ≈ 31 dishwashers   │
│   2  ┌🐖 med┐  @eriksh            11.4 kWh   ≈ 76 km by EV      │
│   3  ┌🐖 med┐  @tokenslurper      9.8 kWh    ≈ 392 toasts       │
│   ...                                                           │
│                                                                 │
│   Each row: hog avatar sized by stage · handle · kWh (mono,     │
│   with range on hover) · auto-picked equivalence · model chips  │
└────────────────────────────────────────────────────────────────┘
```

- **The pig avatar is the rank.** Bigger hog = more kWh. No medals needed; the
  visual does the work. Sizes from the five growth stages.
- Two reads, one board: the copy stays neutral ("heaviest hogs"), so climbers
  can brag and minimalists can brag about being a Piglet. Add a secondary sort
  "most efficient (Wh per message)" so there is a flex for both crowds.
- Weekly reset drives recurring visits; all-time feeds the legends.
- Curiosa strip above the table: "Together this week: 214 kWh, 89% of it from
  frontier models, busiest hour 14:00 UTC."

### 4.3 Public profile (the share loop)

A profile = your hog, this week's stage, total kWh with range, equivalence of
the week, per-model donut, contribution-style heatmap in amber. One button:
**"Copy badge for GitHub README"** (SVG embed, like tokscale's graph). The
badge shows the hog at current stage + weekly kWh + one equivalence.

### 4.4 My sty (dashboard, after `watthog submit` + login)

Personal stats with the same equivalence treatment everywhere:

- Total + avg Wh/day (mono numbers, equivalence subtitles)
- The hog, current stage, and "distance to next stage" as a food bar
- Curiosa cards (rotate weekly, this is the retention surface):
  - **Gluttony record:** your heaviest day ever, what it equals
  - **Reasoning tax:** how much extra your thinking-model tokens cost vs plain
  - **Night owl share:** % of your watts eaten between 00:00 and 06:00
  - **Percentile:** "Your hog out-eats 87% of all hogs"
  - **Grid swing:** your CO2e in Sweden vs the global grid, side by side
  - **Cache savings:** Wh you avoided thanks to prompt caching (the hero stat
    nobody else shows; makes the tool feel generous, not guilt-driven)

---

## 5. Motion concept (parked for later, designed now)

All motion springs (`type: "spring"`), all behind `prefers-reduced-motion`.

1. **The hog eats.** When new usage syncs, a toast slice arcs into the hog's
   mouth; the counter ticks up odometer-style. One animation, used everywhere
   numbers update. This is the signature.
2. **Stage transitions.** Hog inflates with a squash-and-stretch pop +
   confetti of tiny lightning bolts. Shown once, then a still.
3. **Hero slider:** hog and equivalence morph continuously with drag (motion
   values, no re-renders).
4. **Leaderboard rows** settle in with a 60ms stagger on load. Nothing loops
   infinitely anywhere on the page.

---

## 6. Build notes

- Next.js App Router on Vercel, Tailwind v4, Motion for the client islands,
  Phosphor icons, fonts via `next/font` (Baloo 2 + Outfit + JetBrains Mono).
- Leaderboard data: `watthog submit` posts the same JSON the CLI's `--json`
  already emits (aggregates only, never prompts or paths) to a small API route;
  Neon Postgres via Marketplace; GitHub OAuth.
- Hog illustrations: 5 stages x 2 themes + 9 equivalence objects. Generate
  with an image tool or commission; do not hand-roll SVG art in code.
- Empty states matter: a new profile shows the Piglet with "This hog has not
  eaten yet. Run `npx watthog submit`."

## 7. Pre-flight self-check (concept level)

- One accent (Hog Pink), amber locked to data; one radius system; one theme
  per mode with both modes specified; hero is split not centered, 4 text
  elements; no em-dashes in any copy; equivalence engine prevents meaningless
  numbers; honesty line ships on every surface; leaderboard avatar carries
  rank instead of decoration; max one odometer strip, no marquees.
