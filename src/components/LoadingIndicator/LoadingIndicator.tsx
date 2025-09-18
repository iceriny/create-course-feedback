import React, { memo } from "react";
import { Flex, theme } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

const { useToken } = theme;

interface LoadingIndicatorProps {
  loading: boolean;
}

/**
 * 加载指示器组件
 */
const LoadingIndicator = memo(({ loading }: LoadingIndicatorProps) => {
  const { token } = useToken();

  if (!loading) {
    return null;
  }

  return (
    <Flex
      justify="center"
      align="center"
      style={{
        marginTop: "1rem",
        marginBottom: "1rem",
      }}
    >
      <LoadingOutlined
        style={{
          fontSize: "1.5rem",
          color: token.colorPrimary,
        }}
      />
    </Flex>
  );
});

LoadingIndicator.displayName = "LoadingIndicator";

export default LoadingIndicator;
