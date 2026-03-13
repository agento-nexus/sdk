import { describe, it, expect, vi } from "vitest";
import { ClaudeBridge } from "../src/claude-bridge.js";
import type { Sandbox } from "e2b";

function createMockSandbox(
  stdout = "test output",
  exitCode = 0,
): Sandbox {
  return {
    commands: {
      run: vi.fn().mockResolvedValue({
        stdout,
        stderr: "",
        exitCode,
      }),
    },
  } as unknown as Sandbox;
}

describe("ClaudeBridge", () => {
  it("executes a prompt and returns result", async () => {
    const sandbox = createMockSandbox("Hello from Claude");
    const bridge = new ClaudeBridge(sandbox);

    const result = await bridge.execute({
      prompt: "Say hello",
    });

    expect(result.output).toBe("Hello from Claude");
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(sandbox.commands.run).toHaveBeenCalledOnce();
  });

  it("parses JSON output when format is json", async () => {
    const jsonOutput = JSON.stringify({ answer: 42 });
    const sandbox = createMockSandbox(jsonOutput);
    const bridge = new ClaudeBridge(sandbox);

    const result = await bridge.execute({
      prompt: "Return JSON",
      outputFormat: "json",
    });

    expect(result.parsed).toEqual({ answer: 42 });
  });

  it("handles invalid JSON gracefully", async () => {
    const sandbox = createMockSandbox("not json");
    const bridge = new ClaudeBridge(sandbox);

    const result = await bridge.execute({
      prompt: "Return data",
      outputFormat: "json",
    });

    expect(result.parsed).toBeUndefined();
    expect(result.output).toBe("not json");
  });

  it("checks availability", async () => {
    const sandbox = createMockSandbox("1.0.0");
    const bridge = new ClaudeBridge(sandbox);

    const available = await bridge.isAvailable();
    expect(available).toBe(true);
  });

  it("reports unavailable when claude not found", async () => {
    const sandbox = createMockSandbox("", 1);
    const bridge = new ClaudeBridge(sandbox);

    const available = await bridge.isAvailable();
    expect(available).toBe(false);
  });

  it("passes session ID and flags", async () => {
    const sandbox = createMockSandbox("output");
    const bridge = new ClaudeBridge(sandbox);

    await bridge.execute({
      prompt: "Test",
      sessionId: "sess-123",
      flags: ["--verbose"],
    });

    const callArgs = (sandbox.commands.run as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(callArgs).toContain("--session-id");
    expect(callArgs).toContain("sess-123");
    expect(callArgs).toContain("--verbose");
  });
});
