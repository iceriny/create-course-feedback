import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { readFileSync } from "fs";
import { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf-8"),
);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({ svgrOptions: { icon: true } }),
    // 只在构建时启用 visualizer
    ...(process.env.NODE_ENV === "production"
      ? [
          visualizer({
            filename: "dist/stats.html",
            open: false,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  // 开发服务器优化
  server: {
    hmr: {
      overlay: false, // 关闭错误覆盖层以提升性能
    },
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "antd",
      "dayjs",
      "uuid",
      "@ant-design/icons",
    ],
  },
  build: {
    // 构建性能优化
    target: "esnext", // 使用现代 JS 语法减少打包体积
    sourcemap: process.env.NODE_ENV === "development", // 开发环境启用 sourcemap
    rollupOptions: {
      output: {
        // 优化代码分割策略 - 将 React 和 Ant Design 打包在一起以避免兼容性问题
        manualChunks: (id: string) => {
          // React 和 Ant Design 相关库打包在一起
          if (
            id.includes("react") ||
            id.includes("react-dom") ||
            id.includes("antd") ||
            id.includes("@ant-design") ||
            id.includes("rc-") ||
            id.includes("@rc-component")
          ) {
            return "vendor-react-antd";
          }

          // dayjs 单独打包
          if (id.includes("dayjs")) {
            return "vendor-dayjs";
          }

          // 其他小型依赖合并
          if (id.includes("node_modules")) {
            return "vendor-others";
          }
        },
        // 优化文件名
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
    // 设置更合理的 chunk 大小警告
    chunkSizeWarningLimit: 1000,
    // 启用代码压缩
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === "production", // 生产环境移除 console
        drop_debugger: true,
        pure_funcs:
          process.env.NODE_ENV === "production" ? ["console.log"] : [],
      },
      mangle: {
        safari10: true, // 兼容 Safari 10
      },
    },
    // CSS 代码分割
    cssCodeSplit: true,
    // 启用 CSS 压缩
    cssMinify: true,
  },
});
