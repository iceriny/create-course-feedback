import { statusLabel, type FeedbackStatus } from "../../domain/feedbackStatus";
import type { StudentBasicInfo } from "../../types";

export type RosterFilter = FeedbackStatus | "all" | "processing" | "uncopied";

export interface RosterEntry {
  student: StudentBasicInfo;
  index: number;
  status: FeedbackStatus;
  copied: boolean;
}

export const rosterFilters = [
  ["all", "全部学生"],
  ["unrecorded", statusLabel("unrecorded")],
  ["recorded", statusLabel("recorded")],
  ["processing", "处理中"],
  ["ready", statusLabel("ready")],
  ["needs_update", statusLabel("needs_update")],
  ["failed", statusLabel("failed")],
  ["confirmed", statusLabel("confirmed")],
  ["uncopied", "已确认 · 未复制"],
  ["inactive", statusLabel("inactive")],
] as const satisfies ReadonlyArray<readonly [RosterFilter, string]>;

export function isProcessingStatus(status: FeedbackStatus) {
  return (
    status === "queued" || status === "generating" || status === "retrying"
  );
}

export function matchesRosterFilter(entry: RosterEntry, filter: RosterFilter) {
  if (filter === "all") return true;
  if (filter === "processing") return isProcessingStatus(entry.status);
  if (filter === "uncopied")
    return entry.status === "confirmed" && !entry.copied;
  return entry.status === filter;
}

export function countRosterStatuses(entries: readonly RosterEntry[]) {
  const counts: Partial<Record<RosterFilter, number>> = { all: entries.length };
  for (const { status, copied } of entries) {
    counts[status] = (counts[status] ?? 0) + 1;
    if (isProcessingStatus(status))
      counts.processing = (counts.processing ?? 0) + 1;
    if (status === "confirmed" && !copied)
      counts.uncopied = (counts.uncopied ?? 0) + 1;
  }
  return counts;
}
