# @agento-nexus/sdk

[![npm](https://img.shields.io/npm/v/@agento-nexus/sdk.svg)](https://www.npmjs.com/package/@agento-nexus/sdk)
[![CI](https://github.com/agento-nexus/sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/agento-nexus/sdk/actions/workflows/ci.yml)

Agent OS in Cloud Sandboxes. Run AI agents with full tool access in isolated E2B sandboxes, orchestrate multi-agent workflows, and bridge Claude Code into cloud environments.

```bash
npm install @agento-nexus/sdk
```

> Requires Node ≥ 20. ESM-only.

---

## Quickstart — agent in 60 seconds

```bash
export E2B_API_KEY=sk_...                # https://e2b.dev/dashboard
export AGENT_PROVIDER_API_KEY=sk-...     # whichever provider your daemon routes
```

```typescript
// hello.ts
import { createFangBox } from "@agento-nexus/sdk"

const box = await createFangBox({
  // Pass through whatever provider key(s) your daemon is configured for.
  // Anthropic, OpenAI, Groq, OpenRouter, LiteLLM gateway — all supported.
  envs: { AGENT_PROVIDER_API_KEY: process.env.AGENT_PROVIDER_API_KEY! },
  timeout: 300, // seconds
})

await box.client.deployHand({
  name: "researcher",
  // The model string is whatever your daemon / gateway resolves. Examples:
  //   "claude-sonnet-4-6", "gpt-4o", "kimi-k2", "llama-3.1-70b-instruct"
  model: process.env.AGENT_MODEL ?? "claude-sonnet-4-6",
  system_prompt: "You are a research analyst.",
  tools: ["web_search", "file_read", "file_write"],
})

const response = await box.client.message("researcher", {
  role: "user",
  content: "Three sentences on the AI code-assistant landscape in 2026.",
})

console.log(response.content)
await box.close()
```

```bash
node --experimental-strip-types hello.ts
```

That's the loop: provision a sandbox, deploy an agent (Hand), exchange messages, tear down. Everything else in this README is a layer on top of those four steps.

---

## CLI

The SDK ships an `agento-sdk` binary for quick ops. After install, run:

```bash
npx agento-sdk --help
```

| Command | Purpose |
|---------|---------|
| `agento-sdk init` | Build or verify the E2B template (`openfang-claude` by default) |
| `agento-sdk run <hand> -p "<prompt>"` | One-shot a single agent against a prompt |
| `agento-sdk fleet <workflow.json>` | Run a multi-agent DAG from a JSON definition |
| `agento-sdk status` | List running sandboxes for your E2B account |
| `agento-sdk logs <id>` | Stream logs from a running sandbox |
| `agento-sdk destroy [id]` | Tear down one sandbox or all (`--all`) |

Every command takes `--help` for flags. `--version` prints the SDK version (always in lockstep with `package.json`).

---

## Models & providers

Two model paths ship in the SDK; they have different provider scopes.

| Surface | Provider scope |
|---------|----------------|
| **FangBox + Hand** (`box.client.deployHand`, `box.client.message`) | Model-agnostic. The OpenFang daemon inside the sandbox routes through whatever LLM gateway you've configured — direct Anthropic, OpenAI, Groq, OpenRouter, or a normalizing proxy like LiteLLM. The `model` field is a string the daemon understands; pass any provider's identifier. |
| **ClaudeBridge** (`box.claudeBridge.execute`) | Anthropic-specific by definition. This bridges Claude Code (the CLI) into the sandbox; Claude Code requires `ANTHROPIC_API_KEY`. If you don't need Claude Code's filesystem/terminal-tool integration, stick to Hands. |

In short: **agents are model-agnostic; the Claude Code bridge isn't.** The Agento Nexus platform itself runs a LiteLLM gateway (`infra/openfang-gateway`) so agents can swap providers without code changes; this SDK is built for that pattern.

---

## Core concepts

### FangBox — sandbox + agent daemon

An isolated cloud sandbox with the OpenFang agent daemon and Claude Code pre-installed. Each FangBox is a full Linux environment where agents execute code, use tools, and run autonomously.

```typescript
const box = await createFangBox({
  envs: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY! },
  timeout: 300,
})

await box.client.deployHand({
  name: "researcher",
  model: "claude-sonnet-4-6",
  system_prompt: "You are a research analyst…",
  tools: ["web_search", "file_read", "file_write"],
})

const response = await box.client.message("researcher", {
  role: "user",
  content: "Analyze the competitive landscape for AI code assistants",
})

console.log(response.content)
await box.close()
```

### ClaudeBridge — Claude Code inside the sandbox

Execute Claude Code prompts directly inside a sandbox — Claude gets full access to the sandbox filesystem, terminal, and tools.

```typescript
const result = await box.claudeBridge.execute({
  prompt: "Create a REST API with Express that serves user data from a SQLite database",
  outputFormat: "json",
  cwd: "/home/user/project",
})

console.log(result.output)
console.log(result.exitCode)
```

### Fleet — multi-agent DAG

Orchestrate workflows as directed acyclic graphs. Each step runs in its own sandbox; dependencies are resolved and independent steps run in parallel.

```typescript
import { Fleet } from "@agento-nexus/sdk"

const fleet = new Fleet({ maxConcurrency: 3 })

const result = await fleet.run({
  name: "research-and-report",
  steps: [
    { id: "research", hand: { name: "researcher",  system_prompt: "…" }, prompt: "Research AI market trends for 2026" },
    { id: "analyze",  hand: { name: "analyst",     system_prompt: "…" }, prompt: "Analyze the research findings", dependsOn: ["research"] },
    { id: "report",   hand: { name: "writer",      system_prompt: "…" }, prompt: "Write an executive report from the analysis", dependsOn: ["analyze"] },
  ],
})

console.log(result.steps.report.output)
```

### TemplateBuilder — custom sandbox templates

Build custom E2B sandbox templates with pre-installed tools and configurations.

```typescript
import { TemplateBuilder } from "@agento-nexus/sdk"

const template = new TemplateBuilder({
  base: "openfang-claude",
  packages: ["postgresql", "redis"],
  files: { "/etc/openfang/config.toml": configContent },
})

await template.build()
```

---

## Events

`FangBox` and `Fleet` emit typed events for monitoring and instrumentation:

```typescript
box.events.on(event => {
  if (event.type === "agent:message") {
    console.log(`[${event.agentName}]: ${event.content}`)
  }
})

fleet.events.on(event => {
  if (event.type === "step:complete") {
    console.log(`Step ${event.stepId} finished in ${event.durationMs}ms`)
  }
})
```

---

## Troubleshooting

**`✗ E2B is not authenticated.` (`401: authorization header is missing`)**
Your `E2B_API_KEY` env var is missing or empty. Get a key at https://e2b.dev/dashboard, then `export E2B_API_KEY=sk_…`.

**`✗ Claude Code needs an Anthropic API key.`**
Only the `ClaudeBridge` path requires `ANTHROPIC_API_KEY`. If you're calling `box.client.deployHand({ model, … })` and `box.client.message(…)`, the daemon routes through whichever LLM gateway you've configured — Anthropic is one option, not a requirement. Set the appropriate provider key for your gateway. For ClaudeBridge specifically: `ANTHROPIC_API_KEY` from https://console.anthropic.com/.

**`ERR_MODULE_NOT_FOUND: Cannot find module '.../dist/index.js'`**
You're on a published version older than `0.1.2`. Upgrade: `npm install @agento-nexus/sdk@latest`. (The `0.1.0` and `0.1.1` releases shipped a manifest pointing at paths that didn't exist in the tarball.)

**Network errors (`ENOTFOUND`, `ECONNREFUSED`, `EAI_AGAIN`)**
Network reach to E2B failed — check connectivity, corporate proxy, or VPN. The SDK does not retry network failures by default; wrap calls with the exported `retry()` if you need backoff.

**`agento-sdk --version` reports an old version**
You were on `< 0.1.2`. Earlier releases hardcoded the version string. Upgrade.

---

## API Reference

### Exports

| Export | Description |
|--------|-------------|
| `FangBox` | Sandbox wrapper with agent daemon + Claude Code |
| `createFangBox(config?)` | Create and initialize a FangBox |
| `OpenFangClient` | HTTP client for the OpenFang daemon API |
| `ClaudeBridge` | Execute Claude Code inside sandboxes |
| `Fleet` | DAG workflow orchestrator across multiple sandboxes |
| `TemplateBuilder` | Build custom sandbox templates |
| `OpenFangError` | Typed error thrown by daemon HTTP calls |
| `retry(fn, opts?)` | Retry utility with exponential backoff |
| `TypedEmitter` | Type-safe event emitter |
| `Logger` | Structured logger |

### Types

| Type | Description |
|------|-------------|
| `FangBoxConfig` | Sandbox creation options |
| `HandManifest` | Agent definition (name, model, system prompt, tools) |
| `AgentInfo` | Running agent status |
| `AgentMessage` | Conversation message |
| `AgentResponse` | Agent reply |
| `ClaudeCodeRequest` | Claude Code execution options |
| `ClaudeCodeResult` | Claude Code execution output |
| `WorkflowDefinition` | Fleet workflow DAG |
| `WorkflowStep` | Single step in a workflow |
| `StepResult` | Output of a completed step |
| `WorkflowResult` | Full workflow execution result |

---

## Requirements

- Node.js ≥ 20
- E2B API key — `E2B_API_KEY` (https://e2b.dev/dashboard)
- Anthropic API key — `ANTHROPIC_API_KEY` (https://console.anthropic.com/)

## Versioning

Semantic versioning. See [CHANGELOG.md](./CHANGELOG.md). Breaking changes are documented before each minor bump.

## License

MIT
