// Open Game Standards — site behaviour. No dependencies.
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Theme toggle -------------------------------------------------------
  const root = document.documentElement;
  const toggle = document.querySelector(".theme-toggle");
  const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
  const currentTheme = () => root.dataset.theme || (systemDark() ? "dark" : "light");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("ogs-theme", next); } catch (e) { /* storage unavailable */ }
    });
  }

  // ---- Starting-point chooser (ARIA tabs) ----------------------------------
  const tabs = Array.from(document.querySelectorAll('.chooser-tabs [role="tab"]'));
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  };
  if (tabs.length) {
    select(tabs[0], false);
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab, false));
      tab.addEventListener("keydown", (e) => {
        const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        if (e.key in keys) { e.preventDefault(); select(tabs[(i + keys[e.key] + tabs.length) % tabs.length], true); }
        else if (e.key === "Home") { e.preventDefault(); select(tabs[0], true); }
        else if (e.key === "End") { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      });
    });
  }

  // ---- Copy buttons on code blocks -----------------------------------------
  document.querySelectorAll("pre.code").forEach((pre) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pre.querySelector("code").innerText);
        btn.textContent = "Copied";
      } catch (e) {
        btn.textContent = "Select and copy";
      }
      setTimeout(() => { btn.textContent = "Copy"; }, 1600);
    });
    pre.appendChild(btn);
  });

  // ---- Console: a small OGS-TS Monitor --------------------------------------
  // Simulated, not decoded: the same demo car the OGS-TS Monitor's built-in
  // demo sender publishes (same motion model, names and channels), drawn the
  // way the app draws it: chase-view body axes, top-down track, strips, log.
  const log = document.querySelector(".console .log");
  const attG = document.querySelector(".console svg.attitude g");
  const trackG = document.querySelector(".console svg.track g");
  const ro = {};
  document.querySelectorAll("[data-ro]").forEach((el) => { ro[el.dataset.ro] = el; });
  const lines = {};
  document.querySelectorAll(".strip polyline").forEach((el) => { lines[el.getAttribute("class")] = el; });
  if (!log || !attG || !trackG) return;

  const G = 9.80665, D2R = Math.PI / 180;
  const model = {
    speed: (t) => 32 + 10 * Math.sin(t / 3.1),
    yaw: (t) => 0.6 * Math.sin(t / 4.0) + t * 0.05,          // rad, right +
    pitch: (t) => 0.07 * Math.sin(t / 2.3),                  // rad, nose up +
    roll: (t) => 0.13 * Math.sin(t / 1.9),                   // rad, right side down +
    heave: (t) => (G + 0.8 * Math.sin(t * 5.3)) / G,         // g, specific force y
    rpm: (t) => 2200 + 5800 * (0.5 + 0.5 * Math.sin(t * 1.7)),
  };

  // 3x3 rotations (right-hand rule, as System.Numerics), row-major
  const rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  const mul = (a, b) => {
    const r = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  };
  const apply = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const CAM = mul(rx(-24 * D2R), ry(-55 * D2R));             // the app's chase camera
  const HALF = [0.55, 0.24, 1.0], GROUND = -0.75, SCALE = 50, CX = 100, CY = 82;
  const proj = (v) => { const p = apply(CAM, v); return [CX + p[0] * SCALE, CY - p[1] * SCALE, p[2]]; };
  const pts = (arr) => arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  // static ground grid
  let grid = "";
  for (let i = -4; i <= 4; i++) {
    const t = i * 0.5;
    const a = proj([t, GROUND, -2]), b = proj([t, GROUND, 2]), c = proj([-2, GROUND, t]), d = proj([2, GROUND, t]);
    grid += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><line x1="${c[0]}" y1="${c[1]}" x2="${d[0]}" y2="${d[1]}"/>`;
  }
  grid = `<g stroke="rgba(140,170,150,.28)" stroke-width="1">${grid}</g>`;

  const hull = (p) => {
    p = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const h = [];
    for (const pass of [p, p.slice().reverse()]) {
      const start = h.length;
      for (const q of pass) {
        while (h.length >= start + 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
        h.push(q);
      }
      h.pop();
    }
    return h;
  };

  const FACES = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 2, 6, 4], [1, 5, 7, 3], [0, 4, 5, 1], [2, 3, 7, 6]];
  const FILL = ["rgba(76,122,42,.82)", "rgba(245,215,110,.86)", "rgba(76,122,42,.82)", "rgba(76,122,42,.82)", "rgba(49,79,27,.9)", "rgba(148,181,121,.9)"];

  const drawAttitude = (pitch, roll) => {
    const r = mul(rx(-pitch), rz(-roll));                     // chase: heading removed
    const corners = [];
    for (let i = 0; i < 8; i++)
      corners.push(apply(r, [i & 1 ? HALF[0] : -HALF[0], i & 2 ? HALF[1] : -HALF[1], i & 4 ? HALF[2] : -HALF[2]]));
    const shadow = hull(corners.map((c) => proj([c[0], GROUND, c[2]])));
    const p = corners.map(proj);
    const faces = FACES.map((f, i) => ({ f, i, depth: f.reduce((s, k) => s + p[k][2], 0) / 4 }))
      .sort((a, b) => b.depth - a.depth)
      .map(({ f, i }) => `<polygon points="${pts(f.map((k) => p[k]))}" fill="${FILL[i]}" stroke="rgba(230,240,225,.9)" stroke-width="1" stroke-linejoin="round"/>`)
      .join("");
    const o = proj([0, 0, 0]);
    const axis = (v, color, label) => {
      const e = proj(apply(r, v));
      return `<line x1="${o[0]}" y1="${o[1]}" x2="${e[0].toFixed(1)}" y2="${e[1].toFixed(1)}" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>` +
        `<circle cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="2.4" fill="${color}"/>` +
        `<text x="${(e[0] + 4).toFixed(1)}" y="${(e[1] + 3).toFixed(1)}" fill="${color}" font-size="9" font-family="ui-monospace, monospace">${label}</text>`;
    };
    attG.innerHTML = grid + `<polygon points="${pts(shadow)}" fill="rgba(0,0,0,.3)"/>` + faces +
      axis([1.15, 0, 0], "#e06c5a", "x right") + axis([0, 0.95, 0], "#86b65a", "y up") + axis([0, 0, 1.65], "#5aa0e0", "z fwd");
  };

  // history: 30 s at 10 Hz for the track and strips
  const HIST = 300, STEP = 0.1;
  const hist = [];
  let x = 0, z = 0, simT = 0;
  const advance = (t) => {
    while (simT + STEP <= t) {
      simT += STEP;
      const v = model.speed(simT), yaw = model.yaw(simT);
      x += Math.sin(yaw) * v * STEP;
      z += Math.cos(yaw) * v * STEP;
      hist.push({ x, z, yaw, roll: model.roll(simT) / D2R, pitch: model.pitch(simT) / D2R, heave: model.heave(simT) });
      if (hist.length > HIST) hist.shift();
    }
  };

  const drawTrack = () => {
    if (hist.length < 2) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const h of hist) { minX = Math.min(minX, h.x); maxX = Math.max(maxX, h.x); minZ = Math.min(minZ, h.z); maxZ = Math.max(maxZ, h.z); }
    const span = Math.max(20, Math.max(maxX - minX, maxZ - minZ) * 1.15);
    const mx = (minX + maxX) / 2, mz = (minZ + maxZ) / 2, k = 140 / span;
    const map = (h) => [100 + (h.x - mx) * k, 75 - (h.z - mz) * k];
    let svg = "";
    const step = [1, 2, 5, 10, 20, 50, 100, 200, 500].find((s) => s >= span / 5) || 1000;
    for (let gx = Math.floor((mx - span) / step) * step; gx <= mx + span; gx += step) {
      const a = map({ x: gx, z: mz - span }), b = map({ x: gx, z: mz + span });
      svg += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"/>`;
    }
    for (let gz = Math.floor((mz - span) / step) * step; gz <= mz + span; gz += step) {
      const a = map({ x: mx - span, z: gz }), b = map({ x: mx + span, z: gz });
      svg += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"/>`;
    }
    svg = `<g stroke="rgba(140,170,150,.22)" stroke-width="1">${svg}</g>`;
    const CH = 6;
    for (let c = 0; c < CH; c++) {
      const from = Math.floor(c * (hist.length - 1) / CH), to = Math.floor((c + 1) * (hist.length - 1) / CH);
      svg += `<polyline points="${pts(hist.slice(from, to + 1).map(map))}" fill="none" stroke="#86b65a" stroke-opacity="${(0.25 + 0.75 * (c + 1) / CH).toFixed(2)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    const s0 = map(hist[0]);
    svg += `<circle cx="${s0[0].toFixed(1)}" cy="${s0[1].toFixed(1)}" r="2.5" fill="none" stroke="rgba(190,210,185,.7)"/>`;
    const last = hist[hist.length - 1], n = map(last);
    const f = [Math.sin(last.yaw), -Math.cos(last.yaw)], sd = [-f[1], f[0]];
    const arrow = [[n[0] + f[0] * 9, n[1] + f[1] * 9], [n[0] - f[0] * 5 + sd[0] * 5, n[1] - f[1] * 5 + sd[1] * 5],
                   [n[0] - f[0] * 2, n[1] - f[1] * 2], [n[0] - f[0] * 5 - sd[0] * 5, n[1] - f[1] * 5 - sd[1] * 5]];
    svg += `<polygon points="${pts(arrow)}" fill="#f5d76e" stroke="#10261a" stroke-width="1"/>`;
    svg += `<text x="4" y="146" fill="rgba(190,210,185,.7)" font-size="8" font-family="ui-monospace, monospace">grid ${step} m</text>`;
    trackG.innerHTML = svg;
  };

  const drawStrips = () => {
    const lane = (key, minSpan, el) => {
      if (!el || hist.length < 2) return;
      let lo = Infinity, hi = -Infinity;
      for (const h of hist) { lo = Math.min(lo, h[key]); hi = Math.max(hi, h[key]); }
      const mid = (lo + hi) / 2, span = Math.max(minSpan, (hi - lo) * 1.2);
      el.setAttribute("points", hist.map((h, i) =>
        `${(300 * (HIST - hist.length + i) / (HIST - 1)).toFixed(1)},${(22 - ((h[key] - (mid - span / 2)) / span) * 20).toFixed(1)}`).join(" "));
    };
    lane("roll", 2, lines["s-roll"]);
    lane("pitch", 2, lines["s-pitch"]);
    lane("heave", 0.1, lines["s-heave"]);
  };

  const signed = (v, d) => (v >= 0 ? "+" : "") + (v + 0).toFixed(d);
  const render = (t) => {
    advance(t);
    const pitch = model.pitch(t), roll = model.roll(t);
    drawAttitude(pitch, roll);
    drawTrack();
    drawStrips();
    ro.roll && (ro.roll.textContent = `${signed(roll / D2R, 1)} °`);
    ro.pitch && (ro.pitch.textContent = `${signed(pitch / D2R, 1)} °`);
    ro.heave && (ro.heave.textContent = `${model.heave(t).toFixed(2)} g`);
  };

  // stream log, in the app's format
  const MAX_LINES = 6;
  let eventId = 0;
  const push = (t, tagClass, tagText, html) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="t">${t.toFixed(3).padStart(7)}</span><span class="tag ${tagClass}">${tagText}</span>${html}`;
    log.appendChild(li);
    while (log.children.length > MAX_LINES) log.firstElementChild.remove();
  };
  const discovery = (t) => push(t, "tag-d", "DISCOVERY", `"OGS-TS Monitor demo" · schema 1 · 1 object · 4 channels · asphalt`);
  const motion = (t) => push(t, "tag-m", "MOTION",
    `'demo_car' · yaw ${signed(model.yaw(t) / D2R % 360, 1)} pitch ${signed(model.pitch(t) / D2R, 1)} roll ${signed(model.roll(t) / D2R, 1)}` +
    `<span class="opt"> · vehicle.speed <span class="v">${model.speed(t).toFixed(1)}</span> · engine.rpm <span class="v">${Math.round(model.rpm(t))}</span></span>`);
  const event = (t) => {
    eventId += 1;
    const side = Math.sin(t) > 0 ? "1.0" : "-1.0";
    push(t, "tag-e", "EVENT", `body.impact · intensity <span class="v">${(0.35 + 0.5 * Math.abs(Math.sin(t * 0.7))).toFixed(2)}</span> · dir (${side}, 0.0, 0.3) · id ${eventId}`);
  };

  // start 30 s in, so the track and strips are full from the first frame
  const T0 = 30;
  let start = performance.now() - T0 * 1000;
  log.innerHTML = "";
  discovery(T0 - 2.4); motion(T0 - 2.0); motion(T0 - 1.5); event(T0 - 1.2); discovery(T0 - 0.4); motion(T0);
  render(T0);

  if (reduceMotion) return;

  let running = true;
  let nextDiscovery = T0 + 1.6, nextMotion = T0 + 0.5, nextEvent = T0 + 3.8;
  let last = 0;

  const tick = (now) => {
    if (!running) return;
    const t = (now - start) / 1000;
    if (now - last > 33) { // ~30 fps
      last = now;
      render(t);
      if (t >= nextDiscovery) { discovery(t); nextDiscovery += 2; }
      if (t >= nextMotion) { motion(t); nextMotion += 0.5; }
      if (t >= nextEvent) { event(t); nextEvent += 5; }
    }
    requestAnimationFrame(tick);
  };

  let pausedAt = 0;
  const resume = () => {
    if (running) return;
    running = true;
    // pick up where it paused, so the history doesn't jump
    if (pausedAt) start += performance.now() - pausedAt;
    requestAnimationFrame(tick);
  };
  const pause = () => { if (running) { running = false; pausedAt = performance.now(); } };

  const consoleEl = log.closest(".console");
  if ("IntersectionObserver" in window && consoleEl) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting && !document.hidden ? resume() : pause()));
    }).observe(consoleEl);
  }
  document.addEventListener("visibilitychange", () => (document.hidden ? pause() : resume()));

  running = false;
  resume();
})();
