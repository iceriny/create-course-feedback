import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { readFileSync } from "fs";
import { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";

const packageJson = JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf-8")
);

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        svgr({ svgrOptions: { icon: true } }),
        visualizer({ open: true }),
    ],
    base: "/",
    define: {
        __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: (id: string) => {
                    // 将React和Ant Design所有相关代码打包在一起
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

                    // dayjs单独打包
                    if (id.includes("dayjs")) {
                        return "vendor-dayjs";
                    }

                    // 其他node_modules模块，不要过度分割，可以按大类分组
                    if (id.includes("node_modules")) {
                        // 对于小型依赖，统一打包到一个common vendor chunk
                        return "vendor-others";
                    }
                },
            },
        },
        // 设置chunk大小警告的限制值（kB）
        chunkSizeWarningLimit: 1500,
        // 开启代码压缩
        minify: "terser",
        terserOptions: {
            compress: {
                drop_console: true, // 移除console
                drop_debugger: true, // 移除debugger
            },
        },
        // 启用CSS代码分割
        cssCodeSplit: true,
    },
});
