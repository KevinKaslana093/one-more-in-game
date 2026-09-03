export function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function totalWeight(passengers) {
  return passengers.reduce((sum, passenger) => sum + Number(passenger.weight || 0), 0);
}

export function rectFits(passenger, bounds, tolerance = 0) {
  if (![passenger.x, passenger.y, passenger.w, passenger.h].every(Number.isFinite)) return false;
  return passenger.x - passenger.w / 2 >= bounds.x - tolerance &&
    passenger.x + passenger.w / 2 <= bounds.x + bounds.w + tolerance &&
    passenger.y - passenger.h / 2 >= bounds.y - tolerance &&
    passenger.y + passenger.h / 2 <= bounds.y + bounds.h + tolerance;
}

export function canClose({ passengers, target, capacity, bounds, tolerance = 0 }) {
  return passengers.length >= target &&
    totalWeight(passengers) <= capacity &&
    passengers.every((passenger) => rectFits(passenger, bounds, tolerance));
}

export function floorScore({ count, target, multiplier, timeLeft, floor, scoreBoost = 1 }) {
  const extra = Math.max(0, count - target);
  const base = floor * 180 + count * 90 + Math.floor(Math.max(0, timeLeft) * 8);
  return Math.round((base + extra * 160) * Math.max(1, multiplier) * scoreBoost);
}

export function safeSave(raw) {
  const defaults = {
    version: 1,
    bestScore: 0,
    coins: 0,
    highFloor: 1,
    tutorialDone: false,
    muted: false,
    reducedMotion: false,
    vibration: true,
    quality: 'high'
  };
  if (!raw || typeof raw !== 'object') return defaults;
  return {
    ...defaults,
    bestScore: Number.isFinite(raw.bestScore) ? Math.max(0, raw.bestScore) : 0,
    coins: Number.isFinite(raw.coins) ? Math.max(0, raw.coins) : 0,
    highFloor: Number.isFinite(raw.highFloor) ? Math.min(6, Math.max(1, raw.highFloor)) : 1,
    tutorialDone: Boolean(raw.tutorialDone),
    muted: Boolean(raw.muted),
    reducedMotion: Boolean(raw.reducedMotion),
    vibration: raw.vibration !== false,
    quality: ['low', 'high'].includes(raw.quality) ? raw.quality : 'high'
  };
}
