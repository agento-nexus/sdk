import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock e2b
vi.mock("e2b", () => {
  const mockSandbox = {
    sandboxId: "fleet-sandbox-123",
    commands: {
      run: vi.fn().mockResolvedValue({
        stdout: "",
        stderr: "",
        exitCode: 0,
      }),
    },
    files: {
      write: vi.fn(),
      read: vi.fn(),
    },
    kill: vi.fn().mockResolvedValue(undefined),
  };

  return {
    Sandbox: {
      create: vi.fn().mockResolvedValue(mockSandbox),
    },
  };
});

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { Fleet } from "../src/fleet.js";
import type { WorkflowDefinition } from "../src/types.js";

describe("Fleet", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: healthy daemon + agent spawn + message response
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/health")) {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: "ok",
              version: "1.0.0",
              uptime_seconds: 1,
              agents_running: 0,
            }),
        };
      }
      if (url.includes("/messages") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              id: "msg-1",
              agent_id: "agent-1",
              content: "Step completed successfully",
              role: "assistant",
            }),
        };
      }
      if (url.includes("/agents") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              id: "agent-1",
              name: "test",
              status: "running",
              created_at: new Date().toISOString(),
            }),
        };
      }
      return { ok: true, status: 200, json: () => Promise.resolve({}) };
    });
  });

  it("runs a simple workflow", async () => {
    const fleet = new Fleet({ maxConcurrency: 2 });
    const workflow: WorkflowDefinition = {
      name: "test-workflow",
      steps: [
        {
          id: "step1",
          name: "Step 1",
          hand: "researcher",
          prompt: "Do research",
          outputKey: "research",
        },
      ],
    };

    const result = await fleet.run(workflow);
    expect(result.workflowName).toBe("test-workflow");
    expect(result.status).toBe("success");
    expect(result.steps).toHaveLength(1);
    expect(result.outputs.research).toBe("Step completed successfully");
  });

  it("executes dependent steps in order", async () => {
    const fleet = new Fleet();
    const executionOrder: string[] = [];

    fleet.events.on((e) => {
      if (e.type === "step:start") executionOrder.push(e.stepId);
    });

    const workflow: WorkflowDefinition = {
      name: "ordered-workflow",
      steps: [
        {
          id: "first",
          name: "First",
          hand: "researcher",
          prompt: "Step 1",
          outputKey: "first_output",
        },
        {
          id: "second",
          name: "Second",
          hand: "coder",
          prompt: "Use {{first_output}}",
          dependsOn: ["first"],
        },
      ],
    };

    await fleet.run(workflow);
    expect(executionOrder).toEqual(["first", "second"]);
  });

  it("runs independent steps in parallel", async () => {
    const fleet = new Fleet({ maxConcurrency: 5 });
    const workflow: WorkflowDefinition = {
      name: "parallel-workflow",
      steps: [
        { id: "a", name: "A", hand: "researcher", prompt: "Task A" },
        { id: "b", name: "B", hand: "researcher", prompt: "Task B" },
        { id: "c", name: "C", hand: "researcher", prompt: "Task C" },
      ],
    };

    const result = await fleet.run(workflow);
    expect(result.status).toBe("success");
    expect(result.steps).toHaveLength(3);
  });

  it("detects circular dependencies", async () => {
    const fleet = new Fleet();
    const workflow: WorkflowDefinition = {
      name: "circular",
      steps: [
        {
          id: "a",
          name: "A",
          hand: "test",
          prompt: "x",
          dependsOn: ["b"],
        },
        {
          id: "b",
          name: "B",
          hand: "test",
          prompt: "x",
          dependsOn: ["a"],
        },
      ],
    };

    await expect(() => fleet.run(workflow)).rejects.toThrow("circular");
  });

  it("interpolates output keys in prompts", async () => {
    const fleet = new Fleet();
    const workflow: WorkflowDefinition = {
      name: "interpolation-test",
      steps: [
        {
          id: "step1",
          name: "Step 1",
          hand: "test",
          prompt: "Generate data",
          outputKey: "data",
        },
        {
          id: "step2",
          name: "Step 2",
          hand: "test",
          prompt: "Process: {{data}}",
          dependsOn: ["step1"],
        },
      ],
    };

    const result = await fleet.run(workflow);
    expect(result.status).toBe("success");
  });
});
