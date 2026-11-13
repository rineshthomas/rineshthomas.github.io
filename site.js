(function () {
  const root = document.documentElement;
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
      : "dark";
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
      themeColor.content = theme === "dark" ? "#071322" : "#f1f6f8";
    }
  }

  applyTheme(theme);

  if (toggle) {
    toggle.hidden = false;
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

  const menuButton = document.querySelector(".nav-menu-toggle");
  if (menuButton) {
    const nav = menuButton.closest(".nav");
    const links = document.getElementById(menuButton.getAttribute("aria-controls"));
    const compact = window.matchMedia("(max-width: 720px)");

    function setMenu(open) {
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      menuButton.querySelector("path").setAttribute("d", open ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16");
    }

    menuButton.hidden = false;
    menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
    links.addEventListener("click", () => setMenu(false));
    nav.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        menuButton.focus();
      }
    });
    nav.addEventListener("focusout", (event) => {
      if (!nav.contains(event.relatedTarget)) setMenu(false);
    });
    document.addEventListener("click", (event) => {
      if (!nav.contains(event.target) && menuButton.getAttribute("aria-expanded") === "true") setMenu(false);
    });
    compact.addEventListener("change", () => setMenu(false));
  }

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
