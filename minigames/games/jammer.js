MG.register('jammer', {
    title: 'Signal Jammer',
    hint: 'Jam each alarm channel when its bar peaks',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const channels = 3 + Math.floor(diff / 1.5);
        const W = 440, H = 260;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const chW = (W - 40) / channels;
        const peakLow = 80, peakHigh = 100;
        const chans = [];
        for (let i = 0; i < channels; i++) {
            chans.push({ level: api.rand(0, 40), speed: 0.8 + diff * 0.4 + Math.random() * 0.8, dir: 1, jammed: false });
        }
        let jammedCount = 0, ended = false, wrong = 0;
        const maxWrong = Math.max(2, 5 - diff);
        api.setDots(channels);

        function rel(e) {
            const b = cvs.getBoundingClientRect();
            const x = (e.clientX - b.left) * (cvs.width / b.width);
            return Math.floor((x - 20) / chW);
        }
        cvs.addEventListener('click', (e) => {
            if (ended) return;
            const idx = rel(e);
            if (idx < 0 || idx >= channels || chans[idx].jammed) return;
            const c = chans[idx];
            if (c.level >= peakLow && c.level <= peakHigh) {
                c.jammed = true; jammedCount++; api.sfx('zap');
                api.setDots(channels, Array.from({ length: channels }, (_, i) => i < jammedCount ? 'done' : ''));
                if (jammedCount >= channels) finish(true);
            } else { wrong++; api.shake(); if (wrong >= maxWrong) finish(false); }
        });

        api.setTag('JAMMING');
        api.startTimer(Math.max(13, 24 - diff * 2), () => finish(false));
        function finish(ok) { if (ended) return; ended = true; api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 250); }

        function draw() {
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            const dng = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();
            ctx.clearRect(0, 0, W, H);
            const top = 30, bh = H - 80;
            chans.forEach((c, i) => {
                const x = 20 + i * chW + 6, w = chW - 12;
                if (!ended && !c.jammed) {
                    c.level += c.dir * c.speed;
                    if (c.level > 100) { c.level = 100; c.dir = -1; }
                    if (c.level < 0) { c.level = 0; c.dir = 1; }
                }
                ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x, top, w, bh);
                ctx.fillStyle = 'rgba(57,217,138,0.18)';
                ctx.fillRect(x, top + bh * (1 - peakHigh / 100), w, bh * (peakHigh - peakLow) / 100);
                const lvl = c.jammed ? 0 : c.level;
                const fh = bh * lvl / 100;
                ctx.fillStyle = c.jammed ? suc : (lvl >= peakLow ? acc : 'rgba(255,140,0,0.7)');
                ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = (lvl >= peakLow || c.jammed) ? 12 : 0;
                ctx.fillRect(x, top + bh - fh, w, fh); ctx.shadowBlur = 0;
                ctx.fillStyle = c.jammed ? suc : 'rgba(255,255,255,0.5)'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
                ctx.fillText(c.jammed ? 'JAMMED' : ('CH' + (i + 1)), x + w / 2, H - 34);
            });
            for (let i = 0; i < maxWrong; i++) {
                ctx.fillStyle = i < wrong ? dng : 'rgba(255,255,255,0.15)';
                ctx.beginPath(); ctx.arc(20 + i * 14, H - 14, 4, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
            ctx.fillText('click a channel at its peak (green band)', W / 2, 16);
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
