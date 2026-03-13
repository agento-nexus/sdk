import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("e2b", () => {
  const mockSandbox = {
    sandboxId: "template-sandbox-123",
    commands: {
      run: vi.fn().mockImplementation(async (cmd: string) => {
        if (cmd.includes("--version")) {
          return { stdout: "openfang 1.2.3", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    },
    kill: vi.fn().mockResolvedValue(undefined),
  };

  return {
    Sandbox: {
      create: vi.fn().mockResolvedValue(mockSandbox),
    },
  };
});

import { TemplateBuilder } from "../src/template-builder.js";
import { Sandbox } from "e2b";

describe("TemplateBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a template and returns version", async () => {
    const builder = new TemplateBuilder();
    const result = await builder.build();

    expect(result.templateId).toBe("template-sandbox-123");
    expect(result.openfangVersion).toBe("openfang 1.2.3");
    expect(Sandbox.create).toHaveBeenCalledWith("claude", expect.any(Object));
  });

  it("uses custom base template", async () => {
    const builder = new TemplateBuilder();
    await builder.build({ baseTemplate: "custom-base" });

    expect(Sandbox.create).toHaveBeenCalledWith(
      "custom-base",
      expect.any(Object),
    );
  });

  it("installs specific version", async () => {
    const builder = new TemplateBuilder();
    await builder.build({ openfangVersion: "2.0.0" });

    const mockCreate = Sandbox.create as ReturnType<typeof vi.fn>;
    const sandbox = await mockCreate.mock.results[0].value;
    expect(sandbox.commands.run).toHaveBeenCalledWith(
      "pip install openfang==2.0.0",
      expect.any(Object),
    );
  });

  it("verifies a healthy template", async () => {
    const builder = new TemplateBuilder();
    const result = await builder.verify("test-template");

    expect(result.healthy).toBe(true);
    expect(result.version).toBe("openfang 1.2.3");
  });

  it("reports unhealthy template when openfang missing", async () => {
    const mockCreate = Sandbox.create as ReturnType<typeof vi.fn>;
    mockCreate.mockResolvedValueOnce({
      sandboxId: "bad-template",
      commands: {
        run: vi.fn().mockResolvedValue({
          stdout: "",
          stderr: "command not found",
          exitCode: 127,
        }),
      },
      kill: vi.fn(),
    });

    const builder = new TemplateBuilder();
    const result = await builder.verify("bad-template");

    expect(result.healthy).toBe(false);
    expect(result.error).toBe("openfang not found");
  });
});
