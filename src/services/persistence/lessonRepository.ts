import { isLessonDraft, type LessonDraft } from "../../domain/lesson";
import { listStorageKeys, readStorageJson } from "./localStorageRepository";
import { getRosterStorageKey } from "./rosterRepository";

function readLessons(prefix: string) {
  return listStorageKeys()
    .filter((key) => key.startsWith(prefix))
    .map((key) => readStorageJson<unknown>(key, null))
    .filter(isLessonDraft);
}

const recentFirst = (a: LessonDraft, b: LessonDraft) =>
  b.course.start.localeCompare(a.course.start);

export function readArchivedLessons(className: string) {
  return readLessons("lessonArchive:")
    .filter((draft) => draft.activeClass === className)
    .sort(recentFirst);
}

export function readReusableLessons(currentLessonId: string) {
  const lessons = new Map(
    [...readLessons("lessonArchive:"), ...readLessons("lessonDraft:")].map(
      (draft) => [draft.lessonId, draft],
    ),
  );
  lessons.delete(currentLessonId);
  return [...lessons.values()]
    .filter((draft) => draft.course.name.trim())
    .sort(recentFirst);
}

export function createLessonBackup(draft: LessonDraft) {
  return {
    version: 1 as const,
    local: {
      [`lessonDraft:${draft.activeClass}`]: JSON.stringify(draft),
      [getRosterStorageKey(draft.activeClass)]: JSON.stringify(
        draft.studentsList,
      ),
      "class-name": JSON.stringify([draft.activeClass]),
      lastActiveClass: draft.activeClass,
    },
    indexed: {},
  };
}
