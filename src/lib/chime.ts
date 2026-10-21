/* A short 8-bit chime, synthesized so there's no sound file to load.
   Browsers only allow audio after a user gesture, so call unlockChime() from a click first. */

let ctx: AudioContext | undefined;

export function unlockChime() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

/** Rising square-wave notes; `success` adds a final high note. */
export function playChime(success = false) {
  if (!ctx) return;
  const notes = success ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 987.77];
  const step = 0.09;
  notes.forEach((freq, i) => {
    const osc = ctx!.createOscillator(), gain = ctx!.createGain();
    const start = ctx!.currentTime + i * step;
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + step * 1.8);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(start);
    osc.stop(start + step * 2);
  });
}
