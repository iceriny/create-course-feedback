import { useCallback, useState } from "react";

export default function useOverlay<T>() {
  const [overlay, setOverlay] = useState<{ open: boolean; content: T } | null>(
    null,
  );
  const show = useCallback(
    (content: T) => setOverlay({ open: true, content }),
    [],
  );
  const close = useCallback(() => {
    setOverlay((current) =>
      current?.open ? { ...current, open: false } : current,
    );
  }, []);
  const afterClose = useCallback(() => {
    setOverlay((current) => (current?.open ? current : null));
  }, []);
  return { overlay, show, close, afterClose };
}
