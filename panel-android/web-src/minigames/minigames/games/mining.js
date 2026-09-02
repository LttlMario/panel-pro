MG.register('mining', {
    title: 'Mining',
    hint: 'Click the glowing crack to strike · break the rock',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 360, H = 300;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const hitsNeeded = 4 + diff;
        const crackTime = Math.max(600, 1550 - diff * 170);
        let hits = 0, ended = false;
        let crack = null, crackBorn = 0, wrongStrikes = 0;
        const maxWrong = Math.max(2, 5 - diff);

        api.setDots(hitsNeeded);
        spawnCrack();

        function spawnCrack() {
            crack = { x: api.rand(70, W - 70), y: api.rand(70, H - 70) };
            crackBorn = performance.now();
        }
        function rel(e) {
            const b = cvs.getBoundingClientRect();
            return { x: (e.clientX - b.left) * (cvs.width / b.width),
                     y: (e.clientY - b.top) * (cvs.height / b.height) };
        }
        cvs.addEventListener('click', (e) => {
            if (ended || !crack) return;
            const p = rel(e);
            if (Math.hypot(p.x - crack.x, p.y - crack.y) < 28) {
                hits++;
                api.sfx('zap');
                api.setDots(hitsNeeded, Array.from({ length: hitsNeeded }, (_, i) => i < hits ? 'done' : ''));
                if (hits >= hitsNeeded) { finish(true); return; }
                spawnCrack();
            } else {
                wrongStrikes++; api.shake();
                if (wrongStrikes >= maxWrong) finish(false);
            }
        });

        api.setTag('MINING');
        api.startTimer(Math.max(12, 24 - diff * 2), () => finish(false));
        function finish(ok) { if (ended) return; ended = true; api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 250); }

        function draw() {
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            ctx.clearRect(0, 0, W, H);
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(255,255,255,0.02)');
            ctx.fillStyle = g; ctx.fillRect(20, 20, W - 40, H - 40);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            for (let i = 0; i < 8; i++) {
                ctx.beginPath();
                ctx.moveTo(api.randInt(20, W - 20) * 0 + (20 + i * (W - 40) / 8), 20);
                ctx.lineTo(20 + ((i + 0.5) * (W - 40) / 8), H - 20);
                ctx.globalAlpha = 0.04; ctx.stroke(); ctx.globalAlpha = 1;
            }
            if (crack && !ended) {
                const age = performance.now() - crackBorn;
                if (age > crackTime) { api.shake(); wrongStrikes++; if (wrongStrikes >= maxWrong) { finish(false); return; } spawnCrack(); }
                const pulse = 0.6 + Math.sin(age / 90) * 0.4;
                const r = 24 * (1 - age / crackTime) + 8;
                ctx.fillStyle = acc; ctx.globalAlpha = pulse; ctx.shadowColor = acc; ctx.shadowBlur = 18;
                ctx.beginPath(); ctx.arc(crack.x, crack.y, r, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1; ctx.shadowBlur = 0;
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
                for (let i = 0; i < 5; i++) {
                    const a = i / 5 * Math.PI * 2;
                    ctx.beginPath(); ctx.moveTo(crack.x, crack.y);
                    ctx.lineTo(crack.x + Math.cos(a) * r * 1.4, crack.y + Math.sin(a) * r * 1.4);
                    ctx.globalAlpha = pulse * 0.6; ctx.stroke(); ctx.globalAlpha = 1;
                }
            }
            for (let i = 0; i < maxWrong; i++) {
                ctx.fillStyle = i < wrongStrikes ? (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim() : 'rgba(255,255,255,0.15)';
                ctx.beginPath(); ctx.arc(30 + i * 16, 12, 5, 0, Math.PI * 2); ctx.fill();
            }
            if (!ended) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
