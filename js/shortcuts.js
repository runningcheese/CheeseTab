// 快捷方式：Top Sites 聚合、固定/编辑/移除、拖拽排序

import { $, h, hostOf, normalizeUrl, siteNameFromUrl } from "./util.js";
import { state, saveSettings } from "./store.js";
import { ICONS } from "./icons.js";
import {
  mountFavicon,
  simpleIconUrl,
  getCachedSimpleIcon,
  cacheSimpleIcon,
  faviconIsFullBleed,
} from "./favicon.js";
import { LOCAL_ICON_HOSTS } from "./local-icons.js";
import { openMenu, toast, openModal, closeModal } from "./ui.js";
import { t, locale } from "./i18n.js";
import { getTopSites, randomUUID } from "./platform.js";

// 页面默认图标（首次运行写入 shortcuts.defaults，可自由移除/排序）
const DEFAULT_SHORTCUTS = [
  { title: "云音乐", url: "https://music.163.com/" },
  { title: "邮箱", url: "https://mail.qq.com/" },
  { title: "今日热榜", url: "https://tophub.today/c/news" },
  { title: "ChatGPT", url: "https://chatgpt.com/" },
  { title: "DeepSeek", url: "https://chat.deepseek.com/" },
  { title: "豆包", url: "https://www.doubao.com/" },
  { title: "微信", url: "https://mp.weixin.qq.com/" },
  { title: "微博", url: "https://www.weibo.com/" },
  { title: "Twitter", url: "https://www.twitter.com/" },
  { title: "Instagram", url: "https://www.instagram.com/" },
  { title: "小红书", url: "https://www.xiaohongshu.com/" },
  { title: "知乎", url: "https://www.zhihu.com/" },
  { title: "抖音", url: "https://www.douyin.com/discover" },
  { title: "Bilibili", url: "https://www.bilibili.com/" },
  { title: "YouTube", url: "https://www.youtube.com/" },
  { title: "奶酪", url: "https://www.runningcheese.com/" },
  { title: "微信读书", url: "https://weread.qq.com/" },
  { title: "Wikipedia", url: "https://zh.wikipedia.org/zh-cn/" },
  { title: "Github", url: "https://github.com/" },
  { title: "Reddit", url: "https://reddit.com/" },
  { title: "贴吧", url: "https://tieba.baidu.com/" },
  { title: "网盘", url: "https://pan.baidu.com/" },
  { title: "知识星球", url: "https://wx.zsxq.com/dweb2/" },
  { title: "奶酪清单", url: "https://www.runningcheese.com/aaa" },
  { title: "threads", url: "https://www.threads.com/" },
];

// 默认列表的版本号：升级后重新写入一次，老用户也能拿到新的默认图标
const DEFAULTS_VERSION = 3;

const DEMO_TOP_SITES = [];

let topSites = [];
let renderedUrls = [];
let dragUrl = null;
let dialogMode = "add";
let editingId = null;
let editingOrigUrl = null; // 编辑非自定义（默认/常用网站）项时的原网址
let dialogIcon = null; // 添加/编辑对话框中的自定义图标（dataURL）
let dialogIconBg = null; // 图标背景色（#rrggbb），null = 默认
let dialogIconMode = "favicon"; // favicon | simple | custom
let dialogModeTouched = false;
let dialogModeToken = 0;

const DEFAULT_COLUMNS = 8;
const MAX_COLUMNS = 10;
const MAX_ROWS = 5;

/** 当前列数设置：5–10；窄屏仍会按 3/6 列封顶 */
function columnsSetting() {
  const value = Number(state.settings.columns);
  if (!Number.isFinite(value)) return DEFAULT_COLUMNS;
  return Math.min(MAX_COLUMNS, Math.max(5, Math.trunc(value)));
}

/** 实际列数：窄屏按 3/6 列封顶，宽屏才允许用户设置的 7–10 列 */
function effectiveColumns() {
  const maxByViewport = window.innerWidth < 866 ? 3 : window.innerWidth < 1122 ? 6 : MAX_COLUMNS;
  return Math.min(columnsSetting(), maxByViewport);
}

/** 当前行数设置：0 = 隐藏整块快捷方式，1–5 = 显示对应行数 */
function rowsSetting() {
  const value = Number(state.settings.rows);
  if (!Number.isFinite(value)) return 3;
  return Math.min(MAX_ROWS, Math.max(0, Math.trunc(value)));
}

function limit() {
  return rowsSetting() * effectiveColumns();
}

/** 常用网站：扩展内读 chrome.topSites；网页版没有该数据源，由默认图标补足 */
async function loadTopSites() {
  try {
    const sites = await getTopSites();
    if (Array.isArray(sites) && sites.length) {
      topSites = sites.map((s) => ({ title: s.title || hostOf(s.url), url: s.url })).filter((s) => s.url);
      return;
    }
  } catch (err) {
    console.warn("[foxfox] 读取常用网站失败", err);
  }
  topSites = DEMO_TOP_SITES;
}

