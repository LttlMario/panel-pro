MG.register('bluff', {
    title: 'Bluff',
    hint: 'Read the tell · CALL a bluff, FOLD on truth',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const hands = api.cfg.hands || 3;
        const readTime = Math.max(2.2, 5 - diff * 0.5);

        const tells = [
            { face: '😬', text: 'forced grin, eyes flick away', bluff: true },
            { face: '😐', text: 'flat, steady gaze', bluff: false },
            { face: '😅', text: 'beads of sweat, quick swallow', bluff: true },
            { face: '🙂', text: 'relaxed jaw, slow blink', bluff: false },
            { face: '😶', text: 'frozen still — too still', bluff: true },
            { face: '😏', text: 'calm smirk, even breathing', bluff: false }
        ];

        let hand = 0, correct = 0, current = null, timeout = null;
        api.setDots(hands);

        const box = document.createElement('div');
        box.style.cssText = 'width:420px;display:flex;flex-direction:column;align-items:center;gap:18px;';
        box.innerHTML = `
            <div id="face" style="font-size:84px;line-height:1;filter:drop-shadow(0 0 20px var(--accent));"></div>
            <div id="tell" style="font-family:var(--display);font-size:15px;color:var(--muted);min-height:22px;"></div>
            <div id="meter" style="width:100%;height:8px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;">
                <div id="mfill" style="height:100%;width:50%;background:var(--accent);transition:width .1s;"></div>
            </div>
            <div style="display:flex;gap:14px;margin-top:6px;">
                <button class="btn danger" id="call">CALL BLUFF</button>
                <button class="btn" id="fold">FOLD</button>
            </div>`;
        api.board.appendChild(box);
        const faceEl = box.querySelector('#face');
        const tellEl = box.querySelector('#tell');
        const mfill  = box.querySelector('#mfill');

        function nextHand() {
            if (hand >= hands) { finish(); return; }
            current = tells[api.randInt(0, tells.length - 1)];
            faceEl.textContent = current.face;
            tellEl.textContent = current.text;
            api.setTag('HAND ' + (hand + 1) + '/' + hands);
            let p = 0.5;
            clearInterval(box._wob);
            box._wob = setInterval(() => {
                p += (Math.random() - 0.5) * (0.1 + diff * 0.04);
                p = Math.max(0.05, Math.min(0.95, p));
                mfill.style.width = (p * 100) + '%';
            }, 80);
            clearTimeout(timeout);
            timeout = setTimeout(() => decide(null), readTime * 1000);
        }

        function decide(choice) {
            clearTimeout(timeout);
            clearInterval(box._wob);
            if (!current) return;
            const right = (choice === 'call' && current.bluff) ||
                          (choice === 'fold' && !current.bluff);
            if (right) correct++;
            const st = [];
            for (let i = 0; i < hands; i++) {
                st[i] = i < hand ? (i < correct ? 'done' : 'fail') : (i === hand ? 'active' : '');
            }
            if (!right) api.shake();
            hand++;
            redrawDots();
            setTimeout(nextHand, 350);
        }

        function redrawDots() {
            const st = [];
            let c = correct, wrong = hand - correct, ci = 0;
            for (let i = 0; i < hands; i++) {
                if (i < hand) { st[i] = (i < correct) ? 'done' : 'fail'; }
                else st[i] = (i === hand) ? 'active' : '';
            }
            api.setDots(hands, st);
        }

        function finish() {
            const pass = correct >= Math.ceil(hands / 2 + (diff >= 4 ? 0.5 : 0));
            api.stopTimer();
            setTimeout(() => pass ? api.succeed() : api.fail(), 200);
        }

        box.querySelector('#call').onclick = () => decide('call');
        box.querySelector('#fold').onclick = () => decide('fold');

        api.startTimer(readTime * hands + 2, () => { /* overall guard */ finish(); });
        nextHand();

        return { destroy() { clearTimeout(timeout); clearInterval(box._wob); } };
    }
});
