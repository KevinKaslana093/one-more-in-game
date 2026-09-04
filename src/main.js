import { FLOOR_CONFIG, PASSENGERS, PROPS, UPGRADES } from './data.js';
import { canClose, floorScore, mulberry32, totalWeight } from './simulation.js';
import { loadSave, storeSave } from './storage.js';
import { GameAudio } from './audio.js';
import { ArtDirector, artIcon } from './art.js';

const LOGICAL_W = 390;
const LOGICAL_H = 640;
const ELEVATOR = { x: 60, y: 130, w: 270, h: 320 };
const COLORS = ['#ffca2c', '#ef6542', '#35bcb0', '#7856c9', '#6fbf54'];

const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const shell = document.querySelector('#gameShell');
const layer = document.querySelector('#screenLayer');
const hud = document.querySelector('#hud');
const weightHud = document.querySelector('#weightHud');
const actionBar = document.querySelector('#actionBar');
const pauseBtn = document.querySelector('#pauseBtn');
const riskBtn = document.querySelector('#riskBtn');
const closeBtn = document.querySelector('#closeBtn');
const toast = document.querySelector('#toast');

const ui = {
  sideBest: document.querySelector('#sideBest'),
  floor: document.querySelector('#floorLabel'),
  score: document.querySelector('#scoreLabel'),
  hearts: document.querySelector('#heartLabel'),
  weight: document.querySelector('#weightLabel'),
  weightFill: document.querySelector('#weightFill'),
  multiplier: document.querySelector('#multLabel'),
  goal: document.querySelector('#goalLabel')
};

