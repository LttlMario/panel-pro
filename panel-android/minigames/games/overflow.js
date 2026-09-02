MG.register('overflow', {
    title: 'Overflow',
    hint: 'Click tiles to rotate · connect source → drain',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const N = 4 + Math.floor(diff / 2);
        const cell = Math.min(70, Math.floor(360 / N));
        const W = cell * N, H = cell * N;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const SHAPES = [
            [0, 2],
            [1, 3],
            [0, 1],
            [1, 2],
            [2, 3],
            [3, 0]
        ];
        const grid = [];
        for (let r = 0; r < N; r++) {
            grid[r] = [];
            for (let c = 0; c < N; c++) {
                grid[r][c] = { dirs: SHAPES[api.randInt(0, SHAPES.length - 1)].slice(), fill: 0 };
            }
        }
        const sr = Math.floor(N / 2), dr = Math.floor(N / 2);
        const source = { r: sr, c: 0, from: 3 };
        const drain  = { r: dr, c: N - 1, to: 1 };

        const opp = (d) => (d + 2) % 4;
        const step = [[ -1, 0], [0, 1], [1, 0], [0, -1]];

        function connected() {
            let cur = { r: source.r, c: source.c, enter: 3 };
            const seen = new Set();
            while (cur) {
                const key = cur.r + ',' + cur.c;
                if (seen.has(key)) return false;
                seen.add(key);
                const tile = grid[cur.r][cur.c];
                if (!tile.dirs.includes(cur.enter)) return false; // doesn't accept inflow
                const out = tile.dirs.find((d) => d !== cur.enter);
                if (out === undefined) return false;
                if (cur.r === drain.r && cur.c === drain.c && out === drain.to) return true;
                const ns = step[out];
                const nr = cur.r + ns[0], nc = cur.c + ns[1];
                if (nr < 0 || nr >= N || nc < 0 || nc >= N) return false;
                cur = { r: nr, c: nc, enter: opp(out) };
            }
            return false;
        }

        let locked = false;
        cvs.addEventListener('click', (e) => {
            if (locked) return;
            const b = cvs.getBoundingClientRect();
            const sx = cvs.width / b.width, sy = cvs.height / b.height;
            const x = (e.clientX - b.left) * sx, y = (e.clientY - b.top) * sy;
            const c = Math.floor(x / cell), r = Math.floor(y / cell);
            if (r < 0 || r >= N || c < 0 || c >= N) return;
            grid[r][c].dirs = grid[r][c].dirs.map((d) => (d + 1) % 4);
            if (connected()) {
                locked = true;
                api.stopTimer();
                api.setTag('SEALED');
                setTimeout(() => api.succeed(), 350);
            }
        });

        api.setTag('LEAKING');
        api.startTimer(Math.max(14, 34 - diff * 3), () => { if (!locked) api.fail(); });

        function drawTile(r, c) {
            const x = c * cell, y = r * cell, m = cell / 2;
            const cx = x + m, cy = y + m;
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.strokeRect(x, y, cell, cell);
            const t = grid[r][c];
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            ctx.strokeStyle = acc; ctx.lineWidth = 6; ctx.lineCap = 'round';
            t.dirs.forEach((d) => {
                ctx.beginPath(); ctx.moveTo(cx, cy);
                if (d === 0) ctx.lineTo(cx, y);
                if (d === 1) ctx.lineTo(x + cell, cy);
                if (d === 2) ctx.lineTo(cx, y + cell);
                if (d === 3) ctx.lineTo(x, cy);
                ctx.stroke();
            });
            ctx.fillStyle = acc;
            ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) drawTile(r, c);
            const sc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            ctx.fillStyle = sc;
            ctx.fillRect(0, source.r * cell + cell / 2 - 4, 8, 8);
            ctx.fillRect(W - 8, drain.r * cell + cell / 2 - 4, 8, 8);
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
