MG.register('crafting', {
    title: 'Crafting',
    hint: 'Add ingredients in the shown order',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const seqLen = 3 + Math.floor(diff / 1.2);
        const slots = Math.min(8, 4 + diff);
        const ICONS = ['\u2697\ufe0f','\ud83e\uddea','\ud83d\udd25','\u2744\ufe0f','\u26a1','\ud83c\udf3f','\ud83d\udca7','\u2728'];
        const palette = ICONS.slice(0, slots);
        const recipe = Array.from({ length: seqLen }, () => api.randInt(0, slots - 1));

        let step = 0, ended = false, showing = true;
        api.setDots(seqLen);

        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;gap:16px;align-items:center;width:460px;';
        box.innerHTML = `
            <div class="label" id="lbl">RECIPE \u2014 MEMORIZE</div>
            <div id="recipe" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;min-height:48px;"></div>
            <div id="station" style="display:grid;grid-template-columns:repeat(${Math.ceil(slots / 2)},1fr);gap:10px;"></div>`;
        api.board.appendChild(box);
        const recipeEl = box.querySelector('#recipe');
        const stationEl = box.querySelector('#station');
        const lbl = box.querySelector('#lbl');

        function renderRecipe(reveal) {
            recipeEl.innerHTML = '';
            recipe.forEach((r, i) => {
                const d = document.createElement('div');
                const show = reveal || i < step;
                d.style.cssText = `width:40px;height:40px;border-radius:8px;display:grid;place-items:center;font-size:22px;
                    border:2px solid ${i === step && !reveal ? 'var(--accent)' : 'var(--line)'};
                    ${i < step ? 'border-color:var(--success);' : ''}`;
                d.textContent = show ? palette[r] : '?';
                recipeEl.appendChild(d);
            });
        }
        palette.forEach((ic, idx) => {
            const b = document.createElement('button');
            b.className = 'btn'; b.textContent = ic; b.style.cssText = 'font-size:24px;padding:10px;min-width:0;';
            b.onclick = () => pick(idx);
            stationEl.appendChild(b);
        });
        function pick(idx) {
            if (ended || showing) return;
            if (idx === recipe[step]) {
                step++; api.sfx('step');
                api.setDots(seqLen, Array.from({ length: seqLen }, (_, i) => i < step ? 'done' : ''));
                renderRecipe(false);
                if (step >= seqLen) { finish(true); }
            } else { api.shake(); finish(false); }
        }
        function finish(ok) { if (ended) return; ended = true; api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 300); }

        renderRecipe(true);
        api.setTag('MEMORIZE');
        const showMs = Math.max(1400, 2600 - diff * 240);
        setTimeout(() => {
            if (ended) return;
            showing = false; lbl.textContent = 'CRAFT \u2014 FOLLOW THE ORDER';
            api.setTag('CRAFT');
            renderRecipe(false);
            api.startTimer(Math.max(10, 20 - diff), () => finish(false));
        }, showMs);

        return { destroy() {} };
    }
});
