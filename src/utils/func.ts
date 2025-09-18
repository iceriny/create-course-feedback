/**
 * 下一个焦点
 * @param event 事件
 * @param next 下一个焦点
 * @returns 是否成功
 */
export function nextFocus<T extends HTMLInputElement | HTMLTextAreaElement>(
  event: React.KeyboardEvent<T>,
  next: T,
): boolean {
  if (next) {
    event.preventDefault();
    event.stopPropagation();
    next.focus();
    next.select();
    return true;
  } else {
    return false;
  }
}
