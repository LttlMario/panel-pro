// Motor comun pentru pagina Asistent și widgetul plutitor.
// Rulează exclusiv în browser și nu trimite întrebările către servicii externe.
(() => {
    'use strict';
    if (window.PanelAssistantCore) return;

    const CACHE_VERSION = '3';
    const CACHE_TTL_MS = 30 * 60 * 1000;
    const STOP_WORDS = new Set(['a', 'ai', 'al', 'ale', 'am', 'ar', 'are', 'as', 'asta', 'ca', 'care', 'ce', 'cea', 'cel', 'cu', 'cum', 'de', 'din', 'doar', 'este', 'eu', 'fi', 'in', 'la', 'mai', 'ma', 'mi', 'o', 'pe', 'pentru', 'pot', 'sa', 'se', 'si', 'sunt', 'un', 'una', 'unde', 'vreau']);
    const SYNONYMS = {
        pontare: 'pontaj', pontat: 'pontaj', tura: 'pontaj', ture: 'pontaj', serviciu: 'pontaj',
        absenta: 'invoire', concediu: 'invoire', cerere: 'invoire', indisponibil: 'invoire',
        reteta: 'craft', fabricare: 'craft', confectionare: 'craft', roata: 'roti', anvelopa: 'roti',
        piata: 'marketplace', anunturi: 'anunt', vanzari: 'vanzare',
        harta: 'locatii', locatie: 'locatii', ilegal: 'ilegal',
        sef: 'manager', coordonator: 'manager', administrare: 'admin',
        jurnal: 'loguri', activitate: 'loguri', istoric: 'rapoarte'
    };

    function normalize(value) {
        return String(value || '')
            .toLocaleLowerCase('ro-RO')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function tokens(value) {
        return normalize(value)
            .split(' ')
            .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
            .map((word) => SYNONYMS[word] || word);
    }

    function bigrams(value) {
        const text = normalize(value).replace(/\s/g, '');
        const result = [];
        for (let index = 0; index < text.length - 1; index += 1) result.push(text.slice(index, index + 2));
        return result;
    }

    function similarity(left, right) {
        if (left === right) return 1;
        if (!left || !right) return 0;
        const first = bigrams(left);
        const second = bigrams(right);
        if (!first.length || !second.length) return 0;
        const pool = [...second];
        let matches = 0;
        first.forEach((pair) => {
            const index = pool.indexOf(pair);
            if (index >= 0) {
                matches += 1;
                pool.splice(index, 1);
            }
        });
        return (2 * matches) / (first.length + second.length);
    }

    function pagePermissions() {
        try {
            return typeof PagePermissions === 'object' && PagePermissions ? PagePermissions : {};
        } catch (_error) {
            return {};
        }
    }

    function currentUser() {
        try {
            return typeof getUser === 'function' ? getUser() : null;
        } catch (_error) {
            return null;
        }
    }

    function currentRole() {
        try {
            return typeof getRole === 'function' ? Number(getRole()) || 0 : 0;
        } catch (_error) {
            return 0;
        }
    }

    function selectedPages() {
        const pages = currentUser()?.allowed_pages;
        return Array.isArray(pages) ? pages : [];
    }

    function assistantPages() {
        const user = currentUser();
        if (user?.assistant_permissions_configured === true) {
            return Array.isArray(user.assistant_allowed_pages)
                ? user.assistant_allowed_pages.map(String)
                : [];
        }
        // Compatibilitate pentru organizații care nu au salvat încă selectorul robotului.
        // Robotul moștenește accesul normal, dar nu primește niciodată pagini administrative.
        return selectedPages().filter((page) => ![
            'admin.html', 'logs.html', 'diagnostic.html', 'discord-configurare.html',
            'organizatii.html', 'vouchere.html', 'developer.html', 'administrare-organizatie.html'
        ].includes(page));
    }

    function create(options = {}) {
        const role = currentRole();
        const user = currentUser();
        if (!user || (role < 1 && selectedPages().length === 0)) return null;

        const permissions = pagePermissions();
        const entries = [];
        let lastMatch = null;
        let indexPromise = null;
        const cacheKey = `panel_assistant_index_v${CACHE_VERSION}_role_${role}`;

        function roleName() {
            const active = typeof getActiveOrganization === 'function' ? getActiveOrganization() : null;
            const candidates = [
                user.discord_role_name,
                user.discord_role,
                user.role_name,
                user.panel_role,
                active?.discord_role_name,
                active?.panel_role,
                user.role,
                user.default_role
            ];
            return candidates.map(value => String(value || '').trim())
                .find(value => value && !/^\d+$/.test(value) && !/^(?:level|nivel)\b/i.test(value)) || 'Rol Discord';
        }

        function requiredRoleForPage(page) {
            if (!page) return 1;
            const file = String(page).split('?')[0].split('#')[0].split('/').pop();
            const required = Number(permissions[file]);
            if (Number.isFinite(required)) return required;
            const manifestItem = (window.PANEL_ASSISTANT_PAGES || []).find((item) => item.file === file);
            return Number(manifestItem?.role || 1);
        }

        function isPageAllowed(page) {
            if (!page || /^\s*(?:javascript:|data:|https?:|\/\/)/i.test(String(page))) return false;
            const file = String(page).split('?')[0].split('#')[0].split('/').pop();
            return assistantPages().includes(file) && (selectedPages().includes(file) || isPlatformAdmin());
        }

        function searchableText(entry) {
            return normalize([entry.title, entry.category, ...(entry.keywords || []), entry.answer].join(' '));
        }

        function scoreEntry(entry, question) {
            const query = normalize(question);
            const queryTokens = tokens(question);
            const source = searchableText(entry);
            const title = normalize(entry.title);
            let score = 0;

            if (title === query) score += 120;
            if (query.length > 3 && source.includes(query)) score += 65;
            if (query.length > 3 && title.includes(query)) score += 35;

            const sourceWords = source.split(' ');
            queryTokens.forEach((token) => {
                if (sourceWords.includes(token)) score += 12;
                else if (sourceWords.some((word) => word.startsWith(token) || token.startsWith(word))) score += 7;
                else {
                    const best = sourceWords.reduce((maximum, word) => Math.max(maximum, similarity(token, word)), 0);
                    if (best >= 0.72) score += 4;
                }
            });

            const keywordMatches = (entry.keywords || []).filter((keyword) => {
                const clean = normalize(keyword);
                return clean && (query.includes(clean) || clean.includes(query));
            }).length;
            return score + (keywordMatches * 18);
        }

        function addEntry(entry, source = 'curated') {
            if (!entry?.title || !entry?.answer || Number(entry.role || 1) > role) return false;
            if (entry.page && !isPageAllowed(entry.page)) return false;
            const signature = `${normalize(entry.title)}|${entry.page || ''}`;
            if (entries.some((item) => item.signature === signature)) return false;
            entries.push({ ...entry, source, signature, role: Number(entry.role || 1) });
            return true;
        }

        (window.PANEL_ASSISTANT_KNOWLEDGE || []).forEach((entry) => addEntry(entry));

        function restoreCachedIndex() {
            try {
                const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
                if (!cached || cached.version !== CACHE_VERSION || Date.now() - cached.savedAt > CACHE_TTL_MS || !Array.isArray(cached.entries)) return false;
                cached.entries.forEach((entry) => addEntry(entry, 'page'));
                return true;
            } catch (_error) {
                return false;
            }
        }

        function saveIndexCache() {
            try {
                const indexed = entries
                    .filter((entry) => entry.source === 'page')
                    .slice(0, 500)
                    .map(({ title, category, role: entryRole, page, keywords, answer }) => ({ title, category, role: entryRole, page, keywords, answer }));
                sessionStorage.setItem(cacheKey, JSON.stringify({ version: CACHE_VERSION, savedAt: Date.now(), entries: indexed }));
            } catch (_error) {
                // Asistentul funcționează și când stocarea browserului este indisponibilă.
            }
        }

        function elementAllowed(element) {
            const guarded = element.closest('[data-role]');
            if (!guarded) return true;
            const required = Number.parseInt(guarded.getAttribute('data-role'), 10);
            return Number.isNaN(required) || required <= role;
        }

        async function indexPage(page) {
            const required = requiredRoleForPage(page.file);
            if (required > role) return;
            const response = await fetch(page.file, { cache: 'no-store' });
            if (!response.ok) return;
            const markup = await response.text();
            const documentCopy = new DOMParser().parseFromString(markup, 'text/html');

            documentCopy.querySelectorAll('[data-title]').forEach((element) => {
                if (!elementAllowed(element)) return;
                const title = String(element.dataset.title || '').replace(/\s+/g, ' ').trim();
                const description = String(element.dataset.desc || '').replace(/\s+/g, ' ').trim();
                if (title.length < 2 || title.length > 120) return;
                addEntry({
                    title,
                    category: page.label,
                    role: required,
                    page: page.file === 'craftmecanics.html' ? `${page.file}?search=${encodeURIComponent(title)}` : page.file,
                    keywords: [title, description, page.label],
                    answer: description ? `${title}: ${description}` : `${title} este disponibil în pagina ${page.label}.`
                }, 'page');
            });

            const seenSections = new Set();
            documentCopy.querySelectorAll('main h1, main h2, main h3, main h4, body > header h1, body > header h2').forEach((element) => {
                if (!elementAllowed(element)) return;
                const title = String(element.textContent || '').replace(/\s+/g, ' ').trim();
                const clean = normalize(title);
                if (title.length < 3 || title.length > 100 || clean === 'panel' || seenSections.has(clean)) return;
                seenSections.add(clean);
                addEntry({
                    title,
                    category: page.label,
                    role: required,
                    page: page.file,
                    keywords: [title, page.label],
                    answer: `În pagina ${page.label} găsești secțiunea „${title}”.`
                }, 'page');
            });

            documentCopy.querySelectorAll('option').forEach((option) => {
                if (!elementAllowed(option)) return;
                const title = String(option.textContent || '').replace(/\s+/g, ' ').trim();
                if (title.length < 3 || title.length > 70 || /^--/.test(title)) return;
                addEntry({
                    title,
                    category: page.label,
                    role: required,
                    page: page.file,
                    keywords: [title, page.label],
                    answer: `Opțiunea „${title}” este disponibilă în pagina ${page.label}.`
                }, 'page');
            });
        }

        function indexLocalPages() {
            if (indexPromise) return indexPromise;
            if (restoreCachedIndex()) {
                options.onIndexUpdate?.(entries.length, true);
                return Promise.resolve(entries.length);
            }

            const pages = (window.PANEL_ASSISTANT_PAGES || []).filter((page) => requiredRoleForPage(page.file) <= role);
            indexPromise = Promise.allSettled(pages.map(indexPage)).then(() => {
                saveIndexCache();
                options.onIndexUpdate?.(entries.length, false);
                return entries.length;
            });
            return indexPromise;
        }

        function specialResponse(question) {
            const query = normalize(question);
            const restrictedTopics = [
                { role: 7, pattern: /\b(panou admin|admin|schimb rol|modific rol|rol utilizator|utilizator din panou|schimb ora|configurez ora|oprire toate turele|opresc toate turele|sterge utilizator|loguri|jurnal activitate)\b/ },
                { role: 4, pattern: /\b(rapoarte|mecanici activi|cine este pontaj|cine e pontaj|opresc tura cuiva|opresc tura altuia|editez pontaj|modific pontajul altuia|sterg pontaj|contracte|generez contract)\b/ },
                { role: 3, pattern: /\b(calculator ilegal|locatii ilegale|black market|piata neagra|cocaina|marijuana|jointuri|acetona|cayo)\b/ }
            ];
            const blockedTopic = restrictedTopics.find((topic) => role < topic.role && topic.pattern.test(query));
            if (blockedTopic) return { answer: 'Nu ai permisiunea necesară pentru această secțiune. Asistentul îți poate arăta doar informațiile disponibile rolului tău.' };
            if (/^(salut|buna|buna ziua|buna seara|neata|hey|hello)\b/.test(query)) return { answer: `Salut! Sunt asistentul intern al panelului. Ai acces de tip „${roleName()}”. Cu ce informație din proiect te pot ajuta?` };
            if (/\b(multumesc|mersi|ms|super|perfect)\b/.test(query)) return { answer: 'Cu plăcere! Poți continua cu orice întrebare despre paginile și funcțiile panelului.' };
            if (/\b(ce rol|rolul meu|ce functie|functia mea)\b/.test(query)) return { answer: `Rolul disponibil în sesiunea ta este „${roleName()}”, cu nivel de acces ${role}. Rezultatele sunt filtrate după acest nivel.` };
            if (/^(cat e ceasul|cat este ceasul|cat e ora|ce ora este|ce ora e|ora acum)$/.test(query)) return { answer: `Ora României este ${new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit' }).format(new Date())}.` };
            if (/^(unde|deschide|du ma|pagina)$/i.test(query) && lastMatch?.page) return { answer: `Informația anterioară se află în ${lastMatch.category || lastMatch.title}.`, page: lastMatch.page, title: lastMatch.title };
            return null;
        }

        function answer(question) {
            const cleanQuestion = String(question || '').trim().slice(0, 500);
            if (!cleanQuestion) return { answer: 'Scrie o întrebare despre panel și încerc să găsesc informația potrivită.' };
            const special = specialResponse(cleanQuestion);
            if (special) return special;

            const ranked = entries
                .map((entry) => ({ entry, score: scoreEntry(entry, cleanQuestion) }))
                .sort((left, right) => right.score - left.score);
            const best = ranked[0];
            if (!best || best.score < 9) {
                const topics = entries
                    .filter((entry) => ['pontaj', 'invoiri', 'craft', 'marketplace', 'ilegal', 'manager', 'admin'].includes(entry.category))
                    .slice(0, 4)
                    .map((entry) => entry.title)
                    .join(', ');
                return { answer: `Nu am găsit un răspuns exact în informațiile panelului. Încearcă să reformulezi folosind numele paginii sau funcției. Exemple: ${topics || 'Pontaj, învoiri, Craft Mecanics și Marketplace'}.` };
            }

            lastMatch = best.entry;
            const closeMatches = ranked.filter((item, index) => index > 0 && item.score >= best.score - 3 && item.score >= 16).slice(0, 2);
            let response = best.entry.answer;
            if (closeMatches.length && tokens(cleanQuestion).length <= 2) response += ` Am mai găsit: ${closeMatches.map((item) => item.entry.title).join(' și ')}.`;
            return {
                answer: response,
                page: isPageAllowed(best.entry.page) ? best.entry.page : '',
                title: best.entry.title
            };
        }

        return {
            role,
            roleName: roleName(),
            user,
            answer,
            indexLocalPages,
            isPageAllowed,
            getEntryCount: () => entries.length
        };
    }

    window.PanelAssistantCore = Object.freeze({ create });
})();
