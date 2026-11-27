// 入口：装配各模块

import { subscribe, loadSettings } from "./store.js";
import { initModals } from "./ui.js";
import { applyI18n } from "./i18n.js";
import { initAppearance, initSettings, applyAppearance } from "./settings.js";
import { initShortcuts, render as renderShortcuts } from "./shortcuts.js";
import { prefetchRandomList } from "./wallpapers.js";

function onChange(_settings, reason) {
  if (reason === "init") return;
  switch (reason) {
    case "sections":
    case "restore":
      renderShortcuts();
      break;
    case "shortcuts":
      renderShortcuts();
      document.dispatchEvent(new CustomEvent("foxfox:settings-refresh"));
      break;
    case "theme":
    case "wallpaper":
      applyAppearance();
      break;
    default:
      break;
  }
}

async function boot() {
  applyI18n(); // 语言跟随浏览器：先渲染静态文案再装配交互
  initModals();
  await loadSettings();

  initAppearance();

  initSettings();
  initShortcuts();
  prefetchRandomList(); // 首次无缓存时后台拉取随机壁纸图池，不阻塞页面

  subscribe(onChange);

  document.addEventListener("foxfox:refresh-all", () => {
    renderShortcuts();
  });

}

boot().catch((err) => {
  console.error("[foxfox] 初始化失败", err);
});
