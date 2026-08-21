MG.register('animus', {
    title: 'Animus',
    hint: 'Click a ring to rotate · align all key segments to the line',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const ringCount = 2 + Math.floor(diff / 1.3);
        const segs = 6 + (diff >= 3 ? 2 : 0);
        const W = 320, H = 320, cx = W / 2, cy = H / 2;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const guideSeg = 0;
        const rings = [];
        for (let i = 0; i < ringCount; i++) {
            rings.push({
                rIn: 40 + i * 32,
                rOut: 40 + i * 32 + 26,
                key: api.randInt(0, segs - 1),
                offset: api.randInt(1, segs - 1)
            });
        }

        let solved = false;
        function rel(e) {
            const b = cvs.getBoundingClientRect();
            const x = (e.clientX - b.left) * (cvs.width / b.width) - cx;
            const y = (e.clientY - b.top) * (cvs.height / b.height) - cy;
            return Math.hypot(x, y);
        }
        cvs.addEventListener('click', (e) => {
            if (solved) return;
            const dist = rel(e);
            const ring = rings.find((r) => dist >= r.rIn - 6 && dist <= r.rOut + 6);
            if (!ring) return;
            ring.offset = (ring.offset + 1) % segs;
            checkSolved();
        });
        function checkSolved() {
            const ok = rings.every((r) => (r.key + r.offset) % segs === guideSeg);
            if (ok) {
                solved = true; api.stopTimer(); api.setTag('SYNCHRONIZED');
                setTimeout(() => api.succeed(), 450);
            }
        }

        api.setTag('DESYNCED');
        api.startTimer(Math.max(16, 34 - diff * 2), () => { if (!solved) api.fail(); });

        function draw() {
            ctx.clearRect(0, 0, W, H);
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            const segAng = (Math.PI * 2) / segs;
            const guideAngle = -Math.PI / 2;

            ctx.strokeStyle = solved ? suc : acc; ctx.lineWidth = 2;
            ctx.shadowColor = solved ? suc : acc; ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(guideAngle) * 30, cy + Math.sin(guideAngle) * 30);
            ctx.lineTo(cx + Math.cos(guideAngle) * (rings[ringCount - 1].rOut + 14),
                       cy + Math.sin(guideAngle) * (rings[ringCount - 1].rOut + 14));
            ctx.stroke(); ctx.shadowBlur = 0;

            rings.forEach((ring) => {
                for (let s = 0; s < segs; s++) {
                    const isKey = (s === (ring.key + ring.offset) % segs);
                    const a0 = guideAngle - segAng / 2 + s * segAng;
                    const a1 = a0 + segAng * 0.86;
                    const aligned = isKey && (((ring.key + ring.offset) % segs) === guideSeg);
                    ctx.beginPath();
                    ctx.arc(cx, cy, ring.rOut, a0, a1);
                    ctx.arc(cx, cy, ring.rIn, a1, a0, true);
                    ctx.closePath();
                    if (isKey) {
                        ctx.fillStyle = aligned ? suc : acc;
                        ctx.shadowColor = aligned ? suc : acc; ctx.shadowBlur = 14;
                    } else {
                        ctx.fillStyle = 'rgba(255,255,255,0.07)';
                        ctx.shadowBlur = 0;
                    }
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
                }
            });
            ctx.fillStyle = solved ? suc : '#1a2230';
            ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.stroke();

            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
