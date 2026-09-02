MG.register('breachmatrix', {
    title: 'Breach Matrix',
    hint: 'Pick codes (row, then column, then row…) to match the sequence',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const N = 4 + Math.floor(diff / 2);
        const seqLen = 2 + Math.floor(diff / 1.5);
        const bufLen = seqLen + 2;
        const CODES = ['1C', '55', 'BD', 'E9', '7A', 'FF'];

        const matrix = [];
        for (let r = 0; r < N; r++) {
            matrix[r] = [];
            for (let c = 0; c < N; c++) matrix[r][c] = CODES[api.randInt(0, CODES.length - 1)];
        }
        const path = [];
        let mode = 'row', fixed = 0, used = new Set();
        let rr = 0, cc;
        for (let i = 0; i < seqLen; i++) {
            if (mode === 'row') {
                let col; let guard = 0;
                do { col = api.randInt(0, N - 1); guard++; } while (used.has('r' + fixed + 'c' + col) && guard < 20);
                used.add('r' + fixed + 'c' + col);
                path.push(matrix[fixed][col]); cc = col; mode = 'col';
            } else {
                let row; let guard = 0;
                do { row = api.randInt(0, N - 1); guard++; } while (used.has('r' + row + 'c' + cc) && guard < 20);
                used.add('r' + row + 'c' + cc);
                path.push(matrix[row][cc]); fixed = row; mode = 'row';
            }
        }
        const target = path.slice();

        const buffer = [];
        let selMode = 'row', lockRow = 0, lockCol = null, finished = false;

        const box = document.createElement('div');
        box.style.cssText = 'display:flex;gap:26px;align-items:flex-start;';
        box.innerHTML = `
            <div>
              <div class="label">CODE MATRIX</div>
              <div id="mx" style="display:grid;grid-template-columns:repeat(${N},1fr);gap:6px;"></div>
            </div>
            <div style="min-width:150px;">
              <div class="label">SEQUENCE REQUIRED</div>
              <div id="seq" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;"></div>
              <div class="label">BUFFER</div>
              <div id="buf" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
            </div>`;
        api.board.appendChild(box);
        const mxEl = box.querySelector('#mx');
        const seqEl = box.querySelector('#seq');
        const bufEl = box.querySelector('#buf');

        const chip = (txt, cls) => `<span class="bm-chip ${cls || ''}" style="
            font-family:var(--mono);font-size:13px;padding:6px 9px;border-radius:5px;
            border:1px solid var(--line);min-width:30px;text-align:center;">${txt}</span>`;

        function renderSeq() {
            seqEl.innerHTML = target.map((t, i) =>
                chip(t, i < matchedLen() ? 'ok' : '')).join('');
            seqEl.querySelectorAll('.ok').forEach(e => {
                e.style.borderColor = 'var(--success)'; e.style.color = 'var(--success)';
            });
        }
        function matchedLen() {
            let best = 0;
            for (let start = 0; start < buffer.length; start++) {
                let k = 0;
                while (start + k < buffer.length && k < target.length && buffer[start + k] === target[k]) k++;
                if (k > best) best = k;
                if (best === target.length) break;
            }
            return best;
        }
        function renderBuf() {
            bufEl.innerHTML = '';
            for (let i = 0; i < bufLen; i++) {
                bufEl.innerHTML += chip(buffer[i] || '·', buffer[i] ? 'filled' : '');
            }
            bufEl.querySelectorAll('.filled').forEach(e => {
                e.style.borderColor = 'var(--accent)'; e.style.color = 'var(--accent)';
            });
        }
        function renderMx() {
            mxEl.innerHTML = '';
            for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
                const active = (selMode === 'row' && r === lockRow) ||
                               (selMode === 'col' && c === lockCol);
                const cellEl = document.createElement('button');
                cellEl.className = 'btn';
                cellEl.textContent = matrix[r][c];
                cellEl.style.cssText = `padding:8px;font-size:13px;min-width:0;
                    opacity:${active ? 1 : 0.3};
                    border-color:${active ? 'var(--accent)' : 'var(--line)'};
                    cursor:${active ? 'pointer' : 'not-allowed'};`;
                cellEl.onclick = () => pick(r, c, active);
                mxEl.appendChild(cellEl);
            }
        }
        function pick(r, c, active) {
            if (finished || !active) return;
            buffer.push(matrix[r][c]);
            if (selMode === 'row') { lockCol = c; selMode = 'col'; }
            else { lockRow = r; selMode = 'row'; }
            renderMx(); renderBuf(); renderSeq();
            if (matchedLen() >= target.length) {
                finished = true; api.stopTimer(); api.setTag('BREACHED');
                setTimeout(() => api.succeed(), 350);
            } else if (buffer.length >= bufLen) {
                finished = true; api.shake(); api.stopTimer();
                setTimeout(() => api.fail(), 300);
            }
        }

        api.setTag('INJECTING');
        api.startTimer(Math.max(15, 35 - diff * 3), () => { if (!finished) api.fail(); });
        renderMx(); renderBuf(); renderSeq();
        return { destroy() {} };
    }
});
