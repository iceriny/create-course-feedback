import {
  isLessonDraft,
  type LessonCourse,
  type LessonDraft,
} from "../domain/lesson";
import { create } from "zustand";

import type {
  StudentBasicInfo,
  StudentContentPropsVersion,
  StudentsInfo,
} from "../types";
import { markFeedbackForUpdate } from "../domain/feedbackStatus";
import {
  createStudentsFromNames,
  createStudentsInfo,
  DEFAULT_STUDENT_VERSION,
  parseStudentNamesInput,
  sortStudentsAndInfoByName,
  withObservationFormat,
} from "../domain/student";
import {
  readRosterStudents,
  writeRosterStudents,
} from "../services/persistence/rosterRepository";

type StudentInfoPatch =
  | Partial<StudentsInfo>
  | ((prev: StudentsInfo) => StudentsInfo);

export type { LessonCourse, LessonDraft } from "../domain/lesson";
interface RosterStore extends LessonDraft {
  saveStatus: "saved" | "saving" | "error" | "conflict";
  defaultStudentVersion: StudentContentPropsVersion;
  setCourse: (course: Partial<LessonCourse>) => void;
  newLesson: () => boolean;
  restoreLesson: (draft: LessonDraft) => boolean;
  setDefaultStudentVersion: (version: StudentContentPropsVersion) => void;
  applyDefaultStudentVersion: () => void;
  renameStudent: (index: number, name: string) => void;
  removeStudent: (index: number) => void;
  studentsInfo: Record<number, StudentsInfo>;
  studentsList: StudentBasicInfo[];
  clearAllStudents: () => void;
  getActivatedStudentsCount: () => { activated: number; total: number };
  getStudentNames: () => string[];
  initializeStudentsInfo: (students: StudentBasicInfo[]) => void;
  loadStudentsFromStorage: (className: string) => boolean;
  resetRosterState: () => void;
  sortStudentsByName: () => void;
  toggleAllStudentsActivation: () => void;
  toggleStudentActivation: (index: number) => void;
  updateStudentGender: (
    index: number,
    gender: StudentBasicInfo["gender"],
  ) => void;
  updateStudentInfo: (index: number, info: StudentInfoPatch) => void;
  updateStudentVersion: (
    index: number,
    version: StudentBasicInfo["version"],
  ) => void;
  updateStudentsFromRawValues: (rawValues: string[], className: string) => void;
}

const emptyCourse: LessonCourse = {
  name: "",
  start: "",
  end: "",
  contents: "",
  objectives: "",
};
const identify = (students: StudentBasicInfo[]) =>
  students.map((student) => ({
    ...student,
    id: student.id || crypto.randomUUID(),
  }));
const emptyRosterState = {
  lessonId: "",
  activeClass: "",
  course: emptyCourse,
  studentsInfo: {},
  studentsList: [],
  defaultStudentVersion: DEFAULT_STUDENT_VERSION,
};

const changeObservationFormat = (
  info: StudentsInfo,
  version: StudentContentPropsVersion,
) => ({
  ...markFeedbackForUpdate(info, "observation"),
  performance: withObservationFormat(info, version),
});

function reviveStudentInfo(info: StudentsInfo): StudentsInfo {
  return {
    ...info,
    draftContent: undefined,
    loading: false,
    generation: info.loading
      ? {
          ...info.generation,
          status: "failed",
          errorMessage: "上次生成已中断，可以重新生成。",
        }
      : info.generation,
  };
}

