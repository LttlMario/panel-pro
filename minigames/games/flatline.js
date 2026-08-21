MG.register('flatline', {
    title: 'Flatline',
    hint: 'SPACE inside the green zone',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const need = api.cfg.rounds || 3;
        const W = 480, H = 240;

        const wrap = document.createElement('div');
        wrap.style.cssText = `width:${W}px;`;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        wrap.appendChild(cvs);
        api.board.appendChild(wrap);
        const ctx = cvs.getContext('2d');

        let done = 0, fails = 0, pos = 0, dir = 1;
        const speed = 1.7 + diff * 0.95;
        const zoneW = Math.max(38, 120 - diff * 14);
        let zoneX = rnd();
        api.setDots(need);

        function rnd() { return 60 + Math.random() * (W - 120 - zoneW); }

        function attempt() {
            const center = zoneX + zoneW / 2;
            const hit = pos >= zoneX && pos <= zoneX + zoneW;
            if (hit) {
                done++;
                api.setDots(need, fillStates());
                if (done >= need) { api.stopTimer(); cleanupKeys(); setTimeout(() => api.succeed(), 250); return; }
                zoneX = rnd();
            } else {
                fails++;
                api.shake();
                api.setDots(need, fillStates(true));
                if (fails >= 2) { api.stopTimer(); cleanupKeys(); setTimeout(() => api.fail(), 250); return; }
                zoneX = rnd();
            }
        }
        function fillStates(markFail) {
            const s = [];
            for (let i = 0; i < need; i++) s[i] = i < done ? 'done' : '';
            return s;
        }

        function key(e) {
            if (e.code === 'Space') { e.preventDefault(); attempt(); }
        }
        document.addEventListener('keydown', key);
        function cleanupKeys() { document.removeEventListener('keydown', key); }

        api.startTimer(Math.max(8, 20 - diff * 1.6), () => { cleanupKeys(); api.fail(); });

        function ecg(x) {
            const baseline = H * 0.6;
            const t = (x / W) * Math.PI * 8;
            let y = Math.sin(t) * 3;
            const beat = (x % 120);
            if (beat > 40 && beat < 60) y -= Math.sin((beat - 40) / 20 * Math.PI) * 55;
            return baseline + y;
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(57,217,138,0.5)'; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let x = 0; x <= W; x += 2) { const y = ecg(x); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
            ctx.stroke();

            ctx.fillStyle = 'rgba(57,217,138,0.16)';
            ctx.strokeStyle = '#39d98a'; ctx.lineWidth = 2;
            ctx.fillRect(zoneX, 30, zoneW, H - 60);
            ctx.strokeRect(zoneX, 30, zoneW, H - 60);

            pos += dir * speed;
            if (pos > W - 40) { pos = W - 40; dir = -1; }
            if (pos < 40) { pos = 40; dir = 1; }
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
            ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.moveTo(pos, 24); ctx.lineTo(pos, H - 24); ctx.stroke();
            ctx.shadowBlur = 0;

            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); cleanupKeys(); } };
    }
});
