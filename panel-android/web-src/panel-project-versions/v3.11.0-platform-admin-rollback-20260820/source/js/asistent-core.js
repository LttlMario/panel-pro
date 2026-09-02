// Motor comun pentru pagina Asistent și widgetul plutitor.
// Rulează exclusiv în browser și nu trimite întrebările către servicii externe.
(() => {
    'use strict';
    if (window.PanelAssistantCore) return;

    const CACHE_VERSION = '11';
    const STOP_WORDS = new Set(['a', 'ai', 'al', 'ale', 'am', 'ar', 'are', 'as', 'asta', 'ca', 'care', 'ce', 'cea', 'cel', 'cu', 'cum', 'de', 'din', 'doar', 'este', 'eu', 'fi', 'in', 'la', 'mai', 'ma', 'mi', 'o', 'pe', 'pentru', 'pot', 'sa', 'se', 'si', 'sunt', 'un', 'una', 'unde', 'vreau']);
    const SYNONYMS = {
        pontare: 'pontaj', pontat: 'pontaj', tura: 'pontaj', ture: 'pontaj', serviciu: 'pontaj',
        absenta: 'invoire', concediu: 'invoire', cerere: 'invoire', indisponibil: 'invoire',
        reteta: 'craft', fabricare: 'craft', confectionare: 'craft', roata: 'roti', anvelopa: 'roti',
        piata: 'marketplace', anunturi: 'anunt', vanzari: 'vanzare',
        harta: 'locatii', locatie: 'locatii', ilegal: 'ilegal', tec9: 'tec',
        sef: 'manager', coordonator: 'manager', administrare: 'admin',
        jurnal: 'loguri', activitate: 'loguri', istoric: 'rapoarte'
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
        const pages = currentUser()?.allowed_pages;
        return Array.isArray(pages)
            ? [...new Set(pages.map((page) => String(page || '').split('?')[0].split('#')[0].split('/').pop()).filter(Boolean))]
            : [];
    }

    function assistantPages() {
        // Robotul moștenește exclusiv accesul normal al organizației.
        // Nu există o listă separată de pagini pentru asistent.
        return selectedPages().filter((page) => ![
            'admin.html', 'logs.html', 'diagnostic.html', 'discord-configurare.html',
            'organizatii.html', 'vouchere.html', 'developer.html', 'administrare-organizatie.html'
        ].includes(page));
    }

    function create(options = {}) {
        const user = currentUser();
        if (!user) return null;

        const entries = [];
        let lastMatch = null;
        let indexPromise = null;

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
                    answer: describe(element, `opțiunea „${title}” este disponibilă.`)
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
                if (entries[index].source === 'page') entries.splice(index, 1);
            }
            lastMatch = null;
        }

        function indexLocalPages({ force = false } = {}) {
            if (indexPromise && !force) return indexPromise;
            if (indexPromise && force) {
                return indexPromise.then(() => {
                    indexPromise = null;
                    return indexLocalPages({ force: true });
                });
            }
            if (force) clearIndexedPageEntries();
            const pages = (window.PANEL_ASSISTANT_PAGES || []).filter((page) => isPageAllowed(page.file));
            indexPromise = Promise.allSettled(pages.map(indexPage)).then(() => {
                options.onIndexUpdate?.(entries.length, false);
                return entries.length;
            });
            return indexPromise;
        }

        async function refreshIndex() {
            return indexLocalPages({ force: true });
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
            ranked
                .filter((item) => {
                    if (item.score < 8 || !item.entry.page || !isPageAllowed(item.entry.page)) return false;
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
                .slice(0, 6);
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

        function specialResponse(question) {
            const query = normalize(question);
            const restrictedTopics = [
                { page: 'admin.html', pattern: /\b(panou admin|admin|schimb rol|modific rol|rol utilizator|utilizator din panou|schimb ora|configurez ora|oprire toate turele|opresc toate turele|sterge utilizator|loguri|jurnal activitate)\b/ },
                { page: 'rapoarte.html', pattern: /\b(rapoarte|mecanici activi|cine este pontaj|cine e pontaj|opresc tura cuiva|opresc tura altuia|editez pontaj|modific pontajul altuia|sterg pontaj)\b/ },
                { page: 'contracte.html', pattern: /\b(contracte|generez contract)\b/ },
                { page: 'calculatorilegal.html', pattern: /\b(calculator ilegal|arme|arma|arm[ăa] de foc|muni[țt]ii|gloan[țt]e)\b/ },
                { page: 'marketplace-ilegal.html', pattern: /\b(black market|piata neagra|cocaina|marijuana|jointuri|acetona|cayo|tec|tec9|tec 9|tec-9)\b/ },
                { page: 'locatiiilegale.html', pattern: /\b(locatii ilegale|loca[țt]ii ilegale|zone ilegale|loca[țt]ie ilegal[ăa])\b/ }
            ];
            const blockedTopic = restrictedTopics.find((topic) => topic.pattern.test(query) && !isPageAllowed(topic.page));
            if (blockedTopic) return { answer: 'Nu ai permisiunea necesară pentru această secțiune. Asistentul îți poate arăta doar informațiile disponibile rolului tău.' };
            if (/^(salut|buna|buna ziua|buna seara|neata|hey|hello)\b/.test(query)) return { answer: `Salut! Sunt asistentul intern al panelului. Ai acces de tip „${roleName()}”. Cu ce informație din proiect te pot ajuta?` };
            if (/\b(multumesc|mersi|ms|super|perfect)\b/.test(query)) return { answer: 'Cu plăcere! Poți continua cu orice întrebare despre paginile și funcțiile panelului.' };
            if (/\b(ce rol|rolul meu|ce functie|functia mea)\b/.test(query)) return { answer: `Rolul disponibil în sesiunea ta este „${roleName()}”. Rezultatele sunt filtrate exact după paginile permise organizației tale.` };
            if (/^(cat e ceasul|cat este ceasul|cat e ora|ce ora este|ce ora e|ora acum)$/.test(query)) return { answer: `Ora României este ${new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit' }).format(new Date())}.` };
            if (/^(unde|deschide|du ma|pagina)$/i.test(query) && lastMatch?.page) return { answer: `Informația anterioară se află în ${lastMatch.category || lastMatch.title}.`, page: lastMatch.page, title: lastMatch.title };
            return null;
        }

        async function answer(question) {
            const cleanQuestion = String(question || '').trim().slice(0, 500);
            if (!cleanQuestion) return { answer: 'Scrie o întrebare despre panel și încerc să găsesc informația potrivită.' };
            const special = specialResponse(cleanQuestion);
            if (special) return special;

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
                links
            };
        }

        return {
            roleName: roleName(),
            user,
            answer,
            indexLocalPages,
            refreshIndex,
            findPageMatches,
            isPageAllowed,
            repairText,
            getEntryCount: () => entries.length
        };
    }

    window.PanelAssistantCore = Object.freeze({ create });
})();
