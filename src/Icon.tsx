import Icon from "@ant-design/icons";
import LogoSVG from "./assets/logo.svg?react"; // 你的 '*.svg' 文件路径

interface LogoProps {
    className?: string;
    style?: React.CSSProperties;
    height?: string | number;
    width?: string | number;
    onClick?: React.MouseEventHandler<HTMLSpanElement>;
}
const Logo: React.FC<LogoProps> = (props) => {
    // 定义组件默认样式
    const defaultStyle: React.CSSProperties = {
        marginLeft: "1em",
        marginRight: "1em",
    };

    // 合并传入的style和默认style（传入的style会覆盖默认style）
    const mergedStyle = {
        ...defaultStyle,
        ...props.style,
    };
    return <Icon {...props} style={mergedStyle} component={LogoSVG} />;
};

export default Logo;
