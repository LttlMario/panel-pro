MG.register('thermite', {
    title: 'Thermite',
    hint: 'Memorize the lit cells · then light the same ones',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const N = 4 + Math.floor(diff / 2);
        const litCount = 3 + diff;
        const cell = Math.min(64, Math.floor(300 / N));
        const W = cell * N, H = cell * N;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const target = new Set();
        while (target.size < Math.min(litCount, N * N)) target.add(api.randInt(0, N * N - 1));
        const picked = new Set();
        let phase = 'show', ended = false, wrong = 0;
        const maxWrong = Math.max(1, 4 - diff);
        api.setDots(target.size);

        const showMs = Math.max(1200, 2600 - diff * 250);
        api.setTag('MEMORIZE');
        setTimeout(() => { if (!ended) { phase = 'input'; api.setTag('REPRODUCE'); api.startTimer(Math.max(8, 16 - diff), () => finish(false)); } }, showMs);

        function rel(e) {
            const b = cvs.getBoundingClientRect();
            const x = (e.clientX - b.left) * (cvs.width / b.width);
            const y = (e.clientY - b.top) * (cvs.height / b.height);
            return Math.floor(y / cell) * N + Math.floor(x / cell);
        }
        cvs.addEventListener('click', (e) => {
            if (phase !== 'input' || ended) return;
            const idx = rel(e);
            if (idx < 0 || idx >= N * N || picked.has(idx)) return;
            if (target.has(idx)) {
                picked.add(idx); api.sfx('zap');
                api.setDots(target.size, Array.from({ length: target.size }, (_, i) => i < picked.size ? 'done' : ''));
                if (picked.size >= target.size) finish(true);
            } else {
                wrong++; api.shake();
                if (wrong >= maxWrong) finish(false);
            }
        });
        function finish(ok) { if (ended) return; ended = true; api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 300); }

        function draw() {
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            ctx.clearRect(0, 0, W, H);
            for (let i = 0; i < N * N; i++) {
                const r = Math.floor(i / N), c = i % N;
                const x = c * cell, y = r * cell;
                let fill = 'rgba(255,255,255,0.05)';
                if (phase === 'show' && target.has(i)) fill = 'rgba(255,138,0,0.7)';
                if (picked.has(i)) fill = suc;
                ctx.fillStyle = fill;
                if ((phase === 'show' && target.has(i)) || picked.has(i)) { ctx.shadowColor = picked.has(i) ? suc : '#ff8a00'; ctx.shadowBlur = 16; }
                ctx.fillRect(x + 3, y + 3, cell - 6, cell - 6);
                ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(255,255,255,0.08)';
                ctx.strokeRect(x + 3, y + 3, cell - 6, cell - 6);
            }
            for (let i = 0; i < maxWrong; i++) {
                ctx.fillStyle = i < wrong ? (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim() : 'rgba(255,255,255,0.15)';
                ctx.beginPath(); ctx.arc(10 + i * 14, H - 8, 4, 0, Math.PI * 2); ctx.fill();
            }
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
