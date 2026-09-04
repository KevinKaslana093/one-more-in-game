// Presentation only. All positions, collision sizes and game decisions stay in main.js.
const FONT = '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif';
const SPRITE_ORDER = ['courier', 'bride', 'corgi', 'uncle', 'office', 'granny', 'boxes', 'student'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function rr(c, x, y, w, h, r, fill, stroke, line = 1) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = line; c.stroke(); }
}
function grad(c, x, y, w, h, stops) {
  const g = c.createLinearGradient(x, y, x + w, y + h);
  stops.forEach(([offset, color]) => g.addColorStop(offset, color));
  return g;
}
function text(c, value, x, y, size, color, align = 'center', weight = 800) {
  c.font = `${weight} ${size}px ${FONT}`; c.textAlign = align; c.fillStyle = color; c.fillText(value, x, y);
}
function poly(c, points, fill) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath(); c.fillStyle = fill; c.fill();
}

export function artIcon(id) {
  const symbols = {
    lube: '<path d="M31 10h12l3 18-6 5-12-7z" fill="#33a6b9"/><path d="M29 27c-10 7-13 23-11 33 1 7 9 11 20 10s19-5 20-12c1-10-3-25-13-31z" fill="#f9f4d6" stroke="#c6c6a1" stroke-width="2"/><path d="M20 40h34v16c-12 5-23 4-34-1z" fill="#4ccbbb"/><path d="M36 37c-11 13-9 18-2 19 8 1 11-4 2-19" fill="#effffc"/><path d="M25 32c-3 5-5 13-5 18" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
    rope: '<path d="M22 65C4 42 21 12 37 15c25 5 14 26 6 43" fill="none" stroke="#b66e1b" stroke-width="13" stroke-linecap="round"/><path d="M22 62C9 43 21 14 37 18c21 4 11 25 4 41" fill="none" stroke="#ffc957" stroke-width="7" stroke-dasharray="4 3"/><path d="M20 59l10 8-6 9-10-8zm18-7l12 6-4 11-12-6z" fill="#56868d" stroke="#234750" stroke-width="2"/>',
    cart: '<path d="M26 56V20q0-7 7-7h22q6 0 6 7v36" fill="none" stroke="#567177" stroke-width="7" stroke-linecap="round"/><path d="M27 50h35l9 12-49 6-12-8z" fill="#8b92e7" stroke="#505ba5" stroke-width="2"/><path d="M22 60l49-4v9l-49 8z" fill="#666cbb"/><circle cx="27" cy="74" r="6" fill="#2e3f48"/><circle cx="62" cy="70" r="6" fill="#2e3f48"/><path d="M27 37V20q0-4 5-4h20" fill="none" stroke="#c7e5e3" stroke-width="3"/>',
    capacity: '<path d="M32 7h16l4 11 12 1 8 14-7 10 5 12-12 12-12-4-9 9-15-6-1-13-12-7 2-16 13-5z" fill="#78b5b8" stroke="#397479" stroke-width="3"/><circle cx="40" cy="39" r="17" fill="#e0f4e8"/><circle cx="40" cy="39" r="9" fill="#568b91"/>',
    compact: '<rect x="17" y="16" width="47" height="48" rx="13" fill="#ffd46a" stroke="#db9834" stroke-width="3"/><path d="M9 9l19 19m-16 0h16V12m45 61L54 54m0 16V54h16" fill="none" stroke="#d96e47" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
    coins: '<ellipse cx="43" cy="63" rx="29" ry="10" fill="#bd711e"/><rect x="14" y="49" width="58" height="14" fill="#e3a52d"/><ellipse cx="43" cy="49" rx="29" ry="10" fill="#ffdf77"/><circle cx="37" cy="32" r="26" fill="#ffc841" stroke="#e89827" stroke-width="4"/><circle cx="37" cy="32" r="20" fill="none" stroke="#ffecab" stroke-width="3"/><path d="M37 16l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" fill="#fff0b5"/>'
  };
  return `<svg viewBox="0 0 80 84" class="art-icon" aria-hidden="true">${symbols[id] || symbols.coins}</svg>`;
}

