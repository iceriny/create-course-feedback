import { Flex, Layout, theme } from "antd";
import { JointContent } from "antd/es/message/interface";
import { FC } from "react";
import { MainUI } from "..";

const { Footer } = Layout;

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
      <MainUI sendMessage={sendMessage} sendWarning={sendWarning} />
      <Footer style={{ backgroundColor: token.colorBgBase }}>
        <Flex justify="space-between">
          <span>Made by Iceriny · v{__APP_VERSION__}</span>
          <span>&copy; Iceriny. 保留所有权利.</span>
        </Flex>
      </Footer>
    </Layout>
  );
};

export default Page;
