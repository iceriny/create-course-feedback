# 全面重构、AI 能力增强与交互体验优化头脑风暴

生成时间：2026-06-03

## 1. 背景与目标

当前项目已经形成了可用闭环：教师输入课程信息和学生表现，应用调用 AI 扩写课堂反馈，再按模板导出 Markdown。真正适合下一阶段投入的方向，不只是“把代码拆小”，而是把它升级成一个更稳定、更可解释、更可迭代的反馈生产系统。

这份文档围绕三个目标展开：

1. 架构重构：把当前集中在 `MainUI`、表单、hook 和 localStorage 中的状态重新组织为可维护的数据模型、状态层、服务层和持久化层。
2. AI 能力增强：引入学生历史评价、全班视野、复杂提示词工程、生成质量评估和防污染机制，让 AI 输出更稳定而不是更混乱。
3. 功能与交互增强：提升教师批量处理学生反馈时的效率、可控性、可追溯性和信心。

这不是一次“小修小补”的建议，而是一个可以分阶段推进的长期重构蓝图。

## 2. 核心判断

### 2.1 不应只把更多信息塞进 prompt

“全班视野”和“历史评价”确实能提升反馈质量，但如果直接把全班所有学生、本次全部表现、历史所有反馈都塞进单个学生生成 prompt，会带来明显风险：

- 模型可能把其他学生的表现混入目标学生。
- 模型可能过度平均化，让每个学生反馈变得像班级总结。
- 历史负面评价可能形成锚定，让本次表现被旧印象污染。
- 上下文过长后，目标任务和输出约束反而被稀释。
- 批量生成时，不同学生之间的措辞、问题、优点可能相互串扰。

因此，AI 增强的关键不是“更多上下文”，而是“上下文治理”：

- 哪些信息进入 prompt。
- 以什么粒度进入 prompt。
- 哪些只用于预分析，不直接进入生成。
- 哪些只能作为风格或校准参考，不能作为事实。
- 生成后如何检查是否被污染。

### 2.2 状态管理重构应围绕领域模型，而不是围绕组件

当前项目已经使用 Zustand 管理输入助手，但主体业务仍分散在 `MainUI` 和 Ant Design form 中。下一阶段如果全面引入 Zustand，重点不应是“把所有 useState 搬进 store”，而是建立稳定的领域模型。

推荐的重构方向：

- 课程、班级、学生、课堂记录、反馈草稿、AI 任务、模板、提示词、设置分别建模。
- UI 组件只负责展示和局部输入。
- Store 管业务状态和派生选择器。
- Service 管 AI 调用、prompt 编译、数据迁移、导出。
- Repository 管 localStorage/IndexedDB 的读写。

这样做以后，后续新增“历史评价”“全班视野”“反馈版本”“AI 质量评分”等功能，才不会继续堆到一个巨大的组件里。

## 3. 目标架构蓝图

### 3.1 分层结构

建议目标结构：

```text
src/
  app/
    App.tsx
    routes-or-shell/
    providers/
  domain/
    course/
    classGroup/
    student/
    feedback/
    ai/
    prompt/
    export/
  store/
    appStore.ts
    courseStore.ts
    rosterStore.ts
    feedbackStore.ts
    aiStore.ts
    settingsStore.ts
    promptStore.ts
    historyStore.ts
    inputAssistantStore.ts
  services/
    ai/
      AIClient.ts
      providers/
      generationOrchestrator.ts
      contextPlanner.ts
      promptCompiler.ts
      outputValidator.ts
    feedback/
      feedbackExportService.ts
      feedbackHistoryService.ts
      feedbackQualityService.ts
    persistence/
      repositories/
      migrations/
      backupService.ts
  components/
    course/
    roster/
    studentFeedback/
    generation/
    settings/
    common/
  db/
    schema.ts
    dexie.ts
  tests/
```

核心思路：

- `domain` 只放类型、纯函数、规则和领域常量。
- `store` 放 Zustand 状态和 action。
- `services` 放有副作用的流程编排。
- `components` 尽量变成“读 store + 调 action”的 UI 层。
- `db` 统一定义 IndexedDB schema 和迁移。

