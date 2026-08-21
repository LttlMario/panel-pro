MG.register('hotwire', {
    title: 'Hotwire',
    hint: 'Connect matching wires, then time the ignition spark',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 420, H = 280;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const pairCount = 2 + Math.floor(diff / 1.5);
        const colors = ['#ff4d6d', '#ffd23f', '#5b8cff', '#39d98a', '#c06bff'];
        const order = [...Array(pairCount).keys()];
        const rightOrder = order.slice().sort(() => Math.random() - 0.5);
        const gap = (H - 120) / (pairCount - 1 || 1);
        const left = order.map((i) => ({ x: 60, y: 40 + i * gap, c: colors[i], done: false }));
        const right = rightOrder.map((cIdx, i) => ({ x: W - 60, y: 40 + i * gap, c: colors[cIdx] }));

        let phase = 'wire', dragFrom = null, mouse = { x: 0, y: 0 }, solved = 0, ended = false;
        const links = [];
        let pos = 0, dir = 1, zoneX = 0, igniteReady = false;
        const igniteSpeed = 2.6 + diff * 0.8;
        const zoneW = Math.max(40, 90 - diff * 10);

        function rel(e) {
            const b = cvs.getBoundingClientRect();
            return { x: (e.clientX - b.left) * (cvs.width / b.width), y: (e.clientY - b.top) * (cvs.height / b.height) };
        }
        function nodeAt(x, y, arr) { return arr.find((n) => Math.hypot(n.x - x, n.y - y) < 16); }

        cvs.addEventListener('mousedown', (e) => {
            if (phase !== 'wire' || ended) return;
            const p = rel(e); const n = nodeAt(p.x, p.y, left);
            if (n && !n.done) dragFrom = n;
        });
        cvs.addEventListener('mousemove', (e) => { mouse = rel(e); });
        cvs.addEventListener('mouseup', (e) => {
            if (phase !== 'wire' || !dragFrom) return;
            const p = rel(e); const t = nodeAt(p.x, p.y, right);
            if (t && t.c === dragFrom.c) {
                dragFrom.done = true; links.push({ a: dragFrom, b: t, c: dragFrom.c }); solved++; api.sfx('latch');
                if (solved >= pairCount) {
                    phase = 'ignite'; api.setTag('IGNITION');
                    zoneX = 60 + Math.random() * (W - 120 - zoneW);
                    pos = 50; dir = 1;
                    setTimeout(() => { igniteReady = true; }, 350);
                }
            } else if (t) { api.shake(); api.stopTimer(); ended = true; setTimeout(() => api.fail(), 200); }
            dragFrom = null;
        });
        cvs.addEventListener('click', () => {
            if (phase !== 'ignite' || ended || !igniteReady) return;
            if (pos >= zoneX && pos <= zoneX + zoneW) { finish(true); }
            else { api.shake(); finish(false); }
        });
        function key(e) { if (e.code === 'Space' && phase === 'ignite') { e.preventDefault(); cvs.click(); } }
        document.addEventListener('keydown', key);

        api.setTag('STRIP WIRES');
        api.startTimer(Math.max(14, 26 - diff * 2), () => finish(false));
        function finish(ok) { if (ended) return; ended = true; document.removeEventListener('keydown', key); api.stopTimer(); if (ok) api.sfx('charge'); setTimeout(() => ok ? api.succeed() : api.fail(), 250); }

        function wire(x1, y1, x2, y2, c, w) {
            ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.shadowColor = c; ctx.shadowBlur = 6;
            const mx = (x1 + x2) / 2;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2); ctx.stroke(); ctx.shadowBlur = 0;
        }
        function draw() {
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            ctx.clearRect(0, 0, W, H);
            links.forEach((l) => wire(l.a.x, l.a.y, l.b.x, l.b.y, l.c, 4));
            if (dragFrom) wire(dragFrom.x, dragFrom.y, mouse.x, mouse.y, dragFrom.c, 3);
            const port = (n, filled) => { ctx.fillStyle = filled ? n.c : '#0a0e14'; ctx.strokeStyle = n.c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(n.x, n.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
            left.forEach((n) => port(n, n.done)); right.forEach((n) => port(n, false));

            if (phase === 'ignite') {
                const ty = H - 40;
                ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(50, ty - 12, W - 100, 24);
                ctx.fillStyle = 'rgba(57,217,138,0.2)'; ctx.strokeStyle = suc; ctx.lineWidth = 2;
                ctx.fillRect(zoneX, ty - 12, zoneW, 24); ctx.strokeRect(zoneX, ty - 12, zoneW, 24);
                if (!ended && igniteReady) { pos += dir * igniteSpeed; if (pos > W - 50) { pos = W - 50; dir = -1; } if (pos < 50) { pos = 50; dir = 1; } }
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.shadowColor = acc; ctx.shadowBlur = 12;
                ctx.beginPath(); ctx.moveTo(pos, ty - 18); ctx.lineTo(pos, ty + 18); ctx.stroke(); ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
                ctx.fillText(igniteReady ? 'SPACE / click in the green to start the engine' : 'get ready…', W / 2, ty - 26);
            }
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
