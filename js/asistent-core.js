// Motor comun pentru pagina Asistent și widgetul plutitor.
// Rulează exclusiv în browser și nu trimite întrebările către servicii externe.
(() => {
    'use strict';
    if (window.PanelAssistantCore) return;

    const CACHE_VERSION = '15';
    const INDEX_TTL_MS = 120000;
    const STOP_WORDS = new Set(['a', 'ai', 'al', 'ale', 'am', 'ar', 'are', 'as', 'asta', 'ca', 'care', 'ce', 'cea', 'cel', 'cu', 'cum', 'de', 'din', 'doar', 'este', 'eu', 'fi', 'in', 'la', 'mai', 'ma', 'mi', 'o', 'pe', 'pentru', 'pot', 'sa', 'se', 'si', 'sunt', 'un', 'una', 'unde', 'vreau']);
    const SYNONYMS = {
        pontare: 'pontaj', pontat: 'pontaj', tura: 'pontaj', ture: 'pontaj', serviciu: 'pontaj',
        absenta: 'invoire', concediu: 'invoire', cerere: 'invoire', indisponibil: 'invoire',
        reteta: 'craft', fabricare: 'craft', confectionare: 'craft', roata: 'roti', anvelopa: 'roti',
        piata: 'marketplace', anunturi: 'anunt', vanzari: 'vanzare',
        harta: 'locatii', locatie: 'locatii', ilegal: 'ilegal', tec9: 'tec',
        sef: 'manager', coordonator: 'manager', administrare: 'admin',
        jurnal: 'loguri', activitate: 'loguri', istoric: 'rapoarte',
        jucatori: 'playeri', conectare: 'fivem', server: 'fivem', bzone: 'fivem',
        croitorie: 'craft', masa: 'craft', mecanica: 'craft', mecanic: 'craft'
    };

    const WINDOWS1252_BYTES = Object.freeze({
        '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
        'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e,
        '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
        '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f
    });

    function repairText(value) {
        let result = String(value ?? '');
        for (let pass = 0; pass < 2; pass += 1) {
            if (!/(?:Ã.|Â.|Ä[ƒ¤]|Å.|È[™›]|â[€†‡‚„…–—œž]|ð.)/.test(result)) break;
            const bytes = [];
            let canDecode = true;
            for (const character of result) {
                const code = character.charCodeAt(0);
                if (code <= 255) bytes.push(code);
                else if (WINDOWS1252_BYTES[character] !== undefined) bytes.push(WINDOWS1252_BYTES[character]);
                else { canDecode = false; break; }
            }
            if (!canDecode) break;
            const decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
            if (decoded === result || /\uFFFD/.test(decoded)) break;
            result = decoded;
        }
        return result
            .replace(/r\uFFFDspund/gi, 'răspund')
            .replace(/c\uFFFDnd/gi, 'când')
            .replace(/g\uFFFDse/gi, 'găse')
            .replace(/informa\uFFFDii/gi, 'informații')
            .replace(/rolul t\uFFFDu/gi, 'rolul tău')
            .replace(/\uFFFDn/gi, 'în')
            .replace(/\uFFFDi/gi, 'și');
    }

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

    function keywordVariants(values) {
        const list = Array.isArray(values) ? values : [values];
        const variants = new Set();
        list.forEach((value) => {
            const repaired = repairText(value);
            const normalized = normalize(repaired);
            if (normalized.length > 1) variants.add(normalized);
            normalized
                .split(' ')
                .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
                .forEach((word) => variants.add(word));
            tokens(repaired).forEach((word) => variants.add(word));
        });
        return [...variants].slice(0, 160);
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

    function currentUser() {
        try {
            return typeof getUser === 'function' ? getUser() : null;
        } catch (_error) {
            return null;
        }
    }

    function selectedPages() {
        const user = currentUser() || {};
        const pages = user.assistant_permissions_configured === true && Array.isArray(user.assistant_allowed_pages)
            ? user.assistant_allowed_pages
            : user.allowed_pages;
        return Array.isArray(pages)
            ? [...new Set(pages.map((page) => String(page || '').split('?')[0].split('#')[0].split('/').pop()).filter(Boolean))]
            : [];
    }

    function assistantPages() {
        return selectedPages().filter((page) => ![
            'admin.html', 'logs.html', 'diagnostic.html', 'secrete-platforma.html', 'discord-configurare.html',
            'organizatii.html', 'vouchere.html', 'developer.html', 'administrare-organizatie.html'
        ].includes(page));
    }

    function create(options = {}) {
        const user = currentUser();
        if (!user) return null;

        const entries = [];
        let lastMatch = null;
        let lastRecipe = null;
        let indexPromise = null;
        let indexUpdatedAt = 0;
        let remoteKnowledgeLoaded = false;

        function roleName() {
            if (typeof getEffectiveRoleLabel === 'function') {
                const effectiveLabel = getEffectiveRoleLabel(user);
                if (effectiveLabel) return effectiveLabel;
            }
            const active = typeof getActiveOrganization === 'function' ? getActiveOrganization() : null;
            const candidates = [
                user.discord_role_name,
                user.discord_role,
                user.role_name,
                user.panel_role,
                user.role_label,
                user.organization_role,
                user.organization?.panel_role,
                user.organization?.role,
                user.active_organization?.panel_role,
                user.active_organization?.role,
                active?.discord_role_name,
                active?.panel_role,
                user.role,
                user.default_role
            ];
            return candidates.map(value => String(value || '').trim())
                .find(value => value && /[\p{L}]/u.test(value) && !/^\d+$/.test(value) && !/^(?:level|nivel|rolul tău|rol discord|necunoscut|rol)$/i.test(value)) || 'Rol Discord indisponibil';
        }

        function isPageAllowed(page) {
            if (!page || /^\s*(?:javascript:|data:|https?:|\/\/)/i.test(String(page))) return false;
            const file = String(page).split('?')[0].split('#')[0].split('/').pop();
            if (isPlatformAdmin()) return true;
            return assistantPages().includes(file);
        }

        function searchableText(entry) {
            return normalize([entry.title, entry.category, ...(entry.keywords || []), entry.answer].join(' '));
        }

        function scoreEntry(entry, question) {
            const query = normalize(question);
            const queryTokens = tokens(question);
            const source = searchableText(entry);
            const title = normalize(entry.title);
            const category = normalize(entry.category);
            let score = 0;

            if (title === query) score += 120;
            if (category === query) score += 110;
            else if (query.length > 3 && category.includes(query)) score += 60;
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

            const keywordMatches = (entry.keywords || []).reduce((matches, keyword) => {
                const clean = normalize(keyword);
                if (!clean) return matches;
                const keywordTokens = keywordVariants(keyword);
                return matches + (query.includes(clean) || clean.includes(query) || keywordTokens.some((token) => queryTokens.includes(token)) ? 1 : 0);
            }, 0);
            return score + (keywordMatches * 18);
        }

        function addEntry(entry, source = 'curated') {
            const cleanEntry = entry ? {
                ...entry,
                title: repairText(entry.title),
                category: repairText(entry.category),
                answer: repairText(entry.answer),
                keywords: keywordVariants([
                    ...(entry.keywords || []).map(repairText),
                    entry.question,
                    entry.title,
                    entry.category,
                    entry.answer
                ])
            } : null;
            if (!cleanEntry?.title || !cleanEntry?.answer) return false;
            if (cleanEntry.page && !isPageAllowed(cleanEntry.page)) return false;
            const signature = `${normalize(cleanEntry.title)}|${cleanEntry.page || ''}`;
            if (entries.some((item) => item.signature === signature)) return false;
            entries.push({ ...cleanEntry, source, signature });
            return true;
        }

        (window.PANEL_ASSISTANT_KNOWLEDGE || []).forEach((entry) => addEntry(entry));

        async function loadRemoteKnowledge() {
            if (remoteKnowledgeLoaded || typeof window.panelRequestJson !== 'function') return;
            remoteKnowledgeLoaded = true;
            try {
                const payload = await window.panelRequestJson('assistant-live?mode=knowledge', { method: 'GET', timeoutMs: 8000, retry: true });
                (Array.isArray(payload?.entries) ? payload.entries : []).forEach((entry) => addEntry({
                    ...entry,
                    title: entry.title || entry.question,
                    category: entry.category || 'Întrebări personalizate',
                    keywords: [...(Array.isArray(entry.keywords) ? entry.keywords : []), entry.question]
                }, 'remote'));
            } catch (_error) {
                // Întrebările standard rămân disponibile dacă serverul nu răspunde.
            }
        }

        function elementAllowed(element) {
            // Accesul este decis la nivel de pagină, prin allowed_pages.
            // Nu mai aplicăm praguri numerice hardcodate elementelor din pagină.
            return Boolean(element);
        }

        async function indexPage(page) {
            if (!isPageAllowed(page.file)) return;
            const separator = page.file.includes('?') ? '&' : '?';
            const response = await fetch(`${page.file}${separator}assistant_refresh=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) return;
            const markup = await response.text();
            const documentCopy = new DOMParser().parseFromString(markup, 'text/html');
            const contextFor = (element) => {
                const scope = element.closest('section, fieldset, article, details, form') || element.parentElement;
                const heading = scope?.querySelector('h1, h2, h3, h4, h5, h6, legend, summary')?.textContent;
                const cleanHeading = String(heading || '').replace(/\s+/g, ' ').trim();
                return cleanHeading && normalize(cleanHeading) !== normalize(page.label) ? cleanHeading : page.label;
            };
            const describe = (element, text) => {
                const context = contextFor(element);
                return context === page.label
                    ? `În pagina ${page.label}: ${text}`
                    : `În pagina ${page.label}, în secțiunea „${context}”: ${text}`;
            };

            documentCopy.querySelectorAll('[data-title]').forEach((element) => {
                if (!elementAllowed(element)) return;
                const title = String(element.dataset.title || '').replace(/\s+/g, ' ').trim();
                const description = String(element.dataset.desc || '').replace(/\s+/g, ' ').trim();
                if (title.length < 2 || title.length > 120) return;
                addEntry({
                    title,
                    category: page.label,
                    page: page.file === 'craftmecanics.html' ? `${page.file}?search=${encodeURIComponent(title)}` : page.file,
                    keywords: [title, description, page.label],
                    answer: describe(element, description ? `${title}: ${description}` : `${title} este disponibil.`)
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
                    page: page.file,
                    keywords: [title, page.label],
                    answer: describe(element, `găsești secțiunea „${title}”.`)
                }, 'page');
            });

            documentCopy.querySelectorAll('option').forEach((option) => {
                if (!elementAllowed(option)) return;
                const title = String(option.textContent || '').replace(/\s+/g, ' ').trim();
                if (title.length < 3 || title.length > 70 || /^--/.test(title)) return;
                addEntry({
                    title,
                    category: page.label,
                    page: page.file,
                    keywords: [title, page.label],
                    answer: describe(option, `opțiunea „${title}” este disponibilă.`)
                }, 'page');
            });

            documentCopy.querySelectorAll('button, [role="button"], label, input[placeholder], textarea[placeholder]').forEach((element) => {
                if (!elementAllowed(element)) return;
                const title = String(
                    element.getAttribute('aria-label') ||
                    element.getAttribute('title') ||
                    element.getAttribute('placeholder') ||
                    element.textContent ||
                    ''
                ).replace(/\s+/g, ' ').trim();
                if (title.length < 3 || title.length > 100 || /^[-–—:]+$/.test(title)) return;
                addEntry({
                    title,
                    category: page.label,
                    page: page.file,
                    keywords: [title, page.label, 'acțiune', 'formular'],
                    answer: describe(element, `poți folosi „${title}”.`)
                }, 'page');
            });

            const contentRoot = documentCopy.querySelector('main') || documentCopy.body;
            const seenContent = new Set();
            contentRoot?.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, dt, dd, th, td, summary, article, [data-title], [data-desc]').forEach((element) => {
                if (!elementAllowed(element)) return;
                const text = String(element.textContent || element.getAttribute('data-desc') || '').replace(/\s+/g, ' ').trim();
                const clean = normalize(text);
                if (text.length < 8 || text.length > 360 || seenContent.has(clean)) return;
                seenContent.add(clean);
                const title = text.length <= 100 ? text : `${text.slice(0, 97).trim()}…`;
                addEntry({
                    title,
                    category: page.label,
                    page: page.file,
                    keywords: keywordVariants([text, page.label]),
                    answer: describe(element, text)
                }, 'page');
            });
        }

        function clearIndexedPageEntries() {
            for (let index = entries.length - 1; index >= 0; index -= 1) {
                if (entries[index].source === 'page' || entries[index].source === 'remote') entries.splice(index, 1);
            }
            lastMatch = null;
            lastRecipe = null;
            remoteKnowledgeLoaded = false;
            indexUpdatedAt = 0;
        }

        function indexLocalPages({ force = false } = {}) {
            if (indexPromise && !force) return indexPromise;
            if (!force && indexUpdatedAt && Date.now() - indexUpdatedAt < INDEX_TTL_MS) {
                return Promise.resolve(entries.length);
            }
            if (indexPromise && force) {
                return indexPromise.then(() => {
                    indexPromise = null;
                    return indexLocalPages({ force: true });
                });
            }
            if (force) clearIndexedPageEntries();
            const pages = (window.PANEL_ASSISTANT_PAGES || []).filter((page) => isPageAllowed(page.file));
            indexPromise = Promise.allSettled([loadRemoteKnowledge(), ...pages.map(indexPage)]).then(() => {
                indexUpdatedAt = Date.now();
                options.onIndexUpdate?.(entries.length, false);
                return entries.length;
            });
            return indexPromise;
        }

        async function refreshIndex({ force = false } = {}) {
            return indexLocalPages({ force });
        }

        function exactPageMatch(question) {
            const query = normalize(question);
            if (!query) return null;
            return (window.PANEL_ASSISTANT_PAGES || []).find((page) => {
                if (!isPageAllowed(page.file)) return false;
                const fileName = normalize(page.file.replace(/\.html$/i, ''));
                return normalize(page.label) === query || fileName === query;
            }) || null;
        }

        function collectPageMatches(question) {
            const query = normalize(question);
            const queryTokens = tokens(question);
            const ranked = entries
                .map((entry) => ({ entry, score: scoreEntry(entry, question) }))
                .sort((left, right) => right.score - left.score);
            const best = ranked[0];
            const pageMatches = new Map();
            const minimumRelatedScore = Math.max(8, Number(best?.score || 0) * 0.62);
            ranked
                .filter((item) => {
                    if (item.score < minimumRelatedScore || !item.entry.page || !isPageAllowed(item.entry.page)) return false;
                    const source = searchableText(item.entry);
                    const sourceWords = source.split(' ');
                    return source.includes(query) || queryTokens.some((token) => sourceWords.includes(token) || sourceWords.some((word) => word.startsWith(token) || token.startsWith(word)));
                })
                .slice(0, 60)
                .forEach(({ entry, score }) => {
                    const page = String(entry.page).split('?')[0];
                    const manifestPage = (window.PANEL_ASSISTANT_PAGES || []).find((item) => item.file === page);
                    const current = pageMatches.get(page) || { page, title: manifestPage?.label || page, score, items: [] };
                    if (score > current.score) current.score = score;
                    if (!current.items.some((item) => item.title === entry.title) && current.items.length < 3) {
                        current.items.push({ title: entry.title, answer: entry.answer });
                    }
                    pageMatches.set(page, current);
                });
            const groups = [...pageMatches.values()]
                .sort((left, right) => right.score - left.score)
                .slice(0, 3);
            return {
                best,
                groups,
                links: groups.map(({ page, title, items }) => ({
                    page,
                    title,
                    matches: items.map((item) => item.title)
                }))
            };
        }

        async function findPageMatches(question) {
            const cleanQuestion = String(question || '').trim().slice(0, 500);
            if (!cleanQuestion) return [];
            await refreshIndex();
            const pageMatch = exactPageMatch(cleanQuestion);
            if (pageMatch) return [{ page: pageMatch.file, title: pageMatch.label, matches: [] }];
            return collectPageMatches(cleanQuestion).links;
        }

        function recipeCatalog() {
            const data = window.PANEL_ASSISTANT_CALCULATOR_DATA || {};
            const craft = data.craft || {};
            const result = [];
            (craft.masa || []).forEach((recipe) => result.push({ ...recipe, category: 'Masă Crafting', page: 'calculator.html' }));
            (craft.croitorie || []).forEach((recipe) => result.push({ ...recipe, category: 'Croitorie', page: 'calculator.html' }));
            (craft.topitorie || []).forEach((recipe) => result.push({ ...recipe, category: 'Topitorie', page: 'calculatorilegal.html' }));
            Object.entries(craft.chains || {}).forEach(([chain, recipes]) => recipes.forEach(([id, name, cost]) => result.push({ id, name, base: cost, category: 'Masă Crafting', page: 'calculator.html', chain })));
            (window.PANEL_CRAFT_MECHANIC_RECIPES || []).forEach((recipe) => result.push({ ...recipe, category: 'Craft Mecanic', page: 'craftmecanics.html' }));
            const illegal = data.illegal || {};
            Object.entries(illegal.weapons || {}).forEach(([name, recipe]) => result.push({ ...recipe, id: `weapon_${normalize(name).replace(/ /g, '_')}`, name, category: 'Calculator ilegal · arme', page: 'calculatorilegal.html', kind: 'weapon' }));
            Object.entries(illegal.ammo || {}).forEach(([name, recipe]) => result.push({ id: `ammo_${normalize(name).replace(/ /g, '_')}`, name, batch: recipe[0], casing: recipe[1], fill: recipe[2], category: 'Calculator ilegal · muniții', page: 'calculatorilegal.html', kind: 'ammo' }));
            return result;
        }

        function quantityFromQuestion(question, fallback = 1) {
            const value = String(question || '');
            const match = value.match(/(?:pentru|la|x|cantitate(?:a)?|vreau|fac|am nevoie de)\s*(\d{1,4})\b|\b(\d{1,4})\s*(?:buc(?:ăți|ati)?|bucati|obiecte|unit[aă]ți)\b/i);
            const quantity = Number(match?.[1] || match?.[2] || 0);
            return Number.isFinite(quantity) && quantity > 0 ? Math.min(10000, Math.floor(quantity)) : Math.max(1, Number(fallback) || 1);
        }

        function findRecipe(question) {
            const query = normalize(question);
            if (!query) return null;
            const catalog = recipeCatalog();
            const exact = catalog.find((item) => normalize(item.name) === query || normalize(item.id) === query);
            if (exact) return exact;
            const kevlar = catalog.find((item) => query.includes('kevlar') && !query.includes('fibra') && normalize(item.name) === 'armura kevlar');
            if (kevlar) return kevlar;
            const scored = catalog.map((item) => {
                const name = normalize(item.name);
                const id = normalize(item.id);
                let score = 0;
                if (query.includes(name) || name.includes(query)) score += 90;
                if (query.includes(id) || id.includes(query)) score += 65;
                tokens(question).forEach((token) => {
                    const best = Math.max(similarity(token, name), ...name.split(' ').map((word) => similarity(token, word)));
                    if (best >= 0.66) score += best * 20;
                });
                return { item, score };
            }).sort((a, b) => b.score - a.score);
            return scored[0]?.score >= 24 ? scored[0].item : null;
        }

        function recipeByName(name) {
            const query = normalize(name);
            const catalog = recipeCatalog();
            if (query === 'cauciuc') return catalog.find((item) => item.id === 'cauciuc_1') || null;
            return catalog.find((item) => normalize(item.name) === query)
                || catalog.find((item) => normalize(item.name).replace(/ x\d+$/, '') === query)
                || null;
        }

        function addMaterial(target, name, amount) {
            if (!name || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return;
            target[name] = (target[name] || 0) + Number(amount);
        }

        function resolveCraftMaterials(item, quantity, direct, raw, stack = new Set()) {
            const amount = Math.max(0, Number(quantity) || 0);
            if (!item || amount <= 0) return;
            const key = `${normalize(item.name)}|${item.chain || ''}`;
            if (stack.has(key)) { addMaterial(raw, item.name, amount); return; }
            const produces = Math.max(1, Number(item.produces) || 1);
            const crafts = Math.ceil(amount / produces);
            const base = item.base || {};
            Object.entries(base).forEach(([material, value]) => {
                const total = Number(value) * crafts;
                addMaterial(direct, material, total);
                const dependency = normalize(material) === 'cauciuc'
                    ? ([1, 2, 3].includes(total) ? recipeCatalog().find((candidate) => candidate.id === `cauciuc_${total}`) : null)
                    : recipeByName(material);
                const chainDependency = recipeCatalog().find((candidate) => normalize(candidate.name) === normalize(material));
                if (dependency) {
                    resolveCraftMaterials(dependency, total, {}, raw, new Set([...stack, key]));
                } else if (chainDependency) {
                    resolveCraftMaterials(chainDependency, total, {}, raw, new Set([...stack, key]));
                } else {
                    addMaterial(raw, material, total);
                }
            });
        }

        function makeCalculatorAction(item, quantity) {
            const page = item.page === 'craftmecanics.html' ? item.page : item.page || 'calculator.html';
            const target = page === 'calculatorilegal.html' ? `${page}#calculator` : `${page}?assistant_item=${encodeURIComponent(item.id || item.name)}&assistant_qty=${encodeURIComponent(quantity)}`;
            return { type: 'open', label: 'Calculează', page: target };
        }

        function recipeResponse(question) {
            const query = normalize(question);
            let item = findRecipe(question);
            if (!item?.name) item = null;
            const hasRecipeWords = /\b(reteta|re[țt]et[ăa]|calculeaz|materiale|ingrediente|craft|fac|pentru|xenon|undita|kevlar|cabluri|arma|munitie|gloan[tț]e|topor|tarnacop|t[aă]rnacop)\b/.test(query);
            const followUp = /\b(dar|si|iar|pentru|la)\b/.test(query) && (lastRecipe || /\b(kevlar|5|10|20|30)\b/.test(query));
            if (!item && followUp && lastRecipe) item = lastRecipe.item;
            if (!item || (!hasRecipeWords && !followUp)) return null;
            const quantity = quantityFromQuestion(question, followUp && lastRecipe ? lastRecipe.quantity : 1);
            lastRecipe = { item, quantity };
            if (item.kind === 'weapon') return weaponRecipeResponse(item, quantity);
            if (item.kind === 'ammo') return ammoRecipeResponse(item, quantity);
            const direct = {};
            const raw = {};
            resolveCraftMaterials(item, quantity, direct, raw);
            const directText = Object.entries(direct).filter(([, value]) => value > 0).map(([name, value]) => `${name} x${value}`).join(', ') || '—';
            const rawText = Object.entries(raw).filter(([, value]) => value > 0).map(([name, value]) => `${name} x${value}`).join(', ') || '—';
            const page = item.page || 'calculator.html';
            const actions = [makeCalculatorAction(item, quantity), { type: 'open', label: 'Vezi rețeta', page: item.page === 'craftmecanics.html' ? `${page}?search=${encodeURIComponent(item.name)}` : page }];
            return {
                answer: `Pentru ${quantity} × ${item.name}:\n\nMateriale directe: ${directText}\nMateriale brute: ${rawText}\n\nAceste cantități sunt calculate după rețeta și randamentul din calculator.`,
                page, title: item.name, links: [{ page, title: item.name }], actions
            };
        }

        function weaponRecipeResponse(item, quantity) {
            const data = window.PANEL_ASSISTANT_CALCULATOR_DATA?.illegal || {};
            const counts = {};
            (item.components || []).forEach((component) => addMaterial(counts, component, quantity));
            const parts = (Number(item.parts) || 0) * quantity;
            const componentParts = (item.components || []).reduce((sum, component) => sum + (data.componentCost?.[component] || 0), 0) * quantity;
            const partCrafts = Math.ceil((parts + componentParts) / 2);
            addMaterial(counts, 'Blueprint', (item.blueprint || 0) * quantity);
            addMaterial(counts, 'Piese', parts + componentParts);
            addMaterial(counts, 'Arc', partCrafts); addMaterial(counts, 'Oțel', partCrafts); addMaterial(counts, 'Plastic', partCrafts); addMaterial(counts, 'Scrap', partCrafts * 2);
            ['gold', 'diamonds', 'rubies', 'emeralds'].forEach((key) => addMaterial(counts, key === 'gold' ? 'Aur' : key === 'diamonds' ? 'Diamante' : key === 'rubies' ? 'Rubine' : 'Emeralde', (item[key] || 0) * quantity));
            return { answer: `Pentru ${quantity} × ${item.name}:\n\n${Object.entries(counts).filter(([, value]) => value > 0).map(([name, value]) => `${name} x${value}`).join(', ')}\n\nAm păstrat separat componentele și materialele brute, exact ca în Calculator Ilegal.`, page: item.page, title: item.name, links: [{ page: item.page, title: item.name }], actions: [makeCalculatorAction(item, quantity), { type: 'open', label: 'Vezi rețeta', page: item.page }] };
        }

        function ammoRecipeResponse(item, quantity) {
            const batches = Math.ceil(quantity / Math.max(1, Number(item.batch) || 1));
            const materials = {};
            Object.entries(item.casing || {}).forEach(([name, value]) => addMaterial(materials, name, Number(value) * batches));
            Object.entries(item.fill || {}).forEach(([name, value]) => addMaterial(materials, name, Number(value) * batches));
            return { answer: `Pentru ${quantity} × ${item.name} ai nevoie de ${batches} lot${batches === 1 ? '' : 'uri'}:\n\n${Object.entries(materials).map(([name, value]) => `${name} x${value}`).join(', ')}.`, page: item.page, title: item.name, links: [{ page: item.page, title: item.name }], actions: [makeCalculatorAction(item, quantity), { type: 'open', label: 'Vezi rețeta', page: item.page }] };
        }

        async function liveShiftResponse(question) {
            const query = normalize(question);
            if (!/\b(cine.*(pontat|lucreaza|tura)|pontaje active|ture active|status.*live|cine este in tura)\b/.test(query)) return null;
            if (!isPageAllowed('status-live.html') && !isPageAllowed('rapoarte.html')) return { answer: 'Nu ai permisiunea necesară pentru a vedea pontajele live.' };
            try {
                const payload = await window.panelRequestJson('assistant-live?mode=shifts', { method: 'GET', timeoutMs: 8000, retry: true });
                const shifts = Array.isArray(payload?.shifts) ? payload.shifts : [];
                const text = shifts.length ? shifts.map((shift) => `• ${shift.colleague_name || shift.discord_id} — ${shift.status === 'paused' ? 'în pauză' : 'în tură'}`).join('\n') : 'Nu există pontaje active în acest moment.';
                return { answer: `Pontaje live:\n\n${text}`, page: 'status-live.html', title: 'Pontaje live', actions: [{ type: 'open', label: 'Deschide pagina', page: 'status-live.html' }] };
            } catch (error) {
                if (Number(error?.status) === 403) return { answer: 'Nu ai permisiunea necesară pentru a vedea pontajele live.' };
                return { answer: 'Nu pot citi pontajele live chiar acum. Încearcă din nou în câteva secunde.' };
            }
        }

        function specialResponse(question) {
            const query = normalize(question);
            const restrictedTopics = [
                { page: 'admin.html', pattern: /\b(panou admin|admin|schimb rol|modific rol|rol utilizator|utilizator din panou|schimb ora|configurez ora|oprire toate turele|opresc toate turele|sterge utilizator|loguri|jurnal activitate)\b/ },
                { page: 'rapoarte.html', pattern: /\b(rapoarte|mecanici activi|cine este pontaj|cine e pontaj|opresc tura cuiva|opresc tura altuia|editez pontaj|modific pontajul altuia|sterg pontaj)\b/ },
                { page: 'contracte.html', pattern: /\b(contracte|generez contract)\b/ },
                { page: 'calculatorilegal.html', pattern: /\b(calculator ilegal|arme|arma|arm[ăa] de foc|muni[țt]ii|gloan[țt]e)\b/ },
                { page: 'marketplace-ilegal.html', pattern: /\b(black market|piata neagra|cocaina|marijuana|jointuri|acetona|cayo|tec|tec9|tec 9|tec-9)\b/ },
                { page: 'locatiiilegale.html', pattern: /\b(locatii ilegale|loca[țt]ii ilegale|zone ilegale|loca[țt]ie ilegal[ăa])\b/ },
                { page: 'minigames.html', pattern: /\b(minigames?|mini games?|skill ?check|lockpick|heist|hack(?:ing)?|tripwire|vault)\b/ }
            ];
            const blockedTopic = restrictedTopics.find((topic) => topic.pattern.test(query) && !isPageAllowed(topic.page));
            if (blockedTopic) return { answer: 'Nu ai permisiunea necesară pentru această secțiune. Asistentul îți poate arăta doar informațiile disponibile rolului tău.' };
            if (/^(salut|buna|buna ziua|buna seara|neata|hey|hello)\b/.test(query)) return { answer: `Salut! Sunt asistentul intern al panelului. Ai acces de tip „${roleName()}”. Cu ce informație din proiect te pot ajuta?` };
            if (/\b(multumesc|mersi|ms|super|perfect)\b/.test(query)) return { answer: 'Cu plăcere! Poți continua cu orice întrebare despre paginile și funcțiile panelului.' };
            if (/\b(ce rol|rolul meu|ce functie|functia mea)\b/.test(query)) return { answer: `Rolul disponibil în sesiunea ta este „${roleName()}”. Rezultatele sunt filtrate exact după paginile permise organizației tale.` };
            if (/^(cat e ceasul|cat este ceasul|cat e ora|ce ora este|ce ora e|ora acum)$/.test(query)) return { answer: `Ora României este ${new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit' }).format(new Date())}.` };
            if (/^(unde|deschide|du ma|du ma|arata mi|mai multe|detalii|care pagina|pagina)\b/i.test(query) && lastMatch?.page) return { answer: `Informația anterioară se află în ${lastMatch.category || lastMatch.title}.`, page: lastMatch.page, title: lastMatch.title };
            return null;
        }

        async function liveServerResponse(question) {
            const query = normalize(question);
            if (!/\b(fivem|b zone|bzone|jucatori online|playeri online|server)\b/.test(query) || !isPageAllowed('index.html')) return null;

            lastMatch = { page: 'index.html', title: 'Dashboard', category: 'Dashboard' };
            try {
                if (typeof window.panelRequestJson !== 'function') throw new Error('Statusul live nu este disponibil.');
                const status = await window.panelRequestJson('fivem-status', {
                    method: 'GET',
                    timeoutMs: 8000,
                    retry: true
                });
                const players = Number(status.players);
                const maxPlayers = Number(status.maxPlayers);
                if (status.online !== true || !Number.isFinite(players) || !Number.isFinite(maxPlayers)) throw new Error('Răspuns live invalid.');
                return {
                    answer: `B-Zone are acum ${Math.max(0, Math.round(players))} din ${Math.max(0, Math.round(maxPlayers))} jucători conectați. Poți apăsa butonul de pe Dashboard pentru conectare directă în FiveM.`,
                    page: 'index.html',
                    title: 'Dashboard'
                };
            } catch (_error) {
                return {
                    answer: 'Pe Dashboard găsești butonul de conectare directă la serverul B-Zone și indicatorul live cu numărul de jucători conectați din limita serverului.',
                    page: 'index.html',
                    title: 'Dashboard'
                };
            }
        }

        async function answer(question) {
            const cleanQuestion = String(question || '').trim().slice(0, 500);
            if (!cleanQuestion) return { answer: 'Scrie o întrebare despre panel și încerc să găsesc informația potrivită.' };
            const special = specialResponse(cleanQuestion);
            if (special) return special;
            const live = await liveServerResponse(cleanQuestion);
            if (live) return live;
            const liveShifts = await liveShiftResponse(cleanQuestion);
            if (liveShifts) return liveShifts;
            const recipe = recipeResponse(cleanQuestion);
            if (recipe) return recipe;

            await refreshIndex();
            const pageMatch = exactPageMatch(cleanQuestion);
            if (pageMatch) {
                lastMatch = { page: pageMatch.file, title: pageMatch.label, category: pageMatch.label };
                const pageEntries = entries
                    .filter((entry) => String(entry.page || '').split('?')[0] === pageMatch.file)
                    .sort((left, right) => scoreEntry(right, cleanQuestion) - scoreEntry(left, cleanQuestion))
                    .slice(0, 6);
                const pageSummary = pageEntries.length
                    ? `\n\n${pageEntries.map((entry) => `• ${entry.answer}`).join('\n')}`
                    : '';
                return {
                    answer: `Am găsit pagina „${pageMatch.label}”. Acestea sunt câteva informații disponibile acolo, în funcție de accesul rolului tău:${pageSummary}`,
                    page: pageMatch.file,
                    title: pageMatch.label,
                    links: [{ page: pageMatch.file, title: pageMatch.label }]
                    , actions: [{ type: 'open', label: 'Deschide pagina', page: pageMatch.file }]
                };
            }

            const search = collectPageMatches(cleanQuestion);
            const best = search.best;
            if (!best || best.score < 9) {
                const topics = entries
                    .filter((entry) => ['pontaj', 'invoiri', 'craft', 'marketplace', 'ilegal', 'manager', 'admin'].includes(entry.category))
                    .slice(0, 4)
                    .map((entry) => entry.title)
                    .join(', ');
                return { answer: `Nu am găsit un răspuns exact în informațiile panelului. Încearcă să reformulezi folosind numele paginii sau funcției. Exemple: ${topics || 'Pontaj, învoiri, Craft Mecanic și Marketplace'}.` };
            }

            lastMatch = best.entry;
            const { groups, links } = search;
            const response = groups.length
                ? `Am găsit informații pentru „${cleanQuestion}” în paginile permise rolului tău:\n\n${groups.map((group) => `${group.title}:\n${group.items.map((item) => `• ${item.answer}`).join('\n')}`).join('\n\n')}`
                : best.entry.answer;
            return {
                answer: response,
                page: isPageAllowed(best.entry.page) ? best.entry.page : '',
                title: best.entry.title,
                links,
                actions: isPageAllowed(best.entry.page) ? [{ type: 'open', label: 'Deschide pagina', page: best.entry.page }] : []
            };
        }

        async function sendFeedback(payload) {
            if (typeof window.panelRequestJson !== 'function') return false;
            try {
                await window.panelRequestJson('assistant-feedback', {
                    method: 'POST',
                    timeoutMs: 8000,
                    retry: false,
                    body: JSON.stringify({
                        question: String(payload?.question || '').slice(0, 500),
                        answer: String(payload?.answer || '').slice(0, 3000),
                        helpful: Boolean(payload?.helpful),
                        page: String(payload?.page || '').slice(0, 120)
                    })
                });
                return true;
            } catch (_error) { return false; }
        }

        return {
            roleName: roleName(),
            user,
            answer,
            indexLocalPages,
            refreshIndex,
            findPageMatches,
            isPageAllowed,
            sendFeedback,
            repairText,
            getEntryCount: () => entries.length
        };
    }

    window.PanelAssistantCore = Object.freeze({ create });
})();
