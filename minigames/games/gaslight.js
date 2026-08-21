MG.register('gaslight', {
    title: 'Gaslight',
    hint: 'Memorize the scene · then answer',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const rounds = 3;
        const itemCount = 3 + diff;
        const flashMs = Math.max(700, 1900 - diff * 280);

        const ICONS = ['🔑','💊','📁','💵','🔫','📱','💎','🧪','📷','🎫','🧨','🗝️'];
        let round = 0, correct = 0;
        api.setDots(rounds);

        const box = document.createElement('div');
        box.style.cssText = 'width:480px;min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;';
        api.board.appendChild(box);

        api.startTimer(flashMs / 1000 * rounds + rounds * 6, () => finish());

        function scene() {
            if (round >= rounds) { finish(); return; }
            api.setTag('OBSERVE ' + (round + 1) + '/' + rounds);
            const items = [];
            const used = new Set();
            while (items.length < itemCount) {
                const ic = ICONS[api.randInt(0, ICONS.length - 1)];
                if (!used.has(ic)) { used.add(ic); items.push(ic); }
            }
            box.innerHTML = `<div class="label">MEMORIZE</div>
                <div style="display:grid;grid-template-columns:repeat(${Math.ceil(Math.sqrt(itemCount))},1fr);
                     gap:18px;font-size:46px;">
                     ${items.map(i => `<span>${i}</span>`).join('')}
                </div>`;
            setTimeout(() => question(items), flashMs);
        }

        function question(items) {
            const qType = api.randInt(0, Math.min(2, diff - 1 < 0 ? 0 : diff - 1));
            let prompt, answer, options;

            if (qType === 0) {
                const present = Math.random() < 0.5;
                const pick = present ? items[api.randInt(0, items.length - 1)]
                                     : pickAbsent(items);
                prompt = `Was this item in the scene?  ${pick}`;
                answer = present ? 'YES' : 'NO';
                options = ['YES', 'NO'];
            } else if (qType === 1) {
                prompt = 'How many items did you see?';
                answer = String(items.length);
                const set = new Set([items.length]);
                while (set.size < 4) set.add(api.randInt(Math.max(1, items.length - 2), items.length + 2));
                options = [...set].sort(() => Math.random() - 0.5).map(String);
            } else {
                const real = items[api.randInt(0, items.length - 1)];
                prompt = 'Which item was present?';
                answer = real;
                const set = new Set([real]);
                while (set.size < 4) set.add(ICONS[api.randInt(0, ICONS.length - 1)]);
                options = [...set].sort(() => Math.random() - 0.5);
            }
            api.setTag('RECALL');

            box.innerHTML = `<div class="label">RECALL</div>
                <div style="font-family:var(--display);font-size:18px;">${prompt}</div>
                <div id="opts" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;"></div>`;
            const opts = box.querySelector('#opts');
            options.forEach(o => {
                const b = document.createElement('button');
                b.className = 'btn';
                b.style.fontSize = o.length <= 2 ? '24px' : '14px';
                b.textContent = o;
                b.onclick = () => answerPicked(o === answer);
                opts.appendChild(b);
            });
        }

        function pickAbsent(items) {
            let ic;
            do { ic = ICONS[api.randInt(0, ICONS.length - 1)]; } while (items.includes(ic));
            return ic;
        }

        function answerPicked(ok) {
            if (ok) correct++; else api.shake();
            const st = [];
            for (let i = 0; i < rounds; i++) {
                if (i < round) st[i] = (i < correct) ? 'done' : 'fail';
                else st[i] = '';
            }
            round++;
            const st2 = [];
            for (let i = 0; i < rounds; i++) {
                if (i < round) st2[i] = (i < correct) ? 'done' : 'fail';
                else st2[i] = (i === round) ? 'active' : '';
            }
            api.setDots(rounds, st2);
            setTimeout(scene, 400);
        }

        function finish() {
            const pass = correct >= Math.ceil(rounds / 2 + (diff >= 4 ? 0.5 : 0));
            api.stopTimer();
            setTimeout(() => pass ? api.succeed() : api.fail(), 200);
        }

        scene();
        return { destroy() {} };
    }
});