function roundedRectPath(context, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.roundRect(x, y, w, h, radius);
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

class OneMoreGame {
  constructor() {
    this.save = loadSave();
    this.audio = new GameAudio();
    this.audio.setMuted(this.save.muted);
    this.art = new ArtDirector();
    this.visualClock = 0;
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.state = 'title';
    this.floor = 1;
    this.score = 0;
    this.hearts = 3;
    this.multiplier = 1;
    this.riskCount = 0;
    this.timeLeft = 0;
    this.runSeed = Date.now() & 0xffffffff;
    this.rng = mulberry32(this.runSeed);
    this.passengers = [];
    this.queue = [];
    this.allowedCount = 0;
    this.dragged = null;
    this.dragOffset = { x: 0, y: 0 };
    this.pointerId = null;
    this.keyboardPassenger = null;
    this.selectedProp = null;
    this.upgrades = new Set();
    this.closingProgress = 0;
    this.closingSuccess = false;
    this.burstTimer = 0;
    this.shake = 0;
    this.flash = 0;
    this.particles = [];
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.toastTimer = 0;
    this.pausedByVisibility = false;
    this.bind();
    this.resize();
    this.showTitle();
    requestAnimationFrame((time) => this.loop(time));
  }

  bind() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.clearPointers());
    window.addEventListener('blur', () => this.clearPointers());
    document.addEventListener('visibilitychange', () => {
      this.clearPointers();
      if (document.hidden && this.state === 'playing' && !layer.firstElementChild) {
        this.pausedByVisibility = true;
        this.openPause();
      }
    });

    canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
    canvas.addEventListener('pointerup', (event) => this.onPointerUp(event));
    canvas.addEventListener('pointercancel', (event) => this.onPointerUp(event));
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    pauseBtn.addEventListener('click', () => this.openPause());
    riskBtn.addEventListener('click', () => this.takeRisk());
    closeBtn.addEventListener('click', () => this.closeDoor());
    document.addEventListener('keydown', (event) => this.onKeyDown(event));
  }

  resize() {
    const dprCap = this.save.quality === 'low' ? 1 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    canvas.width = LOGICAL_W * dpr;
    canvas.height = LOGICAL_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;
    const rect = canvas.getBoundingClientRect();
    this.artDisplayRatio = rect.height / LOGICAL_H / (rect.width / LOGICAL_W);
  }

  clearPointers() {
    if (this.dragged) {
      this.dragged.dragged = false;
      this.dragged = null;
    }
    this.pointerId = null;
    this.keyboardPassenger = null;
  }

  setChrome(visible) {
    hud.classList.toggle('hidden', !visible);
    weightHud.classList.toggle('hidden', !visible);
    actionBar.classList.toggle('hidden', !visible);
  }

  showTitle() {
    this.state = 'title';
    this.setChrome(false);
    this.passengers = [];
    ui.sideBest.textContent = this.save.bestScore.toLocaleString('zh-CN');
    layer.innerHTML = `
      <div class="title-brand" aria-hidden="true">
        <span class="title-kicker">欢乐早高峰 · 物理小派对</span>
        <div class="logo">再挤<span>一个</span></div>
        <span class="title-caption">ONE MORE IN</span>
      </div>
      <section class="screen title-screen">
        <p class="subtitle">都已经这样了……要不，再挤一个？</p>
        <div class="score-strip">
          <span>最高分<b>${this.save.bestScore.toLocaleString('zh-CN')}</b></span>
          <span>最高楼层<b>${this.save.highFloor} / 6</b></span>
          <span>金币<b>${this.save.coins}</b></span>
        </div>
        <button class="primary" data-action="start" aria-label="开始挤"><span>开始挤</span><span class="button-arrow" aria-hidden="true">▶</span></button>
        <button class="secondary" data-action="challenge">今日挑战</button>
        <div class="title-bottom"><span>8 位乘客 · 6 层挑战</span><button class="ghost-button" data-action="settings">设置</button><span>v0.2 美术版</span></div>
      </section>`;
    this.bindLayerActions();
  }

  bindLayerActions() {
    layer.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.play('click');
        const action = button.dataset.action;
        if (action === 'start') this.beginFromTitle(false);
        if (action === 'challenge') this.beginFromTitle(true);
        if (action === 'settings') this.openSettings('title');
        if (action === 'tutorial-next') this.finishTutorial();
        if (action === 'resume') this.resumeGame();
        if (action === 'restart-floor') this.retryFloor();
        if (action === 'restart-run') this.showPrep();
        if (action === 'title') this.showTitle();
        if (action === 'next-floor') this.advanceFloor();
        if (action === 'share') this.shareResult();
        if (action === 'close-settings') this.returnFromSettings();
      });
    });
  }

  beginFromTitle(challenge) {
    this.challenge = challenge;
    if (!this.save.tutorialDone) this.showTutorial();
    else this.showPrep();
  }

  showTutorial() {
    layer.innerHTML = `
      <section class="screen">
        <span class="eyebrow">10 秒学会</span>
        <h2>把大家安全塞进去</h2>
        <div class="tutorial-steps">
          <div class="tutorial-step"><b>☝</b><span>拖动下一位乘客，放进电梯空位</span></div>
          <div class="tutorial-step"><b>⚖</b><span>达到人数后，可以立刻关门保住得分</span></div>
          <div class="tutorial-step"><b>×2</b><span>选择“再挤一个”，倍数更高，也更容易挤爆</span></div>
        </div>
        <button class="primary" data-action="tutorial-next">我会了，开挤</button>
      </section>`;
    this.bindLayerActions();
  }

  finishTutorial() {
    this.save.tutorialDone = true;
    storeSave(this.save);
    this.showPrep();
  }

  showPrep() {
    this.state = 'prep';
    this.setChrome(false);
    this.selectedProp = this.selectedProp || 'lube';
    layer.innerHTML = `
      <section class="screen">
        <span class="eyebrow">开局道具</span>
        <h2>今天带哪个？</h2>
        <p class="tiny">整局生效，只选一个</p>
        <div class="prop-grid">
          ${PROPS.map((prop) => `<button class="prop-card ${prop.id === this.selectedProp ? 'selected' : ''}" data-prop="${prop.id}"><span class="prop-icon">${artIcon(prop.id)}</span><strong>${prop.title}</strong><small>${prop.copy}</small></button>`).join('')}
        </div>
        <button class="primary" id="launchRun">出发</button>
        <button class="ghost-button" data-action="title">返回首页</button>
      </section>`;
    layer.querySelectorAll('[data-prop]').forEach((button) => button.addEventListener('click', () => {
      this.audio.play('pick');
      this.selectedProp = button.dataset.prop;
      layer.querySelectorAll('[data-prop]').forEach((item) => item.classList.toggle('selected', item === button));
    }));
    layer.querySelector('#launchRun').addEventListener('click', () => this.startRun());
    this.bindLayerActions();
  }

  startRun() {
    this.audio.play('success');
    this.floor = 1;
    this.score = 0;
    this.hearts = 3;
    this.upgrades.clear();
    this.runSeed = this.challenge ? 260904 : Date.now() & 0xffffffff;
    this.rng = mulberry32(this.runSeed);
    this.beginFloor();
  }

  effectiveConfig() {
    const base = FLOOR_CONFIG[this.floor - 1];
    return {
      ...base,
      capacity: base.capacity + (this.selectedProp === 'cart' ? 40 : 0) + (this.upgrades.has('capacity') ? 30 : 0)
    };
  }

  scaleForPassenger() {
    return (this.selectedProp === 'lube' ? 0.92 : 1) * (this.upgrades.has('compact') ? 0.93 : 1);
  }

  makeQueue(config) {
    const queue = [];
    let plannedWeight = 0;
    const idealCap = config.capacity * 0.88;
    for (let index = 0; index < config.target; index += 1) {
      const remainingSlots = config.target - index;
      const maxNext = idealCap - plannedWeight - (remainingSlots - 1) * 22;
      const candidates = PASSENGERS.filter((p) => p.weight <= Math.max(49, maxNext));
      const pool = candidates.length ? candidates : PASSENGERS.filter((p) => p.weight < 65);
      const picked = pool[Math.floor(this.rng() * pool.length)];
      queue.push(picked);
      plannedWeight += picked.weight;
    }
    const risky = [...PASSENGERS].sort((a, b) => b.weight - a.weight);
    for (let index = 0; index < 8; index += 1) {
      const pool = this.rng() < 0.48 ? risky.slice(0, 4) : PASSENGERS;
      queue.push(pool[Math.floor(this.rng() * pool.length)]);
    }
    return queue;
  }

  beginFloor() {
    this.state = 'playing';
    this.setChrome(true);
    layer.innerHTML = '';
    const config = this.effectiveConfig();
    this.timeLeft = config.time;
    this.multiplier = 1;
    this.riskCount = 0;
    this.allowedCount = config.target;
    this.passengers = [];
    this.queue = this.makeQueue(config);
    this.art.clearRunEffects();
    this.dragged = null;
    this.keyboardPassenger = null;
    this.closingProgress = 0;
    this.burstTimer = 0;
    this.showToast(`${this.floor}层 · ${config.label}`);
    this.updateHud();
  }

  retryFloor() {
    layer.innerHTML = '';
    this.beginFloor();
  }

  addPassenger(definition, x, y) {
    const scale = this.scaleForPassenger();
    const passenger = {
      ...definition,
      uid: `${definition.id}-${performance.now()}-${Math.random()}`,
      x,
      y,
      w: definition.w * scale,
      h: definition.h * scale,
      vx: 0,
      vy: 0,
      rotation: 0,
      dragged: true,
      settled: false
    };
    this.passengers.push(passenger);
    return passenger;
  }

  canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * LOGICAL_W / rect.width,
      y: (event.clientY - rect.top) * LOGICAL_H / rect.height
    };
  }

  onPointerDown(event) {
    if (this.state !== 'playing' || layer.firstElementChild) return;
    event.preventDefault();
    this.audio.unlock();
    const point = this.canvasPoint(event);
    const existing = [...this.passengers].reverse().find((p) => Math.abs(point.x - p.x) < p.w / 2 && Math.abs(point.y - p.y) < p.h / 2);
    if (existing) {
      this.dragged = existing;
      existing.dragged = true;
      existing.vx = 0;
      existing.vy = 0;
      this.dragOffset = { x: point.x - existing.x, y: point.y - existing.y };
    } else if (point.y >= 486 && point.y <= 572 && this.canTakeNext()) {
      const index = Math.floor(clamp((point.x - 24) / 116, 0, 2));
      if (index !== 0) {
        this.showToast('先拖最左边这位');
        return;
      }
      const definition = this.queue.shift();
      this.dragged = this.addPassenger(definition, point.x, point.y);
      this.dragOffset = { x: 0, y: 0 };
    } else if (point.y >= 486 && !this.canTakeNext()) {
      this.showToast('达到目标了：关门，还是再挤一个？');
    } else {
      return;
    }
    this.pointerId = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
    this.audio.play('pick');
  }

  onPointerMove(event) {
    if (event.pointerId !== this.pointerId || !this.dragged) return;
    event.preventDefault();
    const point = this.canvasPoint(event);
    this.dragged.x = clamp(point.x - this.dragOffset.x, 10, LOGICAL_W - 10);
    this.dragged.y = clamp(point.y - this.dragOffset.y, 70, 575);
  }

  onPointerUp(event) {
    if (event.pointerId !== this.pointerId || !this.dragged) return;
    event.preventDefault();
    this.dragged.dragged = false;
    this.dragged.vy = 30;
    const droppedInside = this.dragged.x > ELEVATOR.x - 10 && this.dragged.x < ELEVATOR.x + ELEVATOR.w + 10 && this.dragged.y > ELEVATOR.y - 20 && this.dragged.y < ELEVATOR.y + ELEVATOR.h + 30;
    if (!droppedInside) {
      const index = this.passengers.indexOf(this.dragged);
      if (index >= 0) {
        const [removed] = this.passengers.splice(index, 1);
        this.queue.unshift(PASSENGERS.find((definition) => definition.id === removed.id));
      }
      this.showToast('要放进电梯里面哦');
    } else {
      this.audio.play('drop');
      this.shake = this.save.reducedMotion ? 0 : 0.07;
    }
    this.dragged = null;
    this.pointerId = null;
    this.updateHud();
  }

  canTakeNext() {
    return this.queue.length > 0 && this.passengers.length < this.allowedCount && this.state === 'playing';
  }

  takeRisk() {
    const config = this.effectiveConfig();
    if (this.state !== 'playing' || this.passengers.length < config.target || this.passengers.length < this.allowedCount) return;
    this.allowedCount += 1;
    this.riskCount += 1;
    this.multiplier = Math.min(5, this.multiplier + 1);
    this.timeLeft += 5;
    this.shake = this.save.reducedMotion ? 0 : 0.22;
    this.audio.play('risk');
    this.vibrate([30, 20, 30]);
    this.showToast(`贪心成功！下一位价值 ×${this.multiplier}`);
    this.updateHud();
  }

  closeDoor() {
    const config = this.effectiveConfig();
    if (this.state !== 'playing' || this.passengers.length < config.target) {
      this.showToast(`还要再挤 ${config.target - this.passengers.length} 人`);
      return;
    }
    this.state = 'closing';
    this.closingProgress = 0;
    const tolerance = this.selectedProp === 'rope' ? 8 : 1;
    this.closingSuccess = canClose({ passengers: this.passengers, target: config.target, capacity: config.capacity, bounds: ELEVATOR, tolerance });
    this.audio.play('close');
    actionBar.classList.add('hidden');
  }

  finishClosing() {
    if (this.closingSuccess) {
      this.audio.play('success');
      this.spawnConfetti(42);
      this.showFloorResult();
    } else {
      this.state = 'burst';
      this.burstTimer = 0;
      this.hearts -= 1;
      this.flash = 0.45;
      this.shake = this.save.reducedMotion ? 0 : 0.65;
      for (const passenger of this.passengers) {
        passenger.vx = (passenger.x < LOGICAL_W / 2 ? -1 : 1) * (80 + this.rng() * 190);
        passenger.vy = -180 - this.rng() * 220;
        passenger.rotation = (this.rng() - .5) * .2;
      }
      this.audio.play('fail');
      this.vibrate([80, 35, 120]);
    }
  }

  showFloorResult() {
    this.state = 'result';
    this.setChrome(false);
    const config = this.effectiveConfig();
    const gained = floorScore({
      count: this.passengers.length,
      target: config.target,
      multiplier: this.multiplier,
      timeLeft: this.timeLeft,
      floor: this.floor,
      scoreBoost: this.upgrades.has('coins') ? 1.25 : 1
    });
    this.score += gained;
    const coins = Math.max(8, Math.round(gained / 35));
    this.save.coins += coins;
    this.save.bestScore = Math.max(this.save.bestScore, this.score);
    this.save.highFloor = Math.max(this.save.highFloor, Math.min(6, this.floor + 1));
    storeSave(this.save);
    ui.sideBest.textContent = this.save.bestScore.toLocaleString('zh-CN');
    const isLast = this.floor >= FLOOR_CONFIG.length;
    layer.innerHTML = `
      <div class="confetti">${Array.from({ length: 18 }, (_, index) => `<i style="left:${(index * 37) % 100}%;background:${COLORS[index % COLORS.length]};animation-delay:${(index % 6) * -.23}s;--drift:${(index % 2 ? 1 : -1) * (20 + index)}px"></i>`).join('')}</div>
      <section class="modal">
        <span class="eyebrow">${this.floor}层安全抵达</span>
        <h2 class="${isLast ? 'victory-title' : ''}">${isLast ? '全楼通关！' : '完美关门'}</h2>
        <div class="result-score">+${gained.toLocaleString('zh-CN')}</div>
        <div class="reward">★ 金币 +${coins}　·　倍率 ×${this.multiplier}</div>
        <p>${this.riskCount ? `你冒险多挤了 ${this.riskCount} 位，胆子真大。` : '稳稳关门也是一种智慧。'}</p>
        ${isLast
          ? `<button class="primary" data-action="share">分享战绩</button><button class="secondary" data-action="restart-run">再玩一局</button><button class="ghost-button" data-action="title">返回首页</button>`
          : `<button class="primary" data-action="next-floor">前往下一层</button><button class="secondary" data-action="share">炫耀一下</button>`}
      </section>`;
    this.bindLayerActions();
  }

  advanceFloor() {
    if (this.floor % 2 === 0 && this.floor < FLOOR_CONFIG.length) this.showUpgrade();
    else {
      this.floor += 1;
      this.beginFloor();
    }
  }

  showUpgrade() {
    this.state = 'upgrade';
    const options = UPGRADES.filter((upgrade) => !this.upgrades.has(upgrade.id));
    layer.innerHTML = `
      <section class="screen">
        <span class="eyebrow">楼层奖励</span>
        <h2>选一个永久加成</h2>
        <div class="upgrade-grid">
          ${options.map((upgrade) => `<button class="prop-card" data-upgrade="${upgrade.id}"><span class="prop-icon">${artIcon(upgrade.id)}</span><strong>${upgrade.title}</strong><small>${upgrade.copy}</small></button>`).join('')}
        </div>
        <p class="tiny">仅在本局剩余楼层生效</p>
      </section>`;
    layer.querySelectorAll('[data-upgrade]').forEach((button) => button.addEventListener('click', () => {
      this.upgrades.add(button.dataset.upgrade);
      this.audio.play('success');
      this.floor += 1;
      this.beginFloor();
    }));
  }

  showBust() {
    this.state = 'failed';
    this.setChrome(false);
    const weight = totalWeight(this.passengers);
    const cap = this.effectiveConfig().capacity;
    const reason = weight > cap ? `超重 ${weight - cap}kg` : '有人还卡在门外';
    layer.innerHTML = `
      <section class="modal">
        <span class="eyebrow">${reason}</span>
        <h2 class="danger-title">挤爆了！</h2>
        <p>${this.hearts > 0 ? `还有 ${this.hearts} 次机会，这层重新来。` : `本局得分 ${this.score.toLocaleString('zh-CN')}，下次少贪一点……也可以更贪。`}</p>
        ${this.hearts > 0
          ? `<button class="primary" data-action="restart-floor">再来一次</button><button class="secondary" data-action="share">分享残局</button>`
          : `<button class="primary" data-action="restart-run">重新开局</button><button class="secondary" data-action="share">分享战绩</button><button class="ghost-button" data-action="title">返回首页</button>`}
      </section>`;
    this.bindLayerActions();
  }

  openPause() {
    if (!['playing', 'closing'].includes(this.state) || layer.firstElementChild) return;
    this.beforePauseState = this.state;
    this.state = 'paused';
    layer.innerHTML = `
      <section class="modal">
        <h2>暂停</h2>
        <p>电梯不会趁你不在偷偷关门。</p>
        <button class="primary" data-action="resume">继续游戏</button>
        <button class="secondary" data-action="settings">声音与画面</button>
        <button class="ghost-button" data-action="title">退出本局</button>
      </section>`;
    this.bindLayerActions();
  }

  resumeGame() {
    layer.innerHTML = '';
    this.state = this.beforePauseState || 'playing';
    this.pausedByVisibility = false;
  }

  openSettings(origin) {
    this.settingsOrigin = origin || (this.state === 'paused' ? 'pause' : 'title');
    if (this.state !== 'paused') this.beforeSettingsState = this.state;
    this.state = 'settings';
    layer.innerHTML = `
      <section class="modal">
        <h2>设置</h2>
        <div class="settings-list">
          <label class="setting-row"><span>音乐与音效</span><input id="muteToggle" type="checkbox" ${this.save.muted ? '' : 'checked'} /></label>
          <label class="setting-row"><span>震动反馈</span><input id="vibrationToggle" type="checkbox" ${this.save.vibration ? 'checked' : ''} /></label>
          <label class="setting-row"><span>减少动态效果</span><input id="motionToggle" type="checkbox" ${this.save.reducedMotion ? 'checked' : ''} /></label>
          <label class="setting-row"><span>高画质</span><input id="qualityToggle" type="checkbox" ${this.save.quality === 'high' ? 'checked' : ''} /></label>
        </div>
        <button class="primary" data-action="close-settings">完成</button>
        <p class="tiny">进度只保存在这台设备上 · v0.2.0 美术版</p>
      </section>`;
    this.bindLayerActions();
  }

  returnFromSettings() {
    this.save.muted = !layer.querySelector('#muteToggle').checked;
    this.save.vibration = layer.querySelector('#vibrationToggle').checked;
    this.save.reducedMotion = layer.querySelector('#motionToggle').checked;
    this.save.quality = layer.querySelector('#qualityToggle').checked ? 'high' : 'low';
    this.audio.setMuted(this.save.muted);
    storeSave(this.save);
    this.resize();
    if (this.settingsOrigin === 'pause') {
      this.state = 'paused';
      layer.innerHTML = '';
      this.openPause();
    } else {
      this.showTitle();
    }
  }

  async shareResult() {
    const text = `我在《再挤一个》挤到了第${this.floor}层，拿下 ${this.score.toLocaleString('zh-CN')} 分！你还能再挤一个吗？`;
    try {
      if (navigator.share) await navigator.share({ title: '再挤一个', text, url: location.href });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} ${location.href}`);
        this.showToast('挑战文案已复制');
      } else this.showToast('截图发给好友挑战吧');
    } catch {
      this.showToast('已取消分享');
    }
  }

  vibrate(pattern) {
    if (this.save.vibration && navigator.vibrate) navigator.vibrate(pattern);
  }

  showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove('show'), 1750);
  }

  onKeyDown(event) {
    if (event.key === 'Escape') {
      if (this.state === 'playing') this.openPause();
      else if (this.state === 'paused') this.resumeGame();
      return;
    }
    if (this.state !== 'playing' || layer.firstElementChild) return;
    if (event.key.toLowerCase() === 'r') this.takeRisk();
    if (event.key === 'Enter') this.closeDoor();
    if (event.key === ' ') {
      event.preventDefault();
      if (!this.keyboardPassenger && this.canTakeNext()) {
        const definition = this.queue.shift();
        this.keyboardPassenger = this.addPassenger(definition, LOGICAL_W / 2, 240);
        this.keyboardPassenger.dragged = true;
        this.audio.play('pick');
      } else if (this.keyboardPassenger) {
        this.keyboardPassenger.dragged = false;
        this.keyboardPassenger.vy = 20;
        this.keyboardPassenger = null;
        this.audio.play('drop');
        this.updateHud();
      }
    }
    if (this.keyboardPassenger && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const step = event.shiftKey ? 3 : 8;
      if (event.key === 'ArrowLeft') this.keyboardPassenger.x -= step;
      if (event.key === 'ArrowRight') this.keyboardPassenger.x += step;
      if (event.key === 'ArrowUp') this.keyboardPassenger.y -= step;
      if (event.key === 'ArrowDown') this.keyboardPassenger.y += step;
      this.keyboardPassenger.x = clamp(this.keyboardPassenger.x, ELEVATOR.x, ELEVATOR.x + ELEVATOR.w);
      this.keyboardPassenger.y = clamp(this.keyboardPassenger.y, ELEVATOR.y, ELEVATOR.y + ELEVATOR.h);
    }
  }

  updateHud() {
    if (!['playing', 'closing', 'burst'].includes(this.state)) return;
    const config = this.effectiveConfig();
    const weight = totalWeight(this.passengers);
    const ratio = weight / config.capacity;
    ui.floor.textContent = `${this.floor}/6`;
    ui.score.textContent = this.score.toLocaleString('zh-CN');
    ui.hearts.textContent = '♥'.repeat(Math.max(0, this.hearts)) + '♡'.repeat(Math.max(0, 3 - this.hearts));
    ui.weight.textContent = `${weight}/${config.capacity}kg`;
    ui.weightFill.style.width = `${Math.min(100, ratio * 100)}%`;
    weightHud.classList.toggle('is-over', ratio > 1);
    weightHud.classList.toggle('is-warning', ratio > .85 && ratio <= 1);
    ui.multiplier.textContent = `×${this.multiplier}`;
    const remaining = Math.max(0, config.target - this.passengers.length);
    ui.goal.textContent = remaining ? `还需 ${remaining} 人 · 剩余 ${Math.ceil(this.timeLeft)} 秒` : `已达标 · 关门或冒险 · ${Math.ceil(this.timeLeft)} 秒`;
    riskBtn.disabled = this.state !== 'playing' || remaining > 0 || this.passengers.length < this.allowedCount;
    closeBtn.disabled = this.state !== 'playing' || remaining > 0;
    riskBtn.querySelector('b').textContent = `×${Math.min(5, this.multiplier + 1)}`;
  }

  updatePhysics(dt) {
    if (this.state === 'burst') {
      for (const passenger of this.passengers) {
        passenger.vy += 520 * dt;
        passenger.x += passenger.vx * dt;
        passenger.y += passenger.vy * dt;
        passenger.rotation += passenger.vx * dt * .002;
      }
      return;
    }
    if (!['playing', 'closing'].includes(this.state)) return;
    for (const passenger of this.passengers) {
      if (passenger.dragged) continue;
      passenger.vy += 680 * dt;
      passenger.y += passenger.vy * dt;
      const halfW = passenger.w / 2;
      const halfH = passenger.h / 2;
      if (passenger.x - halfW < ELEVATOR.x) passenger.x = ELEVATOR.x + halfW;
      if (passenger.x + halfW > ELEVATOR.x + ELEVATOR.w) passenger.x = ELEVATOR.x + ELEVATOR.w - halfW;
      if (passenger.y + halfH > ELEVATOR.y + ELEVATOR.h) {
        passenger.y = ELEVATOR.y + ELEVATOR.h - halfH;
        passenger.vy *= -.12;
      }
    }

    for (let iteration = 0; iteration < 4; iteration += 1) {
      for (let aIndex = 0; aIndex < this.passengers.length; aIndex += 1) {
        const a = this.passengers[aIndex];
        if (a.dragged) continue;
        for (let bIndex = aIndex + 1; bIndex < this.passengers.length; bIndex += 1) {
          const b = this.passengers[bIndex];
          if (b.dragged) continue;
          const overlapX = (a.w + b.w) / 2 - Math.abs(a.x - b.x);
          const overlapY = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
          if (overlapX <= 0 || overlapY <= 0) continue;
          if (overlapY < overlapX) {
            const direction = a.y < b.y ? -1 : 1;
            a.y += direction * overlapY * .52;
            b.y -= direction * overlapY * .48;
            a.vy *= .25;
            b.vy *= .25;
          } else {
            const direction = a.x < b.x ? -1 : 1;
            a.x += direction * overlapX * .5;
            b.x -= direction * overlapX * .5;
          }
        }
      }
    }
  }

  update(dt) {
    if (this.state !== 'paused' && this.state !== 'settings') this.visualClock += dt;
    if (this.state === 'playing') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.closingSuccess = false;
        this.state = 'closing';
        this.closingProgress = 0;
        actionBar.classList.add('hidden');
        this.audio.play('close');
      }
      this.audio.update(dt, totalWeight(this.passengers) / this.effectiveConfig().capacity);
    }
    this.updatePhysics(dt);
    if (this.state === 'closing') {
      this.closingProgress += dt / .85;
      if (this.closingProgress >= 1) this.finishClosing();
    }
    if (this.state === 'burst') {
      this.burstTimer += dt;
      if (this.burstTimer > 1.05) this.showBust();
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.flash = Math.max(0, this.flash - dt);
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 250 * dt;
      particle.rotation += particle.spin * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    this.updateHud();
  }

  loop(time) {
    const frame = Math.min(.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    this.accumulator += frame;
    const step = 1 / 60;
    let catches = 0;
    while (this.accumulator >= step && catches < 4) {
      this.update(step);
      this.accumulator -= step;
      catches += 1;
    }
    this.render();
    requestAnimationFrame((next) => this.loop(next));
  }

  spawnConfetti(count) {
    const finalCount = this.save.reducedMotion || this.save.quality === 'low' ? Math.floor(count / 2) : count;
    for (let index = 0; index < finalCount; index += 1) {
      this.particles.push({
        x: 40 + this.rng() * 310,
        y: 80 + this.rng() * 80,
        vx: (this.rng() - .5) * 200,
        vy: -80 - this.rng() * 180,
        life: 1.2 + this.rng(),
        color: COLORS[index % COLORS.length],
        rotation: this.rng() * 6,
        spin: (this.rng() - .5) * 9
      });
    }
  }

  render() {
    if (shell.dataset.screen !== this.state) shell.dataset.screen = this.state;
    const reduced = this.save.reducedMotion || this.motionPreference.matches;
    shell.dataset.motion = reduced ? 'reduced' : 'full';
    ctx.save();
    const shakeAmount = this.shake > 0 && !reduced ? this.shake * 7 : 0;
    // Visual-only randomness must not consume the seeded gameplay sequence.
    ctx.translate((Math.random() - .5) * shakeAmount, (Math.random() - .5) * shakeAmount);
    this.drawLobby();
    this.drawElevator();
    if (['playing', 'closing', 'burst', 'paused', 'settings', 'result', 'failed', 'upgrade'].includes(this.state)) this.drawQueue();
    if (this.state === 'title' || this.state === 'prep') this.drawTitleCast();
    this.drawParticles();
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(239, 75, 46, ${Math.min(.45, this.flash)})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }
    ctx.restore();
  }

  artOptions(extra = {}) {
    return {
      clock: this.visualClock,
      motion: !this.save.reducedMotion && !this.motionPreference.matches,
      displayRatio: this.artDisplayRatio || 1,
      danger: this.state === 'playing' && totalWeight(this.passengers) > this.effectiveConfig().capacity,
      ...extra
    };
  }

  drawLobby() { this.art.drawLobby(ctx); }

  drawElevator() {
    this.art.drawElevator(ctx, {
      floor: this.floor,
      weightRatio: totalWeight(this.passengers) / this.effectiveConfig().capacity,
      title: this.state === 'title' || this.state === 'prep',
      empty: this.state === 'playing' && this.passengers.length === 0,
      clock: this.visualClock,
      motion: !this.save.reducedMotion && !this.motionPreference.matches
    });
    for (const passenger of this.passengers.filter(p => !p.dragged)) this.drawPassenger(passenger);
    for (const passenger of this.passengers.filter(p => p.dragged)) this.drawPassenger(passenger);
    if (this.state === 'closing' || this.state === 'result') {
      this.art.drawDoors(ctx, this.state === 'result' ? 1 : this.closingProgress);
    }
  }

  drawPassenger(passenger, options = {}) {
    if (!this.art.passenger(ctx, passenger, this.artOptions(options))) this.drawFallbackPassenger(passenger);
  }

  drawFallbackPassenger(passenger) {
    ctx.save();
    ctx.translate(passenger.x, passenger.y);
    ctx.rotate(passenger.rotation || 0);
    const { w, h } = passenger;
    ctx.shadowColor = '#32180755';
    ctx.shadowBlur = passenger.dragged ? 14 : 6;
    ctx.shadowOffsetY = passenger.dragged ? 8 : 3;

    if (passenger.id === 'corgi') {
      roundedRectPath(ctx, -w / 2, -h * .25, w, h * .62, h * .25);
      ctx.fillStyle = passenger.color; ctx.fill();
      ctx.beginPath(); ctx.arc(w * .18, -h * .18, h * .3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff2d5'; ctx.beginPath(); ctx.arc(w * .21, -h * .12, h * .16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b1a12'; ctx.beginPath(); ctx.arc(w * .3, -h * .2, 2.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w * .04, -h * .36); ctx.lineTo(w * .13, -h * .7); ctx.lineTo(w * .24, -h * .37); ctx.fillStyle = passenger.color; ctx.fill();
    } else if (passenger.id === 'boxes') {
      ctx.fillStyle = '#c98843'; roundedRectPath(ctx, -w / 2, -h / 2, w, h, 5); ctx.fill();
      ctx.strokeStyle = '#8b542b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#efc278'; ctx.fillRect(-4, -h / 2, 8, h);
      ctx.fillStyle = '#79411f'; ctx.font = '900 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▦', 0, 7);
    } else {
      const bodyTop = -h * .15;
      ctx.fillStyle = passenger.color;
      roundedRectPath(ctx, -w / 2, bodyTop, w, h * .62, Math.min(16, w * .25)); ctx.fill();
      ctx.fillStyle = passenger.skin;
      ctx.beginPath(); ctx.arc(0, -h * .28, Math.min(w * .32, h * .2), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2114';
      ctx.beginPath(); ctx.arc(-w * .09, -h * .3, 2.2, 0, Math.PI * 2); ctx.arc(w * .09, -h * .3, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8c4f35'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -h * .22, 5, 0.15, Math.PI - .15); ctx.stroke();
      if (passenger.id === 'courier') {
        ctx.fillStyle = '#f5b714'; ctx.beginPath(); ctx.arc(0, -h * .41, w * .35, Math.PI, 0); ctx.fill();
      }
      if (passenger.id === 'uncle') {
        ctx.fillStyle = '#402416'; ctx.fillRect(-10, -h * .21, 20, 3);
        ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(-w * .57, h * .08, 8, 0, Math.PI * 2); ctx.arc(w * .57, h * .08, 8, 0, Math.PI * 2); ctx.fill();
      }
      if (passenger.id === 'bride') {
        ctx.fillStyle = '#fffdf8'; ctx.beginPath(); ctx.moveTo(-w / 2, h * .46); ctx.lineTo(0, -h * .05); ctx.lineTo(w / 2, h * .46); ctx.fill();
      }
      ctx.fillStyle = '#5b3218'; ctx.font = `900 ${Math.max(11, w * .25)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(passenger.short, 0, h * .28);
    }
    ctx.shadowColor = 'transparent';
    if (passenger.dragged) {
      ctx.strokeStyle = '#ffdc43'; ctx.lineWidth = 4; ctx.setLineDash([6, 5]);
      roundedRectPath(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 12); ctx.stroke();
    }
    ctx.restore();
  }

  drawQueue() {
    if (!['playing', 'closing', 'burst', 'paused', 'settings'].includes(this.state)) return;
    this.art.queue(ctx, {
      queue: this.queue,
      canTake: this.canTakeNext(),
      ...this.artOptions()
    });
  }

  drawTitleCast() {
    const titleDefs = [PASSENGERS[3], PASSENGERS[0], PASSENGERS[4], PASSENGERS[1], PASSENGERS[2]];
    const placements = [
      { x: 252, y: 250, w: 142, h: 210 },
      { x: 111, y: 253, w: 111, h: 181 },
      { x: 286, y: 295, w: 83, h: 176 },
      { x: 194, y: 300, w: 149, h: 183 },
      { x: 112, y: 376, w: 83, h: 70 }
    ];
    titleDefs.forEach((definition, index) => {
      this.drawPassenger({ ...definition, ...placements[index], rotation: 0 }, { hero: true });
    });
  }

  drawParticles() {
    for (const particle of this.particles) {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.globalAlpha = clamp(particle.life, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-4, -7, 8, 14);
      ctx.restore();
    }
  }
}

new OneMoreGame();
