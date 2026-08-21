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
    : systemTheme.matches ? "dark" : "light";

  const nav = document.querySelector(".site-header .nav-links")
    || document.querySelector(".site-header .nav");
  const toggle = document.createElement("button");

  toggle.type = "button";
  toggle.className = "theme-toggle";
  toggle.dataset.themeToggle = "";

  function applyTheme(nextTheme) {
    theme = nextTheme;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
    toggle.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);
    toggle.textContent = theme === "dark" ? "Light" : "Dark";

    if (themeColor) {
      themeColor.content = theme === "dark" ? "#090909" : "#f5f2e9";
    }
  }

  applyTheme(theme);

  if (nav) {
    nav.append(toggle);
  }

  toggle.addEventListener("click", () => {
    applyTheme(theme === "dark" ? "light" : "dark");

    try {
      localStorage.setItem("theme", theme);
      savedTheme = theme;
    } catch (error) {
      // The selected theme still applies when storage is unavailable.
    }
  });

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
}());
