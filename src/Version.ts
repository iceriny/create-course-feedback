import { compareVersions } from "compare-versions";

// 类型定义
interface VersionInfo {
  version: string;
  content: string;
  date: string;
}

type VersionData = VersionInfo[];
type VersionList = string[];

class Version {
  private static instance: Version;
  private currentVersion: string;
  private versionInfos: VersionData = [];
  private pendingVersions: VersionList = [];
  private updateModalVisible = false;
  private isLoading = false;

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
    // 如果已经在加载或者已经有更新显示，直接返回
    if (this.isLoading || this.updateModalVisible) {
      return this.updateModalVisible;
    }

    try {
      this.isLoading = true;

      // 从 localStorage 中加载老的版本号
      const oldVersion = localStorage.getItem("version") || "0.0.0";

      // 只获取版本号列表
      const response = await fetch("version-list.json");
      const versionList: VersionList = await response.json();

      // 对版本列表进行排序
      const sortedVersionList = [...versionList].sort((a, b) =>
        compareVersions(a, b),
      );

      // 获取最新版本号
      const latestVersion =
        sortedVersionList.length > 0
          ? sortedVersionList[sortedVersionList.length - 1]
          : this.currentVersion;

      // 过滤出需要更新的版本号
      this.pendingVersions = sortedVersionList.filter(
        (version) => compareVersions(version, oldVersion) > 0,
      );

      if (this.pendingVersions.length > 0) {
        // 有更新的版本
        await this.loadVersionInfos();

        // 保存最新的版本号到 localStorage
        localStorage.setItem("version", latestVersion);

        this.updateModalVisible = true;
        return true;
      }

      return false;
    } catch (error) {
      console.error("检查更新失败:", error);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  private async loadVersionInfos(): Promise<void> {
    // 清空版本信息数组，防止重复加载
    this.versionInfos = [];

    // 按需加载每个版本的详细信息
    for (const version of this.pendingVersions) {
      try {
        const response = await fetch(`versions/${version}.json`);
        const versionInfo: VersionInfo = await response.json();
        this.versionInfos.push(versionInfo);
      } catch (error) {
        console.error(`加载版本 ${version} 信息失败:`, error);
      }
    }

    // 确保版本信息按版本号排序
    this.versionInfos.sort((a, b) => compareVersions(a.version, b.version));
  }

  public closeUpdateModal() {
    this.updateModalVisible = false;
    this.versionInfos = []; // 释放版本信息内存
    this.pendingVersions = []; // 释放待更新版本列表内存
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
