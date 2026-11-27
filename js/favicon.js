// 网站图标：多源择优（分辨率最高者），本地 favicon 缓存兜底，最后退化为字母头像
// 远程源全部使用大陆可直连的接口（api.xinac.net / favicon.cccyun.cc）

import { letterAvatar, hostOf } from "./util.js";
import { IS_EXTENSION } from "./platform.js";

const canUseExtensionFavicon = () => {
  try {
    if (!IS_EXTENSION || !chrome.runtime || typeof chrome.runtime.getURL !== "function") return false;
    // /_favicon/ 是 Chrome 专有的图标接口，需要 favicon 权限；
    // Firefox 版 manifest 不含该权限，这里自动降级为纯远程源（否则会 404 出空白图）
    const perms = chrome.runtime.getManifest?.()?.permissions || [];
    return perms.includes("favicon");
  } catch {
    return false;
  }
};

/** 主题下图标显示为 76px，取 2x 尺寸作为目标分辨率 */
const TARGET_PX = 96;
const MAX_CONCURRENT = 8;
const PROBE_TIMEOUT = 3000;
const CACHE_TTL = 7 * 24 * 3600 * 1000;
// 图标服务对「没有 favicon 的站点」会返回 16×16 的空白/通用图，
// 直接采用会让磁贴变成一片空白——小于该尺寸一律视为没有图标，继续用字母头像
const MIN_ICON_PX = 32;
const CACHE_PREFIX = "foxfox.icon5."; // r67：加入 Simple Icons SVG 源，作废旧缓存

// 同一 host 只探测一次（内存 + localStorage，减少重复请求与被限流的机会）
const bestByHost = new Map();

function readCache(host) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + host);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry?.src || Date.now() - entry.ts > CACHE_TTL) return null;
    return entry.src;
  } catch {
    return null;
  }
}

function writeCache(host, src) {
  try {
    localStorage.setItem(CACHE_PREFIX + host, JSON.stringify({ src, ts: Date.now() }));
  } catch {
    /* 存储已满时忽略 */
  }
}

/** 常见品牌站点的在线 SVG：Simple Icons CDN（按二级域名 slug 匹配） */
function simpleIconSources(host, url = "") {
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {
    /* ignore */
  }
  if (
    (host === "chrome.google.com" || /^(www\.)?google\.[a-z.]+$/i.test(host)) &&
    /\/chrome(?:\/|$)/i.test(path)
  ) {
    return ["https://cdn.simpleicons.org/googlechrome"];
  }

  const labels = host.replace(/^www\./i, "").split(".");
  if (labels.length !== 2) return [];
  const slug = labels[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!slug || /^\d+$/.test(slug)) return [];
  return [`https://cdn.simpleicons.org/${slug}`];
}

export function simpleIconUrl(url) {
  const host = hostOf(url);
  if (!host) return "";
  return simpleIconSources(host, url)[0] || "";
}

const SIMPLE_CACHE_PREFIX = "foxfox.simpleicon.v1.";
const SIMPLE_CACHE_TTL = 30 * 24 * 3600 * 1000;

function simpleCacheKey(url) {
  return SIMPLE_CACHE_PREFIX + encodeURIComponent(url);
}

/** 读取已缓存的 Simple Icons SVG（data URL） */
export function getCachedSimpleIcon(url) {
  if (!url) return "";
  try {
    const entry = JSON.parse(localStorage.getItem(simpleCacheKey(url)) || "null");
    if (!entry?.data || Date.now() - entry.ts > SIMPLE_CACHE_TTL) return "";
    return entry.data;
  } catch {
    return "";
  }
}

/** 首次使用时把 Simple Icons SVG 下载为 data URL，后续新标签页零网络请求 */
export async function cacheSimpleIcon(url) {
  if (!url || !/^https:\/\/cdn\.simpleicons\.org\//i.test(url)) return "";
  const cached = getCachedSimpleIcon(url);
  if (cached) return cached;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return "";
    const svg = await res.text();
    if (!svg.includes("<svg")) return "";
    const data = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    localStorage.setItem(
      simpleCacheKey(url),
      JSON.stringify({ data, ts: Date.now() })
    );
    return data;
  } catch {
    return "";
  }
}

const FAVICON_FILL_PREFIX = "foxfox.faviconfill.v11.";
const FAVICON_FILL_TTL = 7 * 24 * 3600 * 1000;

function faviconFillKey(host) {
  return FAVICON_FILL_PREFIX + host;
}

