// Bing 每日壁纸
// 扩展内：bing.xinac.net 的 today 接口（大陆直连，host_permissions 绕过 CORS）
// 线上部署：该接口不返回 Access-Control-Allow-Origin，浏览器会拦截 fetch，
// 因此改用返回 CORS 头的 bing.biturl.top；两者都失败时退化为直连图床。
// 「Bing」不是固定图片：始终跟随 Bing 当日图，定时轮询自动换图
// （Bing 约每天 16:00 换图，缓存 30 分钟 + 每 30 分钟重查，最迟半小时跟上）

import { t } from "./i18n.js";
import { IS_EXTENSION } from "./platform.js";

const LS_KEY = "foxfox.bing.today";
const TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

// 第一个能在当前环境跨域读取的 JSON 源
const JSON_PROVIDERS = IS_EXTENSION
  ? [
      "https://bing.xinac.net/api/today?format=json",
      "https://bing.biturl.top/?resolution=1920&format=json&index=0&mkt=zh-CN",
    ]
  : ["https://bing.biturl.top/?resolution=1920&format=json&index=0&mkt=zh-CN"];

// 全部接口失败时的兜底：直接返回当日图片（作为 CSS background，不需要 CORS）
const imageFallback = () => {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `https://api.dujin.org/bing/1920.php?d=${day}`;
};

let inflight = null;
let memoryInfo = null;

function readCache() {
  try {
    const info = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    return info?.url ? info : memoryInfo;
  } catch {
    return memoryInfo;
  }
}

function writeCache(info) {
  memoryInfo = info;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(info));
  } catch {
    /* 存储满 / 隐私模式时忽略，仅本次会话生效 */
  }
}

function absoluteUrl(raw) {
  try {
    return new URL(String(raw), "https://www.bing.com").href;
  } catch {
    return "";
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 各 JSON 源字段不同，统一成 { url, title, date } */
function normalize(data) {
  const url = absoluteUrl(data?.url);
  if (!url) throw new Error("empty payload");
  return {
    url,
    title: data.title || data.copyright || t("bingWallpaper"),
    date: data.format_date || data.end_date || data.start_date || "",
    cacheable: true,
  };
}

/** 今日壁纸信息 { url, title, date, cacheable }；失败时回落到上次已知结果 */
export async function bingToday() {
  const cached = readCache();
  if (cached && Date.now() - cached.ts < TTL_MS) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    for (const provider of JSON_PROVIDERS) {
      try {
        const info = { ...normalize(await fetchJson(provider)), ts: Date.now() };
        writeCache(info);
        return info;
      } catch (err) {
        console.warn("[foxfox] Bing 壁纸接口不可用", provider, err?.message || err);
      }
    }
    // 接口全挂：有旧图先用旧图（IndexedDB 里通常还有缓存 blob）
    if (cached) return cached;
    // 完全首次且接口不可用：直接给图床地址，至少壁纸能显示（无法写缓存）
    return { url: imageFallback(), title: t("bingWallpaper"), date: "", ts: Date.now(), cacheable: false };
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}
