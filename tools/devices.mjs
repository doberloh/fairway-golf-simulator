// Devices to measure as, for tools/frame-ab.mjs --device.
//
// THIS MACHINE CANNOT BE A PHONE, so a device is three things applied to it:
//   - its screen: viewport in CSS pixels and device pixel ratio, so the game
//     draws the same number of pixels the device would;
//   - its processor: Chrome's CPU throttling (DevTools Emulation), at the ratio
//     of this machine's single-core score to the device's;
//   - its graphics: not emulated -- the card's measured time is SCALED by the
//     device's peak compute and memory bandwidth against this card's.
//
// The graphics scale is a rough estimate, PLACED, not measured: the factor is
// the geometric mean of the compute ratio and the bandwidth ratio, because a
// frame here is partly shading (compute) and partly shadow maps and overdraw
// (bandwidth), and peak figures overstate phones against desktops anyway. It
// says "about how many times slower", good for ranking changes and finding the
// tier a device can hold -- never a number to promise a player. The real check
// is a real device (TODO, *A real phone, an iPad and a weak laptop*).
//
// Sources for every figure are in RESEARCH.md, *Devices for the frame tools*.
// Bandwidth figures are arithmetic from the memory type (bus width x data
// rate), PLACED where no listing gave one.
export const HOST = {name: 'RTX 4090 + Ryzen 9 7950X (this machine)', tflops: 82.6, bandwidth: 1008, singleCore: 2994};

export const DEVICES = {
 // The profiler's own screen: a laptop panel's 1600x900 at 2x.
 desktop: {label: 'This machine (no scaling)', viewport: [1600, 900], dpr: 2, tflops: HOST.tflops,
  bandwidth: HOST.bandwidth, singleCore: HOST.singleCore, tier: 'ultra'},
 'weak-laptop': {label: 'Older laptop, Intel UHD 620, i5-8250U', viewport: [1920, 1080], dpr: 1,
  tflops: .38, bandwidth: 38, singleCore: 1127, tier: 'low'},
 'macbook-air-m1': {label: 'MacBook Air M1 (8-core GPU)', viewport: [1440, 900], dpr: 2,
  tflops: 2.6, bandwidth: 68, singleCore: 2340, tier: 'medium'},
 'apu-laptop': {label: 'Laptop with Radeon 780M (Ryzen 7 7840U)', viewport: [1920, 1200], dpr: 1.25,
  tflops: 4.2, bandwidth: 120, singleCore: 2500, tier: 'medium'},
 'iphone-13': {label: 'iPhone 13 (A15, 5-core GPU)', viewport: [844, 390], dpr: 3,
  tflops: 1.71, bandwidth: 34, singleCore: 2277, tier: 'medium'},
 'android-flagship': {label: 'Android flagship, Snapdragon 8 Gen 2 (Adreno 740)', viewport: [915, 412], dpr: 2.625,
  tflops: 1.74, bandwidth: 68, singleCore: 2004, tier: 'medium'},
 'android-budget': {label: 'Budget Android, Helio G85 (Mali-G52 MP2)', viewport: [800, 360], dpr: 2,
  tflops: .072, bandwidth: 15, singleCore: 420, tier: 'low'},
};

export const gpuScale = d => Math.sqrt((HOST.tflops / d.tflops) * (HOST.bandwidth / d.bandwidth));
export const cpuThrottle = d => Math.max(1, HOST.singleCore / d.singleCore);