export const useRosterStore = create<RosterStore>((set, get) => ({
  ...emptyRosterState,
  saveStatus: "saved",
  setCourse: (patch) =>
    set((state) => {
      const fields = Object.keys(patch) as (keyof LessonCourse)[];
      if (fields.every((field) => patch[field] === state.course[field]))
        return state;

      const course = { ...state.course, ...patch };
      const normalize = (value: string) =>
        value
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .join("\n");
      const changed = fields.some(
        (field) => normalize(course[field]) !== normalize(state.course[field]),
      );
      return {
        course,
        studentsInfo: changed
          ? Object.fromEntries(
              Object.entries(state.studentsInfo).map(([key, info]) => [
                key,
                markFeedbackForUpdate(info, "course"),
              ]),
            )
          : state.studentsInfo,
      };
    }),
  newLesson: () => {
    if (!archiveCurrentLesson()) return false;
    const state = get();
    set({
      lessonId: crypto.randomUUID(),
      course: { ...emptyCourse },
      studentsInfo: createStudentsInfo(state.studentsList),
    });
    return true;
  },
  restoreLesson: (draft) => {
    const current = get();
    if (
      !isLessonDraft(draft) ||
      draft.activeClass !== current.activeClass ||
      draft.lessonId === current.lessonId ||
      !archiveCurrentLesson()
    )
      return false;
    set({
      ...draft,
      defaultStudentVersion: current.defaultStudentVersion,
      studentsList: identify(draft.studentsList),
      studentsInfo: Object.fromEntries(
        Object.entries(draft.studentsInfo).map(([key, info]) => [
          key,
          reviveStudentInfo(info),
        ]),
      ),
    });
    return true;
  },
  setDefaultStudentVersion: (defaultStudentVersion) =>
    set({ defaultStudentVersion }),
  applyDefaultStudentVersion: () =>
    set((state) => {
      const version = state.defaultStudentVersion;
      if (state.studentsList.every((student) => student.version === version))
        return state;
      return {
        studentsList: state.studentsList.map((student) =>
          student.version === version ? student : { ...student, version },
        ),
        studentsInfo: Object.fromEntries(
          state.studentsList.map((student, index) => [
            index,
            student.version === version
              ? state.studentsInfo[index]
              : changeObservationFormat(state.studentsInfo[index], version),
          ]),
        ),
      };
    }),
  renameStudent: (index, name) => {
    name = name.trim();
    const student = get().studentsList[index];
    if (!student || !name || student.name === name) return;
    set((state) => ({
      studentsList: state.studentsList.map((s, i) =>
        i === index ? { ...s, name } : s,
      ),
      studentsInfo: {
        ...state.studentsInfo,
        [index]: {
          ...markFeedbackForUpdate(state.studentsInfo[index], "student"),
          name,
        },
      },
    }));
  },
  removeStudent: (index) =>
    set((state) => ({
      studentsList: state.studentsList.filter((_, i) => i !== index),
      studentsInfo: Object.fromEntries(
        state.studentsList.flatMap((_, i) =>
          i === index ? [] : [[i > index ? i - 1 : i, state.studentsInfo[i]]],
        ),
      ),
    })),

  clearAllStudents: () => {
    get().resetRosterState();
  },

  getActivatedStudentsCount: () => {
    const { studentsInfo, studentsList } = get();
    const activated = Object.values(studentsInfo).filter(
      (info) => info.activated,
    ).length;
    return { activated, total: studentsList.length };
  },

  getStudentNames: () => get().studentsList.map((student) => student.name),

  initializeStudentsInfo: (students) => {
    set({ studentsInfo: createStudentsInfo(students) });
  },

  loadStudentsFromStorage: (className) => {
    className = className.trim();
    if (!className) return false;
    if (className === get().activeClass) return true;
    return flushLessonDraft() && hydrateLesson(className);
  },

  resetRosterState: () => {
    clearTimeout(saveTimer);
    storedDraft = null;
    cleanSnapshot = undefined;
    draftPending = false;
    set({ ...emptyRosterState, saveStatus: "saved" });
  },

  sortStudentsByName: () => {
    const { studentsInfo, studentsList } = get();
    const { sortedInfo, sortedStudents } = sortStudentsAndInfoByName(
      studentsList,
      studentsInfo,
    );

    set({ studentsInfo: sortedInfo, studentsList: sortedStudents });
  },

  toggleAllStudentsActivation: () => {
    set((state) => ({
      studentsInfo: Object.fromEntries(
        Object.entries(state.studentsInfo).map(([key, info]) => [
          key,
          { ...info, activated: !info.activated },
        ]),
      ) as Record<number, StudentsInfo>,
    }));
  },

  toggleStudentActivation: (index) => {
    set((state) => {
      const currentInfo = state.studentsInfo[index];
      if (!currentInfo) return state;

      return {
        studentsInfo: {
          ...state.studentsInfo,
          [index]: {
            ...currentInfo,
            activated: !currentInfo.activated,
          },
        },
      };
    });
  },

  updateStudentGender: (index, gender) =>
    set((state) => {
      const student = state.studentsList[index];
      if (!student || student.gender === gender) return state;
      return {
        studentsList: state.studentsList.map((entry, i) =>
          i === index ? { ...entry, gender } : entry,
        ),
        studentsInfo: {
          ...state.studentsInfo,
          [index]: markFeedbackForUpdate(state.studentsInfo[index], "student"),
        },
      };
    }),

  updateStudentInfo: (index, info) => {
    set((state) => {
      const currentInfo = state.studentsInfo[index];
      if (!currentInfo) return state;

      const updatedInfo =
        typeof info === "function"
          ? info(currentInfo)
          : { ...currentInfo, ...info };

      return {
        studentsInfo: {
          ...state.studentsInfo,
          [index]: updatedInfo,
        },
      };
    });
  },

  updateStudentVersion: (index, version) =>
    set((state) => {
      const student = state.studentsList[index];
      if (!student || student.version === version) return state;
      return {
        studentsList: state.studentsList.map((entry, i) =>
          i === index ? { ...entry, version } : entry,
        ),
        studentsInfo: {
          ...state.studentsInfo,
          [index]: changeObservationFormat(state.studentsInfo[index], version),
        },
      };
    }),

  updateStudentsFromRawValues: (rawValues, className) => {
    className = className.trim();
    if (!className) {
      throw new Error("班级名不能为空！");
    }

    const names = parseStudentNamesInput(rawValues);
    if (
      className !== get().activeClass &&
      !get().loadStudentsFromStorage(className)
    )
      return;
    const previous = get();
    const remaining = previous.studentsList.map((student, index) => ({
      student,
      info: previous.studentsInfo[index],
    }));
    const pairs = names.map((name) => {
      const match = remaining.findIndex((item) => item.student.name === name);
      if (match >= 0) return remaining.splice(match, 1)[0];
      const [student] = createStudentsFromNames(
        [name],
        previous.defaultStudentVersion,
      );
      return { student, info: createStudentsInfo([student])[0] };
    });
    const students = identify(pairs.map((item) => item.student));
    set({
      activeClass: className,
      lessonId: previous.lessonId || crypto.randomUUID(),
      studentsInfo: Object.fromEntries(
        pairs.map((item, index) => [index, item.info]),
      ),
      studentsList: students,
    });
  },
}));

