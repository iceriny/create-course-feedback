import { lazy, Suspense } from "react";
import { LoadingOutlined } from "@ant-design/icons";

// 延迟加载图标组件
const LazyIcon = ({ iconName, ...props }: { iconName: string; [key: string]: unknown }) => {
  const IconComponent = lazy(() =>
    import("@ant-design/icons").then((module) => ({
      default: module[iconName as keyof typeof module] as React.ComponentType,
    }))
  );

  return (
    <Suspense fallback={<LoadingOutlined {...props} />}>
      <IconComponent {...props} />
    </Suspense>
  );
};

export default LazyIcon;
