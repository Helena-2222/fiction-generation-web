import { getCurrentSession, isAnonymousUser } from "./src/auth-client.js";

const guestEntryButtons = Array.from(document.querySelectorAll("[data-guest-login]"));

let activeGuestButton = null;
let guestLoginPending = false;

function isPlainPrimaryClick(event) {
  return event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey;
}

function setGuestLoginState(button, pending) {
  activeGuestButton = pending ? button : null;

  guestEntryButtons.forEach((entry) => {
    entry.classList.toggle("is-loading", pending);
    entry.setAttribute("aria-disabled", pending ? "true" : "false");
  });

  if (!button) {
    return;
  }

  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel = button.textContent.trim();
  }

  button.textContent = pending
    ? String(button.dataset.busyLabel || "正在进入...").trim()
    : button.dataset.originalLabel;
}

async function handleGuestEntryClick(event) {
  if (!isPlainPrimaryClick(event)) {
    return;
  }

  const button = event.currentTarget;
  if (!(button instanceof HTMLElement)) {
    return;
  }

  event.preventDefault();

  if (guestLoginPending) {
    return;
  }

  guestLoginPending = true;
  setGuestLoginState(button, true);

  try {
    const session = await getCurrentSession().catch(() => null);
    const user = session?.user ?? null;
    window.location.href = user && !isAnonymousUser(user)
      ? "/create"
      : "/create?guest=true";
  } catch (error) {
    console.error("游客登录跳转失败。", error);
    window.location.href = "/create?guest=true";
  }
}

guestEntryButtons.forEach((button) => {
  button.addEventListener("click", handleGuestEntryClick);
});
