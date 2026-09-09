export const statusLabel = (info?: {
  loading: boolean;
  content: string;
  confirmed?: boolean;
  generation?: { status: string };
}) => {
  if (info?.generation?.status === "queued") return "排队中";
  if (info?.generation?.status === "retrying") return "重试中";
  if (info?.loading) return "生成中";
  if (info?.generation?.status === "failed") return "需重试";
  if (info?.confirmed) return "已确认";
  return info?.content ? "待确认" : "待记录";
};
