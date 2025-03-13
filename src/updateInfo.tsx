import { Button, Modal, List } from "antd";
import { RightOutlined } from "@ant-design/icons";
import { FC, useEffect, useState } from "react";

import Version from "./Version";

const UpdateInfo: FC = () => {
    const version = Version.getInstance();
    const [versionInfo, setVersionInfo] = useState<VersionData>([]);
    const [versionOpen, setVersionOpen] = useState(false);

    useEffect(() => {
        version.checkForUpdates().then(() => {
            if (version.isUpdateModalVisible()) {
                setVersionOpen(true);
                setVersionInfo(version.getUpdateInfo().reverse());
            }
        });
    }, [version, versionInfo]);

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
                                description={item.description}
                            />
                            {item.updateInfo.map((info, index) => (
                                <p key={index}>
                                    <RightOutlined style={{ marginRight: 5 }} />
                                    {info}
                                </p>
                            ))}
                        </List.Item>
                    )}
                />
            )}
        </Modal>
    );
};

export default UpdateInfo;
