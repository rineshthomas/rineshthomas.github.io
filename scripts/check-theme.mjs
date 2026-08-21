import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../site.js", import.meta.url), "utf8");

function run({ saved = null, prefersDark = false, withPlayground = false } = {}) {
  const listeners = {};
  const toggle = {
    dataset: {},
    setAttribute(name, value) { this[name] = value; },
    addEventListener(name, listener) { listeners[name] = listener; },
  };
  const meta = {};
  const root = { dataset: {}, style: {} };
  const storage = {
    value: saved,
    getItem() { return this.value; },
    setItem(key, value) { this.value = value; },
  };
  const signal = withPlayground ? (() => {
    const output = () => ({
      style: { setProperty(name, value) { this[name] = value; } },
      setAttribute(name, value) { this[name] = value; },
    });
    const first = output();
    const second = {
      ...output(),
      dataset: {
        action: "Start an app project",
        name: "Apps and cloud",
        code: "APP / PRODUCT",
        milestone: "Core workflow prototype",
        deliverables: "Screens and APIs",
        platforms: "Web, iOS, and Android",
        send: "User roles and target devices",
      },
      addEventListener(name, listener) { this.click = listener; },
    };
    first.dataset = {
      action: "Start a web project",
      name: "Web systems",
      code: "WEB / LAUNCH",
      milestone: "Information architecture",
      deliverables: "Responsive frontend",
      platforms: "Web hosting and CMS",
      send: "Goals and current content",
    };
    first.addEventListener = function (name, listener) { this.click = listener; };
    const outputs = {
      code: output(),
      name: output(),
      milestone: output(),
      deliverables: output(),
      platforms: output(),
      send: output(),
      status: output(),
      cta: output(),
    };
    const selectors = {
      "[data-signal-code]": outputs.code,
      "[data-signal-name]": outputs.name,
      "[data-signal-milestone]": outputs.milestone,
      "[data-signal-deliverables]": outputs.deliverables,
      "[data-signal-platforms]": outputs.platforms,
      "[data-signal-send]": outputs.send,
      "[data-signal-status]": outputs.status,
      "[data-signal-cta]": outputs.cta,
    };
    return {
      first, second, outputs,
      root: {
        querySelector: (selector) => selectors[selector] || null,
        querySelectorAll: () => [first, second],
      },
    };
  })() : null;

  vm.runInNewContext(source, {
    document: {
      documentElement: root,
      querySelector(selector) {
        if (selector === 'meta[name="theme-color"]') return meta;
        if (selector === "[data-theme-toggle]") return toggle;
        if (selector === "[data-playground]") return signal?.root || null;
        return null;
      },
      querySelectorAll: () => [],
    },
    window: {
      matchMedia: () => ({
        matches: prefersDark,
        addEventListener(name, listener) { listeners.system = listener; },
      }),
      setTimeout,
    },
    localStorage: storage,
    navigator: {},
  });

  return { listeners, meta, root, signal, storage, toggle };
}

const system = run({ prefersDark: true });
assert.equal(system.root.dataset.theme, "dark");
assert.equal(system.toggle["aria-label"], "Switch to light mode");
assert.equal(system.meta.content, "#090909");

system.listeners.click();
assert.equal(system.root.dataset.theme, "light");
assert.equal(system.storage.value, "light");
assert.equal(system.toggle["aria-pressed"], "false");

const saved = run({ saved: "light", prefersDark: true });
assert.equal(saved.root.dataset.theme, "light");
saved.listeners.system({ matches: true });
assert.equal(saved.root.dataset.theme, "light");

const interactive = run({ withPlayground: true });
interactive.signal.second.click();
assert.equal(interactive.signal.first["aria-pressed"], "false");
assert.equal(interactive.signal.second["aria-pressed"], "true");
assert.equal(interactive.signal.outputs.code.textContent, "APP / PRODUCT");
assert.equal(interactive.signal.outputs.name.textContent, "Apps and cloud");
assert.equal(interactive.signal.outputs.milestone.textContent, "Core workflow prototype");
assert.equal(interactive.signal.outputs.deliverables.textContent, "Screens and APIs");
assert.equal(interactive.signal.outputs.platforms.textContent, "Web, iOS, and Android");
assert.equal(interactive.signal.outputs.send.textContent, "User roles and target devices");
assert.match(interactive.signal.outputs.cta.href, /^mailto:contact@logicleaptechnologies\.com\?subject=Apps%20and%20cloud%20project%20inquiry&body=/);
assert.match(interactive.signal.outputs.cta.href, /Platforms%20or%20integrations%3A/);
assert.equal(interactive.signal.outputs.cta.textContent, "Start an app project");
assert.equal(interactive.signal.outputs.status["aria-live"], "polite");
assert.equal(interactive.signal.outputs.status.textContent, "Apps and cloud project profile selected.");

const assetVersions = new Set();

for (const file of fs.readdirSync(new URL("../", import.meta.url)).filter((name) => name.endsWith(".html"))) {
  const html = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const themeInit = html.indexOf('src="theme-init.js?v=');
  const stylesheet = html.indexOf('href="styles.css?v=');
  const styleVersion = html.match(/href="styles\.css\?v=(\d+)"/)?.[1];
  const scriptVersion = html.match(/src="site\.js\?v=(\d+)"/)?.[1];

  assert.ok(themeInit >= 0 && themeInit < stylesheet, `${file} loads theme-init before its stylesheet`);
  assert.ok(styleVersion && scriptVersion, `${file} uses versioned site assets`);
  assert.equal(styleVersion, scriptVersion, `${file} uses one asset version`);
  assert.match(html, /<button[^>]+data-theme-toggle/, `${file} renders its theme button in HTML`);
  assert.doesNotMatch(html, /href="(?:\.\/)?index\.html"/, `${file} links home with /`);
  assetVersions.add(styleVersion);
}
assert.equal(assetVersions.size, 1, "all HTML pages use the same asset version");

console.log("Theme and interaction checks passed.");
