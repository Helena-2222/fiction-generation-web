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
    ? String(button.dataset.busyLabel || "游客进入中...").trim()
    : button.dataset.originalLabel;
}

function getGuestEntryHref(button) {
  const href = String(button?.getAttribute("href") || "").trim();
  return href || "/create?guest=true";
}

function handleGuestEntryClick(event) {
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
  window.location.href = getGuestEntryHref(button);
}

guestEntryButtons.forEach((button) => {
  button.addEventListener("click", handleGuestEntryClick);
});
