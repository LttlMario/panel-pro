MG.register('slidepuzzle', {
    title: 'Slide Puzzle',
    hint: 'Click a tile next to the gap to slide it · order 1..N to finish',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 300, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();

        const n = diff >= 5 ? 4 : 3;
        const cell = Math.floor(250 / n), gap = 6;
        const bx = (W - n * cell) / 2, by = (H - n * cell) / 2;
        const total = n * n;
        let board = [], blank = total - 1, done = false, moves = 0;

        function solved() { for (let i = 0; i < total - 1; i++) if (board[i] !== i + 1) return false; return board[total - 1] === 0; }
        function neighbours(i) { const r = Math.floor(i / n), c = i % n, out = []; if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n); if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1); return out; }
        function slide(i) { board[blank] = board[i]; board[i] = 0; blank = i; }

        for (let i = 0; i < total; i++) board[i] = (i + 1) % total; // [1..n*n-1, 0]
        const shuffle = 40 + diff * 25;
        let prev = -1;
        for (let k = 0; k < shuffle; k++) { const ns = neighbours(blank).filter(x => x !== prev); const pick = ns[api.randInt(0, ns.length - 1)]; prev = blank; slide(pick); }
        if (solved()) { const ns = neighbours(blank); slide(ns[0]); }

        cvs.addEventListener('click', (e) => {
            if (done) return;
            const b = cvs.getBoundingClientRect();
            const x = (e.clientX - b.left) * (W / b.width), y = (e.clientY - b.top) * (H / b.height);
            const c = Math.floor((x - bx) / cell), r = Math.floor((y - by) / cell);
            if (r < 0 || c < 0 || r >= n || c >= n) return;
            const i = r * n + c;
            if (neighbours(i).includes(blank)) {
                slide(i); moves++; api.sfx('tick');
                if (solved()) { done = true; api.stopTimer(); api.setTag('SOLVED'); setTimeout(() => api.succeed(), 300); }
            }
        });

        api.startTimer(Math.max(35, 75 - diff * 5), () => { if (!done) { done = true; api.stopTimer(); setTimeout(() => api.fail(), 200); } });

        function draw() {
            api.setTag(done ? 'SOLVED' : ('MOVES ' + moves));
            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.strokeRect(bx - 3, by - 3, n * cell + 6, n * cell + 6);
            for (let i = 0; i < total; i++) {
                const v = board[i]; if (v === 0) continue;
                const r = Math.floor(i / n), c = i % n, x = bx + c * cell, y = by + r * cell;
                const right = v === i + 1;
                ctx.fillStyle = right ? 'rgba(57,217,138,0.18)' : 'rgba(0,224,184,0.12)';
                ctx.fillRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap);
                ctx.strokeStyle = right ? suc : acc; ctx.lineWidth = 2; ctx.strokeRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap);
                ctx.fillStyle = right ? suc : acc; ctx.font = 'bold ' + Math.floor(cell * 0.4) + 'px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(v, x + cell / 2, y + cell / 2);
            }
            ctx.textBaseline = 'alphabetic';
            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
