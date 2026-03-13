import { Command } from "commander";
import { TemplateBuilder } from "../../src/template-builder.js";
import * as fmt from "../formatters.js";

export const initCommand = new Command("init")
  .description("Build or verify E2B template with OpenFang installed")
  .option("--base <template>", "Base E2B template", "claude")
  .option("--version <version>", "OpenFang version to install")
  .option("--verify <templateId>", "Verify existing template instead of building")
  .action(async (opts) => {
    const builder = new TemplateBuilder();

    if (opts.verify) {
      fmt.info(`Verifying template ${opts.verify}...`);
      const result = await builder.verify(opts.verify);
      if (result.healthy) {
        fmt.success(`Template healthy — OpenFang ${result.version}`);
      } else {
        fmt.error(`Template unhealthy: ${result.error}`);
        process.exit(1);
      }
      return;
    }

    fmt.info("Building E2B template with OpenFang...");
    try {
      const result = await builder.build({
        baseTemplate: opts.base,
        openfangVersion: opts.version,
      });
      fmt.success(`Template built — sandbox ${result.templateId}`);
      fmt.info(`OpenFang ${result.openfangVersion}`);
      fmt.info("Save as template: e2b template save --sandbox-id " + result.templateId);
    } catch (err) {
      fmt.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
