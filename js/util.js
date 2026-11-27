// 通用工具

export const $ = (sel, root = document) => root.querySelector(sel);

/** 轻量 DOM 构造器 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
    else if (key === "html") el.innerHTML = value;
    else if (key === "text") el.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in el && key !== "list") {
      el[key] = value;
    } else {
      el.setAttribute(key, value === true ? "" : value);
    }
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return el;
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 从网址提取一个用于快捷方式名称的域名（去掉 www、后缀，首字母大写） */
export function siteNameFromUrl(url) {
  const host = hostOf(url);
  if (!host) return "";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":")) return host;

  const twoPartTlds = new Set([
    "co.uk",
    "org.uk",
    "com.cn",
    "net.cn",
    "org.cn",
    "com.au",
    "co.jp",
    "com.br",
    "co.nz",
    "co.kr",
    "com.tw",
    "com.hk",
    "com.sg",
  ]);
  const labels = host.split(".");
  let index = labels.length - 2;
  if (labels.length >= 3 && twoPartTlds.has(labels.slice(-2).join("."))) {
    index = labels.length - 3;
  }
  const core = labels[index] || labels[0] || host;
  return core.charAt(0).toUpperCase() + core.slice(1);
}

/**
 * 把用户输入规范成可访问的 URL；协议不限（https / chrome-extension / chrome / edge /
 * about / file / data / 自定义 scheme 均可），无法解析时返回 null。
 * 仅保留两条底线：拒绝空白控制字符、拒绝可执行脚本协议（javascript: / vbscript:）
 * —— 后者是代码而非链接，放进 <a href> 也会被扩展的 CSP 拦截。
 */
export function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) return null;
  if (/^(javascript|vbscript):/i.test(raw)) return null;

  // 已有任意协议时原样保留；裸域名与 host:port（如 localhost:8080）仍补 https://
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) && !/^[^/?#\s]+:\d+(?:[/?#]|$)/.test(raw);
  try {
    return new URL(hasScheme ? raw : `https://${raw}`).toString();
  } catch {
    return null;
  }
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** 稳定色相，用于字母头像 */
function hashHue(text) {
  // FNV-1a，保证相邻字符串也能得到差异明显的色相
  let hash = 2166136261;
  const value = String(text);
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 360;
}

/** 生成彩色字母头像（data URI） */
export function letterAvatar(text, size = 64) {
  const letter = (String(text || "?").trim()[0] || "?").toUpperCase();
  const hue = hashHue(text || "?");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="14" fill="hsl(${hue} 62% 52%)"/>
    <text x="32" y="42" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="32" font-weight="600" fill="#fff" text-anchor="middle">${escapeHtml(
      letter
    )}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
