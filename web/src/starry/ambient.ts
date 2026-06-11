/**
 * 生成式氛围音垫:用 WebAudio 实时合成舒缓的和弦垫 + 偶发五声音阶星光音,
 * 不依赖任何音频文件(零体积、零版权)。遵守浏览器自动播放策略——
 * 只能在用户手势(点击播放按钮)后调用 start()。
 */
const CHORDS: number[][] = [
  [130.81, 196.0, 261.63, 329.63, 392.0], // C
  [110.0, 164.81, 261.63, 329.63, 440.0], // Am7
  [87.31, 174.61, 261.63, 349.23, 440.0], // Fmaj7
  [98.0, 196.0, 246.94, 293.66, 392.0], // G6
];
// 五声音阶高音区,做零星"星光"点缀
const SPARKLES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export class AmbientPad {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private chordTimer: number | null = null;
  private sparkleTimer: number | null = null;
  private step = 0;
  playing = false;

  start(): void {
    if (this.playing) return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      const master = this.ctx.createGain();
      master.gain.value = 0;
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 1100;
      master.connect(lowpass).connect(this.ctx.destination);
      this.master = master;
    }
    void this.ctx.resume();
    this.master!.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master!.gain.linearRampToValueAtTime(0.9, this.ctx.currentTime + 2);
    this.playing = true;
    this.playChord();
    // 和弦每 14s 换一次(音长 22s,自然交叠淡入淡出)
    this.chordTimer = window.setInterval(() => this.playChord(), 14000);
    this.sparkleTimer = window.setInterval(() => {
      if (Math.random() < 0.6) this.playSparkle();
    }, 4500);
  }

  stop(): void {
    if (!this.playing || !this.ctx || !this.master) return;
    this.playing = false;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.2);
    if (this.chordTimer != null) window.clearInterval(this.chordTimer);
    if (this.sparkleTimer != null) window.clearInterval(this.sparkleTimer);
    this.chordTimer = this.sparkleTimer = null;
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  /** 一个和弦:每个音 2 个轻微失谐的正弦振荡器,慢起慢落 */
  private playChord(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const freqs = CHORDS[this.step % CHORDS.length];
    this.step += 1;
    for (const f of freqs) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.05, t0 + 5);
      g.gain.setValueAtTime(0.05, t0 + 14);
      g.gain.linearRampToValueAtTime(0, t0 + 22);
      g.connect(this.master!);
      for (const detune of [0, 4]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        osc.detune.value = detune;
        osc.connect(g);
        osc.start(t0);
        osc.stop(t0 + 22.5);
      }
    }
  }

  /** 零星的高音"星光":极轻的一声叮,长衰减 */
  private playSparkle(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const f = SPARKLES[Math.floor(Math.random() * SPARKLES.length)];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.012, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.5);
    g.connect(this.master!);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + 3.6);
  }
}
