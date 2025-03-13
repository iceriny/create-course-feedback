import { compareVersions } from "compare-versions";

class Version {
    private static instance: Version;
    private currentVersion: string;
    private versionInfos: VersionData = [];
    private updateModalVisible = false;

    private constructor() {
        this.currentVersion = __APP_VERSION__;
    }

    public static getInstance(): Version {
        if (!Version.instance) {
            Version.instance = new Version();
        }
        return Version.instance;
    }

    public async checkForUpdates(): Promise<boolean> {
        try {
            // 从 localStorage 中加载老的版本号
            const oldVersion = localStorage.getItem("version");

            // 从本地配置文件加载版本信息
            const response = await fetch("/src/version.config.json");
            const data: VersionData = await response.json();

            if (
                !oldVersion ||
                compareVersions(this.currentVersion, oldVersion) > 0
            ) {
                this.versionInfos = data.filter((v) => {
                    return (
                        compareVersions(v.version, oldVersion || "0.0.0") > 0
                    );
                });
                localStorage.setItem("version", this.currentVersion);
                this.updateModalVisible = true;
                return true;
            }

            return false;
        } catch (error) {
            console.error("检查更新失败:", error);
            return false;
        }
    }

    public closeUpdateModal() {
        this.updateModalVisible = false;
        this.versionInfos = []; // 释放更新信息
    }

    public getCurrentVersion(): string {
        return this.currentVersion;
    }

    public getUpdateInfo(): VersionData {
        return this.versionInfos;
    }

    public isUpdateModalVisible(): boolean {
        return this.updateModalVisible;
    }
}

export default Version;
