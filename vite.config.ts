import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import { resolve } from "path";

const packageJson = JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf-8")
);

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    base: "/",
    define: {
        __APP_VERSION__: JSON.stringify(packageJson.version),
    },
});
