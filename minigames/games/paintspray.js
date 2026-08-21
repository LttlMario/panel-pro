MG.register('paintspray', {
    title: 'Paint Booth',
    hint: 'Hold mouse to spray · cover the panel evenly · don’t over-soak',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 420, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'crosshair';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();
        const accRGB = (() => { const h = acc.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; })();

        const cols = 14, rows = 10;
        const px = 40, py = 22, pw = W - 80, ph = H - 78;
        const cw = pw / cols, ch = ph / rows;
        const cells = new Float32Array(cols * rows);
        let spraying = false, mx = 0, my = 0, has = false, drips = 0, done = false;
        const need = Math.floor(cols * rows * 0.88);
        const dripLimit = Math.max(6, 16 - diff * 2);
        const brush = 2.0;
        const flow = 0.05 + diff * 0.006;

        cvs.addEventListener('mousemove', (e) => { const b = cvs.getBoundingClientRect(); mx = (e.clientX - b.left) * (W / b.width); my = (e.clientY - b.top) * (H / b.height); has = true; });
        cvs.addEventListener('mousedown', () => spraying = true);
        cvs.addEventListener('mouseup', () => spraying = false);
        cvs.addEventListener('mouseleave', () => spraying = false);

        api.setTag('PRIMING');
        api.startTimer(Math.max(18, 30 - diff * 2), () => fail('TIME'));
        function fail(m) { if (done) return; done = true; api.setTag(m || 'FAIL'); api.shake(); api.stopTimer(); setTimeout(() => api.fail(), 250); }
        function win() { if (done) return; done = true; api.setTag('GLOSS'); api.stopTimer(); setTimeout(() => api.succeed(), 300); }

        function bar(x, y, w, h, v, col, label) {
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, w, h);
            ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.min(1, v), h);
            ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillText(label, x, y - 3);
        }

        function draw() {
            if (!done && spraying && has) {
                const ccx = (mx - px) / cw, ccy = (my - py) / ch;
                for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                    const d = Math.hypot(c + 0.5 - ccx, r + 0.5 - ccy);
                    if (d < brush) { const idx = r * cols + c; const before = cells[idx]; cells[idx] += flow * (1 - d / brush); if (cells[idx] > 1.25 && before <= 1.25) drips++; }
                }
            }

            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.strokeRect(px - 4, py - 4, pw + 8, ph + 8);

            let covered = 0;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const v = cells[r * cols + c];
                if (v >= 0.6) covered++;
                if (v > 1.25) ctx.fillStyle = dng;
                else if (v >= 0.6) ctx.fillStyle = `rgba(${accRGB[0]},${accRGB[1]},${accRGB[2]},${0.25 + Math.min(1, v) * 0.6})`;
                else ctx.fillStyle = `rgba(255,255,255,${0.03 + v * 0.2})`;
                ctx.fillRect(px + c * cw + 0.5, py + r * ch + 0.5, cw - 1, ch - 1);
            }

            if (has) { ctx.strokeStyle = spraying ? acc : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, brush * cw, 0, Math.PI * 2); ctx.stroke(); }

            const covPct = covered / (cols * rows);
            bar(px, H - 34, pw, 8, covPct, suc, 'COVERAGE ' + Math.round(covPct * 100) + '%');
            bar(px, H - 18, pw, 6, drips / dripLimit, dng, 'DRIPS ' + drips + '/' + dripLimit);

            if (!done) {
                if (drips >= dripLimit) { fail('TOO MANY DRIPS'); return; }
                if (covered >= need) { win(); return; }
                loop = requestAnimationFrame(draw);
            }
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
