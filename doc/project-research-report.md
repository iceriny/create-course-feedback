# create-course-feedback 项目整体研究报告

生成时间：2026-06-03
本次同步更新：2026-06-04

## 1. 项目概览

`create-course-feedback` 是一个面向教育工作者的纯前端课程反馈生成工具。它的核心目标是把教师已经掌握的课堂信息、学生名单、学生表现关键词或结构化评价，组合为可复制导出的 Markdown 反馈内容；其中“课堂表现”部分可以通过大语言模型自动优化扩写。

从代码看，项目不是一个通用聊天应用，而是一个围绕“课后反馈生产”设计的工作台：

- 教师输入班级、课程名称、授课时间、课程内容、教学目标。
- 教师维护学生名单，并为每个学生填写表现信息。
- 应用把课程信息、学生姓名、学生表现和提示词组装为 AI 请求。
- AI 返回每个学生的反馈正文后，应用再套入导出模板。
- 最终产物通过剪贴板导出为 Markdown。

项目当前版本来自 `package.json` 的 `0.6.4`，版本更新清单位于 `public/version-list.json` 与 `public/versions/*.json`。最新 `0.6.4` 更新说明是“修复了性别字段没有被正确传递的问题”。

## 2. 技术栈与工程形态

### 2.1 前端技术栈

项目采用 Vite + React + TypeScript：

- 应用入口：`src/main.tsx`
- 根组件：`src/App.tsx`
- 页面外壳：`src/Page.tsx`
- 业务主控组件：`src/components/MainUI.tsx`
- UI 组件库：Ant Design 6
- 状态管理：React state/hooks + Zustand
- 本地持久化：`localStorage` + Dexie/IndexedDB
- AI 调用：浏览器端 `fetch` 直接请求各模型服务商接口

`vite.config.ts` 注入 `__APP_VERSION__`，配置 `vite-plugin-svgr`、生产构建压缩、手动分包和 `rollup-plugin-visualizer`。构建时 React/Ant Design 被归入 `vendor-react-antd`，DayJS 单独归入 `vendor-dayjs`。本次依赖升级后，项目使用 React 19.2、Ant Design 6、Vite 8 和 `@vitejs/plugin-react` 6，`src/main.tsx` 不再需要 Ant Design v5 的 React 19 patch。

### 2.2 依赖与包管理

`package.json` 指定 `packageManager` 为 Yarn 4.16.0。项目通过 Corepack 使用 Yarn，并在 `.yarnrc.yml` 中设置 `nodeLinker: node-modules`，因此依然使用项目本地 `node_modules`。仓库已移除 npm lockfile，实际依赖锁定以 `yarn.lock` 为准。

值得注意的是，项目源码多处直接 `import dayjs from "dayjs"`，但 `package.json` 的直接依赖中没有声明 `dayjs`。目前构建能成功，通常是因为 Ant Design 间接安装了 DayJS；不过直接使用转移依赖属于隐性风险，建议把 `dayjs` 加入直接依赖。

### 2.3 构建与部署

仓库包含两个 GitHub Pages 工作流：

- `.github/workflows/main.yml`：推送 `main` 后构建并部署到 `fb.teaching.misssu.cn`
- `.github/workflows/dev.yml`：推送 `dev` 后构建并部署到 `/dev/`

生产构建命令是：

```bash
yarn build
```

脚本实际执行：

```bash
tsc -b && vite build
```

这意味着生产构建包含 TypeScript 项目引用检查。

## 3. 模块结构

### 3.1 顶层渲染链路

`src/main.tsx` 创建 React root，并在 `StrictMode` 中渲染 `App`。

`src/App.tsx` 做三件事：

- 配置 Ant Design 中文 locale 与基础主题。
- 创建全局 message API，将 `sendMessage` 和 `sendWarning` 传给 `Page`。

`src/Page.tsx` 负责页面布局：

- Header 显示 Logo、标题“课程反馈生成器”和版本号。
- Content 渲染 `MainUI`。
- Footer 显示作者信息。

### 3.2 业务中枢：MainUI

`src/components/MainUI.tsx` 是项目最关键的业务编排文件。它同时管理：