function buildList() {
  if (rowsSetting() === 0) return [];
  const { custom = [], hidden = [], order = [] } = state.settings.shortcuts;
  const hiddenSet = new Set(hidden.map((u) => u.replace(/\/$/, "")));
  const customUrls = new Set(custom.map((c) => c.url.replace(/\/$/, "")));

  const merged = [];
  const seen = new Set();

  const push = (item, pinned) => {
    const key = item.url.replace(/\/$/, "");
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({ ...item, key, pinned });
  };

  // 固定的自定义项优先
  custom.filter((c) => c.pinned).forEach((c) => push(c, true));
  // 其余自定义
  custom.filter((c) => !c.pinned).forEach((c) => push(c, false));
  // 默认图标列表优先
  (state.settings.shortcuts.defaults || []).forEach((site) => {
    const key = site.url.replace(/\/$/, "");
    if (hiddenSet.has(key) || customUrls.has(key)) return;
    push(site, false);
  });
  // Top Sites 补足剩余空位
  topSites.forEach((site) => {
    const key = site.url.replace(/\/$/, "");
    if (hiddenSet.has(key) || customUrls.has(key)) return;
    push(site, false);
  });

  const orderIndex = new Map(order.map((url, index) => [url.replace(/\/$/, ""), index]));
  merged.sort((a, b) => {
    const ai = orderIndex.has(a.key) ? orderIndex.get(a.key) : Number.MAX_SAFE_INTEGER;
    const bi = orderIndex.has(b.key) ? orderIndex.get(b.key) : Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return 0;
  });

  // 行数决定可见容量：必须严格裁到 limit()。
  // 旧逻辑用 Math.max(limit()-1, pinnedItems.length)，24 个固定图标会把
  // 1 行 / 2 行重新撑成 3 行；现在按容量裁剪，空位由 render() 补「+」磁贴。
  const max = limit();
  const pinnedItems = merged.filter((m) => m.pinned);
  const rest = merged.filter((m) => !m.pinned);
  return [...pinnedItems, ...rest].slice(0, max);
}

// 英文界面下默认站点的显示名（仅展示层；设置数据里仍保存原中文名）
const SITE_TITLES_EN = {
  "https://music.163.com/": "NetEase Music",
  "https://mail.qq.com/": "QQ Mail",
  "https://tophub.today/c/news": "Tophub",
  "https://www.doubao.com/": "Doubao",
  "https://mp.weixin.qq.com/": "WeChat",
  "https://www.weibo.com/": "Weibo",
  "https://www.xiaohongshu.com/": "RedNote",
  "https://www.zhihu.com/": "Zhihu",
  "https://www.douyin.com/discover": "Douyin",
  "https://www.runningcheese.com/": "Cheese",
  "https://weread.qq.com/": "WeRead",
  "https://tieba.baidu.com/": "Tieba",
  "https://pan.baidu.com/": "Baidu Netdisk",
  "https://wx.zsxq.com/dweb2/": "Knowledge Planet",
  "https://www.runningcheese.com/aaa": "Cheese List",
};

function displayTitle(item) {
  if (locale !== "en" || !item?.url) return item?.title ?? "";
  const key = item.url.replace(/\/$/, "").toLowerCase();
  for (const [u, name] of Object.entries(SITE_TITLES_EN)) {
    if (u.replace(/\/$/, "").toLowerCase() === key) return name;
  }
  return item.title;
}

function shortcutMenu(anchor, item) {
  const isCustom = Boolean(item.id);
  const items = [
    { label: t("menuOpen"), icon: ICONS.external, onClick: () => (window.location.href = item.url) },
    { label: t("menuOpenNewTab"), icon: ICONS.plus, onClick: () => window.open(item.url, "_blank", "noopener") },
    item.pinned
      ? {
          label: t("menuUnpin"),
          icon: ICONS.pin,
          onClick: () => {
            if (isCustom) {
              const custom = state.settings.shortcuts.custom.map((c) =>
                c.id === item.id ? { ...c, pinned: false } : c
              );
              saveSettings({ shortcuts: { custom } }, "shortcuts");
            } else {
              const order = state.settings.shortcuts.order.filter((u) => u !== item.url);
              saveSettings({ shortcuts: { order } }, "shortcuts");
            }
            toast(t("toastUnpinned"));
          },
        }
      : {
          label: t("menuPin"),
          icon: ICONS.pin,
          onClick: () => {
            if (isCustom) {
              const custom = state.settings.shortcuts.custom.map((c) =>
                c.id === item.id ? { ...c, pinned: true } : c
              );
              saveSettings({ shortcuts: { custom } }, "shortcuts");
            } else {
              addCustom({ title: item.title, url: item.url, pinned: true });
            }
            toast(t("toastPinned"));
          },
        },
    {
      label: t("menuEdit"),
      icon: ICONS.pencil,
      onClick: () => openShortcutDialog({ mode: "edit", item }),
    },
    { type: "sep" },
    {
      label: t("remove"),
      icon: ICONS.trash,
      danger: true,
      onClick: () => removeShortcut(item),
    },
  ];
  openMenu({ anchor, items, align: "end" });
}