const toDraft = (state: RosterStore): LessonDraft => ({
  activeClass: state.activeClass,
  lessonId: state.lessonId,
  course: state.course,
  studentsList: state.studentsList,
  defaultStudentVersion: state.defaultStudentVersion,
  studentsInfo: Object.fromEntries(
    Object.entries(state.studentsInfo).map(([key, info]) => [
      key,
      {
        ...info,
        draftContent: undefined,
        think_content: "",
        generation: info.generation
          ? { ...info.generation, trace: undefined }
          : undefined,
      },
    ]),
  ),
});
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let storedDraft: string | null = null;
let cleanSnapshot: string | undefined;
let draftPending = false;
let hydrating = false;
let savingPaused = false;

export function getCurrentLessonDraft() {
  const state = useRosterStore.getState();
  return state.activeClass ? toDraft(state) : undefined;
}

export function pauseLessonDraftSaving() {
  savingPaused = true;
  clearTimeout(saveTimer);
  return () => {
    savingPaused = false;
    if (draftPending) scheduleSave();
  };
}

function hydrateLesson(className: string): boolean {
  try {
    const raw = localStorage.getItem(`lessonDraft:${className}`);
    const draft: unknown = raw ? JSON.parse(raw) : undefined;
    if (raw && (!isLessonDraft(draft) || draft.activeClass !== className))
      throw new Error("invalid draft");
    const saved = draft as LessonDraft | undefined;
    const students = identify(
      saved?.studentsList ?? readRosterStudents(className),
    );
    const infos = saved?.studentsInfo ?? createStudentsInfo(students);
    const updated = {
      activeClass: className,
      lessonId: saved?.lessonId ?? crypto.randomUUID(),
      course: saved?.course ?? { ...emptyCourse },
      studentsList: students,
      defaultStudentVersion:
        saved?.defaultStudentVersion ?? DEFAULT_STUDENT_VERSION,
      studentsInfo: Object.fromEntries(
        students.map((_, index) => [index, reviveStudentInfo(infos[index])]),
      ),
    };
    // Navigation records the selected class once. Loading a draft leaves its
    // stored version untouched until this tab edits it.
    if (localStorage.getItem("lastActiveClass") !== className)
      localStorage.setItem("lastActiveClass", className);
    clearTimeout(saveTimer);
    storedDraft = raw;
    draftPending = false;
    hydrating = true;
    useRosterStore.setState({ ...updated, saveStatus: "saved" });
    hydrating = false;
    cleanSnapshot = saved
      ? JSON.stringify(toDraft(useRosterStore.getState()))
      : undefined;
    if (!saved) scheduleSave();
    return true;
  } catch {
    hydrating = false;
    useRosterStore.setState({ saveStatus: "error" });
    return false;
  }
}

