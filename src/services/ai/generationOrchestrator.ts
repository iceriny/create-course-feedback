import { RequestError } from "../../AI_API/API";
import { v4 as uuidv4 } from "uuid";

import type { StudentsInfo } from "../../types";
import type { GenerationTaskSnapshot, PromptTrace } from "../../domain/ai";
import { cleanGeneratedFeedback } from "../feedback/feedbackTemplate";
import { savePromptTrace } from "../persistence/promptTraceRepository";
import { buildStudentGenerationMessages } from "../prompt/promptCompiler";
import { ProviderAIClient, type AIClient } from "./AIClient";
import type { StudentGenerationContextPlan } from "./contextPlanner";
import { validateGeneratedFeedback } from "./outputValidator";
import { buildPromptTrace, completePromptTrace } from "./promptTrace";

export type StudentInfoUpdater = (
  index: number,
  info: Partial<StudentsInfo> | ((prev: StudentsInfo) => StudentsInfo),
) => void;

export interface GenerationOrchestratorOptions {
  aiClient?: AIClient;
  maxConcurrentTasks?: number;
  maxAttempts?: number;
  onTaskChange?: (task: GenerationTaskSnapshot) => void;
  promptRecipe?: PromptTrace["promptRecipe"];
  retryDelayMs?: number;
  saveTrace?: (trace: PromptTrace) => void;
  updateStudentInfo: StudentInfoUpdater;
}

export interface QueueStudentGenerationInput {
  contextPlan: StudentGenerationContextPlan;
  index: number;
  systemPrompt: string;
  update?: (patch: Parameters<StudentInfoUpdater>[1]) => void;
}

interface GenerationTask {
  attempt: number;
  contextPlan: StudentGenerationContextPlan;
  id: string;
  index: number;
  maxAttempts: number;
  queuedAt: string;
  startedAt?: string;
  status: GenerationTaskSnapshot["status"];
  systemPrompt: string;
  trace?: PromptTrace;
  controller: AbortController;
  update?: (patch: Parameters<StudentInfoUpdater>[1]) => void;
}

const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_MAX_CONCURRENT_TASKS = 3;
const DEFAULT_RETRY_DELAY_MS = 800;

const toSnapshot = (task: GenerationTask): GenerationTaskSnapshot => ({
  attempt: task.attempt,
  finishedAt:
    task.status === "succeeded" || task.status === "failed"
      ? new Date().toISOString()
      : undefined,
  id: task.id,
  maxAttempts: task.maxAttempts,
  queuedAt: task.queuedAt,
  startedAt: task.startedAt,
  status: task.status,
  studentIndex: task.index,
  studentName: task.contextPlan.student.name,
  traceId: task.trace?.id,
});

export class GenerationOrchestrator {
  private readonly aiClient: AIClient;
  private readonly maxConcurrentTasks: number;
  private readonly maxAttempts: number;
  private readonly onTaskChange?: (task: GenerationTaskSnapshot) => void;
  private readonly queue: GenerationTask[] = [];
  private readonly promptRecipe?: PromptTrace["promptRecipe"];
  private readonly retryDelayMs: number;
  private runningTasks = 0;
  private readonly tasks = new Map<string, GenerationTask>();
  private readonly saveTrace: (trace: PromptTrace) => void;
  private readonly updateStudentInfo: StudentInfoUpdater;

  constructor({
    aiClient = new ProviderAIClient(),
    maxConcurrentTasks = DEFAULT_MAX_CONCURRENT_TASKS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    onTaskChange,
    promptRecipe,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    saveTrace = savePromptTrace,
    updateStudentInfo,
  }: GenerationOrchestratorOptions) {
    this.aiClient = aiClient;
    this.maxConcurrentTasks = Math.max(1, Math.floor(maxConcurrentTasks));
    this.maxAttempts = maxAttempts;
    this.onTaskChange = onTaskChange;
    this.promptRecipe = promptRecipe;
    this.retryDelayMs = retryDelayMs;
    this.saveTrace = saveTrace;
    this.updateStudentInfo = updateStudentInfo;
  }

