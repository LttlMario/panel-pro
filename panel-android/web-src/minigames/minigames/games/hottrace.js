MG.register('hottrace', {
    title: 'Hot Trace',
    hint: 'Drag the probe to the end · don’t touch the walls',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 480, H = 280;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'crosshair';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const halfW = Math.max(11, 26 - diff * 3);
        const segs = 6 + diff;
        const pts = [];
        for (let i = 0; i <= segs; i++) {
            const x = 30 + (W - 60) * (i / segs);
            const y = H / 2 + Math.sin(i * 0.9 + diff) * (H / 2 - 50) * (i === 0 || i === segs ? 0 : 1);
            pts.push({ x, y });
        }
        const start = pts[0], end = pts[pts.length - 1];

        let probe = { x: start.x, y: start.y };
        let holding = false, strikes = 0, won = false, lost = false;
        const maxStrikes = Math.max(2, 5 - diff);
        let progress = 0;

        function distToCorridor(px, py) {
            let best = 1e9;
            for (let i = 0; i < pts.length - 1; i++) {
                best = Math.min(best, segDist(px, py, pts[i], pts[i + 1]));
            }
            return best;
        }
        function segDist(px, py, a, b) {
            const dx = b.x - a.x, dy = b.y - a.y;
            const len2 = dx * dx + dy * dy || 1;
            let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
            t = Math.max(0, Math.min(1, t));
            const cx = a.x + t * dx, cy = a.y + t * dy;
            return Math.hypot(px - cx, py - cy);
        }
        function rel(e) {
            const b = cvs.getBoundingClientRect();
            return { x: (e.clientX - b.left) * (cvs.width / b.width),
                     y: (e.clientY - b.top) * (cvs.height / b.height) };
        }

        cvs.addEventListener('mousedown', (e) => {
            const p = rel(e);
            if (Math.hypot(p.x - probe.x, p.y - probe.y) < 22) holding = true;
        });
        window.addEventListener('mouseup', up);
        function up() { holding = false; }
        cvs.addEventListener('mousemove', (e) => {
            if (!holding || won || lost) return;
            const p = rel(e);
            probe = p;
            const d = distToCorridor(p.x, p.y);
            if (d > halfW) {
                strikes++; api.shake(); holding = false;
                probe = nearestOnLine(p);
                if (strikes >= maxStrikes) { lost = true; api.stopTimer(); end_(false); }
            }
            if (Math.hypot(p.x - end.x, p.y - end.y) < 18) { won = true; api.stopTimer(); end_(true); }
        });
        function nearestOnLine(p) {
            let best = { x: start.x, y: start.y }, bd = 1e9;
            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i], b = pts[i + 1];
                const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
                let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2; t = Math.max(0, Math.min(1, t));
                const cx = a.x + t * dx, cy = a.y + t * dy, d = Math.hypot(p.x - cx, p.y - cy);
                if (d < bd) { bd = d; best = { x: cx, y: cy }; }
            }
            return best;
        }
        function end_(ok) {
            window.removeEventListener('mouseup', up);
            setTimeout(() => ok ? api.succeed() : api.fail(), 300);
        }

        api.setTag('TRACING');
        api.startTimer(Math.max(12, 24 - diff * 2), () => { if (!won && !lost) end_(false); });

        function draw() {
            ctx.clearRect(0, 0, W, H);
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            const dng = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();

            ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = halfW * 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();

            ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(start.x, start.y, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = suc; ctx.shadowColor = suc; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(end.x, end.y, 11, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

            ctx.fillStyle = holding ? acc : '#fff';
            ctx.shadowColor = acc; ctx.shadowBlur = holding ? 14 : 4;
            ctx.beginPath(); ctx.arc(probe.x, probe.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

            for (let i = 0; i < maxStrikes; i++) {
                ctx.fillStyle = i < strikes ? dng : 'rgba(255,255,255,0.15)';
                ctx.beginPath(); ctx.arc(20 + i * 16, 18, 5, 0, Math.PI * 2); ctx.fill();
            }
            if (!holding && !won && !lost) {
                ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
                ctx.fillText('grab the probe at start', W / 2, H - 12);
            }
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); window.removeEventListener('mouseup', up); } };
    }
});
