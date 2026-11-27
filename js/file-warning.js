// 仅在直接双击 file:// 打开时提示：ES Module 会被浏览器的跨域策略拦截。
// 通过 HTTP(S) 或扩展访问时本文件不做任何事。
if (location.protocol === "file:") {
  const tip = document.createElement("div");
  tip.style.cssText =
    "position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:#fff;color:#333;" +
    "font:15px/1.7 system-ui,-apple-system,'PingFang SC',sans-serif;text-align:center;z-index:9999";
  tip.textContent =
    "请通过 HTTP(S) 访问：在项目目录运行 python3 -m http.server 8080，然后打开 http://localhost:8080/。" +
    "直接双击 file:// 会被浏览器的 ES Module 跨域策略拦截。";
  document.body.append(tip);
}
