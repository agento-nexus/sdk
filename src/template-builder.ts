import { Sandbox } from "e2b";
import type { TemplateBuildConfig } from "./types.js";
import { Logger } from "./utils/logger.js";

const DEFAULT_BASE_TEMPLATE = "claude";

export class TemplateBuilder {
  private log: Logger;

  constructor() {
    this.log = new Logger("template-builder");
  }

  /** Build an E2B template with OpenFang installed */
  async build(config: TemplateBuildConfig = {}): Promise<{
    templateId: string;
    openfangVersion: string;
  }> {
    const base = config.baseTemplate ?? DEFAULT_BASE_TEMPLATE;
    this.log.info("Building template", { base });

    // Spin up a temporary sandbox from the base template
    const sandbox = await Sandbox.create(base, {
      timeoutMs: 300_000,
    });

    try {
      // Install OpenFang
      const installCmd = config.openfangVersion
        ? `pip install openfang==${config.openfangVersion}`
        : "pip install openfang";

      this.log.info("Installing OpenFang", { cmd: installCmd });
      const installResult = await sandbox.commands.run(installCmd, {
        timeoutMs: 120_000,
      });

      if (installResult.exitCode !== 0) {
        throw new Error(
          `Failed to install OpenFang: ${installResult.stderr}`,
        );
      }

      // Install additional packages
      if (config.packages?.length) {
        const pkgCmd = `pip install ${config.packages.join(" ")}`;
        this.log.info("Installing additional packages", { cmd: pkgCmd });
        const pkgResult = await sandbox.commands.run(pkgCmd, {
          timeoutMs: 120_000,
        });

        if (pkgResult.exitCode !== 0) {
          throw new Error(
            `Failed to install packages: ${pkgResult.stderr}`,
          );
        }
      }

      // Run custom setup script
      if (config.setupScript) {
        this.log.info("Running custom setup script");
        const setupResult = await sandbox.commands.run(config.setupScript, {
          timeoutMs: 120_000,
        });

        if (setupResult.exitCode !== 0) {
          throw new Error(
            `Setup script failed: ${setupResult.stderr}`,
          );
        }
      }

      // Verify installation
      const versionResult = await sandbox.commands.run(
        "openfang --version",
        { timeoutMs: 10_000 },
      );

      if (versionResult.exitCode !== 0) {
        throw new Error("OpenFang installation verification failed");
      }

      const openfangVersion = versionResult.stdout.trim();
      this.log.info("OpenFang installed", { version: openfangVersion });

      // Note: In production, you'd call e2b template save here.
      // The E2B CLI handles template creation from running sandboxes.
      // For programmatic builds, we return the sandbox ID for manual saving.

      return {
        templateId: sandbox.sandboxId,
        openfangVersion,
      };
    } finally {
      await sandbox.kill();
    }
  }

  /** Verify an existing template has OpenFang ready */
  async verify(templateId: string): Promise<{
    healthy: boolean;
    version?: string;
    error?: string;
  }> {
    this.log.info("Verifying template", { templateId });

    const sandbox = await Sandbox.create(templateId, {
      timeoutMs: 60_000,
    });

    try {
      const result = await sandbox.commands.run("openfang --version", {
        timeoutMs: 10_000,
      });

      if (result.exitCode !== 0) {
        return { healthy: false, error: "openfang not found" };
      }

      return { healthy: true, version: result.stdout.trim() };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await sandbox.kill();
    }
  }
}
