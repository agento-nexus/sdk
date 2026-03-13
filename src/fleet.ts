import type {
  FleetEvent,
  StepResult,
  WorkflowDefinition,
  WorkflowResult,
  WorkflowStep,
} from "./types.js";
import { createFangBox } from "./fangbox.js";
import { TypedEmitter } from "./utils/events.js";
import { Logger } from "./utils/logger.js";

export interface FleetConfig {
  /** Max concurrent sandboxes (default: 3) */
  maxConcurrency?: number;
  /** Default sandbox timeout in seconds */
  defaultTimeout?: number;
  /** Default environment variables for all sandboxes */
  envs?: Record<string, string>;
}

export class Fleet {
  readonly events = new TypedEmitter<FleetEvent>();
  private log: Logger;
  private maxConcurrency: number;
  private defaultTimeout: number;
  private envs: Record<string, string>;

  constructor(config: FleetConfig = {}) {
    this.maxConcurrency = config.maxConcurrency ?? 3;
    this.defaultTimeout = config.defaultTimeout ?? 300;
    this.envs = config.envs ?? {};
    this.log = new Logger("fleet");
  }

  /** Run a workflow from a parsed definition */
  async run(workflow: WorkflowDefinition): Promise<WorkflowResult> {
    const start = Date.now();
    this.log.info("Starting workflow", { name: workflow.name });
    this.events.emit({ type: "workflow:start", name: workflow.name });

    const sorted = this.topologicalSort(workflow.steps);
    const outputs: Record<string, string> = {};
    const results: StepResult[] = [];
    const completed = new Set<string>();

    // Process steps respecting dependencies and concurrency
    const pending = [...sorted];

    while (pending.length > 0) {
      // Find steps whose dependencies are all completed
      const ready = pending.filter((step) =>
        (step.dependsOn ?? []).every((dep) => completed.has(dep)),
      );

      if (ready.length === 0 && pending.length > 0) {
        throw new Error(
          "Deadlock: no steps can proceed. Check for circular dependencies.",
        );
      }

      // Run ready steps in parallel up to maxConcurrency
      const batch = ready.slice(0, this.maxConcurrency);
      const batchResults = await Promise.allSettled(
        batch.map((step) => this.executeStep(step, outputs, workflow.envs)),
      );

      for (let i = 0; i < batch.length; i++) {
        const step = batch[i];
        const settled = batchResults[i];

        let result: StepResult;
        if (settled.status === "fulfilled") {
          result = settled.value;
        } else {
          result = {
            stepId: step.id,
            status: "failure",
            error:
              settled.reason instanceof Error
                ? settled.reason.message
                : String(settled.reason),
            durationMs: 0,
          };
        }

        results.push(result);
        completed.add(step.id);

        if (result.status === "success" && step.outputKey && result.output) {
          outputs[step.outputKey] = result.output;
        }

        this.events.emit({ type: "step:complete", stepId: step.id, result });

        // Remove from pending
        const idx = pending.indexOf(step);
        if (idx !== -1) pending.splice(idx, 1);
      }
    }

    const status = results.every((r) => r.status === "success")
      ? "success"
      : results.some((r) => r.status === "success")
        ? "partial"
        : "failure";

    const workflowResult: WorkflowResult = {
      workflowName: workflow.name,
      status,
      steps: results,
      totalDurationMs: Date.now() - start,
      outputs,
    };

    this.events.emit({ type: "workflow:complete", result: workflowResult });
    return workflowResult;
  }

  /** Load and run a workflow from a JSON file path */
  async runFromFile(filePath: string): Promise<WorkflowResult> {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(filePath, "utf-8");
    const workflow = JSON.parse(content) as WorkflowDefinition;
    return this.run(workflow);
  }

  private async executeStep(
    step: WorkflowStep,
    outputs: Record<string, string>,
    workflowEnvs?: Record<string, string>,
  ): Promise<StepResult> {
    const start = Date.now();

    // Evaluate condition
    if (step.condition) {
      const shouldRun = this.evaluateCondition(step.condition, outputs);
      if (!shouldRun) {
        this.events.emit({
          type: "step:skip",
          stepId: step.id,
          reason: `Condition not met: ${step.condition}`,
        });
        return {
          stepId: step.id,
          status: "skipped",
          durationMs: Date.now() - start,
        };
      }
    }

    this.events.emit({ type: "step:start", stepId: step.id });
    this.log.info("Executing step", { stepId: step.id, name: step.name });

    const box = await createFangBox({
      ...step.config,
      envs: { ...this.envs, ...workflowEnvs, ...step.config?.envs },
      timeout: step.timeout ?? this.defaultTimeout,
    });

    try {
      // Interpolate prompt with outputs from previous steps
      const prompt = this.interpolate(step.prompt, outputs);

      // Spawn agent and send prompt
      const manifest =
        typeof step.hand === "string" ? { name: step.hand } : step.hand;
      const agent = await box.spawnAgent(manifest);
      const response = await box.messageAgent(agent.id, prompt);

      return {
        stepId: step.id,
        status: "success",
        output: response.content,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        stepId: step.id,
        status: "failure",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
      };
    } finally {
      await box.destroy();
    }
  }

  /** Interpolate {{outputKey}} placeholders in a string */
  private interpolate(
    template: string,
    outputs: Record<string, string>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      return outputs[key] ?? match;
    });
  }

  /**
   * Evaluate a condition against available outputs.
   * Supports safe expressions: "outputKey", "!outputKey",
   * "outputKey == 'value'", "outputKey != 'value'"
   */
  private evaluateCondition(
    condition: string,
    outputs: Record<string, string>,
  ): boolean {
    const trimmed = condition.trim();

    // "!key" — key must be absent or empty
    if (trimmed.startsWith("!")) {
      const key = trimmed.slice(1).trim();
      return !outputs[key];
    }

    // "key == 'value'" or 'key != "value"'
    const eqMatch = trimmed.match(/^(\w+)\s*(==|!=)\s*['"](.*)['"]$/);
    if (eqMatch) {
      const [, key, op, value] = eqMatch;
      const actual = outputs[key];
      return op === "==" ? actual === value : actual !== value;
    }

    // "key" — key must exist and be non-empty
    return Boolean(outputs[trimmed]);
  }

  /** Topological sort of workflow steps using Kahn's algorithm */
  private topologicalSort(steps: WorkflowStep[]): WorkflowStep[] {
    const stepMap = new Map(steps.map((s) => [s.id, s]));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const step of steps) {
      inDegree.set(step.id, (step.dependsOn ?? []).length);
      for (const dep of step.dependsOn ?? []) {
        const existing = adjacency.get(dep) ?? [];
        existing.push(step.id);
        adjacency.set(dep, existing);
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const sorted: WorkflowStep[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      sorted.push(stepMap.get(id)!);

      for (const neighbor of adjacency.get(id) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (sorted.length !== steps.length) {
      throw new Error("Workflow contains circular dependencies");
    }

    return sorted;
  }
}
