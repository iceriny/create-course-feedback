import { ConfigProvider, message } from "antd";
import zhCN from "antd/locale/zh_CN";
import React, { useCallback } from "react";
import Page from "./Page";

import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { JointContent } from "antd/es/message/interface";

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
    // const sendError = useCallback(
    //     (
    //         content: JointContent,
    //         duration?: number | VoidFunction,
    //         onClose?: VoidFunction
    //     ) => {
    //         messageApi.error(content, duration, onClose);
    //     },
    //     [messageApi]
    // );
    return (
        <ConfigProvider locale={zhCN}>
            {contextHolder}
            <Page sendMessage={sendInfo} sendWarning={sendWarning} />
        </ConfigProvider>
    );
};

export default App;
