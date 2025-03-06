import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import React from "react";
import Page from "./Page";

import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

dayjs.locale("en");
const App: React.FC = () => {
    return (
        <ConfigProvider locale={zhCN}>
            <Page />
        </ConfigProvider>
    );
};

export default App;