async function faviconFillMetrics(src) {
  let objectUrl = "";
  try {
    const res = await fetch(src, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    objectUrl = URL.createObjectURL(blob);
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("favicon decode failed"));
      img.src = objectUrl;
    });
    const size = 32;
    const quad = 8;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    // 只看四个角：白色底板/透明 logo 的四角是白色或透明的，不算满底色
    let coverage = 0;
    let filled = 0;
    for (const [x0, y0] of [
      [0, 0],
      [size - quad, 0],
      [0, size - quad],
      [size - quad, size - quad],
    ]) {
      let opaque = 0;
      let colored = 0;
      for (let y = y0; y < y0 + quad; y++) {
        for (let x = x0; x < x0 + quad; x++) {
          const i = (y * size + x) * 4;
          if (data[i + 3] <= 32) continue;
          opaque++;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          if (max < 60 || (max > 40 && saturation > 0.22)) colored++;
        }
      }
      coverage += opaque / (quad * quad);
      filled += colored / (quad * quad);
    }
    return { coverage: coverage / 4, filled: filled / 4 };
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/** 判断 favicon 的背景色是否 100% 铺满；只用于编辑弹窗的选项切换 */
export async function faviconIsFullBleed(url) {
  const host = hostOf(url);
  if (!host) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(faviconFillKey(host)) || "null");
    if (typeof cached?.full === "boolean" && Date.now() - cached.ts < FAVICON_FILL_TTL) {
      return cached.full;
    }
  } catch {
    /* ignore */
  }
  let favicon = "";
  try {
    favicon = await resolveBest(url, host, { useSimple: false });
  } catch {
    favicon = "";
  }
  // 拿不到 favicon 时会退化为标题首字母头像，这种情况保持 Favicon 模式
  if (!favicon) return null;
  const metrics = await faviconFillMetrics(favicon);
  if (!metrics) return null;
  const full = metrics.coverage >= 0.55 && metrics.filled >= 0.55;
  try {
    localStorage.setItem(faviconFillKey(host), JSON.stringify({ full, ts: Date.now() }));
  } catch {
    /* ignore */
  }
  return full;
}

function remoteSources(url, host, { useSimple = true } = {}) {
  // 优先尝试 Simple Icons 的品牌 SVG；命中后直接使用，未命中再回退站点 favicon。
  // favicon 服务均为大陆可直连的接口（Google s2 / favicon.im 大陆无法访问，已弃用）
  const list = [
    ...(useSimple ? simpleIconSources(host, url) : []),
    // 国内节点，速度最快，返回站点原图
    `https://api.xinac.net/icon/?url=${encodeURIComponent(url)}`,
    // 国内节点，返回站点原图；部分域名会 403
    `https://favicon.cccyun.cc/${host}`,
  ];
  if (canUseExtensionFavicon()) {
    // 本地缓存兜底，离线时也能出图（分辨率最高 32–64）
    list.push(chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=64`));
  }
  return list;
}

// 控制并发，避免一次开新标签页就打满图标服务的请求
let active = 0;
const waiting = [];

function withSlot(task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      active++;
      task()
        .then(resolve, reject)
        .finally(() => {
          active--;
          const next = waiting.shift();
          if (next) next();
        });
    };
    if (active < MAX_CONCURRENT) run();
    else waiting.push(run);
  });
}

/* -------- 占位图识别 --------
   图标服务对「没有 favicon 的域名」会返回一张固定的占位图，直接采用会让
   字母头像被换成通用图（还可能被写入缓存，刷新后一直错下去）。对策：
   用必然不存在的金丝雀域名实时取一份占位图作基准，与候选图逐字节比对
   （扩展内拥有 host_permissions 可读字节；普通网页环境 fetch 失败则放弃
   识别，按正常图处理）。

   注意两个「基准图会变」的服务：
   注意「基准图会变」的服务：_favicon 无 favicon 时返回 Chrome 默认地球图，
   基准用金丝雀域名生成。 */

const CANARY_HOST = "canary-check.invalid";

const ICON_SERVICES = [
  {
    match: (src) => src.includes("api.xinac.net"),
    canary: () => `https://api.xinac.net/icon/?url=https://${CANARY_HOST}`,
  },
  {
    match: (src) => src.includes("favicon.cccyun.cc"),
    canary: () => `https://favicon.cccyun.cc/${CANARY_HOST}`,
  },
  {
    match: (src) => src.includes("/_favicon/?"),
    canary: (src) => {
      try {
        const u = new URL(src);
        u.searchParams.set("pageUrl", `https://${CANARY_HOST}/`);
        return u.href;
      } catch {
        return null;
      }
    },
  },
];

const canaryBySrc = new Map();

function canaryPlaceholder(canaryUrl) {
  if (!canaryUrl) return Promise.resolve(null);
  if (!canaryBySrc.has(canaryUrl)) {
    canaryBySrc.set(
      canaryUrl,
      fetch(canaryUrl, { cache: "no-store" })
        .then(async (res) => (res.ok ? new Uint8Array(await res.arrayBuffer()) : null))
        .catch(() => null)
    );
  }
  return canaryBySrc.get(canaryUrl);
}

async function isPlaceholderImage(src) {
  const service = ICON_SERVICES.find((s) => s.match(src));
  if (!service) return false;
  const canary = await canaryPlaceholder(service.canary(src));
  if (!canary) return false;
  try {
    const res = await fetch(src, { cache: "no-store" });
    if (!res.ok) return false;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length !== canary.length) return false;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== canary[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** 预加载并返回 { src, width }，失败返回 null */
function probe(src) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), PROBE_TIMEOUT);
    img.onload = () => finish({ src, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => finish(null);
    img.referrerPolicy = "no-referrer";
    img.decoding = "async";
    img.src = src;
  });
}

