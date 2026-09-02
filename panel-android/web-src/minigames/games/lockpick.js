MG.register('lockpick', {
    title: 'Lockpick',
    hint: 'Move mouse to rotate · click on the sweet spot',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const pins = 2 + Math.floor(diff / 1.3);
        const tol = Math.max(0.1, 0.32 - diff * 0.04);
        const W = 300, H = 300, cx = W / 2, cy = H / 2, R = 100;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'grab';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const sweetspots = [];
        for (let i = 0; i < pins; i++) sweetspots.push(api.rand(0, Math.PI * 2));
        let pin = 0, pickAng = 0, ended = false;
        api.setDots(pins);

        function rel(e) {
            const b = cvs.getBoundingClientRect();
            const x = (e.clientX - b.left) * (cvs.width / b.width) - cx;
            const y = (e.clientY - b.top) * (cvs.height / b.height) - cy;
            return Math.atan2(y, x);
        }
        function diffAng(a, b) {
            let d = Math.abs(((a - b) % (Math.PI * 2)));
            return Math.min(d, Math.PI * 2 - d);
        }
        cvs.addEventListener('mousemove', (e) => { pickAng = rel(e); });
        cvs.addEventListener('click', () => {
            if (ended) return;
            if (diffAng(pickAng, sweetspots[pin]) < tol) {
                pin++;
                api.sfx('latch');
                api.setDots(pins, Array.from({ length: pins }, (_, i) => i < pin ? 'done' : ''));
                if (pin >= pins) { ended = true; api.stopTimer(); setTimeout(() => api.succeed(), 250); }
            } else { api.shake(); /* light penalty: lose a sliver of time */ api.addTime(-1500); }
        });

        api.setTag('PICKING');
        api.startTimer(Math.max(10, 22 - diff * 2), () => { if (!ended) api.fail(); });

        function draw() {
            ctx.clearRect(0, 0, W, H);
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, cy, R - 16, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#1a2230'; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.stroke();

            const prox = 1 - Math.min(1, diffAng(pickAng, sweetspots[pin]) / (Math.PI / 2));
            const close = diffAng(pickAng, sweetspots[pin]) < tol;
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(pickAng);
            ctx.strokeStyle = close ? suc : acc; ctx.lineWidth = 4; ctx.lineCap = 'round';
            ctx.shadowColor = close ? suc : acc; ctx.shadowBlur = close ? 16 : 6 * prox + 2;
            ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(R + 8, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(R + 8, 0); ctx.lineTo(R - 4, -7); ctx.lineTo(R - 4, 7); ctx.closePath();
            ctx.fillStyle = close ? suc : acc; ctx.fill();
            ctx.restore(); ctx.shadowBlur = 0;

            ctx.fillStyle = close ? suc : 'rgba(255,255,255,0.4)';
            ctx.font = '12px monospace'; ctx.textAlign = 'center';
            ctx.fillText(close ? 'CLICK NOW' : (prox > 0.7 ? 'warm…' : 'searching…'), cx, cy + R + 22);

            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
