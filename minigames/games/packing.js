MG.register('packing', {
    title: 'Crate Packing',
    hint: 'Drag every part into the crate so they all fit',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 440, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'grab';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();

        const cols = 5, rows = 3, cell = 34;
        const gx = (W - cols * cell) / 2, gy = 26;
        const occ = Array.from({ length: rows }, () => Array(cols).fill(-1));
        const maxPieces = 4 + Math.floor(diff / 2);

        // guillotine partition -> pieces (max 2x2) that exactly tile the grid (always solvable)
        const rects = [];
        (function part(x, y, w, h) {
            if (w > 2 || h > 2) {
                let vertical = (w > 2 && h <= 2) ? true : (h > 2 && w <= 2) ? false : (Math.random() < 0.5);
                if (vertical && w < 2) vertical = false;
                if (!vertical && h < 2) vertical = true;
                if (vertical) { const cut = 1 + Math.floor(Math.random() * (w - 1)); part(x, y, cut, h); part(x + cut, y, w - cut, h); }
                else { const cut = 1 + Math.floor(Math.random() * (h - 1)); part(x, y, w, cut); part(x, y + cut, w, h - cut); }
                return;
            }
            const canV = w >= 2, canH = h >= 2;
            if ((canV || canH) && rects.length < maxPieces - 1 && Math.random() < 0.4) {
                const vertical = canV && (!canH || Math.random() < 0.5);
                if (vertical) { part(x, y, 1, h); part(x + 1, y, w - 1, h); }
                else { part(x, y, w, 1); part(x, y + 1, w, h - 1); }
                return;
            }
            rects.push({ x, y, w, h });
        })(0, 0, cols, rows);

        const COLORS = ['#00e0b8', '#ffd23f', '#c06bff', '#39d98a', '#ff8a3d', '#4ad9ff', '#ff6b9d'];
        const pieces = rects.map((r, i) => ({ w: r.w, h: r.h, col: COLORS[i % COLORS.length], placed: false, gxc: -1, gyc: -1, px: 0, py: 0, hx: 0, hy: 0 }));

        // tidy tray layout below the crate (no overlap)
        const trayTop = gy + rows * cell + 24;
        let txp = 16, typ = trayTop, rh = 0;
        pieces.forEach(p => {
            const w = p.w * cell, h = p.h * cell;
            if (txp + w > W - 16) { txp = 16; typ += rh + 10; rh = 0; }
            p.px = p.hx = txp; p.py = p.hy = typ; txp += w + 12; rh = Math.max(rh, h);
        });

        let drag = null, off = { x: 0, y: 0 }, placedN = 0, done = false;
        api.setDots(pieces.length);
        function updateDots() { api.setDots(pieces.length, pieces.map(p => p.placed ? 'done' : '')); }

        function rel(e) { const b = cvs.getBoundingClientRect(); return { x: (e.clientX - b.left) * (W / b.width), y: (e.clientY - b.top) * (H / b.height) }; }
        function at(x, y) { for (let i = pieces.length - 1; i >= 0; i--) { const p = pieces[i]; if (x >= p.px && x <= p.px + p.w * cell && y >= p.py && y <= p.py + p.h * cell) return p; } return null; }
        function free(p) { if (p.gxc >= 0) { for (let r = 0; r < p.h; r++) for (let c = 0; c < p.w; c++) occ[p.gyc + r][p.gxc + c] = -1; p.gxc = p.gyc = -1; if (p.placed) { p.placed = false; placedN--; } } }
        cvs.addEventListener('mousedown', (e) => { const r = rel(e); const p = at(r.x, r.y); if (p) { drag = p; off.x = r.x - p.px; off.y = r.y - p.py; free(p); updateDots(); cvs.style.cursor = 'grabbing'; } });
        cvs.addEventListener('mousemove', (e) => { if (!drag) return; const r = rel(e); drag.px = r.x - off.x; drag.py = r.y - off.y; });
        function fitsAt(p, cgx, cgy) {
            if (cgx < 0 || cgy < 0 || cgx + p.w > cols || cgy + p.h > rows) return false;
            for (let r = 0; r < p.h; r++) for (let c = 0; c < p.w; c++) if (occ[cgy + r][cgx + c] !== -1) return false;
            return true;
        }
        function drop() {
            if (!drag) return; const p = drag; drag = null; cvs.style.cursor = 'grab';
            const cgx = Math.round((p.px - gx) / cell), cgy = Math.round((p.py - gy) / cell);
            if (fitsAt(p, cgx, cgy)) {
                const idx = pieces.indexOf(p);
                for (let r = 0; r < p.h; r++) for (let c = 0; c < p.w; c++) occ[cgy + r][cgx + c] = idx;
                p.gxc = cgx; p.gyc = cgy; p.px = gx + cgx * cell; p.py = gy + cgy * cell; p.placed = true; placedN++; api.sfx('latch'); updateDots();
                if (placedN >= pieces.length) { done = true; api.stopTimer(); api.setTag('PACKED'); setTimeout(() => api.succeed(), 300); }
            } else { p.px = p.hx; p.py = p.hy; api.sfx('tick'); }
        }
        cvs.addEventListener('mouseup', drop);
        cvs.addEventListener('mouseleave', drop);

        api.setTag('PACKING');
        api.startTimer(Math.max(22, 40 - diff * 3), () => { if (!done) { done = true; api.stopTimer(); setTimeout(() => api.fail(), 200); } });

        function drawPiece(p, dx, dy, alpha) {
            ctx.globalAlpha = alpha; ctx.fillStyle = p.col; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
            for (let r = 0; r < p.h; r++) for (let c = 0; c < p.w; c++) { ctx.fillRect(dx + c * cell + 1, dy + r * cell + 1, cell - 2, cell - 2); ctx.strokeRect(dx + c * cell + 1, dy + r * cell + 1, cell - 2, cell - 2); }
            ctx.globalAlpha = 1;
        }
        function draw() {
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '10px monospace'; ctx.textAlign = 'left'; ctx.fillText('CRATE', gx, gy - 8);
            ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.strokeRect(gx - 3, gy - 3, cols * cell + 6, rows * cell + 6);
            ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
            for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(gx + c * cell, gy); ctx.lineTo(gx + c * cell, gy + rows * cell); ctx.stroke(); }
            for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(gx, gy + r * cell); ctx.lineTo(gx + cols * cell, gy + r * cell); ctx.stroke(); }
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillText('PARTS', 16, trayTop - 8);

            pieces.forEach(p => { if (p !== drag) drawPiece(p, p.px, p.py, p.placed ? 1 : 0.9); });
            if (drag) {
                const cgx = Math.round((drag.px - gx) / cell), cgy = Math.round((drag.py - gy) / cell);
                if (fitsAt(drag, cgx, cgy)) { ctx.fillStyle = 'rgba(57,217,138,0.2)'; ctx.fillRect(gx + cgx * cell, gy + cgy * cell, drag.w * cell, drag.h * cell); }
                drawPiece(drag, drag.px, drag.py, 0.95);
            }
            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
