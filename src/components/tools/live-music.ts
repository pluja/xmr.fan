/* Calm background music driven by the network: slow overlapping pads and a bass drone loop forever,
   transactions ring as soft bells over them, and a block lands as a low chime. Gentle enough to
   leave on while working. */
import { midiToHz } from "../../lib/beat";
import { noteFor, POLL_SECONDS } from "../../lib/live";
import { Synth } from "./synth";

/** Cm, Ab, Eb, Bb: every chord fits the C minor pentatonic notes transactions play. */
const CHORDS = [[48, 55, 63, 67], [44, 51, 60, 63], [51, 58, 63, 67], [46, 53, 62, 65]];
const CHORD_SECONDS = 10;
const BEAT = 60 / 70;
const MAX_NOTES_PER_POLL = 8;

export class LiveMusic {
  readonly synth = new Synth();
  private timer?: ReturnType<typeof setInterval>;
  private chord = 0;
  private nextChordAt = 0;
  private lastHover = 0;

  get playing() { return this.timer !== undefined; }

  start(volume: number) {
    void this.synth.resume();
    this.synth.setVolume(volume);
    this.synth.setBrightness(1800);
    this.synth.setEcho(BEAT * 0.75);
    if (this.playing) return;
    this.nextChordAt = this.synth.now + 0.05;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 1000);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Chords overlap by a few seconds so the bed never drops out. */
  private schedule() {
    const s = this.synth;
    while (this.nextChordAt < s.now + 2) {
      const notes = CHORDS[this.chord++ % CHORDS.length], at = this.nextChordAt;
      s.pad(notes.map(midiToHz), at, CHORD_SECONDS + 4, 0.03);
      s.bass(midiToHz(notes[0] - 12), at, CHORD_SECONDS, 0.09);
      this.nextChordAt += CHORD_SECONDS;
    }
  }

  /** Spreads new transactions over the next poll on a slow beat grid; returns when each one sounds. */
  transactions(hashes: string[]): { hash: string; delay: number }[] {
    if (!this.playing) return [];
    const slots = Math.floor(POLL_SECONDS / (BEAT / 2));
    const picked = hashes.slice(0, Math.min(MAX_NOTES_PER_POLL, slots));
    return picked.map((hash, i) => {
      const delay = 0.05 + Math.floor((i / picked.length) * slots) * (BEAT / 2);
      this.synth.bell(midiToHz(noteFor(hash)), this.synth.now + delay, 0.05);
      return { hash, delay };
    });
  }

  /** A rising chime through the current chord over a low bell: easy to notice, soft enough not to startle. */
  block() {
    if (!this.playing) return;
    const at = this.synth.now + 0.05, chord = CHORDS[(this.chord - 1) % CHORDS.length];
    this.synth.bell(midiToHz(chord[0] - 12), at, 0.1, 3);
    [...chord.map((n) => n + 12), chord[0] + 36].forEach((note, i, all) => {
      this.synth.bell(midiToHz(note), at + i * 0.12, 0.06, i === all.length - 1 ? 3 : 1.5);
    });
  }

  /** A hovered transaction plays its note an octave up; rapid sweeps are thinned so they stay pleasant. */
  hover(hash: string) {
    const now = this.synth.now;
    if (now - this.lastHover < 0.06) return;
    this.lastHover = now;
    void this.synth.resume();
    this.synth.bell(midiToHz(noteFor(hash) + 12), now + 0.01, 0.07);
  }
}