- 课程信息表单 `class_form`
- 学生表现表单 `content_form`
- 学生列表和学生动态信息
- AI 提示词与模型设置
- 课程历史记录
- 反馈模板和签名
- AI 请求节流状态
- 批量导出和单人导出
- 设置抽屉和模板编辑器弹窗

这使得 `MainUI` 成为当前的数据流中心。多数业务数据会先进入 `MainUI` 的 state/ref，再被分发给子组件或工具函数。

### 3.3 学生管理

学生管理逻辑位于 `src/hooks/useStudentsManager.ts`，拆分为两类数据：

- `studentsList`：学生基础信息，包括姓名、性别、输入版本。
- `studentsInfo`：运行时动态信息，包括 AI 输出、思考内容、加载状态、是否激活。

学生名单以 `${className}_std` 为 key 存入 `localStorage`。hook 兼容旧格式：

- 旧格式：字符串数组，例如 `["张三", "李四"]`
- 新格式：对象数组，例如 `{ name, gender, version }`

新增学生默认 `gender: "male"`、`version: "v2"`。

### 3.4 输入助手记忆

输入助手状态位于 `src/store/InputAssistantStore.ts`，使用 Zustand 管理，并通过 `src/utils/dexieStorage.ts` 写入 IndexedDB。

它管理两类数据：

- V1 输入建议：按班级保存文本建议，每班最多 50 条。
- V2 快捷选项：按字段保存自定义选项，每字段最多 20 条，并与默认选项合并去重。

Dexie 数据库定义在 `src/db/db.ts`，库名为 `StorageDatabase`，只有一个 `storage` 表，主键是 `key`。

### 3.5 AI API 层

AI 调用封装在 `src/AI_API/API.ts`。

它支持的供应商包括：

- 硅基流动
- OpenAI
- DeepSeek
- Gemini
- 自定义 OpenAI-compatible 服务

主要配置通过 `localStorage` 保存：

- `api_key`
- `api_provider`
- `custom_provider_config`
- `custom_model`
- `ai-model`

`API` 类内部实现了一个请求队列和限流策略：

- 每秒最多 3 个请求
- 每分钟最多 10 个请求
- 超过分钟限制时通过 throttle listener 通知 UI 显示提示

非 Gemini 供应商使用 OpenAI chat completions 风格的流式接口；Gemini 使用单独的 `contents`/`generationConfig` 请求结构。

### 3.6 模板系统

模板替换函数位于 `src/utils/template.ts`。支持的主要占位符包括：

- `{{studentName}}`
- `{{lastName}}`
- `{{firstName}}`
- `{{courseName}}`
- `{{courseTime}}`
- `{{courseContents}}`
- `{{courseObjectives}}`
- `{{courseFeedback}}`
- `{{signature}}`
- `{{currentDate}}`

`src/components/TemplateEditor.tsx` 提供模板编辑 UI，保存后写入：

- `feedback-template`
- `signature`

默认模板和 AI 请求模板都定义在 `MainUI` 中。默认导出模板包含课程信息、课堂表现、签名和日期；AI 请求模板只包含课程信息，不包含最终导出的外层结构。

本次改动后，`MainUI` 不再维护独立的 `exportTemplate` state 或 `aiTemplateRef` 缓存，而是在 AI 发送和导出时通过 `getCourseTemplateContext()` 同步读取当前表单，再用 `replaceTemplate` 编译课程上下文。这修复了课程字段已经保存但发送给 AI 的内容仍保留 `{{courseName}}`、`{{courseTime}}` 等占位符的问题。

### 3.7 版本更新提示

`src/Version.ts` 读取：

- `public/version-list.json`
- `public/versions/{version}.json`

它会从 `localStorage.version` 判断用户之前看到过的版本，筛选新增版本并在 `src/updateInfo.tsx` 中弹窗显示更新内容。

## 4. 数据流向

### 4.1 整体数据流

