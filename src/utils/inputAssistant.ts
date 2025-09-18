import { V1InputSuggestions, V2QuickOptions } from "../components/types";

// V1版本输入联想管理
export class V1InputSuggestionManager {
  private static readonly STORAGE_KEY = "v1_input_suggestions";

  // 获取指定班级的输入建议
  static getSuggestions(className: string): string[] {
    const allSuggestions = this.getAllSuggestions();
    return allSuggestions[className] || [];
  }

  // 获取所有班级的输入建议
  static getAllSuggestions(): V1InputSuggestions {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  }

  // 添加新的输入建议
  static addSuggestion(className: string, suggestion: string) {
    if (!suggestion.trim()) return;

    const normalizedSuggestion = suggestion.trim();
    const allSuggestions = this.getAllSuggestions();

    if (!allSuggestions[className]) {
      allSuggestions[className] = [];
    }

    // 检查是否已存在该建议（避免重复）
    if (!allSuggestions[className].includes(normalizedSuggestion)) {
      allSuggestions[className].push(normalizedSuggestion);
      // 限制每个班级最多保存50个建议
      if (allSuggestions[className].length > 50) {
        allSuggestions[className] = allSuggestions[className].slice(-50);
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allSuggestions));
    }
  }

  // 批量添加建议（从所有学生输入中收集）
  static batchAddSuggestions(className: string, suggestions: string[]) {
    suggestions.forEach((suggestion) => {
      if (suggestion && suggestion.trim()) {
        this.addSuggestion(className, suggestion.trim());
      }
    });
  }

  // 搜索匹配的建议
  static searchSuggestions(className: string, query: string): string[] {
    const suggestions = this.getSuggestions(className);
    if (!query.trim()) return suggestions.slice(0, 10); // 返回前10个

    const lowerQuery = query.toLowerCase();
    return suggestions
      .filter((s) => s.toLowerCase().includes(lowerQuery))
      .slice(0, 10);
  }
}

// V2版本快捷选项管理
export class V2QuickOptionsManager {
  private static readonly STORAGE_KEY = "v2_quick_options";

  // 默认快捷选项
  private static readonly DEFAULT_OPTIONS: V2QuickOptions = {
    total: [
      "优秀",
      "良好",
      "一般",
      "较差",
      "学习态度认真",
      "需要加强",
      "进步明显",
      "有待提高",
    ],
    mastery_situation: [
      "掌握良好",
      "基本掌握",
      "掌握扎实",
      "理解透彻",
      "需要巩固",
      "有待加强",
      "进步显著",
      "熟练掌握",
    ],
    attention: [
      "专注度高",
      "注意力集中",
      "认真听讲",
      "专心致志",
      "偶有分心",
      "需要提醒",
      "容易走神",
      "注意力不够集中",
    ],
    interaction: [
      "积极发言",
      "主动提问",
      "乐于分享",
      "善于合作",
      "参与积极",
      "较少发言",
      "需要鼓励",
      "互动良好",
    ],
    other: [
      "课堂纪律良好",
      "作业完成质量高",
      "思维活跃",
      "创新能力强",
      "团队协作好",
      "需要更多练习",
      "建议课后复习",
      "表现稳定",
    ],
  };

  // 获取快捷选项
  static getOptions(): V2QuickOptions {
    const customOptions = this.getCustomOptions();

    // 与默认选项合并，确保所有字段都有选项，并进行去重
    return {
      total: this.mergeAndDeduplicate(
        this.DEFAULT_OPTIONS.total,
        customOptions.total || [],
      ),
      mastery_situation: this.mergeAndDeduplicate(
        this.DEFAULT_OPTIONS.mastery_situation,
        customOptions.mastery_situation || [],
      ),
      attention: this.mergeAndDeduplicate(
        this.DEFAULT_OPTIONS.attention,
        customOptions.attention || [],
      ),
      interaction: this.mergeAndDeduplicate(
        this.DEFAULT_OPTIONS.interaction,
        customOptions.interaction || [],
      ),
      other: this.mergeAndDeduplicate(
        this.DEFAULT_OPTIONS.other,
        customOptions.other || [],
      ),
    };
  }

  // 合并数组并去重的辅助方法
  private static mergeAndDeduplicate(
    defaultOptions: string[],
    customOptions: string[],
  ): string[] {
    const merged = [...defaultOptions, ...customOptions];
    return Array.from(new Set(merged)); // 使用Set去重
  }

  // 添加自定义选项
  static addCustomOption(field: keyof V2QuickOptions, option: string) {
    if (!option.trim()) return;

    const normalizedOption = option.trim();

    // 首先检查是否为默认选项，如果是则跳过存储
    if (this.DEFAULT_OPTIONS[field].includes(normalizedOption)) {
      return;
    }

    const customOptions = this.getCustomOptions();
    if (!customOptions[field]) {
      customOptions[field] = [];
    }

    // 检查本地存储中是否已存在该选项
    if (!customOptions[field].includes(normalizedOption)) {
      customOptions[field].push(normalizedOption);
      // 限制每个字段最多保存20个自定义选项
      if (customOptions[field].length > 20) {
        customOptions[field] = customOptions[field].slice(-20);
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(customOptions));
    }
  }

  // 获取仅自定义选项（不包括默认选项）
  private static getCustomOptions(): V2QuickOptions {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored
      ? JSON.parse(stored)
      : {
          total: [],
          mastery_situation: [],
          attention: [],
          interaction: [],
          other: [],
        };
  }

  // 批量收集并添加自定义选项
  static batchCollectOptions(formData: { content?: Record<string, unknown> }) {
    if (!formData || !formData.content) return;

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
            this.addCustomOption(field as keyof V2QuickOptions, value.trim());
          }
        });
      }
    });
  }
}
