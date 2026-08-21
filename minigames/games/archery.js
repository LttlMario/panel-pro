MG.register('archery', {
    title: 'Longshot',
    hint: 'Drag from the bow toward the target · longer drag = more power · release',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 460, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'crosshair';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const bow = { x: 56, y: H - 60 };
        const g = 0.4, k = 0.17, maxPull = 150;
        const rounds = 2 + Math.floor(diff / 2);
        const tgR = Math.max(17, 32 - diff * 3);
        const aidLen = diff <= 2 ? 90 : diff <= 4 ? 46 : 24;
        const wind = diff >= 4 ? (Math.random() < 0.5 ? -1 : 1) * (0.015 + diff * 0.006) : 0;
        let round = 0, aiming = false, aim = { x: 0, y: 0 }, arrow = null, done = false;

        api.setDots(rounds);
        function newTarget() { return { x: 280 + Math.random() * (W - 320), y: 55 + Math.random() * (H - 150) }; }
        let target = newTarget();

        function rel(e) { const b = cvs.getBoundingClientRect(); return { x: (e.clientX - b.left) * (W / b.width), y: (e.clientY - b.top) * (H / b.height) }; }
        function setAim(r) { aim = { x: r.x - bow.x, y: r.y - bow.y }; const m = Math.hypot(aim.x, aim.y); if (m > maxPull) { aim.x *= maxPull / m; aim.y *= maxPull / m; } }
        cvs.addEventListener('mousedown', (e) => { if (done || arrow) return; aiming = true; setAim(rel(e)); });
        cvs.addEventListener('mousemove', (e) => { if (aiming) setAim(rel(e)); });
        function loose() { if (!aiming) return; aiming = false; if (Math.hypot(aim.x, aim.y) < 14) return; arrow = { x: bow.x, y: bow.y, vx: aim.x * k, vy: aim.y * k }; api.sfx('whoosh'); }
        cvs.addEventListener('mouseup', loose);
        cvs.addEventListener('mouseleave', () => { aiming = false; });

        api.setTag('AIM');
        api.startTimer(Math.max(22, 38 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); setTimeout(() => api.fail(), 200); } });

        function draw() {
            if (arrow && !done) {
                arrow.vy += g; arrow.vx += wind; arrow.x += arrow.vx; arrow.y += arrow.vy;
                if (Math.hypot(arrow.x - target.x, arrow.y - target.y) < tgR) {
                    round++; api.sfx('good'); api.setDots(rounds, Array.from({ length: rounds }, (_, i) => i < round ? 'done' : ''));
                    if (round >= rounds) { done = true; api.stopTimer(); api.setTag('BULLSEYE'); setTimeout(() => api.succeed(), 300); return; }
                    target = newTarget(); arrow = null;
                } else if (arrow.y > H - 14 || arrow.x > W + 20 || arrow.x < -20 || arrow.y < -60) { arrow = null; api.sfx('bad'); }
            }
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, H - 12, W, 12);

            ctx.strokeStyle = suc; ctx.lineWidth = 2; ctx.shadowColor = suc; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(target.x, target.y, tgR, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(target.x, target.y, tgR * 0.55, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
            ctx.fillStyle = suc; ctx.beginPath(); ctx.arc(target.x, target.y, 3, 0, Math.PI * 2); ctx.fill();

            if (aiming && Math.hypot(aim.x, aim.y) >= 14) {
                let sx = bow.x, sy = bow.y, vx = aim.x * k, vy = aim.y * k;
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                for (let i = 0; i < aidLen; i++) {
                    vy += g; vx += wind; sx += vx; sy += vy;
                    if (sy > H - 12 || sx > W + 10 || sx < -10) break;
                    if (i % 3 === 0) { ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fill(); }
                }
            }

            ctx.strokeStyle = acc; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(bow.x, bow.y, 14, -Math.PI / 2.1, Math.PI / 2.1); ctx.stroke();
            if (aiming) {
                const ex = bow.x + aim.x, ey = bow.y + aim.y, ang = Math.atan2(aim.y, aim.x);
                ctx.strokeStyle = 'rgba(0,224,184,0.7)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(bow.x, bow.y); ctx.lineTo(ex, ey); ctx.stroke();
                ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
                ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-2, -5); ctx.lineTo(-2, 5); ctx.closePath(); ctx.fill();
                ctx.restore();
            }

            if (arrow) {
                const a = Math.atan2(arrow.vy, arrow.vx);
                ctx.save(); ctx.translate(arrow.x, arrow.y); ctx.rotate(a);
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(8, 0); ctx.stroke();
                ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(2, -3); ctx.lineTo(2, 3); ctx.closePath(); ctx.fill();
                ctx.restore();
            }
            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
