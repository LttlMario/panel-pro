MG.register('counterfeit', {
    title: 'Counterfeit',
    hint: 'Drag the plate onto the guides · hold it aligned to print each bill',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 420, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'grab';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const need = 3 + Math.floor(diff / 2);
        const tol = Math.max(8, 22 - diff * 3);
        const printTime = 0.55 + diff * 0.06;
        const drift = diff >= 3 ? 0.25 + diff * 0.12 : 0;
        const tx = W / 2, ty = 120, pw = 150, ph = 70;
        let printed = 0, charge = 0, done = false, last = performance.now();
        let px = 0, py = 0, dragging = false, off = { x: 0, y: 0 };

        function newPlate() { const a = Math.random() * Math.PI * 2, r = 55 + Math.random() * 55; px = tx + Math.cos(a) * r; py = ty + Math.sin(a) * r; charge = 0; }
        newPlate();
        api.setDots(need);

        function rel(e) { const b = cvs.getBoundingClientRect(); return { x: (e.clientX - b.left) * (W / b.width), y: (e.clientY - b.top) * (H / b.height) }; }
        cvs.addEventListener('mousedown', (e) => { const r = rel(e); if (Math.abs(r.x - px) < pw / 2 && Math.abs(r.y - py) < ph / 2) { dragging = true; off.x = r.x - px; off.y = r.y - py; cvs.style.cursor = 'grabbing'; } });
        cvs.addEventListener('mousemove', (e) => { if (!dragging) return; const r = rel(e); px = r.x - off.x; py = r.y - off.y; });
        cvs.addEventListener('mouseup', () => { dragging = false; cvs.style.cursor = 'grab'; });
        cvs.addEventListener('mouseleave', () => { dragging = false; });

        api.setTag('PRINTING');
        api.startTimer(Math.max(18, 32 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); setTimeout(() => api.fail(), 200); } });

        function draw() {
            const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
            if (!done) {
                if (drift && !dragging) { px += (Math.random() - 0.5) * drift; py += (Math.random() - 0.5) * drift; }
                px = Math.max(pw / 2, Math.min(W - pw / 2, px)); py = Math.max(40 + ph / 2, Math.min(H - 30 - ph / 2, py));
                const aligned = Math.hypot(px - tx, py - ty) < tol;
                if (aligned) { charge += dt / printTime; if (charge >= 1) { printed++; api.sfx('latch'); api.setDots(need, Array.from({ length: need }, (_, i) => i < printed ? 'done' : '')); if (printed >= need) { done = true; api.stopTimer(); api.setTag('PRINTED'); setTimeout(() => api.succeed(), 300); } else newPlate(); } }
                else charge = Math.max(0, charge - dt / printTime * 1.5);
            }
            ctx.clearRect(0, 0, W, H);

            // press body
            ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.strokeRect(tx - pw / 2 - 14, ty - ph / 2 - 14, pw + 28, ph + 28);
            // target guides (registration marks)
            const aligned = Math.hypot(px - tx, py - ty) < tol;
            ctx.strokeStyle = aligned ? suc : 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]); ctx.strokeRect(tx - pw / 2, ty - ph / 2, pw, ph); ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(tx - 12, ty); ctx.lineTo(tx + 12, ty); ctx.moveTo(tx, ty - 12); ctx.lineTo(tx, ty + 12); ctx.stroke();

            // the plate (movable bill)
            ctx.save(); ctx.globalAlpha = 0.92;
            ctx.fillStyle = aligned ? 'rgba(57,217,138,0.18)' : 'rgba(0,224,184,0.12)';
            ctx.fillRect(px - pw / 2, py - ph / 2, pw, ph);
            ctx.strokeStyle = aligned ? suc : acc; ctx.lineWidth = 2; ctx.strokeRect(px - pw / 2, py - ph / 2, pw, ph);
            ctx.strokeStyle = aligned ? suc : acc; ctx.beginPath(); ctx.arc(px, py, 16, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px - 10, py); ctx.lineTo(px + 10, py); ctx.moveTo(px, py - 10); ctx.lineTo(px, py + 10); ctx.stroke();
            ctx.fillStyle = aligned ? suc : acc; ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillText('$100', px - pw / 2 + 8, py - ph / 2 + 16);
            ctx.restore();

            // charge bar
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(40, H - 26, W - 80, 8);
            ctx.fillStyle = suc; ctx.fillRect(40, H - 26, (W - 80) * charge, 8);
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
            ctx.fillText(aligned ? 'HOLD STEADY — PRINTING' : 'align the plate', W / 2, H - 32);

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
