import chalk from "chalk";

export function success(msg: string): void {
  console.log(chalk.green("✓"), msg);
}

export function info(msg: string): void {
  console.log(chalk.blue("ℹ"), msg);
}

export function warn(msg: string): void {
  console.log(chalk.yellow("⚠"), msg);
}

export function error(msg: string): void {
  console.error(chalk.red("✗"), msg);
}

interface Diagnosis {
  problem: string;
  fix: string;
  docs?: string;
}

/**
 * Pattern-match a thrown error against the small set we know how to actually
 * help with, and emit a three-tier message (problem / fix / docs link).
 * Falls back to `error(msg)` when nothing matches — strictly an enrichment,
 * never replaces the underlying signal.
 */
export function diagnose(err: unknown): void {
  const raw = err instanceof Error ? err.message : String(err);
  const d = diagnosisFor(raw);
  if (!d) {
    error(raw);
    return;
  }
  console.error(chalk.red("✗"), chalk.bold(d.problem));
  console.error(chalk.dim("  Original error:"), raw);
  console.error(chalk.cyan("  Fix:"), d.fix);
  if (d.docs) console.error(chalk.dim("  Docs:"), d.docs);
}

function diagnosisFor(message: string): Diagnosis | null {
  // E2B unauthenticated: "401: authorization header is missing"
  if (/401|unauthor(ized|ization)/i.test(message)) {
    return {
      problem: "E2B is not authenticated.",
      fix:
        "Set E2B_API_KEY in your environment. Get a key at https://e2b.dev/dashboard. " +
        "Try again with `E2B_API_KEY=sk_… agento-sdk status`.",
      docs: "https://e2b.dev/docs/api-key",
    };
  }
  // Network: ECONNREFUSED, ENOTFOUND, EAI_AGAIN, getaddrinfo
  if (/ENOTFOUND|ECONNREFUSED|EAI_AGAIN|getaddrinfo/.test(message)) {
    return {
      problem: "Network reach to E2B failed.",
      fix:
        "Check connectivity, corporate proxy, or VPN. If on a flaky network, " +
        "retry; the SDK does not retry network failures by default.",
    };
  }
  // ANTHROPIC_API_KEY needed (claude code path)
  if (/ANTHROPIC_API_KEY|anthropic[_\s-]?api[_\s-]?key/i.test(message)) {
    return {
      problem: "Claude Code needs an Anthropic API key.",
      fix:
        "Set ANTHROPIC_API_KEY in the environment passed to the FangBox " +
        "(`createFangBox({ envs: { ANTHROPIC_API_KEY: ... } })`) or in the " +
        "shell before running the CLI.",
      docs: "https://docs.anthropic.com/en/api/getting-started",
    };
  }
  return null;
}

export function header(msg: string): void {
  console.log(chalk.bold.cyan(`\n${msg}\n`));
}

export function table(rows: Record<string, string>[]): void {
  if (rows.length === 0) {
    info("No results");
    return;
  }
  console.table(rows);
}

export function stepStatus(
  stepId: string,
  status: "success" | "failure" | "skipped",
  durationMs?: number,
): void {
  const icon =
    status === "success"
      ? chalk.green("✓")
      : status === "failure"
        ? chalk.red("✗")
        : chalk.gray("○");

  const duration = durationMs ? chalk.dim(` (${(durationMs / 1000).toFixed(1)}s)`) : "";
  console.log(`  ${icon} ${stepId}${duration}`);
}
