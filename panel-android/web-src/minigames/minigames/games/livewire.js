MG.register('livewire', {
    title: 'Live Wire',
    hint: 'Drag each wire to its matching color',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const pairs = 3 + Math.floor(diff / 2);
        const time  = Math.max(8, 22 - diff * 2.5);

        const colors = ['#ff4d6d', '#ffd23f', '#00e0b8', '#5b8cff', '#c06bff', '#ff8a00'];
        const W = 480, H = 300, pad = 40;

        const wrap = document.createElement('div');
        wrap.style.cssText = `position:relative;width:${W}px;height:${H}px;`;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cssText = 'position:absolute;inset:0;';
        wrap.appendChild(cvs);
        api.board.appendChild(wrap);
        const ctx = cvs.getContext('2d');

        const order = [...Array(pairs).keys()];
        const rightOrder = order.slice().sort(() => Math.random() - 0.5);
        const gap = (H - pad * 2) / (pairs - 1 || 1);
        const left = order.map((i) => ({ x: pad, y: pad + i * gap, c: colors[i], done: false }));
        const right = rightOrder.map((cIdx, i) => ({ x: W - pad, y: pad + i * gap, c: colors[cIdx], idx: cIdx }));

        let dragFrom = null, mouse = { x: 0, y: 0 }, solved = 0;
        const links = [];

        api.startTimer(time, () => api.fail());

        function nodeAt(x, y, arr, r = 16) {
            return arr.find((n) => Math.hypot(n.x - x, n.y - y) < r);
        }

        cvs.addEventListener('mousedown', (e) => {
            const { x, y } = rel(e);
            const n = nodeAt(x, y, left);
            if (n && !n.done) dragFrom = n;
        });
        cvs.addEventListener('mousemove', (e) => { mouse = rel(e); });
        cvs.addEventListener('mouseup', (e) => {
            if (!dragFrom) return;
            const { x, y } = rel(e);
            const t = nodeAt(x, y, right);
            if (t && t.c === dragFrom.c) {
                dragFrom.done = true;
                links.push({ a: dragFrom, b: t, c: dragFrom.c });
                solved++;
                if (solved >= pairs) { api.stopTimer(); setTimeout(() => api.succeed(), 250); }
            } else if (t) {
                api.shake();
                api.stopTimer();
                setTimeout(() => api.fail(), 200);
            }
            dragFrom = null;
        });

        function rel(e) {
            const b = cvs.getBoundingClientRect();
            const sx = cvs.width / b.width;
            const sy = cvs.height / b.height;
            return { x: (e.clientX - b.left) * sx, y: (e.clientY - b.top) * sy };
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            links.forEach((l) => wire(l.a.x, l.a.y, l.b.x, l.b.y, l.c, 4));
            if (dragFrom) wire(dragFrom.x, dragFrom.y, mouse.x, mouse.y, dragFrom.c, 3);
            left.forEach((n) => port(n.x, n.y, n.c, n.done));
            right.forEach((n) => port(n.x, n.y, n.c, false));
            loop = requestAnimationFrame(draw);
        }
        function wire(x1, y1, x2, y2, c, w) {
            ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round';
            ctx.shadowColor = c; ctx.shadowBlur = 8;
            ctx.beginPath();
            const mx = (x1 + x2) / 2;
            ctx.moveTo(x1, y1);
            ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        function port(x, y, c, done) {
            ctx.fillStyle = done ? c : '#0a0e14';
            ctx.strokeStyle = c; ctx.lineWidth = 3;
            ctx.shadowColor = c; ctx.shadowBlur = done ? 14 : 6;
            ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
        }

        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