export class ArtDirector {
  constructor() {
    this.atlas = new Image();
    this.atlas.decoding = 'async';
    this.ready = false;
    this.failed = false;
    this.frames = {};
    this.landing = new Map();
    this.cachedLobby = this.createLobby();
    this.atlas.onload = () => {
      this.indexAtlas();
      this.ready = true;
      document.documentElement.dataset.artReady = 'true';
    };
    this.atlas.onerror = () => {
      this.failed = true;
      document.documentElement.dataset.artReady = 'fallback';
    };
    this.atlas.src = new URL('./assets/characters-v2.png', import.meta.url).href;
  }

  indexAtlas() {
    // Trim transparent padding at draw time, keeping the delivered PNG untouched.
    const surface = document.createElement('canvas');
    surface.width = this.atlas.naturalWidth; surface.height = this.atlas.naturalHeight;
    const c = surface.getContext('2d', { willReadFrequently: true });
    c.drawImage(this.atlas, 0, 0);
    SPRITE_ORDER.forEach((id, index) => {
      const x0 = Math.round(index % 4 * surface.width / 4);
      const y0 = Math.round(Math.floor(index / 4) * surface.height / 2);
      const w = Math.round((index % 4 + 1) * surface.width / 4) - x0;
      const h = Math.round((Math.floor(index / 4) + 1) * surface.height / 2) - y0;
      const pixels = c.getImageData(x0, y0, w, h).data;
      const cols = new Uint16Array(w); const rows = new Uint16Array(h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (pixels[(y * w + x) * 4 + 3] > 100) { cols[x]++; rows[y]++; }
      }
      let left = 0, right = w - 1, top = 0, bottom = h - 1;
      while (left < right && cols[left] < 5) left++;
      while (right > left && cols[right] < 5) right--;
      while (top < bottom && rows[top] < 5) top++;
      while (bottom > top && rows[bottom] < 5) bottom--;
      this.frames[id] = { x: x0 + Math.max(0, left - 2), y: y0 + Math.max(0, top - 2), w: Math.min(w - left, right - left + 5), h: Math.min(h - top, bottom - top + 5) };
    });
  }

  createLobby() {
    const surface = document.createElement('canvas');
    surface.width = 780; surface.height = 1280;
    const c = surface.getContext('2d'); c.scale(2, 2);
    c.fillStyle = grad(c, 0, 0, 390, 640, [[0, '#fbe8c7'], [.5, '#eac799'], [1, '#d4a476']]);
    c.fillRect(0, 0, 390, 640);
    // Silk wall panels, soft window light, walnut skirting.
    for (let x = 18; x < 390; x += 59) {
      rr(c, x, 12, 48, 447, 2, 'rgba(255,247,227,.18)', 'rgba(138,92,54,.09)');
      c.fillStyle = 'rgba(255,255,239,.3)'; c.fillRect(x + 1, 12, 1, 447);
    }
    const sun = c.createRadialGradient(110, 58, 0, 120, 140, 355);
    sun.addColorStop(0, '#fff9dc99'); sun.addColorStop(1, '#ffe9bd00');
    c.fillStyle = sun; c.fillRect(0, 0, 390, 480);
    poly(c, [[0, 190], [113, 0], [192, 0], [0, 351]], '#fffbea19');
    c.fillStyle = '#895035'; c.fillRect(0, 463, 390, 12);
    c.fillStyle = '#d5b17c'; c.fillRect(0, 462, 390, 3);
    c.fillStyle = grad(c, 0, 473, 0, 170, [[0, '#bb8659'], [.45, '#e1b785'], [1, '#cca173']]);
    c.fillRect(0, 475, 390, 165);
    for (let y = 482, step = 12; y < 645; y += step, step += 10) {
      c.strokeStyle = '#95684544'; c.beginPath(); c.moveTo(0, y); c.lineTo(390, y); c.stroke();
    }
    for (let x = -320; x < 730; x += 110) {
      c.beginPath(); c.moveTo(195 + (x - 195) * .25, 475); c.lineTo(x, 640); c.stroke();
    }
    // Wall lamps.
    [20, 370].forEach((x) => {
      const glow = c.createRadialGradient(x, 204, 2, x, 211, 63);
      glow.addColorStop(0, '#ffe7a9c9'); glow.addColorStop(1, '#fff2cb00');
      c.fillStyle = glow; c.fillRect(x - 63, 144, 126, 128);
      rr(c, x - 8, 187, 16, 46, 7, '#9c7250', '#cfa677', 2);
      rr(c, x - 5, 181, 10, 46, 4, grad(c, x - 5, 0, 10, 0, [[0, '#ffe8a6'], [.5, '#fffdeb'], [1, '#eec983']]));
    });
    this.plant(c, 17, 465, .55);
    this.plant(c, 372, 465, .6);
    return surface;
  }

