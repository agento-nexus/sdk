# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

OpenFangE2B TypeScript SDK — Agent OS in Cloud Sandboxes. Provides FangBox (E2B sandbox wrapper), Fleet (DAG workflow orchestrator), ClaudeBridge (claude -p in sandbox), and a CLI.

## Commands

```bash
npm run build        # tsup (ESM, two entry points: sdk + cli)
npm run dev          # Watch mode
npm run typecheck    # tsc --noEmit
npm test             # Vitest (mocked, no API keys needed)
```

## Package

Published as `@agento-nexus/sdk` on npm. ESM-only, Node >= 20.
