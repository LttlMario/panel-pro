MG.register('keypad', {
    title: 'Keypad',
    hint: '● right spot · ○ right digit, wrong spot',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const len = 3 + Math.floor(diff / 2);
        const attempts = Math.max(4, 8 - diff);
        const code = Array.from({ length: len }, () => api.randInt(0, 9));

        let guess = [], tries = 0, ended = false;

        const box = document.createElement('div');
        box.style.cssText = 'display:flex;gap:28px;align-items:flex-start;';
        box.innerHTML = `
            <div>
              <div class="label">ENTRY</div>
              <div id="entry" style="display:flex;gap:8px;margin-bottom:12px;height:46px;align-items:center;width:184px;"></div>
              <div id="pad" style="display:grid;grid-template-columns:repeat(3,56px);gap:8px;width:184px;"></div>
            </div>
            <div style="min-width:150px;">
              <div class="label">HISTORY (${attempts} tries)</div>
              <div id="hist" style="display:flex;flex-direction:column;gap:6px;font-family:var(--mono);font-size:14px;"></div>
            </div>`;
        api.board.appendChild(box);
        const entryEl = box.querySelector('#entry');
        const padEl = box.querySelector('#pad');
        const histEl = box.querySelector('#hist');

        function renderEntry() {
            entryEl.innerHTML = '';
            for (let i = 0; i < len; i++) {
                const d = document.createElement('div');
                d.style.cssText = `flex:1;height:46px;border:1px solid var(--line);border-radius:6px;
                    display:grid;place-items:center;font-size:22px;font-family:var(--mono);
                    color:var(--accent);${guess[i] !== undefined ? 'border-color:var(--accent);' : ''}`;
                d.textContent = guess[i] !== undefined ? guess[i] : '·';
                entryEl.appendChild(d);
            }
        }
        const padKeys = [1,2,3,4,5,6,7,8,9,'⌫',0,'✓'];
        padKeys.forEach((k) => {
            const b = document.createElement('button');
            b.className = 'btn'; b.textContent = k; b.style.cssText = 'padding:12px 0;font-size:18px;min-width:0;';
            b.onclick = () => press(k);
            padEl.appendChild(b);
        });
        function press(k) {
            if (ended) return;
            if (k === '⌫') { guess.pop(); renderEntry(); return; }
            if (k === '✓') { submit(); return; }
            if (guess.length < len) { guess.push(k); renderEntry(); }
            api.sfx('click');
        }
        function submit() {
            if (guess.length < len) { api.shake(); return; }
            const exact = guess.filter((d, i) => d === code[i]).length;
            const codeCount = {}, guessCount = {};
            code.forEach((d, i) => { if (guess[i] !== d) codeCount[d] = (codeCount[d] || 0) + 1; });
            guess.forEach((d, i) => { if (code[i] !== d) guessCount[d] = (guessCount[d] || 0) + 1; });
            let partial = 0;
            Object.keys(guessCount).forEach((d) => { partial += Math.min(guessCount[d], codeCount[d] || 0); });

            const row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;gap:10px;padding:4px 8px;border:1px solid var(--line);border-radius:5px;';
            row.innerHTML = `<span>${guess.join(' ')}</span>
                <span>${'●'.repeat(exact)}<span style="color:var(--muted);">${'○'.repeat(partial)}</span></span>`;
            histEl.appendChild(row);

            tries++;
            if (exact === len) { ended = true; api.stopTimer(); api.setTag('UNLOCKED'); setTimeout(() => api.succeed(), 300); return; }
            if (tries >= attempts) { ended = true; api.shake(); api.stopTimer(); revealCode(); setTimeout(() => api.fail(), 600); return; }
            guess = []; renderEntry();
            api.setTag('TRY ' + (tries + 1) + '/' + attempts);
        }
        function revealCode() {
            const row = document.createElement('div');
            row.style.cssText = 'color:var(--danger);font-size:12px;margin-top:4px;';
            row.textContent = 'CODE: ' + code.join(' ');
            histEl.appendChild(row);
        }

        api.setTag('TRY 1/' + attempts);
        api.startTimer(Math.max(25, 60 - diff * 5), () => { if (!ended) api.fail(); });
        renderEntry();
        return { destroy() {} };
    }
});
