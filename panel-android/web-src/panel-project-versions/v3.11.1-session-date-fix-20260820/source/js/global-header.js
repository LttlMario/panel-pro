(function() {
    let advancedSearchTimer = null;
    let advancedSearchRequest = 0;

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>'"]/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[char]));
    }

    function initGlobalHeader() {
        const host = document.getElementById('panel-header-host');
        if (!host) return;

        if (host.dataset.loaded === "1") return;
        host.dataset.loaded = "1";

        let titleText = (document.title || '').replace(/\s*-\s*Panel.*$/, '').trim() || 'Dashboard';
        titleText = escapeHtml(titleText);

        const searchWrapperClass = "relative w-full sm:ml-auto sm:w-80 md:w-full md:max-w-md";

        const headerHTML = `
            <header class="panel-global-header min-h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur px-4 py-3 md:px-8 flex flex-wrap items-center gap-3 sticky top-0 z-20">
                <div class="panel-global-title flex items-center gap-3 shrink-0">
                    <button type="button" id="global-header-mobile-btn" class="md:hidden w-10 h-10 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 text-lg" aria-label="Deschide meniul">☰</button>
                    <h2 class="text-lg font-bold text-slate-100">${titleText}</h2>
                </div>
                <div class="panel-global-search-host ${searchWrapperClass}">
                    <input id="global-search" type="search" autocomplete="off" placeholder="Caută: Runflat, pontaj, învoire..." class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500">
                    <div id="global-search-results" class="hidden absolute right-0 mt-2 w-full max-h-80 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl z-50"></div>
                </div>
            </header>
        `;

        host.insertAdjacentHTML('beforeend', headerHTML);

        const mobileBtn = host.querySelector('#global-header-mobile-btn');
        if (mobileBtn) {
            mobileBtn.addEventListener('click', () => {
                if (typeof window.__panelMobileToggle === 'function') {
                    window.__panelMobileToggle();
                    return;
                }
                if (typeof window.toggleMobileMenu === 'function') window.toggleMobileMenu();
            });
        }

        const searchInput = host.querySelector('#global-search');
        const roleLabel = getActiveRoleLabel();
        if (searchInput) {
            searchInput.placeholder = roleLabel
                ? `Caută în paginile disponibile pentru ${roleLabel}...`
                : 'Caută module sau informații...';
            searchInput.title = roleLabel
                ? `Căutare filtrată după accesul rolului: ${roleLabel}`
                : 'Căutare filtrată după paginile disponibile';
        }
        if (searchInput && typeof window.renderGlobalSearch === 'function') {
            searchInput.addEventListener('input', window.renderGlobalSearch);
            searchInput.addEventListener('focus', window.renderGlobalSearch);
            searchInput.dataset.globalSearchBound = 'true';
        }
    }

    function normalizeSearchValue(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('ro-RO')
            .trim();
    }

    function getAdvancedSearchEngine() {
        if (window.__panelAssistantEngine?.findPageMatches) return window.__panelAssistantEngine;
        const user = typeof window.getUser === 'function' ? window.getUser() : null;
        if (window.PanelAssistantCore && user) {
            window.__panelAssistantEngine = window.PanelAssistantCore.create({ onIndexUpdate: () => undefined });
            return window.__panelAssistantEngine;
        }
        return null;
    }

    function getActiveRoleLabel() {
        const user = typeof window.getUser === 'function' ? window.getUser() : null;
        if (typeof window.getEffectiveRoleLabel === 'function') return window.getEffectiveRoleLabel(user);
        const organization = typeof window.getActiveOrganization === 'function'
            ? window.getActiveOrganization()
            : null;
        const candidates = [
            user?.discord_role_name,
            user?.discord_role,
            user?.role_name,
            user?.panel_role,
            user?.role_label,
            user?.organization_role,
            user?.organization?.panel_role,
            user?.organization?.role,
            user?.active_organization?.panel_role,
            user?.active_organization?.role,
            organization?.panel_role,
            user?.role,
            user?.default_role
        ];
        return candidates
            .map(value => String(value || '').trim())
            .find(value => value && /[\p{L}]/u.test(value) && !/^\d+$/.test(value)) || '';
    }

    function getAccessibleNavigation() {
        const links = [...document.querySelectorAll('#panel-shared-sidebar nav a[href], #sidebar-nav a[href]')];
        const seen = new Set();
        return links.map(link => {
            const href = link.getAttribute('href') || '';
            const page = href.split('?')[0].split('#')[0].split('/').pop();
            const accessible = typeof window.canAccessPage === 'function'
                ? window.canAccessPage(page)
                : getComputedStyle(link).display !== 'none';
            if (!page || seen.has(page) || !accessible) return null;
            seen.add(page);
            const section = link.closest('[data-nav-section]')?.querySelector('.panel-nav-section-label')?.textContent?.trim() || 'Panel';
            return {
                href,
                label: link.querySelector('span:last-child')?.textContent?.trim() || link.textContent.trim(),
                icon: link.querySelector('span:first-child')?.textContent?.trim() || '•',
                section
            };
        }).filter(Boolean);
    }

    function getSearchablePageItems() {
        const main = document.querySelector('main');
        if (!main) return [];
        const selectors = [
            '.gallery-card',
            'tbody tr',
            '.community-post, .announcement-card, .post',
            '.marketplace-card, .listing-card',
            '[data-searchable]'
        ];
        const items = [];
        const seen = new Set();
        selectors.forEach(selector => {
            main.querySelectorAll(selector).forEach(item => {
                if (seen.has(item) || item.closest('#panel-header-host, #panel-global-footer, #panel-sidebar-host, header, footer, [role="dialog"]')) return;
                seen.add(item);
                items.push(item);
            });
        });
        return items;
    }

    function filterCurrentPage(query) {
        const items = getSearchablePageItems();
        items.forEach(item => {
            const visible = !query || normalizeSearchValue(item.textContent).includes(query);
            item.style.display = visible ? '' : 'none';
        });
        return items.filter(item => !query || normalizeSearchValue(item.textContent).includes(query)).length;
    }

    function filterPageSpecificContent(query) {
        const page = (window.location.pathname.split('/').pop() || '').toLowerCase();
        if ((page === 'calculator.html' || page === 'calculatorilegal.html') && typeof window.filterCalculatorRecipes === 'function') {
            window.filterCalculatorRecipes(query);
        }
        if ((page === 'craftmecanics.html' || page === 'bucatarie.html') && typeof window.filterGallery === 'function') {
            window.filterGallery(query);
        }
    }

    function renderSearchResults(input, query, pageMatchCount) {
        const resultsBox = document.getElementById('global-search-results');
        if (!resultsBox) return;
        if (!query) {
            resultsBox.classList.add('hidden');
            resultsBox.innerHTML = '';
            return;
        }

        const navigationMatches = getAccessibleNavigation()
            .filter(item => normalizeSearchValue(`${item.label} ${item.section} ${item.href}`).includes(query))
            .slice(0, 8);
        const roleLabel = getActiveRoleLabel();
        const roleContext = roleLabel
            ? `<div class="px-4 py-2 text-[10px] uppercase tracking-wider text-emerald-300 border-b border-slate-800">Rol activ: ${escapeHtml(roleLabel)}</div>`
            : '';
        const navHtml = navigationMatches.map(item => `
            <a href="${escapeHtml(item.href)}" class="flex items-center justify-between gap-3 px-4 py-3 text-xs text-slate-200 hover:bg-slate-800 border-b border-slate-800/70">
                <span class="flex items-center gap-3"><span class="text-base">${escapeHtml(item.icon)}</span><span>${escapeHtml(item.label)}</span></span>
                <small class="text-[10px] text-slate-500">${escapeHtml(item.section)}</small>
            </a>
        `).join('');
        const contentHtml = pageMatchCount
            ? `<div class="px-4 py-2 text-[10px] uppercase tracking-wider text-slate-500">${pageMatchCount} rezultat(e) în pagina curentă</div>`
            : '';
        resultsBox.innerHTML = `${roleContext}${navHtml}${contentHtml || (!navigationMatches.length ? '<div class="px-4 py-3 text-xs text-slate-400">Nu am găsit nimic în paginile disponibile pentru rolul tău.</div>' : '')}`;
        resultsBox.classList.remove('hidden');
        input?.setAttribute('aria-expanded', 'true');
    }

    function renderAdvancedSearchResults(input, query, matches) {
        const resultsBox = document.getElementById('global-search-results');
        if (!resultsBox) return;
        resultsBox.innerHTML = '';
        if (!query) {
            resultsBox.classList.add('hidden');
            input?.setAttribute('aria-expanded', 'false');
            return;
        }

        resultsBox.classList.remove('hidden');
        const roleLabel = getActiveRoleLabel();
        if (roleLabel) {
            const context = document.createElement('div');
            context.className = 'px-4 py-2 text-[10px] uppercase tracking-wider text-emerald-300 border-b border-slate-800';
            context.textContent = `Rezultate pentru rolul: ${roleLabel}`;
            resultsBox.appendChild(context);
        }

        if (!Array.isArray(matches) || !matches.length) {
            const empty = document.createElement('div');
            empty.className = 'px-4 py-3 text-xs text-slate-400';
            empty.textContent = 'Nu am găsit informația în paginile permise rolului tău.';
            resultsBox.appendChild(empty);
            input?.setAttribute('aria-expanded', 'true');
            return;
        }

        matches.slice(0, 8).forEach(match => {
            const link = document.createElement('a');
            link.href = match.page;
            link.className = 'flex flex-col gap-1 px-4 py-3 text-xs text-slate-200 hover:bg-slate-800 border-b border-slate-800/70';

            const title = document.createElement('span');
            title.className = 'font-semibold text-emerald-300';
            title.textContent = `Deschide ${match.title || match.page}`;
            link.appendChild(title);

            if (Array.isArray(match.matches) && match.matches.length) {
                const locations = document.createElement('span');
                locations.className = 'text-[10px] leading-4 text-slate-400';
                locations.textContent = `Se află în: ${match.matches.join(' · ')}`;
                link.appendChild(locations);
            }
            resultsBox.appendChild(link);
        });
        input?.setAttribute('aria-expanded', 'true');
    }

    window.renderGlobalSearch = function renderGlobalSearch(event) {
        const input = event?.target || document.getElementById('global-search');
        const query = normalizeSearchValue(input?.value);
        filterPageSpecificContent(query);
        filterCurrentPage(query);

        const request = ++advancedSearchRequest;
        if (advancedSearchTimer) window.clearTimeout(advancedSearchTimer);
        if (!query || query.length < 2) {
            renderAdvancedSearchResults(input, '', []);
            return;
        }

        advancedSearchTimer = window.setTimeout(async () => {
            const engine = getAdvancedSearchEngine();
            if (!engine?.findPageMatches) {
                if (typeof window.getUser === 'function' && window.getUser() && request === advancedSearchRequest) {
                    advancedSearchTimer = window.setTimeout(() => renderGlobalSearch({ target: input }), 420);
                }
                return;
            }
            try {
                const matches = await engine.findPageMatches(query);
                if (request !== advancedSearchRequest) return;
                renderAdvancedSearchResults(input, query, matches);
            } catch (error) {
                console.warn('Căutarea globală nu a putut indexa paginile permise.', error);
                if (request === advancedSearchRequest) renderAdvancedSearchResults(input, query, []);
            }
        }, 260);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalHeader);
    } else {
        initGlobalHeader();
    }
})();
