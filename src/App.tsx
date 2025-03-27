import { ConfigProvider, message } from "antd";
import zhCN from "antd/locale/zh_CN";
import React, { useCallback } from "react";
import UpdateInfo from "./updateInfo";

import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { JointContent } from "antd/es/message/interface";
import Page from "./Page";
dayjs.locale("en");
const App: React.FC = () => {
    const [messageApi, contextHolder] = message.useMessage();
    const sendInfo = useCallback(
        (
            content: JointContent,
            duration?: number | VoidFunction,
            onClose?: VoidFunction
        ) => {
            messageApi.info(content, duration, onClose);
        },
        [messageApi]
    );
    const sendWarning = useCallback(
        (
            content: JointContent,
            duration?: number | VoidFunction,
            onClose?: VoidFunction
        ) => {
            messageApi.warning(content, duration, onClose);
        },
        [messageApi]
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
