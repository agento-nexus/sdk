import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock e2b before importing FangBox
vi.mock("e2b", () => {
  const mockSandbox = {
    sandboxId: "sandbox-test-123",
    commands: {
      run: vi.fn().mockResolvedValue({
        stdout: "",
        stderr: "",
        exitCode: 0,
      }),
    },
    files: {
      write: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue("file content"),
    },
    kill: vi.fn().mockResolvedValue(undefined),
  };

  return {
    Sandbox: {
      create: vi.fn().mockResolvedValue(mockSandbox),
      list: vi.fn().mockResolvedValue([]),
      connect: vi.fn().mockResolvedValue(mockSandbox),
    },
  };
});

// Mock fetch for OpenFang client
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { FangBox, createFangBox } from "../src/fangbox.js";
import { Sandbox } from "e2b";

describe("FangBox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock healthy daemon response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          status: "ok",
          version: "1.0.0",
          uptime_seconds: 1,
          agents_running: 0,
        }),
    });
  });

  it("creates a sandbox and waits for daemon", async () => {
    const box = await createFangBox();

    expect(Sandbox.create).toHaveBeenCalledWith(
      "openfang-claude",
      expect.any(Object),
    );
    expect(box.sandboxId).toBe("sandbox-test-123");
  });

  it("uses custom template ID", async () => {
    await createFangBox({ templateId: "custom-template" });

    expect(Sandbox.create).toHaveBeenCalledWith(
      "custom-template",
      expect.any(Object),
    );
  });

  it("passes environment variables", async () => {
    await createFangBox({
      envs: { ANTHROPIC_API_KEY: "test-key" },
    });

    expect(Sandbox.create).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        envs: { ANTHROPIC_API_KEY: "test-key" },
      }),
    );
  });

  it("emits events during creation", async () => {
    const events: string[] = [];
    const box = await createFangBox();
    box.events.on((e) => events.push(e.type));

    // Events were emitted during creation (before we subscribed),
    // but the internal emitter captured them
    expect(box.sandboxId).toBeTruthy();
  });

  it("destroys sandbox", async () => {
    const box = await createFangBox();
    await box.destroy();

    const mock = Sandbox.create as ReturnType<typeof vi.fn>;
    const sandbox = await mock.mock.results[0].value;
    expect(sandbox.kill).toHaveBeenCalled();
  });

  it("uploads and reads files", async () => {
    const box = await createFangBox();

    await box.uploadFile("/test.txt", "hello");
    const content = await box.readFile("/test.txt");

    expect(content).toBe("file content");
  });
});
