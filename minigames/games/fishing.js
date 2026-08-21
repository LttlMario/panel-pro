MG.register('fishing', {
    title: 'Fishing',
    hint: 'Wait for the bite · then keep the fish in the zone',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 360, H = 320;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const reelGoal = 100;
        const zoneH = Math.max(50, 110 - diff * 12);
        const fishSpeed = 0.8 + diff * 0.6;
        const drain = 0.35 + diff * 0.12;

        let phase = 'wait', biteAt = 0, ended = false;
        let zoneY = H / 2, holding = false;
        let fishY = H / 2, fishVel = 0, fishTimer = 0;
        let reel = 25;

        const delay = api.rand(1200, 3200);
        const waitTO = setTimeout(() => { if (!ended) { phase = 'reel'; biteAt = performance.now(); api.setTag('REEL!'); } }, delay);

        function down(e) { if (e.code === 'Space') { e.preventDefault(); holding = true; } }
        function up(e) { if (e.code === 'Space') { e.preventDefault(); holding = false; } }
        document.addEventListener('keydown', down);
        document.addEventListener('keyup', up);
        cvs.addEventListener('mousedown', () => holding = true);
        window.addEventListener('mouseup', mUp);
        function mUp() { holding = false; }

        api.setTag('WAITING');
        api.startTimer(Math.max(14, 26 - diff * 2), () => finish(false));

        function finish(ok) {
            if (ended) return; ended = true;
            clearTimeout(waitTO);
            document.removeEventListener('keydown', down);
            document.removeEventListener('keyup', up);
            window.removeEventListener('mouseup', mUp);
            api.stopTimer();
            setTimeout(() => ok ? api.succeed() : api.fail(), 250);
        }

        function draw() {
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            ctx.clearRect(0, 0, W, H);

            ctx.fillStyle = 'rgba(91,140,255,0.06)';
            ctx.fillRect(40, 20, 80, H - 40);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.strokeRect(40, 20, 80, H - 40);

            if (phase === 'wait') {
                ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
                ctx.fillText('waiting for a bite…', W / 2, H / 2);
                const bob = Math.sin(performance.now() / 300) * 4;
                ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(80, H / 2 + bob, 7, 0, Math.PI * 2); ctx.fill();
            } else if (phase === 'reel') {
                if (!ended) {
                    zoneY += (holding ? -2.4 : 2.0);
                    zoneY = Math.max(20 + zoneH / 2, Math.min(H - 20 - zoneH / 2, zoneY));
                    fishTimer -= 1;
                    if (fishTimer <= 0) { fishVel = api.rand(-fishSpeed, fishSpeed); fishTimer = api.randInt(20, 50); }
                    fishY += fishVel;
                    fishY = Math.max(30, Math.min(H - 30, fishY));
                    const inside = fishY > zoneY - zoneH / 2 && fishY < zoneY + zoneH / 2;
                    reel += inside ? 0.8 : -drain;
                    reel = Math.max(0, Math.min(reelGoal, reel));
                    api.setTag(inside ? 'REELING' : 'SLIPPING');
                    if (reel >= reelGoal) { finish(true); return; }
                    if (reel <= 0 && performance.now() - biteAt > 1500) { finish(false); return; }
                }
                const inside = fishY > zoneY - zoneH / 2 && fishY < zoneY + zoneH / 2;
                ctx.fillStyle = inside ? 'rgba(57,217,138,0.2)' : 'rgba(0,224,184,0.12)';
                ctx.strokeStyle = inside ? suc : acc; ctx.lineWidth = 2;
                ctx.fillRect(45, zoneY - zoneH / 2, 70, zoneH);
                ctx.strokeRect(45, zoneY - zoneH / 2, 70, zoneH);
                ctx.fillStyle = '#fff'; ctx.shadowColor = acc; ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.arc(80, fishY, 9, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(W - 40, 20, 14, H - 40);
                ctx.fillStyle = suc;
                const rh = (H - 40) * (reel / reelGoal);
                ctx.fillRect(W - 40, 20 + (H - 40 - rh), 14, rh);
            }
            if (!ended) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); clearTimeout(waitTO); document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); window.removeEventListener('mouseup', mUp); } };
    }
});
