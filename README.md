# 课程反馈生成工具

这是一个纯前端工具应用，帮助教师快速批量生成课程反馈内容，并以 Markdown 格式输出到剪贴板。

## 功能特点

-   课程信息管理（课程名称、授课时间）
-   课程内容和教学目标的添加与管理
-   学生名单的动态添加与删除
-   为每位学生添加个性化课堂表现评价
-   一键生成所有学生的课程反馈并复制到剪贴板
-   Markdown 格式输出，方便粘贴到各种支持 Markdown 的平台

## TODO:

-   [x] 学生名单持久化保存(localStorage & jsonFiles)
-   [ ] 点击学生标号跳转到对应学生的课程反馈.
-   [ ] 反向解析 Markdown 格式的课程反馈，生成对应课程模板
-   [ ] 调用自己的 大模型 API 通过自己写的关键词生成课程反馈
-   [x] 页面美化

## 技术栈

-   React + TypeScript
-   Ant Design 组件库
-   Dayjs 日期处理

## 使用方法

1. 填写课程基本信息（课程名称、授课时间）
2. 添加课程内容和教学目标
3. 点击"提交"保存课程模板
4. 添加学生名单
5. 为每位学生填写个性化的课堂表现评价
6. 点击右下角的导出按钮，将所有学生的反馈内容复制到剪贴板
7. 粘贴到您需要的地方（如文档、邮件等）

## 本地开发

### 环境要求

-   Node.js (v14.0.0+)
-   npm 或 yarn

### 安装依赖

```bash
npm install
# 或
yarn
```

### 启动开发服务器

```bash
npm run dev
# 或
yarn dev
```

### 构建生产版本

```bash
npm run build
# 或
yarn build
```

## 项目结构

-   `src/App.tsx` - 应用入口组件
-   `src/Page.tsx` - 主页面组件，包含表单和反馈生成逻辑
-   `src/StringListInput/` - 学生名单输入组件
    -   `Main.tsx` - 学生列表管理组件
    -   `SingleStringInput.tsx` - 单个学生输入组件
    -   `index.ts` - 导出组件

## 贡献指南

欢迎提交问题和功能请求！如果您想贡献代码，请遵循以下步骤：

1. Fork 该仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 许可证

[MIT](LICENSE)
