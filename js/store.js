// 设置存储：扩展内用 chrome.storage.local，部署到网站后用 localStorage；
// 两者都不可用（隐私模式 / 配额耗尽）时退化为内存，界面仍可正常使用。

import { DEFAULT_SETTINGS } from "./default-settings.js";
import { WALLPAPERS } from "./wallpapers.js";
import { IS_EXTENSION } from "./platform.js";

const STORAGE_KEY = "foxfox.settings.v1";


// 出厂默认值见 js/default-settings.js（由用户提供的 foxfox-settings.json 生成）

const clone = (value) => {
  try {
    return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
};

/** localStorage 在 Safari 隐私模式 / 禁用 Cookie 时会直接抛错，探测一次并缓存结果 */
const localStore = (() => {
  try {
    const probe = "__foxfox_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
})();

// localStorage 不可用时的内存兜底（仅本次页面有效）
let memorySettings = null;

export const state = {
  settings: clone(DEFAULT_SETTINGS),
  ready: false,
};

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(reason) {
  for (const fn of listeners) {
    try {
      fn(state.settings, reason);
    } catch (err) {
      console.error("[foxfox] listener error", err);
    }
  }
}

function deepMerge(base, patch) {
  if (Array.isArray(patch)) return patch.slice();
  if (patch && typeof patch === "object") {
    const out = Array.isArray(base) ? [] : { ...(base || {}) };
    for (const [k, v] of Object.entries(patch)) {
      out[k] = v && typeof v === "object" && !Array.isArray(v) ? deepMerge(base?.[k], v) : v;
    }
    return out;
  }
  return patch;
}

const hasChromeStorage = () =>
  IS_EXTENSION && typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

/**
 * 统一的 chrome.storage.local 调用：一律用回调形式包成 Promise。
 * Firefox 的 chrome.* 命名空间只提供回调（Promise 仅 browser.* 有），
 * 若直接 await chrome.storage.local.get() 会得到 undefined——设置将永远读不回来。
 * Chrome 的 storage 同时支持回调与 Promise，回调写法两边都能跑。
 */
function storageCall(method, arg) {
  return new Promise((resolve, reject) => {
    try {
      const ret = chrome.storage.local[method](arg, (result) => {
        const err = chrome.runtime && chrome.runtime.lastError;
        if (err) reject(new Error(err.message || String(err)));
        else resolve(result);
      });
      // 兜底：若某环境忽略回调、只返回 Promise
      if (ret && typeof ret.then === "function") ret.then(resolve, reject);
    } catch (err) {
      // 再兜底：若该环境只接受 Promise 形式（不接受回调参数）
      try {
        const ret = chrome.storage.local[method](arg);
        if (ret && typeof ret.then === "function") ret.then(resolve, reject);
        else reject(err);
      } catch {
        reject(err);
      }
    }
  });
}

export async function loadSettings() {
  let stored = null;
  try {
    if (hasChromeStorage()) {
      const result = await storageCall("get", STORAGE_KEY);
      stored = result?.[STORAGE_KEY] ?? null;
    } else {
      const raw = localStore ? localStore.getItem(STORAGE_KEY) : memorySettings;
      stored = JSON.parse(raw || "null");
    }
  } catch (err) {
    console.warn("[foxfox] 读取设置失败", err);
  }
  state.settings = deepMerge(clone(DEFAULT_SETTINGS), stored || {});
  state.ready = true;
  emit("init");
  return state.settings;
}

let saveTimer = null;
export function saveSettings(patch, reason = "update") {
  state.settings = deepMerge(state.settings, patch);
  emit(reason);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 120);
}

async function persist() {
  try {
    if (hasChromeStorage()) {
      await storageCall("set", { [STORAGE_KEY]: state.settings });
    } else if (localStore) {
      localStore.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    } else {
      memorySettings = JSON.stringify(state.settings);
    }
  } catch (err) {
    // 配额满（自定义图标过多）/ 隐私模式：本次会话仍以内存中的设置为准
    console.warn("[foxfox] 保存设置失败", err);
    memorySettings = JSON.stringify(state.settings);
  }
}

export async function clearSettings() {
  try {
    if (hasChromeStorage()) await storageCall("remove", STORAGE_KEY);
    else if (localStore) localStore.removeItem(STORAGE_KEY);
    memorySettings = null;
  } catch (err) {
    console.warn("[foxfox] 清除设置失败", err);
  }
}

/* ------------------------- 自定义壁纸（IndexedDB） ------------------------- */

const DB_NAME = "foxfox";
const STORE = "media";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putWallpaperBlob(blob, key = "custom-wallpaper") {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function getWallpaperBlob(key = "custom-wallpaper") {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteWallpaperBlob(key = "custom-wallpaper") {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch {
    /* ignore */
  }
}

export function wallpaperById(id) {
  // "none"（无壁纸）与 "custom"（上传图片）不在列表里，由 applyAppearance 特判
  return WALLPAPERS.find((w) => w.id === id) || null;
}

/* --------------------- 在线壁纸缓存（IndexedDB，键 wall:<url>） --------------------- */

const WALL_KEY = (url) => "wall:" + url;
const inflight = new Map();

// 读取已缓存的壁纸 blob（无则返回 null）
export async function getCachedWallpaper(url) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(WALL_KEY(url));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

// 取壁纸 blob：优先返回本地缓存（不打网络），未缓存才联网拉取并写入（并发去重）
export function cacheWallpaper(url) {
  if (inflight.has(url)) return inflight.get(url);
  const task = (async () => {
    const cached = await getCachedWallpaper(url);
    if (cached) return cached;
    const res = await fetch(url, { cache: "reload" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const blob = await res.blob();
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, WALL_KEY(url));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return blob;
  })().finally(() => inflight.delete(url));
  inflight.set(url, task);
  return task;
}