### 3.2 领域模型

建议建立以下核心类型。

```ts
export interface ClassGroup {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseSession {
  id: string;
  classGroupId: string;
  courseName: string;
  startAt: string;
  endAt: string;
  contents: string[];
  objectives: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  classGroupId: string;
  displayName: string;
  lastName?: string;
  firstName?: string;
  gender?: "male" | "female" | "unknown";
  tags: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentPerformanceInput {
  id: string;
  sessionId: string;
  studentId: string;
  inputMode: "freeText" | "structured";
  rawText?: string;
  structured?: {
    overall?: string;
    mastery?: string;
    attention?: string;
    interaction?: string;
    homework?: string;
    emotion?: string;
    collaboration?: string;
    other?: string;
  };
  updatedAt: string;
}

export interface FeedbackDraft {
  id: string;
  sessionId: string;
  studentId: string;
  status: "empty" | "queued" | "generating" | "ready" | "reviewed" | "failed";
  content: string;
  reasoning?: string;
  quality?: FeedbackQualityReport;
  promptTraceId?: string;
  model?: string;
  generatedAt?: string;
  updatedAt: string;
}

export interface FeedbackHistoryItem {
  id: string;
  studentId: string;
  sessionId: string;
  courseName: string;
  generatedContent: string;
  teacherEditedContent?: string;
  performanceSnapshot: StudentPerformanceInput;
  summaryForFutureUse?: string;
  createdAt: string;
}
```

相比当前按数组 index 关联学生和输出，推荐改用稳定 ID。这样可以避免排序、删除、插入后出现表单字段和学生动态信息错位的问题。

### 3.3 Zustand Store 设计

不建议建立一个巨大的全局 store。更好的方式是多个领域 store，配合 selector 使用。

#### courseStore

职责：

- 当前班级。
- 当前课程 session。
- 课程历史。
- 课程表单草稿。
- 课程提交状态。

典型状态：

```ts
interface CourseStore {
  currentClassId: string | null;
  currentSessionId: string | null;
  sessionsById: Record<string, CourseSession>;
  draft: CourseSessionDraft;
  isDirty: boolean;
  setDraftField: <K extends keyof CourseSessionDraft>(
    key: K,
    value: CourseSessionDraft[K],
  ) => void;
  commitDraft: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
}
```

#### rosterStore

职责：

- 班级学生名单。
- 激活状态。
- 性别、标签、默认输入模式。
- 排序、批量导入、批量选择。

推荐用 normalized state：

```ts
interface RosterStore {
  studentIds: string[];
  studentsById: Record<string, Student>;
  selectedStudentIds: string[];
  upsertStudentsFromNames: (names: string[], classGroupId: string) => void;
  updateStudent: (studentId: string, patch: Partial<Student>) => void;
  sortStudents: (mode: "name" | "createdAt" | "custom") => void;
  toggleActive: (studentId: string) => void;
}
```

#### feedbackStore

职责：

- 每个学生的表现输入。
- 每个学生的 AI 输出。
- 当前编辑状态。
- 输出版本历史。
- 教师手动修改后的最终稿。

建议区分：

- `performanceInputsByStudentId`
- `draftsByStudentId`
- `finalFeedbackByStudentId`
- `feedbackVersionsByStudentId`

这能支持“AI 初稿”“教师修改稿”“重新生成版本对比”。

#### aiStore

职责：

- 当前 provider/model。
- 请求队列。
- 每个学生生成任务状态。
- 限流状态。
- prompt trace。
- 错误信息。

注意：AI store 不应直接保存大段业务数据，它只管理任务和配置。真正的 prompt 构造交给 `promptCompiler`，真正请求交给 `AIClient`。

#### promptStore

职责：

- Prompt recipes。
- 系统提示词。
- 学科模板。
- 输出规则。
- 历史上下文策略。
- 实验版本。

推荐把“提示词”从纯文本升级为 recipe：

