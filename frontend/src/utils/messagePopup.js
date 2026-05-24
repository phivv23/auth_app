export function openMessagePopup(userId) {
  window.dispatchEvent(
    new CustomEvent("open-message-popup", {
      detail: {
        userId,
      },
    })
  );
}
