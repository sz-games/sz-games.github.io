// DOM heads-up display: counters, rev bar, debug meter and the settings
// panel. The game loop writes numbers here once a frame; nothing else touches
// the document.

const FPS_WINDOW = 60;

export class Hud {
  constructor(root = document) {
    this.root = root;
    this.distance = root.getElementById('distance');
    this.score = root.getElementById('score');
    this.speed = root.getElementById('speed');
    this.gear = root.getElementById('gear');
    this.revBar = root.getElementById('rev-fill');
    this.meter = root.getElementById('meter');
    this.meterText = root.getElementById('meter-text');
    this.hint = root.getElementById('hint');
    this.toast = root.getElementById('toast');
    this.toastTimer = 0;
    this.samples = new Float32Array(FPS_WINDOW);
    this.sampleIndex = 0;
    this.sampleCount = 0;
    this.lastText = '';
  }

  update(state) {
    this.distance.textContent = state.distance.toFixed(2);
    this.score.textContent = String(state.score);
    this.speed.textContent = String(Math.round(Math.abs(state.speedKmh)));
    if (this.gear) {
      this.gear.textContent = state.reversing ? 'R' : String(state.gear);
    }
    if (this.revBar) {
      const width = Math.min(100, Math.round(state.rpm * 100));
      this.revBar.style.width = width + '%';
      this.revBar.style.background = width > 88 ? '#ff6b5e' : '#ffd24d';
    }
  }

  // Debug meter: the rolling average the perf run reads.
  sampleFrame(frameMs) {
    this.samples[this.sampleIndex] = frameMs;
    this.sampleIndex = (this.sampleIndex + 1) % FPS_WINDOW;
    if (this.sampleCount < FPS_WINDOW) this.sampleCount += 1;
  }

  averageFps() {
    if (this.sampleCount === 0) return 0;
    let total = 0;
    for (let i = 0; i < this.sampleCount; i += 1) total += this.samples[i];
    const meanMs = total / this.sampleCount;
    return meanMs > 0 ? 1000 / meanMs : 0;
  }

  setMeter(text) {
    if (!this.meter) return;
    this.meter.hidden = false;
    if (this.meterText && text !== this.lastText) {
      this.meterText.textContent = text;
      this.lastText = text;
    }
  }

  showToast(text, seconds = 6) {
    if (!this.toast) return;
    this.toast.textContent = text;
    this.toast.hidden = false;
    this.toastTimer = seconds;
  }

  hideToast() {
    if (this.toast) this.toast.hidden = true;
    this.toastTimer = 0;
  }

  tick(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.hideToast();
    }
  }

  setHint(text) {
    if (this.hint) this.hint.textContent = text;
  }
}

// The settings panel is plain DOM: a quality select, view distance, volume,
// camera mode and the debug tuning numbers.
export class SettingsPanel {
  constructor(root, settings, tune, handlers) {
    this.root = root;
    this.settings = settings;
    this.tune = tune;
    this.handlers = handlers;
    this.open = false;

    this.panel = root.getElementById('settings');
    this.quality = root.getElementById('quality-select');
    this.view = root.getElementById('view-distance');
    this.viewValue = root.getElementById('view-distance-value');
    this.volume = root.getElementById('volume');
    this.camera = root.getElementById('camera-select');
    this.time = root.getElementById('time-select');
    this.weather = root.getElementById('weather-select');
    this.tuning = root.getElementById('tuning');

    this.quality.value = settings.quality;
    this.view.value = String(settings.viewDistance);
    this.viewValue.textContent = settings.viewDistance > 0 ? settings.viewDistance + ' m' : 'Auto';
    this.volume.value = String(Math.round(settings.volume * 100));
    this.sync();

    this.quality.addEventListener('change', () => settings.setQuality(this.quality.value));
    this.view.addEventListener('input', () => {
      const metres = Number(this.view.value);
      settings.setViewDistance(metres);
      this.viewValue.textContent = metres > 0 ? metres + ' m' : 'Auto';
    });
    this.volume.addEventListener('input', () => settings.setVolume(Number(this.volume.value) / 100));
    this.camera.addEventListener('change', () => handlers.onCamera(this.camera.value));
    this.time.addEventListener('change', () => settings.setTime(this.time.value));
    this.weather.addEventListener('change', () => settings.setWeather(this.weather.value));

    root.getElementById('settings-close').addEventListener('click', () => this.close());
    root.getElementById('settings-toggle').addEventListener('click', () => this.toggle());

    if (this.tuning) this.buildTuning();
  }

  buildTuning() {
    const fields = [
      ['mass', 400, 1400, 10],
      ['engineForce', 600, 3200, 50],
      ['brakeForce', 3000, 16000, 100],
      ['maxSteering', 0.2, 0.9, 0.01],
      ['suspensionStiffness', 10, 80, 1],
      ['frictionSlip', 0.8, 2.4, 0.05],
    ];
    this.tuning.textContent = '';
    for (const [name, min, max, step] of fields) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      const value = document.createElement('span');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(this.tune[name]);
      value.textContent = String(this.tune[name]);
      input.addEventListener('input', () => {
        this.tune[name] = Number(input.value);
        value.textContent = input.value;
        this.handlers.onTune(name);
      });
      label.append(`${name} `, input, value);
      this.tuning.appendChild(label);
    }
  }

  // Bring the selects in line after a key changed a setting.
  sync() {
    this.camera.value = this.settings.camera;
    this.time.value = this.settings.time;
    this.weather.value = this.settings.weather;
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    this.panel.hidden = false;
    this.open = true;
  }

  close() {
    this.panel.hidden = true;
    this.open = false;
    this.handlers.onClose();
  }
}