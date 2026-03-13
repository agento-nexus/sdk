import type {
  AgentInfo,
  AgentResponse,
  HandManifest,
  HealthResponse,
  ToolDefinition,
} from "./types.js";
import { retry, type RetryOptions } from "./utils/retry.js";
import { Logger } from "./utils/logger.js";

export interface OpenFangClientConfig {
  /** Base URL for the OpenFang REST API */
  baseUrl: string;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
  /** Retry options for failed requests */
  retryOptions?: RetryOptions;
}

export class OpenFangClient {
  private baseUrl: string;
  private timeoutMs: number;
  private retryOpts: RetryOptions;
  private log: Logger;

  constructor(config: OpenFangClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.retryOpts = config.retryOptions ?? { maxAttempts: 3 };
    this.log = new Logger("openfang-client");
  }

  /** Check daemon health */
  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/health");
  }

  /** Wait for daemon to become healthy */
  async waitForHealthy(maxWaitMs = 30_000): Promise<HealthResponse> {
    const startTime = Date.now();
    return retry(
      async () => {
        if (Date.now() - startTime > maxWaitMs) {
          throw new Error(
            `OpenFang daemon not healthy after ${maxWaitMs}ms`,
          );
        }
        return this.health();
      },
      { maxAttempts: Math.ceil(maxWaitMs / 2000), initialDelayMs: 1000 },
    );
  }

  /** Spawn a new agent from a Hand manifest */
  async spawnAgent(manifest: HandManifest): Promise<AgentInfo> {
    this.log.info("Spawning agent", { name: manifest.name });
    return this.request<AgentInfo>("POST", "/agents", manifest);
  }

  /** List all running agents */
  async listAgents(): Promise<AgentInfo[]> {
    return this.request<AgentInfo[]>("GET", "/agents");
  }

  /** Get agent info by ID */
  async getAgent(agentId: string): Promise<AgentInfo> {
    return this.request<AgentInfo>("GET", `/agents/${agentId}`);
  }

  /** Send a message to an agent */
  async messageAgent(
    agentId: string,
    content: string,
  ): Promise<AgentResponse> {
    return this.request<AgentResponse>(
      "POST",
      `/agents/${agentId}/messages`,
      { content },
    );
  }

  /** Stop an agent */
  async stopAgent(agentId: string): Promise<void> {
    await this.request("DELETE", `/agents/${agentId}`);
  }

  /** List available tools */
  async listTools(): Promise<ToolDefinition[]> {
    return this.request<ToolDefinition[]>("GET", "/tools");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    return retry(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new OpenFangError(
            `${method} ${path} returned ${res.status}: ${text}`,
            res.status,
          );
        }

        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      } finally {
        clearTimeout(timer);
      }
    }, this.retryOpts);
  }
}

export class OpenFangError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "OpenFangError";
  }
}
