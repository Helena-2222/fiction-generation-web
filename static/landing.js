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

function getFallbackNextPath(button) {
  const nextPath = String(button?.dataset?.nextPath || "").trim();
  return nextPath || "/create?stage=basic&guest=1";
}

function startGuestLogin(nextPath) {
  window.location.replace(nextPath);
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

  const nextPath = getFallbackNextPath(button);
  guestLoginPending = true;
  setGuestLoginState(button, true);

  try {
    startGuestLogin(nextPath);
  } catch (error) {
    console.warn("Guest entry navigation failed.", error);
    guestLoginPending = false;
    setGuestLoginState(activeGuestButton, false);
    window.location.replace(nextPath);
  }
}

guestEntryButtons.forEach((button) => {
  button.addEventListener("click", handleGuestEntryClick);
});
