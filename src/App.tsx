import { useAppearanceStore } from "./store/appearanceStore";
// React 核心
import React, { useCallback, useEffect, useState } from "react";

// Ant Design 核心
import { ConfigProvider, message, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { JointContent } from "antd/es/message/interface";

// dayjs 本地化配置
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

// 内部组件
import UpdateInfo from "./components/updates/UpdateInfo";
import Page from "./components/layout/Page";

// 设置 dayjs 默认语言为英文
dayjs.locale("zh-cn");
const App: React.FC = () => {
  const mode = useAppearanceStore((s) => s.mode);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const dark = mode === "dark" || (mode === "system" && systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);
  const [messageApi, contextHolder] = message.useMessage();
  const sendInfo = useCallback(
    (
      content: JointContent,
      duration?: number | VoidFunction,
      onClose?: VoidFunction,
    ) => {
      messageApi.info(content, duration, onClose);
    },
    [messageApi],
  );
  const sendWarning = useCallback(
    (
      content: JointContent,
      duration?: number | VoidFunction,
      onClose?: VoidFunction,
    ) => {
      messageApi.warning(content, duration, onClose);
    },
    [messageApi],
  );

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: dark ? "#6ca8eb" : "#2563a6",
          colorBgContainer: dark ? "#182230" : "#ffffff",
          colorBgElevated: dark ? "#202c3c" : "#ffffff",
          borderRadius: 8,
          fontSize: 14,
          colorBgLayout: dark ? "#101722" : "#f3f5f8",
          colorText: dark ? "#dce6f2" : "#1c2c3e",
        },
        components: {
          Layout: {
            headerColor: "rgb(255, 255, 255)",
          },
        },
      }}
    >
      {contextHolder}
      <Page sendMessage={sendInfo} sendWarning={sendWarning} />
      <UpdateInfo />
    </ConfigProvider>
  );
};

export default App;
