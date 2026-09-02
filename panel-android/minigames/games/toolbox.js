MG.register('toolbox', {
    title: 'Tool Board',
    hint: 'Drag each tool onto its matching outline',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 440, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'grab';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();

        const TYPES = ['wrench', 'driver', 'hammer', 'pliers', 'spanner'];
        const N = 3 + Math.floor(diff / 1.5); // 3..5
        const types = TYPES.slice(0, N);
        const tol = 34;

        // shadow slots in a row on the board (shuffled type order)
        const slotTypes = types.slice();
        for (let i = slotTypes.length - 1; i > 0; i--) { const j = api.randInt(0, i); const t = slotTypes[i]; slotTypes[i] = slotTypes[j]; slotTypes[j] = t; }
        const slots = slotTypes.map((type, i) => ({ type, x: W * (i + 0.5) / N, y: 92, filled: false }));

        // loose tools in the tray (shuffled x positions so they don't line up)
        const homeXs = [];
        for (let i = 0; i < N; i++) homeXs.push(W * (i + 0.5) / N);
        for (let i = homeXs.length - 1; i > 0; i--) { const j = api.randInt(0, i); const t = homeXs[i]; homeXs[i] = homeXs[j]; homeXs[j] = t; }
        const tools = types.map((type, i) => ({ type, x: homeXs[i], y: H - 58, hx: homeXs[i], hy: H - 58, placed: false }));

        let drag = null, off = { x: 0, y: 0 }, placedN = 0, done = false;
        api.setDots(N);

        function rel(e) { const b = cvs.getBoundingClientRect(); return { x: (e.clientX - b.left) * (W / b.width), y: (e.clientY - b.top) * (H / b.height) }; }
        function at(x, y) { for (let i = tools.length - 1; i >= 0; i--) { const t = tools[i]; if (!t.placed && Math.abs(x - t.x) < 24 && Math.abs(y - t.y) < 22) return t; } return null; }
        cvs.addEventListener('mousedown', (e) => { const r = rel(e); const t = at(r.x, r.y); if (t) { drag = t; off.x = r.x - t.x; off.y = r.y - t.y; cvs.style.cursor = 'grabbing'; } });
        cvs.addEventListener('mousemove', (e) => { if (!drag) return; const r = rel(e); drag.x = r.x - off.x; drag.y = r.y - off.y; });
        function dropTool() {
            if (!drag) return; const t = drag; drag = null; cvs.style.cursor = 'grab';
            const s = slots.find(sl => !sl.filled && sl.type === t.type && Math.hypot(t.x - sl.x, t.y - sl.y) < tol);
            if (s) {
                s.filled = true; t.placed = true; t.x = s.x; t.y = s.y; placedN++; api.sfx('latch');
                api.setDots(N, tools.map(tt => tt.placed ? 'done' : ''));
                if (placedN >= N) { done = true; api.stopTimer(); api.setTag('STOCKED'); setTimeout(() => api.succeed(), 300); }
            } else { t.x = t.hx; t.y = t.hy; api.sfx('tick'); }
        }
        cvs.addEventListener('mouseup', dropTool);
        cvs.addEventListener('mouseleave', dropTool);

        api.setTag('ORGANIZE');
        api.startTimer(Math.max(18, 32 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); setTimeout(() => api.fail(), 200); } });

        function drawTool(type, x, y, col, alpha) {
            ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.translate(x, y);
            ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            if (type === 'wrench') { ctx.rotate(-0.6); ctx.beginPath(); ctx.moveTo(-2, 16); ctx.lineTo(2, -6); ctx.stroke(); ctx.beginPath(); ctx.arc(2, -11, 7, Math.PI * 0.2, Math.PI * 1.8); ctx.stroke(); }
            else if (type === 'driver') { ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 2); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 16); ctx.stroke(); }
            else if (type === 'hammer') { ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 18); ctx.stroke(); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-11, -9); ctx.lineTo(11, -9); ctx.stroke(); }
            else if (type === 'pliers') { ctx.beginPath(); ctx.moveTo(-6, 18); ctx.lineTo(2, -1); ctx.lineTo(-3, -16); ctx.stroke(); ctx.beginPath(); ctx.moveTo(6, 18); ctx.lineTo(-2, -1); ctx.lineTo(3, -16); ctx.stroke(); }
            else { ctx.beginPath(); ctx.arc(0, -10, 7, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -10, 3, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 18); ctx.stroke(); }
            ctx.restore(); ctx.globalAlpha = 1;
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.strokeRect(16, 42, W - 32, 104);
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
            ctx.fillText('SHADOW BOARD', 22, 56);
            ctx.fillText('TOOLS', 22, H - 78);

            slots.forEach(s => {
                if (!s.filled) {
                    drawTool(s.type, s.x, s.y, 'rgba(255,255,255,0.16)', 1);
                    ctx.setLineDash([4, 3]); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.arc(s.x, s.y, tol - 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
                }
            });
            tools.forEach(t => { if (t !== drag) drawTool(t.type, t.x, t.y, t.placed ? suc : acc); });
            if (drag) drawTool(drag.type, drag.x, drag.y, acc);

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