```text
教师输入
  |
  |-- 课程信息表单
  |     -> MainUI.handleSubmit
  |     -> localStorage[className]
  |     -> localStorage["class-name"]
  |     -> localStorage["class-history"]
  |     -> getCourseTemplateContext()
  |     -> AI 发送和导出时按需编译模板
  |
  |-- 学生名单输入
  |     -> StringListInput
  |     -> useStudentsManager.updateStudentsFromRawValues
  |     -> localStorage[`${className}_std`]
  |     -> studentsList / studentsInfo
  |
  |-- 学生表现输入
  |     -> content_form
  |     -> V1: content[index]
  |     -> V2: content[index].total / mastery_situation / attention / interaction / other
  |     -> IndexedDB 输入建议或快捷选项
  |
  |-- 设置输入
        -> SettingsDrawer
        -> localStorage api/model/prompt/template 相关 key
```

之后进入两条主要产出路径：

```text
AI 生成路径:
当前课程上下文 + 提示词 + 学生姓名 + 学生表现
  -> new API().sendMessage(...)
  -> 供应商接口
  -> streaming content/reasoning_content
  -> studentsInfo[index].content / think_content
```

```text
导出路径:
当前课程上下文 + studentsList + studentsInfo[index].content + customTemplate
  -> replaceTemplate(...)
  -> Markdown 字符串
  -> navigator.clipboard.writeText(...)
```

### 4.2 课程信息流

课程信息由 `CourseInfoCard` 采集，包括：

- 班级名
- 课程名称
- 授课时间范围
- 课程内容列表
- 教学目标列表

`MainUI.handleSubmit` 会做以下处理：

1. 从 Ant Design form 读取字段。
2. 通过 `normalizeCourseItems` 清理课程内容和教学目标。
3. 通过 `hasCompleteCourseTime` 确认授课时间完整。
4. 将班级时间保存到 `localStorage[className]`。
5. 将班级名加入 `localStorage["class-name"]`。
6. 将课程内容加入 `localStorage["class-history"]`，最多保留 20 条。
7. 标记 `isFinishedRef.current = true`。

AI 请求和导出不会依赖上一次提交时缓存的模板字符串，而是调用 `getCourseTemplateContext()` 读取当前表单。课程信息不完整时，AI 生成和导出会提示先补完整课程信息。

历史记录导入时，`handleLoadHistoryData` 会回填课程名称、课程内容和教学目标，然后再次调用 `handleSubmit`。

班级导入时，`importClass` 会读取 `localStorage[className]`，将历史授课时间平移到“上周同一天同一时间”，再加载该班学生名单。

`CourseInfoCard` 的班级名输入已经从普通选择改为更完整的自动完成流程：输入框获得焦点时会展开已保存班级；搜索时按输入过滤；选择、按 Enter 或失焦时会尝试匹配已有班级并触发 `onClassSelect`。匹配逻辑支持大小写不敏感，失焦加载带有短延迟，用于避开点击下拉选项时的事件竞争。授课时间、课程内容和教学目标的编辑也会请求自动提交，从而减少教师额外点击。

### 4.3 学生名单流

学生名单由 `StringListInput` 输入。它支持：

- 逐个输入姓名
- 逗号分隔批量输入
- 删除空白项
- 激活/取消激活
- 清空
- 排序
- 复制名单

当名单变化时，`MainUI` 调用 `updateStudentsFromRawValues(raw_values, className)`。

该函数会：

1. 要求班级名不能为空。
2. 展开逗号分隔姓名。
3. 去除批量输入中的重复值。
4. 尽量保留已有学生的性别和输入版本。
5. 重建 `studentsList`。
6. 初始化 `studentsInfo`。
7. 保存到 `localStorage[`${className}_std`]`。

### 4.4 学生表现输入流

学生表现输入分为 V1 和 V2。

V1：`src/components/StudentContentCard/StudentInputs/V1Input.tsx`

- 每个学生一个 AutoComplete 输入框。
- 表单字段是 `content[index]`。
- 根据班级名读取历史建议。
- 输入确认后写入 IndexedDB 的 V1 建议。

V2：`src/components/StudentContentCard/StudentInputs/V2Input.tsx`

- 每个学生五个字段：
  - 整体表现 `total`
  - 掌握情况 `mastery_situation`
  - 专注度 `attention`
  - 互动 `interaction`
  - 其他 `other`
