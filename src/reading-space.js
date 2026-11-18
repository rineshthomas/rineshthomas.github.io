(() => {
  'use strict';

  const main = document.querySelector('main');
  const footer = document.querySelector('.site-footer');
  const fixedChrome = [...document.querySelectorAll('.site-header, #mobileNav, .skip')];
  const control = 'a, button, input, textarea, select, summary, [contenteditable="true"]';
  const surface = '.button, button, input, textarea, select';
  const blocked = `${control}, [hidden], .sr-only, script, style, template, svg`;
  const range = document.createRange();
  let pageRects = [];
  let visible = [];
  let pageCovers = [], visibleCovers = [];
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
  function cover(item, x = 0, y = 0) {
    const r = item.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const style = getComputedStyle(item);
    const radii = [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius]
      .map(value => Math.min(parseFloat(value) || 0, r.width / 2, r.height / 2));
    return {left: r.left + x, top: r.top + y, right: r.right + x, bottom: r.bottom + y, width: r.width, height: r.height, radii};
  }

  // These rectangles move with the document. Measure on reflow, not on each
  // motion frame. Range returns the actual footprint of each wrapped text line.
  function measurePage(x, y) {
    pageRects = [];
    pageCovers = [];
    const response = window.logicReactiveText;
    // Spawn in the gaps in the resting copy. Moving words never move a
    // spawn point or change the page layout under a reader's finger.
    if (response) for (const row of response.measure(x, y)) pageRects.push(padded(row, 5));
    function include(rects, padding) {
      for (const rect of rects) {
        if (rect.width && rect.height) pageRects.push(padded(rect, padding, x, y));
      }
    }
    for (const root of [main, footer]) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.data.trim() || node.parentElement.closest(blocked)) continue;
        if (response && node.parentElement.classList.contains('flight-word')) continue;
        range.selectNodeContents(node);
        include(range.getClientRects(), 5);
      }
      for (const item of root.querySelectorAll(control + ', svg')) {
        if (item.closest('[hidden], .sr-only') || item.parentElement.closest(control)) continue;
        include(item.getClientRects(), item.matches(':focus-visible') ? 9 : 5);
      }
      for (const item of root.querySelectorAll(surface)) {
        const box = cover(item, x, y);
        if (box) pageCovers.push(box);
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
    visibleCovers = [];
    function include(box) {
      if (box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight) {
        visible.push(box);
      }
    }
    for (const box of pageRects) {
      if (box.bottom <= y || box.top >= y + innerHeight) continue;
      include(padded(box, 0, -x, -y));
    }
    for (const b of pageCovers) {
      if (b.bottom > y && b.top < y + innerHeight) {
        visibleCovers.push({...b, left: b.left - x, right: b.right - x, top: b.top - y, bottom: b.bottom - y});
      }
    }
    // Sticky navigation and the skip link don't share the document offset.
    for (const item of fixedChrome) {
      const box = cover(item);
      if (box) {
        include(padded(box, 5));
        if (box.bottom > 0 && box.top < innerHeight) visibleCovers.push(box);
      }
    }
    return visible;
  }

  function covers() { rects(); return visibleCovers; }
  // Letters paint above the flight canvas in the DOM. Only the real foreground
  // surfaces occlude the sprites, right up to their rounded edges.
  function clear(ctx) {
    const surfaces = covers();
    if (!ctx.roundRect) {
      for (const b of surfaces) ctx.clearRect(b.left, b.top, b.width, b.height);
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    for (const b of surfaces) ctx.roundRect(b.left, b.top, b.width, b.height, b.radii);
    ctx.fill();
    ctx.restore();
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
  Object.defineProperty(window, 'logicReadingSpace', {value: Object.freeze({rects, covers, clear})});
})();
