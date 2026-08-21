MG.register('parry', {
    title: 'Deflect',
    hint: 'Press ← ↑ → (or A W D) to parry each strike inside the ring',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 320, H = 300, cx = W / 2, cy = H / 2;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const need = 4 + diff;
        const maxMiss = Math.max(2, 5 - diff);
        const speed = 0.012 + diff * 0.004;
        const winLo = 0.72;
        const guardR = 30, maxR = 150;
        const DIRS = { L: [-1, 0], U: [0, -1], R: [1, 0] };
        let strike = null, gap = 16, made = 0, miss = 0, done = false, flash = 0, flashCol = '';

        api.setDots(need);
        function spawn() { const d = ['L', 'U', 'R'][api.randInt(0, 2)]; strike = { dir: d, t: 0 }; }
        function resolve(ok) {
            strike = null; gap = 14; flash = 7; flashCol = ok ? suc : dng;
            if (ok) { made++; api.sfx('latch'); api.setDots(need, Array.from({ length: need }, (_, i) => i < made ? 'done' : '')); if (made >= need) { done = true; api.stopTimer(); api.setTag('FLAWLESS'); document.removeEventListener('keydown', key); setTimeout(() => api.succeed(), 300); return; } }
            else { miss++; api.shake(); if (miss >= maxMiss) { done = true; api.stopTimer(); document.removeEventListener('keydown', key); setTimeout(() => api.fail(), 300); return; } }
        }
        function key(e) {
            if (done || !strike) return;
            let d = null;
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') d = 'L';
            else if (e.code === 'ArrowUp' || e.code === 'KeyW') d = 'U';
            else if (e.code === 'ArrowRight' || e.code === 'KeyD') d = 'R';
            if (!d) return;
            e.preventDefault();
            resolve(d === strike.dir && strike.t >= winLo);
        }
        document.addEventListener('keydown', key);

        api.setTag('GUARD');
        api.startTimer(Math.max(18, 30 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); document.removeEventListener('keydown', key); setTimeout(() => api.fail(), 200); } });

        function draw() {
            if (!done) {
                if (strike) { strike.t += speed; if (strike.t >= 1) resolve(false); }
                else if (gap > 0) { gap--; if (gap === 0) spawn(); }
            }
            if (flash > 0) flash--;
            ctx.clearRect(0, 0, W, H);

            // parry ring
            const inWin = strike && strike.t >= winLo;
            ctx.strokeStyle = inWin ? suc : 'rgba(255,255,255,0.18)'; ctx.lineWidth = inWin ? 4 : 2;
            ctx.shadowColor = inWin ? suc : 'transparent'; ctx.shadowBlur = inWin ? 14 : 0;
            ctx.beginPath(); ctx.arc(cx, cy, guardR + 24, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;

            // guard
            ctx.fillStyle = flash > 0 ? flashCol : 'rgba(255,255,255,0.12)';
            ctx.shadowColor = flash > 0 ? flashCol : 'transparent'; ctx.shadowBlur = flash > 0 ? 18 : 0;
            ctx.beginPath(); ctx.arc(cx, cy, guardR, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

            // strike
            if (strike) {
                const v = DIRS[strike.dir];
                const r = maxR - (maxR - (guardR + 8)) * strike.t;
                const sx = cx + v[0] * r, sy = cy + v[1] * r;
                ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.atan2(-v[1], -v[0]));
                ctx.fillStyle = inWin ? suc : dng; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
                ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
                ctx.restore(); ctx.shadowBlur = 0;
            }

            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
            ctx.fillText('PARRIED ' + made + ' / ' + need, cx, H - 14);
            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
