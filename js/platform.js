// 运行环境适配层：
// - 扩展环境（chrome-extension:// / moz-extension://）继续使用 chrome.* 能力
// - 部署到普通网站（https://…/index.html）时，chrome.* 不存在或不可用，
//   这里统一封装降级逻辑，业务代码不再到处写 `typeof chrome !== "undefined"`。

/** 是否运行在浏览器扩展页面（Chrome / Edge / Firefox 均可） */
export const IS_EXTENSION = (() => {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime && typeof chrome.runtime.id === "string";
  } catch {
    return false;
  }
})();

/** 界面语言：扩展内跟 chrome.i18n，网页内跟 navigator.language */
export function uiLanguage() {
  try {
    if (IS_EXTENSION && chrome.i18n?.getUILanguage) return chrome.i18n.getUILanguage();
  } catch {
    /* 某些浏览器/上下文不提供 i18n，走 navigator.language */
  }
  return (typeof navigator !== "undefined" && navigator.language) || "zh-CN";
}

/** 常用网站：扩展内读 chrome.topSites，网页版没有该数据源，返回空数组由默认图标补足 */
export async function getTopSites() {
  if (!IS_EXTENSION || typeof chrome.topSites?.get !== "function") return [];
  return new Promise((resolve) => {
    const done = (list) => resolve(Array.isArray(list) ? list : []);
    try {
      const ret = chrome.topSites.get(done);
      if (ret && typeof ret.then === "function") ret.then(done, () => resolve([]));
    } catch {
      // 兜底：只接受 Promise 形式的环境
      try {
        chrome.topSites.get().then(done, () => resolve([]));
      } catch {
        resolve([]);
      }
    }
  });
}

/** 生成 UUID：优先 crypto.randomUUID（需要安全上下文），否则用 getRandomValues 手写 v4 */
export function randomUUID() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* 非安全上下文会抛错，继续走兜底 */
  }
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    // 极端环境（无 crypto）也不影响功能，退化为时间+随机数
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
}
