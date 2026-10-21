/* Plays a Song on the shared Synth. Steps are scheduled a little ahead of time (a timer can't keep
   a beat on its own), and `onStep` fires as each one sounds. */
import { midiToHz, STEPS, type Song } from "../../lib/beat";
import { Synth } from "./synth";

export class BeatPlayer {
  readonly synth = new Synth();
  private timer?: ReturnType<typeof setInterval>;
  private queue: { step: number; time: number }[] = [];
  private song?: Song;
  private nextStep = 0;
  private nextTime = 0;
  onStep: (step: number) => void = () => {};

  get analyser() { return this.synth.analyser; }
  get stream() { return this.synth.stream; }
  get playing() { return this.timer !== undefined; }
  setVolume(v: number) { this.synth.setVolume(v); }

  play(song: Song) {
    this.song = song;
    this.synth.setEcho((60 / song.bpm) * 0.75);
    void this.synth.resume();
    if (this.playing) return;
    this.nextStep = 0;
    this.nextTime = this.synth.now + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
    requestAnimationFrame(this.frame);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
    this.queue = [];
  }

  private schedule() {
    const song = this.song!, s = this.synth;
    const stepTime = 60 / song.bpm / 4;
    while (this.nextTime < s.now + 0.12) {
      const i = this.nextStep, t = this.nextTime;
      const lead = song.lead[i], bass = song.bass[i];
      if (lead !== null) s.lead(midiToHz(lead), t, stepTime * 1.8);
      if (bass !== null) s.bass(midiToHz(bass), t, stepTime * 1.9);
      if (song.kick[i]) s.kick(t);
      if (song.snare[i]) s.snare(t);
      if (song.hat[i]) s.hat(t);
      this.queue.push({ step: i, time: t });
      this.nextStep = (i + 1) % STEPS;
      this.nextTime += stepTime;
    }
  }

  private frame = () => {
    if (!this.playing) return;
    while (this.queue.length && this.queue[0].time <= this.synth.now) this.onStep(this.queue.shift()!.step);
    requestAnimationFrame(this.frame);
  };
}
