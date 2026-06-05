import type { PromptTrace } from "../../domain/ai";
import {
  readStorageJson,
  writeStorageJson,
  type KeyValueStorage,
} from "./localStorageRepository";

export const PROMPT_TRACES_KEY = "promptTraces";
export const DEFAULT_PROMPT_TRACE_LIMIT = 50;

export const readPromptTraces = (
  storage?: KeyValueStorage,
): PromptTrace[] => {
  const traces = readStorageJson<unknown[]>(PROMPT_TRACES_KEY, [], storage);
  return traces.filter((trace): trace is PromptTrace =>
    Boolean(
      trace &&
        typeof trace === "object" &&
        "id" in trace &&
        typeof trace.id === "string" &&
        "createdAt" in trace &&
        typeof trace.createdAt === "string" &&
        "studentName" in trace &&
        typeof trace.studentName === "string" &&
        "messages" in trace &&
        Array.isArray(trace.messages),
    ),
  );
};

export const savePromptTrace = (
  trace: PromptTrace,
  options: {
    limit?: number;
    storage?: KeyValueStorage;
  } = {},
) => {
  const limit = options.limit ?? DEFAULT_PROMPT_TRACE_LIMIT;
  const traces = [
    trace,
    ...readPromptTraces(options.storage).filter((item) => item.id !== trace.id),
  ].slice(0, limit);

  writeStorageJson(PROMPT_TRACES_KEY, traces, options.storage);
};
