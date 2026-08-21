MG.register('pillpress', {
    title: 'Pill Press',
    hint: 'SPACE / click when the press is fully down on the die',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 360, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const need = 4 + diff;
        const maxWrong = Math.max(2, 5 - diff);
        const window = Math.max(0.1, 0.24 - diff * 0.025);
        let phase = 0, spd = 0.03 + diff * 0.006, made = 0, wrong = 0, done = false, flash = 0;

        api.setDots(need);

        function press() {
            if (done) return;
            const pos = (1 - Math.cos(phase)) / 2; // 0 top .. 1 bottom
            if (pos >= 1 - window) {
                made++; api.sfx('latch'); flash = 6; spd += 0.002;
                api.setDots(need, Array.from({ length: need }, (_, i) => i < made ? 'done' : ''));
                if (made >= need) { done = true; api.stopTimer(); api.setTag('PRESSED'); setTimeout(() => api.succeed(), 300); }
            } else {
                wrong++; api.shake();
                if (wrong >= maxWrong) { done = true; api.stopTimer(); setTimeout(() => api.fail(), 300); }
            }
        }
        function key(e) { if (e.code === 'Space') { e.preventDefault(); press(); } }
        document.addEventListener('keydown', key);
        cvs.addEventListener('click', press);

        api.setTag('PRESSING');
        api.startTimer(Math.max(16, 28 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); document.removeEventListener('keydown', key); setTimeout(() => api.fail(), 200); } });

        function draw() {
            if (!done) phase += spd;
            const pos = (1 - Math.cos(phase)) / 2;
            ctx.clearRect(0, 0, W, H);

            const cx = W / 2, topY = 40, travel = 120, dieY = topY + travel + 26;
            // frame posts
            ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(cx - 70, 30); ctx.lineTo(cx - 70, dieY + 20); ctx.moveTo(cx + 70, 30); ctx.lineTo(cx + 70, dieY + 20); ctx.stroke();
            // die / target zone
            const inWin = pos >= 1 - window;
            ctx.fillStyle = 'rgba(57,217,138,0.15)'; ctx.fillRect(cx - 46, dieY - 6, 92, 14);
            ctx.strokeStyle = inWin ? suc : 'rgba(57,217,138,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(cx - 46, dieY - 6, 92, 14);
            // press head
            const hy = topY + travel * pos;
            ctx.fillStyle = flash > 0 ? suc : acc; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = inWin ? 16 : 6;
            ctx.fillRect(cx - 40, hy - 30, 80, 30); ctx.shadowBlur = 0;
            if (flash > 0) flash--;

            // pills made
            for (let i = 0; i < need; i++) {
                ctx.fillStyle = i < made ? suc : 'rgba(255,255,255,0.12)';
                ctx.beginPath(); ctx.ellipse(cx - (need - 1) * 9 + i * 18, dieY + 40, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
            }
            // strike dots
            for (let i = 0; i < maxWrong; i++) { ctx.fillStyle = i < wrong ? dng : 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(20 + i * 14, 24, 4, 0, Math.PI * 2); ctx.fill(); }

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