- 表单字段是 `content[index][field]`。
- 每个字段从默认选项 + 自定义选项中提供 AutoComplete。
- 输入确认后写入 IndexedDB 的 V2 自定义选项。

在 AI 请求前，V2 输入会被 `getStudentContentV2Text` 合成为：

```text
性别:{gender},整体表现:{total},掌握情况:{mastery_situation},专注度:{attention},参与度:{interaction},其他:{other}
```

### 4.5 AI 请求与响应流

批量 AI 优化由 `handleAIOptimize` 触发。它会先检查：

- 课程信息是否已经提交。
- API Key 是否存在。

然后遍历所有激活学生，对每人调用 `handleSingleAIOptimize(index)`。

单人 AI 请求包含四类 message：

1. system：当前提示词。
2. user：实时编译后的课程信息。
3. user：学员姓名。
4. user：学生课堂表现原始内容。

AI 响应流中：

- `reasoning_content` 写入 `studentsInfo[index].think_content`
- `content` 写入 `studentsInfo[index].content`
- 完成后会清理模型输出中可能混入的“课堂表现”标题、日期和默认签名。

### 4.6 导出流

导出分为三种：

- 单个学生导出：学生卡片右侧复制按钮。
- 全部导出：右下角普通浮动按钮。
- 过滤导出：右下角主色浮动按钮，只导出已激活且内容非空的学生。

导出过程都依赖 `replaceTemplate`：

```text
customTemplate + 当前课程字段 + 学生姓名 + studentsInfo[index].content
  -> Markdown
  -> clipboard
```

导出结果按学生加 `### 学生名` 标题，并在批量导出中使用 `---` 分隔。

## 5. 持久化数据清单

### 5.1 localStorage

| Key | 含义 | 写入位置 |
| --- | --- | --- |
| `class-name` | 已使用班级名数组 | `addToLocalStorageArray` |
| `{className}` | 班级最近授课时间 | `MainUI.handleSubmit` |
| `{className}_std` | 班级学生名单与学生基础信息 | `useStudentsManager` |
| `class-history` | 课程历史记录，最多 20 条 | `MainUI.handleSubmit` |
| `feedback-template` | 自定义反馈模板 | `TemplateEditor` / `MainUI` |
| `signature` | 自定义签名 | `TemplateEditor` / `MainUI` |
| `api_key` | AI API Key | `SettingsDrawer` |
| `api_provider` | AI 供应商 | `API.setProvider` |
| `ai-model` | 当前模型 | `MainUI.handleSetModel` |
| `custom_model` | 自定义模型名 | `API.setCustomModel` |
| `custom_provider_config` | 自定义供应商 URL 配置 | `API.setCustomProviderConfig` |
| `prompts` | 自定义提示词 | `savePromptToLocalStorage` |
| `promptKey` | 当前提示词 key | `SettingsDrawer` |
| `version` | 已查看版本号 | `Version.checkForUpdates` |

### 5.2 IndexedDB

Dexie 数据库：`StorageDatabase`

| Key | 含义 |
| --- | --- |
| `v1_input_suggestions` | V1 按班级保存的输入建议 |
| `v2_quick_options` | V2 五个字段的自定义快捷选项 |

## 6. 项目评估

### 6.1 优点

项目目标明确，业务闭环完整。它不是泛泛地“调用 AI”，而是围绕教师课后反馈这个高频工作流提供了从输入、生成到导出的完整路径。

本地优先的设计降低了部署复杂度。课程、学生、模板、提示词、API 配置都保存在浏览器本地，GitHub Pages 即可部署，不需要后端数据库或服务端运维。

学生输入体验有明显迭代。V1 的自由文本适合快速输入，V2 的结构化字段适合批量稳定生产反馈。输入建议和快捷选项会被自动记忆，符合教师重复处理相似班级和相似评价的使用场景。

课程信息交互正在向“少点提交、多用自动完成”的方向收敛。班级名输入现在能在获得焦点时直接显示已保存班级，并在选择、回车或失焦时加载班级信息；课程时间、课程内容和教学目标的修改也会触发自动保存。

