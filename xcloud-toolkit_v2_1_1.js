// ==UserScript==
// @name         Xbox Cloud
// @namespace    local.xcloud.toolkit
// @version      2.1.1
// @description  Stream stats, image boost, keyboard & mouse (virtual gamepad), screenshot and shortcuts for xCloud (play.xbox.com and xbox.com/play). Does not change region or connection.
// @match        https://play.xbox.com/*
// @match        https://www.xbox.com/*/play*
// @match        https://www.xbox.com/play*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.__xcloudToolkitInitialized) {
    console.warn('[Xbox Cloud] already initialized - duplicate instance ignored');
    return;
  }
  window.__xcloudToolkitInitialized = true;

  console.log('[Xbox Cloud] script started on', location.href);

  /* ---------- Logging + safe localStorage access ---------- */
  const warned = new Set();
  function logOnce(ctx, err) {
    if (warned.has(ctx)) return;
    warned.add(ctx);
    console.warn('[Xbox Cloud] ' + ctx + ':', err && err.message ? err.message : err);
  }
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  function dropCorrupt(key, why) {
    logOnce('corrupt data in ' + key, why);
    try { localStorage.removeItem(key); } catch (e) { /* ignored */ }
    return null;
  }

  // Reads a JSON object; returns null if missing, invalid or corrupt
  function readJSON(key) {
    let txt;
    try { txt = localStorage.getItem(key); } catch (e) { logOnce('reading ' + key, e); return null; }
    if (typeof txt !== 'string' || !txt) return null;
    const t = txt.trim();
    if (t.length > 2000000 || t[0] !== '{' || t[t.length - 1] !== '}') return dropCorrupt(key, 'invalid format');
    try {
      const v = JSON.parse(t);
      return isObj(v) ? v : dropCorrupt(key, 'not an object');
    } catch (e) {
      return dropCorrupt(key, e);
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      logOnce('writing ' + key, e);
      return false;
    }
  }

  /* ---------- Persistent settings ---------- */
  const KEY = 'xcloud-toolkit-settings';
  const defaults = {
    statsVisible: true,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    sharpen: 0,        // 0-100
    kbm: false,        // keyboard + mouse
    mouseSens: 100,    // 20-300 (%)
    preset: 'shooter', // 'shooter' | 'standard' | 'racing'
    steerSpeed: 60,    // 10-100 how fast the wheel turns (racing)
    adsSens: 70,       // 20-150 (%) while right click is held (aiming)
    deadzone: 10,      // 0-30 (%) right stick deadzone compensation
  };
  const SETTING_RANGE = {
    brightness: [50, 150], contrast: [50, 150], saturation: [0, 200], sharpen: [0, 100],
    mouseSens: [20, 300], steerSpeed: [10, 100], adsSens: [20, 150], deadzone: [0, 30],
  };
  let settings = { ...defaults };
  try {
    const stored = readJSON(KEY);
    if (stored) {
      if (typeof stored.sharpen !== 'number') stored.sharpen = stored.sharpen ? 40 : 0; // legacy migration
      for (const k of Object.keys(defaults)) {
        const v = stored[k];
        if (typeof defaults[k] === 'number') {
          if (typeof v === 'number' && Number.isFinite(v)) {
            const r = SETTING_RANGE[k];
            settings[k] = r ? Math.min(r[1], Math.max(r[0], v)) : v;
          }
        } else if (typeof v === typeof defaults[k]) {
          settings[k] = v;
        }
      }
    }
  } catch (e) {
    logOnce('loading settings', e);
    settings = { ...defaults };
  }
  if (!['shooter', 'standard', 'racing'].includes(settings.preset)) {
    settings.preset = defaults.preset;
  }
  // Delayed write (avoids a write on every slider event)
  let saveTimer = 0;
  const flushSettings = () => {
    clearTimeout(saveTimer);
    saveTimer = 0;
    writeJSON(KEY, settings);
  };
  const flushSettingsNow = () => { if (saveTimer) flushSettings(); };
  const save = () => { if (!saveTimer) saveTimer = setTimeout(flushSettings, 250); };
  const clamp = (v, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));

  /* ---------- Playtime (only while a stream is running) ---------- */
  const PT_KEY = 'xcloud-toolkit-playtime';
  let playtime = { total: 0, days: {} };
  try {
    const raw = readJSON(PT_KEY);
    if (raw) {
      const days = {};
      if (isObj(raw.days)) {
        for (const [k, v] of Object.entries(raw.days).slice(0, 400)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0) days[k] = v;
        }
      }
      const total = Number(raw.total);
      playtime = { total: Number.isFinite(total) && total >= 0 ? total : 0, days };
    }
  } catch (e) { logOnce('loading playtime', e); }
  let sessionSec = 0;
  let idleSec = 0;
  let lastTick = Date.now();
  let lastSave = 0;
  let ptEl = null;

  const pad2 = (n) => String(n).padStart(2, '0');
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  const fmtClock = (s) => {
    s = Math.floor(s);
    return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
  };
  const fmtLong = (s) => {
    s = Math.floor(s);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    return hh ? `${hh}h ${mm}m` : `${mm}m`;
  };
  const ptText = () =>
    `Session:   ${fmtClock(sessionSec)}\n` +
    `Today:     ${fmtLong(playtime.days[todayKey()] || 0)}\n` +
    `Total:     ${fmtLong(playtime.total)}`;

  function savePlaytime() {
    try {
      const keys = Object.keys(playtime.days).sort();
      while (keys.length > 60) delete playtime.days[keys.shift()];
      writeJSON(PT_KEY, playtime);
    } catch (e) { logOnce('saving playtime', e); }
  }

  function isStreaming() {
    let live = false;
    for (const pc of connections) {
      if (pc.connectionState === 'connected') { live = true; break; }
    }
    if (!live) return false;
    const v = document.querySelector('video');
    return !!v && v.videoWidth > 0 && !v.paused && !v.ended && v.readyState >= 2;
  }

  function tickPlaytime() {
    const now = Date.now();
    const dt = Math.min((now - lastTick) / 1000, 65);
    lastTick = now;
    if (isStreaming()) {
      idleSec = 0;
      sessionSec += dt;
      playtime.total += dt;
      const k = todayKey();
      playtime.days[k] = (playtime.days[k] || 0) + dt;
    } else {
      idleSec += dt;
      if (idleSec > 60) sessionSec = 0; // new session after 1 minute without a stream
    }
    if (now - lastSave > 10000) { lastSave = now; savePlaytime(); }
    if (ptEl && panelEl && panelEl.style.display === 'block') setTxt(ptEl, ptText());
  }

  /* ---------- WebRTC connection tracking (read-only stats) ---------- */
  const connections = new Set();
  try {
    const NativePC = window.RTCPeerConnection;
    if (NativePC) {
      const WrappedPC = function (...args) {
        const pc = new NativePC(...args);
        connections.add(pc);
        console.log('[Xbox Cloud] WebRTC connection detected');
        pc.addEventListener('connectionstatechange', () => {
          if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
            connections.delete(pc);
          }
        });
        return pc;
      };
      WrappedPC.prototype = NativePC.prototype;
      Object.setPrototypeOf(WrappedPC, NativePC);
      window.RTCPeerConnection = WrappedPC;
    }
  } catch (e) {
    console.warn('[Xbox Cloud] could not track WebRTC:', e);
  }

  /* ====================================================================
   *  Keyboard + mouse -> virtual gamepad
   *  The game reads navigator.getGamepads(); when the mode is active, slot 0
   *  returns a virtual gamepad driven by the keyboard and mouse.
   * ==================================================================== */
  const BTN = {
    A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
    VIEW: 8, MENU: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, GUIDE: 16,
  };
  const ARROWS = { ArrowUp: BTN.UP, ArrowDown: BTN.DOWN, ArrowLeft: BTN.LEFT, ArrowRight: BTN.RIGHT };
  const PRESETS = {
    standard: {
      Space: BTN.A, KeyC: BTN.B, KeyR: BTN.X, KeyF: BTN.Y,
      KeyQ: BTN.LB, KeyE: BTN.RB, ShiftLeft: BTN.L3, KeyV: BTN.R3,
      Tab: BTN.VIEW, Enter: BTN.MENU, Backquote: BTN.GUIDE, ...ARROWS,
    },
    shooter: {
      Space: BTN.A, KeyC: BTN.B, KeyR: BTN.X, KeyE: BTN.X, Digit1: BTN.Y,
      KeyQ: BTN.LB, KeyG: BTN.RB, ShiftLeft: BTN.L3, KeyF: BTN.R3, KeyV: BTN.R3,
      Tab: BTN.VIEW, Enter: BTN.MENU, Backquote: BTN.GUIDE, ...ARROWS,
    },
    // Racing (Forza etc.): W/S = throttle/brake, A/D = steering (smoothed)
    racing: {
      Space: BTN.A, Enter: BTN.A, KeyR: BTN.X, KeyC: BTN.Y,
      KeyF: BTN.B, Backspace: BTN.B,
      KeyQ: BTN.LB, KeyE: BTN.RB, KeyH: BTN.L3, KeyV: BTN.R3,
      Tab: BTN.VIEW, KeyP: BTN.MENU, Backquote: BTN.GUIDE, ...ARROWS,
    },
  };
  const activeMap = () => PRESETS[settings.preset] || PRESETS.shooter;
  const LEGENDS = {
    shooter:
      'WASD = move · mouse = camera · left click = fire (RT) · right click = aim (LT) · '
      + 'Space = jump (A) · C = crouch (B) · R or E = reload / use (X) · '
      + '1 or mouse wheel = switch weapon (Y) · Q = LB · G = grenade (RB) · Shift = sprint (L3) · '
      + 'F, V or middle click = melee (R3) · Tab = scoreboard (View) · Enter = Menu · arrows = D-pad · ` = Guide.',
    racing:
      'W = accelerate (RT) · S = brake / reverse (LT) · A/D = steer · Shift = fine steering (half) · '
      + 'Space = handbrake (A) · R = rewind (X) · C = change camera (Y) · Q/E = shift down / up (LB/RB) · '
      + 'H = horn (L3) · V = look back (R3) · mouse = camera · '
      + 'Enter = confirm (A) · F or Backspace = back (B) · Tab = View · P = Menu · arrows = D-pad · ` = Guide.',
    standard:
      'WASD = left stick · mouse = right stick · left click = RT · right click = LT · '
      + 'Space = A · C = B · R = X · F = Y · Q/E = LB/RB · Shift = L3 · V = R3 · '
      + 'Tab = View · Enter = Menu · arrows = D-pad · ` = Guide.',
  };
  const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  const MOUSEMAP = { 0: BTN.RT, 2: BTN.LT, 1: BTN.R3 };

  const vpad = {
    id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)',
    index: 0,
    connected: true,
    mapping: 'standard',
    timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    vibrationActuator: null,
  };
  const keysDown = new Set();
  const keyBindingsDown = new Map(); // remember the button assigned at keydown
  const buttonSources = new Map();
  const analogButtons = new Map();
  let kbmEnabled = false;
  let mdx = 0;
  let mdy = 0;
  let kbmLoopRunning = false;
  const mouseHeld = new Set();
  let steer = 0;
  let thr = 0;
  let brk = 0;
  let lastPadTime = performance.now();

  function setAnalog(i, v) {
    const value = clamp(v, 0, 1);
    if (value > 0) analogButtons.set(i, value);
    else analogButtons.delete(i);
    const b = vpad.buttons[i];
    b.value = Math.max(value, buttonSources.get(i) && buttonSources.get(i).size ? 1 : 0);
    b.pressed = b.value > 0.1;
    b.touched = b.value > 0;
  }

  function setButton(i, down) {
    const b = vpad.buttons[i];
    b.pressed = down;
    b.touched = down;
    b.value = down ? 1 : 0;
  }

  function refreshButton(i) {
    const analog = analogButtons.get(i) || 0;
    const sources = buttonSources.get(i);
    const value = Math.max(analog, sources && sources.size ? 1 : 0);
    const b = vpad.buttons[i];
    b.value = value;
    b.pressed = value > 0.1;
    b.touched = value > 0;
  }

  function setSourceButton(source, i, down) {
    let sources = buttonSources.get(i);
    if (!sources) {
      sources = new Set();
      buttonSources.set(i, sources);
    }

    if (down) sources.add(source);
    else sources.delete(source);

    if (sources.size === 0) buttonSources.delete(i);
    refreshButton(i);
  }

  function releaseAll() {
    keysDown.clear();
    keyBindingsDown.clear();
    buttonSources.clear();
    analogButtons.clear();
    vpad.buttons.forEach((_, i) => setButton(i, false));
    vpad.axes = [0, 0, 0, 0];
    mdx = 0;
    mdy = 0;
    mouseHeld.clear();
    clearTimeout(wheelTimer);
    wheelTimer = null;
    steer = 0;
    thr = 0;
    brk = 0;
  }

  function updateVirtualPad() {
    const k = (c) => keysDown.has(c);
    let lx = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
    let ly = (k('KeyS') ? 1 : 0) - (k('KeyW') ? 1 : 0);
    const len = Math.hypot(lx, ly);
    if (len > 1) { lx /= len; ly /= len; }

    const now = performance.now();
    const dt = Math.min((now - lastPadTime) / 1000, 0.1);
    lastPadTime = now;
    const racing = settings.preset === 'racing';
    if (racing) {
      // Steering: ramp toward the target (not on/off) so it isn't abrupt with a keyboard
      let target = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
      if (k('ShiftLeft')) target *= 0.5;
      const rate = 0.5 + (settings.steerSpeed / 100) * 8;
      const widening = target !== 0
        && (steer === 0 || Math.sign(target) === Math.sign(steer))
        && Math.abs(target) >= Math.abs(steer);
      const step = (widening ? rate : rate * 1.5) * dt;
      steer += clamp(target - steer, -step, step);
      lx = steer;
      ly = 0;
      // Progressive throttle and brake (analog trigger)
      const rtTarget = (k('KeyW') || mouseHeld.has(0)) ? 1 : 0;
      const ltTarget = (k('KeyS') || mouseHeld.has(2)) ? 1 : 0;
      thr += clamp(rtTarget - thr, -10 * dt, 6 * dt);
      brk += clamp(ltTarget - brk, -10 * dt, 6 * dt);
      setAnalog(BTN.RT, thr);
      setAnalog(BTN.LT, brk);
    }

    // Reduced sensitivity while aiming (right click = LT pressed)
    const ads = !racing && vpad.buttons[BTN.LT].pressed ? settings.adsSens / 100 : 1;
    const f = 0.04 * (settings.mouseSens / 100) * ads;
    let rx = mdx * f;
    let ry = mdy * f;
    // Deadzone compensation: small movements get past the threshold the game ignores
    const mag = Math.hypot(rx, ry);
    if (mag > 0) {
      const dz = settings.deadzone / 100;
      const scaled = Math.min(1, dz + (1 - dz) * Math.min(mag, 1));
      rx = (rx / mag) * scaled;
      ry = (ry / mag) * scaled;
    }
    vpad.axes[0] = lx;
    vpad.axes[1] = ly;
    vpad.axes[2] = clamp(rx);
    vpad.axes[3] = clamp(ry);
    mdx = 0;
    mdy = 0;
    vpad.timestamp = performance.now();
  }

  function kbmLoop() {
    if (!kbmEnabled) { kbmLoopRunning = false; return; }
    updateVirtualPad();
    requestAnimationFrame(kbmLoop);
  }

  function fireGamepadEvent(type) {
    try {
      const ev = new Event(type);
      ev.gamepad = vpad;
      window.dispatchEvent(ev);
    } catch (e) { /* ignored */ }
  }

  try {
    const nativeGetGamepads = navigator.getGamepads
      ? navigator.getGamepads.bind(navigator)
      : () => [];
    navigator.getGamepads = function () {
      const native = Array.from(nativeGetGamepads() || []);
      if (!kbmEnabled) return native;
      const out = native.slice(0, 4);
      while (out.length < 4) out.push(null);
      out[0] = vpad;
      return out;
    };
  } catch (e) {
    console.warn('[Xbox Cloud] could not override getGamepads:', e);
  }

  let kbmCheckbox = null;
  function setKbm(on, quiet) {
    if (kbmEnabled === on) return;
    kbmEnabled = on;
    settings.kbm = on;
    save();
    if (kbmCheckbox) kbmCheckbox.checked = on;
    if (on) {
      fireGamepadEvent('gamepadconnected');
      if (!kbmLoopRunning) { kbmLoopRunning = true; requestAnimationFrame(kbmLoop); }
      if (!quiet) toast('Keyboard & Mouse ENABLED. Click the video or press Alt+M to lock the mouse (Esc releases it).');
    } else {
      releaseAll();
      fireGamepadEvent('gamepaddisconnected');
      if (document.pointerLockElement) document.exitPointerLock();
      if (!quiet) toast('Keyboard & Mouse DISABLED');
    }
  }

  function isTyping(t) {
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      && !(t.closest && t.closest('#xct-panel'));
  }

  function lockPointer() {
    const v = document.querySelector('video');
    if (!v) { toast('No video stream available'); return; }
    try {
      const p = v.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => v.requestPointerLock());
    } catch (e) {
      try { v.requestPointerLock(); } catch (e2) { /* ignored */ }
    }
  }

  function onKbmKeyDown(e) {
    if (!kbmEnabled || e.altKey || e.ctrlKey || e.metaKey) return;
    if (isTyping(e.target)) return;
    const code = e.code;
    const map = activeMap();
    const isMove = MOVE_KEYS.includes(code) || (settings.preset === 'racing' && code === 'ShiftLeft');
    if (!isMove && !(code in map)) return;
    e.preventDefault();
    e.stopPropagation();
    if (keysDown.has(code)) return; // ignore repeat without remapping a held key
    keysDown.add(code);
    if (code in map) {
      keyBindingsDown.set(code, map[code]);
      setSourceButton('key:' + code, map[code], true);
    }
  }

  function onKbmKeyUp(e) {
    const code = e.code;
    if (!keysDown.has(code)) return;
    keysDown.delete(code);
    const assigned = keyBindingsDown.get(code);
    keyBindingsDown.delete(code);
    if (assigned !== undefined) setSourceButton('key:' + code, assigned, false);
    if (kbmEnabled) { e.preventDefault(); e.stopPropagation(); }
  }

  function onKbmMouseMove(e) {
    if (kbmEnabled && document.pointerLockElement) {
      mdx += e.movementX || 0;
      mdy += e.movementY || 0;
    }
  }

  function onKbmMouseDown(e) {
    if (!kbmEnabled) return;
    if (document.pointerLockElement) {
      if (e.button in MOUSEMAP) {
        mouseHeld.add(e.button);
        setSourceButton('mouse:' + e.button, MOUSEMAP[e.button], true);
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
    // Click on video -> lock the mouse
    const v = document.querySelector('video');
    if (v && e.target && (e.target === v || v.contains(e.target))) lockPointer();
  }

  // Mouse wheel = switch weapon (short press on Y), shooter mode only
  let wheelTimer = null;
  function onKbmWheel(e) {
    if (!kbmEnabled || !document.pointerLockElement || settings.preset !== 'shooter') return;
    e.preventDefault();
    e.stopPropagation();
    setSourceButton('wheel', BTN.Y, true);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      setSourceButton('wheel', BTN.Y, false);
      wheelTimer = null;
    }, 90);
  }

  function onKbmMouseUp(e) {
    if (!(e.button in MOUSEMAP)) return;
    mouseHeld.delete(e.button);
    const i = MOUSEMAP[e.button];
    const was = vpad.buttons[i].pressed;
    setSourceButton('mouse:' + e.button, i, false);
    if (was && kbmEnabled) { e.preventDefault(); e.stopPropagation(); }
  }

  /* ---------- Helper for building elements (no innerHTML) ---------- */
  function h(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    }
    children.forEach((c) => node.append(c));
    return node;
  }

  /* ---------- Styles ---------- */
  const CSS = `
    video.xct-filtered {
      filter: brightness(var(--xct-b, 1)) contrast(var(--xct-c, 1)) saturate(var(--xct-s, 1)) var(--xct-sharp, ) !important;
    }
    #xct-stats {
      position: fixed; top: 8px; right: 8px; z-index: 2147483646;
      padding: 6px 10px; border-radius: 6px;
      background: rgba(0,0,0,.6); color: #e6ffe6;
      font: 12px/1.45 ui-monospace, Consolas, monospace;
      pointer-events: none; white-space: pre; display: none;
    }
    #xct-panel {
      position: fixed; top: 12px; left: 12px; z-index: 2147483646;
      width: 260px; max-height: calc(100vh - 80px); overflow: auto;
      padding: 12px; border-radius: 8px; display: none;
      background: rgba(20,20,20,.94); color: #fff;
      font: 13px system-ui, sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,.5);
    }
    #xct-panel h4 { margin: 0 0 8px; font-size: 14px; }
    #xct-panel h5 { margin: 14px 0 2px; font-size: 12px; opacity: .8; text-transform: uppercase; letter-spacing: .04em; }
    #xct-panel label { display: block; margin: 8px 0 2px; }
    #xct-panel input[type=range] { width: 100%; }
    #xct-panel button {
      margin: 10px 6px 0 0; padding: 4px 10px; border: 0; border-radius: 4px;
      background: #107c10; color: #fff; cursor: pointer;
    }
    #xct-panel button.xct-alt { background: #444; }
    #xct-panel small { display: block; margin-top: 10px; opacity: .7; line-height: 1.45; }
    #xct-pt { font: 12px/1.45 ui-monospace, Consolas, monospace; white-space: pre; margin-top: 4px; }
    #xct-toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      z-index: 2147483647; padding: 8px 14px; border-radius: 6px; max-width: 80vw;
      background: rgba(0,0,0,.85); color: #fff; font: 13px system-ui, sans-serif;
      display: none; pointer-events: none; text-align: center;
    }
  `;

  function injectStyle() {
    const css = CSS + HUD_CSS; // v2.0: include the HUD styles
    // Constructable stylesheet (not blocked by CSP), with <style> fallback
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      return;
    } catch (e) { /* fall through to the fallback */ }
    const style = document.createElement('style');
    style.id = 'xct-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  /* ---------- Video filters / image boost ---------- */
  function updateSharpenKernel() {
    const conv = document.getElementById('xct-conv');
    if (!conv) return;
    const a = (settings.sharpen / 100) * 0.8;
    const c = 1 + 4 * a;
    const km = `0 ${-a} 0  ${-a} ${c} ${-a}  0 ${-a} 0`;
    if (conv.__k !== km) { conv.__k = km; conv.setAttribute('kernelMatrix', km); }
  }

  let filterKey = '';
  function applyFilters() {
    const root = document.documentElement;
    const key = settings.brightness + '|' + settings.contrast + '|' + settings.saturation + '|' + (settings.sharpen > 0);
    if (key !== filterKey || !root.style.getPropertyValue('--xct-b')) {
      filterKey = key;
      root.style.setProperty('--xct-b', settings.brightness / 100);
      root.style.setProperty('--xct-c', settings.contrast / 100);
      root.style.setProperty('--xct-s', settings.saturation / 100);
      root.style.setProperty('--xct-sharp', settings.sharpen > 0 ? 'url(#xct-sharpen)' : '');
    }
    updateSharpenKernel();
    document.querySelectorAll('video').forEach((v) => {
      if (!v.classList.contains('xct-filtered')) v.classList.add('xct-filtered');
    });
  }

  function injectSharpenFilter() {
    if (document.getElementById('xct-svg')) return;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'xct-svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    const filter = document.createElementNS(NS, 'filter');
    filter.setAttribute('id', 'xct-sharpen');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const conv = document.createElementNS(NS, 'feConvolveMatrix');
    conv.setAttribute('id', 'xct-conv');
    conv.setAttribute('order', '3');
    conv.setAttribute('preserveAlpha', 'true');
    conv.setAttribute('kernelMatrix', '0 0 0  0 1 0  0 0 0');
    filter.appendChild(conv);
    svg.appendChild(filter);
    document.body.appendChild(svg);
  }

  /* ---------- UI ---------- */
  let statsEl, panelEl, toastEl;

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.style.display = 'none'; }, 3500);
  }

  function syncControls() {
    panelEl.querySelectorAll('[data-k]').forEach((el) => {
      const k = el.getAttribute('data-k');
      if (el.type === 'checkbox') el.checked = !!settings[k];
      else {
        el.value = settings[k];
        const label = panelEl.querySelector(`[data-v="${k}"]`);
        if (label) label.textContent = settings[k];
      }
    });
  }

  function buildUI() {
    statsEl = h('div', { id: 'xct-stats' });
    toastEl = h('div', { id: 'xct-toast' });
    panelEl = h('div', { id: 'xct-panel' });

    panelEl.append(h('h4', { text: 'Xbox Cloud' }));

    // --- Tastatura + mouse ---
    panelEl.append(h('h5', { text: 'Keyboard & Mouse' }));
    const kbmLabel = h('label');
    kbmLabel.append(h('input', { type: 'checkbox', 'data-k': 'kbm' }), ' Enable (Alt+K)');
    panelEl.append(kbmLabel);
    // Key preset
    const presetLabel = h('label');
    presetLabel.append('Key Preset: ');
    const presetSel = h('select', { 'data-s': 'preset' });
    [
      ['shooter', 'Shooter (FPS / TPS)'],
      ['racing', 'Racing (Forza etc.)'],
      ['standard', 'Standard (Controller)'],
    ].forEach(([v, t]) => {
      presetSel.append(h('option', { value: v, text: t }));
    });
    presetSel.value = PRESETS[settings.preset] ? settings.preset : 'shooter';
    presetLabel.append(presetSel);
    panelEl.append(presetLabel);

    [
      ['mouseSens', 'Mouse Sensitivity', 20, 300],
      ['adsSens', 'Aim Sensitivity (Right Click)', 20, 150],
      ['deadzone', 'Deadzone Compensation', 0, 30],
      ['steerSpeed', 'Steering Response', 10, 100],
    ].forEach(([k, name, min, max]) => {
      const label = h('label');
      label.append(name + ': ', h('span', { 'data-v': k }), '%');
      panelEl.append(label, h('input', { type: 'range', min: String(min), max: String(max), 'data-k': k }));
    });

    const legendEl = h('small', { id: 'xct-legend' });
    const refreshLegend = () => {
      legendEl.textContent = (LEGENDS[settings.preset] || LEGENDS.shooter)
        + ' Click the video or press Alt+M to lock the mouse; Esc releases it.';
    };
    refreshLegend();
    presetSel.addEventListener('change', () => {
      settings.preset = presetSel.value;
      save();
      releaseAll();
      refreshLegend();
      toast('Preset: ' + presetSel.options[presetSel.selectedIndex].text);
    });
    panelEl.append(legendEl);

    // --- Image ---
    panelEl.append(h('h5', { text: 'Image' }));
    const sliders = [
      ['brightness', 'Brightness', 50, 150],
      ['contrast', 'Contrast', 50, 150],
      ['saturation', 'Saturation', 0, 200],
      ['sharpen', 'Sharpness', 0, 100],
    ];
    sliders.forEach(([k, name, min, max]) => {
      const label = h('label');
      label.append(name + ': ', h('span', { 'data-v': k }), '%');
      panelEl.append(label, h('input', { type: 'range', min: String(min), max: String(max), 'data-k': k }));
    });
    panelEl.append(
      h('button', { type: 'button', id: 'xct-boost', text: 'Boost' }),
      h('button', { type: 'button', id: 'xct-reset', class: 'xct-alt', text: 'Reset Image' }),
      h('small', {
        text: 'Boost = sharpness + contrast + color, applied locally to the image. '
          + 'The actual resolution and bitrate are set by the Microsoft server.',
      }),
      h('small', { text: 'Alt+S stats \u00b7 Alt+V panel \u00b7 Alt+P screenshot \u00b7 Alt+F fullscreen' })
    );

    // --- Playtime ---
    panelEl.append(h('h5', { text: 'Playtime' }));
    ptEl = h('div', { id: 'xct-pt' });
    ptEl.textContent = ptText();
    const ptReset = h('button', { type: 'button', id: 'xct-pt-reset', class: 'xct-alt', text: 'Reset Playtime' });
    ptReset.addEventListener('click', () => {
      if (!window.confirm('Delete all playtime (session, today and total)?')) return;
      playtime = { total: 0, days: {} };
      sessionSec = 0;
      savePlaytime();
      ptEl.textContent = ptText();
    });
    panelEl.append(ptEl, ptReset);

    kbmCheckbox = panelEl.querySelector('[data-k="kbm"]');
    syncControls();

    panelEl.querySelectorAll('[data-k]').forEach((el) => {
      const k = el.getAttribute('data-k');
      if (el.type === 'checkbox') {
        el.addEventListener('change', () => {
          if (k === 'kbm') setKbm(el.checked);
          else { settings[k] = el.checked; save(); applyFilters(); }
        });
      } else {
        el.addEventListener('input', () => {
          settings[k] = Number(el.value);
          const label = panelEl.querySelector(`[data-v="${k}"]`);
          if (label) label.textContent = el.value;
          save();
          applyFilters();
        });
      }
    });

    panelEl.querySelector('#xct-boost').addEventListener('click', () => {
      Object.assign(settings, { brightness: 100, contrast: 108, saturation: 115, sharpen: 45 });
      save(); syncControls(); applyFilters();
      toast('Boost applied');
    });

    panelEl.querySelector('#xct-reset').addEventListener('click', () => {
      Object.assign(settings, { brightness: 100, contrast: 100, saturation: 100, sharpen: 0 });
      save(); syncControls(); applyFilters();
    });

    document.body.append(statsEl, panelEl, toastEl);
    injectSharpenFilter();
    statsEl.style.display = settings.statsVisible ? 'block' : 'none';
    applyFilters();
  }

  /* ---------- Stats ---------- */
  let prev = null;

  async function collectStats() {
    for (const pc of connections) {
      if (pc.connectionState === 'closed') { connections.delete(pc); continue; }
      let report;
      try { report = await pc.getStats(); } catch (e) { continue; }
      let inbound = null;
      let pair = null;
      report.forEach((r) => {
        if (r.type === 'inbound-rtp' && (r.kind === 'video' || r.mediaType === 'video')) inbound = r;
        if (r.type === 'candidate-pair' && (r.nominated || r.state === 'succeeded') && r.currentRoundTripTime != null) {
          pair = r;
        }
      });
      if (inbound) return { inbound, pair };
    }
    return null;
  }

  let statsBusy = false;
  async function updateStats() {
    if (statsBusy || document.hidden) return;
    statsBusy = true;
    try { await updateStatsInner(); } catch (e) { logOnce('stats', e); } finally { statsBusy = false; }
  }

  async function updateStatsInner() {
    if (!statsEl) return;
    if (!settings.statsVisible && !hudState.visible) return;
    const data = await collectStats();
    try { hudIngest(data); } catch (e) { /* HUD does not block the stats */ }
    if (!settings.statsVisible) return;
    if (!data) {
      setTxt(statsEl, 'Xbox Cloud: waiting for stream...\n' + ptText());
      prev = null;
      return;
    }
    const { inbound: i, pair } = data;
    const now = performance.now();
    let bitrate = '-';
    if (prev && prev.bytes != null) {
      const dt = (now - prev.t) / 1000;
      if (dt > 0 && i.bytesReceived >= prev.bytes) bitrate = (((i.bytesReceived - prev.bytes) * 8) / dt / 1e6).toFixed(1) + ' Mbps';
    }
    prev = { t: now, bytes: i.bytesReceived };

    const rtt = pair ? Math.round(pair.currentRoundTripTime * 1000) + ' ms' : '-';
    const total = (i.packetsReceived || 0) + (i.packetsLost || 0);
    const loss = total ? (((i.packetsLost || 0) / total) * 100).toFixed(2) + '%' : '0%';
    const jitter = i.jitter != null ? (i.jitter * 1000).toFixed(1) + ' ms' : '-';
    const decode = i.framesDecoded
      ? (((i.totalDecodeTime || 0) / i.framesDecoded) * 1000).toFixed(1) + ' ms'
      : '-';
    const jb = i.jitterBufferEmittedCount
      ? (((i.jitterBufferDelay || 0) / i.jitterBufferEmittedCount) * 1000).toFixed(1) + ' ms'
      : '-';
    const res = i.frameWidth ? `${i.frameWidth}x${i.frameHeight}` : '-';

    setTxt(statsEl,
      `RTT:       ${rtt}\n` +
      `FPS:       ${i.framesPerSecond != null ? Math.round(i.framesPerSecond) : '-'}\n` +
      `Bitrate:   ${bitrate}\n` +
      `Res:       ${res}\n` +
      `Loss:      ${loss}\n` +
      `Jitter:    ${jitter}\n` +
      `Buffer:    ${jb}\n` +
      `Decode:    ${decode}\n` +
      ptText());
  }

  /* ====================================================================
   *  HUD Gaming (v2.0 Phase 1)
   *  Live metrics + Connection Score + history (300 samples) + graphs.
   *  Data comes from updateStats() (the same getStats - no extra calls).
   *  Rendering runs through requestAnimationFrame, only when the data has changed.
   * ==================================================================== */
  const HUD_KEY = 'xcloud-toolkit-hud';
  const HIST_LEN = 300;
  const hudState = { visible: false, mode: 'compact', x: null, y: null };
  try {
    const raw = readJSON(HUD_KEY) || {};
    if (typeof raw.visible === 'boolean') hudState.visible = raw.visible;
    if (raw.mode === 'compact' || raw.mode === 'detailed') hudState.mode = raw.mode;
    if (Number.isFinite(raw.x) && Number.isFinite(raw.y)) { hudState.x = raw.x; hudState.y = raw.y; }
  } catch (e) { /* ignored */ }
  const hudSave = () => { writeJSON(HUD_KEY, hudState); };

  /* ---------- History: ring buffer with fixed memory ---------- */
  function makeRing(n) {
    const buf = new Float32Array(n).fill(NaN);
    let head = 0;
    let count = 0;
    return {
      push(v) { buf[head] = v; head = (head + 1) % n; if (count < n) count++; },
      get length() { return count; },
      at(i) { return buf[(head - count + i + n) % n]; }, // 0 = oldest
      clear() { buf.fill(NaN); head = 0; count = 0; },
    };
  }
  const histRtt = makeRing(HIST_LEN);
  const histJit = makeRing(HIST_LEN);
  const histBr = makeRing(HIST_LEN);

  /* ---------- Metrics state ---------- */
  let hudPrev = null;      // previous counters (for per-interval deltas)
  let hudM = null;         // latest metrics (null = no stream)
  let hudScoreVal = null;  // smoothed score 0-100
  let hudGap = 0;          // consecutive cycles without a stream

  const hudLin = (v, good, bad) => clamp(((bad - v) / (bad - good)) * 100, 0, 100);

  // Coefficient of variation of the bitrate over the last 10 samples
  function hudBitrateCv() {
    const n = histBr.length;
    let cnt = 0;
    let sum = 0;
    let sq = 0;
    for (let k = Math.max(0, n - 10); k < n; k++) {
      const v = histBr.at(k);
      if (v >= 0) { cnt++; sum += v; sq += v * v; }
    }
    if (cnt < 5) return null;
    const mean = sum / cnt;
    if (mean < 0.5) return null;
    return Math.sqrt(Math.max(0, sq / cnt - mean * mean)) / mean;
  }

  // Score 0-100: RTT 30% · loss 30% · jitter 25% · bitrate stability 15%.
  // Missing components are excluded (weights are renormalized). Cap: a
  // single very bad component cannot be "hidden" by the others.
  function hudCalcScore(m) {
    const parts = [];
    if (m.rtt != null) parts.push([0.30, hudLin(m.rtt, 20, 150)]);
    if (m.loss != null) parts.push([0.30, hudLin(m.loss, 0, 5)]);
    if (m.jitter != null) parts.push([0.25, hudLin(m.jitter, 2, 30)]);
    const cv = hudBitrateCv();
    if (cv != null) parts.push([0.15, hudLin(cv, 0.15, 0.7)]);
    if (!parts.length) return null;
    let wSum = 0;
    let acc = 0;
    let worst = 100;
    for (const [w, s] of parts) { wSum += w; acc += w * s; if (s < worst) worst = s; }
    return Math.min(acc / wSum, worst + 35);
  }

  const hudLevel = (s) => (s >= 85 ? 'excellent' : s >= 65 ? 'good' : s >= 40 ? 'fair' : 'poor');
  const HUD_LEVEL_TEXT = { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor', none: 'Waiting' };

  /* ---------- Data ingest (called from updateStats, 1x / second) ---------- */
  function hudIngest(data) {
    if (!data) {
      hudPrev = null;
      hudM = null;
      hudScoreVal = null;
      // after ~10 s without a stream, the old history is no longer relevant
      if (hudGap < 10 && ++hudGap === 10) { histRtt.clear(); histJit.clear(); histBr.clear(); }
      hudSchedule();
      return;
    }
    hudGap = 0;
    const i = data.inbound;
    const pair = data.pair;
    const cur = {
      t: Number.isFinite(i.timestamp) ? i.timestamp : performance.now(),
      id: i.id,
      bytes: i.bytesReceived || 0,
      recv: i.packetsReceived || 0,
      lost: i.packetsLost || 0,
      frames: i.framesDecoded || 0,
      dec: i.totalDecodeTime || 0,
      jbD: i.jitterBufferDelay || 0,
      jbN: i.jitterBufferEmittedCount || 0,
    };
    const p = hudPrev;
    hudPrev = cur;
    const dt = p ? (cur.t - p.t) / 1000 : 0;
    // delta valid only on the same stream and without a counter reset
    const ok = !!p && p.id === cur.id && dt > 0 && dt <= 10
      && cur.bytes >= p.bytes && cur.recv >= p.recv && cur.lost >= p.lost
      && cur.frames >= p.frames && cur.dec >= p.dec && cur.jbD >= p.jbD && cur.jbN >= p.jbN;

    const m = {
      fps: i.framesPerSecond != null ? i.framesPerSecond : null,
      rtt: pair && pair.currentRoundTripTime != null ? pair.currentRoundTripTime * 1000 : null,
      jitter: i.jitter != null ? i.jitter * 1000 : null,
      loss: null,
      bitrate: null,
      decode: null,
      buffer: null,
      res: i.frameWidth ? `${i.frameWidth}x${i.frameHeight}` : null,
    };
    if (ok) {
      m.bitrate = ((cur.bytes - p.bytes) * 8) / dt / 1e6;
      const dLost = Math.max(0, cur.lost - p.lost);
      const tot = cur.recv - p.recv + dLost;
      m.loss = tot > 0 ? (dLost / tot) * 100 : 0;
      const dF = cur.frames - p.frames;
      if (dF > 0) m.decode = ((cur.dec - p.dec) / dF) * 1000;
      if (m.fps == null) m.fps = dF / dt;
      const dJ = cur.jbN - p.jbN;
      if (dJ > 0) m.buffer = ((cur.jbD - p.jbD) / dJ) * 1000;
    }

    histRtt.push(m.rtt == null ? NaN : m.rtt);
    histJit.push(m.jitter == null ? NaN : m.jitter);
    histBr.push(m.bitrate == null ? NaN : m.bitrate);
    hudM = m;

    const s = hudCalcScore(m);
    if (s == null) hudScoreVal = null;
    else hudScoreVal = hudScoreVal == null ? s : hudScoreVal + 0.4 * (s - hudScoreVal);
    hudSchedule();
  }

  /* ---------- Styles ---------- */
  const HUD_CSS = `
    #xct-hud {
      position: fixed; left: 12px; bottom: 12px; z-index: 2147483645;
      width: 280px; box-sizing: border-box; padding: 6px 8px 8px;
      border-radius: 8px; border: 1px solid rgba(255,255,255,.08);
      background: rgba(12,14,18,.82); color: #e8ecf1;
      font: 11px/1.3 ui-monospace, Consolas, monospace;
      box-shadow: 0 2px 12px rgba(0,0,0,.45);
      display: none; pointer-events: none; user-select: none; -webkit-user-select: none;
      --xh-c: #8a94a0;
    }
    #xct-hud[data-lvl="excellent"] { --xh-c: #3ddc84; }
    #xct-hud[data-lvl="good"]      { --xh-c: #9ad84f; }
    #xct-hud[data-lvl="fair"]      { --xh-c: #f5b942; }
    #xct-hud[data-lvl="poor"]      { --xh-c: #ff5c5c; }
    #xct-hud .xh-head {
      display: flex; align-items: center; gap: 6px; padding-bottom: 5px;
      cursor: move; pointer-events: auto; touch-action: none;
    }
    #xct-hud .xh-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--xh-c); }
    #xct-hud .xh-title { flex: 1; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; opacity: .65; }
    #xct-hud .xh-score { font-size: 16px; font-weight: 700; color: var(--xh-c); }
    #xct-hud .xh-lbl { min-width: 52px; font-size: 10px; color: var(--xh-c); }
    #xct-hud .xh-btn {
      width: 20px; height: 18px; padding: 0; border: 0; border-radius: 4px;
      background: rgba(255,255,255,.12); color: inherit; font: inherit; cursor: pointer; pointer-events: auto;
    }
    #xct-hud .xh-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px 2px; text-align: center; }
    #xct-hud.xh-detailed .xh-grid { grid-template-columns: repeat(4, 1fr); }
    #xct-hud .xh-v { display: block; font-size: 13px; font-weight: 600; color: #fff; }
    #xct-hud .xh-res .xh-v { font-size: 10px; line-height: 17px; }
    #xct-hud .xh-k { display: block; font-size: 9px; opacity: .55; }
    #xct-hud.xh-compact .xh-d { display: none; }
    #xct-hud .xh-graphs { display: none; margin-top: 6px; }
    #xct-hud.xh-detailed .xh-graphs { display: block; }
    #xct-hud .xh-gl { margin-top: 4px; font-size: 10px; opacity: .85; white-space: nowrap; }
    #xct-hud .xh-cv { display: block; border-radius: 3px; background: rgba(255,255,255,.05); }
  `;

  /* ---------- Canvas graphs ---------- */
  const GRAPH_W = 264;
  const GRAPH_H = 34;
  const hudGraphs = [
    { name: 'RTT', unit: 'ms', ring: histRtt, color: '#4fc3f7', floor: 50, dec: 0 },
    { name: 'Jitter', unit: 'ms', ring: histJit, color: '#ffb74d', floor: 10, dec: 1 },
    { name: 'Bitrate', unit: 'Mbps', ring: histBr, color: '#81c784', floor: 10, dec: 1 },
  ];

  function hudSizeCanvas(g) {
    const dpr = window.devicePixelRatio || 1;
    g.dpr = dpr;
    g.cv.width = Math.round(GRAPH_W * dpr);
    g.cv.height = Math.round(GRAPH_H * dpr);
    g.cv.style.width = GRAPH_W + 'px';
    g.cv.style.height = GRAPH_H + 'px';
  }

  function hudDrawGraph(g) {
    if (g.dpr !== (window.devicePixelRatio || 1)) hudSizeCanvas(g);
    const { cv, ctx, ring } = g;
    const w = cv.width;
    const ht = cv.height;
    ctx.clearRect(0, 0, w, ht);
    const n = ring.length;
    let max = 0;
    for (let k = 0; k < n; k++) { const v = ring.at(k); if (v > max) max = v; } // NaN ignored
    const last = n ? ring.at(n - 1) : NaN;
    if (n >= 2) {
      const scale = Math.max(g.floor, max) * 1.1;
      const step = w / (HIST_LEN - 1);
      const x0 = w - (n - 1) * step; // the newest sample stays on the right
      ctx.beginPath();
      let pen = false;
      for (let k = 0; k < n; k++) {
        const v = ring.at(k);
        if (!(v >= 0)) { pen = false; continue; } // gap in the graph for NaN
        const x = x0 + k * step;
        const y = ht - 1 - (v / scale) * (ht - 2);
        if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
      }
      ctx.strokeStyle = g.color;
      ctx.lineWidth = Math.max(1, g.dpr * 1.2);
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    const cur = last >= 0 ? last.toFixed(g.dec) : '-';
    setTxt(g.lbl, `${g.name} ${cur} ${g.unit} \u00b7 max ${max.toFixed(g.dec)}`);
  }

  /* ---------- UI ---------- */
  const HUD_CELLS = [
    ['fps', 'FPS', false], ['rtt', 'RTT ms', false], ['jitter', 'JIT ms', false],
    ['loss', 'LOSS %', false], ['bitrate', 'Mbps', false],
    ['res', 'RES', true], ['decode', 'DEC ms', true], ['buffer', 'BUF ms', true],
  ];
  let hudEl = null;
  let hudScoreNum = null;
  let hudScoreLbl = null;
  let hudBtn = null;
  let hudLvlShown = '';
  let hudRaf = 0;
  const hudVals = {};

  // Write to the DOM only if the text has changed
  function setTxt(el, s) {
    if (el.__t !== s) { el.__t = s; el.textContent = s; }
  }

  function hudSchedule() {
    if (!hudRaf && hudEl && hudState.visible) hudRaf = requestAnimationFrame(hudRender);
  }

  function hudRender() {
    hudRaf = 0;
    if (!hudEl || !hudState.visible) return;
    const m = hudM;
    const f = (v, d) => (v == null ? '-' : v.toFixed(d));
    setTxt(hudVals.fps, m ? f(m.fps, 0) : '-');
    setTxt(hudVals.rtt, m ? f(m.rtt, 0) : '-');
    setTxt(hudVals.jitter, m ? f(m.jitter, 1) : '-');
    setTxt(hudVals.loss, m ? f(m.loss, 1) : '-');
    setTxt(hudVals.bitrate, m ? f(m.bitrate, 1) : '-');
    setTxt(hudVals.res, m && m.res ? m.res : '-');
    setTxt(hudVals.decode, m ? f(m.decode, 1) : '-');
    setTxt(hudVals.buffer, m ? f(m.buffer, 1) : '-');

    const lvl = hudScoreVal == null ? 'none' : hudLevel(hudScoreVal);
    setTxt(hudScoreNum, hudScoreVal == null ? '--' : String(Math.round(hudScoreVal)));
    setTxt(hudScoreLbl, HUD_LEVEL_TEXT[lvl]);
    if (lvl !== hudLvlShown) { hudLvlShown = lvl; hudEl.setAttribute('data-lvl', lvl); }

    if (hudState.mode === 'detailed') hudGraphs.forEach(hudDrawGraph);
  }

  // Positions without changing the saved preferred position (visual clamp only)
  function hudApplyPos(x, y) {
    const mx = Math.max(0, window.innerWidth - hudEl.offsetWidth);
    const my = Math.max(0, window.innerHeight - hudEl.offsetHeight);
    const cx = clamp(Math.round(x), 0, mx);
    const cy = clamp(Math.round(y), 0, my);
    hudEl.style.left = cx + 'px';
    hudEl.style.top = cy + 'px';
    hudEl.style.bottom = 'auto';
    return [cx, cy];
  }

  function hudApplyMode() {
    const detailed = hudState.mode === 'detailed';
    hudEl.classList.toggle('xh-detailed', detailed);
    hudEl.classList.toggle('xh-compact', !detailed);
    hudBtn.textContent = detailed ? '\u2212' : '+';
    hudBtn.title = detailed ? 'Compact mode' : 'Detailed mode';
    if (hudState.visible && hudState.x != null) hudApplyPos(hudState.x, hudState.y);
  }

  function hudToggleMode() {
    hudState.mode = hudState.mode === 'compact' ? 'detailed' : 'compact';
    hudApplyMode();
    hudSave();
    hudSchedule();
  }

  function hudToggle() {
    hudState.visible = !hudState.visible;
    hudSave();
    if (!hudEl) return;
    hudEl.style.display = hudState.visible ? 'block' : 'none';
    if (hudState.visible) {
      if (hudState.x != null) hudApplyPos(hudState.x, hudState.y);
      hudSchedule();
    } else if (hudRaf) {
      cancelAnimationFrame(hudRaf);
      hudRaf = 0;
    }
    toast(hudState.visible ? 'HUD enabled (Alt+G)' : 'HUD hidden (Alt+G)');
  }

  function hudInit() {
    if (hudEl) return;
    hudEl = h('div', { id: 'xct-hud', class: 'xh-compact' });

    const head = h('div', { class: 'xh-head', title: 'Drag to move \u00b7 double-click = compact/detailed' });
    hudScoreNum = h('span', { class: 'xh-score', text: '--' });
    hudScoreLbl = h('span', { class: 'xh-lbl', text: HUD_LEVEL_TEXT.none });
    hudScoreNum.__t = '--';
    hudScoreLbl.__t = HUD_LEVEL_TEXT.none;
    hudBtn = h('button', { type: 'button', class: 'xh-btn', text: '+' });
    head.append(
      h('span', { class: 'xh-dot' }),
      h('span', { class: 'xh-title', text: 'xCloud' }),
      hudScoreNum, hudScoreLbl, hudBtn
    );

    const grid = h('div', { class: 'xh-grid' });
    HUD_CELLS.forEach(([key, label, detailedOnly]) => {
      const v = h('span', { class: 'xh-v', text: '-' });
      v.__t = '-';
      hudVals[key] = v;
      const cls = 'xh-cell' + (detailedOnly ? ' xh-d' : '') + (key === 'res' ? ' xh-res' : '');
      grid.append(h('div', { class: cls }, v, h('span', { class: 'xh-k', text: label })));
    });

    const graphs = h('div', { class: 'xh-graphs' });
    hudGraphs.forEach((g) => {
      g.lbl = h('div', { class: 'xh-gl', text: g.name });
      g.lbl.__t = g.name;
      g.cv = h('canvas', { class: 'xh-cv' });
      g.ctx = g.cv.getContext('2d');
      hudSizeCanvas(g);
      graphs.append(g.lbl, g.cv);
    });

    hudEl.append(head, grid, graphs);
    document.body.append(hudEl);

    /* --- Drag (a single set of listeners, attached once) --- */
    let drag = null;
    let dragRaf = 0;
    const flushDrag = () => {
      dragRaf = 0;
      if (drag && drag.nx != null) hudApplyPos(drag.nx, drag.ny);
    };
    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || (e.target.closest && e.target.closest('.xh-btn'))) return;
      const r = hudEl.getBoundingClientRect();
      drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, nx: null, ny: null };
      try { head.setPointerCapture(e.pointerId); } catch (err) { /* ignored */ }
    });
    head.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.nx = e.clientX - drag.dx;
      drag.ny = e.clientY - drag.dy;
      if (!dragRaf) dragRaf = requestAnimationFrame(flushDrag);
    });
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
      if (drag.nx != null) {
        const [cx, cy] = hudApplyPos(drag.nx, drag.ny);
        hudState.x = cx;
        hudState.y = cy;
        hudSave();
      }
      drag = null;
    };
    head.addEventListener('pointerup', endDrag);
    head.addEventListener('pointercancel', endDrag);
    head.addEventListener('lostpointercapture', endDrag);

    head.addEventListener('dblclick', (e) => {
      if (e.target.closest && e.target.closest('.xh-btn')) return;
      hudToggleMode();
    });
    hudBtn.addEventListener('click', hudToggleMode);

    /* --- Resize: re-clamp, coalesced through a single rAF --- */
    let resizeRaf = 0;
    window.addEventListener('resize', () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        if (hudState.visible && hudState.x != null) hudApplyPos(hudState.x, hudState.y);
      });
    });

    hudEl.style.display = hudState.visible ? 'block' : 'none';
    hudApplyMode();
    hudSchedule();
  }

  /* ====================================================================
   *  v2.1 - Automatic game detection + Profile Manager
   *  Additive: does not modify HUD / WebRTC / Keyboard+Mouse. Uses only
   *  `settings`, PRESETS (keybind overrides on top of a base snapshot)
   *  and its own DOM elements (HUD row, Profile Manager panel).
   * ==================================================================== */
  const GP_KEY = 'xcloud-toolkit-profiles';
  const GP_MAX = 100;
  const GP_IDLE_MS = 3000; // normal detection interval
  const GP_FAST_MS = 1000; // while a transition is being confirmed
  const GP_RANGE = { mouseSens: [20, 300], adsSens: [20, 150], deadzone: [0, 30], steerSpeed: [10, 100] };
  const GP_NUM = Object.keys(GP_RANGE);
  const GP_CATS = { Shooter: 'shooter', FPS: 'shooter', Racing: 'racing', Sandbox: 'standard', Default: null };
  const GP_RULES = [
    [/\barc\s*raiders\b/i, 'Shooter'],
    [/\bforza\b|need for speed|\bf1\b|dirt rally|wreckfest|grid legends|the crew|gran turismo|assetto|burnout/i, 'Racing'],
    [/\bhalo\b|call of duty|battlefield|\bdoom\b|destiny|apex legends|valorant|overwatch|\bquake\b/i, 'FPS'],
    [/fortnite|\bgears\b|the division|borderlands|helldivers|cyberpunk|ready or not/i, 'Shooter'],
    [/minecraft|terraria|no man.?s sky|satisfactory|palworld|\bgrounded\b|valheim|roblox/i, 'Sandbox'],
  ];
  const GP_CODE_RE = /^[A-Z][A-Za-z0-9]{1,23}$/;
  const GP_BAD_SLUG = /^(recently-played|all-games|library|catalog|search|home|new|popular|browse)$/i;
  const GP_GENERIC = /^(xbox|xbox cloud gaming|cloud gaming|play|home|loading|sign in|games?|catalog|library|microsoft|xbox\.com)$/i;
  const GP_BASE_PRESETS = JSON.parse(JSON.stringify(PRESETS)); // snapshot before any override
  const gpHas = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  const gp = {
    inited: false, sig: '', cur: null, curKey: '', candKey: '', candN: 0,
    sel: '', pmOpen: false, capturing: false, capCode: '', listSig: null, bindSig: null, timer: 0, running: false,
  };
  let gpStore = { v: 1, active: null, profiles: [] };
  let gpUi = null;
  let gpHudG = null;
  let gpHudP = null;

  const GP_CSS = `
    #xct-hud .xgp-hud { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; padding-bottom: 5px; }
    #xct-hud .xgp-cell { min-width: 0; }
    #xct-hud .xgp-k { display: block; font-size: 9px; opacity: .55; }
    #xct-hud .xgp-v { display: block; font-size: 12px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #xgp-pm {
      position: fixed; top: 12px; left: 284px; z-index: 2147483646;
      width: 300px; max-height: calc(100vh - 80px); overflow: auto; box-sizing: border-box;
      padding: 12px; border-radius: 8px; display: none;
      background: rgba(20,20,20,.94); color: #fff;
      font: 13px system-ui, sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,.5);
    }
    #xgp-pm .xgp-hd { display: flex; justify-content: space-between; align-items: center; }
    #xgp-pm h5 { margin: 14px 0 2px; font-size: 12px; opacity: .8; text-transform: uppercase; letter-spacing: .04em; }
    #xgp-pm select, #xgp-pm input[type=text], #xgp-pm textarea { width: 100%; box-sizing: border-box; margin-top: 8px; }
    #xgp-pm .xgp-sum { margin-top: 8px; font: 12px/1.45 ui-monospace, Consolas, monospace; white-space: pre-wrap; opacity: .9; }
    #xgp-pm .xgp-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    #xgp-pm .xgp-row select { width: auto; flex: 1; margin-top: 0; }
    #xgp-pm button { padding: 4px 10px; border: 0; border-radius: 4px; background: #107c10; color: #fff; cursor: pointer; }
    #xgp-pm button.xgp-alt { background: #444; }
    #xgp-pm .xgp-bind { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font: 12px ui-monospace, Consolas, monospace; }
    #xgp-pm .xgp-bind button { padding: 0 8px; }
    #xgp-pm .xgp-none { margin-top: 4px; font-size: 12px; opacity: .6; }
  `;

  /* ---------- Name normalization / detection ---------- */
  function gpNorm(s) {
    const raw = String(s || '');
    const n = raw.replace(/[\u2122\u00ae\u00a9]/g, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return n || raw.toLowerCase().trim().slice(0, 80);
  }

  function gpCleanTitle(t) {
    if (!t) return '';
    const parts = String(t).split(/\s*[|\u2022\u00b7\u2013\u2014]\s*|\s+-\s+/);
    for (let p of parts) {
      p = p.replace(/[\u2122\u00ae\u00a9]/g, '')
        .replace(/^\s*(play|playing|launch)\s+/i, '')
        .replace(/\s+on\s+xbox(\.com| cloud gaming)?\s*$/i, '')
        .replace(/\s*\((beta|preview)\)\s*$/i, '')
        .replace(/\s+/g, ' ').trim();
      if (p.length < 2 || p.length > 80) continue;
      if (GP_GENERIC.test(p) || /xbox cloud gaming|xbox\.com|game pass/i.test(p)) continue;
      return p;
    }
    return '';
  }

  function gpFromUrl() {
    const m = location.pathname.match(/\/(?:launch|games?)\/([^/?#]+)(?:\/([A-Za-z0-9]{12}))?/i);
    if (!m) return null;
    let slug = m[1];
    try { slug = decodeURIComponent(slug); } catch (e) { /* ignored */ }
    let pid = m[2] ? m[2].toUpperCase() : '';
    if (/^[A-Za-z0-9]{12}$/.test(slug)) { if (!pid) pid = slug.toUpperCase(); slug = ''; }
    else if (GP_BAD_SLUG.test(slug)) return null;
    return { slug, pid };
  }

  const gpSlugName = (s) => s.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b[a-z]/g, (c) => c.toUpperCase());

  function gpAgrees(name, slug) {
    const sw = gpNorm(slug).split(' ').filter(Boolean);
    if (!sw.length) return true;
    const nw = new Set(gpNorm(name).split(' '));
    return sw.filter((w) => nw.has(w)).length * 2 >= sw.length;
  }

  function gpFromMeta() {
    const sels = ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[name="title"]'];
    for (const s of sels) {
      const el = document.querySelector(s);
      const n = el ? gpCleanTitle(el.getAttribute('content')) : '';
      if (n) return n;
    }
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      const txt = s.textContent || '';
      if (txt.length > 200000) continue;
      try {
        const d = JSON.parse(txt);
        for (const o of Array.isArray(d) ? d : [d]) {
          if (o && /VideoGame|Product|SoftwareApplication/i.test(String(o['@type']))) {
            const n = gpCleanTitle(o.name);
            if (n) return n;
          }
        }
      } catch (e) { /* ignored */ }
    }
    return '';
  }

  function gpFromDom() {
    const el = document.querySelector('main h1, h1');
    return el ? gpCleanTitle(el.textContent) : '';
  }

  function gpDetect(streaming = isStreaming()) {
    const inGame = /\/launch\//i.test(location.pathname) || streaming;
    if (!inGame) return null;
    const u = gpFromUrl();
    let name = '';
    for (const c of [gpCleanTitle(document.title), gpFromMeta(), gpFromDom()]) {
      if (c && (!u || !u.slug || gpAgrees(c, u.slug))) { name = c; break; }
    }
    if (!name && u && u.slug) name = gpSlugName(u.slug);
    if (!name && u && u.pid) name = 'Game ' + u.pid;
    if (!name) return null;
    return { name, pid: u ? u.pid : '', norm: gpNorm(name) };
  }

  const gpCategory = (name) => {
    for (const [re, cat] of GP_RULES) if (re.test(name)) return cat;
    return 'Default';
  };

  /* ---------- Storage ---------- */
  function gpId() {
    let id;
    do { id = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }
    while (gpStore.profiles.some((p) => p.id === id));
    return id;
  }

  function gpSanitizeBinds(b) {
    const out = {};
    if (!b || typeof b !== 'object' || Array.isArray(b)) return out;
    let n = 0;
    for (const [k, v] of Object.entries(b)) {
      if (n >= 64) break;
      if (!GP_CODE_RE.test(k) || MOVE_KEYS.includes(k)) continue;
      if (v === 'NONE' || (typeof v === 'string' && gpHas(BTN, v))) { out[k] = v; n++; }
    }
    return out;
  }

  function gpSanitize(r, keepId) {
    if (!r || typeof r !== 'object') return null;
    const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');
    const num = (v, k) => {
      const x = Number(v);
      return Number.isFinite(x) ? Math.round(clamp(x, GP_RANGE[k][0], GP_RANGE[k][1])) : defaults[k];
    };
    const p = {
      id: keepId && typeof r.id === 'string' && /^[a-z0-9]{4,24}$/i.test(r.id) ? r.id : gpId(),
      name: str(r.name, 40) || 'Profile',
      game: str(r.game, 80),
      match: r.match ? gpNorm(str(r.match, 80)) : '',
      pid: typeof r.pid === 'string' && /^[A-Za-z0-9]{12}$/.test(r.pid) ? r.pid.toUpperCase() : '',
      category: typeof r.category === 'string' && gpHas(GP_CATS, r.category) ? r.category : 'Default',
      preset: typeof r.preset === 'string' && gpHas(GP_BASE_PRESETS, r.preset) ? r.preset : 'shooter',
      binds: gpSanitizeBinds(r.binds),
    };
    GP_NUM.forEach((k) => { p[k] = num(r[k], k); });
    return p;
  }

  try {
    const raw = readJSON(GP_KEY);
    if (raw && Array.isArray(raw.profiles)) {
      const out = gpStore.profiles;
      const seen = new Set();
      for (const r of raw.profiles.slice(0, GP_MAX)) {
        const p = gpSanitize(r, true);
        if (!p) continue;
        while (seen.has(p.id)) p.id = gpId();
        seen.add(p.id);
        out.push(p);
      }
      gpStore.active = out.some((p) => p.id === raw.active) ? raw.active : null;
    }
  } catch (e) {
    logOnce('loading profiles', e);
    gpStore = { v: 1, active: null, profiles: [] };
  }

  function gpStoreSave() { writeJSON(GP_KEY, gpStore); }

  const gpActive = () => gpStore.profiles.find((p) => p.id === gpStore.active) || null;
  const gpSelected = () => gpStore.profiles.find((p) => p.id === gp.sel) || null;
  const gpFind = (d) => gpStore.profiles.find((p) => (d.pid && p.pid === d.pid) || (p.match && p.match === d.norm)) || null;

  function gpAdd(fields) {
    const list = gpStore.profiles;
    while (list.length >= GP_MAX) {
      const i = list.findIndex((q) => q.id !== gpStore.active);
      if (i < 0) return null;
      list.splice(i, 1);
    }
    const p = gpSanitize(fields, false);
    list.push(p);
    gpStoreSave();
    return p;
  }

  /* ---------- Keybinds: base snapshot + overrides ---------- */
  function gpApplyBinds(p) {
    for (const name of Object.keys(GP_BASE_PRESETS)) {
      const t = PRESETS[name];
      for (const k of Object.keys(t)) delete t[k];
      Object.assign(t, GP_BASE_PRESETS[name]);
    }
    if (p && PRESETS[p.preset]) {
      const t = PRESETS[p.preset];
      for (const [k, v] of Object.entries(p.binds)) {
        if (v === 'NONE') delete t[k];
        else if (gpHas(BTN, v)) t[k] = BTN[v];
      }
    }
    releaseAll(); // avoids buttons left pressed after the map changes
  }

  /* ---------- Settings <-> active profile sync ---------- */
  function gpFlush() {
    const p = gpActive();
    if (!p) return false;
    let ch = false;
    for (const k of GP_NUM) if (p[k] !== settings[k]) { p[k] = settings[k]; ch = true; }
    if (p.preset !== settings.preset && gpHas(GP_BASE_PRESETS, settings.preset)) {
      p.preset = settings.preset;
      ch = true;
      gpApplyBinds(p);
    }
    if (ch) gpStoreSave();
    return ch;
  }

  function gpApply(p, noFlush) {
    if (!noFlush) gpFlush(); // save the current settings into the old profile
    gpStore.active = p.id;
    for (const k of GP_NUM) settings[k] = p[k];
    if (settings.preset !== p.preset) {
      const sel = panelEl && panelEl.querySelector('[data-s="preset"]');
      if (sel) { sel.value = p.preset; sel.dispatchEvent(new Event('change')); } // updates the existing legend
      if (settings.preset !== p.preset) settings.preset = p.preset;
    }
    gpApplyBinds(p);
    save();
    try { syncControls(); } catch (e) { /* ignored */ }
    gpStoreSave();
    gpRenderHud();
  }

  function gpCreateFor(d) {
    gpFlush();
    const cat = gpCategory(d.name);
    return gpAdd({
      name: cat, game: d.name, match: d.norm, pid: d.pid, category: cat,
      preset: GP_CATS[cat] || settings.preset,
      mouseSens: settings.mouseSens, adsSens: settings.adsSens,
      deadzone: settings.deadzone, steerSpeed: settings.steerSpeed,
      binds: {},
    });
  }

  function gpClaim(p, d) {
    for (const q of gpStore.profiles) {
      if (q !== p && ((d.pid && q.pid === d.pid) || (d.norm && q.match === d.norm))) {
        q.pid = ''; q.match = ''; q.game = '';
      }
    }
    p.pid = d.pid || '';
    p.match = d.norm || '';
    p.game = d.name || '';
    gpStoreSave();
  }

  function gpResolveCurrent() {
    if (!gp.cur) return;
    const p = gpFind(gp.cur);
    if (p && p.id !== gpStore.active) gpApply(p);
  }

  function gpSetGame(d) {
    gp.cur = d;
    gp.curKey = d ? (d.pid || d.norm) : '';
    if (d) {
      let p = gpFind(d);
      if (!p) p = gpCreateFor(d);
      else {
        let ch = false;
        if (d.pid && !p.pid) { p.pid = d.pid; ch = true; }
        if (!p.match) { p.match = d.norm; ch = true; }
        if (!p.game) { p.game = d.name; ch = true; }
        if (ch) gpStoreSave();
      }
      if (p && gpStore.active !== p.id) {
        gpApply(p);
        toast('Profile: ' + p.name + ' (' + d.name + ')');
      }
    }
    gpRenderHud();
    if (gp.pmOpen) gpRenderPm();
  }

  function gpDetectStep() {
    const streaming = isStreaming();
    const sig = location.href + '\u0001' + document.title + '\u0001' + (streaming ? '1' : '0');
    if (sig === gp.sig && gp.curKey && !gp.candN) return; // nothing changed
    gp.sig = sig;
    const d = gpDetect(streaming);
    const k = d ? (d.pid || d.norm) : '';
    if (k === gp.curKey) { gp.candKey = ''; gp.candN = 0; return; }
    if (!gp.candN || k !== gp.candKey) { gp.candKey = k; gp.candN = 1; return; } // confirmed over 2 cycles
    gp.candKey = '';
    gp.candN = 0;
    gpSetGame(d);
  }

  function gpSchedule() {
    clearTimeout(gp.timer);
    gp.timer = 0;
    if (gp.running) gp.timer = setTimeout(gpTick, gp.candN ? GP_FAST_MS : GP_IDLE_MS);
  }

  function gpTick() {
    clearTimeout(gp.timer);
    gp.timer = 0;
    if (!gp.running) return;
    try {
      if (!document.hidden) {
        gpFlush();
        gpDetectStep();
        if (gp.pmOpen) gpRenderPm();
      }
    } catch (e) { logOnce('game detection', e); }
    gpSchedule();
  }

  function gpStart() {
    gp.running = true;
    gpTick();
  }

  function gpStop() {
    gp.running = false;
    clearTimeout(gp.timer);
    gp.timer = 0;
  }

  /* ---------- Profile Manager operations ---------- */
  function gpDelete(p) {
    const wasActive = gpStore.active === p.id;
    gpStore.profiles = gpStore.profiles.filter((q) => q !== p);
    if (wasActive) {
      gpStore.active = null;
      const np = gp.cur ? gpCreateFor(gp.cur) : null;
      if (np) gpApply(np, true); else gpApplyBinds(null);
    }
    gpStoreSave();
    gp.sel = gpStore.active || '';
  }

  function gpReset(p) {
    p.preset = GP_CATS[p.category] || defaults.preset;
    GP_NUM.forEach((k) => { p[k] = defaults[k]; });
    p.binds = {};
    if (p.id === gpStore.active) gpApply(p, true); else gpStoreSave();
  }

  const gpPlain = (p) => ({
    name: p.name, game: p.game, match: p.match, pid: p.pid, category: p.category, preset: p.preset,
    mouseSens: p.mouseSens, adsSens: p.adsSens, deadzone: p.deadzone, steerSpeed: p.steerSpeed,
    binds: { ...p.binds },
  });

  function gpExport(list) {
    const txt = JSON.stringify({ app: 'xcloud-toolkit', version: 1, profiles: list.map(gpPlain) }, null, 2);
    gpUi.io.value = txt;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(() => {});
    } catch (e) { /* ignored */ }
    toast('Exported ' + list.length + ' profile(s)');
  }

  function gpImport(text) {
    if (!text || text.length > 262144) { toast('Import: empty or too large'); return; }
    let data;
    try { data = JSON.parse(text); } catch (e) { toast('Import: invalid JSON'); return; }
    const arr = Array.isArray(data) ? data : (data && Array.isArray(data.profiles) ? data.profiles : [data]);
    let n = 0;
    for (const r of arr.slice(0, 50)) {
      if (gpStore.profiles.length >= GP_MAX) break;
      if (!r || typeof r !== 'object' || typeof r.name !== 'string') continue;
      const p = gpSanitize(r, false);
      if (p.pid || p.match) gpClaim(p, { pid: p.pid, norm: p.match, name: p.game });
      gpStore.profiles.push(p);
      gp.sel = p.id;
      n++;
    }
    gpStoreSave();
    if (n) gpResolveCurrent();
    toast(n ? 'Imported ' + n + ' profile(s)' : 'Import: no valid profiles');
  }

  /* ---------- UI: HUD (added row) ---------- */
  function gpRenderHud() {
    if (!gpHudG) return;
    const p = gpActive();
    setTxt(gpHudG, gp.cur ? gp.cur.name : '-');
    setTxt(gpHudP, p ? p.name : '-');
  }

  /* ---------- UI: Profile Manager ---------- */
  function gpSyncName() {
    const p = gpSelected();
    gpUi.name.value = p ? p.name : '';
  }

  function gpEndCapture() {
    gp.capturing = false;
    if (gp.pmOpen) gpRenderPm();
  }

  function gpTogglePm(force) {
    const open = typeof force === 'boolean' ? force : !gp.pmOpen;
    gp.pmOpen = open;
    gpUi.root.style.display = open ? 'block' : 'none';
    if (open) {
      if (document.pointerLockElement) document.exitPointerLock();
      gp.listSig = null;
      gp.bindSig = null;
      gpRenderPm();
      gpSyncName();
    } else {
      gp.capturing = false;
    }
  }

  function gpRenderPm() {
    if (!gpUi) return;
    gpFlush();
    const list = gpStore.profiles;
    if (!list.some((p) => p.id === gp.sel)) gp.sel = gpStore.active || (list[0] ? list[0].id : '');

    const sig = gpStore.active + '|' + list.map((p) => p.id + ':' + p.name + ':' + p.game).join(',');
    if (sig !== gp.listSig) {
      gp.listSig = sig;
      gpUi.sel.replaceChildren(...list.map((p) => h('option', {
        value: p.id,
        text: (p.id === gpStore.active ? '\u2605 ' : '') + p.name + ' \u00b7 ' + (p.game || 'no game'),
      })));
    }
    if (gpUi.sel.value !== gp.sel) gpUi.sel.value = gp.sel;

    const p = gpSelected();
    setTxt(gpUi.sum, p
      ? `Game: ${p.game || '-'}\nCategory: ${p.category} \u00b7 Preset: ${p.preset}\n`
        + `Mouse ${p.mouseSens}% \u00b7 ADS ${p.adsSens}% \u00b7 Deadzone ${p.deadzone}% \u00b7 Steer ${p.steerSpeed}%\n`
        + (p.id === gpStore.active ? 'Status: ACTIVE' : 'Status: inactive')
      : 'No profiles yet. Start a game or create one.');

    const bs = p ? p.id + JSON.stringify(p.binds) : '';
    if (bs !== gp.bindSig) {
      gp.bindSig = bs;
      const rows = p ? Object.entries(p.binds).map(([k, v]) => h('div', { class: 'xgp-bind' },
        h('span', { text: k + ' \u2192 ' + (v === 'NONE' ? 'unbound' : v) }),
        h('button', { type: 'button', class: 'xgp-alt', 'data-a': 'rmbind', 'data-c': k, text: '\u00d7' }))) : [];
      if (!rows.length) rows.push(h('div', { class: 'xgp-none', text: 'No custom binds' }));
      gpUi.binds.replaceChildren(...rows);
    }
    setTxt(gpUi.cap, gp.capturing ? 'Press a key\u2026 (Esc cancels)' : (gp.capCode ? 'Key: ' + gp.capCode : 'Capture key'));
  }

  function gpOnClick(e) {
    try { gpOnClickInner(e); } catch (err) { logOnce('profile manager', err); }
  }

  function gpOnClickInner(e) {
    const t = e.target && e.target.closest ? e.target.closest('[data-a]') : null;
    if (!t || !gpUi.root.contains(t)) return;
    const a = t.getAttribute('data-a');
    const p = gpSelected();
    const name = gpUi.name.value.trim().slice(0, 40);
    switch (a) {
      case 'close':
        gpTogglePm(false);
        return;
      case 'cap':
        gp.capturing = !gp.capturing;
        if (gp.capturing) gp.capCode = '';
        break;
      case 'create': {
        gpFlush();
        const act = gpActive();
        const np = gpAdd({
          name: name || 'New profile', game: '', match: '', pid: '', category: 'Default',
          preset: settings.preset, mouseSens: settings.mouseSens, adsSens: settings.adsSens,
          deadzone: settings.deadzone, steerSpeed: settings.steerSpeed, binds: act ? act.binds : {},
        });
        if (!np) { toast('Profile limit reached'); break; }
        gp.sel = np.id;
        gpApply(np);
        gpSyncName();
        break;
      }
      case 'rename':
        if (!p) break;
        if (!name) { toast('Enter a profile name'); break; }
        p.name = name;
        gpStoreSave();
        break;
      case 'dup': {
        if (!p) break;
        gpFlush();
        const np = gpAdd({ ...p, name: name && name !== p.name ? name : p.name + ' copy', game: '', match: '', pid: '' });
        if (!np) { toast('Profile limit reached'); break; }
        gp.sel = np.id;
        gpSyncName();
        break;
      }
      case 'del':
        if (!p || !window.confirm('Delete profile "' + p.name + '"?')) break;
        gpDelete(p);
        gpSyncName();
        break;
      case 'reset':
        if (!p || !window.confirm('Reset profile "' + p.name + '" to defaults?')) break;
        gpReset(p);
        break;
      case 'use':
        if (p && p.id !== gpStore.active) { gpApply(p); toast('Profile: ' + p.name); }
        break;
      case 'bind':
        if (!p) break;
        if (!gp.cur) { toast('No game detected'); break; }
        gpClaim(p, gp.cur);
        if (p.id !== gpStore.active) gpApply(p);
        toast('"' + p.name + '" -> ' + gp.cur.name);
        break;
      case 'addbind':
        if (!p || !gp.capCode) { toast('Capture a key first'); break; }
        if (!gpHas(p.binds, gp.capCode) && Object.keys(p.binds).length >= 64) { toast('Too many binds'); break; }
        p.binds[gp.capCode] = gpUi.btn.value;
        gp.capCode = '';
        if (p.id === gpStore.active) gpApplyBinds(p);
        gpStoreSave();
        break;
      case 'rmbind': {
        const c = t.getAttribute('data-c');
        if (!p || !c || !gpHas(p.binds, c)) break;
        delete p.binds[c];
        if (p.id === gpStore.active) gpApplyBinds(p);
        gpStoreSave();
        break;
      }
      case 'exp':
        if (!p) break;
        gpFlush();
        gpExport([p]);
        break;
      case 'expall':
        gpFlush();
        gpExport(gpStore.profiles);
        break;
      case 'imp':
        gpImport(gpUi.io.value);
        break;
      default:
        return;
    }
    gpRenderPm();
    gpRenderHud();
  }

  function gpOnKeyDown(e) {
    if (gp.capturing) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.code === 'Escape') { gpEndCapture(); return; }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (!GP_CODE_RE.test(e.code) || MOVE_KEYS.includes(e.code)) { toast('Key not available for binds'); return; }
      gp.capCode = e.code;
      gpEndCapture();
      return;
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyJ') {
      e.preventDefault();
      e.stopImmediatePropagation();
      gpTogglePm();
    }
  }

  function gpBuildUi() {
    const ui = { root: h('div', { id: 'xgp-pm' }) };
    ui.sel = h('select');
    ui.sum = h('div', { class: 'xgp-sum' });
    ui.name = h('input', { type: 'text', maxlength: '40', placeholder: 'Profile name' });
    ui.binds = h('div');
    ui.cap = h('button', { type: 'button', class: 'xgp-alt', 'data-a': 'cap', text: 'Capture key' });
    ui.btn = h('select');
    Object.keys(BTN).forEach((n) => ui.btn.append(h('option', { value: n, text: n })));
    ui.btn.append(h('option', { value: 'NONE', text: '(unbound)' }));
    ui.io = h('textarea', { rows: '6', spellcheck: 'false', placeholder: 'Profile JSON' });
    const row = (...c) => h('div', { class: 'xgp-row' }, ...c);
    const b = (a, t, alt) => h('button', alt ? { type: 'button', class: 'xgp-alt', 'data-a': a, text: t } : { type: 'button', 'data-a': a, text: t });
    ui.root.append(
      h('div', { class: 'xgp-hd' }, h('b', { text: 'Profile Manager' }), b('close', '\u00d7', true)),
      ui.sel, ui.sum, ui.name,
      row(b('create', 'Create'), b('rename', 'Rename', true), b('dup', 'Duplicate', true), b('del', 'Delete', true), b('reset', 'Reset', true)),
      row(b('use', 'Activate'), b('bind', 'Use for current game')),
      h('h5', { text: 'Custom keybinds' }), ui.binds,
      row(ui.cap, ui.btn, b('addbind', 'Add')),
      h('h5', { text: 'Import / Export' }), ui.io,
      row(b('exp', 'Export selected'), b('expall', 'Export all', true), b('imp', 'Import'))
    );
    ui.root.addEventListener('click', gpOnClick);
    ui.root.addEventListener('change', (e) => {
      if (e.target !== ui.sel) return;
      gp.sel = ui.sel.value;
      gpSyncName();
      gpRenderPm();
    });
    ui.root.addEventListener('keydown', (e) => e.stopPropagation());
    ui.root.addEventListener('keyup', (e) => e.stopPropagation());
    gpUi = ui;
  }

  function gpInjectStyle() {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(GP_CSS);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      return;
    } catch (e) { /* fall through to the fallback */ }
    const style = document.createElement('style');
    style.id = 'xgp-style';
    style.textContent = GP_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function gpInit() {
    if (gp.inited) return;
    gp.inited = true;
    gpInjectStyle();
    gpBuildUi();

    // HUD rows (added, without modifying the HUD code)
    const grid = hudEl ? hudEl.querySelector('.xh-grid') : null;
    if (grid) {
      gpHudG = h('span', { class: 'xgp-v', text: '-' });
      gpHudP = h('span', { class: 'xgp-v', text: '-' });
      gpHudG.__t = '-';
      gpHudP.__t = '-';
      hudEl.insertBefore(h('div', { class: 'xgp-hud' },
        h('div', { class: 'xgp-cell' }, h('span', { class: 'xgp-k', text: 'Current Game:' }), gpHudG),
        h('div', { class: 'xgp-cell' }, h('span', { class: 'xgp-k', text: 'Current Profile:' }), gpHudP)
      ), grid);
    }

    // Entry in the existing panel
    if (panelEl) {
      const openBtn = h('button', { type: 'button', class: 'xct-alt', text: 'Profile Manager (Alt+J)' });
      openBtn.addEventListener('click', () => gpTogglePm());
      panelEl.append(h('h5', { text: 'Profiles' }), openBtn);
    }
    document.body.append(gpUi.root);

    // Saved state: the current settings are the source of truth at startup
    gpFlush();
    gpApplyBinds(gpActive());

    window.addEventListener('keydown', gpOnKeyDown, true); // registered before the KBM listeners
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') gpFlush();
    });
    gpRenderHud();
  }

  /* ---------- Screenshot & fullscreen ---------- */
  function screenshot() {
    const video = document.querySelector('video');
    if (!video || !video.videoWidth) { toast('No video stream available'); return; }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { toast('Screenshot failed'); return; }
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) { toast('Screenshot failed'); return; }
        let url = null;
        try {
          url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `xcloud-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          toast('Screenshot saved');
        } catch (e) {
          toast('Screenshot failed');
        } finally {
          if (url) setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
      }, 'image/png');
    } catch (e) {
      toast('Screenshot failed');
    }
  }

  function toggleFullscreen() {
    try {
      const result = document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen();

      if (result && result.catch) {
        result.catch(() => toast('Fullscreen blocked'));
      }
    } catch (e) {
      toast('Fullscreen blocked');
    }
  }

  /* ---------- Shortcuts ---------- */
  function onKey(e) {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    switch (e.code) {
      case 'KeyS':
        settings.statsVisible = !settings.statsVisible;
        statsEl.style.display = settings.statsVisible ? 'block' : 'none';
        save();
        break;
      case 'KeyV':
        panelEl.style.display = panelEl.style.display === 'block' ? 'none' : 'block';
        break;
      case 'KeyP':
        screenshot();
        break;
      case 'KeyF':
        toggleFullscreen();
        break;
      case 'KeyK':
        setKbm(!kbmEnabled);
        break;
      case 'KeyG':
        hudToggle();
        break;
      case 'KeyM':
        if (document.pointerLockElement) document.exitPointerLock();
        else lockPointer();
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  /* ---------- Lifecycle: timers, observer, saving ---------- */
  let statsTimer = 0;
  let playtimeTimer = 0;
  let filterObserver = null;
  let filtersRaf = 0;
  let unloading = false;

  function runFilters() {
    filtersRaf = 0;
    try { applyFilters(); } catch (e) { logOnce('filters', e); }
  }

  // Reacts only to added <video> nodes; a single rAF per frame
  function onDomMutations(muts) {
    if (filtersRaf) return;
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n.nodeName === 'VIDEO' || (n.firstElementChild && n.querySelector('video')))) {
          filtersRaf = requestAnimationFrame(runFilters);
          return;
        }
      }
    }
  }

  function stopTimers() {
    clearInterval(statsTimer);
    clearInterval(playtimeTimer);
    statsTimer = 0;
    playtimeTimer = 0;
    gpStop();
    if (hudRaf) { cancelAnimationFrame(hudRaf); hudRaf = 0; }
    if (filtersRaf) { cancelAnimationFrame(filtersRaf); filtersRaf = 0; }
    if (filterObserver) filterObserver.disconnect();
  }

  function startTimers() {
    stopTimers(); // never two sets of timers
    lastTick = Date.now();
    statsTimer = setInterval(updateStats, 1000);
    playtimeTimer = setInterval(tickPlaytime, 1000);
    if (filterObserver && document.body) filterObserver.observe(document.body, { childList: true, subtree: true });
    gpStart();
  }

  function persistState() {
    try { savePlaytime(); flushSettingsNow(); gpFlush(); } catch (e) { logOnce('saving state', e); }
  }

  function onPageHide() {
    unloading = true;
    persistState();
    stopTimers();
  }

  // beforeunload can be cancelled by the user: restart the timers if the page stays
  function onBeforeUnload() {
    persistState();
    stopTimers();
    setTimeout(() => { if (!unloading) startTimers(); }, 1000);
  }

  function onPageShow(e) {
    if (e.persisted) { unloading = false; startTimers(); }
  }

  /* ---------- Startup ---------- */
  let initDone = false;
  function init() {
    if (initDone) return;
    initDone = true;
    try {
      injectStyle();
      buildUI();
      hudInit();
      gpInit();

      window.addEventListener('keydown', onKey, true);
      window.addEventListener('keydown', onKbmKeyDown, true);
      window.addEventListener('keyup', onKbmKeyUp, true);
      window.addEventListener('blur', () => { if (kbmEnabled) releaseAll(); });
      document.addEventListener('mousemove', onKbmMouseMove, true);
      document.addEventListener('mousedown', onKbmMouseDown, true);
      document.addEventListener('mouseup', onKbmMouseUp, true);
      document.addEventListener('wheel', onKbmWheel, { capture: true, passive: false });
      document.addEventListener('contextmenu', (e) => {
        if (kbmEnabled && document.pointerLockElement) e.preventDefault();
      }, true);
      document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement) toast('Mouse locked. Press Esc to release.');
        else {
          Object.entries(MOUSEMAP).forEach(([button, gamepadButton]) => {
            setSourceButton('mouse:' + button, gamepadButton, false);
          });
          mdx = 0;
          mdy = 0;
          mouseHeld.clear();
        }
      });

      filterObserver = new MutationObserver(onDomMutations);
      startTimers();
      window.addEventListener('pagehide', onPageHide);
      window.addEventListener('pageshow', onPageShow);
      window.addEventListener('beforeunload', onBeforeUnload);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') { savePlaytime(); flushSettingsNow(); }
      });

      if (settings.kbm) setKbm(true, true);
      toast('Xbox Cloud active \u2022 Alt+V = panel, Alt+K = keyboard & mouse, Alt+G = HUD');
      console.log('[Xbox Cloud] interface initialized');
    } catch (e) {
      initDone = false; // allow retry after a transient initialization failure
      console.error('[Xbox Cloud] initialization error:', e);
    }
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