function addCustom({
  title,
  url,
  pinned = true,
  icon = null,
  iconBg = undefined,
  iconMode = undefined,
  position = "front",
}) {
  const custom = state.settings.shortcuts.custom.slice();
  const existing = custom.find((c) => c.url.replace(/\/$/, "") === url.replace(/\/$/, ""));
  if (existing) {
    existing.title = title;
    existing.pinned = pinned;
    if (icon !== undefined) existing.icon = icon;
    if (iconBg !== undefined) existing.iconBg = iconBg;
    if (iconMode !== undefined) existing.iconMode = iconMode;
  } else {
    custom.push({
      id: randomUUID(),
      title,
      url,
      pinned,
      icon,
      iconBg: iconBg ?? null,
      iconMode: iconMode ?? "favicon",
    });
  }
  let order = state.settings.shortcuts.order.slice();
  if (!order.includes(url)) {
    if (position === "end") {
      // 新增项排到网格最后：以当前显示顺序重写 order，再追加新项
      const visible = (renderedUrls.length ? renderedUrls : buildList()).map((i) => i.url);
      if (!visible.includes(url)) visible.push(url);
      order = visible;
    } else {
      order.unshift(url);
    }
  }
  saveSettings({ shortcuts: { custom, order } }, "shortcuts");
}

/** 自定义图标：SVG 保留矢量原样；位图 → cover 裁剪铺满 64×64 画布 → PNG dataURL
 *  SVG 若走 canvas 会被光栅化成位图（且只有 viewBox 没有宽高的 SVG 会算出
 *  Infinity/NaN 裁剪，得到一张空白图）。直接存 data:image/svg+xml，
 *  由 <img object-fit:contain> 矢量渲染，任意缩放都清晰（r62）。 */
