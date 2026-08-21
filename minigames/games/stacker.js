MG.register('stacker', {
    title: 'Stacker',
    hint: 'SPACE / click to drop the block on the stack',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const goal = 4 + diff;
        const W = 300, H = 320, blockH = 22;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        let speed = 1.5 + diff * 0.6;
        let stack = [{ x: W / 2 - 70, w: 140 }];
        let cur = { x: 0, w: 140, dir: 1 };
        let placed = 1, ended = false;
        api.setDots(goal);

        function topY(level) { return H - 30 - level * blockH; }

        function drop() {
            if (ended) return;
            const below = stack[stack.length - 1];
            const left = Math.max(cur.x, below.x);
            const right = Math.min(cur.x + cur.w, below.x + below.w);
            const overlap = right - left;
            if (overlap <= 4) { fail(); return; }
            stack.push({ x: left, w: overlap });
            placed++;
            api.sfx('latch'); placed++;
            api.setDots(goal, Array.from({ length: goal }, (_, i) => i < placed ? 'done' : ''));
            if (placed >= goal) { win(); return; }
            cur = { x: 0, w: overlap, dir: 1 };
            speed += 0.15;
        }
        function key(e) { if (e.code === 'Space') { e.preventDefault(); drop(); } }
        document.addEventListener('keydown', key);
        cvs.addEventListener('click', drop);

        function win() { if (ended) return; ended = true; cleanup(); api.stopTimer(); setTimeout(() => api.succeed(), 250); }
        function fail() { if (ended) return; ended = true; api.shake(); cleanup(); api.stopTimer(); setTimeout(() => api.fail(), 200); }
        function cleanup() { document.removeEventListener('keydown', key); }

        api.setTag('STACK');
        api.startTimer(Math.max(12, 26 - diff * 2), () => fail());

        function draw() {
            if (!ended) {
                cur.x += cur.dir * speed;
                if (cur.x + cur.w > W) { cur.x = W - cur.w; cur.dir = -1; }
                if (cur.x < 0) { cur.x = 0; cur.dir = 1; }
            }
            ctx.clearRect(0, 0, W, H);
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            stack.forEach((b, i) => {
                ctx.fillStyle = i === 0 ? 'rgba(255,255,255,0.15)' : acc;
                ctx.globalAlpha = i === 0 ? 1 : 0.55 + (i / stack.length) * 0.45;
                ctx.fillRect(b.x, topY(i), b.w, blockH - 2);
                ctx.globalAlpha = 1;
            });
            const y = topY(stack.length);
            ctx.fillStyle = suc; ctx.shadowColor = suc; ctx.shadowBlur = 12;
            ctx.fillRect(cur.x, y, cur.w, blockH - 2); ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.setLineDash([4,4]);
            const gy = topY(goal);
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
            ctx.fillText('goal', 6, gy - 4);
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); cleanup(); } };
    }
});
