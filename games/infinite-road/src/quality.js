// Quality tiers and persisted player settings (plan 4.9).
//
// Low, Medium and High are real tiers. Auto watches the first second of
// driving and picks one of them. Everything the renderer needs is stored in
// the tier record, so a tier change only swaps a few numbers.

export const TIERS = {
  low: {
    id: 'low',
    label: 'Low',
    pixelRatio: 1,
    viewDistance: 600,
    fogFar: 420,
    shadows: false,
    rain: false,
    rainStreaks: 0,
    terrain: { nearRadius: 1, farRadius: 1, octaves: 2, budgetMs: 2 },
    props: { density: 0.45, shadows: false },
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    pixelRatio: 1.5,
    viewDistance: 900,
    fogFar: 700,
    shadows: false,
    rain: true,
    rainStreaks: 2600,
    terrain: { nearRadius: 2, farRadius: 1, octaves: 3, budgetMs: 3 },
    props: { density: 1, shadows: false },
  },
  high: {
    id: 'high',
    label: 'High',
    pixelRatio: 2,
    viewDistance: 1400,
    fogFar: 1100,
    shadows: true,
    rain: true,
    rainStreaks: 4500,
    terrain: { nearRadius: 2, farRadius: 2, octaves: 4, budgetMs: 4 },
    props: { density: 1.3, shadows: true },
  },
};

export const TIER_ORDER = ['low', 'medium', 'high'];

const STORAGE_KEY = 'infinite-road.settings.v1';

// The road midline is always built this far ahead of the car (plan 4.2.2).
export const ROAD_AHEAD = 5000;

const DEFAULTS = {
  quality: 'auto',
  viewDistance: 0, // 0 means "use the tier value"
  volume: 0.7,
  muted: false,
  camera: 'chase',
  time: 'noon',
  weather: 'clear',
};

const TIME_IDS = ['morning', 'noon', 'sunset', 'night'];

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    // Private mode or a broken store must not stop the game.
    return {};
  }
}

export class Settings {
  constructor() {
    const stored = readStored();

    this.quality = TIERS[stored.quality] ? stored.quality : 'auto';

    this.viewDistance = Number(stored.viewDistance) || 0;
    this.volume = typeof stored.volume === 'number' ? Math.min(1, Math.max(0, stored.volume)) : DEFAULTS.volume;
    this.muted = Boolean(stored.muted);
    this.camera = stored.camera === 'hood' ? 'hood' : 'chase';
    this.time = TIME_IDS.includes(stored.time) ? stored.time : DEFAULTS.time;
    this.weather = stored.weather === 'rain' ? 'rain' : DEFAULTS.weather;

    // Auto resolves to a concrete tier on the first frame.
    this.resolved = this.quality === 'auto' ? 'medium' : this.quality;

    this.listeners = [];
  }

  get tier() {
    return TIERS[this.resolved];
  }

  get isAuto() {
    return this.quality === 'auto';
  }

  onChange(listener) {
    this.listeners.push(listener);
  }

  emit(reason) {
    for (const listener of this.listeners) listener(this, reason);
  }

  setQuality(id) {
    this.quality = id === 'auto' ? 'auto' : (TIERS[id] ? id : 'auto');
    if (this.quality !== 'auto') this.resolved = this.quality;
    this.save();
    this.emit('quality');
  }

  // Auto tiering: measure the opening second of driving, then settle once.
  resolveFromFps(avgFps) {
    if (!this.isAuto) return false;
    let next = 'low';
    if (avgFps >= 52) next = 'high';
    else if (avgFps >= 32) next = 'medium';
    if (next === this.resolved) return false;
    this.resolved = next;
    this.emit('quality');
    return true;
  }

  setViewDistance(metres) {
    this.viewDistance = Math.max(0, Math.round(metres));
    this.save();
    this.emit('viewDistance');
  }

  setVolume(value) {
    this.volume = Math.min(1, Math.max(0, Number(value) || 0));
    this.save();
    this.emit('volume');
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.save();
    this.emit('muted');
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setCamera(mode) {
    this.camera = mode === 'hood' ? 'hood' : 'chase';
    this.save();
    this.emit('camera');
    return this.camera;
  }

  setTime(time) {
    this.time = TIME_IDS.includes(time) ? time : DEFAULTS.time;
    this.save();
    this.emit('time');
    return this.time;
  }

  setWeather(weather) {
    this.weather = weather === 'rain' ? 'rain' : 'clear';
    this.save();
    this.emit('weather');
    return this.weather;
  }

  // View distance in metres: the player override wins, otherwise the tier.
  get activeViewDistance() {
    if (this.viewDistance > 0) return this.viewDistance;
    return this.tier.viewDistance;
  }

  get activePixelRatio() {
    const device = window.devicePixelRatio || 1;
    return Math.max(0.75, Math.min(device, this.tier.pixelRatio));
  }

  get activeFogFar() {
    const view = this.activeViewDistance;
    const ratio = this.tier.fogFar / this.tier.viewDistance;
    return Math.round(view * ratio);
  }

  save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        quality: this.quality,
        viewDistance: this.viewDistance,
        volume: this.volume,
        muted: this.muted,
        camera: this.camera,
        time: this.time,
        weather: this.weather,
      }));
    } catch (error) {
      // A full or disabled store is not worth breaking the game over.
    }
  }
}