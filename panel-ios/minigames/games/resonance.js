MG.register('resonance', {
    title: 'Resonance',
    hint: 'Tune the sliders so your wave matches the target',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const comps = 2 + Math.floor(diff / 1.5);
        const tol = Math.max(0.06, 0.16 - diff * 0.02);
        const W = 480, H = 180;

        const parts = [];
        for (let i = 0; i < comps; i++) {
            parts.push({
                freq: 1 + i * 0.8 + api.rand(-0.2, 0.2),
                sign: i === comps - 1 && diff >= 3 ? -1 : 1,
                target: api.rand(0.2, 1),
                cur: api.rand(0, 1)
            });
        }

        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;gap:14px;width:480px;';
        box.innerHTML = `
            <canvas id="wv" width="${W}" height="${H}" style="border:1px solid var(--line);border-radius:8px;background:rgba(0,0,0,.25);"></canvas>
            <div id="match" class="label" style="text-align:center;">MATCH: 0%</div>
            <div id="sliders" style="display:flex;flex-direction:column;gap:10px;"></div>`;
        api.board.appendChild(box);
        const cvs = box.querySelector('#wv');
        const ctx = cvs.getContext('2d');
        const slBox = box.querySelector('#sliders');
        const matchEl = box.querySelector('#match');

        parts.forEach((p, i) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:12px;';
            row.innerHTML = `
                <span style="width:74px;font-size:11px;color:${p.sign < 0 ? 'var(--danger)' : 'var(--muted)'};">
                    ${p.sign < 0 ? 'INVERT ' : 'NODE '}${i + 1}</span>
                <input type="range" min="0" max="100" value="${Math.round(p.cur * 100)}"
                    style="flex:1;accent-color:${p.sign < 0 ? 'var(--danger)' : 'var(--accent)'};">`;
            const slider = row.querySelector('input');
            slider.addEventListener('input', () => { p.cur = slider.value / 100; });
            slBox.appendChild(row);
        });

        function waveAt(x, useTarget) {
            const t = (x / W) * Math.PI * 4;
            let y = 0;
            parts.forEach((p) => {
                const amp = useTarget ? p.target : p.cur;
                y += p.sign * amp * Math.sin(t * p.freq);
            });
            return y;
        }
        function matchPct() {
            let err = 0;
            parts.forEach((p) => { err += Math.abs(p.cur - p.target); });
            const norm = err / parts.length;
            return Math.max(0, 1 - norm);
        }

        let solved = false;
        api.setTag('CALIBRATING');
        api.startTimer(Math.max(16, 38 - diff * 3), () => { if (!solved) api.fail(); });

        function plot(useTarget, color, glow) {
            ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.shadowColor = glow ? color : 'transparent'; ctx.shadowBlur = glow ? 8 : 0;
            ctx.beginPath();
            const scale = H / 2 / (parts.length + 0.5);
            for (let x = 0; x <= W; x += 2) {
                const y = H / 2 - waveAt(x, useTarget) * scale;
                x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.stroke(); ctx.shadowBlur = 0;
        }
        function draw() {
            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            plot(true, 'rgba(255,255,255,0.28)', false);   // target ghost
            plot(false, acc, true);

            const m = matchPct();
            matchEl.textContent = 'MATCH: ' + Math.round(m * 100) + '%';
            matchEl.style.color = m > 0.92 ? 'var(--success)' : 'var(--muted)';

            if (!solved && (1 - m) < tol) {
                solved = true; api.stopTimer(); api.setTag('LOCKED');
                setTimeout(() => api.succeed(), 400);
                return;
            }
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
