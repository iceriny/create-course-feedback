import { useCallback, useRef, useState } from "react";
import { getCourseIssues, lessonCourseContext } from "../../domain/course";
import {
  isFeedbackConfirmed,
  isFeedbackReviewable,
} from "../../domain/feedbackStatus";
import type { LessonDraft } from "../../domain/lesson";
import useOverlay from "../../motion/useOverlay";
import {
  buildStudentFeedbackMarkdown,
  getFeedbackTemplateIssues,
  toPlainText,
} from "../../services/feedback/feedbackTemplate";
import type { GenerationIssue } from "../../services/ai/workspaceGeneration";
import { useFeedbackStore } from "../../store/feedbackStore";
import { useRosterStore } from "../../store/rosterStore";

export type FeedbackCopyFormat = "plain" | "markdown";

type CopyEntry = {
  id: string;
  name: string;
  markdown: string;
  confirmed: boolean;
};

type CopyQueue = {
  ids: string[];
  index: number;
  direction: "forward" | "backward";
};

type Preview = {
  markdown: string;
  detail: string;
  lessonId?: string;
  entries?: CopyEntry[];
  singleId?: string;
  queue?: CopyQueue;
};

type CopyResult = "copied" | "unavailable" | "changed";
const formatKey = "feedbackCopyFormat";

function readFormat(): FeedbackCopyFormat {
  try {
    return localStorage.getItem(formatKey) === "markdown"
      ? "markdown"
      : "plain";
  } catch {
    return "plain";
  }
}

export function pendingFeedbackCopyIds() {
  const { studentsList, studentsInfo } = useRosterStore.getState();
  return studentsList.flatMap(({ id }, index) => {
    const info = studentsInfo[index];
    return id && isFeedbackConfirmed(info) && !info.copiedAt ? [id] : [];
  });
}

function readCopyContext() {
  const roster = useRosterStore.getState();
  const { activeClass, course } = roster;
  const { customTemplate, signature } = useFeedbackStore.getState();
  return {
    roster,
    courseContext: lessonCourseContext(activeClass, course),
    customTemplate,
    signature,
  };
}

function getCopyEntries(
  context: ReturnType<typeof readCopyContext>,
  ids: readonly string[],
): CopyEntry[] {
  const { roster, courseContext, customTemplate, signature } = context;
  if (!courseContext) return [];
  const byId = new Map<string, CopyEntry>();
  const wanted = new Set(ids);
  roster.studentsList.forEach((student, index) => {
    const info = roster.studentsInfo[index];
    if (!student.id || !wanted.has(student.id) || !isFeedbackReviewable(info))
      return;
    byId.set(student.id, {
      id: student.id,
      name: student.name,
      confirmed: isFeedbackConfirmed(info),
      markdown: buildStudentFeedbackMarkdown({
        courseContext,
        customTemplate,
        signature,
        student,
        studentInfo: info,
      }),
    });
  });
  return ids.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
}

function previewFor(
  entries: CopyEntry[],
  lessonId: string,
  singleId?: string,
  queue?: CopyQueue,
): Preview {
  return {
    markdown: singleId
      ? (entries[0]?.markdown ?? "")
      : entries.map((entry) => `${entry.markdown}\n\n---\n`).join(""),
    detail: singleId
      ? (entries[0]?.name ?? "")
      : `${entries.length} 份已确认反馈`,
    entries,
    lessonId,
    singleId,
    queue,
  };
}

function markCopied(preview: Preview) {
  if (!preview.entries?.length) return;
  const context = readCopyContext();
  if (context.roster.lessonId !== preview.lessonId) return;
  const original = new Map(preview.entries.map((entry) => [entry.id, entry]));
  const current = getCopyEntries(context, [...original.keys()]);
  const copiedAt = new Date().toISOString();
  const indices = new Map(
    context.roster.studentsList.map((student, index) => [student.id, index]),
  );
  for (const entry of current) {
    if (
      !entry.confirmed ||
      !original.get(entry.id)?.confirmed ||
      original.get(entry.id)?.markdown !== entry.markdown
    )
      continue;
    const index = indices.get(entry.id);
    if (index !== undefined)
      context.roster.updateStudentInfo(index, { copiedAt });
  }
}

