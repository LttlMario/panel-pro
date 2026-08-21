MG.register('cuttheright', {
    title: 'Cut The Right One',
    hint: 'Read the clue · cut the correct wire',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const count = Math.min(7, 3 + diff);
        const palette = [
            { n: 'RED', c: '#ff4d6d' }, { n: 'BLUE', c: '#5b8cff' },
            { n: 'GREEN', c: '#39d98a' }, { n: 'YELLOW', c: '#ffd23f' },
            { n: 'WHITE', c: '#e8edf2' }, { n: 'PURPLE', c: '#c06bff' },
            { n: 'ORANGE', c: '#ff8a00' }
        ];
        const wires = palette.slice(0, count).sort(() => Math.random() - 0.5);

        const idx = api.randInt(0, count - 1);
        const target = wires[idx];
        const clues = [
            `Cut the ${target.n} wire.`,
            `The safe wire is position #${idx + 1} from the top.`,
            `Cut the wire that is NOT adjacent to any wire of its own color — cut ${target.n}.`,
            `Serial ends odd → cut the ${target.n} wire.`,
            `Disarm code maps to ${target.n}.`
        ];
        const clue = clues[api.randInt(0, Math.min(clues.length - 1, diff))];

        const box = document.createElement('div');
        box.style.cssText = 'width:480px;display:flex;flex-direction:column;gap:16px;';
        box.innerHTML = `
            <div style="padding:12px 14px;border:1px solid var(--danger);border-radius:8px;
                        background:rgba(255,59,92,0.07);">
                <div class="label" style="color:var(--danger);">DEFUSAL CLUE</div>
                <div style="font-family:var(--display);font-size:15px;">${clue}</div>
            </div>
            <div id="wires" style="display:flex;flex-direction:column;gap:10px;"></div>`;
        api.board.appendChild(box);
        const wbox = box.querySelector('#wires');

        let dead = false;
        wires.forEach((w, i) => {
            const row = document.createElement('div');
            row.style.cssText = `display:flex;align-items:center;gap:12px;cursor:pointer;`;
            row.innerHTML = `
                <span style="width:22px;text-align:right;color:var(--muted);font-size:12px;">${i + 1}</span>
                <div class="wire" style="flex:1;height:14px;border-radius:7px;
                     background:${w.c};box-shadow:0 0 12px ${w.c};transition:all .2s;"></div>
                <span style="width:60px;font-size:11px;color:var(--muted);">${w.n}</span>`;
            row.addEventListener('click', () => {
                if (dead) return;
                if (w === target) {
                    dead = true;
                    row.querySelector('.wire').style.opacity = '0.25';
                    api.stopTimer();
                    setTimeout(() => api.succeed(), 250);
                } else {
                    dead = true;
                    api.shake();
                    api.stopTimer();
                    setTimeout(() => api.fail(), 200);
                }
            });
            wbox.appendChild(row);
        });

        api.setTag('ARMED');
        api.startTimer(Math.max(8, 18 - diff * 2), () => api.fail());
        return { __allowCancel: api.cfg.allowCancel, destroy() {} };
    }
});
