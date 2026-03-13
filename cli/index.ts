import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { runCommand } from "./commands/run.js";
import { fleetCommand } from "./commands/fleet.js";
import { statusCommand } from "./commands/status.js";
import { logsCommand } from "./commands/logs.js";
import { destroyCommand } from "./commands/destroy.js";

export const program = new Command()
  .name("agento-sdk")
  .description("Agent OS in Cloud Sandboxes — OpenFang + E2B + Claude Code")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(runCommand);
program.addCommand(fleetCommand);
program.addCommand(statusCommand);
program.addCommand(logsCommand);
program.addCommand(destroyCommand);
