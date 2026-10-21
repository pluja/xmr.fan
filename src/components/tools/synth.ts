/* The 8-bit instruments shared by the beat and live toys: a compressed master bus with an analyser
   for visuals and a stream for recording, a filtered lead with echo, a bass, drums and a soft pad. */
export class Synth {
  readonly ctx = new AudioContext();
  readonly analyser: AnalyserNode;
  readonly stream: MediaStreamAudioDestinationNode;
  private master: GainNode;
  private leadBus: GainNode;
  private echo: DelayNode;
  private lowpass: BiquadFilterNode;
  private noise: AudioBuffer;

  constructor() {
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 4;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.7;
    this.stream = this.ctx.createMediaStreamDestination();
    this.master.connect(compressor).connect(this.analyser).connect(this.ctx.destination);
    compressor.connect(this.stream);

    // A soft low-pass and a short echo take the edge off the square-wave lead.
    this.leadBus = this.ctx.createGain();
    const lowpass = (this.lowpass = Object.assign(this.ctx.createBiquadFilter(), { type: "lowpass" }));
    lowpass.frequency.value = 2600;
    this.echo = this.ctx.createDelay(1);
    const feedback = this.ctx.createGain(), wet = this.ctx.createGain();
    feedback.gain.value = 0.3;
    wet.gain.value = 0.28;
    this.leadBus.connect(lowpass).connect(this.master);
    lowpass.connect(this.echo).connect(feedback).connect(this.echo);
    this.echo.connect(wet).connect(this.master);

    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  get now() { return this.ctx.currentTime; }
  resume() { return this.ctx.resume(); }

  /** 0 to 1. */
  setVolume(v: number) { this.master.gain.setTargetAtTime(v, this.now, 0.02); }
  setEcho(seconds: number) { this.echo.delayTime.value = Math.min(1, seconds); }
  setBrightness(hz: number) { this.lowpass.frequency.value = hz; }

  lead(hz: number, t: number, length: number, peak = 0.06) { this.tone("square", hz, t, peak, length, this.leadBus); }
  bass(hz: number, t: number, length: number, peak = 0.22) { this.tone("triangle", hz, t, peak, length); }

  kick(t: number, peak = 0.6) {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    osc.connect(this.envelope(t, peak, 0.18));
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** A soft bell: a sine with a quieter octave above, quick to strike and slow to fade. */
  bell(hz: number, t: number, peak = 0.12, ring = 1) {
    for (const [mult, level, decay] of [[1, 1, 0.9], [2, 0.35, 0.5], [3, 0.12, 0.3]] as const) {
      const length = decay * ring;
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = hz * mult;
      osc.connect(this.envelope(t, peak * level, length, this.leadBus));
      osc.start(t);
      osc.stop(t + length);
    }
  }

  snare(t: number) { this.noiseHit(t, 1200, 0.22, 0.12); }
  hat(t: number) { this.noiseHit(t, 7000, 0.06, 0.03); }

  /** A slow, soft chord that swells in and fades out. */
  pad(hzs: number[], t: number, length: number, peak = 0.05) {
    for (const hz of hzs) {
      for (const detune of [-6, 6]) {
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = hz;
        osc.detune.value = detune;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(peak, t + length * 0.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
        osc.connect(gain).connect(this.leadBus);
        osc.start(t);
        osc.stop(t + length);
      }
    }
  }

  private envelope(t: number, peak: number, length: number, out: AudioNode = this.master) {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    gain.connect(out);
    return gain;
  }

  private tone(type: OscillatorType, hz: number, t: number, peak: number, length: number, out?: AudioNode) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = hz;
    osc.connect(this.envelope(t, peak, length, out));
    osc.start(t);
    osc.stop(t + length);
  }

  private noiseHit(t: number, cutoff: number, peak: number, length: number) {
    const src = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter();
    src.buffer = this.noise;
    filter.type = "highpass";
    filter.frequency.value = cutoff;
    src.connect(filter).connect(this.envelope(t, peak, length));
    src.start(t);
    src.stop(t + length);
  }
}
