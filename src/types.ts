/** Configuration for creating a FangBox sandbox */
export interface FangBoxConfig {
  /** E2B template ID (default: "openfang-claude") */
  templateId?: string;
  /** Environment variables to inject into the sandbox */
  envs?: Record<string, string>;
  /** Sandbox timeout in seconds (default: 300) */
  timeout?: number;
  /** OpenFang daemon port inside sandbox (default: 4200) */
  openfangPort?: number;
  /** Metadata tags for the sandbox */
  metadata?: Record<string, string>;
}

/** OpenFang Hand manifest (agent definition) */
export interface HandManifest {
  name: string;
  description?: string;
  model?: string;
  system_prompt?: string;
  tools?: string[];
  max_turns?: number;
  temperature?: number;
}

/** Running agent info returned by OpenFang */
export interface AgentInfo {
  id: string;
  name: string;
  status: "running" | "idle" | "error" | "completed";
  created_at: string;
  metadata?: Record<string, unknown>;
}

/** Agent message for conversation */
export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

/** Response from messaging an agent */
export interface AgentResponse {
  id: string;
  agent_id: string;
  content: string;
  role: "assistant";
  metadata?: Record<string, unknown>;
}

/** Claude Code execution request */
export interface ClaudeCodeRequest {
  prompt: string;
  /** Output format: "text" or "json" (default: "text") */
  outputFormat?: "text" | "json";
  /** Working directory inside sandbox */
  cwd?: string;
  /** Additional CLI flags */
  flags?: string[];
  /** Session ID for multi-turn conversations */
  sessionId?: string;
  /** Max tokens for response */
  maxTokens?: number;
}

/** Claude Code execution result */
export interface ClaudeCodeResult {
  output: string;
  exitCode: number;
  /** Parsed JSON output if outputFormat was "json" */
  parsed?: unknown;
  /** Duration in milliseconds */
  durationMs: number;
  sessionId?: string;
}

/** OpenFang daemon health response */
export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  version: string;
  uptime_seconds: number;
  agents_running: number;
}

/** Tool definition for OpenFang agents */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

/** Workflow definition for fleet orchestration */
export interface WorkflowDefinition {
  name: string;
  description?: string;
  version?: string;
  steps: WorkflowStep[];
  /** Global environment variables for all steps */
  envs?: Record<string, string>;
}

/** Single step in a workflow */
export interface WorkflowStep {
  id: string;
  name: string;
  /** Hand manifest name or inline definition */
  hand: string | HandManifest;
  /** Prompt template (supports {{outputKey}} interpolation) */
  prompt: string;
  /** Step IDs this step depends on */
  dependsOn?: string[];
  /** Condition to evaluate before running (JS expression) */
  condition?: string;
  /** Key to store output under for downstream steps */
  outputKey?: string;
  /** Override sandbox config for this step */
  config?: FangBoxConfig;
  /** Timeout for this step in seconds */
  timeout?: number;
}

/** Result of a single workflow step */
export interface StepResult {
  stepId: string;
  status: "success" | "failure" | "skipped";
  output?: string;
  error?: string;
  durationMs: number;
}

/** Result of a complete workflow run */
export interface WorkflowResult {
  workflowName: string;
  status: "success" | "partial" | "failure";
  steps: StepResult[];
  totalDurationMs: number;
  outputs: Record<string, string>;
}

/** Events emitted by FangBox and Fleet */
export type FangBoxEvent =
  | { type: "sandbox:creating" }
  | { type: "sandbox:ready"; sandboxId: string }
  | { type: "sandbox:error"; error: Error }
  | { type: "sandbox:destroyed"; sandboxId: string }
  | { type: "daemon:starting" }
  | { type: "daemon:healthy"; version: string }
  | { type: "daemon:unhealthy"; error: string }
  | { type: "agent:spawned"; agentId: string; name: string }
  | { type: "agent:message"; agentId: string; content: string }
  | { type: "agent:completed"; agentId: string }
  | { type: "agent:error"; agentId: string; error: string };

export type FleetEvent =
  | { type: "workflow:start"; name: string }
  | { type: "workflow:complete"; result: WorkflowResult }
  | { type: "step:start"; stepId: string }
  | { type: "step:complete"; stepId: string; result: StepResult }
  | { type: "step:skip"; stepId: string; reason: string };

/** E2B template build configuration */
export interface TemplateBuildConfig {
  /** Base E2B template to extend (default: "claude") */
  baseTemplate?: string;
  /** OpenFang version to install */
  openfangVersion?: string;
  /** Additional packages to install */
  packages?: string[];
  /** Custom setup script to run */
  setupScript?: string;
}
