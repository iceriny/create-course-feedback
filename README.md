# 课程反馈生成工具

![正式版](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ficeriny%2Fcreate-course-feedback%2Frefs%2Fheads%2Fmain%2Fpackage.json&query=%24.version&label=%E6%AD%A3%E5%BC%8F%E7%89%88&color=green&labelColor=blue&link=https%3A%2F%2Ffb.teaching.misssu.cn%2F)
![正式版](https://img.shields.io/github/actions/workflow/status/iceriny/create-course-feedback/main.yml?label=正式版&color=green&labelColor=blue)

![开发版](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ficeriny%2Fcreate-course-feedback%2Frefs%2Fheads%2Fdev%2Fpackage.json&query=%24.version&label=开发版&color=green&labelColor=orange&link=https-dev.fb.teaching.misssu.cn)
![开发版](https://img.shields.io/github/actions/workflow/status/iceriny/create-course-feedback/dev.yml?label=开发版&color=green&labelColor=orange)

![许可证](https://img.shields.io/badge/许可证-MIT-purple.svg)

这是一个面向教育工作者的纯前端应用，旨在帮助教师快速高效地生成个性化课程反馈。通过直观的界面和 AI 辅助功能，教师可以为每位学生创建专业、个性化的课程反馈内容，并以 Markdown 格式导出。

## ✨ 主要特性

- **信息管理** - 便捷管理课程信息（名称、时间、内容、目标）和历史记录。
- **学生管理** - 动态添加、删除、禁用、排序和反选学生。
- **AI 辅助生成** - 一键调用 AI，根据学生表现和课程信息，自动生成高质量的课堂反馈。
- **结构化输入** - 提供两种学生表现输入模式（简易文本和结构化表单），以适应不同详细程度的需求。
- **自定义模板** - 灵活定制反馈模板，支持多种占位符和自定义签名。
- **批量与单独操作** - 支持一键生成和复制所有学生的反馈，也支持对单个学生进行操作。
- **本地存储** - 所有信息（课程、学生、设置）自动保存在浏览器本地，确保数据持久性。
- **配置灵活** - 支持自定义 AI 模型、API Key 和提示词（Prompt）。

## 🚀 最新功能 (v0.6.1)

- **结构化输入 V2** - 新增了更详细的学生表现输入模式，从整体、掌握情况、专注度、参与度等多个维度进行评价，使 AI 生成的反馈更具针对性。
- **学生信息管理** - 现在可以为每个学生设置性别，为未来更个性化的反馈（如代词使用）提供支持。
- **状态管理重构** - 将学生数据相关的逻辑抽象为自定义 Hook (`useStudentsManager`)，提升了代码的可维护性和复用性。
- **性能优化** - 采用组件懒加载和预加载技术，优化了应用的初始加载速度和用户体验。
- **UI 与交互优化** - 优化了学生列表的管理功能，增加了排序、反选、复制名称列表等便捷操作。

## 🛠️ 技术栈

- **React** + **TypeScript** - 现代前端框架和类型系统
- **Ant Design** - 美观且功能丰富的 UI 组件库
- **Vite** - 快速的前端构建工具
- **DayJS** - 轻量级日期处理库
- **LocalStorage** - 用于本地数据持久化存储

## 📋 使用方法

1. **输入课程信息**
   - 填写班级名称和课程名称。
   - 设置授课时间范围。
   - 添加课程内容和教学目标。
   - _（可选）_ 从历史记录中加载过往的课程信息。
   - 点击「提交」保存基本信息。

2. **添加学生名单**
   - 在右侧面板逐行或批量（使用逗号分隔）添加学生姓名。
   - 可对学生进行排序、禁用或反选。

3. **填写学生表现**
   - 为每位需要生成反馈的学生填写课堂表现。
   - 可在学生卡片右上角切换输入模式：
     - **V1 (简易模式)**: 直接输入一段描述性文本。
     - **V2 (结构化模式)**: 分别填写整体表现、掌握情况、专注度等字段。

4. **生成反馈内容**
   - 点击「AI 优化」为所有已启用且已填写表现的学生批量生成反馈。
   - 或使用单个学生卡片上的「重新生成」按钮单独生成。

5. **导出反馈内容**
   - 点击右下角悬浮按钮，可选择复制所有学生或仅复制有效学生（有内容且已启用）的反馈。
   - 或使用单个学生卡片上的复制按钮单独导出。
   - 将复制的内容粘贴到您需要的文档或平台。

6. **自定义设置**
   - 点击设置按钮，配置您的 AI API Key 和模型。
   - 点击「自定义模板」按钮，使用提供的占位符创建个性化模板和签名。

## 📦 本地开发

### 环境要求

- Node.js (v14.0.0+)
- npm 或 yarn

### 安装依赖

```bash
# 使用npm
npm install

# 或使用yarn
yarn
```

### 启动开发服务器

```bash
# 使用npm
npm run dev

# 或使用yarn
yarn dev
```

### 构建生产版本

```bash
# 使用npm
npm run build

# 或使用yarn
yarn build
```

## 🔧 配置 AI 功能

1. 在右上角点击设置按钮打开设置面板。
2. 输入您的 API 密钥。
3. 选择合适的 AI 模型。
4. 在「自定义提示词」中，您可以选择或自定义用于指导 AI 生成内容的指令模板。

## 🔜 未来计划

- [ ] 利用学生性别信息，生成包含正确代词的反馈。
- [ ] 反向解析 Markdown 格式的课程反馈，填充到应用内。
- [ ] 支持更多种类的提示词模板。
- [ ] 添加更多自定义主题选项。

## 📝 贡献指南

欢迎提交问题和功能请求！如果您想贡献代码，请遵循以下步骤：

1. Fork 该仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件
