/**
 * 将一个 JavaScript 对象下载为 JSON 文件。
 *
 * @param data 要下载的 JavaScript 对象或数组。
 * @param filename 下载后显示的文件名，例如 'data.json'。
 */
export function downloadJson(data: object, filename: string): void {
  // 1. 将 JavaScript 对象转换为 JSON 字符串
  // 第二个参数 null 表示不使用 replacer 函数，第三个参数 2 表示使用 2 个空格进行缩进，使 JSON 文件更易读。
  const jsonString = JSON.stringify(data, null, 2);

  // 2. 创建一个 Blob 对象
  // Blob (Binary Large Object) 表示一个不可变的、原始数据的类文件对象。
  // 'application/json' 是 JSON 文件的标准 MIME 类型。
  const blob = new Blob([jsonString], { type: "application/json" });

  // 3. 创建一个指向该 Blob 的 URL
  // 这个 URL 是临时的，并且只在当前文档的生命周期内有效。
  const url = URL.createObjectURL(blob);

  // 4. 创建一个隐藏的 <a> 标签来触发下载
  const link = document.createElement("a");
  link.href = url;
  link.download = filename; // 'download' 属性告诉浏览器下载 URL 指向的文件，而不是导航到它。

  // 5. 触发点击事件
  document.body.appendChild(link); // 必须将链接添加到 DOM 中，才能在某些浏览器中生效
  link.click();

  // 6. 清理
  // 触发下载后，将链接从 DOM 中移除
  document.body.removeChild(link);
  // 释放通过 createObjectURL 创建的 URL，以避免内存泄漏
  URL.revokeObjectURL(url);
}
