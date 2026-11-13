(() => {
  'use strict';

  const main = document.querySelector('main');
  const footer = document.querySelector('.site-footer');
  const fixedChrome = [...document.querySelectorAll('.site-header, #mobileNav, .skip')];
  const control = 'a, button, input, textarea, select, summary, [contenteditable="true"]';
  const blocked = `${control}, [hidden], .sr-only, script, style, template, svg`;
  const range = document.createRange();
  let pageRects = [];
  let visible = [];
  let dirty = true;
  let previousX = NaN;
  let previousY = NaN;

  function invalidate() {
    if (dirty) return;
    dirty = true;
    document.dispatchEvent(new Event('worldreadingspacechange'));
  }

  function padded(rect, padding, offsetX = 0, offsetY = 0) {
    const left = Math.floor(rect.left + offsetX - padding);
    const top = Math.floor(rect.top + offsetY - padding);
    const right = Math.ceil(rect.right + offsetX + padding);
    const bottom = Math.ceil(rect.bottom + offsetY + padding);
    return {left, top, right, bottom, width: right - left, height: bottom - top};
  }

  // These rectangles move with the document. Measure on reflow, not on each
  // motion frame. Range returns the actual footprint of each wrapped text line.
  function measurePage(x, y) {
    pageRects = [];
    function include(rects, padding) {
      for (const rect of rects) {
        if (rect.width && rect.height) pageRects.push(padded(rect, padding, x, y));
      }
    }
    for (const root of [main, footer]) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.data.trim() || node.parentElement.closest(blocked)) continue;
        range.selectNodeContents(node);
        include(range.getClientRects(), 5);
      }
      for (const item of root.querySelectorAll(control + ', svg')) {
        if (item.closest('[hidden], .sr-only') || item.parentElement.closest(control)) continue;
        include(item.getClientRects(), item.matches(':focus-visible') ? 9 : 5);
      }
    }
    dirty = false;
  }

  function rects() {
    const x = window.scrollX, y = window.scrollY;
    if (!dirty && previousX === x && previousY === y) return visible;
    if (dirty) measurePage(x, y);
    previousX = x;
    previousY = y;
    visible = [];
    function include(box) {
      if (box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight) {
        visible.push(box);
      }
    }
    for (const box of pageRects) {
      if (box.bottom <= y || box.top >= y + innerHeight) continue;
      include(padded(box, 0, -x, -y));
    }
    // Sticky navigation and the skip link don't share the document offset.
    for (const item of fixedChrome) {
      const box = item.getBoundingClientRect();
      if (box.width && box.height) include(padded(box, 5));
    }
    return visible;
  }

  // The renderer calls this after drawing every sprite, beam and particle.
  // Clear the union of the boxes; overlapping line or control boxes stay empty.
  function clear(ctx) {
    for (const box of rects()) ctx.clearRect(box.left, box.top, box.width, box.height);
  }

  const sizes = new ResizeObserver(invalidate);
  for (const item of [main, footer, ...document.querySelectorAll('.world-section'), ...fixedChrome]) sizes.observe(item);
  const content = new MutationObserver(invalidate);
  const options = {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['open', 'hidden']};
  content.observe(main, options);
  content.observe(footer, options);
  document.addEventListener('worldlayoutchange', invalidate);
  document.addEventListener('worldlock', invalidate);
  document.addEventListener('focusin', invalidate);
  document.addEventListener('focusout', invalidate);
  addEventListener('resize', invalidate, {passive: true});
  document.fonts?.addEventListener('loadingdone', invalidate);
  Object.defineProperty(window, 'logicReadingSpace', {value: Object.freeze({rects, clear})});
})();
