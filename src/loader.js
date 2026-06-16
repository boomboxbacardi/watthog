// The watthog's loading show.
//
// A watthog eats watts. While sources are being collected, the hog gallops
// across the terminal gobbling the watt-sparks (w, W) scattered in its path,
// muttering to itself, and finishes with a burp. Time of day picks the meal
// and the tempo: full gallop at the lunch buffet, a slow trudge to the
// fridge at midnight.
//
// Persona rules (keep these when adding lines):
//  - First person, smug, food-obsessed. Never apologetic, never technical.
//  - Sources are food: troughs, dishes, snacks. Logs smell delicious.
//  - The hog comments on its own show. It knows it's being watched.

import process from "node:process";

const err = process.stderr;
const isTTY = err.isTTY;
const wr = (s) => err.write(s);
const e = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
const dim = e(2);
const green = e(32);
const pink = e("38;5;218");
const amber = e("38;5;214");

// Scene: 4 sprite rows + mutter + troughs.
const LINES = 6;
const HOG_W = 21; // sprite width incl. tail
const SNOUT = 20; // sparks at or behind this offset get eaten

// Each meal sets tempo (ms per frame), stride (cols per frame), the hog's
// muttering, and the sign-off burp.
const MEALS = {
  midnightSnack: {
    // 22:00 – 05:59. Caught raiding the fridge, not even sorry.
    ms: 240,
    stride: 1,
    mutter: [
      "shh. midnight snack",
      "you saw nothing",
      "the fridge light is my spotlight",
      "tokens taste better after dark",
    ],
    burp: "*small burp* — back to bed. tell no one.",
  },
  breakfast: {
    // 06:00 – 08:59. Awake purely because food exists.
    ms: 150,
    stride: 1,
    mutter: [
      "breakfast! the most important meal",
      "do I smell fresh logs?",
      "no coffee, just kilowatts",
      "early hog gets the tokens",
    ],
    burp: "*burp* — breakfast: served. I'm magnificent.",
  },
  buffet: {
    // 09:00 – 16:59. Prime time. All-you-can-eat, full gallop.
    ms: 90,
    stride: 2,
    mutter: [
      "ALL-YOU-CAN-EAT? say less",
      "om nom nom nom",
      "this trough? mine. that one? also mine",
      "I smell frontier models...",
      "I'm not greedy, I'm thorough",
    ],
    burp: "*BURP* — exquisite. five stars. would devour again.",
  },
  dinner: {
    // 17:00 – 21:59. Fine dining. The hog has standards (it doesn't).
    ms: 130,
    stride: 1,
    mutter: [
      "ah, dinner. tonight: tokens au jus",
      "a fine vintage of cached context",
      "savoring this one",
      "dessert is whatever's left in Cursor",
    ],
    burp: "*polite burp* — my compliments to the terminal.",
  },
};

function currentMeal() {
  const h = new Date().getHours();
  if (h >= 22 || h < 6) return "midnightSnack";
  if (h < 9) return "breakfast";
  if (h < 17) return "buffet";
  return "dinner";
}

// The hog, facing right. Two gallop poses (legs lean fwd/back), nose wiggle,
// tail flick, and a mouth that opens (>) on the frame it eats a spark.
function sprite(tick, mouthOpen) {
  const nose = tick % 4 < 2 ? ".." : "''";
  const tail = tick % 2 ? "~" : "-";
  const legs = tick % 2 ? "  //          //" : "  \\\\          \\\\";
  const jaw = mouthOpen ? ">" : ")";
  return [
    `  ______________^${nose}^`,
    ` (            o  o ${jaw}`,
    `${tail}(                  )`,
    legs,
  ];
}

// Scatter watt-sparks ahead of the hog: mostly w (1 W), the odd fat W (5 W).
function spawnSparks(from, to) {
  const sparks = [];
  let x = from;
  while (x < to) {
    x += 3 + Math.floor(Math.random() * 5);
    if (x < to) sparks.push({ x, big: Math.random() < 0.2 });
  }
  return sparks;
}

function overlay(base, str, at) {
  const chars = base.split("");
  for (let i = 0; i < str.length; i++) {
    if (at + i >= 0 && at + i < chars.length && str[i] !== " ")
      chars[at + i] = str[i];
  }
  return chars.join("");
}

