MG.register('deadcalm', {
    title: 'Dead Calm',
    hint: 'Hold SPACE to steady · CLICK to fire',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const need = api.cfg.shots || 3;
        const W = 420, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const targetR = Math.max(22, 50 - diff * 6);
        const drift = 0.9 + diff * 0.45;
        let tx = W / 2, ty = H / 2;
        let cx = W / 2, cy = H / 2;
        let phase = Math.random() * 100;
        let holding = false, breath = 1, shots = 0;
        let tvx = api.rand(-0.4, 0.4), tvy = api.rand(-0.4, 0.4);

        api.setDots(need);
        api.startTimer(Math.max(11, 24 - diff * 1.8), () => { unbind(); api.fail(); });

        function down(e) { if (e.code === 'Space') { e.preventDefault(); holding = true; } }
        function up(e)   { if (e.code === 'Space') { e.preventDefault(); holding = false; } }
        function fire() {
            const inside = Math.hypot(cx - tx, cy - ty) < targetR * 0.6;
            if (inside) {
                shots++;
                const st = []; for (let i = 0; i < need; i++) st[i] = i < shots ? 'done' : '';
                api.setDots(need, st);
                if (shots >= need) { api.stopTimer(); unbind(); setTimeout(() => api.succeed(), 250); return; }
                tx = api.rand(80, W - 80); ty = api.rand(80, H - 80);
            } else {
                api.shake(); api.stopTimer(); unbind();
                setTimeout(() => api.fail(), 200);
            }
        }
        document.addEventListener('keydown', down);
        document.addEventListener('keyup', up);
        cvs.addEventListener('click', fire);
        function unbind() {
            document.removeEventListener('keydown', down);
            document.removeEventListener('keyup', up);
        }

        function draw() {
            phase += 0.05;
            if (holding) breath = Math.max(0, breath - 0.012);
            else breath = Math.min(1, breath + 0.006);

            const steady = holding && breath > 0;
            const amp = steady ? drift * 1.2 : drift * (breath <= 0 ? 9 : 5.5);
            const wob = amp;
            cx = tx + Math.sin(phase * 1.7) * wob + Math.sin(phase * 0.6) * wob * 0.6;
            cy = ty + Math.cos(phase * 1.3) * wob + Math.cos(phase * 0.9) * wob * 0.6;

            tx += tvx; ty += tvy;
            if (tx < 70 || tx > W - 70) tvx *= -1;
            if (ty < 70 || ty > H - 70) tvy *= -1;

            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
            for (let i = 0; i < W; i += 30) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
            for (let j = 0; j < H; j += 30) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(W, j); ctx.stroke(); }

            ctx.strokeStyle = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(tx, ty, targetR, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(tx, ty, targetR * 0.6, 0, Math.PI * 2);
            ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);

            const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8';
            ctx.strokeStyle = acc; ctx.lineWidth = 2;
            ctx.shadowColor = acc; ctx.shadowBlur = steady ? 12 : 0;
            ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 18, cy); ctx.lineTo(cx - 4, cy);
            ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 18, cy);
            ctx.moveTo(cx, cy - 18); ctx.lineTo(cx, cy - 4);
            ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 18);
            ctx.stroke(); ctx.shadowBlur = 0;

            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(20, H - 16, W - 40, 6);
            ctx.fillStyle = breath > 0.25 ? acc : '#ff3b5c';
            ctx.fillRect(20, H - 16, (W - 40) * breath, 6);

            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); unbind(); } };
    }
});
