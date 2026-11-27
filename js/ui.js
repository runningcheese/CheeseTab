// 通用交互层：菜单、浮层、对话框、提示

import { h, $ } from "./util.js";
import { t } from "./i18n.js";

const layer = () => document.body;

let activeCloser = null;

function closeFloating() {
  if (activeCloser) {
    const fn = activeCloser;
    activeCloser = null;
    fn();
  }
  document.querySelectorAll(".menu").forEach((el) => el.remove());
  document.querySelectorAll('[aria-expanded="true"]').forEach((el) => el.setAttribute("aria-expanded", "false"));
}

function place(panel, anchor, { align = "start" } = {}) {
  panel.style.visibility = "hidden";
  panel.style.left = "0px";
  panel.style.top = "0px";
  layer().append(panel);
  const rect = anchor.getBoundingClientRect();
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;
  const margin = 10;

  let left = align === "end" ? rect.right - pw : rect.left;
  left = Math.min(Math.max(margin, left), window.innerWidth - pw - margin);

  // 默认贴在锚点下方；下方放不下就翻到上方
  let top = rect.bottom + 6;
  if (top + ph > window.innerHeight - margin) top = Math.max(margin, rect.top - ph - 6);
  if (top < margin) top = margin;

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
  panel.style.visibility = "visible";
}

function bindDismiss(panel, anchor) {
  const close = () => {
    panel.remove();
    anchor?.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onPointer, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", close);
    window.removeEventListener("scroll", onScroll, true);
    if (activeCloser === close) activeCloser = null;
  };

  const onPointer = (event) => {
    if (panel.contains(event.target) || anchor?.contains(event.target)) return;
    close();
  };
  const onKey = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      anchor?.focus?.();
    }
  };
  const onScroll = (event) => {
    if (panel.contains(event.target)) return;
    close();
  };

  // 延迟绑定，避免触发打开的那次点击立刻关闭
  setTimeout(() => {
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
  }, 0);

  activeCloser = close;
  return close;
}

/** 构建菜单：items = [{label, icon, onClick, danger, disabled, type}] */
export function openMenu({ anchor, items, align = "start" }) {
  const wasOpen = activeCloser && anchor?.getAttribute("aria-expanded") === "true";
  closeFloating();
  if (wasOpen) return;

  const menu = h("div", { class: "menu", role: "menu" });
  for (const item of items) {
    if (!item) continue;
    if (item.type === "sep") {
      menu.append(h("div", { class: "menu__sep" }));
      continue;
    }
    const btn = h(
      "button",
      {
        class: `menu__item${item.danger ? " menu__item--danger" : ""}`,
        type: "button",
        role: "menuitem",
        disabled: item.disabled,
      },
      h("span", { html: item.icon || "", style: { display: "inline-flex" } }),
      h("span", { text: item.label, style: { flex: "1 1 auto", minWidth: "0" } })
    );
    btn.addEventListener("click", () => {
      closeFloating();
      item.onClick?.();
    });
    menu.append(btn);
  }

  anchor?.setAttribute("aria-expanded", "true");
  place(menu, anchor, { align });
  bindDismiss(menu, anchor);

  // 键盘导航
  menu.addEventListener("keydown", (event) => {
    const focusables = Array.from(menu.querySelectorAll(".menu__item:not([disabled])"));
    const index = focusables.indexOf(document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusables[(index + 1) % focusables.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusables[(index - 1 + focusables.length) % focusables.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      focusables[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      focusables[focusables.length - 1]?.focus();
    }
  });
  menu.querySelector(".menu__item:not([disabled])")?.focus({ preventScroll: true });
}

/* ------------------------------- 提示 ------------------------------- */

let toastTimer = null;
export function toast(message, duration = 2200) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), duration);
}

/* ------------------------------ 对话框 ------------------------------ */

export function openModal(el) {
  closeFloating();
  el.hidden = false;
  document.body.classList.add("is-modal-open");
  const focusTarget = el.querySelector("input:not([type=hidden]), button");
  setTimeout(() => focusTarget?.focus({ preventScroll: true }), 30);
}

export function closeModal(el) {
  el.hidden = true;
  if (!document.querySelector(".modal:not([hidden])")) {
    document.body.classList.remove("is-modal-open");
  }
}

export function initModals() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target.matches(".modal__scrim") || event.target.dataset.close) closeModal(modal);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = document.querySelector(".modal:not([hidden])");
    if (open) {
      event.stopPropagation();
      closeModal(open);
    }
  });
}

/** Promise 版确认框，替代原生 confirm */
export function confirmDialog({
  title,
  message,
  confirmText = t("confirm"),
  cancelText = t("cancel"),
  danger = false,
  optionLabel = "",
}) {
  return new Promise((resolve) => {
    const body = h(
      "div",
      { class: "modal__body" },
      h("p", { class: "settings__note", text: message, style: { margin: "0 0 4px", fontSize: "13px", color: "var(--text-2)" } })
    );
    const panel = h(
      "div",
      { class: "modal__panel modal__panel--sm", role: "dialog", "aria-modal": "true" },
      h(
        "header",
        { class: "modal__head" },
        h("h2", { class: "modal__title", text: title })
      ),
      body,
      h(
        "footer",
        { class: "modal__foot" },
        h("button", { class: "btn btn--ghost", type: "button", text: cancelText, onclick: () => finish(false, false) }),
        optionLabel
          ? h("button", {
              class: `btn ${danger ? "btn--danger" : "btn--primary"}`,
              type: "button",
              text: optionLabel,
              onclick: () => finish(true, true),
            })
          : null,
        h("button", {
          class: `btn ${danger ? "btn--danger" : "btn--primary"}`,
          type: "button",
          text: confirmText,
          onclick: () => finish(true, false),
        })
      )
    );
    const modal = h("div", { class: "modal" }, h("div", { class: "modal__scrim", "data-close": "1" }), panel);
    function finish(value, checked = false) {
      modal.remove();
      if (!document.querySelector(".modal:not([hidden])")) document.body.classList.remove("is-modal-open");
      resolve(optionLabel ? { ok: value, checked } : value);
    }
    modal.addEventListener("click", (event) => {
      if (event.target.matches(".modal__scrim")) finish(false);
    });
    document.body.append(modal);
    document.body.classList.add("is-modal-open");
    panel.querySelector(".btn--ghost")?.focus();
  });
}
