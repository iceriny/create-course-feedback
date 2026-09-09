import type { StudentBasicInfo, StudentsInfo } from "../types";

export interface LessonCourse {
  name: string;
  start: string;
  end: string;
  contents: string;
  objectives: string;
}
export interface LessonDraft {
  lessonId: string;
  activeClass: string;
  course: LessonCourse;
  studentsList: StudentBasicInfo[];
  studentsInfo: Record<number, StudentsInfo>;
}
export function isLessonDraft(value: unknown): value is LessonDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as LessonDraft;
  return (
    typeof draft.lessonId === "string" &&
    Boolean(draft.lessonId) &&
    typeof draft.activeClass === "string" &&
    Boolean(draft.activeClass) &&
    Boolean(draft.course) &&
    ["name", "start", "end", "contents", "objectives"].every(
      (key) => typeof draft.course[key as keyof LessonCourse] === "string",
    ) &&
    Array.isArray(draft.studentsList) &&
    Boolean(draft.studentsInfo) &&
    draft.studentsList.every((student, index) => {
      const info = draft.studentsInfo[index];
      return (
        student &&
        typeof student.name === "string" &&
        ["male", "female"].includes(student.gender) &&
        ["v1", "v2"].includes(student.version) &&
        info &&
        typeof info.content === "string" &&
        typeof info.activated === "boolean" &&
        typeof info.loading === "boolean" &&
        (!info.performance ||
          Object.values(info.performance).every(
            (item) => typeof item === "string",
          ))
      );
    })
  );
}
