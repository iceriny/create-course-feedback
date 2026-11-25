import { Flex, Layout, theme } from "antd";
import { JointContent } from "antd/es/message/interface";
import { FC } from "react";
import { MainUI } from "..";
import Logo from "../common/Logo";

const { Footer, Content } = Layout;

const { useToken } = theme;

// 定义组件Props接口
interface PageProps {
  // 发送普通消息的函数
  sendMessage: (
    content: JointContent,
    duration?: number | VoidFunction,
    onClose?: VoidFunction,
  ) => void;
  // 发送警告消息的函数
  sendWarning: (
    content: JointContent,
    duration?: number | VoidFunction,
    onClose?: VoidFunction,
  ) => void;
}
const Page: FC<PageProps> = ({ sendMessage, sendWarning }) => {
  const { token } = useToken();
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <header className="page-header">
        <div className="page-header-inner">
          <span className="page-brand">
            <Logo className="page-brand-mark" />
            课程反馈生成器
          </span>
          <span className="page-version">v{__APP_VERSION__}</span>
        </div>
      </header>
      <Content className="page-content">
        <MainUI sendMessage={sendMessage} sendWarning={sendWarning} />
      </Content>
      <Footer style={{ backgroundColor: token.colorBgBase }}>
        <Flex justify="space-between">
          <span>Made by Iceriny</span>
          <span>&copy; Iceriny. 保留所有权利.</span>
        </Flex>
      </Footer>
    </Layout>
  );
};

export default Page;
