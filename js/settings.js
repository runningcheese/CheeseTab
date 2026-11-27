// 设置抽屉 + 外观（主题 / 壁纸 / 布局）

import { $, h } from "./util.js";
import {
  state,
  saveSettings,
  wallpaperById,
  getWallpaperBlob,
  putWallpaperBlob,
  deleteWallpaperBlob,
  getCachedWallpaper,
  cacheWallpaper,
  clearSettings,
} from "./store.js";
import { ICONS } from "./icons.js";
import { WALLPAPERS, WALLPAPER_CATEGORIES, categoryName, wallpaperName, pickRandomWallpaper, wallpaperSrc } from "./wallpapers.js";
import { t } from "./i18n.js";
import { bingToday } from "./bing.js";
import { toast, confirmDialog } from "./ui.js";
import { APP_VERSION } from "./version.js";

function currentVersion() {
  try {
    return chrome.runtime.getManifest().version || APP_VERSION;
  } catch {
    return APP_VERSION;
  }
}

const media = window.matchMedia("(prefers-color-scheme: dark)");
let customWallpaperUrl = null;
let wallpaperObjectUrl = null; // 在线壁纸的缓存 blob URL
let contrastRun = 0; // 图片亮度采样是异步的，用它丢弃过期结果

/* ------------------------------- 外观应用 ------------------------------- */

function resolvedTheme() {
  // 主题恒跟随系统（设置里的手动切换已移除）：系统深色 → dark，否则 light
  return media.matches ? "dark" : "light";
}

function applyTheme() {
  document.documentElement.dataset.theme = resolvedTheme();
}