```ts
interface PromptRecipe {
  id: string;
  name: string;
  subject: "programming" | "robot" | "custom";
  systemInstruction: string;
  outputContract: OutputContract;
  contextPolicy: ContextPolicy;
  contaminationPolicy: ContaminationPolicy;
  revisionPolicy?: RevisionPolicy;
  createdAt: string;
  updatedAt: string;
}
```

#### settingsStore

职责：

- API provider。
- API key 引用或本地保存状态。
- 模型参数。
- 导出偏好。
- UI 偏好。
- 数据备份/恢复选项。

### 3.4 持久化策略

当前 localStorage + Dexie 混用，未来建议统一为 Dexie 主存储，localStorage 只保留少量轻量设置。

推荐：

- Dexie 保存核心业务数据：班级、学生、课程、表现输入、反馈历史、prompt recipes、输入助手。
- localStorage 保存 UI 偏好：当前主题、最近打开班级 ID、版本号等。
- API Key 仍可本地保存，但必须明确风险；更好的方案是支持“仅本次会话保存”。

Dexie 表建议：

```text
classes
students
courseSessions
performanceInputs
feedbackDrafts
feedbackHistories
promptRecipes
promptTraces
inputSuggestions
settings
```

### 3.5 表单与 store 的关系

Ant Design Form 适合局部编辑，但不适合作为长期业务状态源。

推荐策略：

- 表单内部保存“正在编辑的草稿”。
- onBlur、onDebouncedChange 或 submit 时同步到 store。
- store 是跨组件、跨流程、持久化的事实来源。
- 页面切换或批量操作使用 store，不直接读 form。

例如课程信息：

```text
CourseInfoForm local draft
  -> validate
  -> courseStore.commitDraft
  -> repository.saveSession
  -> generation context can use committed session
```

学生表现输入也可以类似：

```text
StudentInput local field
  -> debounced feedbackStore.updatePerformanceInput
  -> autosave to IndexedDB
```

## 4. AI 能力增强设计

### 4.1 从“单次调用”升级为“生成管线”

当前生成流程近似：

```text
课程信息 + 学生姓名 + 学生表现 + 提示词 -> LLM -> 反馈
```

建议升级为：

```text
数据准备
  -> 上下文规划
  -> 班级视野摘要
  -> 学生历史检索与压缩
  -> 单生 prompt 编译
  -> 初稿生成
  -> 自检与污染检测
  -> 可选二次修订
  -> 保存 prompt trace 与反馈版本
```

关键是把“全班视野”作为独立的分析产物，而不是直接把全班信息塞到每个学生的生成 prompt。

### 4.2 全班视野应该如何使用

全班视野适合用于“校准”，不适合用于“事实注入”。

可用方式：

1. 班级总体风格校准
   - 本次课程整体难度。
   - 大多数学生的掌握情况。
   - 普遍遇到的问题。
   - 本节课希望反馈中强调的能力维度。

2. 相对定位但不点名
   - 目标学生本次表现是偏积极、稳定、需要提醒，还是进步明显。
   - 只给模型“相对信号”，不提供其他学生姓名与具体表现。

3. 避免重复措辞
   - 批量生成前提取班级常见问题，用于提示模型区分表达。
   - 不把其他学生的事实作为目标学生事实。

4. 输出一致性控制
   - 全班反馈的语气、长度、结构保持统一。
   - 但每个学生的具体评价仍严格来自目标学生输入。

建议生成一个 `ClassContextSummary`：

```ts
interface ClassContextSummary {
  sessionId: string;
  courseDifficulty: "easy" | "normal" | "hard";
  commonStrengths: string[];
  commonChallenges: string[];
  teachingFocus: string[];
  wordingGuidance: string[];
  prohibitedLeakage: string[];
}
```

这个 summary 可以进入 prompt，但必须注明：

```text
以下是班级层面的背景，只能用于语气校准和教学重点理解。
禁止把其中任何内容当作目标学生的个人事实。
目标学生事实只能来自“目标学生输入”和“目标学生历史摘要”。
```

### 4.3 学生历史评价如何引入

学生历史有三种用法，风险从低到高：

1. 低风险：连续性表达
   - “相比之前更主动”
   - “近期整体比较稳定”
   - “本次在专注度上有改善”

