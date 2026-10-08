// Keyboard, touch and gamepad input (plan 4.8).
//
// One Input object owns the three sources and merges them into a single
// control state: steer (-1..1), throttle, brake and handbrake. The game loop
// reads that state and never asks where it came from.

const KEY_MAP = {
  KeyW: 'throttle', ArrowUp: 'throttle',
  KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'handbrake',
};

export class Input {
  constructor(options = {}) {
    this.onAction = options.onAction || (() => {});
    this.enabled = false;
    this.keys = { throttle: false, brake: false, left: false, right: false, handbrake: false };
    this.touch = { throttle: false, brake: false, left: false, right: false, handbrake: false };
    this.gamepadIndex = -1;
    this.gamepadName = '';
    this.faceState = [false, false, false];
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.handbrake = false;
    this.usingGamepad = false;

    this.state = { steer: 0, throttle: 0, brake: 0, handbrake: false };

    window.addEventListener('keydown', (event) => this.handleKey(event, true), { passive: false });
    window.addEventListener('keyup', (event) => this.handleKey(event, false));
    window.addEventListener('blur', () => this.releaseAll());
    window.addEventListener('gamepadconnected', (event) => {
      this.gamepadIndex = event.gamepad.index;
      this.gamepadName = event.gamepad.id;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadIndex = -1;
      this.gamepadName = '';
    });
  }

  handleKey(event, pressed) {
    // Keys the game owns: never scroll the page with them.
    if (KEY_MAP[event.code]) event.preventDefault();

    if (pressed && !event.repeat) {
      switch (event.code) {
        case 'KeyR':
          this.onAction('restart');
          return;
        case 'KeyM':
          this.onAction('mute');
          return;
        case 'KeyC':
          this.onAction('camera');
          return;
        case 'KeyT':
          this.onAction('time');
          return;
        case 'KeyY':
          this.onAction('weather');
          return;
        case 'Escape':
          this.onAction('settings');
          return;
        case 'Enter':
        case 'Space':
          // Space is the handbrake once the run is live, but before that it
          // is how you start.
          if (event.code === 'Space' && this.enabled) break;
          this.onAction('confirm');
          return;
        default:
          break;
      }
    }

    if (!this.enabled) return;
    const target = KEY_MAP[event.code];
    if (target) this.keys[target] = pressed;
  }

  // Hold to drive: the existing on-screen buttons keep working, plus a
  // handbrake button for phones.
  bindTouch(element, action) {
    if (!element) return;
    const press = (event) => {
      event.preventDefault();
      this.touch[action] = true;
      try {
        element.setPointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture is optional; the button still works without it.
      }
    };
    const release = (event) => {
      if (event) event.preventDefault();
      this.touch[action] = false;
    };
    element.addEventListener('pointerdown', press);
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('pointerleave', release);
    element.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  releaseAll() {
    for (const key of Object.keys(this.keys)) this.keys[key] = false;
    for (const key of Object.keys(this.touch)) this.touch[key] = false;
  }

  // Poll the pad and merge everything into this.state.
  update(dt) {
    let steer = 0;
    if (this.keys.left) steer -= 1;
    if (this.keys.right) steer += 1;
    if (this.touch.left) steer -= 1;
    if (this.touch.right) steer += 1;

    let throttle = this.keys.throttle || this.touch.throttle ? 1 : 0;
    let brake = this.keys.brake || this.touch.brake ? 1 : 0;
    let handbrake = this.keys.handbrake || this.touch.handbrake;

    // Gamepad: left stick steers, triggers drive and brake, A is handbrake.
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const candidate of pads) {
      if (!candidate) continue;
      if (this.gamepadIndex === -1 || candidate.index === this.gamepadIndex) {
        pad = candidate;
        this.gamepadIndex = candidate.index;
        break;
      }
    }

    if (pad) {
      this.gamepadName = pad.id;
      const axis = pad.axes.length > 0 ? pad.axes[0] : 0;
      const deadZone = Math.abs(axis) < 0.12 ? 0 : axis;
      if (deadZone !== 0) {
        steer += deadZone;
        this.usingGamepad = true;
      } else if (this.usingGamepad) {
        this.usingGamepad = false;
      }
      const rightTrigger = pad.buttons[7] ? pad.buttons[7].value : 0;
      const leftTrigger = pad.buttons[6] ? pad.buttons[6].value : 0;
      throttle = Math.max(throttle, rightTrigger);
      brake = Math.max(brake, leftTrigger);
      if (pad.buttons[0] && pad.buttons[0].pressed) handbrake = true;

      // Face buttons act once per press, not once per frame.
      const face = [
        pad.buttons[1] && pad.buttons[1].pressed, // B: restart
        pad.buttons[3] && pad.buttons[3].pressed, // Y: mute
        pad.buttons[9] && pad.buttons[9].pressed, // Start: settings
      ];
      const actions = ['restart', 'mute', 'settings'];
      for (let i = 0; i < face.length; i += 1) {
        if (face[i] && !this.faceState[i]) this.onAction(actions[i]);
        this.faceState[i] = face[i];
      }
    }

    this.steer = Math.max(-1, Math.min(1, steer));
    this.throttle = throttle;
    this.brake = brake;
    this.handbrake = Boolean(handbrake);

    this.state.steer = this.steer;
    this.state.throttle = this.throttle;
    this.state.brake = this.brake;
    this.state.handbrake = this.handbrake;
    return this.state;
  }

  get hasGamepad() {
    return this.gamepadIndex !== -1 && this.gamepadName !== '';
  }
}