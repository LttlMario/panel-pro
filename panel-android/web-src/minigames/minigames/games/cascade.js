MG.register('cascade', {
    title: 'Cascade',
    hint: 'Watch the sequence · repeat it back',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const nodeCount = 4 + Math.floor(diff / 1.5);
        const roundsToWin = 3 + diff;
        const flashMs = Math.max(280, 620 - diff * 70);

        const W = 320, H = 320;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const nodes = [];
        const R = 110, cx = W / 2, cy = H / 2;
        const colors = ['#ff4d6d', '#ffd23f', '#00e0b8', '#5b8cff', '#c06bff', '#ff8a00', '#39d98a'];
        for (let i = 0; i < nodeCount; i++) {
            const a = (i / nodeCount) * Math.PI * 2 - Math.PI / 2;
            nodes.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, c: colors[i % colors.length], lit: 0 });
        }

        let seq = [], inputIdx = 0, phase = 'show', round = 0, busy = false;
        api.setDots(roundsToWin);
        api.setTag('WATCH');

        function nextRound() {
            round++;
            if (round > roundsToWin) { finish(true); return; }
            seq.push(api.randInt(0, nodeCount - 1));
            inputIdx = 0; phase = 'show'; busy = true;
            playSequence();
        }
        function playSequence() {
            let i = 0;
            api.setTag('WATCH ' + round);
            const iv = setInterval(() => {
                if (i >= seq.length) {
                    clearInterval(iv); phase = 'input'; busy = false;
                    api.setTag('REPEAT ' + round);
                    return;
                }
                nodes[seq[i]].lit = 12; i++;
                api.sfx('beep');
            }, flashMs);
        }

        cvs.addEventListener('click', (e) => {
            if (phase !== 'input' || busy) return;
            const b = cvs.getBoundingClientRect();
            const x = (e.clientX - b.left) * (cvs.width / b.width);
            const y = (e.clientY - b.top) * (cvs.height / b.height);
            const idx = nodes.findIndex((n) => Math.hypot(n.x - x, n.y - y) < 26);
            if (idx < 0) return;
            nodes[idx].lit = 12;
            if (idx === seq[inputIdx]) {
                inputIdx++;
                if (inputIdx >= seq.length) {
                    const st = []; for (let i = 0; i < roundsToWin; i++) st[i] = i < round ? 'done' : '';
                    api.setDots(roundsToWin, st);
                    phase = 'wait'; busy = true;
                    setTimeout(nextRound, 500);
                }
            } else { api.shake(); finish(false); }
        });

        let ended = false;
        function finish(ok) {
            if (ended) return; ended = true;
            api.stopTimer();
            setTimeout(() => ok ? api.succeed() : api.fail(), 350);
        }

        api.startTimer(Math.max(20, 50 - diff * 4), () => { if (!ended) finish(false); });

        function draw() {
            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
            nodes.forEach((n) => {
                const glow = n.lit > 0;
                ctx.fillStyle = glow ? n.c : 'rgba(255,255,255,0.06)';
                ctx.strokeStyle = n.c; ctx.lineWidth = 2;
                ctx.shadowColor = n.c; ctx.shadowBlur = glow ? 22 : 4;
                ctx.beginPath(); ctx.arc(n.x, n.y, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.shadowBlur = 0;
                if (n.lit > 0) n.lit--;
            });
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        nextRound();
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
