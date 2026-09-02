(() => {
    'use strict';

    const games = [
        ['skillcheck', 'Skill Check', 'Essentials', 'Markerul trebuie oprit în zona sigură.'],
        ['lockpick', 'Lockpick', 'Essentials', 'Rotește șperaclul până găsești punctele sensibile.'],
        ['keypad', 'Keypad', 'Essentials', 'Deduci PIN-ul ascuns după feedback-ul combinațiilor.'],
        ['quicktime', 'Quicktime', 'Essentials', 'Apasă secvența de taste înainte să expire timpul.'],
        ['mash', 'Mash', 'Essentials', 'Apasă rapid SPACE pentru a umple bara.'],
        ['reaction', 'Reaction', 'Essentials', 'Așteaptă semnalul verde și reacționează instant.'],
        ['stacker', 'Stacker', 'Essentials', 'Lasă blocurile să cadă pentru a construi turnul.'],
        ['targets', 'Targets', 'Essentials', 'Lovește țintele corecte și evită decoy-urile roșii.'],
        ['livewire', 'Live Wire', 'Core', 'Unește firele colorate pentru a închide circuitul.'],
        ['flatline', 'Flatline', 'Core', 'Menține ritmul corect pentru defibrilator.'],
        ['deadcalm', 'Dead Calm', 'Core', 'Controlează respirația și țintește fără să tremuri.'],
        ['ghostsignal', 'Ghost Signal', 'Core', 'Reglează frecvența și faza până găsești semnalul.'],
        ['steadydose', 'Steady Dose', 'Core', 'Ține acul în banda mobilă cu mouse-ul.'],
        ['cuttheright', 'Cut The Right One', 'Core', 'Citește indiciul și taie firul corect.'],
        ['vaultspin', 'Vault Spin', 'Core', 'Potrivește combinația pe cadranul analogic.'],
        ['bluff', 'Bluff', 'Core', 'Citește indiciile NPC-ului și alege call sau fold.'],
        ['decrypt', 'Decrypt', 'Core', 'Tastează token-urile de cod înainte să dispară.'],
        ['gaslight', 'Gaslight', 'Core', 'Memorează rapid secvența de lumini și reconstituie-o.'],
        ['overflow', 'Overflow', 'Advanced', 'Rotește segmentele pentru a conecta sursa la evacuare.'],
        ['breachmatrix', 'Breach Matrix', 'Advanced', 'Injectează secvența corectă în matricea de hack.'],
        ['daemonrun', 'Daemon Run', 'Advanced', 'Fură datele prin labirint în timp ce eviți trace-ul.'],
        ['pulse', 'Pulse', 'Advanced', 'Lovește notele pe cele patru culoare ritmice.'],
        ['hottrace', 'Hot Trace', 'Advanced', 'Trasează sonda prin coridor fără să atingi pereții.'],
        ['cascade', 'Cascade', 'Advanced', 'Repetă tiparul Simon-Says care devine tot mai lung.'],
        ['lightsout', 'Lights Out', 'Advanced', 'Stinge toate luminile apăsând celulele potrivite.'],
        ['slidepuzzle', 'Slide Puzzle', 'Advanced', 'Rearanjează piesele în ordinea corectă.'],
        ['resonance', 'Resonance', 'AAA Inspired', 'Reglează unda până se suprapune peste țintă.'],
        ['intrusion', 'Intrusion', 'AAA Inspired', 'Sari prin noduri și evită punctele monitorizate.'],
        ['override', 'Override', 'AAA Inspired', 'Blochează inelele concentrice înainte de corupție.'],
        ['animus', 'Animus', 'AAA Inspired', 'Aliniază segmentele tuturor inelelor pe aceeași rază.'],
        ['eaglevision', 'Eagle Vision', 'AAA Inspired', 'Memorează semnătura și găsește toate potrivirile.'],
        ['parry', 'Deflect', 'AAA Inspired', 'Parează atacurile în fereastra corectă de timing.'],
        ['constellation', 'Stargazing', 'AAA Inspired', 'Unește stelele numerotate pentru a recrea constelația.'],
        ['archery', 'Longshot', 'AAA Inspired', 'Ajustează traiectoria pentru a lovi ținta.'],
        ['fishing', 'Fishing', 'Jobs', 'Așteaptă mușcătura și ține peștele în zona de control.'],
        ['mining', 'Mining', 'Jobs', 'Lovește fisura strălucitoare înainte să dispară.'],
        ['cooking', 'Cooking', 'Jobs', 'Completează fiecare etapă de timing în zona verde.'],
        ['welding', 'Welding', 'Jobs', 'Ghidează torța pe îmbinare fără supraîncălzire.'],
        ['harvest', 'Harvest', 'Jobs', 'Taie recolta exact când trece prin linia de timing.'],
        ['drilling', 'Drilling', 'Jobs', 'Menține presiunea burghiului în zona sigură.'],
        ['locksmith', 'Locksmith', 'Jobs', 'Ridică fiecare pin până la linia de forfecare.'],
        ['hotwire', 'Hotwire', 'Jobs', 'Conectează firele și sincronizează scânteia.'],
        ['crafting', 'Crafting', 'Jobs', 'Memorează rețeta și adaugă ingredientele în ordine.'],
        ['lugnuts', 'Lug Nuts', 'Jobs', 'Strânge piulițele în ordine și oprește acul în verde.'],
        ['paintspray', 'Paint Booth', 'Jobs', 'Acoperă panoul uniform fără să provoci scurgeri.'],
        ['crane', 'Cargo Crane', 'Jobs', 'Controlează pendulul și lasă lăzile pe camion.'],
        ['forge', 'Blacksmith', 'Jobs', 'Lovește metalul în fereastra corectă de temperatură.'],
        ['diving', 'Salvage Dive', 'Jobs', 'Recuperează prada și revino la suprafață la timp.'],
        ['partsort', 'Parts Sort', 'Mechanic', 'Trimite fiecare piesă în recipientul potrivit.'],
        ['toolbox', 'Tool Board', 'Mechanic', 'Așază fiecare unealtă pe conturul ei.'],
        ['packing', 'Crate Packing', 'Mechanic', 'Potrivește toate piesele în ladă ca într-un puzzle.'],
        ['beltsort', 'Quality Control', 'Mechanic', 'Scoate piesele defecte și lasă-le pe cele bune.'],
        ['tripwire', 'Tripwire', 'Crime', 'Treci printre lasere până la ieșire fără să fii prins.'],
        ['pickpocket', 'Pickpocket', 'Crime', 'Fură discret și eliberează înainte să te privească ținta.'],
        ['getaway', 'Getaway', 'Crime', 'Schimbă benzile și supraviețuiește urmăririi.'],
        ['cashcount', 'Count The Take', 'Crime', 'Numără bancnotele până ajungi la suma exactă.'],
        ['counterfeit', 'Counterfeit', 'Crime', 'Aliniază placa și imprimă fără să o deplasezi.'],
        ['chopshop', 'Chop Shop', 'Crime', 'Demontează piesele mașinii înainte să crească nivelul de heat.'],
        ['suture', 'Suture', 'Medical', 'Apasă fiecare cusătură când inelul intră în zona verde.'],
        ['bonepin', 'Bone Set', 'Medical', 'Potrivește fragmentele fracturate în sloturile corecte.'],
        ['vitals', 'Vitals', 'Medical', 'Menține cele trei valori vitale în limitele sigure.'],
        ['fingerprint', 'Fingerprint', 'Police', 'Găsește amprenta cu aceeași orientare ca scanarea.'],
        ['breathalyzer', 'Breathalyzer', 'Police', 'Ține fluxul de aer în zona verde pentru citire.'],
        ['titration', 'Titration', 'Drugs & Chemistry', 'Toarnă reactivul și oprește-te exact în banda țintă.'],
        ['pillpress', 'Pill Press', 'Drugs & Chemistry', 'Sincronizează fiecare apăsare pentru o pastilă curată.'],
        ['thermite', 'Thermite', 'Heist', 'Memorează celulele aprinse și arde aceeași secvență.'],
        ['lasergrid', 'Laser Grid', 'Heist', 'Ghidează cursorul până la ieșire fără să atingi laserul.'],
        ['vaultdrill', 'Vault Drill', 'Heist', 'Oprește fiecare punct de forare în nucleul verde.'],
        ['jammer', 'Signal Jammer', 'Heist', 'Blochează fiecare canal exact când bara atinge vârful.'],
        ['dataheist', 'Data Heist', 'Heist', 'Prinde pachetele curate și evită datele corupte.']
    ].map(([id, title, category, description]) => ({ id, title, category, description }));

    const categories = ['Toate', ...new Set(games.map(game => game.category))];
    const state = { query: '', category: 'Toate', difficulty: 2, sound: true };
    const $ = (id) => document.getElementById(id);

    function escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[character]));
    }

    function renderCategories() {
        const host = $('minigames-category-list');
        if (!host) return;
        host.innerHTML = categories.map(category => `<button type="button" class="mg-filter ${state.category === category ? 'is-active' : ''}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
    }

    function renderGames() {
        const query = state.query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro-RO');
        const visible = games.filter(game => {
            const matchesCategory = state.category === 'Toate' || game.category === state.category;
            const haystack = `${game.title} ${game.id} ${game.category} ${game.description}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro-RO');
            return matchesCategory && (!query || haystack.includes(query));
        });
        const grid = $('minigames-grid');
        if (!grid) return;
        grid.innerHTML = visible.length ? visible.map((game, index) => `
            <article class="mg-card" data-searchable data-game-card data-game-id="${escapeHtml(game.id)}">
                <div class="mg-card-top"><span class="mg-index">${String(index + 1).padStart(2, '0')}</span><span class="mg-category">${escapeHtml(game.category)}</span></div>
                <h3>${escapeHtml(game.title)}</h3>
                <p>${escapeHtml(game.description)}</p>
                <div class="mg-card-bottom"><code>${escapeHtml(game.id)}</code><button type="button" class="mg-play" data-game-launch="${escapeHtml(game.id)}">Pornește <span>↗</span></button></div>
            </article>
        `).join('') : '<div class="mg-empty"><span>⌁</span><h3>Niciun minigame găsit</h3><p>Încearcă un alt termen sau resetează filtrele.</p></div>';
        $('minigames-visible-count').textContent = `${visible.length} afișate`;
        $('minigames-total-count').textContent = `${games.length} jocuri disponibile`;
    }

    function launchGame(id) {
        const game = games.find(item => item.id === id);
        if (!game || !window.MG?.open || !window.MG.games?.[id]) return;
        window.MG.open({ game: id, difficulty: state.difficulty, allowCancel: true, sound: state.sound, volume: 0.55 });
        const current = $('minigames-current-game');
        if (current) current.textContent = `${game.title} · dificultate ${state.difficulty}`;
    }

    function bind() {
        $('minigames-search')?.addEventListener('input', (event) => { state.query = event.target.value; renderGames(); });
        $('minigames-clear')?.addEventListener('click', () => { state.query = ''; state.category = 'Toate'; $('minigames-search').value = ''; renderCategories(); renderGames(); });
        $('minigames-category-list')?.addEventListener('click', (event) => { const button = event.target.closest('[data-category]'); if (!button) return; state.category = button.dataset.category; renderCategories(); renderGames(); });
        $('minigames-grid')?.addEventListener('click', (event) => { const button = event.target.closest('[data-game-launch]'); if (button) launchGame(button.dataset.gameLaunch); });
        $('minigames-difficulty')?.addEventListener('input', (event) => { state.difficulty = Number(event.target.value); $('minigames-difficulty-value').textContent = `Nivel ${state.difficulty}`; });
        $('minigames-sound')?.addEventListener('click', (event) => { state.sound = !state.sound; event.currentTarget.classList.toggle('is-off', !state.sound); event.currentTarget.querySelector('span').textContent = state.sound ? 'Sunet activ' : 'Sunet oprit'; });
    }

    document.addEventListener('DOMContentLoaded', () => { renderCategories(); renderGames(); bind(); });
})();
