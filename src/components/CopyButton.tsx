import { CheckOutlined, CopyOutlined } from "@ant-design/icons";
import { Button, theme } from "antd";
import { useState } from "react";
interface CopyButtonProps {
  disabled?: boolean;
  onClick: () => void;
}
const { useToken } = theme;
const CopyButton: React.FC<CopyButtonProps> = ({ onClick, disabled }) => {
  const [onClicked, setClicked] = useState<boolean>(false);
  const { colorSuccess } = useToken().token;
  return (
    <Button
      disabled={disabled}
      type="link"
      color="pink"
      icon={
        onClicked ? (
          <CheckOutlined style={{ color: colorSuccess }} />
        ) : (
          <CopyOutlined />
        )
      }
      onClick={() => {
        if (!onClicked) {
          setClicked(true);
          setTimeout(() => {
            setClicked(false);
          }, 1500);
          onClick();
        }
      }}
    />
  );
};

export default CopyButton;