2. 中风险：个性化关注点
   - 长期害羞、不敢表达。
   - 经常速度快但细节不稳。
   - 动手能力强但表达总结弱。

3. 高风险：负面标签固化
   - “一直不认真”
   - “经常捣乱”
   - “基础差”

推荐做法：不要直接把完整历史反馈塞入 prompt，而是为每个学生维护“未来可用摘要”。

```ts
interface StudentLongTermProfile {
  studentId: string;
  strengths: string[];
  recurringChallenges: string[];
  recentProgress: string[];
  teacherNotes: string[];
  avoidOverstating: string[];
  updatedAt: string;
}
```

历史摘要生成规则：

- 只保留稳定模式，不保留一次性小事件。
- 负面内容必须转写为建设性关注点。
- 每条摘要附带最近证据日期或课程 ID。
- 摘要进入 prompt 前做时间衰减，越旧权重越低。
- 本次输入与历史冲突时，本次输入优先。

### 4.4 上下文污染防护

污染风险主要来自三类信息：

1. 其他学生信息污染目标学生。
2. 历史评价压过本次表现。
3. 班级摘要变成个人事实。

建议建立 `ContextPolicy`：

```ts
interface ContextPolicy {
  includeClassSummary: boolean;
  includeStudentHistory: boolean;
  maxHistoryItems: number;
  historyTimeWindowDays: number;
  currentInputPriority: "always";
  allowComparativeLanguage: boolean;
  allowOtherStudentNames: false;
}
```

Prompt 中明确分区：

```text
[不可作为个人事实的班级背景]
...

[目标学生历史摘要，可用于连续性，不得覆盖本次输入]
...

[目标学生本次输入，事实优先级最高]
...

[输出要求]
...
```

同时在输出后做污染检查：

- 是否出现其他学生姓名。
- 是否出现 prompt 中仅存在于班级背景、但目标学生输入和历史摘要没有的具体事实。
- 是否出现过度绝对化词汇，如“一直”“总是”“完全没有”。
- 是否引用了教师未提供的具体课堂事件。
- 是否和目标学生性别、称呼、姓名不一致。

如果检测失败，可以自动触发二次修订：

```text
你刚才的反馈存在以下问题：
1. 引入了目标学生输入中没有的事实。
2. 使用了过度绝对化表达。
请只基于目标学生本次输入重写，保持 80-120 字。
```

### 4.5 Prompt Recipe 设计

不要再把 prompt 只当成一段字符串。建议拆成 recipe：

```text
角色设定
任务定义
输入解释
事实优先级
上下文使用规则
禁止事项
输出格式
质量自检
```

示例结构：

```ts
interface CompiledPrompt {
  traceId: string;
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
  metadata: {
    recipeId: string;
    studentId: string;
    sessionId: string;
    contextSections: string[];
    estimatedTokens: number;
  };
}
```

#### 推荐 Prompt 分层

System：

- 教师角色。
- 面向家长沟通。
- 忠于输入。
- 不虚构。
- 不泄露其他学生。
- 本次输入优先。

User 1：输出契约。

- 字数范围。
- 语气。
- 是否需要包含优点和建议。
- 禁止标题、禁止编号、禁止字数统计。

User 2：上下文。

- 课程信息。
- 班级背景摘要。
- 目标学生历史摘要。
- 目标学生本次表现。

User 3：生成指令。

- 只为目标学生生成。
- 使用目标学生名字。
- 生成最终文本。

### 4.6 全班视野的两阶段方案

推荐采用两阶段，而不是一次性完成。

#### 阶段 A：班级分析

输入：

- 课程信息。
- 全班结构化表现。
- 教师可选备注。

输出：

```ts
interface ClassAnalysis {
  commonMasteryLevel: string;
  commonPositiveSignals: string[];
  commonChallenges: string[];
  classToneGuidance: string;
  recommendedFeedbackAngles: string[];
}
```

这个阶段不生成任何学生反馈。

#### 阶段 B：单生生成

输入：

- 课程信息。
- 目标学生本次输入。
- 目标学生历史摘要。
- 阶段 A 的班级分析。
- 输出契约。

