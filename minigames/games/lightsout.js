MG.register('lightsout', {
    title: 'Lights Out',
    hint: 'Turn every light off · each click flips that cell and its neighbours',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 320, H = 320;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();

        const n = Math.min(5, 3 + Math.floor(diff / 2));
        const cell = Math.floor(250 / n), gap = 6;
        const bx = (W - n * cell) / 2, by = (H - n * cell) / 2;
        const grid = Array.from({ length: n }, () => Array(n).fill(false));

        function toggle(r, c) { if (r >= 0 && c >= 0 && r < n && c < n) grid[r][c] = !grid[r][c]; }
        function flip(r, c) { toggle(r, c); toggle(r - 1, c); toggle(r + 1, c); toggle(r, c - 1); toggle(r, c + 1); }
        function lit() { let k = 0; for (const row of grid) for (const v of row) if (v) k++; return k; }

        const scramble = 2 + diff * 2;
        for (let i = 0; i < scramble; i++) flip(api.randInt(0, n - 1), api.randInt(0, n - 1));
        if (lit() === 0) flip(api.randInt(0, n - 1), api.randInt(0, n - 1));

        let done = false, used = 0;
        cvs.addEventListener('click', (e) => {
            if (done) return;
            const b = cvs.getBoundingClientRect();
            const x = (e.clientX - b.left) * (W / b.width), y = (e.clientY - b.top) * (H / b.height);
            const c = Math.floor((x - bx) / cell), r = Math.floor((y - by) / cell);
            if (r < 0 || c < 0 || r >= n || c >= n) return;
            flip(r, c); used++; api.sfx('tick');
            if (lit() === 0) { done = true; api.stopTimer(); api.setTag('CLEARED'); setTimeout(() => api.succeed(), 300); }
        });

        api.startTimer(Math.max(28, 52 - diff * 3), () => { if (!done) { done = true; api.stopTimer(); setTimeout(() => api.fail(), 200); } });

        function draw() {
            api.setTag(done ? 'CLEARED' : ('LIT ' + lit()));
            ctx.clearRect(0, 0, W, H);
            for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
                const x = bx + c * cell, y = by + r * cell, on = grid[r][c];
                ctx.fillStyle = on ? acc : 'rgba(255,255,255,0.05)';
                if (on) { ctx.shadowColor = acc; ctx.shadowBlur = 16; }
                ctx.fillRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap);
                ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
                ctx.strokeRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap);
            }
            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
