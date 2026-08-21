MG.register('daemonrun', {
    title: 'Daemon Run',
    hint: 'WASD / arrows · grab all data · dodge the trace',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const COLS = 11, ROWS = 9, S = 30;
        const W = COLS * S, H = ROWS * S;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const maze = [];
        for (let r = 0; r < ROWS; r++) {
            maze[r] = [];
            for (let c = 0; c < COLS; c++) {
                let wall = (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1);
                if (!wall && r % 2 === 0 && c % 2 === 0) wall = true;
                maze[r][c] = wall ? 1 : 0;
            }
        }
        const open = [];
        for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++)
            if (maze[r][c] === 0) open.push({ r, c });

        function popOpen() { return open.splice(api.randInt(0, open.length - 1), 1)[0]; }

        const player = popOpen();
        const fragCount = 3 + diff;
        const frags = [];
        for (let i = 0; i < fragCount && open.length; i++) frags.push(popOpen());
        const trace = open.length ? popOpen() : { r: 1, c: 1 };

        let pPix = { x: player.c * S, y: player.r * S };
        let tPix = { x: trace.c * S, y: trace.r * S };
        const traceSpeed = 0.9 + diff * 0.35;
        let moveDir = null, caught = false, won = false;

        const keymap = {
            ArrowUp: [0, -1], KeyW: [0, -1],
            ArrowDown: [0, 1], KeyS: [0, 1],
            ArrowLeft: [-1, 0], KeyA: [-1, 0],
            ArrowRight: [1, 0], KeyD: [1, 0]
        };
        function key(e) {
            const m = keymap[e.code]; if (!m) return; e.preventDefault();
            const nc = player.c + m[0], nr = player.r + m[1];
            if (maze[nr] && maze[nr][nc] === 0) { player.c = nc; player.r = nr; }
        }
        document.addEventListener('keydown', key);

        api.setDots(fragCount);
        api.startTimer(Math.max(14, 30 - diff * 2), () => finish(false));

        function finish(ok) {
            if (caught || won) return;
            won = ok; caught = !ok;
            document.removeEventListener('keydown', key);
            api.stopTimer();
            setTimeout(() => ok ? api.succeed() : api.fail(), 250);
        }

        let traceTick = 0;
        function moveTrace() {
            const tr = Math.round(tPix.y / S), tc = Math.round(tPix.x / S);
            const opts = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dc, dr]) =>
                maze[tr + dr] && maze[tr + dr][tc + dc] === 0);
            if (!opts.length) return;
            opts.sort((a, b) => {
                const da = Math.hypot((tc + a[0]) - player.c, (tr + a[1]) - player.r);
                const db = Math.hypot((tc + b[0]) - player.c, (tr + b[1]) - player.r);
                return da - db;
            });
            const pick = Math.random() < 0.78 ? opts[0] : opts[api.randInt(0, opts.length - 1)];
            trace.c = tc + pick[0]; trace.r = tr + pick[1];
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
                if (maze[r][c] === 1) {
                    ctx.fillStyle = 'rgba(255,255,255,0.05)';
                    ctx.fillRect(c * S, r * S, S, S);
                    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
                    ctx.strokeRect(c * S, r * S, S, S);
                }
            }
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const dng = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();

            frags.forEach((f) => {
                if (f.got) return;
                ctx.fillStyle = suc; ctx.shadowColor = suc; ctx.shadowBlur = 8;
                ctx.beginPath(); ctx.arc(f.c * S + S / 2, f.r * S + S / 2, 5, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
            });

            pPix.x += (player.c * S - pPix.x) * 0.35;
            pPix.y += (player.r * S - pPix.y) * 0.35;
            ctx.fillStyle = acc; ctx.shadowColor = acc; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(pPix.x + S / 2, pPix.y + S / 2, S / 2 - 5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            traceTick += traceSpeed;
            if (traceTick >= 10) { traceTick = 0; moveTrace(); }
            tPix.x += (trace.c * S - tPix.x) * 0.18;
            tPix.y += (trace.r * S - tPix.y) * 0.18;
            ctx.fillStyle = dng; ctx.shadowColor = dng; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(tPix.x + S / 2, tPix.y + S / 2, S / 2 - 4, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            let got = 0;
            frags.forEach((f) => {
                if (!f.got && f.r === player.r && f.c === player.c) f.got = true;
                if (f.got) got++;
            });
            api.setDots(fragCount, frags.map((f) => f.got ? 'done' : ''));

            if (Math.hypot(tPix.x - pPix.x, tPix.y - pPix.y) < S * 0.6) { finish(false); return; }
            if (got >= fragCount) { finish(true); return; }

            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
