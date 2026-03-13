import { Command } from "commander";
import { Sandbox } from "e2b";
import * as fmt from "../formatters.js";

export const logsCommand = new Command("logs")
  .description("Stream logs from a running sandbox")
  .argument("<id>", "Sandbox ID")
  .option("-f, --follow", "Follow log output")
  .action(async (id, opts) => {
    try {
      const sandbox = await Sandbox.connect(id);
      fmt.info(`Connected to sandbox ${id}`);

      const result = await sandbox.commands.run(
        "journalctl -u openfang" + (opts.follow ? " -f" : " --no-pager"),
        { timeoutMs: opts.follow ? 0 : 30_000 },
      );

      console.log(result.stdout);

      if (result.stderr) {
        fmt.warn(result.stderr);
      }
    } catch (err) {
      fmt.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
