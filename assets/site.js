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

  // ---- Illustrative receiver console ---------------------------------------
  // Plausible values only: this shows the shape of an OGS-TS stream, it does
  // not decode a real one.
  const log = document.querySelector(".console .log");
  const world = document.querySelector(".hz-world");
  const ro = {};
  document.querySelectorAll("[data-ro]").forEach((el) => { ro[el.dataset.ro] = el; });
  if (!log || !world) return;

  const MAX_LINES = 9;
  const RATE_HZ = 60;
  let seq = 48210;
  let eventId = 16;
  let start = performance.now();

  const sample = (t) => {
    const speed = 38 + 12 * Math.sin(t / 5.1) + 3 * Math.sin(t / 1.3);
    const rpm = 4300 + 2100 * Math.sin(t / 1.9) + 400 * Math.sin(t / 0.7);
    const pitch = 3.2 * Math.sin(t / 2.3) + 0.8 * Math.sin(t / 0.9);
    const roll = 7.5 * Math.sin(t / 3.1) + 1.5 * Math.sin(t / 1.1);
    return { speed, rpm, pitch, roll };
  };

  const stamp = (t) => {
    const ms = Math.floor(t * 1000);
    const m = String(Math.floor(ms / 60000) % 60).padStart(2, "0");
    const s = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
    return `${m}:${s}.${String(ms % 1000).padStart(3, "0")}`;
  };

  const push = (t, tagClass, tagText, html) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="t">${stamp(t)}</span><span class="tag ${tagClass}">${tagText}</span>${html}`;
    log.appendChild(li);
    while (log.children.length > MAX_LINES) log.firstElementChild.remove();
  };

  const discovery = (t) => push(t, "tag-d", "DISCOVERY", `"Demo Racer" · 1 object · 15 channels`);
  const motion = (t, v) => push(t, "tag-m", "MOTION",
    `#${seq} vehicle.speed <span class="v">${v.speed.toFixed(1)}</span><span class="opt"> · engine.rpm <span class="v">${Math.round(v.rpm)}</span></span>`);
  const event = (t) => {
    eventId += 1;
    const g = (1.2 + Math.random() * 2.6).toFixed(1);
    push(t, "tag-e", "EVENT", `body.impact <span class="v">${g} g</span> · id ${eventId} · replayed, deduplicated`);
  };

  const render = (v) => {
    ro.speed && (ro.speed.textContent = v.speed.toFixed(1));
    ro.rpm && (ro.rpm.textContent = String(Math.round(v.rpm)));
    ro.pitch && (ro.pitch.textContent = v.pitch.toFixed(1));
    ro.roll && (ro.roll.textContent = v.roll.toFixed(1));
    world.setAttribute("transform", `rotate(${(-v.roll).toFixed(2)} 50 50) translate(0 ${(v.pitch * 2).toFixed(2)})`);
  };

  // Seed the log so it is never empty.
  log.innerHTML = "";
  // Seed a full screen of history so the log starts populated.
  discovery(0);
  for (let i = 1; i <= 4; i++) { seq += 24; motion(0.4 * i, sample(0.4 * i)); }
  discovery(2);
  for (let i = 6; i <= 8; i++) { seq += 24; motion(0.4 * i, sample(0.4 * i)); }
  start -= 3400; // continue the seeded timeline
  render(sample(3.4));

  if (reduceMotion) return;

  let running = true;
  let nextDiscovery = 4, nextMotion = 3.6, nextEvent = 5.5;
  let last = 0;

  const tick = (now) => {
    if (!running) return;
    const t = (now - start) / 1000;
    if (now - last > 33) { // ~30 fps for the gauges is plenty
      last = now;
      const v = sample(t);
      render(v);
      if (t >= nextDiscovery) { discovery(t); nextDiscovery += 2; }
      if (t >= nextMotion) { seq += Math.round(RATE_HZ * 0.4); motion(t, v); nextMotion += 0.4; }
      if (t >= nextEvent) { event(t); nextEvent += 5 + Math.random() * 5; }
    }
    requestAnimationFrame(tick);
  };

  const resume = () => {
    if (running) return;
    running = true;
    // Rebase the schedule so a long pause doesn't flood the log.
    const t = (performance.now() - start) / 1000;
    nextDiscovery = t + 0.5; nextMotion = t + 0.2; nextEvent = t + 4;
    requestAnimationFrame(tick);
  };
  const pause = () => { running = false; };

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