输出：

- 单个学生反馈。
- 可选质量评分。

这样全班视野只提供“背景校准”，单生事实仍被隔离。

### 4.7 历史评价摘要的三层记忆

建议把学生历史拆成三层：

1. 原始反馈历史
   - 完整保留，用于回溯。
   - 默认不直接进入 prompt。

2. 课程级摘要
   - 每节课结束后，把反馈压缩为 1-3 条。
   - 例如“本节课掌握循环逻辑较好，但变量命名仍需提醒”。

3. 长期画像
   - 多节课摘要归纳。
   - 包括稳定优势、反复问题、近期进步。
   - 进入 prompt 时最多 3-5 条。

数据流：

```text
反馈完成
  -> 生成/更新课程级摘要
  -> 合并进学生长期画像
  -> 下次生成时按相关性检索
```

### 4.8 检索策略

历史信息不应按“最近 N 条”机械加入。更好的方式是按相关性和时间混合检索：

- 同一课程主题优先。
- 同一能力维度优先，如专注度、互动、掌握情况。
- 最近 30-90 天优先。
- 反复出现的问题优先。
- 与本次输入冲突的信息降权。

在纯前端项目中，不一定需要复杂向量检索。早期可以使用规则检索：

```text
score = recencyScore + sameSubjectScore + sameDimensionScore + recurringScore - conflictPenalty
```

后续如果需要更智能，再考虑 embedding 或由 LLM 做历史摘要筛选。

### 4.9 质量评估与 A/B 迭代

提示词工程必须可评估，否则会越改越玄学。

建议每次生成保存 `PromptTrace`：

```ts
interface PromptTrace {
  id: string;
  recipeId: string;
  studentId: string;
  sessionId: string;
  model: string;
  contextPolicy: ContextPolicy;
  promptPreview: string;
  output: string;
  qualityReport?: FeedbackQualityReport;
  teacherAction?: "accepted" | "edited" | "regenerated" | "discarded";
  teacherEditDistance?: number;
  createdAt: string;
}
```

质量指标：

- 教师是否直接采纳。
- 教师编辑幅度。
- 是否触发重新生成。
- 是否检测到污染。
- 是否过长/过短。
- 是否缺少优点或建议。
- 是否出现虚构细节。
- 不同学生之间相似度是否过高。

这会让 prompt 迭代有证据，而不是凭感觉。

## 5. 功能优化与新增方向

### 5.1 反馈历史与学生成长档案

新增“学生档案”面板：

- 历史课程反馈列表。
- 最近表现趋势。
- 稳定优势。
- 反复提醒点。
- 教师备注。
- AI 生成的长期画像。

应用价值：

- 教师写反馈时有连续性。
- AI 能生成“这次有进步”的反馈。
- 家长沟通更像长期观察，而不是单节课流水账。

需要注意：

- 长期画像必须允许教师编辑。
- 负面标签要避免固化。
- 历史摘要进入 prompt 前要显示给教师确认或可配置。

### 5.2 班级仪表盘

新增“本节课全班概览”：

- 已填写人数、待填写人数。
- 已生成、生成中、失败数量。
- 整体掌握情况分布。
- 专注度/互动/掌握情况热力。
- 常见问题自动汇总。
- 需要重点关注学生列表。

这个视图可以服务两个目标：

- 帮教师检查本节课输入是否平衡。
- 给 AI 班级分析提供结构化输入。

### 5.3 反馈版本管理

每个学生不只保存一个 `content`，而是保存多个版本：

- AI 初稿 v1。
- 重新生成 v2/v3。
- 教师编辑稿。
- 最终导出稿。

功能：

- 版本对比。
- 一键回退。
- 标记“已确认”。
- 查看每版使用的 prompt/model。

这样可以缓解教师对 AI 输出不可控的担忧。

### 5.4 批量生成工作台

当前批量生成是一个按钮触发所有激活学生。未来可以做成任务面板：

- 队列列表。
- 当前请求并发和限流状态。
- 单个学生暂停/重试。
- 失败原因。
- 估算剩余时间。
- 生成后自动跳到需要审核的学生。