/** WCAG 相对亮度：sRGB 通道 → 线性值 */
function linearChannel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r, g, b) {
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

/** 纯色壁纸按实际颜色决定白字/黑字 */
function needsLightText(luminance) {
  const light = 1.05 / (luminance + 0.05);
  const dark = (luminance + 0.05) / 0.05;
  return light > dark;
}

function solidNeedsLightText(solid) {
  const match = String(solid || "").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return false;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
  const value = parseInt(hex, 16);
  return needsLightText(
    relativeLuminance((value >> 16) & 255, (value >> 8) & 255, value & 255)
  );
}

/* 图片壁纸的判定阈值：中位亮度高于它 → 黑字，否则白字。
   比纯 WCAG 分界点高，是因为标题自带阴影，中等偏暗的图片用白字更稳。 */
const IMAGE_BLACK_TEXT_THRESHOLD = 0.4;

function imageNeedsLightText(medianLuminance) {
  return medianLuminance <= IMAGE_BLACK_TEXT_THRESHOLD;
}

/* -------------------- 图片壁纸亮度采样 -------------------- */
/* 远程图床（i0.wp.com）与同源壁纸可以直接 fetch，画到 canvas 上采样；
   mozilla CDN / Bing 等无 CORS 的图片会失败，回落到 theme 元数据。 */
const imageLuminanceCache = new Map();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

async function sampleBlobLuminance(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return null;

    // 缩到 48×48 取整张图的平均亮度（用户感知的是整张壁纸的明暗，而非局部）
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);

    const { data } = ctx.getImageData(0, 0, size, size);
    const luminances = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) continue; // 跳过全透明像素
      luminances.push(relativeLuminance(data[i], data[i + 1], data[i + 2]));
    }
    if (!luminances.length) return null;

    // 用中位数而不是平均值：局部高光/亮部会把平均值拉高，
    // 导致“整体偏暗、只有中间亮”的壁纸被误判为浅色。
    luminances.sort((a, b) => a - b);
    return luminances[Math.floor(luminances.length / 2)];
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function imageLuminance(src) {
  if (imageLuminanceCache.has(src)) return imageLuminanceCache.get(src);

  const task = (async () => {
    let blob = null;
    try {
      blob = await getCachedWallpaper(src);
    } catch {
      /* 缓存不可用，继续联网 */
    }
    if (!blob) {
      const res = await fetch(src, { mode: "cors", credentials: "omit", cache: "force-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      blob = await res.blob();
    }
    return sampleBlobLuminance(blob);
  })()
    .catch(() => null)
    .then((value) => {
      if (value == null) imageLuminanceCache.delete(src); // 失败不长期缓存，下次可重试
      return value;
    });

  imageLuminanceCache.set(src, task);
  return task;
}

export async function applyAppearance() {
  const run = ++contrastRun;
  applyTheme();

  const wp = state.settings.wallpaper;
  const preset = wallpaperById(wp.id); // null = none / custom / bing / 未知旧值
  const body = document.body;
  const root = document.documentElement;

  // Bing 每日壁纸（跟随当日图自动更换）：id = "bing"（r42 旧值 "bing:<url>" 兼容）
  const isBing = wp.id === "bing" || (typeof wp.id === "string" && wp.id.startsWith("bing:"));
  const isCustom = wp.id === "custom" || (typeof wp.id === "string" && wp.id.startsWith("custom:"));
  const isSolid = Boolean(preset?.solid);
  const customBlob = isCustom ? await getWallpaperBlob(customBlobKey(wp.id)) : null;
  const hasCustomImage = Boolean(customBlob);
  // 选了「自定义」但图片不存在（没上传过 / 已被清除）时退回默认壁纸，
  // 否则页面会误进入壁纸模式：背景变透明 + 文字转白，看起来像被切成深色主题
  const isNone = (!preset && !isCustom && !isBing) || (isCustom && !hasCustomImage);

  body.classList.toggle("has-wallpaper", !isNone);
  // 新壁纸集不再使用渐变，保留变量以兼容既有样式
  root.style.setProperty("--wall-a", "transparent");
  root.style.setProperty("--wall-b", "transparent");
  root.style.setProperty("--wall-blur", `${wp.blur || 0}px`);
  root.style.setProperty("--wall-dim", String((wp.dim || 0) / 100));
  // 图片壁纸按 Firefox 记录的裁剪位置铺；纯色壁纸铺底色
  root.style.setProperty("--wall-position", preset?.position || "center");
  root.style.setProperty("--wall-color", preset?.solid || "var(--newtab-background-color)");

  // 深色壁纸 / 上传图片 / Bing 图片壁纸 → 文字转白。
  // 纯色壁纸按实际颜色算对比度；图片壁纸仍用 theme 元数据（无法安全读取远程图片像素）。
  const wantsLightText =
    hasCustomImage ||
    isBing ||
    (isSolid ? solidNeedsLightText(preset.solid) : preset?.theme === "dark");
  body.dataset.contrast = !isNone && wantsLightText ? "light" : "";

  if (hasCustomImage) {
    if (customWallpaperUrl) URL.revokeObjectURL(customWallpaperUrl);
    customWallpaperUrl = URL.createObjectURL(customBlob);
    root.style.setProperty("--wall-image", `url("${customWallpaperUrl}")`);
  } else if (isBing) {
    // Bing 每日壁纸：url 每天不同（扩展内走 bing.xinac.net，网页版走支持 CORS 的镜像，
    // 图片本体仍走 IndexedDB 缓存优先，离线可用）
    let info = null;
    try {
      info = await bingToday();
    } catch (err) {
      console.warn("[foxfox] Bing 今日壁纸获取失败", err);
    }
    const src = info?.url;
    const cacheable = Boolean(src) && info?.cacheable !== false && /^https?:/i.test(src);
    if (!src) {
      // 首次使用即离线 / 接口异常：退回无壁纸状态，避免白字配透明背景
      root.style.setProperty("--wall-image", "none");
      body.classList.toggle("has-wallpaper", false);
      body.dataset.contrast = "";
    } else if (cacheable) {
      const cached = await getCachedWallpaper(src);
      if (cached) {
        if (wallpaperObjectUrl) URL.revokeObjectURL(wallpaperObjectUrl);
        wallpaperObjectUrl = URL.createObjectURL(cached);
        root.style.setProperty("--wall-image", `url("${wallpaperObjectUrl}")`);
      } else {
        root.style.setProperty("--wall-image", `url("${src}")`);
        cacheWallpaper(src).catch(() => {});
      }
    } else {
      // 直连图床（无 CORS）：无法写入 IndexedDB，但浏览器 HTTP 缓存仍生效
      root.style.setProperty("--wall-image", `url("${src}")`);
    }
  } else if (isSolid) {
    root.style.setProperty("--wall-image", "none");
  } else if (preset?.url) {
    // 在线壁纸：优先用 IndexedDB 缓存（离线可用），无缓存则直连 CDN 并顺手缓存。
    // 线上部署时 Firefox 的 SVG 走同源副本（preset.localUrl），无需也不应重复缓存。
    const src = wallpaperSrc(preset);
    if (preset.localUrl) {
      root.style.setProperty("--wall-image", `url("${src}")`);
    } else {
      const cached = await getCachedWallpaper(src);
      if (cached) {
        if (wallpaperObjectUrl) URL.revokeObjectURL(wallpaperObjectUrl);
        wallpaperObjectUrl = URL.createObjectURL(cached);
        root.style.setProperty("--wall-image", `url("${wallpaperObjectUrl}")`);
      } else {
        root.style.setProperty("--wall-image", `url("${src}")`);
        cacheWallpaper(src).catch(() => {});
      }
    }
  } else {
    root.style.setProperty("--wall-image", "none");
  }

  // 图片壁纸：先按 theme 元数据给出初始文字色，再异步采样实际亮度纠正。
  // 采样失败（无 CORS / 解码失败）就保留元数据，不影响页面。
  if (!isNone && !isBing && !isSolid) {
    // 自定义图片直接分析 Blob：避免 object URL 在重绘时被 revoke 后 fetch 失败
    const analysis = hasCustomImage ? sampleBlobLuminance(customBlob) : imageLuminance(wallpaperSrc(preset));
    analysis.then((luminance) => {
      if (luminance == null || run !== contrastRun) return;
      const dim = Math.min(1, Math.max(0, (wp.dim || 0) / 100));
      body.dataset.contrast = imageNeedsLightText(luminance * (1 - dim)) ? "light" : "";
    });
  }
}

export function initAppearance() {
  applyAppearance();
  media.addEventListener("change", () => {
    applyTheme();
    applyAppearance();
  });
  // Bing 每日壁纸：定时检查换图（Bing 约每天 16:00 更新，最迟半小时内跟上）
  const isBingWall = () => {
    const id = state.settings.wallpaper?.id;
    return id === "bing" || (typeof id === "string" && id.startsWith("bing:"));
  };
  setInterval(() => {
    if (isBingWall()) applyAppearance();
  }, 30 * 60 * 1000);
}

/* ------------------------------- 通用控件 ------------------------------- */

function row(title, control) {
  // 标题与 segmented 共用一条轨道，作为一个完整控件显示
  if (control?.classList?.contains("segmented")) {
    return h(
      "div",
      { class: "settings__row settings__row--fused" },
      h(
        "div",
        { class: "settings-fused" },
        title ? h("span", { class: "settings__row-title settings-fused__label", text: title }) : null,
        control
      )
    );
  }
  return h(
    "div",
    { class: "settings__row" },
    h("div", { class: "settings__row-text" }, h("div", { class: "settings__row-title", text: title })),
    control
  );
}
function segmented(options, value, onChange, className = "") {
  const wrap = h("div", { class: `segmented ${className}`.trim(), role: "group" });
  options.forEach((option) => {
    const btn = h("button", {
      class: "segmented__btn",
      type: "button",
      text: option.label,
      "aria-pressed": String(option.value === value),
    });
    btn.addEventListener("click", () => {
      wrap.querySelectorAll(".segmented__btn").forEach((el) => el.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      onChange(option.value);
    });
    wrap.append(btn);
  });
  return wrap;
}

/* ------------------------------- 壁纸选择 ------------------------------- */
/* 对齐 Firefox WallpaperCategories：一级 8 个分类（3 列），点入后子列表 3 列 × 86px，
   选中内描边 3px，悬停变暗，子列表头部带返回箭头。
   例外（点击不进子列表，直接应用）：「Bing」启用每日壁纸；「随机」从 random-* 图池
   抽一张；「自定义图像」直接打开文件选择器上传图片并应用（删除角标留在一级磁贴） */

// 记住当前停留在哪个分类子列表（refreshSettings 重建后仍停留在该视图）
let wallpaperView = null;

const customBlobKey = (id) => (id === "custom" ? "custom-wallpaper" : id);

/** 自定义图片列表；兼容旧版本的单张 custom-wallpaper */
async function customItems() {
  const items = [...(state.settings.customWallpapers || [])];
  if (!items.some((item) => item.id === "custom")) {
    const legacy = await getWallpaperBlob("custom-wallpaper");
    if (legacy) items.unshift({ id: "custom", name: t("customImageFallback"), ts: 0 });
  }
  return items;
}

// 「自定义图像」现在是一个普通分组，可保存多张图片；新图片追加到列表末尾。
async function applyCustomImage(file) {
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) {
    toast(t("toastImageTooLarge"));
    return;
  }
  try {
    const unique = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const id = `custom:${unique}`;
    await putWallpaperBlob(file, id);
    const item = {
      id,
      name: file.name || t("customImageFallback"),
      ts: Date.now(),
    };
    const customWallpapers = [...(state.settings.customWallpapers || []), item];
    saveSettings({ customWallpapers, wallpaper: { id } }, "wallpaper");
    await applyAppearance();
    toast(t("toastWallpaperUpdated"));
    refreshSettings();
  } catch (err) {
    console.error(err);
    toast(t("toastWallpaperSaveFailed"));
  }
}

function pickCustomImage() {
  const input = h("input", { type: "file", accept: "image/*", hidden: true });
  input.addEventListener("change", async () => {
    await applyCustomImage(input.files?.[0]);
    input.remove();
  });
  document.body.append(input);
  input.click();
}

async function deleteCustomImage(id = state.settings.wallpaper.id) {
  const ok = await confirmDialog({
    title: t("deleteMyImageTitle"),
    message: t("deleteMyImageMsg"),
    confirmText: t("delete"),
    danger: true,
  });
  if (!ok) return;

  await deleteWallpaperBlob(customBlobKey(id));
  const remaining = (state.settings.customWallpapers || []).filter((item) => item.id !== id);
  const wasCurrent = state.settings.wallpaper.id === id;
  saveSettings(
    {
      customWallpapers: remaining,
      ...(wasCurrent ? { wallpaper: { id: remaining[0]?.id || "none" } } : {}),
    },
    "wallpaper"
  );
  await applyAppearance();
  toast(t("toastCustomImageDeleted"));
  refreshSettings();
}

function wallpaperGrid() {
  const current = state.settings.wallpaper.id;
  const currentPreset = wallpaperById(current);
  const isBingWall = current === "bing" || (typeof current === "string" && current.startsWith("bing:"));
  const currentCat = currentPreset
    ? currentPreset.category
    : isBingWall
      ? "bing"
      : current === "custom" || (typeof current === "string" && current.startsWith("custom:"))
        ? "custom"
        : null;

  const wrap = h("div", { class: "wallpaper-picker" });

  const makeTile = ({ id, label, style }) => {
    // style：字符串 = backgroundImage 值（图片壁纸）；对象 = 直接样式集（纯色用 backgroundColor）
    const styleObj = typeof style === "string" ? { backgroundImage: style } : style || {};
    const tile = h("button", {
      class: "wallpaper-input",
      type: "button",
      role: "radio",
      "aria-checked": String(current === id),
      "aria-label": label,
      title: label,
      style: styleObj,
    });
    tile.addEventListener("click", () => {
      saveSettings({ wallpaper: { id } }, "wallpaper");
      wrap.querySelectorAll(".wallpaper-input").forEach((el) => el.setAttribute("aria-checked", "false"));
      tile.setAttribute("aria-checked", "true");
      applyAppearance();
    });
    return tile;
  };

  // ---- 一级：分类网格（与壁纸磁贴同款的圆角矩形 + 封面图） ----
  const renderCategories = () => {
    wrap.replaceChildren();
    const grid = h("div", { class: "wallpaper-category-grid", role: "list", "aria-label": t("wallpaperCategories") });
    // 「Bing」「随机」这类点击即应用的分类共用：把选中态移到目标磁贴
    const markCurrent = (target) => {
      grid.querySelectorAll(".wallpaper-category-btn").forEach((el) =>
        el.setAttribute("aria-current", "false")
      );
      target.setAttribute("aria-current", "true");
    };
    // 分类封面全部本地化：6 张本地缩略图即时铺上，custom 用虚线占位 / 已上传图片。
    // 打开设置不再为封面发起任何在线图片请求
    const coverFor = (cat) => {
      if (cat.id === "solid-colors") {
        const first = WALLPAPERS.find((w) => w.category === "solid-colors" && w.solid);
        return first ? { backgroundColor: first.solid } : {};
      }
      // custom 无图时是虚线占位（下方追加 + 号），不需要缩略图
      return cat.thumb ? { backgroundImage: `url("${cat.thumb}")` } : {};
    };
    for (const cat of WALLPAPER_CATEGORIES) {
      const isCustomCat = cat.id === "custom";
      const isBingCat = cat.id === "bing";
      const isRandomCat = cat.id === "random";
      const btn = h("button", {
        class: "wallpaper-category-btn" + (isCustomCat ? " wallpaper-category-btn--upload" : ""),
        type: "button",
        "aria-current": String(currentCat === cat.id),
        style: coverFor(cat),
      });
      if (isCustomCat) {
        // 分组封面：优先当前选中的自定义图片，否则取列表第一张；没有图片时显示 + 占位
        const plusIcon = h("span", {
          class: "wallpaper-category-btn__plus",
          html: ICONS.plus,
          "aria-hidden": "true",
        });
        btn.append(plusIcon);
        customItems().then(async (items) => {
          const coverId = currentCat === "custom" ? current : items[0]?.id;
          if (!coverId) return;
          const blob = await getWallpaperBlob(customBlobKey(coverId));
          if (!blob) return;
          btn.classList.remove("wallpaper-category-btn--upload");
          plusIcon.remove();
          btn.style.backgroundImage = `url("${URL.createObjectURL(blob)}")`;
        });
      }
      btn.addEventListener("click", async () => {
        if (isCustomCat) {
          // 和其它分组一样进入二级列表，可保存多张自定义图片
          wallpaperView = "custom";
          renderList("custom");
          return;
        }
        if (isBingCat) {
          // 点击「Bing」= 直接启用每日壁纸（id "bing"），不进二级列表
          saveSettings({ wallpaper: { id: "bing" } }, "wallpaper");
          applyAppearance();
          markCurrent(btn);
          toast(t("toastBingWallpaper"));
          return;
        }
        if (isRandomCat) {
          // 点击「随机」= 从现有随机图池抽一张，不进二级列表。
          // 拉取失败/超时会自动回落到缓存清单或内置 5 条（离线可用）。
          // 排除项取实时 state（而非渲染时的快照），连续点击必定换图
          const pick = await pickRandomWallpaper(state.settings.wallpaper.id);
          if (!pick) return;
          saveSettings({ wallpaper: { id: pick.id } }, "wallpaper");
          applyAppearance();
          markCurrent(btn);
          // 分类封面固定用本地缩略图，不随抽中结果联网换图
          toast(t("toastRandomWallpaper"));
          return;
        }
        wallpaperView = cat.id;
        renderList(cat.id);
      });
      // 分类名放在封面卡片下方
      const cell = h(
        "div",
        { class: "wallpaper-category", role: "listitem" },
        btn,
        h("span", { class: "wallpaper-category-btn__label", text: categoryName(cat) })
      );
      grid.append(cell);
    }
    wrap.append(grid);
  };

  // 给壁纸磁贴挂图：同源副本（线上 SVG）直接铺；在线图先查本地缓存，命中直接显示 blob
  // （不打网络），未命中先放源站图占位，后台缓存完成后换成本地 blob（离线可用）
  const attachTileImage = (tile, w) => {
    const src = wallpaperSrc(w);
    if (!src) return;
    if (w.localUrl || !/^https?:/i.test(src)) {
      tile.style.backgroundImage = `url("${src}")`;
      return;
    }
    getCachedWallpaper(src).then((blob) => {
      if (blob) {
        tile.style.backgroundImage = `url("${URL.createObjectURL(blob)}")`;
        return;
      }
      tile.style.backgroundImage = `url("${src}")`;
      cacheWallpaper(src)
        .then((b) => {
          tile.style.backgroundImage = `url("${URL.createObjectURL(b)}")`;
        })
        .catch(() => {
          /* 该图床不允许跨域读取：保留直连地址即可，不影响显示 */
        });
    });
  };

  // ---- 二级：自定义图片列表（多张，末尾带 + 上传格） ----
  const renderCustomGrid = async (grid) => {
    const items = await customItems();
    for (const item of items) {
      const cell = h("div", { class: "wallpaper-cell" });
      const tile = makeTile({ id: item.id, label: item.name, style: "" });
      getWallpaperBlob(customBlobKey(item.id)).then((blob) => {
        if (!blob) return;
        tile.style.backgroundImage = `url("${URL.createObjectURL(blob)}")`;
      });
      cell.append(
        tile,
        h("button", {
          class: "wallpaper-cell__remove",
          type: "button",
          "aria-label": t("deleteMyImageTitle"),
          title: t("deleteImage"),
          html: ICONS.close,
          onclick: (event) => {
            event.stopPropagation();
            deleteCustomImage(item.id);
          },
        })
      );
      grid.append(cell);
    }

    const add = h("button", {
      class: "wallpaper-input wallpaper-input--add",
      type: "button",
      "aria-label": t("addImage"),
      title: t("addImage"),
      html: ICONS.plus,
    });
    add.addEventListener("click", pickCustomImage);
    grid.append(add);
  };

  // ---- 二级：某分类下的壁纸列表 ----
  const renderList = (catId) => {
    const cat = WALLPAPER_CATEGORIES.find((c) => c.id === catId);
    wrap.replaceChildren(
      h(
        "div",
        { class: "wallpaper-list-head" },
        h("button", {
          class: "wallpaper-back",
          type: "button",
          "aria-label": t("backToCategories"),
          title: t("back"),
          html: ICONS.chevronLeft,
          onclick: () => {
            wallpaperView = null;
            renderCategories();
          },
        }),
        h("span", { class: "wallpaper-list-title", text: categoryName(cat) || catId })
      )
    );
    const grid = h("div", {
      class: "wallpaper-grid-row",
      role: "radiogroup",
      "aria-label": categoryName(cat) || t("wallpaper"),
    });
    wrap.append(grid);

    if (catId === "custom") {
      renderCustomGrid(grid).catch((err) => console.warn("[foxfox] 自定义图片列表加载失败", err));
      return;
    }

    WALLPAPERS.filter((w) => w.category === catId).forEach((w) => {
      const tile = makeTile({
        id: w.id,
        label: wallpaperName(w),
        style: w.solid ? { backgroundColor: w.solid } : "",
      });
      grid.append(tile);
      if (w.url) attachTileImage(tile, w);
    });
  };

  if (wallpaperView) renderList(wallpaperView);
  else renderCategories();

  // 「重置为默认」由调用方放到「壁纸」标题行，这里随选择器一起返回
  const resetBtn = h("button", {
    class: "wallpapers-reset",
    type: "button",
    text: t("resetToDefault"),
    onclick: () => {
      saveSettings({ wallpaper: { id: "none" } }, "wallpaper");
      wallpaperView = null;
      applyAppearance();
      refreshSettings();
    },
  });

  return { element: h("div", { class: "category-list" }, wrap), resetBtn };
}

/* ------------------------------- 设置内容 ------------------------------- */

function section(title, ...content) {
  return h(
    "section",
    { class: "settings__section" },
    h("h3", { class: "settings__heading", text: title }),
    ...content
  );
}

function buildSettingsBody() {
  const s = state.settings;
  const body = $("#settings-body");
  if (!body) return;
  const scrollTop = body.scrollTop;
  body.replaceChildren();

  const wallpaper = wallpaperGrid();
  body.append(
    h(
      "section",
      { class: "settings__section" },
      // 「壁纸」标题与「重置」同行
      h(
        "div",
        { class: "settings__section-head" },
        h("h3", { class: "settings__heading", text: t("wallpaper") }),
        wallpaper.resetBtn
      ),
      wallpaper.element,
      h(
        "div",
        { class: "settings__row settings__row--sliders" },
        h(
          "label",
          { class: "settings-slider" },
          h("span", { class: "settings__row-title", text: t("blur") }),
          h("input", {
            type: "range",
            min: "0",
            max: "24",
            value: String(s.wallpaper.blur || 0),
            oninput: (event) => {
              document.documentElement.style.setProperty("--wall-blur", `${event.target.value}px`);
              saveSettings({ wallpaper: { blur: Number(event.target.value) } }, "wallpaper");
            },
          })
        ),
        h(
          "label",
          { class: "settings-slider" },
          h("span", { class: "settings__row-title", text: t("dim") }),
          h("input", {
            type: "range",
            min: "0",
            max: "60",
            value: String(s.wallpaper.dim || 0),
            oninput: (event) => {
              document.documentElement.style.setProperty("--wall-dim", String(Number(event.target.value) / 100));
              saveSettings({ wallpaper: { dim: Number(event.target.value) } }, "wallpaper");
            },
          })
        )
      )
    )
  );

  // 「主题」选项已移除：界面恒跟随系统深/浅色（见 resolvedTheme）
  body.append(
    section(
      t("shortcutsSection"),
      row(
        t("rows"),
        segmented(
          [
            // 0 = 隐藏整块快捷方式，只保留壁纸与右下角齿轮
            { label: "0", value: 0 },
            ...[1, 2, 3, 4, 5].map((value) => ({ label: String(value), value })),
          ],
          Number(s.rows ?? 3),
          (value) => saveSettings({ rows: value }, "sections"),
          "segmented--fixed"
        )
      ),
      row(
        t("columns"),
        segmented(
          Array.from({ length: 6 }, (_, index) => ({
            label: String(index + 5),
            value: index + 5,
          })),
          Number(s.columns ?? 8),
          (value) => saveSettings({ columns: value }, "sections"),
          "segmented--fixed"
        )
      )
    )
  );

  body.append(
    section(
      // 按需求互换「数据」与「数据保存」的显示位置（键名保持不变，中英文同步生效）
      t("dataSaving"),
      row(
        "",
        h(
          "div",
          { class: "segmented segmented--fixed settings-data-actions" },
          h("button", {
            class: "segmented__btn",
            type: "button",
            text: t("exportSettings"),
            onclick: () => {
              const blob = new Blob([JSON.stringify(state.settings, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = h("a", { href: url, download: "foxfox-settings.json" });
              document.body.append(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            },
          }),
          h("button", {
            class: "segmented__btn",
            type: "button",
            text: t("importSettings"),
            onclick: () => {
              const input = h("input", { type: "file", accept: "application/json", hidden: true });
              input.addEventListener("change", async () => {
                const file = input.files?.[0];
                if (!file) return;
                try {
                  const parsed = JSON.parse(await file.text());
                  saveSettings(parsed, "restore");
                  await applyAppearance();
                  buildSettingsBody();
                  document.dispatchEvent(new CustomEvent("foxfox:refresh-all"));
                  toast(t("toastSettingsImported"));
                } catch {
                  toast(t("toastBadFileFormat"));
                }
                input.remove();
              });
              document.body.append(input);
              input.click();
            },
          }),
          h("button", {
            class: "segmented__btn",
            type: "button",
            text: t("clearShortcuts"),
            onclick: async () => {
              const result = await confirmDialog({
                title: t("clearShortcutsTitle"),
                message: t("clearShortcutsMsg"),
                confirmText: t("clearShortcuts"),
                danger: true,
                optionLabel: t("deleteUnpinnedOnly"),
              });
              if (!result?.ok) return;

              const key = (url) => String(url || "").replace(/\/$/, "");
              const visible = Array.from(
                document.querySelectorAll("#shortcuts .top-site-outer[data-url]")
              ).map((el) => el.dataset.url);
              const allCustom = state.settings.shortcuts.custom || [];
              const pinnedUrls = new Set(
                allCustom.filter((item) => item.pinned).map((item) => key(item.url))
              );
              const onlyUnpinned = Boolean(result.checked);
              const custom = onlyUnpinned ? allCustom.filter((item) => item.pinned) : [];
              const hidden = [
                ...new Set([
                  ...(state.settings.shortcuts.hidden || []),
                  ...(onlyUnpinned
                    ? visible.filter((url) => !pinnedUrls.has(key(url)))
                    : visible),
                ]),
              ];
              const order = onlyUnpinned
                ? (state.settings.shortcuts.order || []).filter((url) =>
                    pinnedUrls.has(key(url))
                  )
                : [];
              saveSettings(
                { shortcuts: { custom, defaults: [], hidden, order } },
                "shortcuts"
              );
              try {
                Object.keys(localStorage)
                  .filter(
                    (key) =>
                      key.startsWith("foxfox.icon") ||
                      key.startsWith("foxfox.simpleicon") ||
                      key.startsWith("foxfox.faviconfill")
                  )
                  .forEach((key) => localStorage.removeItem(key));
              } catch {
                /* 存储不可用时只清设置里的图标 */
              }
              buildSettingsBody();
              document.dispatchEvent(new CustomEvent("foxfox:refresh-all"));
              toast(t(onlyUnpinned ? "toastUnpinnedCleared" : "toastShortcutsCleared"));
            },
          }),
          h("button", {
            class: "segmented__btn",
            type: "button",
            text: t("restoreDefaults"),
            onclick: async () => {
              const ok = await confirmDialog({
                title: t("restoreDefaultsTitle"),
                message: t("restoreDefaultsMsg"),
                confirmText: t("restoreDefaults"),
                danger: true,
              });
              if (!ok) return;
              await Promise.all(
                (state.settings.customWallpapers || []).map((item) =>
                  deleteWallpaperBlob(customBlobKey(item.id))
                )
              );
              await deleteWallpaperBlob();
              await clearSettings();
              location.reload();
            },
          })
        )
      ),
      h(
        "p",
        { class: "settings-meta" },
        h(
          "a",
          {
            href: "https://github.com/runningcheese/CheeseTab",
            target: "_blank",
            rel: "noopener noreferrer",
            class: "settings-meta__link",
            title: "https://github.com/runningcheese/CheeseTab",
          },
          h("span", {
            class: "settings-meta__icon",
            "aria-hidden": "true",
            html: '<svg viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>',
          }),
          `CheeseTab v${currentVersion()}`
        )
      )
    )
  );

  body.scrollTop = scrollTop;
}

function refreshSettings() {
  if (!$("#settings-drawer")?.hidden) buildSettingsBody();
}

/* ------------------------------- 抽屉开合 ------------------------------- */

let drawerOpen = false;

function openSettings() {
  const drawer = $("#settings-drawer");
  if (!drawer) return;

  buildSettingsBody();
  drawer.hidden = false;
  document.body.classList.add("drawer-open");
  $("#settings-btn").setAttribute("aria-expanded", "true");

  // 先渲染再上滑，保证过渡生效
  requestAnimationFrame(() => drawer.classList.add("open"));
  drawerOpen = true;

  setTimeout(() => $("#settings-close")?.focus({ preventScroll: true }), 300);
}

function closeSettings() {
  const drawer = $("#settings-drawer");
  if (!drawer || drawer.hidden) return;

  drawer.classList.remove("open");
  document.body.classList.remove("drawer-open");
  $("#settings-btn").setAttribute("aria-expanded", "false");
  drawerOpen = false;

  setTimeout(() => {
    if (!drawerOpen) drawer.hidden = true;
  }, 280);

  $("#settings-btn").focus({ preventScroll: true });
}

export function initSettings() {
  $("#fab-icon").innerHTML = ICONS.gear;
  $("#settings-btn").addEventListener("click", () => {
    if (drawerOpen) closeSettings();
    else openSettings();
  });
  $("#settings-close").addEventListener("click", closeSettings);

  // 没有遮罩：点击抽屉与齿轮之外的区域也可关闭
  document.addEventListener("pointerdown", (event) => {
    if (!drawerOpen) return;
    const drawer = $("#settings-drawer");
    if (drawer.contains(event.target) || $("#settings-btn").contains(event.target)) return;
    if (event.target.closest(".menu, .modal, input[type=file]")) return;
    closeSettings();
  });
  document.querySelectorAll(".js-close-icon").forEach((el) => (el.innerHTML = ICONS.close));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawerOpen) {
      event.stopPropagation();
      closeSettings();
    }
  });


  let refreshTimer = null;
  document.addEventListener("foxfox:settings-refresh", () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshSettings, 80);
  });
}