/** 依次探测，拿到一张够清楚的（≥64px）就不再打第二个源，减少请求排队 */
async function resolveBest(url, host, { force = false, useSimple = true } = {}) {
  const cacheHost = useSimple ? host : `${host}#favicon`;
  if (!force && bestByHost.has(cacheHost)) return bestByHost.get(cacheHost);

  if (!force) {
    const cached = readCache(cacheHost);
    if (cached) {
      bestByHost.set(cacheHost, cached);
      return cached;
    }
  }

  let best = null;
  for (const src of remoteSources(url, host, { useSimple })) {
    const result = await withSlot(() => probe(src));
    if (!result) continue;
    // SVG 可以任意缩放，不套用位图的最小尺寸判断
    const scalable = /\.svg(?:\?|$)|\/simpleicons\.org\//i.test(src);
    if (!scalable && result.width < MIN_ICON_PX) continue; // 过小 = 占位图
    if (await isPlaceholderImage(src)) continue; // 图标服务的通用占位图
    if (scalable) {
      best = result;
      break; // 品牌 SVG 优先，不再继续请求 favicon 服务
    }
    if (!best || result.width > best.width) best = result;
    if (best && best.width >= 64) break;
  }

  // 只记住成功的地址：失败不写内存/磁盘，下次打开还能重试
  const value = best ? best.src : null;
  if (value) {
    bestByHost.set(cacheHost, value);
    writeCache(cacheHost, value);
  } else {
    bestByHost.delete(cacheHost);
  }
  return value;
}

/**
 * 给 <img> 装上最清晰的图标。
 * 先并行拿到最优远程地址，再一次性赋值，避免闪图与低清占位。
 */
export function mountFavicon(
  img,
  { url, title, useSimple = true, onLetterFallback = null } = {}
) {
  const host = hostOf(url);
  img.alt = "";
  img.loading = "eager";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";

  const fallback = letterAvatar(title || host || "?");

  const showLetterFallback = () => {
    if (img.src !== fallback) img.src = fallback;
    onLetterFallback?.();
  };

  // 远程图标在页面里加载失败（被拦截 / 404 / 空白图）时回落到字母头像，避免磁贴空着
  img.addEventListener("error", showLetterFallback);

  // 非 http(s) 链接（chrome-extension:// / chrome:// / about: / file: 等）没有公网 favicon，
  // 直接退化为字母头像，省掉必然失败的远程请求和占位图闪动
  if (!host || !/^https?:\/\//i.test(String(url || ""))) {
    showLetterFallback();
    return img;
  }

  // 先把字母头像写入 img：首帧立即有背景色。
  // 旧逻辑等 250ms 才放占位，暗色主题/黑壁纸下会先露出磁贴暗底，看起来像闪一下。
  img.src = fallback;

  const settle = (src) => {
    if (src) img.src = src;
    else showLetterFallback();
  };

  // 首次探测被限流/超时会拿到 null，隔一会儿再试一次（网络抖动时很常见）
  const attempt = (force) =>
    resolveBest(url, host, { force, useSimple })
      .then((src) => {
        if (src || force) {
          settle(src);
          return;
        }
        setTimeout(() => attempt(true).catch(() => settle(null)), 1500);
      })
      .catch(() => settle(null));

  attempt(false).catch(() => settle(null));

  return img;
}
