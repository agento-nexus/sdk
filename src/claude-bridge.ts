import type { Sandbox } from "e2b";
import type { ClaudeCodeRequest, ClaudeCodeResult } from "./types.js";
import { Logger } from "./utils/logger.js";

export class ClaudeBridge {
  private log: Logger;

  constructor(private sandbox: Sandbox) {
    this.log = new Logger("claude-bridge");
  }

  /** Execute a Claude Code prompt inside the sandbox */
  async execute(request: ClaudeCodeRequest): Promise<ClaudeCodeResult> {
    const start = Date.now();
    const args = this.buildArgs(request);

    this.log.info("Executing Claude Code", {
      prompt: request.prompt.slice(0, 100),
      outputFormat: request.outputFormat,
    });

    const result = await this.sandbox.commands.run(
      `claude ${args.join(" ")}`,
      {
        cwd: request.cwd ?? "/home/user",
        timeoutMs: (request.maxTokens ?? 120) * 1000,
      },
    );

    const durationMs = Date.now() - start;
    const output = result.stdout;

    let parsed: unknown;
    if (request.outputFormat === "json") {
      try {
        parsed = JSON.parse(output);
      } catch {
        this.log.warn("Failed to parse JSON output from Claude Code");
      }
    }

    return {
      output,
      exitCode: result.exitCode,
      parsed,
      durationMs,
      sessionId: request.sessionId,
    };
  }

  /** Check if Claude Code is installed in the sandbox */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.sandbox.commands.run("claude --version", {
        timeoutMs: 10_000,
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  private buildArgs(request: ClaudeCodeRequest): string[] {
    const args = ["-p", this.shellEscape(request.prompt)];

    if (request.outputFormat === "json") {
      args.push("--output-format", "json");
    }

    if (request.sessionId) {
      args.push("--session-id", request.sessionId);
    }

    if (request.maxTokens) {
      args.push("--max-tokens", String(request.maxTokens));
    }

    if (request.flags) {
      args.push(...request.flags);
    }

    return args;
  }

  private shellEscape(str: string): string {
    return `'${str.replace(/'/g, "'\\''")}'`;
  }
}
