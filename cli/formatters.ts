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
