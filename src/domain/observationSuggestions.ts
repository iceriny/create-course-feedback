import { isLessonDraft } from "./lesson";
export interface ObservationRecord {
  studentId?: string;
  name: string;
  field: string;
  text: string;
  className: string;
}
export function textSimilarity(query: string, text: string) {
  const normalize = (v: string) => v.toLowerCase().replace(/[\s\p{P}]/gu, "");
  const q = normalize(query),
    t = normalize(text);
  if (!q) return 0;
  if (q === t) return 2;
  const a = new Set(q),
    b = new Set(t);
  const overlap = [...a].filter((c) => b.has(c)).length;
  return (t.includes(q) ? 1 : 0) + (2 * overlap) / (a.size + b.size);
}
export function rankSuggestions(texts: string[], query: string) {
  return [...new Set(texts.map((s) => s.trim()).filter(Boolean))]
    .filter((t) => t !== query.trim())
    .map((text, index) => ({ text, index, score: textSimilarity(query, text) }))
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .map((v) => v.text);
}
export function readObservationHistory(): ObservationRecord[] {
  const records: ObservationRecord[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (!key.startsWith("lessonArchive:") && !key.startsWith("lessonDraft:"))
      continue;
    try {
      const draft: unknown = JSON.parse(localStorage.getItem(key)!);
      if (!isLessonDraft(draft)) continue;
      draft.studentsList.forEach((student, index) =>
        Object.entries(draft.studentsInfo[index]?.performance || {}).forEach(
          ([field, text]) => {
            if (typeof text === "string" && text.trim())
              records.push({
                studentId: student.id,
                name: student.name,
                className: draft.activeClass,
                field,
                text,
              });
          },
        ),
      );
    } catch {
      /* 无法读取的课次不参与提示。 */
    }
  }
  return records;
}
