MG.register('partsort', {
    title: 'Parts Sort',
    hint: 'Send each part to its bin · press 1 / 2 / 3 (or click a bin)',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 420, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const BINS = [
            { name: 'NUTS', col: '#ffd23f', icon: 'hex' },
            { name: 'BOLTS', col: acc, icon: 'bolt' },
            { name: 'GEARS', col: '#c06bff', icon: 'gear' }
        ];
        const need = 7 + diff * 2;
        const maxWrong = Math.max(2, 5 - diff);
        let sorted = 0, wrong = 0, done = false, part = 0, fb = 0, fbCol = '';

        function spawn() { part = api.randInt(0, BINS.length - 1); }
        spawn();
        api.setDots(maxWrong);

        function choose(b) {
            if (done || b < 0 || b >= BINS.length) return;
            if (b === part) {
                sorted++; api.sfx('latch'); fb = 8; fbCol = suc;
                api.setTag(sorted + '/' + need);
                if (sorted >= need) { done = true; api.stopTimer(); api.setTag('SORTED'); document.removeEventListener('keydown', key); setTimeout(() => api.succeed(), 300); return; }
                spawn();
            } else {
                wrong++; api.shake(); fb = 8; fbCol = dng;
                api.setDots(maxWrong, Array.from({ length: maxWrong }, (_, i) => i < wrong ? 'fail' : ''));
                if (wrong >= maxWrong) { done = true; api.stopTimer(); document.removeEventListener('keydown', key); setTimeout(() => api.fail(), 300); }
            }
        }
        function key(e) {
            const n = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code];
            if (n != null && !done) { e.preventDefault(); choose(n); }
        }
        document.addEventListener('keydown', key);
        cvs.addEventListener('click', (e) => {
            const b = cvs.getBoundingClientRect();
            const x = (e.clientX - b.left) * (W / b.width), y = (e.clientY - b.top) * (H / b.height);
            if (y > H - 96) choose(Math.floor(x / (W / 3)));
        });

        api.setTag('0/' + need);
        api.startTimer(Math.max(16, 30 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); document.removeEventListener('keydown', key); setTimeout(() => api.fail(), 200); } });

        function icon(shape, x, y, r, col) {
            ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
            if (shape === 'hex') {
                ctx.beginPath();
                for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
                ctx.closePath(); ctx.stroke();
                ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, Math.PI * 2); ctx.stroke();
            } else if (shape === 'bolt') {
                ctx.beginPath();
                for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; const px = x + Math.cos(a) * r * 0.7, py = y - r * 0.4 + Math.sin(a) * r * 0.7; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
                ctx.closePath(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + r); ctx.stroke();
            } else {
                ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.stroke();
                for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); }
                ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, Math.PI * 2); ctx.stroke();
            }
        }
        function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

        function draw() {
            if (fb > 0) fb--;
            ctx.clearRect(0, 0, W, H);

            ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
            ctx.fillText('SORTED ' + sorted + ' / ' + need, W / 2, 20);

            const px = W / 2, py = 88;
            ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(px - 42, 34); ctx.lineTo(px - 42, py + 18); ctx.moveTo(px + 42, 34); ctx.lineTo(px + 42, py + 18); ctx.stroke();

            const b = BINS[part];
            ctx.save();
            ctx.shadowColor = fb > 0 ? fbCol : b.col; ctx.shadowBlur = fb > 0 ? 20 : 12;
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.beginPath(); ctx.arc(px, py, 30, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            icon(b.icon, px, py, 20, fb > 0 ? fbCol : b.col);

            const bw = W / 3;
            BINS.forEach((bin, i) => {
                const bx = i * bw, byTop = H - 92;
                ctx.fillStyle = 'rgba(255,255,255,0.04)'; rr(bx + 8, byTop, bw - 16, 78, 8); ctx.fill();
                ctx.strokeStyle = bin.col; ctx.lineWidth = 2; rr(bx + 8, byTop, bw - 16, 78, 8); ctx.stroke();
                icon(bin.icon, bx + bw / 2, byTop + 28, 14, bin.col);
                ctx.fillStyle = bin.col; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
                ctx.fillText(bin.name, bx + bw / 2, byTop + 58);
                ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '10px monospace';
                ctx.fillText('[' + (i + 1) + ']', bx + bw / 2, byTop + 72);
            });

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
