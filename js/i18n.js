// 双语文案（中文 / English）：语言跟随浏览器界面语言——
// 扩展环境用 chrome.i18n.getUILanguage()，部署到网站后降级 navigator.language。
// zh* → 中文，其余一律 English。
// t("key") 取文案；支持 {name} 占位符；未知 key 原样返回（便于发现漏翻）。

import { uiLanguage } from "./platform.js";

const ZH = {
  // 页面与通用
  pageTitle: "新标签页",
  customizeNewTab: "自定义新标签页",
  settings: "设置",
  close: "关闭",
  cancel: "取消",
  save: "保存",
  add: "添加",
  confirm: "确定",
  remove: "移除",
  back: "返回",

  // 快捷方式编辑对话框
  addShortcut: "添加快捷方式",
  editShortcut: "编辑快捷方式",
  fieldName: "名称",
  fieldUrl: "网址",
  fieldIcon: "图标（可选）",
  iconModeFavicon: "Favicon",
  iconModeSimple: "Simple Icons",
  iconModeCustom: "自定义",
  iconModeFaviconHint: "使用网站自己的 favicon",
  iconModeSimpleHint: "使用 Simple Icons 品牌 SVG，找不到时回退 favicon",
  namePlaceholder: "例如：GitHub",
  chooseImage: "本地",
  iconBackground: "背景颜色",
  useDefaultColor: "默认",
  onlineIcon: "在线图标",
  onlineIconPlaceholder: "https://example.com/icon.png",
  toastInvalidIconUrl: "请输入有效的 http(s) 图片链接",
  errNameRequired: "请填写名称",
  errInvalidUrl: "请输入有效的网址，例如 example.com",

  // 快捷方式右键菜单
  menuOpen: "打开",
  menuOpenNewTab: "新标签页中打开",
  menuUnpin: "取消固定",
  menuPin: "固定到快捷方式",
  menuEdit: "编辑…",
  itemOptions: "{title} 选项",

  // 提示文案
  toastPinned: "已固定",
  toastUnpinned: "已取消固定",
  toastRemoved: "已移除",
  toastUpdated: "已更新",
  toastShortcutAdded: "已添加快捷方式",
  toastIconReadFailed: "图片读取失败，请换一张试试",

  // 壁纸设置
  wallpaper: "壁纸",
  wallpaperCategories: "壁纸分类",
  backToCategories: "返回壁纸分类",
  addImage: "添加图片",
  customImageFallback: "我的图片",
  deleteImage: "删除图片",
  deleteMyImageTitle: "删除自定义图片？",
  deleteMyImageMsg: "将从本机移除已上传的壁纸图片，删除后需要重新上传。",
  delete: "删除",
  toastImageTooLarge: "图片过大，请选择 12MB 以内的图片",
  toastWallpaperUpdated: "壁纸已更新",
  toastWallpaperSaveFailed: "壁纸保存失败",
  toastCustomImageDeleted: "自定义图片已删除",
  bingWallpaper: "Bing",
  toastBingWallpaper: "已启用 Bing",
  toastRandomWallpaper: "已随机选取一张壁纸",
  resetToDefault: "重置为默认",
  blur: "模糊",
  dim: "变暗",

  // 主题与布局
  shortcutsSection: "快捷方式",
  rows: "行数",
  columns: "列数",

  // 数据
  dataSaving: "数据保存",
  exportSettings: "导出设置",
  importSettings: "导入设置",
  clearShortcuts: "清除图标",
  deleteUnpinnedOnly: "删除固定图标以外图标",
  toastUnpinnedCleared: "已删除固定图标以外的快捷方式",
  clearShortcutsTitle: "清除所有快捷方式？",
  clearShortcutsMsg: "将删除快捷方式；点击“删除固定图标以外图标”可保留固定图标。此操作不可撤销。",
  toastShortcutsCleared: "快捷方式已清除",
  restoreDefaults: "恢复默认",
  restoreDefaultsTitle: "恢复默认设置？",
  restoreDefaultsMsg: "将清除所有自定义快捷方式、壁纸和偏好设置，此操作不可撤销。",
  toastSettingsImported: "设置已导入",
  toastBadFileFormat: "文件格式不正确",

  // 时间（util.timeAgo）
};

