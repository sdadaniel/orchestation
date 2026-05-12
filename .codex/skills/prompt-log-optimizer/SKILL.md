---
name: prompt-log-optimizer
description: Optimize orchestration worker prompts by running prompt-log reproductions, analyzing JSONL traces, reducing prompt/context bloat, and iterating toward concrete cost and turn targets such as keeping TASK-370 work runs under $0.50.
---

# Prompt Log Optimizer

Use this skill when the task is to reduce orchestration worker cost, turns, or prompt-log noise by iterating on the task worker prompt and prompt assembly logic.

## Goal

Drive a task-worker run toward explicit cost and efficiency targets.

Default target in this repo:

- `TASK-370` work prompt run under `$0.50`
- minimal wrong-path exploration
- minimal redundant validation loops
- no generated log files committed

## Primary Files

- `packages/dashboard/template/prompt/worker-task.md`
- `packages/engine/src/orchestrate/ops/context-builder.ts`
- `packages/dashboard/template/prompt/dashboard-design-system.md`
- `docs/errors/2026-05-12-task-worker-prompt-log-inefficiencies.md`

## Standard Loop

1. Run a reproducible prompt-log:
   - `pnpm tsx src/cli/run-prompt-log.ts --task 370 --skip-permissions`
   - If needed, pass `--model <model>` to compare prompt efficiency separately from model cost.
2. Inspect the newest JSONL under:
   - `.orchestration/output/prompt-logs/tasks/TASK-370/work/runs/`
3. Extract the key metrics from the `result` record:
   - `total_cost_usd`
   - `num_turns`
   - `output_tokens`
   - repeated tool counts
   - failed path probes / command errors
4. Classify waste into a few buckets:
   - prompt bloat from injected file contents
   - prompt bloat from injected guides
   - wrong path guesses
   - redundant `Bash` validation loops
   - whole-file `Write` where `Edit` would do
   - unsafe broad git commands like `git add -A`
5. Make the smallest high-leverage change first.
6. Re-run the prompt log and compare against the prior JSONL.

## High-Leverage Changes

Prefer these before anything else:

- Reduce injected context volume before tweaking wording.
- Prefer file lists, signatures, and short summaries over full file bodies.
- Keep dashboard guide injection short; do not inject the full design guide unless required.
- Tell the worker to trust injected scope resolution before searching.
- Cap validation to one decisive command when possible.
- Ban path recomputation after `cd`.
- Ban `git add -A`; stage scope files only.

## Cost Discipline

Treat prompt tokens as the first budget to cut.

- Do not inject large file bodies by default.
- Do not inject full UI guides when a 3-6 bullet summary is enough.
- Do not add verbose motivational or duplicate instruction text.
- If a run still exceeds target after prompt reduction, compare with a cheaper model using `--model`.

## Analysis Heuristics

Good signs:

- first reads are scope files
- no `ToolSearch` / `TodoWrite` churn
- no missing-path probes
- one validation pass
- short final result

Bad signs:

- `styles/**/*.css`, `components/ui/*.tsx`, `tooltip*` style guesses
- repeated `tsc` or repeated `pwd`/`ls` sanity checks
- `Write` with large payloads for small edits
- broad `git add -A`
- many turns with mostly shell inspection

## Reporting Format

When asked to report findings, keep it tight:

- current run path
- cost / turns / output tokens
- 2-5 concrete inefficiencies
- exact files to change next
- expected impact of the next change

## Invocation

Recommended prompt in a future session:

`Use $prompt-log-optimizer to reduce TASK-370 work prompt cost below $0.50. Run the prompt log, inspect the newest JSONL, and make the smallest high-leverage prompt/context changes first.`
