export type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private minLevel: number;

  constructor(
    private prefix: string,
    level: LogLevel = "info",
  ) {
    this.minLevel = levels[level];
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.log("debug", msg, data);
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.log("info", msg, data);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.log("warn", msg, data);
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.log("error", msg, data);
  }

  private log(
    level: LogLevel,
    msg: string,
    data?: Record<string, unknown>,
  ): void {
    if (levels[level] < this.minLevel) return;

    const entry = {
      ts: new Date().toISOString(),
      level,
      component: this.prefix,
      msg,
      ...data,
    };

    const out = level === "error" ? console.error : console.log;
    out(JSON.stringify(entry));
  }
}
