import { Button, Modal, List } from "antd";
import { RightOutlined } from "@ant-design/icons";
import { FC, useEffect, useState } from "react";

import Version from "./Version";

// 定义类型
interface VersionInfo {
    version: string;
    content: string;
    date: string;
}

type VersionData = VersionInfo[];

const UpdateInfo: FC = () => {
    const version = Version.getInstance();
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
    }, []); // 移除依赖项，仅在组件挂载时执行一次

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
            footer={[
                <Button key="submit" type="primary" onClick={handleOk}>
                    确认
                </Button>,
            ]}
        >
            {versionOpen && (
                <List
                    itemLayout="vertical"
                    dataSource={versionInfo}
                    renderItem={(item: VersionInfo) => (
                        <List.Item>
                            <List.Item.Meta
                                title={item.version}
                                description={`更新日期: ${item.date}`}
                            />
                            <div className="version-content">
                                {item.content.split("\n").map((line, index) => (
                                    <p key={index}>
                                        {line.startsWith("-") ? (
                                            <>
                                                <RightOutlined
                                                    style={{ marginRight: 5 }}
                                                />
                                                {line.substring(2)}
                                            </>
                                        ) : (
                                            line
                                        )}
                                    </p>
                                ))}
                            </div>
                        </List.Item>
                    )}
                />
            )}
        </Modal>
    );
};

export default UpdateInfo;
