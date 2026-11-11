const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(__dirname + '/toolkit.js', 'utf8');
const update = source.slice(source.indexOf('  function updateVirtualPad()'), source.indexOf('  function kbmLoop()'));
const release = source.slice(source.indexOf('  function releaseAll()'), source.indexOf('  function updateVirtualPad()'));
function pad(sens = 100, dz = 10, ads = false, preset = 'shooter') {
  const c = vm.createContext({
    settings: { mouseSens: sens, adsSens: 70, deadzone: dz, preset, steerSpeed: 60 },
    keysDown: new Set(), keyBindingsDown: new Map(), buttonSources: new Map(), analogButtons: new Map(),
    mouseHeld: new Set(), mdx: 0, mdy: 0, mouseX: 0, mouseY: 0, steer: 0, thr: 0, brk: 0,
    lastPadTime: 0, now: 0, wheelTimer: null, clearTimeout,
    BTN: { RT: 7, LT: 6 }, vpad: { axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: ads && i === 6 })) },
    clamp: (v, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v)),
    setAnalog() {}, setButton() {},
  });
  c.performance = { now: () => c.now };
  vm.runInContext(update + release, c);
  c.step = (x, y = 0, hz = 60) => { c.now += 1000 / hz; c.mdx = x; c.mdy = y; c.updateVirtualPad(); return Math.hypot(c.vpad.axes[2], c.vpad.axes[3]); };
  return c;
}
const tiny = pad();
assert(tiny.step(1) < 0.02, 'tiny movement must not jump to deadzone');
assert(pad().step(25) < 0.3, '25 pixels must no longer saturate the stick');
assert(pad(100, 10, true).step(10) < pad().step(10), 'ADS reduces input');
assert(pad(20).step(10) < pad(300).step(10), 'sensitivity remains adjustable');
for (const dz of [0, 10, 30]) {
  const c = pad(300, dz);
  assert(c.step(100000, 100000) <= 1.00000001, 'diagonal input stays inside unit circle');
  for (let i = 0; i < 30; i++) c.step(0);
  assert.equal(c.step(0), 0, 'camera returns to exact rest');
}
const velocities = [30, 60, 120, 240].map(hz => {
  const c = pad();
  for (let i = 0; i < hz; i++) c.step(600 / hz, 0, hz);
  return c.vpad.axes[2];
});
assert(Math.max(...velocities) - Math.min(...velocities) < 0.001, 'velocity is frame-rate independent');
const c = pad();
c.keysDown.add('KeyW'); c.keysDown.add('KeyD'); c.step(10);
assert(Math.abs(Math.hypot(...c.vpad.axes.slice(0, 2)) - 1) < 1e-9, 'WASD diagonal normalization preserved');
c.releaseAll();
assert.equal(c.mouseX, 0); assert.equal(c.mouseY, 0);
assert(c.vpad.axes.every(v => v === 0), 'release clears movement');
console.log('Mouse regression checks passed (sensitivity, ADS, deadzone, bounds, rest, frame rates, WASD, reset).');
