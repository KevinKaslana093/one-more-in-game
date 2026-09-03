export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = 0;
    this.beat = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.18;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.18, this.ctx.currentTime, 0.02);
  }

  tone(freq, duration = 0.08, type = 'sine', volume = 0.35, slide = 0) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  play(name) {
    this.unlock();
    const patterns = {
      pick: () => this.tone(510, 0.06, 'triangle', 0.2, 120),
      drop: () => this.tone(180, 0.09, 'sine', 0.3, -40),
      risk: () => { this.tone(320, 0.08, 'square', 0.18, 80); setTimeout(() => this.tone(470, 0.1, 'square', 0.18, 120), 70); },
      close: () => this.tone(110, 0.32, 'sawtooth', 0.18, -45),
      success: () => [440, 554, 659, 880].forEach((f, index) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.22), index * 85)),
      fail: () => [220, 170, 110].forEach((f, index) => setTimeout(() => this.tone(f, 0.18, 'sawtooth', 0.18, -30), index * 90)),
      click: () => this.tone(360, 0.04, 'sine', 0.14, 30)
    };
    patterns[name]?.();
  }

  update(dt, intensity = 0) {
    if (!this.ctx || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    const notes = intensity > 0.7 ? [110, 147, 165, 196] : [110, 138, 165, 138];
    this.tone(notes[this.beat % notes.length], 0.12, 'triangle', 0.045);
    if (this.beat % 2 === 0) this.tone(55, 0.08, 'sine', 0.05);
    this.beat += 1;
    this.musicTimer = intensity > 0.7 ? 0.22 : 0.34;
  }
}
