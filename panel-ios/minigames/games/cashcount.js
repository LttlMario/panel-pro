MG.register('cashcount', {
    title: 'Count The Take',
    hint: 'Click bills to hit the exact amount · UNDO to remove the last',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 420, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const DENOMS = [5, 10, 20, 50, 100];
        const target = 5 * api.randInt(15 + diff * 6, 35 + diff * 22);
        let total = 0, stack = [], done = false, flash = 0;

        const bw = (W - 50) / (DENOMS.length + 1);
        const btns = DENOMS.map((d, i) => ({ d, x: 25 + i * bw, w: bw - 8, y: H - 78, h: 52 }));
        const undoBtn = { x: 25 + DENOMS.length * bw, w: bw - 8, y: H - 78, h: 52 };

        function check() { api.setTag('$' + total + ' / $' + target); if (total === target) { done = true; api.stopTimer(); api.setTag('EXACT — $' + total); setTimeout(() => api.succeed(), 350); } }
        function add(d) { if (done) return; total += d; stack.push(d); flash = 6; api.sfx('click'); check(); }
        function undo() { if (done || !stack.length) return; total -= stack.pop(); api.sfx('tick'); }

        cvs.addEventListener('click', (e) => {
            if (done) return;
            const b = cvs.getBoundingClientRect();
            const x = (e.clientX - b.left) * (W / b.width), y = (e.clientY - b.top) * (H / b.height);
            for (const bt of btns) if (x >= bt.x && x <= bt.x + bt.w && y >= bt.y && y <= bt.y + bt.h) { add(bt.d); return; }
            if (x >= undoBtn.x && x <= undoBtn.x + undoBtn.w && y >= undoBtn.y && y <= undoBtn.y + undoBtn.h) undo();
        });

        api.setTag('$0 / $' + target);
        api.startTimer(Math.max(20, 34 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); setTimeout(() => api.fail(), 200); } });

        function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

        function draw() {
            if (flash > 0) flash--;
            ctx.clearRect(0, 0, W, H);

            const over = total > target;
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.fillText('TARGET', W / 2, 36);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 38px monospace'; ctx.fillText('$' + target.toLocaleString(), W / 2, 78);

            ctx.fillStyle = over ? dng : (total === target ? suc : acc);
            ctx.font = 'bold 26px monospace'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = flash * 3;
            ctx.fillText('$' + total.toLocaleString(), W / 2, 124); ctx.shadowBlur = 0;
            ctx.fillStyle = over ? dng : 'rgba(255,255,255,0.4)'; ctx.font = '11px monospace';
            ctx.fillText(over ? 'OVER — undo some' : (target - total) + ' to go  ·  ' + stack.length + ' bills', W / 2, 146);

            btns.forEach(bt => {
                ctx.fillStyle = 'rgba(57,217,138,0.10)'; rr(bt.x, bt.y, bt.w, bt.h, 7); ctx.fill();
                ctx.strokeStyle = suc; ctx.lineWidth = 1.5; rr(bt.x, bt.y, bt.w, bt.h, 7); ctx.stroke();
                ctx.fillStyle = suc; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillText('$' + bt.d, bt.x + bt.w / 2, bt.y + bt.h / 2 + 5);
            });
            ctx.fillStyle = 'rgba(255,59,92,0.10)'; rr(undoBtn.x, undoBtn.y, undoBtn.w, undoBtn.h, 7); ctx.fill();
            ctx.strokeStyle = dng; ctx.lineWidth = 1.5; rr(undoBtn.x, undoBtn.y, undoBtn.w, undoBtn.h, 7); ctx.stroke();
            ctx.fillStyle = dng; ctx.font = 'bold 12px monospace'; ctx.fillText('UNDO', undoBtn.x + undoBtn.w / 2, undoBtn.y + undoBtn.h / 2 + 4);

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
