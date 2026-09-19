'use strict';

/**
 * The radar timeline: a list of frames and a playhead over them.
 *
 * Deliberately free of both the map and the DOM. The scrub logic is the part
 * most worth testing (off-by-one at the loop boundary is how a two-hour loop
 * ends up showing the oldest frame as "now"), and a model that needs a GPU
 * canvas to test does not get tested.
 *
 * Frames are ordered oldest to newest, so index 0 is two hours ago and the
 * last index is the most recent scan. Forecast frames, when a provider offers
 * them, continue past the last observed frame on the same axis.
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

class RadarTimeline {
  /**
   * @param {object} [options]
   * @param {Array<{time:number, path:string, kind?:'past'|'forecast'}>} [options.frames]
   * @param {number} [options.speed=1]      playback multiplier
   * @param {number} [options.frameMs=500]  wall-clock time per frame at 1x
   * @param {number} [options.dwellMs=1200] extra pause on the newest frame
   */
  constructor(options = {}) {
    this.frames = [];
    this.index = 0;
    this.playing = false;
    this.speed = options.speed || 1;
    this.frameMs = options.frameMs || 500;
    // The last frame is the one people actually read, so the loop rests on it
    // rather than snapping straight back to two hours ago.
    this.dwellMs = options.dwellMs ?? 1200;
    this.listeners = new Set();
    if (options.frames) this.setFrames(options.frames);
  }

  /**
   * Replace the frame list, keeping the playhead on the same *moment* rather
   * than the same index. A refresh appends a new frame and drops the oldest,
   * so holding the index would silently slide the view back in time on every
   * poll — the bug that makes a "live" radar drift into the past.
   */
  setFrames(frames) {
    const previousTime = this.frames[this.index]?.time;
    this.frames = [...frames].sort((a, b) => a.time - b.time);

    if (previousTime == null) {
      this.index = Math.max(0, this.frames.length - 1);
    } else {
      let nearest = 0;
      let best = Infinity;
      this.frames.forEach((frame, i) => {
        const distance = Math.abs(frame.time - previousTime);
        if (distance < best) { best = distance; nearest = i; }
      });
      this.index = nearest;
    }
    this.#emit();
    return this;
  }

  get current() { return this.frames[this.index] || null; }
  get length() { return this.frames.length; }
  get atLatest() { return this.index === this.frames.length - 1; }

  /** 0..1 across the loop, for a progress bar. */
  get progress() {
    return this.frames.length < 2 ? 1 : this.index / (this.frames.length - 1);
  }

  /** How long the current frame should be held before advancing. */
  get holdMs() {
    const base = this.frameMs / (this.speed || 1);
    return this.atLatest ? base + this.dwellMs : base;
  }

  seek(index) {
    const next = clamp(Math.round(index), 0, Math.max(0, this.frames.length - 1));
    if (next !== this.index) { this.index = next; this.#emit(); }
    return this;
  }

  /** Seek by fraction, which is what a scrub bar hands us. */
  seekFraction(fraction) {
    return this.seek(clamp(fraction, 0, 1) * Math.max(0, this.frames.length - 1));
  }

  /** Seek to the frame nearest a timestamp, for "what did it look like at". */
  seekTime(time) {
    if (this.frames.length === 0) return this;
    let nearest = 0;
    let best = Infinity;
    this.frames.forEach((frame, i) => {
      const distance = Math.abs(frame.time - time);
      if (distance < best) { best = distance; nearest = i; }
    });
    return this.seek(nearest);
  }

  step(delta = 1) {
    if (this.frames.length === 0) return this;
    // Wrap in both directions so a scrub backwards off the start lands on the
    // newest frame rather than sticking at zero.
    const size = this.frames.length;
    return this.seek(((this.index + delta) % size + size) % size);
  }

  play() { if (!this.playing) { this.playing = true; this.#emit(); } return this; }
  pause() { if (this.playing) { this.playing = false; this.#emit(); } return this; }
  toggle() { return this.playing ? this.pause() : this.play(); }

  setSpeed(speed) {
    this.speed = clamp(speed, 0.25, 8);
    this.#emit();
    return this;
  }

  /** Jump to the newest frame — the "live" button. */
  jumpToLatest() { return this.seek(this.frames.length - 1); }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  #emit() {
    const snapshot = {
      index: this.index,
      frame: this.current,
      playing: this.playing,
      speed: this.speed,
      length: this.frames.length,
      progress: this.progress,
      atLatest: this.atLatest
    };
    for (const listener of this.listeners) {
      try { listener(snapshot); } catch { /* a bad listener must not stop playback */ }
    }
  }
}

/**
 * Parse RainViewer's frame index into the timeline's shape.
 *
 * Past and forecast frames are concatenated onto one axis, because a user
 * scrubbing forward past "now" is asking the same question they were asking
 * before it — what is this storm doing to my customer's roof — and a separate
 * forecast control would make them ask it twice.
 */
function framesFromRainViewer(payload, { includeForecast = true } = {}) {
  const host = payload?.host;
  const past = payload?.radar?.past || [];
  const forecast = includeForecast ? (payload?.radar?.nowcast || []) : [];
  if (!host) return [];

  return [
    ...past.map((f) => ({ time: f.time * 1000, path: f.path, kind: 'past', host })),
    ...forecast.map((f) => ({ time: f.time * 1000, path: f.path, kind: 'forecast', host }))
  ];
}

module.exports = { RadarTimeline, framesFromRainViewer, clamp };