function fileToIcon(file) {
  return new Promise((resolve, reject) => {
    const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name || "");
    if (!isSvg && !/^image\//.test(file.type)) return reject(new Error("不是图片文件"));
    const reader = new FileReader();
    reader.onload = () => {
      if (isSvg) {
        // 部分系统上传 .svg 时 file.type 为空，readAsDataURL 会写成
        // data:application/octet-stream;base64,…，<img> 无法渲染，这里统一规范 MIME。
        const raw = String(reader.result);
        const comma = raw.indexOf(",");
        if (comma < 0) return reject(new Error("SVG 读取失败"));
        const payload = raw.slice(comma + 1);
        try {
          if (!/<svg[\s>]/i.test(atob(payload))) return reject(new Error("不是有效的 SVG 文件"));
        } catch {
          return reject(new Error("SVG 读取失败"));
        }
        resolve("data:image/svg+xml;base64," + payload);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        // cover：按较长边放大铺满，超出部分居中裁掉（偏移为负即裁剪）
        const scale = Math.max(size / img.width, size / img.height);
        const w = Math.max(1, Math.round(img.width * scale));
        const hh = Math.max(1, Math.round(img.height * scale));
        ctx.drawImage(img, Math.round((size - w) / 2), Math.round((size - hh) / 2), w, hh);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("图片解码失败"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** 在线图标只接受 http(s) 图片地址 */
function normalizeOnlineIcon(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

/** 刷新对话框里的图标预览 */
function refreshIconPreview() {
  const preview = $("#shortcut-icon-preview");
  const thumb = $("#shortcut-icon-thumb");
  const clear = $("#shortcut-icon-clear");
  const color = $("#shortcut-icon-bg");
  const reset = $("#shortcut-icon-bg-reset");
  if (!preview) return;
  preview.style.backgroundColor = dialogIconBg || "";
  if (color) color.value = dialogIconBg || "#ffffff";
  if (reset) {
    reset.hidden = !dialogIconBg;
    if (reset.parentElement) reset.parentElement.hidden = !dialogIconBg;
  }
  if (dialogIcon) {
    preview.src = dialogIcon;
    preview.hidden = false;
    if (thumb) thumb.hidden = false;
    if (clear) clear.hidden = false;
  } else {
    preview.removeAttribute("src");
    preview.hidden = true;
    if (thumb) thumb.hidden = true;
    if (clear) clear.hidden = true;
  }
}

async function analyzeFaviconMode(url, token) {
  if (dialogModeTouched || dialogIconMode !== "favicon" || !url) return;
  const full = await faviconIsFullBleed(url).catch(() => null);
  if (token !== dialogModeToken || dialogModeTouched || full !== false) return;
  // 只切换弹窗里的选项，不写回设置；用户取消编辑时仍保持原来的 Favicon
  dialogIconMode = "simple";
  refreshIconMode();
  refreshIconPreview();
}

function refreshIconMode() {
  const wrap = $("#shortcut-icon-mode");
  if (!wrap) return;
  wrap.querySelectorAll("[data-icon-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.iconMode === dialogIconMode));
  });

  const custom = $("#shortcut-icon-custom");
  if (custom) custom.hidden = dialogIconMode !== "custom";

  const hint = $("#shortcut-icon-mode-hint");
  if (hint) {
    hint.hidden = dialogIconMode === "custom";
    hint.textContent =
      dialogIconMode === "favicon" ? t("iconModeFaviconHint") : t("iconModeSimpleHint");
  }
}

function applyIconModeLive(mode) {
  if (mode === "custom" || (!editingId && !editingOrigUrl)) return;
  const key = (u) => String(u || "").replace(/\/$/, "");
  const url = normalizeUrl($("#shortcut-url")?.value || "") || editingOrigUrl;
  if (!url) return;
  const custom = (state.settings.shortcuts.custom || []).slice();
  const existing = custom.find((item) => key(item.url) === key(url));

  if (editingId) {
    const target = custom.find((item) => item.id === editingId);
    if (!target) return;
    target.iconMode = mode;
  } else if (existing) {
    existing.iconMode = mode;
  } else if (mode === "simple") {
    custom.push({
      id: randomUUID(),
      title: $("#shortcut-name")?.value.trim() || hostOf(url),
      url,
      pinned: false,
      icon: null,
      iconBg: null,
      iconMode: mode,
    });
  } else {
    return;
  }
  saveSettings({ shortcuts: { custom } }, "shortcuts");
}

function setIconMode(mode) {
  if (!["simple", "favicon", "custom"].includes(mode)) return;
  dialogIconMode = mode;
  dialogModeTouched = true;
  dialogModeToken++;
  applyIconModeLive(mode);
  refreshIconMode();
  refreshIconPreview();
}

function removeShortcut(item) {
  const key = (u) => String(u || "").replace(/\/$/, "");
  const { custom = [], hidden = [], order = [] } = state.settings.shortcuts;
  const urlKey = key(item.url);
  // 同 URL 可能同时存在自定义覆盖项、重复自定义项、默认项或 Top Site：
  // 一次删除要全部清掉，否则下一次渲染又会冒出同名的另一个图标。
  const nextCustom = custom.filter((c) => key(c.url) !== urlKey && c.id !== item.id);
  const nextHidden = Array.from(
    new Set([...hidden, item.url, ...custom.filter((c) => key(c.url) === urlKey).map((c) => c.url)])
  );
  const nextOrder = order.filter((u) => key(u) !== urlKey);
  saveSettings(
    { shortcuts: { custom: nextCustom, hidden: nextHidden, order: nextOrder } },
    "shortcuts"
  );
  toast(t("toastRemoved"));
}

function openShortcutDialog({ mode = "add", item = null, defaults = null } = {}) {
  dialogMode = mode;
  editingId = item?.id || null;
  editingOrigUrl = item && !item.id ? item.url : null;
  dialogIcon = item?.icon || null;
  dialogIconBg = item?.iconBg || null;
  const storedMode = item?.iconMode === "auto" ? "favicon" : item?.iconMode;
  dialogIconMode = storedMode || (item?.icon ? "custom" : "favicon");
  dialogModeTouched = false;
  const iconUrlInput = $("#shortcut-icon-url");
  if (iconUrlInput) {
    iconUrlInput.value = /^https?:/i.test(dialogIcon || "") ? dialogIcon : "";
  }
  const modal = $("#shortcut-modal");
  const title = $("#shortcut-modal-title");
  const nameInput = $("#shortcut-name");
  const urlInput = $("#shortcut-url");
  const error = $("#shortcut-error");
  const save = $("#shortcut-save");

  title.textContent = mode === "edit" ? t("editShortcut") : t("addShortcut");
  save.textContent = mode === "edit" ? t("save") : t("add");
  nameInput.value = (item && displayTitle(item)) || defaults?.title || "";
  urlInput.value = item?.url || defaults?.url || "";
  error.hidden = true;
  error.textContent = "";
  refreshIconPreview();
  refreshIconMode();
  const modeToken = ++dialogModeToken;
  if (dialogIconMode === "favicon") analyzeFaviconMode(normalizeUrl(urlInput.value), modeToken);

  openModal(modal);
  setTimeout(() => (nameInput.value ? urlInput.focus() : nameInput.focus()), 40);
}

export function initShortcuts() {
  const container = $("#shortcuts");
  const form = $("#shortcut-form");
  const modal = $("#shortcut-modal");
  const nameInput = $("#shortcut-name");
  const urlInput = $("#shortcut-url");
  const errorEl = $("#shortcut-error");

  $("#shortcut-cancel-x")?.addEventListener("click", () => closeModal(modal));
  $("#shortcut-cancel")?.addEventListener("click", () => closeModal(modal));

  // 自定义图标选择
  const iconUrlInput = $("#shortcut-icon-url");
  const iconFile = $("#shortcut-icon-file");
  const iconBtn = $("#shortcut-icon-btn");
  const iconClear = $("#shortcut-icon-clear");
  iconBtn?.addEventListener("click", () => iconFile?.click());
  iconFile?.addEventListener("change", async () => {
    const file = iconFile.files?.[0];
    if (!file) return;
    try {
      dialogIcon = await fileToIcon(file);
      if (iconUrlInput) iconUrlInput.value = "";
      refreshIconPreview();
    } catch (err) {
      console.warn("[foxfox] 图标读取失败", err);
      toast(t("toastIconReadFailed"));
    }
    iconFile.value = "";
  });
  iconClear?.addEventListener("click", () => {
    dialogIcon = null;
    dialogIconBg = null;
    if (iconUrlInput) iconUrlInput.value = "";
    refreshIconPreview();
  });
  $("#shortcut-icon-mode")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-icon-mode]");
    if (!btn) return;
    setIconMode(btn.dataset.iconMode);
  });

  const iconBg = $("#shortcut-icon-bg");
  const iconBgReset = $("#shortcut-icon-bg-reset");
  iconBg?.addEventListener("input", () => {
    dialogIconBg = iconBg.value;
    refreshIconPreview();
  });
  iconBgReset?.addEventListener("click", () => {
    dialogIconBg = null;
    refreshIconPreview();
  });

  urlInput.addEventListener("blur", () => {
    const normalized = normalizeUrl(urlInput.value);
    if (normalized && !nameInput.value.trim()) nameInput.value = siteNameFromUrl(normalized);
    if (normalized && !dialogModeTouched && dialogIconMode === "favicon") {
      analyzeFaviconMode(normalized, ++dialogModeToken);
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const url = normalizeUrl(urlInput.value);
    if (!name) {
      errorEl.textContent = t("errNameRequired");
      errorEl.hidden = false;
      nameInput.focus();
      return;
    }
    if (!url) {
      errorEl.textContent = t("errInvalidUrl");
      errorEl.hidden = false;
      urlInput.focus();
      return;
    }

    const pendingIconUrl =
      dialogIconMode === "custom" ? iconUrlInput?.value.trim() || "" : "";
    if (pendingIconUrl) {
      const normalized = normalizeOnlineIcon(pendingIconUrl);
      if (!normalized) {
        toast(t("toastInvalidIconUrl"));
        iconUrlInput.focus();
        return;
      }
      dialogIcon = normalized;
    }

    const savedIcon = dialogIconMode === "custom" ? dialogIcon : null;
    const savedIconBg = dialogIconMode === "custom" ? dialogIconBg : null;

    if (dialogMode === "edit" && editingId) {
      const custom = state.settings.shortcuts.custom.map((c) =>
        c.id === editingId
          ? {
              ...c,
              title: name,
              url,
              icon: savedIcon,
              iconBg: savedIconBg,
              iconMode: dialogIconMode,
            }
          : c
      );
      saveSettings({ shortcuts: { custom } }, "shortcuts");
      toast(t("toastUpdated"));
    } else if (dialogMode === "edit" && editingOrigUrl) {
      // 编辑默认/常用网站项：转为自定义项；网址变化时隐藏原项，并沿用其排列位置
      const key = (u) => u.replace(/\/$/, "");
      const { custom = [], hidden = [], order = [] } = state.settings.shortcuts;
      const nextCustom = custom.slice();
      const existing = nextCustom.find((c) => key(c.url) === key(url));
      if (existing) {
        existing.title = name;
        existing.icon = savedIcon;
        existing.iconBg = savedIconBg;
        existing.iconMode = dialogIconMode;
      } else {
        nextCustom.push({
          id: randomUUID(),
          title: name,
          url,
          pinned: false,
          icon: savedIcon,
          iconBg: savedIconBg,
          iconMode: dialogIconMode,
        });
      }
      const nextHidden =
        key(editingOrigUrl) !== key(url) && !hidden.includes(editingOrigUrl)
          ? [...hidden, editingOrigUrl]
          : hidden.slice();
      const nextOrder = order.slice();
      const idx = nextOrder.findIndex((u) => key(u) === key(editingOrigUrl));
      if (idx !== -1) nextOrder[idx] = url;
      else if (!nextOrder.includes(url)) nextOrder.push(url);
      saveSettings({ shortcuts: { custom: nextCustom, hidden: nextHidden, order: nextOrder } }, "shortcuts");
      toast(t("toastUpdated"));
    } else {
      // 对话框新增：不固定（固定组恒排前），放在网格最后
      addCustom({
        title: name,
        url,
        pinned: false,
        icon: savedIcon,
        iconBg: savedIconBg,
        iconMode: dialogIconMode,
        position: "end",
      });
      toast(t("toastShortcutAdded"));
    }
    dialogIcon = null;
    dialogIconBg = null;
    closeModal(modal);
  });

  container.addEventListener("click", (event) => {
    const addBtn = event.target.closest(".add-button");
    if (addBtn) {
      event.preventDefault();
      openShortcutDialog({ mode: "add" });
      return;
    }
    const menuBtn = event.target.closest(".context-menu-button");
    const tile = event.target.closest(".top-site-outer");
    if (!tile || tile.classList.contains("add-button-tile")) return;
    if (menuBtn) {
      event.preventDefault();
      const item = renderedUrls.find((i) => i.url === tile.dataset.url);
      if (item) shortcutMenu(menuBtn, item);
      return;
    }
    // 普通点击交给默认行为；按住 Cmd/Ctrl 时新标签页打开
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      window.open(tile.dataset.url, "_blank", "noopener");
    }
  });

  // 菜单入口：左键点击磁贴右上角的「⋮」按钮；右键磁贴直接进入编辑状态

  // 右键磁贴：直接打开「编辑快捷方式」对话框
  container.addEventListener("contextmenu", (event) => {
    const tile = event.target.closest(".top-site-outer");
    if (!tile || tile.classList.contains("add-button-tile")) return;
    event.preventDefault();
    const item = renderedUrls.find((i) => i.url === tile.dataset.url);
    if (item) openShortcutDialog({ mode: "edit", item });
  });

  // 键盘：菜单键 / Shift+F10
  container.addEventListener("keydown", (event) => {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    const tile = event.target.closest(".top-site-outer");
    if (!tile || tile.classList.contains("add-button-tile")) return;
    event.preventDefault();
    const item = renderedUrls.find((i) => i.url === tile.dataset.url);
    if (item) shortcutMenu(tile, item);
  });

  /* ------------------------------ 拖拽排序 ------------------------------ */
  let dragOriginalUrls = null;
  let dragLastKey = "";

  const reduceMotion = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const captureOffsets = (tiles) =>
    new Map(tiles.map((el) => [el, { x: el.offsetLeft, y: el.offsetTop }]));

  const animateTiles = (tiles, before, skip = null) => {
    if (reduceMotion()) return;
    for (const el of tiles) {
      if (el === skip) continue;
      const prev = before.get(el);
      if (!prev) continue;
      const dx = prev.x - el.offsetLeft;
      const dy = prev.y - el.offsetTop;
      if (!dx && !dy) continue;
      el.getAnimations().forEach((animation) => animation.cancel());
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
      );
    }
  };

  const moveTile = (dragged, target, after) => {
    const ref = after ? target.nextElementSibling : target;
    if (ref === dragged) return false;
    if (!after && dragged.nextElementSibling === target) return false;
    if (after && dragged.previousElementSibling === target) return false;

    const tiles = [...container.querySelectorAll(".top-site-outer")];
    const before = captureOffsets(tiles);
    container.insertBefore(dragged, ref);
    animateTiles(tiles, before, dragged);
    return true;
  };

  const restoreOrder = (urls) => {
    const addTile = container.querySelector(".add-button-tile");
    const tiles = [...container.querySelectorAll(".top-site-outer")];
    const before = captureOffsets(tiles);
    const byUrl = new Map(
      tiles.filter((el) => el.dataset.url).map((el) => [el.dataset.url, el])
    );
    urls.forEach((url) => {
      const el = byUrl.get(url);
      if (el) container.insertBefore(el, addTile || null);
    });
    animateTiles(tiles, before);
  };

  container.addEventListener("dragstart", (event) => {
    const tile = event.target.closest(".top-site-outer");
    if (!tile || tile.classList.contains("add-button-tile")) return;
    dragUrl = tile.dataset.url;
    dragOriginalUrls = [...container.querySelectorAll(".top-site-outer[data-url]")].map(
      (el) => el.dataset.url
    );
    dragLastKey = "";
    container.classList.add("dnd-active");
    tile.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", dragUrl);
  });

  container.addEventListener("dragend", () => {
    if (!dragUrl) {
      finishDrag();
      return;
    }
    if (dragOriginalUrls) restoreOrder(dragOriginalUrls);
    finishDrag();
  });

  container.addEventListener("dragover", (event) => {
    if (!dragUrl) return;
    const tile = event.target.closest(".top-site-outer");
    if (!tile || tile.classList.contains("add-button-tile")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const dragged = [...container.querySelectorAll(".top-site-outer[data-url]")].find(
      (el) => el.dataset.url === dragUrl
    );
    if (!dragged || dragged === tile) return;

    const rect = tile.getBoundingClientRect();
    const after = event.clientX > rect.left + rect.width / 2;
    const key = `${tile.dataset.url}|${after}`;
    if (key === dragLastKey) return;
    dragLastKey = key;

    moveTile(dragged, tile, after);
  });

  container.addEventListener("drop", (event) => {
    if (!dragUrl) return;
    const tile = event.target.closest(".top-site-outer");
    if (!tile || tile.classList.contains("add-button-tile")) return;
    event.preventDefault();

    const urls = [...container.querySelectorAll(".top-site-outer[data-url]")].map(
      (el) => el.dataset.url
    );
    const changed =
      dragOriginalUrls && urls.join("\n") !== dragOriginalUrls.join("\n");
    finishDrag();
    if (changed) saveSettings({ shortcuts: { order: urls } }, "shortcuts");
  });

  function finishDrag() {
    dragUrl = null;
    dragOriginalUrls = null;
    dragLastKey = "";
    container.classList.remove("dnd-active");
    container.querySelectorAll(".top-site-outer").forEach((el) => {
      el.classList.remove("is-dragging");
    });
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 120);
  });

  loadTopSites().then(() => {
    seedDefaults();
    render();
    autoApplySimpleModes().catch(() => {});
  });
}

/** 启动时把「未满底色」的 favicon 快捷方式自动切换为 Simple Icons */
async function autoApplySimpleModes() {
  const key = (u) => String(u || "").replace(/\/$/, "");
  const { custom = [], defaults = [], hidden = [] } = state.settings.shortcuts;
  const hiddenSet = new Set(hidden.map(key));
  const customUrls = new Set(custom.map((item) => key(item.url)));
  const nextCustom = custom.slice();
  const changes = [];
  const seen = new Set();

  let changed = false;

  const addCandidate = (item, isCustom) => {
    const urlKey = key(item.url);
    if (seen.has(urlKey) || hiddenSet.has(urlKey) || hasLocalIcon(item.url)) return;
    seen.add(urlKey);
    const mode = item.iconMode;
    if (mode === "simple" || mode === "custom") return;
    if (item.icon) return;
    changes.push({ item, isCustom });
  };

  custom.forEach((item) => addCandidate(item, true));
  defaults.forEach((item) => addCandidate(item, false));
  topSites.forEach((item) => addCandidate(item, false));

  for (const { item, isCustom } of changes) {
    const full = await faviconIsFullBleed(item.url).catch(() => null);
    if (full !== false) continue;
    if (isCustom) {
      const target = nextCustom.find((c) => key(c.url) === key(item.url));
      if (target) {
        target.iconMode = "simple";
        changed = true;
      }
    } else if (!customUrls.has(key(item.url))) {
      nextCustom.push({
        id: randomUUID(),
        title: item.title || hostOf(item.url),
        url: item.url,
        pinned: false,
        icon: null,
        iconBg: null,
        iconMode: "simple",
      });
      customUrls.add(key(item.url));
      changed = true;
    }
  }

  if (changed) {
    saveSettings({ shortcuts: { custom: nextCustom } }, "shortcuts");
    render();
  }
}

/** 首次运行或默认列表升级时写入默认图标（保留用户的移除/排序结果） */
function seedDefaults() {
  const shortcuts = state.settings.shortcuts;
  if (shortcuts.seeded && shortcuts.defaultsVersion === DEFAULTS_VERSION) return;

  const hiddenSet = new Set((shortcuts.hidden || []).map((u) => u.replace(/\/$/, "")));
  const customSet = new Set(shortcuts.custom.map((c) => c.url.replace(/\/$/, "")));
  const picks = DEFAULT_SHORTCUTS.filter((item) => {
    const key = item.url.replace(/\/$/, "");
    return !hiddenSet.has(key) && !customSet.has(key);
  }).slice(0, 60);

  const patch = { shortcuts: { defaults: picks, seeded: true, defaultsVersion: DEFAULTS_VERSION } };
  // 默认图标有 27 个，升级时若行数不足四行则一并放宽，避免有图标被挤掉；
  // rows=0 是用户主动隐藏，不要覆盖
  if (rowsSetting() > 0 && rowsSetting() < 4) patch.rows = 4;
  saveSettings(patch, "shortcuts");
}

/* 结构与 Firefox TopSite.jsx 一致：
   li.top-site-outer > .top-site-inner > a.top-site-button > (.tile > .icon-stack > .icon-wrapper > img)
                                                       + .icon-pin-small + .title > .title-label */
function hasLocalIcon(url) {
  return LOCAL_ICON_HOSTS.some((host) => url.includes(host));
}

function tileFor(item) {
  const wrapper = h("div", { class: "icon-wrapper" });
  const img = h("img", { class: "top-site-icon", alt: "" });
  const storedMode = item.iconMode === "auto" ? "favicon" : item.iconMode;
  const mode = ["favicon", "simple", "custom"].includes(storedMode)
    ? storedMode
    : item.icon
      ? "custom"
      : "favicon";

  const demoteToFavicon = () => {
    const custom = (state.settings.shortcuts.custom || []).slice();
    const key = (u) => String(u || "").replace(/\/$/, "");
    const target = custom.find(
      (c) => c.id === item.id || key(c.url) === key(item.url)
    );
    if (!target || target.iconMode !== "simple") return;
    target.iconMode = "favicon";
    saveSettings({ shortcuts: { custom } }, "shortcuts");
  };

  const fallbackFavicon = () => {
    if (!hasLocalIcon(item.url)) {
      mountFavicon(img, {
        url: item.url,
        title: item.title,
        useSimple: false,
        onLetterFallback: demoteToFavicon,
      });
    }
  };

  if (mode === "custom" || mode === "simple") {
    // 本地 icons/ 的背景图只服务于 favicon 模式，避免从透明 SVG 后面透出来
    wrapper.style.backgroundImage = "none";
  }

  if (mode === "simple") {
    wrapper.classList.add("icon-simple");
    const src = simpleIconUrl(item.url);
    if (src) {
      const cached = getCachedSimpleIcon(src);
      if (cached) {
        img.src = cached;
      } else {
        img.src = src;
        cacheSimpleIcon(src).then((data) => {
          if (data) img.src = data;
        });
      }
      img.addEventListener(
        "error",
        async () => {
          const data = await cacheSimpleIcon(src);
          if (data) img.src = data;
          else fallbackFavicon();
        },
        { once: true }
      );
    } else {
      fallbackFavicon();
    }
  } else if (mode === "custom") {
    if (item.iconBg) wrapper.style.backgroundColor = item.iconBg;
    if (item.icon) {
      img.src = item.icon;
      img.addEventListener("error", fallbackFavicon, { once: true });
    } else {
      fallbackFavicon();
    }
  } else if (!hasLocalIcon(item.url)) {
    // favicon 模式：命中本地图标时由 CSS 提供背景图，其余走站点 favicon
    mountFavicon(img, { url: item.url, title: item.title, useSimple: false });
  }
  wrapper.append(img);

  const menuBtn = h("button", {
    class: "context-menu-button",
    type: "button",
    "aria-label": t("itemOptions", { title: displayTitle(item) }),
    html: ICONS.more,
  });

  const link = h(
    "a",
    {
      class: "top-site-button",
      href: item.url,
      draggable: "true",
      title: displayTitle(item),
      "aria-label": displayTitle(item),
    },
    h("div", { class: "tile", "aria-hidden": "true" }, h("div", { class: "icon-stack" }, wrapper)),
    item.pinned ? h("div", { class: "icon-pin-small", html: ICONS.pin }) : null,
    h("div", { class: "title" }, h("span", { class: "title-label", dir: "auto", text: displayTitle(item) }))
  );

  return h(
    "li",
    { class: "top-site-outer", dataset: { url: item.url } },
    h("div", { class: "top-site-inner" }, link, menuBtn)
  );
}

export function render() {
  const container = $("#shortcuts");
  if (!container) return;

  // rows=0：隐藏整块快捷方式，只保留壁纸与右下角齿轮
  const section = container.closest(".top-sites");
  if (rowsSetting() === 0) {
    renderedUrls = [];
    container.replaceChildren();
    if (section) section.hidden = true;
    return;
  }
  if (section) section.hidden = false;

  const columns = effectiveColumns();
  container.style.setProperty("--shortcut-columns", String(columns));
  container.classList.toggle("dense", columns >= 9);

  // 9/10 列时适当加宽主栏（body-wrapper 跟随主栏 100%）
  const main = container.closest(".newtab-main");
  if (main) {
    main.classList.toggle("cols-9", columns === 9);
    main.classList.toggle("cols-10", columns === 10);
  }

  const list = buildList();
  renderedUrls = list;
  const nodes = list.map(tileFor);

  // 有空位时追加「+」磁贴（默认隐藏，鼠标经过网格时淡入，见 CSS）
  if (list.length < limit()) {
    nodes.push(
      h(
        "li",
        { class: "top-site-outer add-button-tile" },
        h("button", { class: "add-button", type: "button", "aria-label": t("addShortcut"), html: ICONS.plus })
      )
    );
  }

  container.replaceChildren(...nodes);

  // 「+」磁贴独占一行，行高由它自身内容决定，会比普通磁贴矮一截；
  // 用普通磁贴的实测高度补齐，保证悬停底色尺寸完全一致
  const refTile = container.querySelector(".top-site-outer[data-url]");
  if (refTile && container.querySelector(".add-button-tile")) {
    requestAnimationFrame(() => {
      const h = refTile.getBoundingClientRect().height;
      if (h > 0) container.style.setProperty("--tile-height", `${h}px`);
    });
  }
}