对于几十个学生的班级，这个体验会很明显。

### 5.5 Prompt 实验室

设置抽屉中的 prompt 编辑可以升级为 Prompt 实验室：

- Recipe 编辑。
- 输入样例。
- 一键测试多个学生。
- 对比不同 prompt 输出。
- 显示质量检查结果。
- 保存为学科模板。
- 支持“保守”“均衡”“鼓励型”“问题明确型”等风格预设。

重要的是让教师能迭代 prompt，而不是直接改一大段系统提示词后盲测。

### 5.6 反馈质量检查

新增“质量检查”功能：

- 是否过短/过长。
- 是否缺少建设性建议。
- 是否语气太严厉。
- 是否出现虚构细节倾向。
- 是否包含其他学生姓名。
- 是否和本次输入矛盾。
- 是否与同班其他反馈过于相似。

检查可以分为规则检查和 LLM 检查：

- 规则检查：长度、姓名、禁词、重复度。
- LLM 检查：事实一致性、语气、完整性。

### 5.7 结构化输入升级

当前 V2 字段是整体、掌握、专注、互动、其他。可以进一步增强：

- 作业/作品完成情况。
- 情绪状态。
- 合作情况。
- 独立解决问题能力。
- 课堂纪律。
- 需要家长配合事项。
- 教师特别备注。

不建议一开始全部显示。应做成可配置字段：

- 基础模式：5 个字段。
- 扩展模式：更多字段。
- 学科模板：编程、机器人、英语、数学等不同字段。

### 5.8 导出与发布能力

当前主要导出 Markdown 到剪贴板。后续可以增加：

- 导出 Word/HTML。
- 按学生生成独立文本。
- 导出为机构固定格式。
- 批量复制“仅反馈正文”。
- 生成家长群发送格式。
- 生成带课程摘要的整班报告。

如果未来有后端或账号系统，可以考虑：

- 家长端查看链接。
- 教师端历史归档。
- 多设备同步。

### 5.9 数据备份与迁移

新增完整数据管理：

- 导出全部数据，覆盖 localStorage 和 IndexedDB。
- 导入前预览影响。
- 自动创建备份点。
- 数据版本迁移。
- 单班级导入导出。
- 单学生历史迁移。

这对长期使用非常关键，因为教师数据会逐渐变得有价值。

### 5.10 多学科模板

项目现在偏编程和机器人。可以抽象学科：

- 编程。
- 机器人。
- 科学实验。
- 数学思维。
- 英语口语。
- 美术/创意。

每个学科可以有：

- 输入字段。
- Prompt recipe。
- 评价维度。
- 推荐措辞。
- 禁止措辞。
- 导出模板。

## 6. 交互体验增强

### 6.1 从表单页升级为工作台

当前页面是课程信息卡片 + 学生输入卡片 + 侧边锚点。后续可以变成三栏工作台：

```text
左侧：班级与学生导航
中间：当前学生输入与反馈编辑
右侧：AI 建议、历史、质量检查、导出预览
```

优点：

- 单个学生编辑更聚焦。
- 历史和 AI 建议可以常驻右侧。
- 不需要滚动很长的学生卡片列表。

保留批量视图作为另一个模式：

- 列表模式：快速录入全班表现。
- 聚焦模式：逐个审核反馈。
- 总览模式：看班级仪表盘。

### 6.2 审核流程

建议把生成后的状态改成明确流程：

```text
待填写 -> 可生成 -> 生成中 -> 待审核 -> 已确认 -> 已导出
```

每个学生卡片显示状态，不只是内容折叠面板。

教师可以：

- 标记已审核。
- 标记需要重写。
- 标记不导出。
- 添加内部备注。

### 6.3 输入效率

增强方向：

- 表格化快速录入。
- 支持粘贴名单和表现矩阵。
- 支持快捷短语。
- 支持键盘命令面板。
- 支持“套用上一位学生的字段结构，但清空具体内容”。
- 支持批量设置某一字段，例如全班掌握情况默认为“良好”。

### 6.4 AI 可控性

教师应该能清楚控制 AI：

