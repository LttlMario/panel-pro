MG.register('targets', {
    title: 'Targets',
    hint: 'Click the targets · avoid the red ones',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const need = 6 + diff * 2;
        const maxMiss = Math.max(2, 5 - diff);
        const life = Math.max(750, 1900 - diff * 210);
        const spawnGap = Math.max(380, 950 - diff * 110);
        const decoyChance = 0.12 + diff * 0.05;
        const W = 460, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'crosshair';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        let targets = [], hits = 0, miss = 0, ended = false, lastSpawn = 0;
        api.setDots(maxMiss);

        function spawn() {
            const decoy = Math.random() < decoyChance;
            targets.push({
                x: api.rand(40, W - 40), y: api.rand(40, H - 40),
                born: performance.now(), decoy, dead: false
            });
        }
        function rel(e) {
            const b = cvs.getBoundingClientRect();
            return { x: (e.clientX - b.left) * (cvs.width / b.width),
                     y: (e.clientY - b.top) * (cvs.height / b.height) };
        }
        cvs.addEventListener('click', (e) => {
            if (ended) return;
            const p = rel(e);
            for (const t of targets) {
                if (t.dead) continue;
                const age = performance.now() - t.born;
                const r = 22 * (1 - age / life) + 6;
                if (Math.hypot(t.x - p.x, t.y - p.y) < r + 4) {
                    t.dead = true;
                    if (t.decoy) { registerMiss(); }
                    else { hits++; api.sfx('select'); if (hits >= need) win(); }
                    return;
                }
            }
        });
        function registerMiss() {
            miss++;
            api.setDots(maxMiss, Array.from({ length: maxMiss }, (_, i) => i < miss ? 'fail' : ''));
            if (miss >= maxMiss) fail();
        }
        function win() { if (ended) return; ended = true; api.stopTimer(); setTimeout(() => api.succeed(), 250); }
        function fail() { if (ended) return; ended = true; api.shake(); api.stopTimer(); setTimeout(() => api.fail(), 200); }

        api.setTag('0/' + need);
        api.startTimer(Math.max(14, 28 - diff * 2), () => fail());

        function draw() {
            const now = performance.now();
            if (!ended && now - lastSpawn > spawnGap) { spawn(); lastSpawn = now; }
            ctx.clearRect(0, 0, W, H);
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const dng = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();

            targets.forEach((t) => {
                if (t.dead) return;
                const age = now - t.born;
                if (age > life) { t.dead = true; if (!t.decoy) registerMiss(); return; }
                const r = 22 * (1 - age / life) + 6;
                ctx.strokeStyle = t.decoy ? dng : acc; ctx.lineWidth = 3;
                ctx.fillStyle = t.decoy ? 'rgba(255,59,92,0.12)' : 'rgba(0,224,184,0.12)';
                ctx.shadowColor = t.decoy ? dng : acc; ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.arc(t.x, t.y, r * 0.4, 0, Math.PI * 2); ctx.stroke();
                ctx.shadowBlur = 0;
            });
            targets = targets.filter((t) => !t.dead);
            api.setTag(hits + '/' + need);
            if (!ended) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
