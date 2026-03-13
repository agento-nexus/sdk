import { Sandbox } from "e2b";
import type {
  AgentInfo,
  AgentResponse,
  ClaudeCodeRequest,
  ClaudeCodeResult,
  FangBoxConfig,
  FangBoxEvent,
  HandManifest,
  HealthResponse,
} from "./types.js";
import { OpenFangClient } from "./openfang-client.js";
import { ClaudeBridge } from "./claude-bridge.js";
import { TypedEmitter } from "./utils/events.js";
import { Logger } from "./utils/logger.js";

const DEFAULT_TEMPLATE = "openfang-claude";
const DEFAULT_PORT = 4200;
const DEFAULT_TIMEOUT = 300;

export class FangBox {
  readonly sandbox: Sandbox;
  readonly client: OpenFangClient;
  readonly claudeBridge: ClaudeBridge;
  readonly events = new TypedEmitter<FangBoxEvent>();
  private log: Logger;

  private constructor(
    sandbox: Sandbox,
    client: OpenFangClient,
    claudeBridge: ClaudeBridge,
  ) {
    this.sandbox = sandbox;
    this.client = client;
    this.claudeBridge = claudeBridge;
    this.log = new Logger("fangbox");
  }

  /**
   * Create a new FangBox — spins up sandbox, starts daemon, waits for health.
   * All commands run inside the E2B cloud sandbox (not local shell).
   */
  static async create(config: FangBoxConfig = {}): Promise<FangBox> {
    const emitter = new TypedEmitter<FangBoxEvent>();
    const log = new Logger("fangbox");
    const port = config.openfangPort ?? DEFAULT_PORT;

    emitter.emit({ type: "sandbox:creating" });
    log.info("Creating sandbox", {
      template: config.templateId ?? DEFAULT_TEMPLATE,
    });

    const sandbox = await Sandbox.create(config.templateId ?? DEFAULT_TEMPLATE, {
      envs: config.envs,
      timeoutMs: (config.timeout ?? DEFAULT_TIMEOUT) * 1000,
      metadata: config.metadata,
    });

    const sandboxId = sandbox.sandboxId;
    emitter.emit({ type: "sandbox:ready", sandboxId });

    const baseUrl = `https://${sandboxId}-${port}.e2b.dev`;
    const client = new OpenFangClient({ baseUrl });
    const claudeBridge = new ClaudeBridge(sandbox);

    const box = new FangBox(sandbox, client, claudeBridge);
    box.events.on((e) => emitter.emit(e));

    // Start OpenFang daemon inside the sandbox.
    // E2B's sandbox.commands.run() executes inside the cloud sandbox,
    // not on the local machine — this is safe by design.
    const daemonCmd = ["openfang", "serve", "--port", String(port)].join(" ");
    emitter.emit({ type: "daemon:starting" });
    await sandbox.commands.run(daemonCmd, { background: true });

    // Wait for daemon to be healthy
    try {
      const health = await client.waitForHealthy(30_000);
      emitter.emit({ type: "daemon:healthy", version: health.version });
      log.info("Daemon healthy", { version: health.version });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      emitter.emit({ type: "daemon:unhealthy", error: msg });
      throw new Error(`OpenFang daemon failed to start: ${msg}`);
    }

    return box;
  }

  get sandboxId(): string {
    return this.sandbox.sandboxId;
  }

  /** Check daemon health */
  async health(): Promise<HealthResponse> {
    return this.client.health();
  }

  /** Spawn an agent from a Hand manifest or name */
  async spawnAgent(handOrName: HandManifest | string): Promise<AgentInfo> {
    const manifest: HandManifest =
      typeof handOrName === "string" ? { name: handOrName } : handOrName;

    const agent = await this.client.spawnAgent(manifest);
    this.events.emit({
      type: "agent:spawned",
      agentId: agent.id,
      name: agent.name,
    });
    return agent;
  }

  /** Send a message to a running agent */
  async messageAgent(
    agentId: string,
    content: string,
  ): Promise<AgentResponse> {
    const response = await this.client.messageAgent(agentId, content);
    this.events.emit({
      type: "agent:message",
      agentId,
      content: response.content,
    });
    return response;
  }

  /** List all running agents */
  async listAgents(): Promise<AgentInfo[]> {
    return this.client.listAgents();
  }

  /** Stop an agent */
  async stopAgent(agentId: string): Promise<void> {
    await this.client.stopAgent(agentId);
    this.events.emit({ type: "agent:completed", agentId });
  }

  /** Execute Claude Code in the sandbox */
  async runClaude(request: ClaudeCodeRequest): Promise<ClaudeCodeResult> {
    return this.claudeBridge.execute(request);
  }

  /** Upload a file to the sandbox */
  async uploadFile(path: string, content: string): Promise<void> {
    await this.sandbox.files.write(path, content);
  }

  /** Read a file from the sandbox */
  async readFile(path: string): Promise<string> {
    return this.sandbox.files.read(path);
  }

  /**
   * Run a command inside the E2B cloud sandbox.
   * This uses E2B's sandbox.commands.run() which executes remotely,
   * not on the local machine.
   */
  async runInSandbox(
    command: string,
    opts?: { cwd?: string; timeoutMs?: number },
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const result = await this.sandbox.commands.run(command, opts);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  }

  /** Destroy the sandbox */
  async destroy(): Promise<void> {
    const id = this.sandboxId;
    this.log.info("Destroying sandbox", { sandboxId: id });
    await this.sandbox.kill();
    this.events.emit({ type: "sandbox:destroyed", sandboxId: id });
    this.events.removeAll();
  }
}

/** Convenience function to create a FangBox */
export async function createFangBox(config?: FangBoxConfig): Promise<FangBox> {
  return FangBox.create(config);
}
