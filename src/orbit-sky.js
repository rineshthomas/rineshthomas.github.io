(() => {
  'use strict';

  const backdrop = document.querySelector('.world-backdrop');
  const hero = document.querySelector(backdrop ? '#home' : '.page-hero');
  if (!hero) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.className = 'orbit-sky';
  canvas.setAttribute('aria-hidden', 'true');
  (backdrop || hero).append(canvas);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const tau = 2 * Math.PI;
  // Stable grain positions let the sky freeze, resize and resume without a cut.
  let seed = 47291;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function makeGlow(rgb, core, flare) {
    const stamp = document.createElement('canvas');
    stamp.width = stamp.height = 128;
    const brush = stamp.getContext('2d');
    const halo = brush.createRadialGradient(64, 64, 0, 64, 64, 64);
    halo.addColorStop(0, core);
    halo.addColorStop(flare ? .036 : .105, core);
    halo.addColorStop(.15, 'rgba(' + rgb + ',.85)');
    halo.addColorStop(.32, 'rgba(' + rgb + ',.27)');
    halo.addColorStop(.62, 'rgba(' + rgb + ',.07)');
    halo.addColorStop(1, 'rgba(' + rgb + ',0)');
    brush.fillStyle = halo;
    brush.fillRect(0, 0, 128, 128);
    if (flare) {
      brush.translate(64, 64);
      for (let arm = 0; arm < 4; arm++) {
        const ray = brush.createLinearGradient(0, 0, 56, 0);
        ray.addColorStop(0, core);
        ray.addColorStop(1, 'rgba(' + rgb + ',0)');
        brush.fillStyle = ray;
        brush.beginPath();
        brush.moveTo(0, -1.8);
        brush.lineTo(56, 0);
        brush.lineTo(0, 1.8);
        brush.fill();
        brush.rotate(Math.PI / 2);
      }
    }
    return stamp;
  }

  function palette(grains, rgb, core) {
    return {grains, glow: makeGlow(rgb, core, false), flare: makeGlow(rgb, core, true)};
  }
  const night = [
    palette(['#c7e78c', '#e9ffac', '#fffce0'], '213,245,121', '#ffffe9'),
    palette(['#87dce8', '#bbf4ff', '#f3fcff'], '136,228,255', '#f4ffff')
  ];
  let daylight;

  const stars = Array.from({length: 260}, () => ({
    u: random(), v: random(), depth: .25 + random() * .75, phase: random() * tau,
    size: .65 + random() ** 4 * 1.35, flare: random() > .947
  }));
  function makeGrain() {
    // Small dust knots break up the even spacing of the long diffuse tail.
    const clustered = random() < .33;
    const lag = clustered ? (Math.floor(random() * 12) + (random() + random()) * .24 + .2) / 12 : random() ** 1.12;
    const angle = lag * 2.96;
    const spread = (.10 + lag * (.8 + random())) * (clustered ? .48 : 1);
    const light = random();
    return {
      cos: Math.cos(angle), sin: Math.sin(angle), lag,
      scatterX: (random() + random() + random() - 1.5) * spread,
      scatterY: (random() + random() + random() - 1.5) * spread,
      curl: random() * tau, size: .65 + random() ** 3.5 * 2.1,
      alpha: (.53 + random() * .47) * (1 - lag ** 3),
      tone: Math.floor(random() * 3), glow: light > .88, flare: light > .98
    };
  }
  const trails = [[], []];

  let width, height, density, budget, compact, trailCount, starCount, scale;
  let lastTime = NaN, lastJourney = NaN, lastLight;
  let aimX = 0, aimY = 0, pull = 0;
  let waveX = 0, waveY = 0, waveStart = -10;
  let pullRadius, waveRadius, waveStrength;

  function resize(economical) {
    const dpr = Math.min(devicePixelRatio || 1, economical ? 1.25 : 1.5);
    const nextWidth = canvas.clientWidth, nextHeight = canvas.clientHeight;
    if (nextWidth === width && nextHeight === height && dpr === density && budget === economical) return;
    width = nextWidth;
    height = nextHeight;
    density = dpr;
    budget = economical;
    compact = width < 650;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.max(.68, Math.min(1.24, width / 1260));
    const area = width * height;
    trailCount = Math.round(Math.min(economical ? 420 : 1120, 210 + area / 1120));
    for (const trail of trails) {
      while (trail.length < trailCount) trail.push(makeGrain());
    }
    starCount = Math.min(stars.length, Math.round(42 + area / 5900));
    pullRadius = compact ? 100 : 175 * scale;
    lastTime = NaN;
  }

  function ripple(x, y) {
    if (reduced.matches) return;
    waveX = x;
    waveY = y;
    waveStart = Number.isFinite(lastTime) ? lastTime : 0;
  }

  function grain(x, y, size, alpha, color, stamp) {
    const dx = aimX - x, dy = aimY - y;
    if (pull > .002 && Math.abs(dx) < pullRadius && Math.abs(dy) < pullRadius) {
      const influence = Math.max(0, 1 - (dx * dx + dy * dy) / (pullRadius * pullRadius)) ** 2 * pull;
      x += (dx * .49 - dy * .34) * influence;
      y += (dy * .49 + dx * .34) * influence;
      alpha += influence * .36;
    }
    if (waveStrength > 0 && Math.abs(x - waveX) < waveRadius + 40 * scale && Math.abs(y - waveY) < waveRadius + 40 * scale) {
      const vx = x - waveX, vy = y - waveY;
      const distance = Math.hypot(vx, vy);
      const crest = Math.max(0, 1 - Math.abs(distance - waveRadius) / (37 * scale));
      const push = crest * waveStrength * 34 * scale / Math.max(1, distance);
      x += vx * push;
      y += vy * push;
      alpha += crest * waveStrength * .6;
    }
    ctx.globalAlpha = Math.min(1, alpha);
    if (stamp) {
      ctx.drawImage(stamp, x - size / 2, y - size / 2, size, size);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
  }

  function draw(time, journey = 0, focus = null) {
    if (!width || !height) return;
    if (reduced.matches) { time = journey = pull = 0; waveStart = -10; focus = null; }
    const light = document.documentElement.dataset.theme === 'light';
    const dt = time - lastTime;
    if (dt >= 0 && dt < 1 / 32 && journey === lastJourney && light === lastLight) return;
    lastTime = time;
    lastJourney = journey;
    lastLight = light;
    if (light && !daylight) {
      daylight = [
        palette(['#51691d', '#7c922a', '#344b14'], '135,165,51', '#f7ffda'),
        palette(['#177389', '#388d9e', '#225774'], '66,158,179', '#e9fdff')
      ];
    }
    const colors = light ? daylight : night;
    const blend = Number.isFinite(dt) ? 1 - Math.exp(-Math.max(0, dt) * 9) : 1;
    pull += ((focus ? 1 : 0) - pull) * blend;
    if (focus) { aimX = focus.x; aimY = focus.y; }
    const age = time - waveStart;
    waveStrength = age >= 0 ? Math.max(0, 1 - age / 1.1) : 0;
    waveRadius = (14 + 270 * age) * scale;
    const shiftX = (aimX / width - .5) * pull * 24 * scale;
    const shiftY = (aimY / height - .5) * pull * 18 * scale;
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < starCount; i++) {
      const s = stars[i], color = colors[i % 2];
      const shimmer = .72 + .2 * Math.sin(s.phase + time * .55);
      const x = s.u * width + shiftX * s.depth;
      const y = s.v * height + shiftY * s.depth;
      grain(x, y, s.size * scale * (s.flare ? 9 : 1), shimmer * s.depth,
        color.grains[1], s.flare && color.flare);
    }

    // Two opposing comets follow one tilted orbit. Old grains spread into
    // loose filaments while the dust immediately behind each nucleus is tight.
    const cx = width * (compact ? .61 : .73) + shiftX;
    const cy = height * (backdrop ? .46 : .49) + shiftY;
    const rx = width * (compact ? .56 : .34);
    const ry = height * (backdrop ? (compact ? .32 : .24) : .41);
    const tilt = height * .073;
    for (let arm = 0; arm < trails.length; arm++) {
      const color = colors[arm];
      const heading = -1.24 + arm * Math.PI + time * .129 + journey * .36;
      const cos = Math.cos(heading), sin = Math.sin(heading);
      for (let i = 0; i < trailCount; i++) {
        const p = trails[arm][i];
        const u = cos * p.cos + sin * p.sin, v = sin * p.cos - cos * p.sin;
        const fringe = Math.sin(p.lag * 11 + p.curl + time * .22) * p.lag;
        const x = cx + rx * u + p.scatterX * 40 * scale;
        const y = cy + ry * v - tilt * u + (p.scatterY * 40 + fringe * 8) * scale;
        const stamp = p.flare ? color.flare : p.glow && color.glow;
        grain(x, y, p.size * scale * (stamp ? 11 : 1), p.alpha, color.grains[p.tone], stamp);
      }
      grain(cx + rx * cos, cy + ry * sin - tilt * cos,
        (arm ? 132 : 145) * scale, 1, null, arm ? color.flare : color.glow);
    }
    // A pulse also lifts a few bright motes in the gaps between the two tails.
    if (waveStrength > 0) {
      for (let i = 0; i < 28; i++) {
        const s = stars[i], r = (8 + (1 - waveStrength ** 2) * (25 + s.depth * 85)) * scale;
        const side = (4 + 11 * s.depth) * scale;
        const x = waveX + Math.cos(s.phase) * r, y = waveY + Math.sin(s.phase) * r;
        ctx.globalAlpha = waveStrength * s.depth;
        ctx.drawImage(colors[i % 2].glow, x - side / 2, y - side / 2, side, side);
      }
    }
    ctx.globalAlpha = 1;
  }

  if (backdrop) {
    // Flight owns input, the animation clock and pause on the playable page.
    window.logicOrbitSky = {resize, draw, ripple};
    return;
  }

  // The document pages only animate their small illustrated masthead.
  let paused = false;
  try { paused = localStorage.getItem('ll-motion') === 'paused'; } catch { /* Storage is optional. */ }
  let visible = false, frame = 0, previous = 0, elapsed = 0, pointer = null;
  function tick(now) {
    frame = 0;
    if (!visible || document.hidden) return;
    if (previous && !paused && !reduced.matches) elapsed += Math.min(.1, (now - previous) / 1000);
    previous = now;
    draw(elapsed, 0, pointer);
    if (!paused && !reduced.matches) frame = requestAnimationFrame(tick);
  }
  function refresh() {
    cancelAnimationFrame(frame);
    previous = 0;
    if (visible && !document.hidden) frame = requestAnimationFrame(tick);
  }
  document.addEventListener('keydown', event => {
    if (event.key.toLowerCase() !== 'p' || event.repeat || event.defaultPrevented || event.isComposing ||
        event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, textarea, select, [contenteditable]')) return;
    paused = !paused;
    try { localStorage.setItem('ll-motion', paused ? 'paused' : 'on'); } catch { /* Storage is optional. */ }
    refresh();
  });
  function localPoint(event) {
    const box = canvas.getBoundingClientRect();
    return {x: event.clientX - box.left, y: event.clientY - box.top};
  }
  hero.addEventListener('pointermove', event => {
    if (!paused && !reduced.matches && event.pointerType !== 'touch') pointer = localPoint(event);
  }, {passive: true});
  hero.addEventListener('pointerleave', () => { pointer = null; });
  hero.addEventListener('click', event => {
    if (paused || !event.detail || event.target.closest('a, button, input, select, textarea, summary') || getSelection()?.toString()) return;
    const point = localPoint(event);
    ripple(point.x, point.y);
  });
  function fit() {
    resize(canvas.clientWidth < 650 || navigator.connection?.saveData);
    draw(elapsed, 0, pointer);
    refresh();
  }
  fit();
  new ResizeObserver(fit).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    refresh();
  }).observe(hero);
  new MutationObserver(refresh).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  reduced.addEventListener('change', refresh);
  document.addEventListener('visibilitychange', refresh);
})();
