import { Flex, Layout, theme } from "antd";
import { JointContent } from "antd/es/message/interface";
import { FC } from "react";
import { MainUI } from "./components";
import Logo from "./Icon";

const { Header, Footer, Content } = Layout;

const { useToken } = theme;

// 定义组件Props接口
interface PageProps {
    // 发送普通消息的函数
    sendMessage: (
        content: JointContent,
        duration?: number | VoidFunction,
        onClose?: VoidFunction
    ) => void;
    // 发送警告消息的函数
    sendWarning: (
        content: JointContent,
        duration?: number | VoidFunction,
        onClose?: VoidFunction
    ) => void;
}
const Page: FC<PageProps> = ({ sendMessage, sendWarning }) => {
    const { token } = useToken();
    return (
        <Layout style={{ minHeight: "100vh" }}>
            <Header style={{ fontSize: "1.5rem" }}>
                <Flex justify="space-between">
                    <span>
                        <Logo />
                        课程反馈生成器
                    </span>
                    <span>v{__APP_VERSION__}</span>
                </Flex>
            </Header>
            <Content style={{ padding: "50px 50px" }}>
                <MainUI sendMessage={sendMessage} sendWarning={sendWarning} />
            </Content>
            <Footer style={{ backgroundColor: token.colorBgBase }}>
                <Flex justify="space-between">
                    <span>Made by Iceriny</span>
                    <span style={{ paddingRight: "100px" }}>
                        &copy; Iceriny. 保留所有权利.
                    </span>
                </Flex>
            </Footer>
        </Layout>
    );
};

export default Page;
