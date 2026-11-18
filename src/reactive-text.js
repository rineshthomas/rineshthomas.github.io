(() => {
  'use strict';
  const main = document.querySelector('main');
  if (!main) return;

  const pretext = window.LogicLeapPretext;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const range = document.createRange();
  const groups = [];
  const bodies = [];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  let count = 0, lastFrame = -Infinity, fontsReady = !document.fonts;
  let viewX = 0, viewY = 0, viewBottom = 0;

  // Keep one selectable copy, in reading order. A transform moves only the
  // painted word; its original line still reserves space in the document.
  for (const block of main.querySelectorAll('h1, h2, h3, p, .workflow li strong')) {
    if (block.closest('form, details, [hidden]') || block.querySelector('a, button, input, svg')) continue;
    const group = {block, words: [], rows: [], flow: block.matches('p') && !block.firstElementChild,
      headline: block.matches('h1, h2, h3'), active: false};
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.data.trim() && !node.parentElement.closest('[aria-hidden="true"]')) nodes.push(node);
    }
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      for (const part of node.data.match(/\s+|\S+/gu)) {
        if (!part.trim()) { fragment.append(part); continue; }
        const span = document.createElement('span');
        span.className = 'flight-word';
        span.textContent = part;
        fragment.append(span);
        group.words.push({span, text: part, x: 0, y: 0, nudgeX: 0, nudgeY: 0, flowX: 0, flowY: 0});
      }
      node.replaceWith(fragment);
    }
    if (group.words.length) groups.push(group);
  }

  function prepare(group, style) {
    if (!group.flow || !fontsReady || !pretext || !Intl.Segmenter) return;
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const spacing = parseFloat(style.letterSpacing) || 0;
    const key = font + '/' + spacing;
    if (key === group.fontKey) return;
    group.fontKey = key;
    group.prepared = null;
    let prepared;
    try {
      prepared = pretext.prepareWithSegments(group.words.map(w => w.text).join(' '), font, {letterSpacing: spacing});
    } catch {
      return; // Native wrapping and word motion still work when measurement is unavailable.
    }
    const {segments, kinds, widths} = prepared;
    let index = 0;
    group.space = 0;
    for (const w of group.words) {
      while (kinds[index] === 'space') { group.space = widths[index]; index++; }
      w.start = index;
      while (index < segments.length && kinds[index] !== 'space') index++;
      w.end = index;
      if (segments.slice(w.start, w.end).join('') !== w.text) return;
    }
    if (index === segments.length) group.prepared = prepared;
  }

  // Called on a font, content or viewport reflow. The flight loop uses only
  // these document coordinates and the positions the sprite renderer supplies.
  function measure(scrollX, scrollY) {
    const readingRows = [];
    const obstacles = Array.from(main.querySelectorAll('h1,h2,h3,h4,p,a,button,summary,input,textarea,select,label,svg,strong'), el => {
      const r = el.getBoundingClientRect();
      return {el, left: r.left + scrollX, right: r.right + scrollX, top: r.top + scrollY, bottom: r.bottom + scrollY};
    });
    for (const g of groups) {
      const block = g.block.getBoundingClientRect();
      const style = getComputedStyle(g.block);
      g.left = block.left + scrollX + (parseFloat(style.paddingLeft) || 0);
      g.right = block.right + scrollX - (parseFloat(style.paddingRight) || 0);
      g.lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
      g.rows = [];
      for (let i = 0; i < g.words.length; i++) {
        const w = g.words[i];
        range.selectNodeContents(w.span);
        const box = range.getBoundingClientRect();
        w.left = box.left + scrollX - w.x; w.top = box.top + scrollY - w.y;
        w.width = box.width; w.height = box.height;
        let row = g.rows.at(-1);
        if (!row || Math.abs(row.top - w.top) > 1) {
          row = {first: i, end: i, top: w.top, bottom: w.top + w.height, left: w.left, right: w.left};
          g.rows.push(row);
        }
        row.end = i + 1;
        row.right = Math.max(row.right, w.left + w.width);
        row.bottom = Math.max(row.bottom, w.top + w.height);
      }
      g.top = g.rows[0].top;
      g.bottom = g.rows.at(-1).bottom;
      readingRows.push(...g.rows);
      const last = g.rows.at(-1);
      const inkHeight = last.bottom - last.top;
      const panel = g.block.closest('.content-panel, .hero');
      const neighbors = obstacles.filter(b => b.el !== g.block && !g.block.contains(b.el) && !b.el.contains(g.block));
      const parent = g.block.parentElement;
      g.flowRight = Math.max(g.right, Math.min(g.right + Math.min(64, (g.right - g.left) * .15),
        parent.getBoundingClientRect().right + scrollX - (parseFloat(getComputedStyle(parent).paddingRight) || 0)));
      for (const b of neighbors) {
        if (b.left >= g.right && b.bottom > g.top && b.top < g.bottom + g.lineHeight) g.flowRight = Math.min(g.flowRight, Math.max(g.right, b.left - 4));
      }
      g.extraTop = undefined;
      if (g.flow && panel) {
        const floor = panel.getBoundingClientRect().bottom + scrollY;
        const leading = Math.max(inkHeight + 3, g.lineHeight - 4);
        g.extraTop = [last.top + g.lineHeight, last.top + leading].find(top => top + inkHeight + 3 <= floor &&
          !neighbors.some(b => b.right > g.left && b.left < g.flowRight && b.bottom > top - 3 && b.top < top + inkHeight + 3));
      }
      prepare(g, style);
    }
    lastFrame = -Infinity;
    return readingRows;
  }

  function clearFlow(g) {
    for (const w of g.words) { w.flowX = 0; w.flowY = 0; }
  }

  // Route whole words through the open intervals on each row. If copy won't
  // fit, retry with a smaller pocket; nothing is clipped or pushed off a card.
  function wrap(g, nearby, amount, right) {
    clearFlow(g);
    let next = 0;
    const limit = g.rows.length + Number(g.extraTop !== undefined);
    for (let line = 0; line < limit && next < g.words.length; line++) {
      const native = g.rows[line];
      const top = native?.top ?? g.extraTop;
      const bottom = top + g.words[0].height;
      const cuts = [];
      for (const b of nearby) {
        const r = (b.r + 3) * amount;
        const dy = Math.max(top - b.y, b.y - bottom, 0);
        if (dy >= r) continue;
        const half = Math.sqrt(r*r - dy*dy);
        if (b.x + half > g.left && b.x - half < right) cuts.push([Math.max(g.left, b.x - half), Math.min(right, b.x + half)]);
      }
      if (native && next === native.first && !cuts.some(([l, r]) => l < native.right && r > native.left)) {
        next = native.end;
        continue;
      }
      cuts.sort((a, b) => a[0] - b[0]);
      cuts.push([right, right]);
      let left = g.left;
      for (const [end, resume] of cuts) {
        if (next < g.words.length && end - left >= g.words[next].width - .1) {
          const cursor = {segmentIndex: g.words[next].start, graphemeIndex: 0};
          const fit = pretext.layoutNextLineRange(g.prepared, end - left, cursor);
          let x = left;
          while (fit && next < g.words.length) {
            const w = g.words[next];
            if (w.end > fit.end.segmentIndex || x + w.width > end + .2) break;
            w.flowX = x - w.left;
            w.flowY = top - w.top;
            x += w.width + g.space;
            next++;
          }
        }
        left = Math.max(left, resume);
      }
    }
    return next === g.words.length;
  }

  function position(w, x, y) {
    x = Math.round(x * 16) / 16; y = Math.round(y * 16) / 16;
    if (x === w.x && y === w.y) return;
    w.x = x; w.y = y;
    w.span.style.transform = x || y ? `translate(${x}px,${y}px)` : '';
  }
  function route(g, nearby) {
    if (g.prepared && nearby.length) {
      if (wrap(g, nearby, 1, g.right)) return;
      if (g.flowRight > g.right + 1 && wrap(g, nearby, 1, g.flowRight)) return;
      if (wrap(g, nearby, .68, g.flowRight)) return;
    }
    clearFlow(g);
  }
  function reset(g) {
    if (!g.active) return;
    for (const w of g.words) {
      w.nudgeX = w.nudgeY = w.flowX = w.flowY = 0;
      position(w, 0, 0);
    }
    g.active = false;
  }

  function render(enabled) {
    if (!enabled || reduced.matches) { groups.forEach(reset); lastFrame = -Infinity; return; }
    if (getSelection()?.isCollapsed === false) return;
    const now = performance.now();
    if (now - lastFrame < 30) return;
    const ease = 1 - Math.exp(-Math.min(80, now - lastFrame) / 65);
    lastFrame = now;
    for (const g of groups) {
      if (!g.rows.length || g.bottom + g.lineHeight < viewY || g.top > viewBottom) { reset(g); continue; }
      const nearby = [];
      for (let i = 0; i < count; i++) {
        const b = bodies[i], reach = b.r + 38;
        if (b.x + reach > g.left && b.x - reach < g.right && b.y + reach > g.top && b.y - reach < g.bottom) nearby.push(b);
      }
      if (!nearby.length && !g.active) continue;
      route(g, nearby);
      g.active = false;
      for (const w of g.words) {
        const left = w.left + w.flowX, top = w.top + w.flowY;
        let fx = 0, fy = 0, strongest = 0;
        for (const b of nearby) {
          const dx = clamp(b.x, left, left + w.width) - b.x;
          const dy = clamp(b.y, top, top + w.height) - b.y;
          const reach = b.r + (g.headline ? 38 : 22);
          const force = Math.max(0, 1 - Math.hypot(dx, dy) / reach) ** 2 * b.strength;
          if (force <= strongest) continue;
          strongest = force;
          const vx = dx || left + w.width/2 - b.x, vy = dy || top + w.height/2 - b.y;
          const mag = Math.max(1, Math.hypot(vx, vy));
          const push = (g.headline ? 4 : 2.2) * force / mag;
          fx = vx * push; fy = vy * push;
        }
        w.nudgeX += (fx - w.nudgeX) * ease; w.nudgeY += (fy - w.nudgeY) * ease;
        position(w, w.flowX + w.nudgeX, w.flowY + w.nudgeY);
        if (w.x || w.y) g.active = true;
      }
    }
  }

  function addBody(x, y, radius, opacity) {
    if (opacity < .12) return;
    const b = bodies[count] || (bodies[count] = {});
    b.x = x + viewX; b.y = y + viewY; b.r = radius * Math.sqrt(opacity); b.strength = opacity;
    count++;
  }
  function fontsChanged() {
    fontsReady = true;
    pretext?.clearCache();
    for (const g of groups) g.fontKey = null;
    document.dispatchEvent(new Event('worldlayoutchange'));
  }
  document.fonts?.ready.then(fontsChanged);
  document.fonts?.addEventListener('loadingdone', fontsChanged);
  reduced.addEventListener('change', () => {
    groups.forEach(reset);
    document.dispatchEvent(new Event('worldlayoutchange'));
  });
  function beginFrame() {
    count = 0;
    viewX = scrollX; viewY = scrollY; viewBottom = viewY + innerHeight;
  }
  window.logicReactiveText = {measure, beginFrame, addBody, render};
})();
