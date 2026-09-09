import { create } from "zustand";
const storage = () =>
  import("../utils/dexieStorage").then((module) => module.dexieStorage);
import type { V1InputSuggestions, V2QuickOptions } from "../types";

// 存储键名
const V1_STORAGE_KEY = "v1_input_suggestions";
const V2_STORAGE_KEY = "v2_quick_options";

// V2 默认快捷选项
const DEFAULT_V2_OPTIONS: V2QuickOptions = {
  total: [
    "优秀",
    "良好",
    "一般",
    "较差",
    "态度认真",
    "需要加强",
    "进步明显",
    "有待提高",
  ],
  mastery_situation: [
    "熟练掌握",
    "掌握良好",
    "基本掌握",
    "需要巩固",
    "有待加强",
    "进步显著",
  ],
  attention: [
    "注意力集中",
    "偶有分心",
    "需要提醒",
    "容易走神",
    "注意力不够集中",
  ],
  interaction: ["积极发言", "主动提问", "较少发言", "需要鼓励", "互动较少"],
  other: [
    "课堂纪律良好",
    "作业完成质量高",
    "思维活跃",
    "创新能力强",
    "团队协作好",
    "表现稳定",
  ],
};

interface InputAssistantStore {
  // V1 相关状态和方法
  v1Suggestions: V1InputSuggestions;
  loadV1Suggestions: () => Promise<void>;
  getV1Suggestions: (className: string) => string[];
  addV1Suggestion: (className: string, suggestion: string) => Promise<void>;
  batchAddV1Suggestions: (
    className: string,
    suggestions: string[],
  ) => Promise<void>;
  searchV1Suggestions: (className: string, query: string) => string[];

  // V2 相关状态和方法
  v2CustomOptions: V2QuickOptions;
  loadV2CustomOptions: () => Promise<void>;
  getV2Options: () => V2QuickOptions;
  addV2CustomOption: (
    field: keyof V2QuickOptions,
    option: string,
  ) => Promise<void>;
  batchCollectV2Options: (formData: {
    content?: Record<string, unknown>;
  }) => Promise<void>;
}

/**
 * 合并数组并去重
 */
function mergeAndDeduplicate(
  defaultOptions: string[],
  customOptions: string[],
): string[] {
  const merged = [...defaultOptions, ...customOptions];
  return Array.from(new Set(merged));
}

