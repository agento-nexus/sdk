import { Command } from "commander";
import { Sandbox } from "e2b";
import * as fmt from "../formatters.js";

export const destroyCommand = new Command("destroy")
  .description("Tear down sandboxes")
  .argument("[id]", "Sandbox ID (omit with --all to destroy all)")
  .option("--all", "Destroy all running sandboxes")
  .action(async (id, opts) => {
    try {
      if (opts.all) {
        const sandboxes = await Sandbox.list();
        if (sandboxes.length === 0) {
          fmt.info("No running sandboxes");
          return;
        }

        fmt.info(`Destroying ${sandboxes.length} sandboxes...`);
        await Promise.all(
          sandboxes.map(async (s) => {
            const sb = await Sandbox.connect(s.sandboxId);
            await sb.kill();
            fmt.success(`Destroyed ${s.sandboxId}`);
          }),
        );
        fmt.success("All sandboxes destroyed");
        return;
      }

      if (!id) {
        fmt.error("Provide a sandbox ID or use --all");
        process.exit(1);
      }

      fmt.info(`Destroying sandbox ${id}...`);
      const sandbox = await Sandbox.connect(id);
      await sandbox.kill();
      fmt.success(`Destroyed ${id}`);
    } catch (err) {
      fmt.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
