import { useRosterStore } from "../store/rosterStore";

/**
 * 学生管理Hook
 * 管理学生列表（静态信息）和学生状态信息（动态信息）
 */
export const useStudentsManager = () => {
  return useRosterStore();
};

export default useStudentsManager;
