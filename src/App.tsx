// React 核心
import React, { useCallback } from "react";

// Ant Design 核心
import { ConfigProvider, message } from "antd";
import zhCN from "antd/locale/zh_CN";
import { JointContent } from "antd/es/message/interface";

// dayjs 本地化配置
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

// 内部组件
import UpdateInfo from "./updateInfo";
import Page from "./Page";

// 设置 dayjs 默认语言为英文
dayjs.locale("en");
const App: React.FC = () => {
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