  plant(c, x, y, size) {
    c.save(); c.translate(x, y); c.scale(size, size);
    c.fillStyle = '#402b1933'; c.beginPath(); c.ellipse(0, 0, 27, 8, 0, 0, Math.PI * 2); c.fill();
    poly(c, [[-18, -34], [18, -34], [13, 0], [-13, 0]], '#bb734c');
    rr(c, -20, -39, 40, 9, 3, '#deaa77');
    c.strokeStyle = '#4c7739'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(0, -36); c.quadraticCurveTo(-2, -69, 3, -103); c.stroke();
    [[-12, -57, -.6], [12, -73, .6], [-13, -85, -.6], [3, -106, .1], [17, -51, .8]].forEach(([lx, ly, angle], i) => {
      c.save(); c.translate(lx, ly); c.rotate(angle);
      c.fillStyle = i % 2 ? '#648f43' : '#88aa4f'; c.beginPath(); c.ellipse(0, 0, 12, 24, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#bbcf7766'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -20); c.lineTo(0, 19); c.stroke(); c.restore();
    });
    c.restore();
  }

  drawLobby(c) { c.drawImage(this.cachedLobby, 0, 0, 390, 640); }

  drawElevator(c, { floor, weightRatio, title, clock, motion, empty }) {
    c.save();
    c.shadowColor = '#40201170'; c.shadowBlur = 13; c.shadowOffsetY = 7;
    rr(c, 36, 93, 318, 379, 25, '#6f3526');
    c.shadowColor = 'transparent';
    rr(c, 38, 92, 314, 376, 24, grad(c, 38, 92, 314, 300, [[0, '#ffb088'], [.13, '#f77a52'], [.5, '#cc4431'], [.83, '#f16d45'], [1, '#982d25']]), '#aa4630', 1.5);
    rr(c, 42, 96, 306, 366, 21, null, '#ffc49b66', 1.3);
    rr(c, 50, 113, 290, 345, 10, '#572f28', '#9c4f38', 2);
    rr(c, 57, 122, 276, 330, 4, '#341e1a', '#d59c66', 2);
    c.fillStyle = grad(c, 60, 130, 270, 300, [[0, '#8d624a'], [.3, '#c6a278'], [.66, '#b08660'], [1, '#65503e']]);
    c.fillRect(60, 130, 270, 320);
    // Receding side walls give depth, but the loadable rectangle stays unchanged.
    poly(c, [[60, 130], [89, 153], [89, 425], [60, 450]], '#744b38');
    poly(c, [[330, 130], [301, 153], [301, 425], [330, 450]], '#674738');
    c.fillStyle = grad(c, 89, 153, 212, 0, [[0, '#c4a77b'], [.3, '#f1d8a3'], [.7, '#ddbc89'], [1, '#b79066']]);
    c.fillRect(89, 153, 212, 272);
    // Walnut grain is static and restrained, avoiding visual noise around small sprites.
    for (let x = 94; x < 302; x += 26) {
      c.fillStyle = '#81533330'; c.fillRect(x, 153, 1, 272);
      c.fillStyle = '#fff4c71c'; c.fillRect(x + 2, 153, 2, 272);
    }
    poly(c, [[60, 450], [89, 425], [301, 425], [330, 450]], '#796246');
    c.strokeStyle = '#dcbd8366'; c.lineWidth = 1;
    for (let x = 75; x < 331; x += 32) { c.beginPath(); c.moveTo(195 + (x - 195) * .75, 425); c.lineTo(x, 450); c.stroke(); }
    rr(c, 86, 317, 219, 7, 3, '#674a37');
    rr(c, 86, 314, 219, 5, 2, grad(c, 0, 314, 0, 5, [[0, '#ffedbb'], [.5, '#e1ba73'], [1, '#8c6944']]));
    [99, 292].forEach((x) => rr(c, x, 318, 4, 9, 1, '#a98054'));
    poly(c, [[60, 130], [89, 153], [301, 153], [330, 130]], '#443128');
    const light = c.createRadialGradient(195, 145, 5, 195, 210, 170);
    light.addColorStop(0, '#fff8c765'); light.addColorStop(1, '#fff8c700');
    c.fillStyle = light; c.fillRect(60, 132, 270, 253);
    rr(c, 156, 139, 78, 5, 3, '#fffad3');
    if (!title) {
      text(c, 'ONE MORE IN', 195, 206, 10, '#906b4855', 'center', 900);
      rr(c, 164, 214, 62, 21, 5, '#f6dfab35', '#96704435');
      text(c, `${String(floor).padStart(2, '0')} F`, 195, 229, 12, '#8d65454d');
    }
    // Threshold and brass door rails.
    c.fillStyle = '#eecf99'; c.fillRect(59, 452, 272, 3);
    c.fillStyle = '#855f43'; c.fillRect(59, 455, 272, 3);
    c.fillStyle = '#ceaa73'; c.fillRect(59, 458, 272, 2);
    [58, 331].forEach((x) => { c.fillStyle = '#e9b883'; c.fillRect(x, 126, 2, 326); });
    // The floor indicator lives beside the shaft, never behind the HUD.
    rr(c, 355, 278, 27, 95, 7, '#bd9468', '#845e3e');
    rr(c, 358, 283, 21, 31, 3, '#3d2c23', '#e7c590');
    text(c, String(floor).padStart(2, '0'), 368.5, 301, 11, '#ffb969');
    [329, 354].forEach((y, i) => {
      c.fillStyle = '#f7db9f'; c.beginPath(); c.arc(368, y, 8, 0, Math.PI * 2); c.fill();
      poly(c, i ? [[364, y - 2], [372, y - 2], [368, y + 3]] : [[364, y + 2], [372, y + 2], [368, y - 3]], i ? '#a78151' : '#d75a3e');
    });
    if (weightRatio > .87 && !title) {
      const alpha = weightRatio > 1 ? .19 : .06;
      c.fillStyle = `rgba(255,70,42,${motion ? alpha * (.75 + .25 * Math.sin(clock * 8)) : alpha})`;
      c.fillRect(60, 130, 270, 320);
    }
    if (empty && !title) {
      rr(c, 119, 253, 152, 53, 13, '#fff5d44c', '#fff1c677');
      text(c, '先把乘客拖进来', 195, 275, 12, '#855f42');
      text(c, '下方第一位正在等你', 195, 292, 9, '#98724f', 'center', 500);
    }
    c.restore();
  }

  drawDoors(c, progress) {
    const half = 135 * clamp(progress, 0, 1);
    c.save();
    c.beginPath(); c.rect(60, 130, 270, 320); c.clip();
    [60 + half - 135, 330 - half].forEach((x, i) => {
      rr(c, x, 130, 135, 320, 0, grad(c, x, 0, 135, 0, [[0, '#953c2f'], [.09, '#d75d3d'], [.42, '#ed8556'], [.8, '#d66944'], [1, '#a84633']]));
      c.fillStyle = '#ffc29c55'; c.fillRect(x + 7, 135, 2, 304);
      c.fillStyle = '#833c2e'; c.fillRect(x + 130, 130, 3, 320);
      rr(c, x + 31, 237, 73, 111, 9, null, '#f4b58933');
      text(c, i ? '›' : '‹', x + 68, 299, 25, '#ffc9a644');
    });
    c.restore();
  }

  sprite(c, id, x, y, w, h, displayRatio = 1, contain = false) {
    const frame = this.frames[id];
    if (!this.ready || !frame) return false;
    let dw = w, dh = h;
    if (contain) {
      const factor = Math.min(w / frame.w, h * displayRatio / frame.h);
      dw = frame.w * factor; dh = frame.h * factor / displayRatio;
    }
    c.drawImage(this.atlas, frame.x, frame.y, frame.w, frame.h, x - dw / 2, y + h / 2 - dh, dw, dh);
    return true;
  }

  passenger(c, p, { clock = 0, motion = true, displayRatio = 1, danger = false, portrait = false, hero = false } = {}) {
    if (!this.ready) return false;
    c.save(); c.translate(p.x, p.y);
    const phase = SPRITE_ORDER.indexOf(p.id) * 1.37;
    const move = !portrait && motion;
    c.rotate((p.rotation || 0) + (move && danger && !p.dragged ? Math.sin(clock * 24 + phase) * .018 : 0));
    const key = p.uid;
    let squash = 0;
    if (key && !portrait) {
      const info = this.landing.get(key) || { velocity: 0, at: -5 };
      if (info.velocity > 65 && Math.abs(p.vy) < 15 && !p.dragged) info.at = clock;
      info.velocity = p.vy;
      this.landing.set(key, info);
      const age = clock - info.at;
      if (age < .26 && move) squash = Math.sin(age / .26 * Math.PI) * .09;
    }
    if (!portrait) {
      c.fillStyle = p.dragged ? '#4c2a1933' : '#4c2a1940';
      c.beginPath(); c.ellipse(0, p.h / 2 + (p.dragged ? 6 : 1), p.w * .43, Math.min(6, p.h * .06), 0, 0, Math.PI * 2); c.fill();
    }
    const breathe = move && !p.dragged ? Math.sin(clock * 2.6 + phase) * .004 : 0;
    c.translate(0, p.h / 2);
    c.scale(1 + squash * .6 - breathe * .4, 1 - squash + breathe);
    c.translate(0, -p.h / 2);
    this.sprite(c, p.id, 0, 0, p.w, p.h, displayRatio, true);
    if (p.dragged) {
      const edge = 4;
      c.strokeStyle = '#ffdf69'; c.lineWidth = 2; c.setLineDash([7, 4]);
      rr(c, -p.w / 2 - edge, -p.h / 2 - edge, p.w + edge * 2, p.h + edge * 2, 9, null, '#fff2ba', 1.5);
      c.setLineDash([]);
      rr(c, -26, -p.h / 2 - 26, 52, 19, 8, '#fff3c8', '#b37b37');
      text(c, `${p.weight}kg`, 0, -p.h / 2 - 12, 10, '#68452a');
    }
    c.restore();
    return true;
  }

  queue(c, { queue, canTake, clock, motion, displayRatio }) {
    c.save();
    c.shadowColor = '#5b301926'; c.shadowBlur = 7; c.shadowOffsetY = 3;
    rr(c, 14, 486, 362, 91, 17, '#f6e4bc', '#be9463', 1);
    c.shadowColor = 'transparent';
    text(c, canTake ? '候乘区' : '人齐啦！', 28, 503, 10, '#715231', 'left');
    text(c, canTake ? '拖左边这位 ↑' : '保住收益，还是加倍？', 359, 503, 9, '#98784b', 'right', 600);
    for (let index = 0; index < 3; index++) {
      const p = queue[index]; const x = 24 + index * 116;
      const active = index === 0 && canTake;
      rr(c, x, 511, 104, 58, 11, grad(c, x, 511, 0, 58, [[0, active ? '#fff8d9' : '#f5e8cb'], [1, active ? '#ffdf89' : '#e6cfa8']]), active ? '#d29a3c' : '#d2b488', active ? 1.6 : 1);
      rr(c, x + 2, 513, 100, 53, 9, null, '#fff9e5a0', .8);
      if (p) {
        c.save();
        // No disabled wash on character art: identities remain readable at phone size.
        c.beginPath(); c.roundRect(x + 3, 514, 46, 52, 8); c.clip();
        if (!this.sprite(c, p.id, x + 26, 540, 46, 53, displayRatio, true)) {
          c.fillStyle = p.color; c.beginPath(); c.arc(x + 26, 540, 17, 0, Math.PI * 2); c.fill();
          text(c, p.short, x + 26, 545, 13, '#62452e');
        }
        c.restore();
        text(c, p.name, x + 50, 532, p.name.length > 4 ? 8 : 9, '#64482c', 'left');
        text(c, `${p.weight}`, x + 50, 551, 15, '#6c4731', 'left', 900);
        text(c, 'kg', x + (p.weight > 99 ? 79 : 70), 551, 8, '#9a734c', 'left');
        if (active) {
          const bob = motion ? Math.sin(clock * 4) * 1.3 : 0;
          c.fillStyle = '#fff9e2'; c.beginPath(); c.arc(x + 95, 515 + bob, 7, 0, Math.PI * 2); c.fill();
          text(c, '↑', x + 95, 518 + bob, 11, '#a86625');
        }
      }
    }
    c.restore();
  }

  clearRunEffects() { this.landing.clear(); }
}
