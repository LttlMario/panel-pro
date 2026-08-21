MG.register('intrusion', {
    title: 'Intrusion',
    hint: 'Click a connected node to hop · avoid red (monitored) nodes',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 480, H = 300;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const cols = 4 + Math.floor(diff / 2);
        const nodes = [];
        const colX = [];
        for (let c = 0; c < cols; c++) {
            const x = 40 + (W - 80) * (c / (cols - 1));
            colX.push(x);
            const count = c === 0 || c === cols - 1 ? 1 : api.randInt(2, 3);
            for (let i = 0; i < count; i++) {
                const y = count === 1 ? H / 2 : 50 + (H - 100) * (i / (count - 1));
                nodes.push({ x, y, col: c, monitored: false, phase: Math.random() * Math.PI * 2 });
            }
        }
        const start = nodes.find((n) => n.col === 0);
        const server = nodes.find((n) => n.col === cols - 1);

        const edges = [];
        for (let c = 0; c < cols - 1; c++) {
            const a = nodes.filter((n) => n.col === c);
            const b = nodes.filter((n) => n.col === c + 1);
            a.forEach((na) => b.forEach((nb) => edges.push([na, nb])));
        }
        function neighbors(n) {
            return edges.filter((e) => e[0] === n || e[1] === n)
                        .map((e) => e[0] === n ? e[1] : e[0])
                        .filter((m) => m.col === n.col + 1);
        }

        const mid = nodes.filter((n) => n.col > 0 && n.col < cols - 1);
        const monCount = Math.min(mid.length, 1 + diff);
        mid.sort(() => Math.random() - 0.5).slice(0, monCount).forEach((n) => n.monitored = true);
        const pulseSpeed = 0.02 + diff * 0.006;

        let pos = start, won = false, lost = false, t = 0;

        function isRed(n) {
            return n.monitored && Math.sin(t * 60 * pulseSpeed * 0.05 + n.phase) > 0.2;
        }
        function red(n) { return n.monitored && (Math.sin(n.phase + t * pulseSpeed) > 0.15); }

        function rel(e) {
            const b = cvs.getBoundingClientRect();
            return { x: (e.clientX - b.left) * (cvs.width / b.width),
                     y: (e.clientY - b.top) * (cvs.height / b.height) };
        }
        cvs.addEventListener('click', (e) => {
            if (won || lost) return;
            const p = rel(e);
            const target = neighbors(pos).find((n) => Math.hypot(n.x - p.x, n.y - p.y) < 22);
            if (!target) return;
            if (red(target)) { lost = true; api.shake(); end_(false); return; }
            pos = target;
            if (pos === server) { won = true; end_(true); }
        });
        function end_(ok) { api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 300); }

        api.setTag('INTRUDING');
        api.startTimer(Math.max(14, 28 - diff * 2), () => { if (!won && !lost) end_(false); });

        function draw() {
            t += 1;
            ctx.clearRect(0, 0, W, H);
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const dng = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();

            edges.forEach((e) => {
                const reachable = e[0] === pos;
                ctx.strokeStyle = reachable ? acc : 'rgba(255,255,255,0.08)';
                ctx.lineWidth = reachable ? 2 : 1;
                ctx.beginPath(); ctx.moveTo(e[0].x, e[0].y); ctx.lineTo(e[1].x, e[1].y); ctx.stroke();
            });
            nodes.forEach((n) => {
                const r = red(n);
                let col = 'rgba(255,255,255,0.2)';
                if (n === server) col = suc;
                else if (r) col = dng;
                else if (n.monitored) col = 'rgba(255,140,0,0.5)';
                const hop = neighbors(pos).includes(n);
                ctx.fillStyle = n === pos ? acc : '#0a0e14';
                ctx.strokeStyle = col; ctx.lineWidth = hop ? 3 : 2;
                ctx.shadowColor = col; ctx.shadowBlur = (r || n === server) ? 14 : (hop ? 10 : 0);
                ctx.beginPath(); ctx.arc(n.x, n.y, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.shadowBlur = 0;
                if (n === server) {
                    ctx.fillStyle = suc; ctx.font = '9px monospace'; ctx.textAlign = 'center';
                    ctx.fillText('SRV', n.x, n.y + 26);
                }
            });
            ctx.strokeStyle = acc; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(pos.x, pos.y, 19, 0, Math.PI * 2); ctx.stroke();

            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
