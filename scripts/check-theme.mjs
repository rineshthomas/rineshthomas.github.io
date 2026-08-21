import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../site.js", import.meta.url), "utf8");

function run({ saved = null, prefersDark = false } = {}) {
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

  vm.runInNewContext(source, {
    document: {
      documentElement: root,
      createElement: () => toggle,
      querySelector(selector) {
        if (selector === 'meta[name="theme-color"]') return meta;
        if (selector === ".site-header .nav-links") return nav;
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

  return { listeners, meta, nav, root, storage, toggle };
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

console.log("Theme check passed.");
