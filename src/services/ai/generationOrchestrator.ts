import { v4 as uuidv4 } from "uuid";

import type { StudentsInfo } from "../../components/types";
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
}

const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_MAX_CONCURRENT_TASKS = 3;
const DEFAULT_RETRY_DELAY_MS = 800;

const getFailedMessage = (attempt: number, maxAttempts: number) =>
  attempt < maxAttempts ? "生成失败，正在重试。" : "生成失败，请稍后重试。";

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
  }: QueueStudentGenerationInput) {
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
    };

    this.queue.push(task);
    this.updateStudentInfo(index, {
      content: "",
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
        this.runningTasks -= 1;
        void this.processQueue();
      });
    }
  }

  private async runTask(task: GenerationTask): Promise<void> {
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
    this.saveTrace(task.trace);

    this.updateStudentInfo(task.index, (prevInfo) => ({
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

      const settle = (
        result:
          | { content: string; ok: true; thinkContent: string }
          | { error: Error; ok: false },
      ) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      try {
        const sendResult = this.aiClient.sendMessages({
          messages,
          onContent: (nextContent, type) => {
            if (settled) return;

            if (type === "content") {
              content = nextContent;
              this.updateStudentInfo(task.index, { content });
              return;
            }

            if (type === "reasoning_content") {
              thinkContent = nextContent;
              this.updateStudentInfo(task.index, {
                think_content: thinkContent,
              });
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
    const errorMessage = getFailedMessage(task.attempt, task.maxAttempts);
    const canRetry = task.attempt < task.maxAttempts;
    task.status = canRetry ? "retrying" : "failed";

    if (task.trace) {
      task.trace = completePromptTrace({
        errorMessage: error.message || errorMessage,
        status: canRetry ? "retrying" : "failed",
        trace: task.trace,
      });
      this.saveTrace(task.trace);
    }

    this.updateStudentInfo(task.index, (prevInfo) => ({
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
    }));
    this.emitTask(task);

    if (!canRetry) return;

    await new Promise((resolve) =>
      globalThis.setTimeout(resolve, this.retryDelayMs),
    );
    await this.runTask(task);
  }

  private handleSucceededAttempt(
    task: GenerationTask,
    content: string,
    thinkContent: string,
  ) {
    task.status = "succeeded";

    this.updateStudentInfo(task.index, (prevInfo) => {
      const cleanedContent = cleanGeneratedFeedback(content || prevInfo.content);
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
        this.saveTrace(task.trace);
      }

      return {
        ...prevInfo,
        content: cleanedContent,
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
