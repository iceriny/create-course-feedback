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
import { StyleProvider } from "@ant-design/cssinjs";
import zhCN from "antd/locale/zh_CN";
import { JointContent } from "antd/es/message/interface";

// dayjs 本地化配置
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

// 内部组件
import UpdateInfo from "./components/updates/UpdateInfo";
import Page from "./components/layout/Page";
import { applyPalette, palettes } from "./styles/palette";

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
  const colors = dark ? palettes.dark : palettes.light;
  useInsertionEffect(() => {
    const root = document.documentElement;
    const palette = dark ? "dark" : "light";
    const switching = Boolean(
      root.dataset.theme && root.dataset.theme !== palette,
    );
    if (switching) root.setAttribute("data-changing-palette", "");
    root.dataset.theme = palette;
    root.style.colorScheme = palette;
    applyPalette(palette, root);
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
    <StyleProvider layer>
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
            colorBgBase: colors.canvas,
            colorBgLayout: colors.canvas,
            colorBgContainer: colors.panel,
            colorBgElevated: colors.elevated,
            colorBgSpotlight: colors.spotlight,
            colorBorder: colors.controlBorder,
            colorBorderSecondary: colors.border,
            colorText: colors.text,
            colorPrimary: colors.primary,
            colorTextLightSolid: colors.onPrimary,
            colorSuccess: colors.success,
            colorWarning: colors.warning,
            colorError: colors.danger,
            colorLink: colors.primary,
          },
          components: {
            Button: {
              defaultShadow: "var(--shadow-control)",
              primaryShadow: "var(--shadow-control)",
              dangerShadow: "var(--shadow-control)",
            },
            Tooltip: {
              colorTextLightSolid: dark ? colors.text : colors.onPrimary,
            },
          },
        }}
      >
        {contextHolder}
        <Page sendMessage={sendInfo} sendWarning={sendWarning} />
        <UpdateInfo />
      </ConfigProvider>
    </StyleProvider>
  );
});

export default App;
