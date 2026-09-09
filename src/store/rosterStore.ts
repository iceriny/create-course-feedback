import {
  isLessonDraft,
  type LessonCourse,
  type LessonDraft,
} from "../domain/lesson";
import { create } from "zustand";

import type { StudentBasicInfo, StudentsInfo } from "../types";
import {
  createStudentsInfo,
  parseStudentNamesInput,
  sortStudentsAndInfoByName,
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
  saveStatus: "saved" | "saving" | "error";
  setCourse: (course: Partial<LessonCourse>) => void;
  newLesson: () => void;
  restoreLesson: (draft: LessonDraft) => void;
  renameStudent: (index: number, name: string) => void;
  removeStudent: (index: number) => void;
  studentsInfo: Record<number, StudentsInfo>;
  studentsList: StudentBasicInfo[];
  clearAllStudents: () => void;
  getActivatedStudentsCount: () => { activated: number; total: number };
  getStudentNames: () => string[];
  initializeStudentsInfo: (students: StudentBasicInfo[]) => void;
  loadStudentsFromStorage: (className: string) => void;
  resetRosterState: () => void;
  sortStudentsByName: (className: string) => void;
  toggleAllStudentsActivation: () => void;
  toggleStudentActivation: (index: number) => void;
  updateStudentGender: (
    index: number,
    gender: StudentBasicInfo["gender"],
    className: string,
  ) => void;
  updateStudentInfo: (index: number, info: StudentInfoPatch) => void;
  updateStudentVersion: (
    index: number,
    version: StudentBasicInfo["version"],
    className: string,
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
};

export const useRosterStore = create<RosterStore>((set, get) => ({
  ...emptyRosterState,
  saveStatus: "saved",
  setCourse: (course) =>
    set((state) => ({
      course: { ...state.course, ...course },
      studentsInfo: Object.fromEntries(
        Object.entries(state.studentsInfo).map(([key, info]) => [
          key,
          { ...info, confirmed: false, copiedAt: undefined },
        ]),
      ),
    })),
  newLesson: () => {
    if (!flushLessonDraft()) return;
    const state = get();
    try {
      localStorage.setItem(
        `lessonArchive:${state.lessonId}`,
        JSON.stringify(toDraft(state)),
      );
    } catch {
      set({ saveStatus: "error" });
      return;
    }
    set({
      lessonId: crypto.randomUUID(),
      course: { ...emptyCourse },
      studentsInfo: createStudentsInfo(state.studentsList),
    });
  },
  restoreLesson: (draft) => {
    if (!isLessonDraft(draft)) {
      set({ saveStatus: "error" });
      return;
    }
    if (!flushLessonDraft()) return;
    try {
      const current = get();
      if (current.lessonId)
        localStorage.setItem(
          `lessonArchive:${current.lessonId}`,
          JSON.stringify(toDraft(current)),
        );
    } catch {
      set({ saveStatus: "error" });
      return;
    }
    set({
      ...draft,
      studentsList: identify(draft.studentsList),
      studentsInfo: Object.fromEntries(
        Object.entries(draft.studentsInfo).map(([key, info]) => [
          key,
          { ...info, loading: false, draftContent: undefined },
        ]),
      ),
    });
  },
  renameStudent: (index, name) => {
    if (!name.trim()) return;
    set((state) => ({
      studentsList: state.studentsList.map((s, i) =>
        i === index ? { ...s, name: name.trim() } : s,
      ),
      studentsInfo: {
        ...state.studentsInfo,
        [index]: {
          ...state.studentsInfo[index],
          name: name.trim(),
          confirmed: false,
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
    set(emptyRosterState);
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
    if (!className || className === get().activeClass) return;
    if (!flushLessonDraft()) return;
    let draft: LessonDraft | undefined;
    try {
      const raw = localStorage.getItem(`lessonDraft:${className}`);
      if (raw) draft = JSON.parse(raw);
      if (draft && !isLessonDraft(draft)) throw new Error("invalid draft");
    } catch {
      set({ saveStatus: "error" });
      return;
    }
    const students = identify(
      draft?.studentsList ?? readRosterStudents(className),
    );
    const infos = draft?.studentsInfo ?? createStudentsInfo(students);
    set({
      activeClass: className,
      lessonId: draft?.lessonId || crypto.randomUUID(),
      course: draft?.course ?? { ...emptyCourse },
      studentsList: students,
      studentsInfo: Object.fromEntries(
        students.map((student, index) => {
          const info = infos[index] || createStudentsInfo([student])[0];
          return [
            index,
            {
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
            },
          ];
        }),
      ),
    });
  },

  resetRosterState: () => {
    set(emptyRosterState);
  },

  sortStudentsByName: (className) => {
    const { studentsInfo, studentsList } = get();
    const { sortedInfo, sortedStudents } = sortStudentsAndInfoByName(
      studentsList,
      studentsInfo,
    );

    set({ studentsInfo: sortedInfo, studentsList: sortedStudents });
    writeRosterStudents(className, sortedStudents);
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

  updateStudentGender: (index, gender, className) => {
    const students = [...get().studentsList];
    if (!students[index]) return;

    students[index] = { ...students[index], gender };
    get().updateStudentInfo(index, { confirmed: false, copiedAt: undefined });
    set({ studentsList: students });
    writeRosterStudents(className, students);
  },

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

  updateStudentVersion: (index, version, className) => {
    const students = [...get().studentsList];
    if (!students[index]) return;

    students[index] = { ...students[index], version };
    get().updateStudentInfo(index, { confirmed: false, copiedAt: undefined });
    set({ studentsList: students });
    writeRosterStudents(className, students);
  },

  updateStudentsFromRawValues: (rawValues, className) => {
    if (!className) {
      throw new Error("班级名不能为空！");
    }

    const names = parseStudentNamesInput(rawValues);
    const previous = get();
    const remaining = previous.studentsList.map((student, index) => ({
      student,
      info: previous.studentsInfo[index],
    }));
    const pairs = names.map((name) => {
      const match = remaining.findIndex((item) => item.student.name === name);
      if (match >= 0) return remaining.splice(match, 1)[0];
      const student: StudentBasicInfo = {
        id: crypto.randomUUID(),
        name,
        gender: "male",
        version: "v2",
      };
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
    writeRosterStudents(className, students);
  },
}));

const toDraft = (state: RosterStore): LessonDraft => ({
  activeClass: state.activeClass,
  lessonId: state.lessonId,
  course: state.course,
  studentsList: state.studentsList,
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
export function flushLessonDraft(): boolean {
  clearTimeout(saveTimer);
  const state = useRosterStore.getState();
  if (!state.activeClass) return true;
  try {
    localStorage.setItem(
      `lessonDraft:${state.activeClass}`,
      JSON.stringify(toDraft(state)),
    );
    localStorage.setItem("lastActiveClass", state.activeClass);
    writeRosterStudents(state.activeClass, state.studentsList);
    const classes = JSON.parse(
      localStorage.getItem("class-name") || "[]",
    ) as string[];
    if (!classes.includes(state.activeClass))
      localStorage.setItem(
        "class-name",
        JSON.stringify([...classes, state.activeClass]),
      );
    useRosterStore.setState({ saveStatus: "saved" });
    return true;
  } catch {
    useRosterStore.setState({ saveStatus: "error" });
    return false;
  }
}
useRosterStore.subscribe((state, previous) => {
  if (
    state.course === previous.course &&
    state.studentsList === previous.studentsList &&
    state.studentsInfo === previous.studentsInfo &&
    state.lessonId === previous.lessonId
  )
    return;
  if (!state.activeClass) return;
  useRosterStore.setState({ saveStatus: "saving" });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushLessonDraft, 300);
});
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushLessonDraft);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushLessonDraft();
  });
}
