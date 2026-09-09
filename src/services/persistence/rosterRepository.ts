import type { StudentBasicInfo } from "../../types";
import { normalizeStoredStudents } from "../../domain/student";
import {
  readStorageJson,
  writeStorageJson,
  type KeyValueStorage,
} from "./localStorageRepository";

export const getRosterStorageKey = (className: string) => `${className}_std`;

export const readRosterStudents = (
  className: string,
  storage?: KeyValueStorage,
): StudentBasicInfo[] => {
  if (!className.trim()) return [];

  return normalizeStoredStudents(
    readStorageJson<unknown>(getRosterStorageKey(className.trim()), [], storage),
  );
};

export const writeRosterStudents = (
  className: string,
  students: StudentBasicInfo[],
  storage?: KeyValueStorage,
) => {
  if (!className.trim()) return;

  writeStorageJson(getRosterStorageKey(className.trim()), students, storage);
};
