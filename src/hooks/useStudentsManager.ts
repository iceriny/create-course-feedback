import { useCallback, useState } from "react";
import { StudentBasicInfo, StudentsInfo } from "../components/types";

/**
 * 学生管理Hook
 * 管理学生列表（静态信息）和学生状态信息（动态信息）
 */
export const useStudentsManager = () => {
  // 学生基础信息列表 (静态信息)
  const [studentsList, setStudentsList] = useState<StudentBasicInfo[]>([]);

  // 学生动态信息状态 (运行时状态)
  const [studentsInfo, setStudentsInfo] = useState<{
    [key: number]: StudentsInfo;
  }>({});

  /**
   * 从原始字符串数组创建学生列表（保持向后兼容）
   */
  const createStudentsFromNames = useCallback(
    (names: string[]): StudentBasicInfo[] => {
      return names.map((name) => ({
        name: name.trim(),
        gender: "male" as const, // 默认性别
        version: "v2" as const, // 默认版本
      }));
    },
    [],
  );

  /**
   * 初始化学生动态信息
   */
  const initializeStudentsInfo = useCallback((students: StudentBasicInfo[]) => {
    const newStudentsInfo: { [key: number]: StudentsInfo } = {};
    students.forEach((student, index) => {
      newStudentsInfo[index] = {
        name: student.name,
        content: "",
        think_content: "",
        loading: false,
        activated: true,
      };
    });
    setStudentsInfo(newStudentsInfo);
  }, []);

  /**
   * 保存学生列表到localStorage
   */
  const saveStudentsToStorage = useCallback(
    (className: string, students: StudentBasicInfo[]) => {
      localStorage.setItem(`${className}_std`, JSON.stringify(students));
    },
    [],
  );

  /**
   * 从localStorage加载学生列表
   */
  const loadStudentsFromStorage = useCallback(
    (className: string) => {
      const studentsStr = localStorage.getItem(`${className}_std`);
      if (!studentsStr) {
        setStudentsList([]);
        setStudentsInfo({});
        return;
      }

      if (studentsStr) {
        try {
          const data = JSON.parse(studentsStr);

          if (!Array.isArray(data) || data.length === 0) {
            setStudentsList([]);
            setStudentsInfo({});
            return;
          }

          // 兼容旧格式 (字符串数组)
          if (typeof data[0] === "string") {
            // 旧格式：字符串数组
            const students = createStudentsFromNames(data);
            setStudentsList(students);
            initializeStudentsInfo(students);
          } else {
            // 新格式：对象数组，但需要兼容没有version字段的情况
            const students = (data as StudentBasicInfo[]).map((student) => ({
              ...student,
              version: student.version || "v2", // 为旧数据添加默认版本
            }));
            setStudentsList(students);
            initializeStudentsInfo(students);
          }
        } catch (error) {
          console.error("Failed to parse students data:", error);
          setStudentsList([]);
          setStudentsInfo({});
        }
      }
    },
    [createStudentsFromNames, initializeStudentsInfo],
  );

  /**
   * 更新学生列表（从原始字符串处理）
   */
  const updateStudentsFromRawValues = useCallback(
    (rawValues: string[], className: string) => {
      if (!className) {
        throw new Error("班级名不能为空！");
      }

      const values: string[] = [];
      for (const v of rawValues) {
        if (v.includes(",")) {
          const splitV = v.split(",");
          splitV.forEach((_item) => {
            const item = _item.trim();
            if (item !== "" && !values.includes(item)) {
              values.push(item);
            }
          });
        } else {
          values.push(v.trim());
        }
      }

      // 保持现有学生的性别和版本信息，新增学生默认为男性和v2版本
      const existingStudentsMap = new Map(
        studentsList.map((s) => [
          s.name,
          { gender: s.gender, version: s.version },
        ]),
      );
      const newStudents: StudentBasicInfo[] = values.map((name) => {
        const existing = existingStudentsMap.get(name);
        return {
          name,
          gender: existing?.gender || "male",
          version: existing?.version || "v2",
        };
      });

      setStudentsList(newStudents);
      initializeStudentsInfo(newStudents);
      saveStudentsToStorage(className, newStudents);
    },
    [studentsList, initializeStudentsInfo, saveStudentsToStorage],
  );

  /**
   * 更新单个学生的性别
   */
  const updateStudentGender = useCallback(
    (index: number, gender: "male" | "female", className: string) => {
      const newStudents = [...studentsList];
      if (newStudents[index]) {
        newStudents[index] = { ...newStudents[index], gender };
        setStudentsList(newStudents);
        saveStudentsToStorage(className, newStudents);
      }
    },
    [studentsList, saveStudentsToStorage],
  );

  /**
   * 更新单个学生的版本
   */
  const updateStudentVersion = useCallback(
    (index: number, version: "v1" | "v2", className: string) => {
      const newStudents = [...studentsList];
      if (newStudents[index]) {
        newStudents[index] = { ...newStudents[index], version };
        setStudentsList(newStudents);
        saveStudentsToStorage(className, newStudents);
      }
    },
    [studentsList, saveStudentsToStorage],
  );

  /**
   * 更新学生动态信息
   */
  const updateStudentInfo = useCallback(
    (
      index: number,
      info: Partial<StudentsInfo> | ((prev: StudentsInfo) => StudentsInfo),
    ) => {
      setStudentsInfo((prev) => {
        const currentInfo = prev[index];
        if (!currentInfo) return prev;

        const updatedInfo =
          typeof info === "function"
            ? info(currentInfo)
            : { ...currentInfo, ...info };

        return {
          ...prev,
          [index]: updatedInfo,
        };
      });
    },
    [],
  );

  /**
   * 清空所有学生数据
   */
  const clearAllStudents = useCallback(() => {
    setStudentsList([]);
    setStudentsInfo({});
  }, []);

  /**
   * 切换学生激活状态
   */
  const toggleStudentActivation = useCallback((index: number) => {
    setStudentsInfo((prev) => {
      const currentInfo = prev[index];
      if (!currentInfo) return prev;

      return {
        ...prev,
        [index]: {
          ...currentInfo,
          activated: !currentInfo.activated,
        },
      };
    });
  }, []);

  /**
   * 反转所有学生的激活状态
   */
  const toggleAllStudentsActivation = useCallback(() => {
    setStudentsInfo((prev) => {
      const newInfo = { ...prev };
      for (const key in newInfo) {
        newInfo[key] = {
          ...newInfo[key],
          activated: !newInfo[key].activated,
        };
      }
      return newInfo;
    });
  }, []);

  /**
   * 按首字母排序学生
   */
  const sortStudentsByName = useCallback(
    (className: string) => {
      const sortedStudents = [...studentsList].sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      // 重新排序动态信息
      const sortedInfo = Object.fromEntries(
        Object.entries(studentsInfo)
          .map(([key, value]) => ({
            key: Number(key),
            value,
          }))
          .sort((a, b) => a.value.name.localeCompare(b.value.name))
          .map((item, index) => [index, item.value]),
      ) as Record<number, StudentsInfo>;

      setStudentsList(sortedStudents);
      setStudentsInfo(sortedInfo);
      saveStudentsToStorage(className, sortedStudents);
    },
    [studentsList, studentsInfo, saveStudentsToStorage],
  );

  /**
   * 获取学生名称列表（用于向后兼容）
   */
  const getStudentNames = useCallback((): string[] => {
    return studentsList.map((student) => student.name);
  }, [studentsList]);

  /**
   * 获取激活学生数量统计
   */
  const getActivatedStudentsCount = useCallback((): {
    activated: number;
    total: number;
  } => {
    const activated = Object.values(studentsInfo).filter(
      (info) => info.activated,
    ).length;
    const total = studentsList.length;
    return { activated, total };
  }, [studentsInfo, studentsList]);

  return {
    // 状态
    studentsList,
    studentsInfo,

    // 操作方法
    loadStudentsFromStorage,
    updateStudentsFromRawValues,
    updateStudentGender,
    updateStudentVersion,
    updateStudentInfo,
    clearAllStudents,
    toggleStudentActivation,
    toggleAllStudentsActivation,
    sortStudentsByName,

    // 工具方法
    getStudentNames,
    getActivatedStudentsCount,
  };
};

export default useStudentsManager;
