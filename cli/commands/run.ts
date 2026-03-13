import { Command } from "commander";
import { createFangBox } from "../../src/fangbox.js";
import * as fmt from "../formatters.js";

export const runCommand = new Command("run")
  .description("Run a single agent (Hand) in a sandbox")
  .argument("<hand>", "Hand name or manifest path")
  .requiredOption("-p, --prompt <prompt>", "Prompt to send to the agent")
  .option("-t, --template <id>", "E2B template ID", "openfang-claude")
  .option("--timeout <seconds>", "Sandbox timeout", "300")
  .option("--claude", "Use Claude Code instead of OpenFang agent")
  .action(async (hand, opts) => {
    fmt.info(`Creating sandbox with template ${opts.template}...`);

    const envs: Record<string, string> = {};
    if (process.env.ANTHROPIC_API_KEY) {
      envs.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    }

    try {
      const box = await createFangBox({
        templateId: opts.template,
        timeout: parseInt(opts.timeout, 10),
        envs,
      });

      fmt.success(`Sandbox ${box.sandboxId} ready`);

      let output: string;

      if (opts.claude) {
        fmt.info("Running with Claude Code...");
        const result = await box.runClaude({ prompt: opts.prompt });
        output = result.output;
      } else {
        fmt.info(`Spawning agent: ${hand}`);
        const agent = await box.spawnAgent(hand);
        fmt.info(`Agent ${agent.id} running`);

        const response = await box.messageAgent(agent.id, opts.prompt);
        output = response.content;
      }

      fmt.header("Response");
      console.log(output);

      fmt.info("Destroying sandbox...");
      await box.destroy();
      fmt.success("Done");
    } catch (err) {
      fmt.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