export function loadLatestLessonDraft() {
  const { activeClass } = useRosterStore.getState();
  return Boolean(activeClass && hydrateLesson(activeClass));
}

function archiveCurrentLesson() {
  const draft = getCurrentLessonDraft();
  if (!draft || !flushLessonDraft()) return false;
  try {
    if (
      localStorage.getItem(`lessonDraft:${draft.activeClass}`) !== storedDraft
    ) {
      useRosterStore.setState({ saveStatus: "conflict" });
      return false;
    }
    const { course, studentsInfo } = draft;
    if (
      [course.name, course.contents, course.objectives].some((value) =>
        value.trim(),
      ) ||
      Object.values(studentsInfo).some(
        (info) =>
          info.content.trim() ||
          Object.values(info.performance ?? {}).some((value) => value.trim()),
      )
    )
      localStorage.setItem(
        `lessonArchive:${draft.lessonId}`,
        JSON.stringify(draft),
      );
    return true;
  } catch {
    useRosterStore.setState({ saveStatus: "error" });
    return false;
  }
}

export function flushLessonDraft(): boolean {
  clearTimeout(saveTimer);
  const state = useRosterStore.getState();
  if (savingPaused || !state.activeClass || !draftPending) return true;
  try {
    const serialized = JSON.stringify(toDraft(state));
    if (serialized !== cleanSnapshot) {
      const key = `lessonDraft:${state.activeClass}`;
      const current = localStorage.getItem(key);
      if (current !== storedDraft && current !== serialized) {
        useRosterStore.setState({ saveStatus: "conflict" });
        return false;
      }
      if (current !== serialized) localStorage.setItem(key, serialized);
      storedDraft = serialized;
      writeRosterStudents(state.activeClass, state.studentsList);
    }
    const classes = JSON.parse(
      localStorage.getItem("class-name") || "[]",
    ) as string[];
    if (!classes.includes(state.activeClass))
      localStorage.setItem(
        "class-name",
        JSON.stringify([...classes, state.activeClass]),
      );
    cleanSnapshot = serialized;
    draftPending = false;
    useRosterStore.setState({ saveStatus: "saved" });
    return true;
  } catch {
    useRosterStore.setState({ saveStatus: "error" });
    return false;
  }
}
function scheduleSave() {
  draftPending = true;
  if (savingPaused) return;
  if (useRosterStore.getState().saveStatus !== "conflict")
    useRosterStore.setState({ saveStatus: "saving" });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushLessonDraft, 300);
}
useRosterStore.subscribe((state, previous) => {
  if (
    hydrating ||
    !state.activeClass ||
    (state.course === previous.course &&
      state.studentsList === previous.studentsList &&
      state.studentsInfo === previous.studentsInfo &&
      state.lessonId === previous.lessonId &&
      state.defaultStudentVersion === previous.defaultStudentVersion)
  )
    return;
  scheduleSave();
});
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushLessonDraft);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushLessonDraft();
  });
}
