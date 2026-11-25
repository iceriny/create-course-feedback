import type { StudentBasicInfo, StudentsInfo } from "../types";
import { hasObservation } from "./student";

const labels = {
  inactive: "本次不参与",
  unrecorded: "待记录",
  recorded: "可生成",
  queued: "排队中",
  generating: "生成中",
  retrying: "重试中",
  failed: "需重试",
  needs_update: "待更新",
  ready: "待校对",
  confirmed: "已确认",
};

export type FeedbackStatus = keyof typeof labels;
export const statusLabel = (status: FeedbackStatus) => labels[status];

const inProgress = (info: StudentsInfo) => {
  const status = info.generation?.status;
  if (status === "queued" || status === "retrying") return status;
  if (status === "generating" || info.loading) return "generating";
};

export const isFeedbackReviewable = (info?: StudentsInfo) =>
  Boolean(
    info?.activated &&
      info.content.trim() &&
      !inProgress(info) &&
      info.generation?.status !== "failed" &&
      !info.feedbackNeedsUpdate,
  );

export const isFeedbackConfirmed = (info?: StudentsInfo) =>
  Boolean(info?.confirmed && isFeedbackReviewable(info));

export function feedbackStatus(
  student: StudentBasicInfo,
  info: StudentsInfo,
): FeedbackStatus {
  if (!info.activated) return "inactive";
  const processing = inProgress(info);
  if (processing) return processing;
  if (info.generation?.status === "failed") return "failed";
  if (info.feedbackNeedsUpdate && info.content.trim()) return "needs_update";
  if (isFeedbackConfirmed(info)) return "confirmed";
  if (info.content.trim()) return "ready";
  return hasObservation(student, info) ? "recorded" : "unrecorded";
}

export function canGenerateFeedback(
  student: StudentBasicInfo,
  info: StudentsInfo,
) {
  return info.activated && !inProgress(info) && hasObservation(student, info);
}

export function isBatchGenerationCandidate(
  student: StudentBasicInfo,
  info: StudentsInfo,
) {
  return (
    canGenerateFeedback(student, info) &&
    (!info.content.trim() ||
      Boolean(info.feedbackNeedsUpdate) ||
      info.generation?.status === "failed")
  );
}

export function markFeedbackForUpdate(
  info: StudentsInfo,
  reason: NonNullable<StudentsInfo["feedbackNeedsUpdate"]>,
): StudentsInfo {
  if (!info.loading && !info.content.trim()) return info;
  if (info.feedbackNeedsUpdate === reason && !info.confirmed && !info.copiedAt)
    return info;
  return {
    ...info,
    feedbackNeedsUpdate: reason,
    previousFeedbackNeedsUpdate: info.previousContent
      ? (info.previousFeedbackNeedsUpdate ?? reason)
      : undefined,
    confirmed: false,
    copiedAt: undefined,
  };
}
