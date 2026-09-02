const SFX = (function () {
    let ctx = null;
    let enabled = true;
    let master = 0.5;

    function ac() {
        if (!ctx) {
            try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
            catch (e) { enabled = false; }
        }
        if (ctx && ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function tone(freq, dur, type, vol, slideTo, delay) {
        if (!enabled) return;
        const a = ac(); if (!a) return;
        const t0 = a.currentTime + (delay || 0);
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        const v = (vol == null ? 0.3 : vol) * master;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(v, t0 + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain); gain.connect(a.destination);
        osc.start(t0); osc.stop(t0 + dur + 0.02);
    }

    function noise(dur, vol, filterFreq) {
        if (!enabled) return;
        const a = ac(); if (!a) return;
        const t0 = a.currentTime;
        const len = Math.floor(a.sampleRate * dur);
        const buf = a.createBuffer(1, len, a.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = a.createBufferSource(); src.buffer = buf;
        const filt = a.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = filterFreq || 1200;
        const gain = a.createGain(); gain.gain.value = (vol == null ? 0.2 : vol) * master;
        src.connect(filt); filt.connect(gain); gain.connect(a.destination);
        src.start(t0);
    }

    const lib = {
        click:   () => tone(520, 0.05, 'square', 0.16),
        tick:    () => tone(880, 0.03, 'square', 0.10),
        select:  () => tone(660, 0.06, 'triangle', 0.18),
        step:    () => { tone(700, 0.07, 'sine', 0.2); },
        good:    () => { tone(740, 0.08, 'sine', 0.22); tone(990, 0.1, 'sine', 0.18, null, 0.06); },
        bad:     () => { tone(200, 0.18, 'sawtooth', 0.22, 90); },
        error:   () => { tone(160, 0.12, 'square', 0.2, 110); },
        success: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.22, null, i * 0.08)); },
        fail:    () => { [330, 247, 165].forEach((f, i) => tone(f, 0.22, 'sawtooth', 0.22, null, i * 0.1)); },
        charge:  () => tone(300, 0.25, 'sine', 0.2, 700),
        zap:     () => { noise(0.12, 0.18, 2200); tone(900, 0.08, 'square', 0.12, 300); },
        beep:    () => tone(1040, 0.05, 'sine', 0.14),
        latch:   () => { tone(420, 0.05, 'square', 0.2); tone(620, 0.06, 'square', 0.16, null, 0.04); },
        whoosh:  () => noise(0.2, 0.14, 800),
        heartbeat: () => { tone(70, 0.12, 'sine', 0.3); tone(60, 0.1, 'sine', 0.24, null, 0.16); }
    };

    function play(name) {
        if (!enabled) return;
        const fn = lib[name];
        if (fn) try { fn(); } catch (e) {}
    }

    return {
        play,
        setEnabled: (v) => { enabled = !!v; },
        setVolume:  (v) => { master = Math.max(0, Math.min(1, v)); },
        isEnabled:  () => enabled,
        _lib: lib
    };
})();

if (typeof window !== 'undefined') window.SFX = SFX;