  queueStudentGeneration({
    contextPlan,
    index,
    systemPrompt,
    update,
  }: QueueStudentGenerationInput) {
    const key = contextPlan.student.id || String(index);
    const existing = this.tasks.get(key);
    if (existing) return existing.id;
    const queuedAt = new Date().toISOString();
    const task: GenerationTask = {
      attempt: 0,
      contextPlan,
      id: uuidv4(),
      index,
      maxAttempts: this.maxAttempts,
      queuedAt,
      status: "queued",
      systemPrompt,
      update,
      controller: new AbortController(),
    };

    this.tasks.set(key, task);
    this.queue.push(task);
    this.updateTask(task, {
      confirmed: false,
      draftContent: "",
      generation: {
        attempt: 0,
        maxAttempts: task.maxAttempts,
        queuedAt,
        status: "queued",
        taskId: task.id,
      },
      loading: true,
      think_content: "",
    });
    this.emitTask(task);
    void this.processQueue();

    return task.id;
  }

  cancelAll() {
    for (const task of this.tasks.values()) {
      this.updateTask(task, {
        loading: false,
        draftContent: undefined,
        generation: { status: "failed", errorMessage: "已取消生成。" },
      });
      task.controller.abort();
    }
    this.queue.length = 0;
    this.tasks.clear();
  }

  private updateTask(
    task: GenerationTask,
    patch: Parameters<StudentInfoUpdater>[1],
  ) {
    if (task.controller.signal.aborted) return;
    if (task.update) task.update(patch);
    else this.updateStudentInfo(task.index, patch);
  }

  private storeTrace(trace: PromptTrace) {
    try {
      this.saveTrace(trace);
    } catch {
      /* 诊断记录不能中断反馈生成。 */
    }
  }

  private emitTask(task: GenerationTask) {
    this.onTaskChange?.(toSnapshot(task));
  }

  private async processQueue() {
    while (
      this.runningTasks < this.maxConcurrentTasks &&
      this.queue.length > 0
    ) {
      const task = this.queue.shift();
      if (!task) return;

      this.runningTasks += 1;
      void this.runTask(task).finally(() => {
        const key = task.contextPlan.student.id || String(task.index);
        if (this.tasks.get(key) === task) this.tasks.delete(key);
        this.runningTasks -= 1;
        void this.processQueue();
      });
    }
  }

  private async runTask(task: GenerationTask): Promise<void> {
    if (task.controller.signal.aborted) return;
    task.attempt += 1;
    task.startedAt = new Date().toISOString();
    task.status = task.attempt > 1 ? "retrying" : "running";

    const messages = buildStudentGenerationMessages({
      coursePromptContext: task.contextPlan.coursePromptContext,
      performanceText: task.contextPlan.performanceText,
      student: task.contextPlan.student,
      systemPrompt: task.systemPrompt,
    });

    task.trace = buildPromptTrace({
      blockedStudentNames: task.contextPlan.blockedStudentNames,
      contextPolicy: task.contextPlan.policy,
      coursePromptContext: task.contextPlan.coursePromptContext,
      messages,
      metadata: {
        attempt: task.attempt,
        model: this.aiClient.getModel(),
        promptRecipe: this.promptRecipe,
        provider: this.aiClient.getProvider(),
        taskId: task.id,
      },
      studentName: task.contextPlan.student.name,
    });
    // 完成后统一保存诊断记录。

    this.updateTask(task, (prevInfo) => ({
      ...prevInfo,
      generation: {
        ...prevInfo.generation,
        attempt: task.attempt,
        errorMessage: undefined,
        lastAttemptAt: task.startedAt,
        maxAttempts: task.maxAttempts,
        queuedAt: task.queuedAt,
        startedAt: task.startedAt,
        status: task.status === "retrying" ? "retrying" : "generating",
        taskId: task.id,
        trace: task.trace,
      },
      loading: true,
    }));
    this.emitTask(task);

    const result = await this.sendWithStream(task, messages);

    if (!result.ok) {
      await this.handleFailedAttempt(task, result.error);
      return;
    }

    this.handleSucceededAttempt(task, result.content, result.thinkContent);
  }

