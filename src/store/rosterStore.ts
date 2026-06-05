import { create } from "zustand";

import type { StudentBasicInfo, StudentsInfo } from "../components/types";
import {
  createStudentsInfo,
  mergeStudentNamesWithExistingInfo,
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

interface RosterStore {
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

const emptyRosterState = {
  studentsInfo: {},
  studentsList: [],
};

export const useRosterStore = create<RosterStore>((set, get) => ({
  ...emptyRosterState,

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
    const students = readRosterStudents(className);
    if (students.length === 0) {
      set(emptyRosterState);
      return;
    }

    set({
      studentsInfo: createStudentsInfo(students),
      studentsList: students,
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
    set({ studentsList: students });
    writeRosterStudents(className, students);
  },

  updateStudentsFromRawValues: (rawValues, className) => {
    if (!className) {
      throw new Error("班级名不能为空！");
    }

    const names = parseStudentNamesInput(rawValues);
    const students = mergeStudentNamesWithExistingInfo(
      names,
      get().studentsList,
    );

    set({
      studentsInfo: createStudentsInfo(students),
      studentsList: students,
    });
    writeRosterStudents(className, students);
  },
}));
