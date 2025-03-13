// 添加公共变量
interface Window {
    API: unknown;
}

const __APP_VERSION__: string;
interface VersionInfo {
    version: string;
    description: string;
    updateInfo: string[];
    updateTime: string;
}
type VersionData = VersionInfo[];