  private sendWithStream(
    task: GenerationTask,
    messages: ReturnType<typeof buildStudentGenerationMessages>,
  ) {
    return new Promise<
      | { content: string; ok: true; thinkContent: string }
      | { error: Error; ok: false }
    >((resolve) => {
      let content = "";
      let settled = false;
      let thinkContent = "";
      let timer: ReturnType<typeof setTimeout> | undefined;
      const flush = () => {
        timer = undefined;
        this.updateTask(task, {
          draftContent: content,
          think_content: thinkContent,
        });
      };
      const schedule = () => {
        timer ??= setTimeout(flush, 60);
      };

      const settle = (
        result:
          | { content: string; ok: true; thinkContent: string }
          | { error: Error; ok: false },
      ) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      task.controller.signal.addEventListener(
        "abort",
        () => settle({ ok: false, error: new RequestError("已取消生成。") }),
        { once: true },
      );
      try {
        const sendResult = this.aiClient.sendMessages({
          messages,
          signal: task.controller.signal,
          onContent: (nextContent, type) => {
            if (settled) return;

            if (type === "content") {
              content = nextContent;
              schedule();
              return;
            }

            if (type === "reasoning_content") {
              thinkContent = nextContent;
              schedule();
            }
          },
          onError: (error) => {
            settle({ error, ok: false });
          },
          onFinish: () => {
            settle({ content, ok: true, thinkContent });
          },
        });

        void Promise.resolve(sendResult).catch((error: unknown) => {
          settle({
            error:
              error instanceof Error
                ? error
                : new Error("生成失败，请稍后重试。"),
            ok: false,
          });
        });
      } catch (error) {
        settle({
          error:
            error instanceof Error
              ? error
              : new Error("生成失败，请稍后重试。"),
          ok: false,
        });
      }
    });
  }

  private async handleFailedAttempt(task: GenerationTask, error: Error) {
    if (task.controller.signal.aborted) return;
    const canRetry =
      task.attempt < task.maxAttempts &&
      (!(error instanceof RequestError) || error.retryable);
    const errorMessage = canRetry
      ? `${error.message} 正在重试。`
      : error.message;
    task.status = canRetry ? "retrying" : "failed";

    if (task.trace) {
      task.trace = completePromptTrace({
        errorMessage: error.message || errorMessage,
        status: canRetry ? "retrying" : "failed",
        trace: task.trace,
      });
      this.storeTrace(task.trace);
    }

    this.updateTask(task, (prevInfo) => ({
      ...prevInfo,
      generation: {
        ...prevInfo.generation,
        attempt: task.attempt,
        errorMessage,
        finishedAt: canRetry ? undefined : new Date().toISOString(),
        lastAttemptAt: new Date().toISOString(),
        maxAttempts: task.maxAttempts,
        status: canRetry ? "retrying" : "failed",
        taskId: task.id,
        trace: task.trace,
      },
      loading: canRetry,
      draftContent: undefined,
    }));
    this.emitTask(task);

    if (!canRetry) return;

    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        task.controller.signal.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(
        done,
        Math.max(
          this.retryDelayMs,
          error instanceof RequestError ? error.retryAfterMs : 0,
        ),
      );
      task.controller.signal.addEventListener("abort", done, { once: true });
    });
    await this.runTask(task);
  }

  private handleSucceededAttempt(
    task: GenerationTask,
    content: string,
    thinkContent: string,
  ) {
    task.status = "succeeded";

    this.updateTask(task, (prevInfo) => {
      const cleanedContent = cleanGeneratedFeedback(content);
      const quality = validateGeneratedFeedback({
        allowedStudentName: task.contextPlan.student.name,
        blockedStudentNames: task.contextPlan.blockedStudentNames,
        content: cleanedContent,
      });
      const status = quality.status === "pass" ? "ready" : "needs_review";

      if (task.trace) {
        task.trace = completePromptTrace({
          content: cleanedContent,
          finishedAt: new Date(quality.checkedAt),
          quality,
          status,
          thinkContent: thinkContent || prevInfo.think_content,
          trace: task.trace,
        });
        this.storeTrace(task.trace);
      }

      return {
        ...prevInfo,
        content: cleanedContent,
        previousContent: prevInfo.content || prevInfo.previousContent,
        draftContent: undefined,
        confirmed: false,
        copiedAt: undefined,
        generation: {
          ...prevInfo.generation,
          attempt: task.attempt,
          finishedAt: quality.checkedAt,
          lastAttemptAt: quality.checkedAt,
          maxAttempts: task.maxAttempts,
          quality,
          status,
          taskId: task.id,
          trace: task.trace,
        },
        loading: false,
        think_content: thinkContent || prevInfo.think_content,
      };
    });

    this.emitTask(task);
  }
}

export const createGenerationOrchestrator = (
  options: GenerationOrchestratorOptions,
) => new GenerationOrchestrator(options);
