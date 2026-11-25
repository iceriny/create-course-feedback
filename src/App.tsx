import { useAppearanceStore } from "./store/appearanceStore";
// React 核心
import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useInsertionEffect,
  useState,
} from "react";

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
  // Ant derives tokens for every mounted control when the palette changes.
  // Let that render yield to input while keeping the last complete palette.
  const palette = useDeferredValue(dark);
  return <ThemedWorkbench dark={palette} />;
};

const ThemedWorkbench = React.memo(function ThemedWorkbench({
  dark,
}: {
  dark: boolean;
}) {
  useInsertionEffect(() => {
    const root = document.documentElement;
    const palette = dark ? "dark" : "light";
    if (root.dataset.theme === palette) return;
    const switching = Boolean(root.dataset.theme);
    if (switching) root.setAttribute("data-changing-palette", "");
    root.dataset.theme = palette;
    root.style.colorScheme = palette;
    if (!switching) return;
    // Restore ordinary control feedback after painting the new palette.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() =>
        root.removeAttribute("data-changing-palette"),
      );
    });
    return () => {
      cancelAnimationFrame(frame);
      root.removeAttribute("data-changing-palette");
    };
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
      wave={{ disabled: true }}
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          motionEaseOut: "var(--motion-settle)",
          motionEaseOutCirc: "var(--motion-settle)",
          motionEaseOutQuint: "var(--motion-settle)",
          motionEaseOutBack: "var(--motion-spring)",
          motionEaseInBack: "var(--motion-release)",
          boxShadow: "var(--shadow-dialog)",
          boxShadowSecondary: "var(--shadow-floating)",
          boxShadowTertiary: "var(--shadow-surface)",
          borderRadius: 8,
          fontSize: 14,
          ...(dark
            ? {
                colorBgBase: "#121212",
                colorBgLayout: "#121212",
                colorBgContainer: "#1c1c1c",
                colorBgElevated: "#242424",
                colorBgSpotlight: "#363636",
                colorBorder: "#3d3d3d",
                colorBorderSecondary: "#333333",
                colorText: "#e7e7e7",
                colorPrimary: "#6ca8eb",
                colorPrimaryBg: "#262e38",
                colorPrimaryBgHover: "#2c3a4c",
                colorLink: "#83b7f0",
                colorLinkHover: "#a6cbf4",
                colorLinkActive: "#6ca8eb",
              }
            : {
                colorBgLayout: "#f3f5f8",
                colorBgContainer: "#ffffff",
                colorBgElevated: "#ffffff",
                colorText: "#1c2c3e",
                colorPrimary: "#2563a6",
              }),
        },
        components: {
          Button: {
            defaultShadow: "var(--shadow-control)",
            primaryShadow: "var(--shadow-control)",
            dangerShadow: "var(--shadow-control)",
          },
        },
      }}
    >
      {contextHolder}
      <Page sendMessage={sendInfo} sendWarning={sendWarning} />
      <UpdateInfo />
    </ConfigProvider>
  );
});

export default App;
