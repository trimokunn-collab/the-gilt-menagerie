// The Gilt Menagerie — tiny WebAudio synth.
// Every sound is synthesised in code (oscillator blips); the game ships
// no audio files and makes no network requests. Sound starts only after
// a user gesture (the Begin button), as browsers require.
"use strict";

const HeistAudio = (() => {
  let ctx = null;
  let enabled = true;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, when, slideTo) {
    if (!enabled) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + (when || 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.08, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    unlock() { ensure(); },
    setEnabled(on) { enabled = on; },
    isEnabled() { return enabled; },
    // A soft glassy ping when a treasure is lifted.
    loot() { tone(1318, 0.12, "sine", 0.07); tone(1760, 0.18, "sine", 0.05, 0.06); },
    // A rising chirp the first time an eye lands on the thief.
    spotted() { tone(620, 0.1, "square", 0.045, 0, 940); },
    // The klaxon: three falling blasts.
    alarm() {
      for (let i = 0; i < 3; i++) tone(880, 0.22, "sawtooth", 0.05, i * 0.26, 440);
    },
    // A low thud for bumping into furniture in the dark.
    bump() { tone(140, 0.07, "sine", 0.05); },
    // The door sighing open.
    door() { tone(392, 0.16, "triangle", 0.06); tone(587, 0.24, "triangle", 0.06, 0.12); },
    // A small pleased arpeggio for a clean getaway.
    win() {
      tone(523, 0.14, "triangle", 0.06);
      tone(659, 0.14, "triangle", 0.06, 0.12);
      tone(784, 0.14, "triangle", 0.06, 0.24);
      tone(1046, 0.3, "triangle", 0.07, 0.36);
    },
    click() { tone(740, 0.05, "sine", 0.04); },
  };
})();