export const useInputAssistantStore = create<InputAssistantStore>(
  (set, get) => ({
    // V1 初始状态
    v1Suggestions: {},

    // 加载 V1 建议数据
    loadV1Suggestions: async () => {
      try {
        const data = await (
          await storage()
        ).getItem<V1InputSuggestions>(V1_STORAGE_KEY);
        set({ v1Suggestions: data || {} });
      } catch (error) {
        console.error("Failed to load V1 suggestions:", error);
        set({ v1Suggestions: {} });
      }
    },

    // 获取指定班级的输入建议
    getV1Suggestions: (className: string) => {
      const { v1Suggestions } = get();
      return v1Suggestions[className] || [];
    },

    // 添加新的输入建议
    addV1Suggestion: async (className: string, suggestion: string) => {
      if (!suggestion.trim()) return;

      const normalizedSuggestion = suggestion.trim();
      const { v1Suggestions } = get();
      const updatedSuggestions = { ...v1Suggestions };

      if (!updatedSuggestions[className]) {
        updatedSuggestions[className] = [];
      }

      // 检查是否已存在该建议（避免重复）
      if (!updatedSuggestions[className].includes(normalizedSuggestion)) {
        updatedSuggestions[className].push(normalizedSuggestion);
        // 限制每个班级最多保存50个建议
        if (updatedSuggestions[className].length > 50) {
          updatedSuggestions[className] =
            updatedSuggestions[className].slice(-50);
        }

        // 更新状态和持久化
        set({ v1Suggestions: updatedSuggestions });
        await (await storage()).setItem(V1_STORAGE_KEY, updatedSuggestions);
      }
    },

    // 批量添加建议（从所有学生输入中收集）
    batchAddV1Suggestions: async (className: string, suggestions: string[]) => {
      const { addV1Suggestion } = get();
      await Promise.all(
        suggestions
          .filter((s) => s && s.trim())
          .map((s) => addV1Suggestion(className, s.trim())),
      );
    },

    // 搜索匹配的建议
    searchV1Suggestions: (className: string, query: string) => {
      const suggestions = get().getV1Suggestions(className);
      if (!query.trim()) return suggestions.slice(0, 10); // 返回前10个

      const lowerQuery = query.toLowerCase();
      return suggestions
        .filter((s) => s.toLowerCase().includes(lowerQuery))
        .slice(0, 10);
    },

    // V2 初始状态
    v2CustomOptions: {
      total: [],
      mastery_situation: [],
      attention: [],
      interaction: [],
      other: [],
    },

    // 加载 V2 自定义选项
    loadV2CustomOptions: async () => {
      try {
        const data = await (
          await storage()
        ).getItem<V2QuickOptions>(V2_STORAGE_KEY);
        set({
          v2CustomOptions: data || {
            total: [],
            mastery_situation: [],
            attention: [],
            interaction: [],
            other: [],
          },
        });
      } catch (error) {
        console.error("Failed to load V2 custom options:", error);
        set({
          v2CustomOptions: {
            total: [],
            mastery_situation: [],
            attention: [],
            interaction: [],
            other: [],
          },
        });
      }
    },

    // 获取快捷选项（合并默认选项和自定义选项）
    getV2Options: () => {
      const { v2CustomOptions } = get();
      return {
        total: mergeAndDeduplicate(
          DEFAULT_V2_OPTIONS.total,
          v2CustomOptions.total || [],
        ),
        mastery_situation: mergeAndDeduplicate(
          DEFAULT_V2_OPTIONS.mastery_situation,
          v2CustomOptions.mastery_situation || [],
        ),
        attention: mergeAndDeduplicate(
          DEFAULT_V2_OPTIONS.attention,
          v2CustomOptions.attention || [],
        ),
        interaction: mergeAndDeduplicate(
          DEFAULT_V2_OPTIONS.interaction,
          v2CustomOptions.interaction || [],
        ),
        other: mergeAndDeduplicate(
          DEFAULT_V2_OPTIONS.other,
          v2CustomOptions.other || [],
        ),
      };
    },

    // 添加自定义选项
    addV2CustomOption: async (field: keyof V2QuickOptions, option: string) => {
      if (!option.trim()) return;

      const normalizedOption = option.trim();

      // 首先检查是否为默认选项，如果是则跳过存储
      if (DEFAULT_V2_OPTIONS[field].includes(normalizedOption)) {
        return;
      }

      const { v2CustomOptions } = get();
      const updatedOptions = { ...v2CustomOptions };

      if (!updatedOptions[field]) {
        updatedOptions[field] = [];
      }

      // 检查本地存储中是否已存在该选项
      if (!updatedOptions[field].includes(normalizedOption)) {
        updatedOptions[field].push(normalizedOption);
        // 限制每个字段最多保存20个自定义选项
        if (updatedOptions[field].length > 20) {
          updatedOptions[field] = updatedOptions[field].slice(-20);
        }

        // 更新状态和持久化
        set({ v2CustomOptions: updatedOptions });
        await (await storage()).setItem(V2_STORAGE_KEY, updatedOptions);
      }
    },

    // 批量收集并添加自定义选项
    batchCollectV2Options: async (formData: {
      content?: Record<string, unknown>;
    }) => {
      if (!formData || !formData.content) return;

      const { addV2CustomOption } = get();
      const promises: Promise<void>[] = [];

      Object.values(formData.content).forEach((studentData: unknown) => {
        if (typeof studentData === "object" && studentData !== null) {
          Object.entries(studentData).forEach(([field, value]) => {
            if (
              typeof value === "string" &&
              value.trim() &&
              [
                "total",
                "mastery_situation",
                "attention",
                "interaction",
                "other",
              ].includes(field)
            ) {
              promises.push(
                addV2CustomOption(field as keyof V2QuickOptions, value.trim()),
              );
            }
          });
        }
      });

      await Promise.all(promises);
    },
  }),
);
