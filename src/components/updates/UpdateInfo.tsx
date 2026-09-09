import { Button, Modal, Typography } from "antd";
import { RightOutlined } from "@ant-design/icons";
import { FC, useEffect, useMemo, useState } from "react";

import Version from "../../services/updates/version";

// 定义类型
interface VersionInfo {
  version: string;
  content: string;
  date: string;
}

type VersionData = VersionInfo[];

const UpdateInfo: FC = () => {
  const version = useMemo(() => Version.getInstance(), []);
  const [versionInfo, setVersionInfo] = useState<VersionData>([]);
  const [versionOpen, setVersionOpen] = useState(false);

  useEffect(() => {
    // 仅在组件挂载时检查版本更新
    const checkVersion = async () => {
      const hasUpdates = await version.checkForUpdates();
      if (hasUpdates && version.isUpdateModalVisible()) {
        setVersionOpen(true);
        setVersionInfo(version.getUpdateInfo().reverse());
      }
    };

    checkVersion();
  }, [version]);

  const handleOk = () => {
    // if (versionInfo?.downloadUrl) {
    //     window.open(versionInfo.downloadUrl, "_blank");
    // }
    version.closeUpdateModal();
    setVersionOpen(false);
  };

  return (
    <Modal
      open={versionOpen}
      title={<span>已更新 当前版本: {version.getCurrentVersion()}</span>}
      onOk={handleOk}
      onCancel={handleOk}
      footer={[
        <Button key="submit" type="primary" onClick={handleOk}>
          确认
        </Button>,
      ]}
    >
      {versionOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {versionInfo.map((item: VersionInfo) => (
            <section key={item.version}>
              <Typography.Title level={4}>{item.version}</Typography.Title>
              <Typography.Text type="secondary">
                更新日期: {item.date}
              </Typography.Text>
              <div className="version-content">
                {item.content.split("\n").map((line, index) => (
                  <p key={index}>
                    {line.startsWith("-") ? (
                      <>
                        <RightOutlined style={{ marginRight: 5 }} />
                        {line.substring(2)}
                      </>
                    ) : (
                      line
                    )}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default UpdateInfo;