- 生成风格：温和、平衡、直接、鼓励。
- 细节程度：简短、标准、详细。
- 建议强度：轻提醒、明确建议。
- 是否允许提及历史进步。
- 是否允许使用全班背景。
- 是否启用二次质量检查。

这些不应全部藏在 prompt 文本里，而应变成 UI 上的可选项，再由 `promptCompiler` 编译为 prompt。

### 6.5 差异与重复提醒

批量生成后，可以显示：

- 哪些学生反馈太像。
- 哪些学生反馈缺少个人特点。
- 哪些学生反馈出现相同开头。
- 哪些学生反馈可能过于负面。

这对批量反馈很重要，因为“每个人都像模板”是家长端最容易感知的问题。

### 6.6 历史上下文可视化

当 AI 使用历史评价时，界面应显示：

```text
本次生成使用了以下历史摘要：
- 2026-05-20：互动积极，但细节检查需要提醒。
- 2026-05-27：独立完成能力提升。
```

教师可以在生成前取消某条历史摘要。

这能显著降低“AI 偷偷参考旧内容”的不信任感。

## 7. Prompt 工程迭代方案

### 7.1 先定义输出契约

Prompt 迭代前先固定输出契约：

```ts
interface OutputContract {
  minChineseChars: number;
  maxChineseChars: number;
  requireStrength: boolean;
  requireImprovementSuggestion: boolean;
  forbidTitle: boolean;
  forbidBulletList: boolean;
  forbidOtherStudentNames: boolean;
  forbidInventedExamples: boolean;
  tone: "warm" | "balanced" | "direct";
}
```

输出契约稳定后，prompt 才容易评估。

### 7.2 再定义上下文契约

```ts
interface ContextContract {
  classContextUsage: "none" | "toneOnly" | "summaryOnly";
  historyUsage: "none" | "continuityOnly" | "profileAllowed";
  currentInputPriority: "absolute";
  conflictResolution: "preferCurrentInput";
  maxHistorySummaryChars: number;
  maxClassSummaryChars: number;
}
```

这能避免 prompt 版本之间不可控地变化。

### 7.3 建立测试样例集

Prompt 实验至少需要这些样例：

- 表现非常好。
- 表现一般但有亮点。
- 有明显问题但需要委婉。
- 本次表现和历史相反。
- 历史中有负面记录但本次进步。
- 全班普遍表现差但目标学生表现好。
- 全班普遍表现好但目标学生需要提醒。
- 学生姓名容易混淆。
- 输入很短。
- 输入有强烈负面词。

每次改 prompt，对样例集跑一遍，观察输出质量。

### 7.4 自动评估维度

可以把评估结果做成分数：

```ts
interface FeedbackQualityReport {
  lengthScore: number;
  fidelityScore: number;
  specificityScore: number;
  toneScore: number;
  balanceScore: number;
  contaminationRisk: number;
  duplicateRisk: number;
  issues: string[];
}
```

不一定要完全由 LLM 判断，早期规则检查就很有帮助。

### 7.5 Prompt 版本发布

Prompt recipe 可以像代码一样有版本：

- draft：测试中。
- active：默认使用。
- archived：停用。

每个反馈记录保存 recipeId 和 version。这样未来发现某个 prompt 版本质量不好，可以追溯。

## 8. 迁移路线

### 8.1 第一阶段：稳定基础

目标：在不大改 UI 的前提下，先建立可测试的业务内核。

任务：

- 抽出领域类型。
- 抽出 `replaceTemplate`、导出、学生名单解析等纯函数。
- 建立 Vitest。
- 修复 dayjs 直接依赖。
- 修复备份导出 raw string 问题。
- 减少调试日志。
- 修复 API message 累积风险。

收益：

- 立刻降低回归风险。
- 为后续重构铺路。

### 8.2 第二阶段：Zustand 状态重构

目标：让 store 成为业务状态源。

任务：

- 建立 `courseStore`、`rosterStore`、`feedbackStore`、`aiStore`、`settingsStore`。
- 把 `useStudentsManager` 迁移到 `rosterStore`。
- 把模板、提示词、模型配置迁移到独立 store。
- 表单从“事实源”变成“编辑草稿”。
- 将持久化统一接入 repository。

