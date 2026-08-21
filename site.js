(function () {
  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const themeColor = document.querySelector('meta[name="theme-color"]');
  let savedTheme;

  try {
    savedTheme = localStorage.getItem("theme");
  } catch (error) {
    savedTheme = null;
  }

  let theme = savedTheme === "dark" || savedTheme === "light"
    ? savedTheme
    : root.dataset.theme === "dark" || root.dataset.theme === "light"
      ? root.dataset.theme
      : systemTheme.matches ? "dark" : "light";
  const toggle = document.querySelector("[data-theme-toggle]");

  function applyTheme(nextTheme) {
    theme = nextTheme;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(theme === "dark"));
      toggle.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);
      toggle.textContent = theme === "dark" ? "Light" : "Dark";
    }

    if (themeColor) {
      themeColor.content = theme === "dark" ? "#090909" : "#f5f2e9";
    }
  }

  applyTheme(theme);

  if (toggle) {
    toggle.addEventListener("click", () => {
      applyTheme(theme === "dark" ? "light" : "dark");

      try {
        localStorage.setItem("theme", theme);
        savedTheme = theme;
      } catch (error) {
        // The selected theme still applies when storage is unavailable.
      }
    });
  }

  systemTheme.addEventListener("change", (event) => {
    if (savedTheme !== "dark" && savedTheme !== "light") {
      applyTheme(event.matches ? "dark" : "light");
    }
  });

  const buttons = document.querySelectorAll("[data-copy]");
  const status = document.querySelector("[data-copy-status]");

  buttons.forEach((button) => {
    button.hidden = false;
    const idleText = button.textContent;

    button.addEventListener("click", async () => {
      button.dataset.state = "loading";
      button.textContent = "Copying";

      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.dataset.state = "success";
        button.textContent = "Copied";
        if (status) status.textContent = "Email address copied.";
      } catch (error) {
        button.dataset.state = "error";
        button.textContent = "Copy failed";
        if (status) status.textContent = "Copy failed. Select the email address and copy it manually.";
      }

      window.setTimeout(() => {
        button.dataset.state = "idle";
        button.textContent = idleText;
        if (status) status.textContent = "";
      }, 1800);
    });
  });

  const playground = document.querySelector("[data-playground]");

  if (playground) {
    const modes = playground.querySelectorAll("[data-signal-mode]");
    const code = playground.querySelector("[data-signal-code]");
    const name = playground.querySelector("[data-signal-name]");
    const fields = ["milestone", "deliverables", "platforms", "send"];
    const status = playground.querySelector("[data-signal-status]");
    const cta = playground.querySelector("[data-signal-cta]");
    const inquiryBody = "Project goal:\n\nCurrent state:\n\nPlatforms or integrations:\n\nDeadline or target date:\n\nIndicative budget:\n";

    if (status) status.setAttribute("aria-live", "polite");

    modes.forEach((button) => {
      button.addEventListener("click", () => {
        modes.forEach((mode) => mode.setAttribute("aria-pressed", String(mode === button)));
        if (code) code.textContent = button.dataset.code;
        if (name) name.textContent = button.dataset.name;
        fields.forEach((field) => {
          const output = playground.querySelector(`[data-signal-${field}]`);
          if (output) output.textContent = button.dataset[field];
        });
        if (cta) {
          cta.href = `mailto:contact@logicleaptechnologies.com?subject=${encodeURIComponent(`${button.dataset.name} project inquiry`)}&body=${encodeURIComponent(inquiryBody)}`;
          cta.textContent = button.dataset.action;
        }
        if (status) status.textContent = `${button.dataset.name} project profile selected.`;
      });
    });
  }
}());
