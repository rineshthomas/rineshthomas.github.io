(() => {
  'use strict';

  const element = id => document.getElementById(id);
  const canvas = element('world');
  const ctx = canvas.getContext('2d', {alpha: true});
  if (!ctx) return;

  const atlas = element('flightAtlas');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sections = [...document.querySelectorAll('[data-zone]')];
  const interactive = 'a, button, input, select, textarea, label, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="textbox"]';
  const editing = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';
  const layoutElements = 'h1, h2, h3, main p, main strong, main label, main input, main textarea, main select, main a, main button, main summary, .site-header, .site-footer';
  const tau = Math.PI * 2;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // Cell order matches the illustrated atlas. Sizes are logical desktop pixels.
  const art = {
    crystal: {cell: 0, size: 45, color: '#74ffec', points: 10},
    firefly: {cell: 1, size: 45, color: '#ffd479', points: 25},
    pod:     {cell: 2, size: 65, color: '#95e4c5'},
    meteor:  {cell: 3, size: 73, color: '#ff9a65'},
    relay:   {cell: 4, size: 52, color: '#d5aeff', points: 25},
    core:    {cell: 5, size: 43, color: '#ffe18b', points: 30},
    mine:    {cell: 6, size: 50, color: '#ff926e'},
    gate:    {cell: 7, size: 83, color: '#a6ffdb', points: 75},
    ship:    {cell: 8, size: 62, color: '#96ecff'}
  };
  const chapters = [
    {name: 'Portal approach', goal: 'Gather crystals and catch the clockwork fireflies.', items: ['crystal','firefly','crystal','crystal','firefly','crystal']},
    {name: 'The build field', goal: 'Pulse open the salvage pods and catch their cargo.', items: ['pod','core','pod','crystal','pod','firefly','mine']},
    {name: 'The neural grove', goal: 'Follow the lit relay to complete the constellation.', items: ['relay','relay','relay','relay','relay','mine']},
    {name: 'Orbital passage', goal: 'Break the meteors, gather their shards and dodge the mines.', items: ['meteor','crystal','meteor','firefly','meteor','mine','mine']},
    {name: 'Home beacon', goal: 'Gather three star cores and fly through the open gate.', items: ['core','core','core','gate','mine']}
  ];
  const anchorSets = [
    [[.75,.3],[.88,.52],[.61,.65],[.87,.77],[.47,.81],[.54,.4]],
    [[.18,.34],[.46,.25],[.73,.42],[.32,.8],[.76,.77],[.1,.66],[.53,.61]],
    [[.18,.72],[.32,.31],[.51,.55],[.7,.29],[.85,.67],[.48,.83]],
    [[.15,.41],[.35,.25],[.64,.32],[.84,.73],[.47,.81],[.73,.56],[.26,.65]],
    [[.21,.33],[.48,.73],[.83,.32],[.74,.63],[.32,.54]]
  ];
  function makeScenes() {
    return chapters.map((chapter, zone) => ({
      targets: chapter.items.map((kind, i) => ({
        id: i, zone, kind, anchor: [...anchorSets[zone][i]], phase: (i + 1) * 2.4 + zone,
        x: 0, y: 0, taken: false, cooldown: 0
      })),
      zone, placed: false, complete: false
    }));
  }

  function preference(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function savePreference(key, value) {
    try { localStorage.setItem(key, value); } catch { /* File and private browsing. */ }
  }
  const motionPreference = preference('ll-motion');
  const state = {
    zone: 0, position: 0, score: 0, pulses: 0, bumps: 0, frames: 0,
    paused: motionPreference === 'paused', suspended: false,
    quality: preference('ll-quality') || 'auto', time: 0
  };
  let scenes = makeScenes();
  let encounters = [scenes[0]], encounterTargets = scenes[0].targets;
  let destinationPosition = 0, lastJourneyFrame = 0, journeyReady = false;
  let width = innerWidth, height = innerHeight, scale = 1, dpr = 1;
  const ship = {x: width * .79, y: height * .54, vx: 0, vy: 0, angle: -.22};
  const keys = new Set();
  let destination = null, tapPulse = false, playing = false;
  let uiOpen = false, editingFocus = false, layoutDirty = true, placeDirty = true;
  let raf = 0, lastFrame = 0, accumulator = 0, lastPulse = -Infinity, shield = 0;
  let lastTrail = 0, trail = [], rings = [], sparks = [], labels = [];
  const scene = () => scenes[state.zone];
  const lowPower = () => state.quality === 'low' || (state.quality === 'auto' && (width < 650 || navigator.connection?.saveData || navigator.hardwareConcurrency <= 4));
  const canFly = () => !state.paused && !state.suspended && !document.hidden;
  const radius = target => art[target.kind].size * scale * .36;
  const weight = zone => Math.max(0, 1 - Math.abs(state.position - zone));
  const inPlay = target => weight(target.zone) >= .12 && !target.occluded;
  const goalTargets = zone => scenes[zone].targets.filter(t => t.kind !== 'mine');
  const nextRelay = zone => scenes[zone].targets.find(t => t.kind === 'relay' && !t.taken);
  const gateOpen = zone => scenes[zone].targets.every(t => t.kind !== 'core' || t.taken);

  function activate() {
    if (!canFly()) return false;
    playing = true;
    request();
    return true;
  }
  function clearInput() {
    keys.clear();
    destination = null;
    tapPulse = false;
    ship.vx = ship.vy = 0;
    playing = false;
    trail = [];
  }
  function syncSuspension() {
    const wasSuspended = state.suspended;
    editingFocus = !!document.activeElement?.closest(editing);
    state.suspended = editingFocus || uiOpen || document.hidden;
    if (state.suspended) clearInput();
    if (wasSuspended !== state.suspended) lastFrame = accumulator = 0;
    request();
  }
  function pause(paused) {
    state.paused = paused;
    savePreference('ll-motion', paused ? 'paused' : 'on');
    clearInput();
    request();
  }

  const visibleRects = selector => [...document.querySelectorAll(selector)]
    .map(node => node.getBoundingClientRect())
    .filter(box => box.width && box.height && box.bottom > 0 && box.top < height);
  const controlRects = () => visibleRects(interactive + ', .site-header');
  const meetsControl = (x, y, padX, padY, boxes) => boxes.some(box =>
    x >= box.left - padX && x <= box.right + padX && y >= box.top - padY && y <= box.bottom + padY);

  function driftExtent(kind) {
    if (kind === 'firefly' || kind === 'mine') return [Math.min(width * .06, 70), 21 * scale];
    return [(kind === 'meteor' ? 23 : 4) * scale, (kind === 'gate' ? 3 : 8) * scale];
  }

  // Give touch targets room for their whole flight path and the browser's
  // fingertip hit adjustment. Keep the other objects still after a scroll.
  function placeTargets(encounter) {
    const boxes = window.logicReadingSpace?.rects() || visibleRects(layoutElements);
    const controls = controlRects();
    const previous = [];
    for (const target of encounter.targets) {
      if (target.taken) continue;
      const {kind} = target;
      const [driftX, driftY] = target.drop || reducedMotion.matches ? [0, 0] : driftExtent(kind);
      const padX = driftX + 26, padY = driftY + 26;
      const [currentX, currentY] = target.goal || target.anchor;
      const padding = art[kind].size * scale * .52;
      if (!placeDirty && encounter.placed && !meetsControl(currentX * width, currentY * height, padX, padY, controls) &&
          !meetsControl(currentX * width, currentY * height, driftX + padding, driftY + padding, boxes)) {
        previous.push({x: currentX * width, y: currentY * height});
        continue;
      }
      const [u, v] = target.drop ? target.anchor : anchorSets[encounter.zone][target.id];
      let bestCost = Infinity, foundClear = false;
      function consider(x, y, offset) {
        x = clamp(x, padding, width - padding);
        y = clamp(y, padding, height - padding);
        const blocked = meetsControl(x, y, padX, padY, controls);
        if (blocked && foundClear) return;
        const overlap = boxes.reduce((area, box) => area +
          Math.max(0, Math.min(x + padding, box.right) - Math.max(x - padding, box.left)) *
          Math.max(0, Math.min(y + padding, box.bottom) - Math.max(y - padding, box.top)), 0);
        const crowd = previous.some(p => Math.hypot(p.x - x, p.y - y) < padding * 2.7);
        const touchesCopy = meetsControl(x, y, driftX + padding, driftY + padding, boxes);
        const cost = (touchesCopy ? 25 : 0) + overlap / (padding * padding) + (crowd ? 5 : 0) + offset;
        if ((!blocked && !foundClear) || cost < bestCost) {
          target.goal = [x / width, y / height];
          bestCost = cost;
          foundClear = !blocked;
        }
      }
      for (let i = 0; i < 23; i++) {
        const angle = i * 2.4 + target.phase, spread = Math.sqrt(i) * .047;
        consider(clamp(u + Math.cos(angle) * spread, .065, .935) * width,
          clamp(v + Math.sin(angle) * spread, .12, .92) * height, i * .024);
        if (foundClear && !bestCost) break;
      }
      if (!foundClear || bestCost >= 25) {
        // Compact form layouts can fill the original spawn area. Look for the
        // nearest clear lane across the viewport before accepting an overlap.
        for (let x = padding; x <= width - padding; x += 24) {
          for (let y = padding; y <= height - padding; y += 32) {
            if (!meetsControl(x, y, padX, padY, controls) &&
                !meetsControl(x, y, driftX + padding, driftY + padding, boxes))
              consider(x, y, Math.hypot(x / width - u, y / height - v) * 12);
          }
        }
      }
      if (!encounter.placed || reducedMotion.matches) target.anchor = [...target.goal];
      previous.push({x: target.goal[0] * width, y: target.goal[1] * height});
    }
    encounter.placed = true;
  }
  function positionTargets(dt = 0) {
    const t = reducedMotion.matches ? 0 : state.time;
    const reading = window.logicReadingSpace?.rects();
    for (const target of encounterTargets) {
      const {kind, anchor, phase, goal} = target;
      // Reflow chooses a destination. Glide there from the point that was drawn
      // in the last frame, including when a disclosure or the browser resizes.
      if (goal && dt > 0 && !reducedMotion.matches) {
        const dx = (goal[0] - anchor[0]) * width, dy = (goal[1] - anchor[1]) * height;
        const fraction = Math.min(1 - Math.exp(-dt * 3), (310 * dt) / Math.max(1, Math.hypot(dx, dy)));
        anchor[0] += (goal[0] - anchor[0]) * fraction;
        anchor[1] += (goal[1] - anchor[1]) * fraction;
      }
      let x = anchor[0] * width, y = anchor[1] * height;
      if (!reducedMotion.matches && !target.drop && !target.taken) {
        if (kind === 'firefly' || kind === 'mine') {
          const speed = kind === 'firefly' ? .76 : .53;
          x += Math.sin(t * speed + phase) * Math.min(width * .06, 70);
          y += Math.sin(t * speed * 2 + phase) * 21 * scale;
        } else {
          x += Math.sin(t * .43 + phase) * (kind === 'meteor' ? 23 : 4) * scale;
          y += Math.sin(t * .78 + phase) * (kind === 'gate' ? 3 : 8) * scale;
        }
      }
      const pad = radius(target) + 2;
      target.x = clamp(x, pad, width - pad);
      target.y = clamp(y, pad, height - pad);
      target.occluded = reading && meetsControl(target.x, target.y, 0, 0, reading);
    }
  }
  let checkTouchClearance = false;
  function reflow() {
    layoutDirty = false;
    // The approach starts as the next section enters the viewport. By the
    // time its title reaches the sticky header the new environment is in view.
    destinationPosition = 0;
    let previousLanding = 0;
    const lastScroll = Math.max(0, document.documentElement.scrollHeight - height);
    for (let i = 1; i < sections.length; i++) {
      const top = sections[i].getBoundingClientRect().top;
      const landing = clamp(top + scrollY - clamp(height * .18, 120, 180), 0, lastScroll);
      const span = landing - previousLanding;
      const approach = Math.max(0, landing - height * .72,
        previousLanding + Math.min(height * .2, span * .3));
      const progress = clamp((scrollY - approach) / Math.max(1, landing - approach), 0, 1);
      destinationPosition += progress * progress * (3 - 2 * progress);
      previousLanding = landing;
    }
    for (const encounter of encounters) {
      if (placeDirty || checkTouchClearance) placeTargets(encounter);
    }
    placeDirty = checkTouchClearance = false;
  }
  function updateJourney(now) {
    const elapsed = Math.min(.08, (now - lastJourneyFrame) / 1000);
    lastJourneyFrame = now;
    const difference = destinationPosition - state.position;
    if (journeyReady && !difference) return;
    if (!journeyReady || reducedMotion.matches || Math.abs(difference) < .001) {
      state.position = destinationPosition;
    } else {
      // Smooth large wheel, scrollbar and anchor jumps through intermediate
      // encounters without adding a time-based animation to ordinary scrolling.
      const change = Math.min(Math.abs(difference) * (1 - Math.exp(-elapsed * 11)), elapsed * 4.5);
      state.position += Math.sign(difference) * change;
    }
    journeyReady = true;
    const previous = encounters;
    encounters = scenes.filter(encounter => weight(encounter.zone) > 0);
    for (const encounter of encounters) {
      if (!previous.includes(encounter)) encounter.placed = false;
      if (!encounter.placed) placeTargets(encounter);
    }
    encounterTargets = encounters.flatMap(encounter => encounter.targets);
    if (destination?.target && !weight(destination.target.zone)) destination.target = null;
    const zone = Math.round(state.position);
    if (zone !== state.zone) {
      state.zone = zone;
      document.body.dataset.zone = String(zone);
      document.dispatchEvent(new CustomEvent('worldzonechange', {detail: {zone, name: chapters[zone].name}}));
    }
    document.dispatchEvent(new CustomEvent('worldjourney', {detail: {position: state.position}}));
  }
  function resize() {
    const oldWidth = width, oldHeight = height;
    width = innerWidth; height = innerHeight;
    scale = width < 650 ? .75 : 1;
    dpr = Math.min(devicePixelRatio || 1, lowPower() ? 1.25 : 1.75);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ship.x *= width / oldWidth; ship.y *= height / oldHeight;
    if (destination) { destination.x *= width / oldWidth; destination.y *= height / oldHeight; }
    trail = [];
    layoutDirty = placeDirty = true;
    request();
  }

  function burst(x, y, color, count) {
    if (reducedMotion.matches) return;
    for (let i = 0; i < count && sparks.length < 70; i++) {
      const angle = tau * i / count + state.time, speed = 24 + (i % 4) * 21;
      sparks.push({x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, color});
    }
  }
  function collect(target) {
    if (target.taken) return;
    const value = art[target.kind].points;
    if (!value || (target.kind === 'relay' && target !== nextRelay(target.zone)) || (target.kind === 'gate' && !gateOpen(target.zone))) return;
    // Keep collected objects at the actual pickup point. Relays remain drawn
    // there, and pausing immediately after a pickup must freeze that frame.
    target.taken = true;
    target.goal = null;
    target.anchor = [target.x / width, target.y / height];
    state.score += value;
    burst(target.x, target.y, art[target.kind].color, 12);
    labels.push({x: target.x, y: target.y, age: 0, text: '+' + value, color: art[target.kind].color});
    if (goalTargets(target.zone).every(t => t.taken)) {
      scenes[target.zone].complete = true;
      element('gameAnnouncer').textContent = chapters[target.zone].name + ' complete. Flight score ' + state.score + '.';
    }
  }
  function releaseCargo(target) {
    target.taken = true;
    const loot = target.kind === 'meteor' ? ['crystal', 'crystal'] : ['core'];
    const controls = controlRects();
    const copy = window.logicReadingSpace?.rects() || visibleRects(layoutElements);
    const encounter = scenes[target.zone];
    loot.forEach((kind, i) => {
      const phase = target.phase + (i ? 2.6 : 0);
      let x = target.x, y = target.y;
      // Browsers also activate controls slightly outside their visual hit boxes
      // on touch. Give the loot enough clearance for an ordinary fingertip tap.
      for (let j = 0; j < 16; j++) {
        const angle = phase + j * 2.4;
        const reach = ((target.kind === 'meteor' ? 39 : 27) + j * 2) * scale;
        const nextX = clamp(target.x + Math.cos(angle) * reach, 22, width - 22);
        const nextY = clamp(target.y + Math.sin(angle) * reach, 22, height - 22);
        const nearControl = meetsControl(nextX, nextY, 26, 26, controls);
        if (!nearControl && !meetsControl(nextX, nextY, 20 * scale, 20 * scale, copy)) { x = nextX; y = nextY; break; }
      }
      encounter.targets.push({id: encounter.targets.length, zone: target.zone, kind, anchor: [x / width, y / height],
        phase, x, y, drop: true, taken: false, cooldown: 0});
    });
    encounterTargets = encounters.flatMap(encounter => encounter.targets);
    burst(target.x, target.y, art[target.kind].color, 16);
  }
  function pulse() {
    const now = performance.now();
    if (!canFly() || now - lastPulse < 420) return false;
    lastPulse = now;
    state.pulses++;
    const reach = Math.max(86, 135 * scale);
    rings.push({x: ship.x, y: ship.y, reach, age: 0});
    for (const target of encounterTargets) {
      if (!inPlay(target) || target.taken || distance(ship, target) > reach + radius(target)) continue;
      if (target.kind === 'pod' || target.kind === 'meteor') releaseCargo(target);
      if (target.kind === 'mine') {
        target.cooldown = 2.2;
        burst(target.x, target.y, '#9dcaff', 8);
      }
    }
    request();
    return true;
  }
  function bump(target) {
    const angle = Math.atan2(ship.y - target.y, ship.x - target.x);
    const gap = radius(target) + 22 * scale;
    ship.x = clamp(target.x + Math.cos(angle) * gap, 6, width - 6);
    ship.y = clamp(target.y + Math.sin(angle) * gap, 6, height - 6);
    ship.vx = 160 * Math.cos(angle); ship.vy = 160 * Math.sin(angle);
    shield = .85;
    state.bumps++;
    burst(ship.x, ship.y, '#9edfff', 9);
  }
  function moveShip(dt) {
    let x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
    let y = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    const speed = clamp(Math.max(width, height) * .98, 660, 1550);
    // A tap on a moving object follows that object to its current position.
    // Hold the last position once it has been collected or the player steers away.
    if (destination?.target && !destination.target.taken) {
      destination.x = destination.target.x;
      destination.y = destination.target.y;
    }
    if (x || y) {
      const mag = Math.hypot(x, y);
      x *= speed * .66 / mag; y *= speed * .66 / mag;
    } else if (destination) {
      const dx = destination.x - ship.x, dy = destination.y - ship.y;
      const gain = Math.min(7, speed / Math.max(1, Math.hypot(dx, dy)));
      x = dx * gain; y = dy * gain;
    }
    const ease = 1 - Math.exp(-dt * 15);
    ship.vx += (x - ship.vx) * ease;
    ship.vy += (y - ship.vy) * ease;
    ship.x = clamp(ship.x + ship.vx * dt, 6, width - 6);
    ship.y = clamp(ship.y + ship.vy * dt, 6, height - 6);
    if (Math.hypot(ship.vx, ship.vy) > 8) {
      const turn = Math.atan2(ship.vy, ship.vx) - ship.angle;
      ship.angle += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-dt * 14));
      if (!reducedMotion.matches && state.time - lastTrail > .034) {
        trail.push({x: ship.x, y: ship.y, age: 0});
        lastTrail = state.time;
      }
    }
    if (tapPulse && destination && distance(ship, destination) < 48 * scale && pulse()) tapPulse = false;
  }
  function step(dt) {
    state.time += dt;
    positionTargets(dt);
    shield = Math.max(0, shield - dt);
    for (const target of encounterTargets) target.cooldown = Math.max(0, target.cooldown - dt);
    if (playing) {
      moveShip(dt);
      for (const target of encounterTargets) {
        if (!inPlay(target) || target.taken || distance(ship, target) > radius(target) + 11 * scale) continue;
        if (target.kind === 'mine') {
          if (!shield && !target.cooldown) bump(target);
        } else if (target.kind === 'pod' || target.kind === 'meteor') {
          if (!shield) bump(target);
        } else collect(target);
      }
    }
    for (const p of sparks) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (const items of [rings, labels, trail]) for (const item of items) item.age += dt;
    sparks = sparks.filter(p => p.age < .55);
    rings = rings.filter(r => r.age < .44);
    labels = labels.filter(label => label.age < .75);
    trail = trail.filter(p => p.age < .22);
  }

  function sprite(kind, x, y, angle = 0, opacity = 1) {
    const {cell, size} = art[kind], side = size * scale;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = opacity;
    if (atlas.complete && atlas.naturalWidth) {
      const cellSize = atlas.naturalWidth / 3;
      ctx.drawImage(atlas, (cell % 3) * cellSize, Math.floor(cell / 3) * cellSize,
        cellSize, cellSize, -side / 2, -side / 2, side, side);
    } else {
      ctx.fillStyle = art[kind].color;
      ctx.beginPath(); ctx.moveTo(side * .3, 0); ctx.lineTo(-side * .2, side * .2);
      ctx.lineTo(-side * .2, -side * .2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function circle(x, y, radius, color, alpha = 1, lineWidth = 1.5) {
    ctx.save();
    ctx.globalAlpha = alpha; ctx.lineWidth = lineWidth; ctx.strokeStyle = color;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, tau); ctx.stroke(); ctx.restore();
  }
  function drawEncounter(encounter) {
    const visibility = weight(encounter.zone);
    const t = reducedMotion.matches ? 0 : state.time;
    const relay = nextRelay(encounter.zone);
    if (encounter.zone === 2) {
      const nodes = encounter.targets.filter(target => target.kind === 'relay');
      ctx.save();
      ctx.beginPath();
      for (const node of nodes) {
        ctx.lineTo(node.x, node.y);
        if (!node.taken) break;
      }
      ctx.globalAlpha = visibility; ctx.setLineDash([3, 7]); ctx.strokeStyle = '#cdaaffaa'; ctx.lineWidth = 1.5;
      ctx.stroke(); ctx.restore();
    }
    for (const target of encounter.targets) {
      const {kind, x, y, phase, taken, cooldown} = target;
      if (taken && kind !== 'relay' && kind !== 'gate') continue;
      let alpha = .96, angle = Math.sin(t * .7 + phase) * .09;
      if (kind === 'relay') {
        alpha = target === relay ? 1 : taken ? .75 : .32;
        if (target === relay) circle(x, y, radius(target) + 5 + Math.sin(t * 2) * 2, art.relay.color, .8 * visibility);
      } else if (kind === 'gate') {
        alpha = gateOpen(encounter.zone) ? 1 : .48;
        if (gateOpen(encounter.zone)) circle(x, y, radius(target) + 6, art.gate.color, .65 * visibility);
      } else if (kind === 'mine' || kind === 'meteor') {
        angle = Math.sin(t * .42 + phase) * .36;
        if (cooldown) alpha = .25;
      } else if (kind === 'firefly') angle = Math.sin(t * 1.7 + phase) * .25;
      sprite(kind, x, y, angle, alpha * visibility);
    }
  }
  function drawWorld() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (const encounter of encounters) drawEncounter(encounter);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      ctx.globalAlpha = Math.max(0, 1 - a.age / .22) * .5;
      ctx.strokeStyle = '#72e7ff'; ctx.lineWidth = 3 * scale;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
    for (const r of rings) {
      const progress = r.age / .44;
      circle(r.x, r.y, reducedMotion.matches ? 22 : 8 + (r.reach - 8) * progress,
        '#a6f9ff', 1 - progress, 2);
    }
    for (const p of sparks) {
      ctx.globalAlpha = 1 - p.age / .55; ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 2.5 * scale, 2.5 * scale);
    }
    ctx.globalAlpha = 1;
    sprite('ship', ship.x, ship.y, ship.angle);
    if (shield) circle(ship.x, ship.y, 25 * scale, '#c0ecff', shield / .85);
    ctx.font = '600 14px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3;
    for (const label of labels) {
      const y = label.y - 16 - (reducedMotion.matches ? 0 : 22 * label.age);
      ctx.globalAlpha = 1 - label.age / .75;
      ctx.strokeStyle = '#102035'; ctx.fillStyle = label.color;
      ctx.strokeText(label.text, label.x, y); ctx.fillText(label.text, label.x, y);
    }
    ctx.globalAlpha = 1;
    window.logicReadingSpace?.clear(ctx);
  }
  function frame(now) {
    raf = 0;
    const layoutChanged = layoutDirty;
    if (layoutChanged) reflow();
    updateJourney(now);
    positionTargets();
    if (!canFly()) {
      lastFrame = accumulator = 0;
      drawWorld();
      if (state.position !== destinationPosition) request();
      return;
    }
    const interval = 1000 / (playing ? (lowPower() ? 30 : 60) : 24);
    if (lastFrame && now - lastFrame < interval - 1) {
      if (layoutChanged) drawWorld();
      request(); return;
    }
    accumulator += lastFrame ? Math.min((now - lastFrame) / 1000, .08) : 0;
    lastFrame = now;
    while (accumulator >= 1 / 60) { step(1 / 60); accumulator -= 1 / 60; }
    drawWorld(); state.frames++;
    const travelling = destination && distance(ship, destination) > 2;
    if (reducedMotion.matches && !travelling && !tapPulse && !keys.size && Math.hypot(ship.vx, ship.vy) < 2 &&
        !rings.length && !labels.length && !shield && !encounterTargets.some(target => target.cooldown > 0)) {
      lastFrame = accumulator = 0;
      return;
    }
    request();
  }
  function request() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }

  function steerTo(x, y, onArrival = false) {
    if (!activate()) return;
    destination = {x: clamp(x, 6, width - 6), y: clamp(y, 6, height - 6)};
    if (onArrival) {
      destination.target = encounterTargets.findLast(target =>
        inPlay(target) && !target.taken && distance(destination, target) <= art[target.kind].size * scale / 2);
    }
    tapPulse = onArrival;
  }
  // Pointer movement is independent of DOM hit-testing, including over links
  // and form controls. Clicks and keyboard input still belong to native widgets.
  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || event.buttons || event.target.closest('#mobileNav')) return;
    steerTo(event.clientX, event.clientY);
  }, {passive: true});
  let lastPointerType = '';
  document.addEventListener('pointerdown', event => { lastPointerType = event.pointerType; }, {passive: true});
  document.addEventListener('click', event => {
    if (!event.detail || event.defaultPrevented || event.target.closest(interactive) || getSelection()?.toString()) return;
    const touch = (event.pointerType || lastPointerType) === 'touch' || event.sourceCapabilities?.firesTouchEvents;
    // A returning touch player can resume a saved pause by tapping the playfield.
    if (touch && state.paused && !state.suspended) pause(false);
    steerTo(event.clientX, event.clientY, touch);
    if (!touch) pulse();
  });
  const flightKeys = new Set(['a','s','d','w','arrowup','arrowdown','arrowleft','arrowright',' ']);
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey ||
        event.target.closest(editing) || uiOpen) return;
    const key = event.key.toLowerCase();
    if (key === 'p' && !event.repeat) { pause(!state.paused); return; }
    // Leave native Space activation on focused links, buttons and disclosures.
    if (!flightKeys.has(key) || (event.target.closest(interactive) && key === ' ')) return;
    if (!activate()) return;
    event.preventDefault();
    if (key === ' ') { if (!event.repeat) pulse(); }
    else { destination = null; tapPulse = false; keys.add(key); }
  });
  document.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  document.addEventListener('focusin', syncSuspension);
  document.addEventListener('focusout', () => queueMicrotask(syncSuspension));
  document.addEventListener('visibilitychange', syncSuspension);
  addEventListener('blur', clearInput);
  function checkLayout() { checkTouchClearance = layoutDirty = true; request(); }
  let scrollTimer;
  addEventListener('scroll', () => {
    layoutDirty = true;
    request();
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(checkLayout, 100);
  }, {passive: true});
  addEventListener('resize', resize, {passive: true});
  document.addEventListener('worldlayoutchange', checkLayout);
  document.addEventListener('worldreadingspacechange', checkLayout);
  document.addEventListener('worldlock', event => { uiOpen = event.detail; syncSuspension(); });
  reducedMotion.addEventListener('change', () => { clearInput(); request(); });
  const observer = new ResizeObserver(checkLayout);
  sections.forEach(section => observer.observe(section));
  atlas.addEventListener('load', request);
  document.fonts?.ready.then(() => { layoutDirty = placeDirty = true; request(); });

  Object.defineProperty(window, 'logicWorld', {value: Object.freeze({
    snapshot: () => ({
      zone: state.zone, position: state.position,
      encounters: encounters.map(({zone}) => ({zone, weight: weight(zone)})),
      name: chapters[state.zone].name, mode: state.paused ? 'paused' : state.suspended ? 'suspended' : 'pilot',
      score: state.score, pilot: canFly(), paused: state.paused, suspended: state.suspended,
      frames: state.frames, pulses: state.pulses, bumps: state.bumps, complete: scene().complete,
      ship: {x: ship.x, y: ship.y}, dpr, rafScheduled: !!raf,
      targets: scene().targets.map(t => ({id: t.id, kind: t.kind, x: t.x, y: t.y, collected: t.taken, cooldown: t.cooldown})),
      collected: scenes.map(s => s.targets.filter(t => t.taken).length)
    })
  })});
  document.body.dataset.zone = '0';
  resize();
})();