export default function useFeedbackCopyFlow({
  sendMessage,
  sendWarning,
  fixIssue,
  openTemplate,
}: {
  sendMessage: (message: string) => void;
  sendWarning: (message: string) => void;
  fixIssue: (issue: GenerationIssue) => void;
  openTemplate: () => void;
}) {
  const dialog = useOverlay<Preview>();
  const { show, close } = dialog;
  const [format, updateFormat] = useState(readFormat);
  const writing = useRef(false);

  const setFormat = useCallback((next: FeedbackCopyFormat) => {
    updateFormat(next);
    try {
      localStorage.setItem(formatKey, next);
    } catch {
      // The format still applies within the current session.
    }
  }, []);

  const prepare = useCallback(
    (context = readCopyContext(), dismissPreview = false) => {
      const issue = getCourseIssues(context.roster.course)[0];
      if (issue) {
        if (dismissPreview) close();
        sendWarning(`复制前请先${issue.message}。`);
        fixIssue({ ...issue, section: "course" });
        return;
      }
      const templateIssue = getFeedbackTemplateIssues(
        context.customTemplate,
      )[0];
      if (templateIssue) {
        if (dismissPreview) close();
        sendWarning(templateIssue);
        openTemplate();
        return;
      }
      if (context.courseContext) return context;
    },
    [close, fixIssue, openTemplate, sendWarning],
  );

  const showPreview = useCallback(
    (studentId?: string) => {
      const context = prepare();
      if (!context) return;
      const ids = studentId
        ? [studentId]
        : context.roster.studentsList.flatMap(({ id }, index) =>
            id && isFeedbackConfirmed(context.roster.studentsInfo[index])
              ? [id]
              : [],
          );
      const entries = getCopyEntries(context, ids);
      if (entries.length)
        show(previewFor(entries, context.roster.lessonId, studentId));
    },
    [prepare, show],
  );

  const openQueueEntry = (
    context: ReturnType<typeof readCopyContext>,
    ids: string[],
    start: number,
    direction: CopyQueue["direction"],
  ) => {
    const step = direction === "forward" ? 1 : -1;
    for (let index = start; index >= 0 && index < ids.length; index += step) {
      const [entry] = getCopyEntries(context, [ids[index]]);
      if (!entry?.confirmed) continue;
      show(
        previewFor([entry], context.roster.lessonId, entry.id, {
          ids,
          index,
          direction,
        }),
      );
      return true;
    }
    return false;
  };

  const startQueue = () => {
    const ids = pendingFeedbackCopyIds();
    if (!ids.length) return;
    const context = prepare();
    if (context) openQueueEntry(context, ids, 0, "forward");
  };

  const moveQueue = (preview: Preview, direction: CopyQueue["direction"]) => {
    const { queue } = preview;
    if (!queue) return false;
    const context = readCopyContext();
    if (context.roster.lessonId !== preview.lessonId) {
      close();
      return false;
    }
    if (!prepare(context, true)) return false;
    const next = queue.index + (direction === "forward" ? 1 : -1);
    const advanced = openQueueEntry(context, queue.ids, next, direction);
    if (!advanced && direction === "forward") close();
    return advanced;
  };

  const write = useCallback(
    async (preview: Preview): Promise<CopyResult> => {
      if (writing.current) return "changed";
      if (preview.entries) {
        const context = readCopyContext();
        if (context.roster.lessonId !== preview.lessonId) {
          close();
          sendWarning("课次已切换，请重新选择反馈。");
          return "changed";
        }
        if (!prepare(context, true)) return "changed";
        const current = getCopyEntries(
          context,
          preview.entries.map(({ id }) => id),
        ).filter(
          (entry) =>
            Boolean(preview.singleId && !preview.queue) || entry.confirmed,
        );
        if (
          current.length !== preview.entries.length ||
          current.some(
            (entry, index) =>
              entry.markdown !== preview.entries?.[index].markdown ||
              entry.confirmed !== preview.entries?.[index].confirmed,
          )
        ) {
          if (current.length)
            show(
              previewFor(
                current,
                context.roster.lessonId,
                preview.singleId,
                preview.queue,
              ),
            );
          else close();
          sendWarning("反馈内容或状态已变化，请重新核对。");
          return "changed";
        }
      }
      writing.current = true;
      try {
        const text =
          format === "plain" ? toPlainText(preview.markdown) : preview.markdown;
        await navigator.clipboard.writeText(text);
        markCopied(preview);
        return "copied";
      } catch {
        return "unavailable";
      } finally {
        writing.current = false;
      }
    },
    [close, format, prepare, sendWarning, show],
  );

  const copyStudent = useCallback(
    async (studentId: string) => {
      const context = prepare();
      if (!context) return false;
      const entries = getCopyEntries(context, [studentId]).filter(
        (entry) => entry.confirmed,
      );
      if (!entries.length) return false;
      const preview = previewFor(entries, context.roster.lessonId, studentId);
      const result = await write(preview);
      if (
        result === "unavailable" &&
        useRosterStore.getState().lessonId === preview.lessonId
      ) {
        showPreview(studentId);
        sendWarning("无法写入剪贴板，可以在预览中手动复制。");
      }
      return result === "copied";
    },
    [prepare, sendWarning, showPreview, write],
  );

  const showArchived = (draft: LessonDraft, index: number) => {
    const student = draft.studentsList[index];
    const info = draft.studentsInfo[index];
    const courseContext = lessonCourseContext(draft.activeClass, draft.course);
    const { customTemplate, signature } = useFeedbackStore.getState();
    const issue = courseContext && getFeedbackTemplateIssues(customTemplate)[0];
    if (issue) {
      sendWarning(issue);
      return false;
    }
    show({
      markdown: courseContext
        ? buildStudentFeedbackMarkdown({
            courseContext,
            customTemplate,
            signature,
            student,
            studentInfo: info,
          })
        : `### ${student.name}\n${info.content}`,
      detail: `${student.name} · ${draft.course.name || "未命名课程"}`,
    });
    return true;
  };

  const copyPreview = async (advance: boolean) => {
    const preview = dialog.overlay?.content;
    if (!preview || !dialog.overlay?.open) return "changed";
    const result = await write(preview);
    if (result === "copied" && (!advance || !moveQueue(preview, "forward")))
      sendMessage("已复制反馈。");
    return result;
  };

  return {
    dialog,
    format,
    setFormat,
    showPreview,
    startQueue,
    copyStudent,
    showArchived,
    copyPreview,
    moveQueue,
  };
}
