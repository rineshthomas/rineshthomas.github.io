(function () {
  const buttons = document.querySelectorAll("[data-copy]");
  const status = document.querySelector("[data-copy-status]");

  if (!buttons.length) {
    return;
  }

  buttons.forEach((button) => {
    button.hidden = false;
  });

  function setState(button, state, text) {
    button.dataset.state = state;
    button.textContent = text;
    if (status) {
      status.textContent = state === "success"
        ? "Email address copied."
        : state === "error"
          ? "Copy failed. Select the email address and copy it manually."
          : "";
    }
  }

  buttons.forEach((button) => {
    const idleText = button.textContent;

    button.addEventListener("click", async () => {
      setState(button, "loading", "Copying");

      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        setState(button, "success", "Copied");
      } catch (error) {
        setState(button, "error", "Copy failed");
      }

      window.setTimeout(() => {
        setState(button, "idle", idleText);
      }, 1800);
    });
  });
}());
