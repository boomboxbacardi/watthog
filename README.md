<div align="center">

# 🐷 Watthog

### Your AI coding agents eat electricity. Meet the pig that counts it.

**One command.** No API keys, no sign-up, no data leaving your machine.
Watthog reads the logs your coding agents already wrote and tells you the
**electricity, CO₂e and water** they actually burned — every number inside an
honest low–high band, never a single digit you're asked to trust.

[![npm](https://img.shields.io/npm/v/watthog?color=ec4899&label=watthog&logo=npm)](https://www.npmjs.com/package/watthog)
[![downloads](https://img.shields.io/npm/dm/watthog?color=ec4899)](https://www.npmjs.com/package/watthog)
[![node](https://img.shields.io/node/v/watthog?color=ec4899)](https://nodejs.org)
[![license](https://img.shields.io/badge/license-MIT-ec4899)](LICENSE)

```sh
npx watthog
```

**[watthog.vercel.app](https://watthog.vercel.app)** &nbsp;·&nbsp; [How it works](#-how-it-works) &nbsp;·&nbsp; [What it reads](#-what-it-reads) &nbsp;·&nbsp; [Methodology](#-methodology)

</div>

---

## 🐷 What you get

```
🐷 watthog · estimated electricity use of your LLMs
16,187 assistant messages since 2025-05-06

     \   ^..^_________     SUBSTATION SWINE  ·  Lv 27
   --+-- ( ●  ●       )    ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░ 74% → Lv 28
     /   (            )~   power lines bend toward it. the grid operator knows your name.
          "  "     " "     39 kWh burned for life  ·  2.3 kWh to level up

  DIET   █████████████░░░ 79% lean   cache ate 144 kWh it would've burned
         monstrous, yes — but it wastes almost nothing. the hog approves.

TOTAL ESTIMATE  ·  best guess, with the band it really sits in
  Energy  ≈ 39 kWh     14 kWh ▏░░░░░░░░░░░░░●░░░░░░░░░░░░▏ 109 kWh
          ≈ 16 hot showers  ·  391 pots of coffee  ·  112 hours on a gaming PC
  CO₂e    ≈ 15.6 kg    5.5 kg ▏░░░░░░░░░░░░░●░░░░░░░░░░░░▏ 43.8 kg  @ 400 g/kWh
          ≈ 6.8 liters of petrol burned  ·  130 km in a petrol car  ·  4.7 beef burgers
          a mature tree would need 284 days to breathe it back in
  Water   ≈ 43.0 L    data center cooling
```

Numbers mean nothing until you can _feel_ them. **39 kWh is an abstraction.
130 km in a petrol car is a hog that's been eating well.** Watthog turns every
figure into something physical, and ships it with the band it really sits in —
because the honest answer to "how much did my AI burn?" is a range, not a digit.

---

## 🔥 What a run actually costs

The same compute, in units you can picture. (Illustrative, grounded in the
anchors in [Methodology](#-methodology) — your real mix decides the rest.)

| If watthog says… | …that's roughly |
|---|---|
| **0.1 kWh** — a heavy afternoon of agentic coding | a few slices of toast 🍞 |
| **1 kWh** — a big refactor across a repo | an hour on a gaming PC, or a load of laundry 🧺 |
| **10 kWh** — a month of daily Claude Code | 4 hot showers, or 100 km in a petrol car 🚗 |
| **40 kWh** — a power user's quarter | a tank's worth of espresso ☕ and ~280 tree-days of CO₂ to reabsorb 🌳 |

Watthog's **equivalence engine** picks the comparison that fits your number
automatically — toast for the light days, beef burgers and petrol for the
months you'd rather not think about.

---

## 🧠 The hog has a level — and a villain arc

Here's the thing watthog refuses to do: **congratulate you for burning power.**
Your footprint isn't a high score. So instead of cheering, watthog evolves a
mascot that gets gloriously, self-awarely _monstrous_ as your **cumulative
lifetime energy** climbs. Cute → cute-evil → eldritch. _You did this._

```
   ⚡ LEVEL UP  ·  Lv 27 → Lv 28  ·  SUBSTATION SWINE ⚡
   the hog has evolved. there is no going back.
```

- 🪜 **Infinite log scale.** Each level costs 25% more lifetime energy than the
  last — it never caps. The heaviest users on public token leaderboards land
  around Lv 65, with headroom to spare.
- 🎭 **15 named forms**, each with its own ASCII art and color:

  `Piglet → Hoglet → Hog → Chonk → Big Chonkus → The Unit → Substation Swine →`
  `Hognarök → Hogzilla → Megahog → Brimstone Sow → Infernal Boar →`
  `The Coal Baron → The Grid Eater → Singularity Swine`

  In an interactive terminal the hog _moves_ — type `hog` to watch it.
- 💾 **It remembers.** Your level lives in `~/.config/watthog/config.json`, so
  crossing a threshold greets you with a `⚡ LEVEL UP ⚡` on the next run.

And the **DIET** line is the one number you can actually move: how much energy
prompt caching spared you versus sending every token fresh. The level only ever
climbs — you can't un-burn what you've spent — but a lean hog wastes nothing.

---

## 🔌 What it reads

Watthog scans logs **already on your machine**. Nothing is uploaded; the only
network calls are to _your own_ Cursor and Copilot accounts, when you opt in.

| Agent | Source |
|---|---|
| **Claude Code** | `~/.claude/projects/**/*.jsonl` |
| **OpenCode** | `~/.local/share/opencode/opencode.db` (+ legacy `storage/message/`) |
| **Codex CLI** | `~/.codex/sessions/**/rollout-*.jsonl` |
| **Cursor** | Your usage export from Cursor's dashboard API¹ (local fallback: `state.vscdb`) |
| **GitHub Copilot** | Local chat sessions + your premium-request report from GitHub's billing API² |

Every run opens with a **SOURCES** panel — instant proof of what was found and
what still needs a nudge:

```
SOURCES
  ✓ Claude Code   14,902 messages · 312 sessions
  ✓ Codex CLI     1,285 messages
  ⚠ Copilot       412 requests (local only)
                    → run `watthog connect copilot` to include billing usage
  · Cursor        not installed
  run `watthog doctor` to inspect paths and troubleshoot missing sources
```

<details>
<summary><strong>The fine print on Cursor & Copilot</strong> (the two that need a hand)</summary>

> ¹ **Cursor** stopped storing token counts locally in early 2026, so watthog
> fetches your usage export from cursor.com — authenticated with the session
> token Cursor itself keeps on your machine. It talks only to your own account
> and caches for an hour. Auto-mode requests hide the model and are estimated as
> mid-size. Offline or signed out, it falls back to the local database (covers
> usage up to ~Jan 2026).
>
> ² **Copilot** keeps no token counts on your machine, so watthog counts
> *requests* and estimates tokens per request — rougher than the token-accurate
> sources. Requests come from VS Code's local chat sessions (the only trace of
> the free "included" models) and GitHub's billing API for premium usage (per
> model, last 12 months, covers other machines). Where they overlap, the higher
> count wins. Connect the billing half once:
>
> ```sh
> watthog connect copilot
> ```
>
> This runs GitHub's device flow — a short code, one **Authorize** click, done.
> No token to create or copy. The access token (scoped to nothing but reading
> your plan) is saved to `~/.config/watthog/config.json`. Prefer your own token?
> A fine-grained PAT with **Plan: read**, `WATTHOG_GITHUB_TOKEN`, or a scoped
> `gh` login are all picked up automatically. Without any of it, local sessions
> still count.

</details>

---

## 🚀 How it works

```
npx watthog                  →  scan local logs, print the energy report
watthog connect copilot      →  connect Copilot's premium-request billing
watthog doctor               →  show which sources are detected + what they need
```

**Options**

```
--days <n>   Only include the last n days
--co2 <g>    Grid intensity in gCO2e/kWh (default 400 global avg; Sweden ≈ 30)
--json       Machine-readable output
```

> **Three steps:** run it → read it → fix the wasteful part. (We'd rather you
> shrink the number than brag about it.)

---

## 📊 Methodology

Watthog maps each model to a **size class** with a Wh-per-1k-token factor, and
always reports a **low–high range** around the median:

| Class | Examples | Wh / 1k output tokens |
|---|---|---|
| **small** | Haiku, \*-mini, \*-flash, Gemma | 0.03 |
| **medium** | Sonnet, GPT-4o, Gemini Pro, ~70B open models | 0.19 |
| **large** (frontier) | Opus, Fable, GPT-5, o3 | 0.45 |

Input tokens are weighted at 1/8 of output (prefill batches far better than
decode), cache writes at the input rate, cache reads at 1/80. Reasoning tokens
count as output. The uncertainty band is ×0.35–×2.8.

<details>
<summary><strong>Anchors & sources</strong></summary>

- **Llama-3.3-70B on H100/FP8** measures ~0.39 J per output token (~0.11 Wh/1k
  GPU-only). Scaled to full data-center energy via **Google's Gemini disclosure**
  (accelerator = 58% of total; CPU/RAM 25%, idle failover 10%, PUE 8%) →
  ~0.19 Wh/1k for the medium class.
- **[AI Energy Score](https://huggingface.co/spaces/AIEnergyScore/Leaderboard)**
  (Hugging Face, H100 benchmarks of 166 models) and
  **[How Hungry is AI?](https://arxiv.org/abs/2505.09598)** for the spread
  between size classes.
- **[EcoLogits](https://ecologits.ai)** for the API-consumer view of closed models.
- **Google (2025):** median Gemini text prompt = 0.24 Wh, 0.26 ml water — the
  source of the 1.1 ml/Wh water factor.
- **CO₂e** uses a configurable grid factor (default 400 gCO₂e/kWh ≈ global avg;
  `--co2 30` for Sweden). Equivalents ground emissions in
  **[Mike Berners-Lee, *How Bad Are Bananas?*](https://www.howbadarebananas.com)**
  and EU fleet averages: ~120 gCO₂e/km petrol car, ~80 g/banana, ~55 g/day
  reabsorbed by a mature tree, ~2310 g/L petrol, ~3300 g/beef burger.

</details>

These are **estimates.** Real batching, quantization and hardware can shift
per-token energy by an order of magnitude either way — which is exactly why
every number ships with a range.

---

## 🤝 Contributing

This hog is open source and hungry for contributions. PRs, issues and ideas
welcome.

- Commit messages follow **[Conventional Commits](https://www.conventionalcommits.org/)**:
  ```
  feat: add support for Cursor cache-hit detection
  fix: handle missing .codex directory gracefully
  ```
- Branch protection is on `main` — open a PR, get a review, merge.
- By contributing you agree to license your work under MIT.

## License

MIT © Boomboxbacardi — see [LICENSE](LICENSE).