// Returns { markDone(name), stop(): Promise }. No-ops when not a TTY.
export function startLoader(sourceNames) {
  const width = Math.max(0, Math.min((err.columns || 80) - 2, 64));
  if (!isTTY || width < 34) {
    return { markDone: () => {}, stop: async () => {} };
  }

  const meal = MEALS[currentMeal()];
  const sources = sourceNames.map((name) => ({ name, done: false }));
  const started = Date.now();
  const MIN_SHOW_MS = 2000;

  let tick = 0;
  let x = 0;
  let eaten = 0;
  let justAte = 0; // frames left with the mouth open
  let sparks = spawnSparks(HOG_W + 4, width);
  let reaction = null; // { text, until } — the hog reacts to an emptied trough

  const restoreCursor = () => wr("\x1b[?25h");
  process.on("exit", restoreCursor);
  wr("\x1b[?25l");

  const frame = () => {
    // Advance, eat what the snout has reached, wrap with a fresh spread.
    x += meal.stride;
    if (x + HOG_W > width) {
      x = 0;
      sparks = spawnSparks(HOG_W + 4, width);
    }
    sparks = sparks.filter((s) => {
      if (s.x <= x + SNOUT) {
        eaten += s.big ? 5 : 1;
        justAte = 2;
        return false;
      }
      return true;
    });

    const rows = sprite(tick, justAte > 0).map((r, i) => {
      let line = " ".repeat(width);
      // Sparks float at snout height (row 1), waiting to be inhaled.
      if (i === 1)
        for (const s of sparks) line = overlay(line, s.big ? "W" : "w", s.x);
      line = overlay(line, r, x);
      // Colorize after compositing: sparks amber, hog pink.
      return line
        .replace(/[wW]/g, (m) => amber(m))
        .replace(/^(.*)$/, (m) => m); // keep plain; hog tinted below
    });
    if (justAte > 0) justAte--;

    const say =
      reaction && Date.now() < reaction.until
        ? reaction.text
        : meal.mutter[Math.floor((Date.now() - started) / 2000) % meal.mutter.length];
    const troughs = sources
      .map((s) => (s.done ? green(`✓ ${s.name}`) : dim(`· ${s.name}...`)))
      .join("  ");

    return [
      ...rows.map((r) => pink(r)),
      "   " + amber(say) + dim(`  · ${eaten} W gobbled`),
      "   " + troughs,
    ];
  };

  const draw = (lines) => {
    for (const l of lines) wr("\x1b[2K\r" + l + "\n");
  };
  const redraw = (lines) => {
    wr(`\x1b[${LINES}A`);
    draw(lines);
  };

  draw(frame());
  const timer = setInterval(() => {
    tick++;
    redraw(frame());
  }, meal.ms);

  const REACTIONS = [
    (n) => `${n}: licked clean`,
    (n) => `finished the ${n}. next!`,
    (n) => `${n}? inhaled`,
    (n) => `not a crumb left in ${n}`,
  ];
  let reactionIdx = 0;
  const markDone = (name) => {
    const s = sources.find((s) => s.name === name);
    if (s && !s.done) {
      s.done = true;
      reaction = {
        text: REACTIONS[reactionIdx++ % REACTIONS.length](name),
        until: Date.now() + 1200,
      };
    }
  };

  const stop = async () => {
    // Let the show run long enough for at least one gag to land.
    const left = MIN_SHOW_MS - (Date.now() - started);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    clearInterval(timer);

    // Curtain call: the hog halts, every trough is empty, the burp lands.
    const still = sprite(0, false).map((r, i) =>
      // Swap in satisfied eyes on the face row.
      pink(overlay(" ".repeat(width), i === 1 ? r.replace("o  o", "^  ^") : r, x))
    );
    redraw([
      ...still,
      "   " + amber(meal.burp) + dim(`  · ${eaten} W gobbled`),
      "   " + sources.map((s) => green(`✓ ${s.name}`)).join("  "),
    ]);
    await new Promise((r) => setTimeout(r, 700));

    // Clear the stage so the report starts where the show was.
    wr(`\x1b[${LINES}A`);
    for (let i = 0; i < LINES; i++) wr("\x1b[2K\n");
    wr(`\x1b[${LINES}A`);
    restoreCursor();
    process.removeListener("exit", restoreCursor);
  };

  return { markDone, stop };
}
