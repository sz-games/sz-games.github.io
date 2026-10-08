// Procedural engine, wind, skid and rain sound (plan 4.7). No audio files ship.
//
// The engine is two oscillators plus filtered noise. The pitch comes from the
// gearbox ratio in the vehicle, so a gear change is audible. Wind follows
// speed and skid follows wheel slip. Everything is under 200 lines and runs
// from a single AudioContext started on the first user gesture.

const IDLE_HZ = 46;
const TOP_HZ = 186;
const NOISE_SECONDS = 2;

export class Sound {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.ready = false;
    this.failed = false;
    this.engineHz = IDLE_HZ;
    this.started = false;
    this.lastRumble = 0;
  }

  // Called from the Start button, which is the first user gesture.
  async start() {
    if (this.started || this.failed) return this.ready;
    this.started = true;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      this.failed = true;
      return false;
    }

    try {
      const context = new AudioContextClass();
      this.context = context;
      if (context.state === 'suspended') await context.resume();

      this.master = context.createGain();
      this.master.gain.value = this.settings.muted ? 0 : this.settings.volume;
      this.master.connect(context.destination);

      // One shared noise buffer feeds the wind, the skid and the rain.
      const frames = context.sampleRate * NOISE_SECONDS;
      const buffer = context.createBuffer(1, frames, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;

      // Engine: a saw for the firing order, a square for the body, filtered.
      this.engineGain = context.createGain();
      this.engineGain.gain.value = 0;
      this.engineFilter = context.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 700;
      this.engineFilter.Q.value = 1.2;
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);

      this.oscillator = context.createOscillator();
      this.oscillator.type = 'sawtooth';
      this.oscillator.frequency.value = IDLE_HZ;
      this.oscillator.connect(this.engineFilter);
      this.oscillator.start();

      this.harmonic = context.createOscillator();
      this.harmonic.type = 'square';
      this.harmonic.frequency.value = IDLE_HZ * 0.5;
      this.harmonicGain = context.createGain();
      this.harmonicGain.gain.value = 0.35;
      this.harmonic.connect(this.harmonicGain);
      this.harmonicGain.connect(this.engineFilter);
      this.harmonic.start();

      // Induction roar: band passed noise that opens with the throttle.
      this.induction = context.createBufferSource();
      this.induction.buffer = buffer;
      this.induction.loop = true;
      this.inductionFilter = context.createBiquadFilter();
      this.inductionFilter.type = 'bandpass';
      this.inductionFilter.frequency.value = 220;
      this.inductionFilter.Q.value = 0.8;
      this.inductionGain = context.createGain();
      this.inductionGain.gain.value = 0;
      this.induction.connect(this.inductionFilter);
      this.inductionFilter.connect(this.inductionGain);
      this.inductionGain.connect(this.master);
      this.induction.start();

      // Wind rises with speed.
      [this.windFilter, this.windGain] = this.noiseLayer(buffer, 'lowpass', 500, 1);
      // Skid and gravel crunch: high band passed noise.
      [this.skidFilter, this.skidGain] = this.noiseLayer(buffer, 'bandpass', 1900, 1.4);
      // Off-road rumble: low band passed noise under the tyres.
      [this.rumbleFilter, this.rumbleGain] = this.noiseLayer(buffer, 'bandpass', 160, 0.9);
      // Rain on the roof: bright hiss.
      [, this.rainGain] = this.noiseLayer(buffer, 'highpass', 2600, 0.7);

      this.ready = true;
      return true;
    } catch (error) {
      // A browser with no audio device must still be able to drive.
      this.failed = true;
      this.context = null;
      return false;
    }
  }

  // Looping noise through a filter into a silent gain: wind, skid, rain.
  noiseLayer(buffer, type, frequency, q) {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = this.context.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    return [filter, gain];
  }

  // Engine pitch, exposed for the smoke test and the debug meter.
  frequencyFor(rpm) {
    return IDLE_HZ + (TOP_HZ - IDLE_HZ) * Math.max(0, Math.min(1, rpm));
  }

  update(dt, state) {
    // The frequency is tracked even when the context is missing or muted, so
    // the debug meter and the tests can read it in a headless browser.
    this.engineHz += (this.frequencyFor(state.rpm) - this.engineHz) * Math.min(1, dt * 12);
    if (!this.ready) return;

    const now = this.context.currentTime;
    const smooth = 0.08;
    const volume = this.settings.muted ? 0 : this.settings.volume;

    this.master.gain.setTargetAtTime(volume, now, smooth);
    this.oscillator.frequency.setTargetAtTime(this.engineHz, now, 0.03);
    this.harmonic.frequency.setTargetAtTime(this.engineHz * 0.5, now, 0.03);
    // Off the road the engine labours: a duller, louder note under load.
    const load = state.offRoad ? state.throttle : 0;
    this.engineFilter.frequency.setTargetAtTime(420 + state.rpm * 1500 + state.throttle * 400 - load * 180, now, 0.05);

    const engineLevel = 0.1 + state.rpm * 0.1 + state.throttle * 0.08 + load * 0.03;
    this.engineGain.gain.setTargetAtTime(state.airborne ? engineLevel * 0.7 : engineLevel, now, 0.05);
    this.inductionGain.gain.setTargetAtTime(state.throttle * 0.06 + state.rpm * 0.02, now, 0.08);
    this.inductionFilter.frequency.setTargetAtTime(160 + state.rpm * 500, now, 0.08);

    const wind = Math.pow(Math.max(0, state.speedNorm), 2);
    this.windGain.gain.setTargetAtTime(wind * 0.16, now, 0.15);
    this.windFilter.frequency.setTargetAtTime(320 + wind * 1400, now, 0.15);

    const rumble = state.rumble || 0;
    this.lastRumble = rumble;
    this.rumbleGain.gain.setTargetAtTime(rumble * 0.22, now, 0.08);
    this.rumbleFilter.frequency.setTargetAtTime(110 + rumble * 120, now, 0.1);
    const skid = Math.max(state.slip * Math.min(1, state.speedNorm * 3), rumble * 0.35);
    this.skidGain.gain.setTargetAtTime(skid * 0.12, now, 0.06);
    this.skidFilter.frequency.setTargetAtTime(1200 + rumble * 900 + state.slip * 900, now, 0.08);
    this.rainGain.gain.setTargetAtTime(state.rain ? 0.05 : 0, now, 0.6);
  }

  // Short blip for coins and checkpoints.
  blip(frequency = 880, duration = 0.12) {
    if (!this.ready) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(this.settings.muted ? 0.0001 : 0.09, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  applySettings() {
    if (!this.ready) return;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.volume, this.context.currentTime, 0.05);
  }

  suspend() {
    if (this.ready && this.context.state === 'running') this.context.suspend();
  }

  resume() {
    if (this.ready && this.context.state === 'suspended') this.context.resume();
  }
}