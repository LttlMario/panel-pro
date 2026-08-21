MG.register('steadydose', {
    title: 'Steady Dose',
    hint: 'Move mouse · keep the needle in the band',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 360, H = 300;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'ns-resize';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const zoneH = Math.max(34, 80 - diff * 9);
        const zoneSpeed = 0.8 + diff * 0.5;
        const tremor = diff * 0.9;
        let zoneY = H / 2, zdir = 1, phase = 0;
        let needle = H / 2, fill = 0;

        api.startTimer(Math.max(10, 20 - diff), () => { unbind(); api.fail(); });

        function move(e) {
            const b = cvs.getBoundingClientRect();
            const sy = cvs.height / b.height;
            needle = Math.max(20, Math.min(H - 20, (e.clientY - b.top) * sy));
        }
        cvs.addEventListener('mousemove', move);
        function unbind() { cvs.removeEventListener('mousemove', move); }

        function draw() {
            phase += 0.04;
            zoneY += zdir * zoneSpeed * (1 + Math.sin(phase) * 0.4);
            if (zoneY < zoneH / 2 + 20) zdir = 1;
            if (zoneY > H - zoneH / 2 - 20) zdir = -1;

            const wob = Math.sin(phase * 5) * tremor;
            const nY = needle + wob;
            const inside = nY > zoneY - zoneH / 2 && nY < zoneY + zoneH / 2;
            fill += inside ? 0.9 : -1.3;
            fill = Math.max(0, Math.min(100, fill));
            if (!inside && tremor > 0) api.setTag('UNSTABLE'); else api.setTag('STABLE');

            if (fill >= 100) { api.stopTimer(); unbind(); setTimeout(() => api.succeed(), 200); return; }

            ctx.clearRect(0, 0, W, H);
            const trackX = W / 2 - 30;
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(trackX, 20, 60, H - 40);
            const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8';
            ctx.fillStyle = inside ? 'rgba(57,217,138,0.25)' : 'rgba(0,224,184,0.12)';
            ctx.strokeStyle = inside ? '#39d98a' : acc; ctx.lineWidth = 2;
            ctx.fillRect(trackX, zoneY - zoneH / 2, 60, zoneH);
            ctx.strokeRect(trackX, zoneY - zoneH / 2, 60, zoneH);
            ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(trackX - 14, nY); ctx.lineTo(trackX - 2, nY - 8); ctx.lineTo(trackX - 2, nY + 8);
            ctx.fill(); ctx.shadowBlur = 0;
            ctx.fillRect(trackX, nY - 1.5, 60, 3);

            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(W - 26, 20, 10, H - 40);
            ctx.fillStyle = acc;
            const fh = (H - 40) * (fill / 100);
            ctx.fillRect(W - 26, 20 + (H - 40 - fh), 10, fh);

            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); unbind(); } };
    }
});
