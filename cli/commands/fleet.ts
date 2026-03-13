import { Command } from "commander";
import { Fleet } from "../../src/fleet.js";
import * as fmt from "../formatters.js";

export const fleetCommand = new Command("fleet")
  .description("Run a multi-agent workflow from a JSON definition")
  .argument("<workflow>", "Path to workflow JSON file")
  .option("-c, --concurrency <n>", "Max concurrent sandboxes", "3")
  .option("--timeout <seconds>", "Default step timeout", "300")
  .action(async (workflowPath, opts) => {
    const envs: Record<string, string> = {};
    if (process.env.ANTHROPIC_API_KEY) {
      envs.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    }

    const fleet = new Fleet({
      maxConcurrency: parseInt(opts.concurrency, 10),
      defaultTimeout: parseInt(opts.timeout, 10),
      envs,
    });

    fleet.events.on((event) => {
      switch (event.type) {
        case "workflow:start":
          fmt.header(`Workflow: ${event.name}`);
          break;
        case "step:start":
          fmt.info(`Step ${event.stepId} starting...`);
          break;
        case "step:complete":
          fmt.stepStatus(
            event.stepId,
            event.result.status,
            event.result.durationMs,
          );
          break;
        case "step:skip":
          fmt.stepStatus(event.stepId, "skipped");
          break;
        case "workflow:complete":
          fmt.header("Workflow Complete");
          fmt.info(`Status: ${event.result.status}`);
          fmt.info(
            `Duration: ${(event.result.totalDurationMs / 1000).toFixed(1)}s`,
          );
          break;
      }
    });

    try {
      const result = await fleet.runFromFile(workflowPath);

      if (Object.keys(result.outputs).length > 0) {
        fmt.header("Outputs");
        for (const [key, value] of Object.entries(result.outputs)) {
          console.log(`  ${key}: ${value.slice(0, 200)}${value.length > 200 ? "..." : ""}`);
        }
      }

      if (result.status === "failure") {
        process.exit(1);
      }
    } catch (err) {
      fmt.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
