MG.register('bonepin', {
    title: 'Bone Set',
    hint: 'Drag each fragment onto its matching slot',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 400, H = 280;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'grab';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();

        const N = 2 + Math.floor(diff / 1.5); // 2..5
        const tol = Math.max(12, 30 - diff * 3);
        const slotY = H / 2 - 22;
        const pieces = [];
        for (let i = 0; i < N; i++) {
            const sx = 70 + (W - 140) * ((i + 0.5) / N);
            pieces.push({ sx, sy: slotY, x: 60 + Math.random() * (W - 120), y: H - 58 + Math.random() * 28, w: (W - 140) / N - 8, rot: api.rand(-0.3, 0.3), placed: false });
        }
        let drag = null, off = { x: 0, y: 0 }, placedN = 0, done = false;

        api.setDots(N);
        function rel(e) { const b = cvs.getBoundingClientRect(); return { x: (e.clientX - b.left) * (W / b.width), y: (e.clientY - b.top) * (H / b.height) }; }
        function at(cx, cy) { for (let i = pieces.length - 1; i >= 0; i--) { const p = pieces[i]; if (!p.placed && Math.abs(cx - p.x) < p.w / 2 + 6 && Math.abs(cy - p.y) < 16) return p; } return null; }

        cvs.addEventListener('mousedown', (e) => { const r = rel(e); const p = at(r.x, r.y); if (p) { drag = p; off.x = r.x - p.x; off.y = r.y - p.y; cvs.style.cursor = 'grabbing'; } });
        cvs.addEventListener('mousemove', (e) => { if (!drag) return; const r = rel(e); drag.x = r.x - off.x; drag.y = r.y - off.y; });
        function dropPiece() {
            if (!drag) return; const p = drag; drag = null; cvs.style.cursor = 'grab';
            if (Math.hypot(p.x - p.sx, p.y - p.sy) < tol) {
                p.placed = true; p.x = p.sx; p.y = p.sy; p.rot = 0; placedN++; api.sfx('latch');
                api.setDots(N, pieces.map(pp => pp.placed ? 'done' : ''));
                if (placedN >= N) { done = true; api.stopTimer(); api.setTag('SET'); setTimeout(() => api.succeed(), 300); }
            } else api.sfx('tick');
        }
        cvs.addEventListener('mouseup', dropPiece);
        cvs.addEventListener('mouseleave', dropPiece);

        api.setTag('ALIGNING');
        api.startTimer(Math.max(16, 30 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); setTimeout(() => api.fail(), 200); } });

        function frag(x, y, w, rot, col, alpha) {
            ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.translate(x, y); ctx.rotate(rot);
            const hw = w / 2;
            ctx.fillStyle = col; ctx.beginPath();
            ctx.moveTo(-hw, -8); ctx.lineTo(hw, -8); ctx.arc(hw, 0, 8, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-hw, 8); ctx.arc(-hw, 0, 8, Math.PI / 2, -Math.PI / 2); ctx.closePath(); ctx.fill();
            ctx.restore(); ctx.globalAlpha = 1;
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            pieces.forEach(p => { if (!p.placed) { frag(p.sx, p.sy, p.w, 0, 'rgba(255,255,255,0.5)', 0.22); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.strokeRect(p.sx - p.w / 2, p.sy - 12, p.w, 24); ctx.setLineDash([]); } });
            pieces.forEach(p => { const near = !p.placed && Math.hypot(p.x - p.sx, p.y - p.sy) < tol; frag(p.x, p.y, p.w, p.placed ? 0 : p.rot, (p.placed || near) ? suc : acc); });
            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
