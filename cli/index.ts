import { readFileSync } from "node:fs";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { runCommand } from "./commands/run.js";
import { fleetCommand } from "./commands/fleet.js";
import { statusCommand } from "./commands/status.js";
import { logsCommand } from "./commands/logs.js";
import { destroyCommand } from "./commands/destroy.js";

// Resolve package.json relative to this module so the CLI version stays in
// lockstep with package.json instead of drifting silently. Bin runs from
// dist/cli/bin.js → ../../package.json. dev (tsx) runs from cli/index.ts
// → ../package.json. Try both so the same file works either way.
function readPackageVersion(): string {
  for (const rel of ["../package.json", "../../package.json"]) {
    try {
      const url = new URL(rel, import.meta.url);
      const pkg = JSON.parse(readFileSync(url, "utf8")) as { version?: string };
      if (pkg.version) return pkg.version;
    } catch {
      /* try next */
    }
  }
  return "unknown";
}

export const program = new Command()
  .name("agento-sdk")
  .description("Agent OS in Cloud Sandboxes — OpenFang + E2B + Claude Code")
  .version(readPackageVersion());

program.addCommand(initCommand);
program.addCommand(runCommand);
program.addCommand(fleetCommand);
program.addCommand(statusCommand);
program.addCommand(logsCommand);
program.addCommand(destroyCommand);