const EN = {
  pageTitle: "New Tab",
  customizeNewTab: "Customize new tab",
  settings: "Settings",
  close: "Close",
  cancel: "Cancel",
  save: "Save",
  add: "Add",
  confirm: "OK",
  remove: "Remove",
  back: "Back",

  addShortcut: "Add shortcut",
  editShortcut: "Edit shortcut",
  fieldName: "Name",
  fieldUrl: "URL",
  fieldIcon: "Icon (optional)",
  iconModeFavicon: "Favicon",
  iconModeSimple: "Simple Icons",
  iconModeCustom: "Custom",
  iconModeFaviconHint: "Use the site's own favicon",
  iconModeSimpleHint: "Use a Simple Icons brand SVG, falling back to favicon",
  namePlaceholder: "e.g. GitHub",
  chooseImage: "Local",
  iconBackground: "Background",
  useDefaultColor: "Default",
  onlineIcon: "Online icon",
  onlineIconPlaceholder: "https://example.com/icon.png",
  toastInvalidIconUrl: "Enter a valid http(s) image URL",
  errNameRequired: "Please enter a name",
  errInvalidUrl: "Please enter a valid URL, e.g. example.com",

  menuOpen: "Open",
  menuOpenNewTab: "Open in new tab",
  menuUnpin: "Unpin",
  menuPin: "Pin to shortcuts",
  menuEdit: "Edit…",
  itemOptions: "{title} options",

  toastPinned: "Pinned",
  toastUnpinned: "Unpinned",
  toastRemoved: "Removed",
  toastUpdated: "Updated",
  toastShortcutAdded: "Shortcut added",
  toastIconReadFailed: "Couldn't read that image. Please try another one.",

  wallpaper: "Wallpaper",
  wallpaperCategories: "Wallpaper categories",
  backToCategories: "Back to wallpaper categories",
  addImage: "Add image",
  customImageFallback: "My image",
  deleteImage: "Delete image",
  deleteMyImageTitle: "Delete custom image?",
  deleteMyImageMsg: "This removes the uploaded wallpaper image from this device. You'll need to upload it again to use it.",
  delete: "Delete",
  toastImageTooLarge: "Image is too large. Please choose one under 12MB.",
  toastWallpaperUpdated: "Wallpaper updated",
  toastWallpaperSaveFailed: "Failed to save wallpaper",
  toastCustomImageDeleted: "Custom image deleted",
  bingWallpaper: "Bing",
  toastBingWallpaper: "Bing enabled",
  toastRandomWallpaper: "Random wallpaper applied",
  resetToDefault: "Reset to default",
  blur: "Blur",
  dim: "Dim",

  shortcutsSection: "Shortcuts",
  rows: "Rows",
  columns: "Columns",

  dataSaving: "Save data",
  exportSettings: "Export",
  importSettings: "Import",
  clearShortcuts: "Clear icons",
  deleteUnpinnedOnly: "Delete all except pinned",
  toastUnpinnedCleared: "Cleared all except pinned shortcuts",
  clearShortcutsTitle: "Clear all shortcuts?",
  clearShortcutsMsg: "Shortcuts will be removed. Use “Delete all except pinned” to keep pinned icons. This cannot be undone.",
  toastShortcutsCleared: "Shortcuts cleared",
  restoreDefaults: "Reset",
  restoreDefaultsTitle: "Restore default settings?",
  restoreDefaultsMsg: "This clears all custom shortcuts, wallpapers and preferences. This cannot be undone.",
  toastSettingsImported: "Settings imported",
  toastBadFileFormat: "Invalid file format",

};

function detectLocale() {
  // 扩展内取 chrome.i18n，部署到网站后取 navigator.language（由 platform.js 统一处理）
  return uiLanguage().toLowerCase().startsWith("zh") ? "zh" : "en";
}

export const locale = detectLocale();

/** 取文案；vars 里的 {name} 占位符会被替换 */
export function t(key, vars) {
  const table = locale === "en" ? EN : ZH;
  let text = table[key] ?? ZH[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** 启动时套用 <html lang> / <title>，并渲染 index.html 里的静态文案
    （data-i18n / data-i18n-aria / data-i18n-title / data-i18n-placeholder） */
export function applyI18n(root = document) {
  document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  document.title = t("pageTitle");
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll("[data-i18n-title]")) el.setAttribute("title", t(el.dataset.i18nTitle));
  for (const el of root.querySelectorAll("[data-i18n-placeholder]")) el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
}
