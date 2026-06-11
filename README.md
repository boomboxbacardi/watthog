# 🐷 Watthog

Estimate the **electricity, CO₂e and water footprint** of your LLM usage across
AI coding agents — computed entirely from logs already on your machine.
No API keys, no network calls, no data leaves your computer.

```
npx watthog            # or: watthog after npm link / npm i -g
```

```
🐷 watthog — estimated electricity use of your LLMs
12,431 assistant messages since 2025-11-02 · sources: Claude Code, OpenCode

TOTAL ESTIMATE
  Energy  9.6 kWh   range 3.4 kWh – 27 kWh
  CO₂e    3.8 kg    @ 400 gCO₂e/kWh grid
  Water   10.6 L    data center cooling

  ≈ 801 phone charges  ·  1201 hours of LED light (8W)  ·  9.6 dishwasher runs  ·  64 km in an electric car
```

## Supported sources

| Agent | Where it reads from |
|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` |
| OpenCode | `~/.local/share/opencode/opencode.db` (and legacy `storage/message/`) |
| Codex CLI | `~/.codex/sessions/**/rollout-*.jsonl` |
| Cursor | `…/Cursor/User/globalStorage/state.vscdb` (per-message token counts; model comes from each conversation's settings, Auto mode is estimated as a mid-size model; cache hits aren't exposed locally) |

## Options

```
--days <n>   Only include the last n days
--co2 <g>    Grid intensity in gCO2e/kWh (default 400 global avg; Sweden ≈ 30)
--json       Machine-readable output
```

## Methodology

Providers do not publish per-model energy figures, so this tool maps each
model to a **size class** with a Wh-per-1k-token factor and always reports a
**low–high range** alongside the median:

| Class | Examples | Wh / 1k output tokens |
|---|---|---|
| small | Haiku, *-mini, *-flash, Gemma | 0.03 |
| medium | Sonnet, GPT-4o, Gemini Pro, ~70B open models | 0.19 |
| large (frontier) | Opus, Fable, GPT-5, o3 | 0.45 |

Input tokens are weighted at 1/8 of output (prefill batches far better than
decode), cache writes at the same rate as input, and cache reads at 1/80.
Reasoning tokens count as output tokens. The uncertainty band is ×0.35–×2.8.

Anchors:

- **Llama-3.3-70B on H100/FP8** measures ~0.39 J per output token (~0.11 Wh/1k
  GPU-only). Scaled to full data-center energy using **Google's Gemini
  disclosure** (accelerator = 58% of total; CPU/RAM 25%, idle failover 10%,
  PUE overhead 8%) → ~0.19 Wh/1k for the medium class.
- **[AI Energy Score](https://huggingface.co/spaces/AIEnergyScore/Leaderboard)**
  (Hugging Face, H100 benchmarks of 166 models) and
  **[How Hungry is AI?](https://arxiv.org/abs/2505.09598)** for the spread
  between size classes.
- **[EcoLogits](https://ecologits.ai)** methodology for the API-consumer
  perspective on closed models.
- **Google (2025)**: median Gemini text prompt = 0.24 Wh, 0.26 ml water —
  source of the 1.1 ml/Wh water factor.
- CO₂e uses a configurable grid factor (default 400 gCO₂e/kWh ≈ global
  average; pass `--co2 30` for the Swedish grid).

These are **estimates**: real production batching, quantization and hardware
can shift per-token energy by an order of magnitude in either direction —
which is exactly why every number ships with a range.

## License

MIT
