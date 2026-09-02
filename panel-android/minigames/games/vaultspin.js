MG.register('vaultspin', {
    title: 'Vault Spin',
    hint: 'Drag the dial to each lit number',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const tumblers = api.cfg.tumblers || (2 + Math.floor(diff / 2));
        const tol = Math.max(4, 12 - diff * 1.6);
        const segments = 40;

        const W = 320, H = 300;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'grab';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');
        const cxp = W / 2, cyp = H / 2, R = 110;

        const targets = [];
        for (let i = 0; i < tumblers; i++) targets.push(api.randInt(0, segments - 1));
        let step = 0, angle = 0, dragging = false, lastA = 0;
        api.setDots(tumblers);

        function numToAngle(n) { return (n / segments) * Math.PI * 2 - Math.PI / 2; }
        function angleToNum(a) {
            let deg = ((a + Math.PI / 2) % (Math.PI * 2));
            if (deg < 0) deg += Math.PI * 2;
            return Math.round(deg / (Math.PI * 2) * segments) % segments;
        }
        function pointerAngle(e) {
            const b = cvs.getBoundingClientRect();
            const sx = cvs.width / b.width;
            const sy = cvs.height / b.height;
            const px = (e.clientX - b.left) * sx;
            const py = (e.clientY - b.top) * sy;
            return Math.atan2(py - cyp, px - cxp);
        }

        cvs.addEventListener('mousedown', (e) => { dragging = true; lastA = pointerAngle(e); cvs.style.cursor = 'grabbing'; });
        window.addEventListener('mouseup', upH);
        cvs.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const a = pointerAngle(e);
            let d = a - lastA;
            if (d > Math.PI) d -= Math.PI * 2;
            if (d < -Math.PI) d += Math.PI * 2;
            angle += d; lastA = a;
        });
        function upH() {
            if (!dragging) return;
            dragging = false; cvs.style.cursor = 'grab';
            const cur = angleToNum(angle);
            if (cur === targets[step]) {
                step++;
                const st = []; for (let i = 0; i < tumblers; i++) st[i] = i < step ? 'done' : (i === step ? 'active' : '');
                api.setDots(tumblers, st);
                if (step >= tumblers) { api.stopTimer(); cleanup(); setTimeout(() => api.succeed(), 250); }
            }
        }
        function cleanup() { window.removeEventListener('mouseup', upH); }

        api.startTimer(Math.max(12, 26 - diff * 2), () => { cleanup(); api.fail(); });

        function draw() {
            ctx.clearRect(0, 0, W, H);
            const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8';
            ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cxp, cyp, R + 14, 0, Math.PI * 2); ctx.stroke();
            for (let i = 0; i < segments; i++) {
                const a = numToAngle(i);
                const big = i % 5 === 0;
                const r1 = R + 10, r2 = R + (big ? -2 : 3);
                ctx.strokeStyle = i === targets[step] ? acc : 'rgba(255,255,255,0.25)';
                ctx.lineWidth = big ? 2 : 1;
                ctx.beginPath();
                ctx.moveTo(cxp + Math.cos(a) * r1, cyp + Math.sin(a) * r1);
                ctx.lineTo(cxp + Math.cos(a) * r2, cyp + Math.sin(a) * r2);
                ctx.stroke();
                if (big) {
                    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '10px monospace';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(i, cxp + Math.cos(a) * (R - 14), cyp + Math.sin(a) * (R - 14));
                }
            }
            const g = ctx.createRadialGradient(cxp, cyp, 10, cxp, cyp, R);
            g.addColorStop(0, '#1a2230'); g.addColorStop(1, '#0a0e14');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cxp, cyp, R, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.stroke();
            ctx.save(); ctx.translate(cxp, cyp); ctx.rotate(angle);
            ctx.fillStyle = acc; ctx.shadowColor = acc; ctx.shadowBlur = 10;
            ctx.fillRect(-3, -R + 6, 6, 30);
            ctx.restore(); ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.moveTo(cxp, cyp - R - 18); ctx.lineTo(cxp - 7, cyp - R - 30); ctx.lineTo(cxp + 7, cyp - R - 30); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 26px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(angleToNum(angle), cxp, cyp);

            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); cleanup(); } };
    }
});
