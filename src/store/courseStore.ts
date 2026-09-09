import type { CourseTemplateContext } from "../domain/course";
import type { HistorysType } from "../types";
import {
  addCourseContextToHistory,
  buildClassTimeFromCourseContext,
  migrateCourseHistory,
  parseStoredClassTime,
  removeCourseHistoryItem,
} from "../services/course/courseHistory";
import {
  readStorageJson,
  readStorageString,
  writeStorageJson,
} from "../services/persistence/localStorageRepository";
import { create } from "zustand";

interface CourseStore {
  classList: string[];
  history: HistorysType;
  hydrateCourseState: () => { migrated: boolean };
  readStoredClassTime: (className: string) => ReturnType<
    typeof parseStoredClassTime
  >;
  removeHistoryItem: (key: string) => void;
  saveCourseContext: (courseContext: CourseTemplateContext) => void;
  setHistory: (history: HistorysType) => void;
}

const CLASS_LIST_KEY = "class-name";
const CLASS_HISTORY_KEY = "class-history";

const readClassList = () => {
  const value = readStorageJson<unknown>(CLASS_LIST_KEY, []);
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
};

export const useCourseStore = create<CourseStore>((set, get) => ({
  classList: [],
  history: {},

  hydrateCourseState: () => {
    const rawHistory = readStorageJson<unknown>(CLASS_HISTORY_KEY, {});
    const { history, migrated } = migrateCourseHistory(rawHistory);

    if (migrated) {
      writeStorageJson(CLASS_HISTORY_KEY, history);
    }

    set({
      classList: readClassList(),
      history,
    });

    return { migrated };
  },

  readStoredClassTime: (className) => {
    return parseStoredClassTime(readStorageString(className.trim()));
  },

  removeHistoryItem: (key) => {
    const history = removeCourseHistoryItem(get().history, key);
    set({ history });
    writeStorageJson(CLASS_HISTORY_KEY, history);
  },

  saveCourseContext: (courseContext) => {
    writeStorageJson(
      courseContext.className,
      buildClassTimeFromCourseContext(courseContext),
    );

    const classList = readClassList();
    const nextClassList = classList.includes(courseContext.className)
      ? classList
      : [...classList, courseContext.className];
    writeStorageJson(CLASS_LIST_KEY, nextClassList);

    const history = addCourseContextToHistory(get().history, courseContext);
    writeStorageJson(CLASS_HISTORY_KEY, history);
    set({ classList: nextClassList, history });
  },

  setHistory: (history) => {
    set({ history });
    writeStorageJson(CLASS_HISTORY_KEY, history);
  },
}));
