MG.register('eaglevision', {
    title: 'Eagle Vision',
    hint: 'Memorize the mark · then click every match',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 480, H = 300;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'crosshair';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const SHAPES = ['triangle', 'square', 'diamond', 'hex'];
        const COLORS = ['#ff4d6d', '#ffd23f', '#00e0b8', '#5b8cff', '#c06bff'];
        const sig = { shape: SHAPES[api.randInt(0, SHAPES.length - 1)], color: COLORS[api.randInt(0, COLORS.length - 1)] };

        const figCount = 8 + diff * 3;
        const targetCount = 2 + Math.floor(diff / 1.5);
        const figs = [];
        for (let i = 0; i < targetCount; i++) figs.push({ ...spot(), shape: sig.shape, color: sig.color, target: true, found: false });
        for (let i = 0; i < figCount - targetCount; i++) {
            let sh = sig.shape, cl = sig.color;
            if (Math.random() < 0.5) sh = SHAPES[(SHAPES.indexOf(sig.shape) + api.randInt(1, 3)) % SHAPES.length];
            else cl = COLORS[(COLORS.indexOf(sig.color) + api.randInt(1, 4)) % COLORS.length];
            figs.push({ ...spot(), shape: sh, color: cl, target: false, found: false });
        }
        function spot() {
            return { x: api.rand(40, W - 40), y: api.rand(50, H - 40) };
        }

        let phase = 'show', found = 0, mouse = { x: -99, y: -99 }, ended = false;
        api.setDots(targetCount);
        api.setTag('SIGNATURE');

        setTimeout(() => { phase = 'hunt'; api.setTag('HUNT'); api.startTimer(Math.max(8, 16 - diff), () => finish()); }, Math.max(1100, 2000 - diff * 180));

        function rel(e) {
            const b = cvs.getBoundingClientRect();
            return { x: (e.clientX - b.left) * (cvs.width / b.width),
                     y: (e.clientY - b.top) * (cvs.height / b.height) };
        }
        cvs.addEventListener('mousemove', (e) => { mouse = rel(e); });
        cvs.addEventListener('click', (e) => {
            if (phase !== 'hunt' || ended) return;
            const p = rel(e);
            const f = figs.find((g) => !g.found && Math.hypot(g.x - p.x, g.y - p.y) < 18);
            if (!f) return;
            if (f.target) {
                f.found = true; found++;
                api.setDots(targetCount, Array.from({ length: targetCount }, (_, i) => i < found ? 'done' : ''));
                if (found >= targetCount) finish(true);
            } else {
                api.shake(); finish(false);
            }
        });
        function finish(ok) {
            if (ended) return; ended = true;
            api.stopTimer();
            const pass = ok === true || found >= targetCount;
            setTimeout(() => pass ? api.succeed() : api.fail(), 300);
        }

        function shape(x, y, type, color, lit, size) {
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.shadowColor = color; ctx.shadowBlur = lit ? 16 : 0;
            ctx.globalAlpha = lit ? 1 : 0.5;
            ctx.beginPath();
            const s = size || 12;
            if (type === 'triangle') { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s); ctx.lineTo(x - s, y + s); }
            else if (type === 'square') { ctx.rect(x - s, y - s, s * 2, s * 2); }
            else if (type === 'diamond') { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); }
            else { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } }
            ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            if (phase === 'show') {
                ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '13px monospace'; ctx.textAlign = 'center';
                ctx.fillText('TARGET SIGNATURE', W / 2, H / 2 - 50);
                shape(W / 2, H / 2 + 4, sig.shape, sig.color, true, 22);
            } else {
                const grad = ctx.createRadialGradient(mouse.x, mouse.y, 10, mouse.x, mouse.y, 70);
                grad.addColorStop(0, 'rgba(255,255,255,0.10)'); grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

                figs.forEach((f) => {
                    if (f.found) { shape(f.x, f.y, f.shape, '#39d98a', true); return; }
                    const near = Math.hypot(f.x - mouse.x, f.y - mouse.y) < 70;
                    shape(f.x, f.y, f.shape, f.color, near);
                });
            }
            if (!ended) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
