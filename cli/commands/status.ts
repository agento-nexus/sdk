import { Command } from "commander";
import { Sandbox } from "e2b";
import * as fmt from "../formatters.js";

export const statusCommand = new Command("status")
  .description("List running E2B sandboxes")
  .action(async () => {
    try {
      const sandboxes = await Sandbox.list();

      if (sandboxes.length === 0) {
        fmt.info("No running sandboxes");
        return;
      }

      fmt.header(`Running Sandboxes (${sandboxes.length})`);
      fmt.table(
        sandboxes.map((s) => ({
          id: s.sandboxId,
          template: s.templateId,
          started: s.startedAt?.toISOString() ?? "unknown",
        })),
      );
    } catch (err) {
      fmt.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
