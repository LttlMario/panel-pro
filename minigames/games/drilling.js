MG.register('drilling', {
    title: 'Drilling',
    hint: 'Hold to drill · keep pressure in the green, don\u2019t overheat',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 360, H = 280;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const bandLow = 45, bandHigh = 72;
        const rise = 1.4 + diff * 0.5;
        const fall = 1.1 + diff * 0.25;
        const wander = diff * 0.5;
        let pressure = 20, depth = 0, heat = 0, holding = false, ended = false;

        function down(e) { if (e.code === 'Space') { e.preventDefault(); holding = true; } }
        function up(e) { if (e.code === 'Space') { e.preventDefault(); holding = false; } }
        document.addEventListener('keydown', down);
        document.addEventListener('keyup', up);
        cvs.addEventListener('mousedown', () => holding = true);
        window.addEventListener('mouseup', mUp);
        function mUp() { holding = false; }

        api.setTag('DRILLING');
        api.startTimer(Math.max(13, 24 - diff * 1.6), () => finish(false));
        function finish(ok) {
            if (ended) return; ended = true;
            document.removeEventListener('keydown', down);
            document.removeEventListener('keyup', up);
            window.removeEventListener('mouseup', mUp);
            api.stopTimer();
            setTimeout(() => ok ? api.succeed() : api.fail(), 250);
        }

        function draw() {
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            const dng = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();
            if (!ended) {
                pressure += (holding ? rise : -fall) + (Math.random() - 0.5) * wander;
                pressure = Math.max(0, Math.min(100, pressure));
                const inBand = pressure >= bandLow && pressure <= bandHigh;
                if (inBand) { depth += 0.7; api.sfx('tick'); heat = Math.max(0, heat - 0.4); }
                else { heat += pressure > bandHigh ? 1.4 : 0.2; }
                api.setTag(inBand ? 'DRILLING' : (pressure > bandHigh ? 'TOO HARD' : 'TOO SOFT'));
                if (heat >= 100) { finish(false); return; }
                if (depth >= 100) { finish(true); return; }
            }
            ctx.clearRect(0, 0, W, H);
            const gx = 50, gw = 50, gy = 30, gh = H - 90;
            ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(gx, gy, gw, gh);
            const by = gy + gh * (1 - bandHigh / 100), bh = gh * (bandHigh - bandLow) / 100;
            ctx.fillStyle = 'rgba(57,217,138,0.18)'; ctx.strokeStyle = suc; ctx.lineWidth = 2;
            ctx.fillRect(gx, by, gw, bh); ctx.strokeRect(gx, by, gw, bh);
            const py = gy + gh * (1 - pressure / 100);
            ctx.fillStyle = '#fff'; ctx.shadowColor = acc; ctx.shadowBlur = 10;
            ctx.fillRect(gx - 6, py - 2, gw + 12, 4); ctx.shadowBlur = 0;
            ctx.fillStyle = acc; ctx.font = '10px monospace'; ctx.textAlign = 'center';
            ctx.fillText('PRESSURE', gx + gw / 2, gy + gh + 16);

            const dx = 160, dw = 36;
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(dx, gy, dw, gh);
            ctx.fillStyle = suc; const dfh = gh * depth / 100;
            ctx.fillRect(dx, gy + gh - dfh, dw, dfh);
            ctx.fillStyle = acc; ctx.fillText('DEPTH', dx + dw / 2, gy + gh + 16);

            const hx = 250, hw = 36;
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(hx, gy, hw, gh);
            ctx.fillStyle = heat > 60 ? dng : 'rgba(255,140,0,0.8)'; const hfh = gh * heat / 100;
            ctx.fillRect(hx, gy + gh - hfh, hw, hfh);
            ctx.fillStyle = acc; ctx.fillText('HEAT', hx + hw / 2, gy + gh + 16);

            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px monospace';
            ctx.fillText('hold SPACE to drill', W / 2, H - 14);
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); window.removeEventListener('mouseup', mUp); } };
    }
});
