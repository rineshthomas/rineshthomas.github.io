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
  const nav = { append(element) { this.child = element; } };
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
      dataset: { name: "Pulse", code: "02", progress: "84", detail: "A responsive signal." },
      addEventListener(name, listener) { this.click = listener; },
    };
    first.dataset = { name: "Flow", code: "01", progress: "62", detail: "A steady signal." };
    first.addEventListener = function (name, listener) { this.click = listener; };
    const outputs = { code: output(), name: output(), detail: output(), ring: output(), value: output(), status: output() };
    const selectors = {
      "[data-signal-code]": outputs.code,
      "[data-signal-name]": outputs.name,
      "[data-signal-detail]": outputs.detail,
      "[data-signal-ring]": outputs.ring,
      "[data-signal-value]": outputs.value,
      "[data-signal-status]": outputs.status,
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
      createElement: () => toggle,
      querySelector(selector) {
        if (selector === 'meta[name="theme-color"]') return meta;
        if (selector === ".site-header .nav-links") return nav;
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

  return { listeners, meta, nav, root, signal, storage, toggle };
}

const system = run({ prefersDark: true });
assert.equal(system.root.dataset.theme, "dark");
assert.equal(system.nav.child, system.toggle);
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
assert.equal(interactive.signal.outputs.code.textContent, "02");
assert.equal(interactive.signal.outputs.name.textContent, "Pulse");
assert.equal(interactive.signal.outputs.detail.textContent, "A responsive signal.");
assert.equal(interactive.signal.outputs.ring.style["--signal-progress"], "84");
assert.equal(interactive.signal.outputs.value.textContent, "84%");
assert.equal(interactive.signal.outputs.status["aria-live"], "polite");
assert.equal(interactive.signal.outputs.status.textContent, "Pulse, 84 percent: A responsive signal.");

console.log("Theme and interaction checks passed.");