AI 提示词和供应商配置比较灵活。项目支持多个常见 AI 供应商和自定义兼容接口，也允许自定义提示词，实际使用时不被单一服务商锁死。

模板系统有实际价值。最终导出不是简单拼接 AI 输出，而是允许教师维护格式、签名、日期和课程字段，从而适配不同教学机构或家长沟通格式。

本次模板链路修复也验证了一个重要方向：AI 请求前必须明确编译课程上下文，不能把可见模板、缓存模板和表单草稿混在一起。当前 `getCourseTemplateContext()` / `getAIClassContent()` 仍在 `MainUI` 内，但已经比旧的 `aiTemplateRef` 缓存更可控。

工程配置有基础质量保障。TypeScript 开启 strict，生产构建执行 `tsc -b`，ESLint 与 GitHub Pages 部署工作流已经配置。

### 6.2 主要风险

第一，API Key 保存在浏览器 `localStorage`，且由前端直接请求 AI 供应商。对于纯前端工具这是实现上最简单的方案，但安全边界较弱：浏览器扩展、XSS、共享电脑或导出的备份文件都可能暴露密钥。报告不建议立即强制引入后端，但需要在产品说明和备份导出中明确风险。

第二，`MainUI.tsx` 承载了过多职责。课程提交、历史迁移、学生管理、AI 调用、导出、模板状态、设置弹窗、节流 UI 都集中在一个组件中。短期可维护，长期继续加功能会变得难以测试和重构。

第三，AI API 类存在状态累积风险。`API._sendMessage` 使用 `this.messages.messages = this.messages.messages.concat(message)`，同一个 API 实例如果复用，历史 message 会持续累积。当前 `MainUI` 每次单人生成都会 `new API()`，因此实际影响被削弱，但类设计本身容易产生隐蔽上下文污染。

第四，Gemini 兼容层可能不完整。`_sendGeminiMessage` 把 `system` 角色原样映射到 Gemini `contents` 角色，而 Gemini API 对 role 的要求和 OpenAI 不同；同时 Gemini 默认 URL 使用 `gemini-pro:generateContent`，模型选择与实际 URL 的关系不够一致。

第五，项目没有发现测试文件。当前验证主要依赖 TypeScript、ESLint 和人工操作。对模板替换、历史迁移、学生名单解析、AI 流式解析、导出过滤这些核心逻辑来说，缺少自动化测试会增加回归风险。

第六，依赖声明仍有一个小的不一致：源码直接使用 DayJS，但 `package.json` 未声明直接依赖。目前包管理已经收敛到 Yarn 4 + `yarn.lock`，npm lockfile 混用问题已解决。

第七，运行期调试日志较多。`API.ts`、`MainUI.tsx`、`CourseInfoCard.tsx`、`SettingsDrawer.tsx` 等文件仍有多处 `console.log`。生产构建配置会移除部分 console，但调试日志仍会影响开发噪声，也可能在非生产构建中暴露请求内容。

第八，备份/导入功能存在一致性问题。它只覆盖 `localStorage`，没有覆盖 IndexedDB，因此不会导出 V1/V2 输入助手记忆；同时导出时会对每个 `localStorage` value 执行 `JSON.parse`，像 `api_key`、`signature`、`feedback-template`、`api_provider`、`promptKey` 这类以原始字符串保存的 key 可能解析失败并被跳过。

第九，自定义提示词保存逻辑有一个实现疑点。`savePromptToLocalStorage` 内部创建了用于过滤默认提示词的 `_t`，但最终保存的是完整 `prompts` 对象而不是 `_t`，因此默认提示词也会被一起写入本地存储。

### 6.3 当前质量信号

本次检查执行了：

```bash
yarn lint
yarn build
```

结果：

