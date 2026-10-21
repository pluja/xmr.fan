/* Plays a Song with Web Audio: square lead, triangle bass, noise drums. Steps are scheduled a little
   ahead of time (a timer can't keep a beat on its own), and `onStep` fires as each one sounds. */
import { midiToHz, STEPS, type Song } from "../../lib/beat";

export class BeatPlayer {
  readonly ctx = new AudioContext();
  readonly analyser: AnalyserNode;
  readonly stream: MediaStreamAudioDestinationNode;
  private master: GainNode;
  private noise: AudioBuffer;
  private timer?: ReturnType<typeof setInterval>;
  private queue: { step: number; time: number }[] = [];
  private song?: Song;
  private nextStep = 0;
  private nextTime = 0;
  onStep: (step: number) => void = () => {};

  constructor() {
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.stream = this.ctx.createMediaStreamDestination();
    this.master.connect(this.analyser).connect(this.ctx.destination);
    this.master.connect(this.stream);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  get playing() { return this.timer !== undefined; }

  play(song: Song) {
    this.song = song;
    void this.ctx.resume();
    if (this.playing) return;
    this.nextStep = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
    requestAnimationFrame(this.frame);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
    this.queue = [];
  }

  private schedule() {
    const song = this.song!;
    const stepTime = 60 / song.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const i = this.nextStep, t = this.nextTime;
      const lead = song.lead[i], bass = song.bass[i];
      if (lead !== null) this.tone("square", midiToHz(lead), t, 0.07, stepTime * 1.6);
      if (bass !== null) this.tone("triangle", midiToHz(bass), t, 0.22, stepTime * 1.9);
      if (song.kick[i]) this.kick(t);
      if (song.snare[i]) this.hit(t, 1200, 0.22, 0.12);
      if (song.hat[i]) this.hit(t, 7000, 0.06, 0.03);
      this.queue.push({ step: i, time: t });
      this.nextStep = (i + 1) % STEPS;
      this.nextTime += stepTime;
    }
  }

  private frame = () => {
    if (!this.playing) return;
    while (this.queue.length && this.queue[0].time <= this.ctx.currentTime) this.onStep(this.queue.shift()!.step);
    requestAnimationFrame(this.frame);
  };

  private envelope(t: number, peak: number, length: number) {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    gain.connect(this.master);
    return gain;
  }

  private tone(type: OscillatorType, hz: number, t: number, peak: number, length: number) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = hz;
    osc.connect(this.envelope(t, peak, length));
    osc.start(t);
    osc.stop(t + length);
  }

  private kick(t: number) {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    osc.connect(this.envelope(t, 0.6, 0.18));
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private hit(t: number, cutoff: number, peak: number, length: number) {
    const src = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter();
    src.buffer = this.noise;
    filter.type = "highpass";
    filter.frequency.value = cutoff;
    src.connect(filter).connect(this.envelope(t, peak, length));
    src.start(t);
    src.stop(t + length);
  }
}