收益：

- `MainUI` 变薄。
- 功能扩展不再牵一发动全身。

### 8.3 第三阶段：AI 管线重构

目标：从单次请求变成可观察、可评估、可回放的生成流程。

任务：

- 建立 `AIClient` provider adapter。
- 建立 `generationOrchestrator`。
- 建立 `promptCompiler`。
- 建立 `contextPlanner`。
- 建立 `outputValidator`。
- 保存 `PromptTrace`。
- 支持生成任务队列和失败重试。

收益：

- AI 能力可以独立迭代。
- 质量问题有迹可循。

### 8.4 第四阶段：历史评价与全班视野

目标：引入上下文增强，但严格控制污染。

任务：

- 建立反馈历史表。
- 建立学生长期画像。
- 建立班级分析流程。
- 建立上下文策略 UI。
- 建立污染检测。
- 建立 prompt 实验样例集。

收益：

- 反馈更连续、更个性化。
- 保持质量可控。

### 8.5 第五阶段：工作台体验升级

目标：把工具从“表单生成器”升级为“反馈生产工作台”。

任务：

- 三栏布局。
- 班级仪表盘。
- 批量生成任务面板。
- 单生审核面板。
- 历史上下文可视化。
- 质量检查和重复度提醒。
- 版本对比。

收益：

- 教师使用时更快、更安心。
- 大班级批量处理体验更好。

## 9. 风险与取舍

### 9.1 重构风险

全面重构最大风险是把已可用的工具改坏。因此推荐：

- 先抽纯函数和测试。
- 再迁移状态。
- 再替换 AI 管线。
- 最后改 UI。

不要一开始同时改数据模型、store、AI、UI。

### 9.2 Prompt 复杂度风险

复杂 prompt 不一定更好。需要控制：

- 上下文长度。
- 信息优先级。
- 历史摘要数量。
- 班级信息使用范围。
- 输出评估。

建议保留一个“简单生成模式”，作为复杂上下文策略失败时的回退。

### 9.3 本地优先与后端能力的取舍

纯前端部署简单，但会限制：

- API Key 安全。
- 多设备同步。
- 向量检索。
- 团队协作。
- 长期数据备份。

可以先保持本地优先，同时预留 repository/service 接口。未来如果要加后端，UI 和业务逻辑不需要大改。

## 10. 推荐的近期落地顺序

如果只选最值得做的 10 件事，建议顺序如下：

1. 引入 Vitest，给模板替换、学生名单解析、导出逻辑补测试。
2. 抽出 `AIClient` 和 provider adapter，修复 message 累积问题。
3. 抽出 `promptCompiler`，把 prompt 从字符串升级为 recipe。
4. 建立 `PromptTrace`，保存每次生成的 recipe、模型、上下文策略和输出。
5. 把学生从 index 关联迁移为稳定 ID。
6. 建立 `feedbackStore` 和 `rosterStore`，逐步瘦身 `MainUI`。
7. 新增反馈历史保存和学生历史摘要。
8. 新增班级分析 summary，但只作为 tone/context calibration。
9. 新增污染检测：其他学生姓名、虚构事实、历史覆盖本次输入。
10. 做批量生成任务面板和单生审核状态。

## 11. 最终愿景

理想形态下，这个项目可以成为一个“教师反馈生产系统”：

- 输入层帮助教师快速记录每个学生的真实课堂表现。
- 记忆层保留学生成长轨迹，但不固化负面标签。
- AI 层根据课程、学生、本次表现、历史摘要和班级校准生成高质量反馈。
- 检查层防止虚构、串人、重复、语气失衡。
- 交互层让教师清楚看到 AI 使用了什么、生成了什么、哪里需要审核。
- 导出层适配不同机构、家长沟通渠道和格式要求。

这条路线最重要的不是“让 AI 参与更多”，而是让 AI 在清晰边界内参与得更可靠。全班视野和历史评价应该成为反馈质量的辅助燃料，而不是污染上下文的噪声源。