- `yarn lint` 成功，`src/updateInfo.tsx` 的 hook dependency warning 已通过 `useMemo` 稳定 `Version.getInstance()` 后清理。
- `yarn build` 成功，执行了 `tsc -b && vite build`。
- Ant Design 6 迁移相关的主要 warning 已处理：`CourseInfoCard` 使用 `onOpenChange`，`Input addonBefore/addonAfter` 改为 `Space.Compact`，`updateInfo.tsx` 不再依赖旧的 `List` 用法。
- Vite 构建输出中 `vendor-react-antd` gzip 后约 305 KB，是最大的 chunk。
- 构建输出提示 `baseline-browser-mapping` 数据超过两个月，建议更新。
- 未发现 `*.test.*`、`*.spec.*` 或 `__tests__` 测试文件。

## 7. 改进建议

### 7.1 高优先级

1. 给核心纯函数补测试。
   - `replaceTemplate`
   - 学生名单解析与去重
   - `class-history` 迁移逻辑
   - 批量导出过滤逻辑
   - OpenAI 风格流式响应解析

2. 拆分 `MainUI`。
   - 课程信息状态与历史记录可抽成 `useCourseInfoManager`。
   - 模板导出可抽成 `useFeedbackExport` 或纯函数模块。
   - AI 生成流程可抽成 `useFeedbackGeneration`。

3. 明确 API Key 风险。
   - 设置抽屉中提示密钥保存在本地浏览器。
   - 备份导出时提醒导出文件可能包含 API Key。
   - 如果未来面向更多用户，可考虑后端代理或用户自托管代理。

4. 修正依赖声明。
   - 把 `dayjs` 加入 `dependencies`。
   - 保持 Corepack + Yarn 4 + 本地 `node_modules` 作为默认安装方式。

### 7.2 中优先级

1. 改造 `API` 类的消息构造方式。
   - 每次请求使用局部 request body。
   - 避免实例字段 `messages.messages` 累积历史上下文。
   - 将不同 provider 的 payload 构造拆成独立函数。

2. 抽出课程上下文与模板编译。
   - 将 `getCourseTemplateContext()` 从 `MainUI` 移到可测试的 service 或纯函数模块。
   - 将 AI 课程上下文和导出模板编译拆成明确的 compiler。
   - 为“课程信息不完整”“模板占位符替换”“列表项清理”补测试。

3. 补全备份能力。
   - 当前只导出 localStorage。
   - 输入助手数据在 IndexedDB，应纳入备份/恢复。
   - 对 raw string 和 JSON string 两种 localStorage 值做统一序列化，避免模板、签名、提示词 key 等被跳过。

4. 减少调试日志。
   - 保留必要错误日志。
   - 删除会打印请求体、学生表单内容、API body 的日志。

5. 强化错误反馈。
   - AI 请求失败时目前主要 `console.error`，用户侧反馈不足。
   - 应把网络错误、认证失败、模型列表加载失败等展示为 message 或卡片状态。

6. 修正自定义提示词持久化。
   - 明确只保存自定义提示词，或接受保存完整提示词集合。
   - 如果要只保存自定义提示词，应把 `savePromptToLocalStorage` 最终写入值改为过滤后的对象。

### 7.3 低优先级

1. 优化 bundle。
   - `vendor-react-antd` 较大，可以继续观察按需加载效果。
   - 已有 lazy import 和 manualChunks，后续可按实际首屏指标优化。

2. 统一日期 locale。
   - `App.tsx` 注释写“设置 dayjs 默认语言为英文”，并执行 `dayjs.locale("en")`；但 Ant Design locale 是 `zh_CN`，应用内容也是中文。建议确认日期展示是否需要中文语境。

3. 整理命名和文案。
   - `TemplateEditor` 中“著名”应为“署名”。
   - `globle.d.ts` 文件名可改为 `global.d.ts`。

## 8. 总结

这个项目已经具备清晰的产品价值和可用闭环：教师输入课程与学生表现，AI 扩写课堂反馈，模板化导出 Markdown。它的强项在于工作流贴近实际教学场景、本地部署简单、输入效率持续优化、AI 供应商配置灵活。

当前最值得投入的方向不是大改 UI，而是增强可维护性和可信度：拆分 `MainUI`，为核心数据转换补测试，修正前端密钥与备份提示，整理依赖和 API 请求状态。完成这些后，项目会从“可用工具”更稳地走向“可长期迭代的教学生产力应用”。
