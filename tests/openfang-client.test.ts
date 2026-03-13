import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenFangClient, OpenFangError } from "../src/openfang-client.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("OpenFangClient", () => {
  let client: OpenFangClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OpenFangClient({
      baseUrl: "http://localhost:4200",
      retryOptions: { maxAttempts: 1 },
    });
  });

  describe("health", () => {
    it("returns health response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            status: "ok",
            version: "1.0.0",
            uptime_seconds: 42,
            agents_running: 0,
          }),
      });

      const health = await client.health();
      expect(health.status).toBe("ok");
      expect(health.version).toBe("1.0.0");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4200/health",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("throws OpenFangError on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: () => Promise.resolve("service unavailable"),
      });

      await expect(client.health()).rejects.toThrow(OpenFangError);
    });
  });

  describe("spawnAgent", () => {
    it("sends POST with manifest", async () => {
      const agent = {
        id: "agent-1",
        name: "researcher",
        status: "running" as const,
        created_at: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(agent),
      });

      const result = await client.spawnAgent({ name: "researcher" });
      expect(result.id).toBe("agent-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4200/agents",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "researcher" }),
        }),
      );
    });
  });

  describe("listAgents", () => {
    it("returns array of agents", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      const agents = await client.listAgents();
      expect(agents).toEqual([]);
    });
  });

  describe("messageAgent", () => {
    it("sends message and returns response", async () => {
      const response = {
        id: "msg-1",
        agent_id: "agent-1",
        content: "Hello world",
        role: "assistant" as const,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(response),
      });

      const result = await client.messageAgent("agent-1", "Hi");
      expect(result.content).toBe("Hello world");
    });
  });

  describe("stopAgent", () => {
    it("sends DELETE request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await expect(client.stopAgent("agent-1")).resolves.toBeUndefined();
    });
  });
});
