# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`@agento-nexus/sdk` — the TypeScript runtime for Agento Nexus executive agents. Each executive pulls from a **toolset** that matches the task (output- and cost-oriented). The SDK is designed for that pattern: toolsets are pluggable, the executive surface is the unit of value.

The current shipped toolset is **OpenFang + E2B + ClaudeBridge** — sandboxed agent daemon plus Claude Code bridge. This is **one validated toolset, not the SDK's identity.** New toolsets will land alongside (see issue #5 for the 1.0 design discussion). When working in this repo, treat `FangBox`, `OpenFangClient`, `createFangBox`, and the `openfang-claude` template as v0.x pinned names — a more abstract `Executive` + `Toolset` surface is planned before 1.0; renames will ship as deprecated aliases first.

What's here today:
- **FangBox** — E2B sandbox + OpenFang daemon wrapper
- **OpenFangClient** — HTTP client for the OpenFang daemon API (deploy a Hand, message it)
- **ClaudeBridge** — `claude -p` inside the sandbox (Anthropic-only by definition)
- **Fleet** — DAG workflow orchestrator across sandboxes
- **TemplateBuilder** — custom E2B template builder
- **CLI** — `agento-sdk` (init, run, fleet, status, logs, destroy)

## Provider neutrality

Hands deployed via `box.client.deployHand({ model, ... })` are **model-agnostic**. The OpenFang daemon routes through whatever LLM gateway is configured — Anthropic, OpenAI, Groq, OpenRouter, or a normalizing proxy like LiteLLM (the platform runs LiteLLM in `infra/openfang-gateway`). Only `ClaudeBridge` requires `ANTHROPIC_API_KEY`, because it shells out to the Claude Code CLI.

When writing examples or error messages, never imply Anthropic is required for the agent layer.

## Commands

```bash
npm run build        # tsup (ESM, two entry points: sdk + cli)
npm run dev          # Watch mode
npm run typecheck    # tsc --noEmit
npm test             # Vitest (mocked, no API keys needed)
```

## Package

Published as `@agento-nexus/sdk` on npm. ESM-only, Node ≥ 20.

Versions before 0.1.2 are published-broken (build paths didn't match the manifest); always work against >= 0.1.2.
