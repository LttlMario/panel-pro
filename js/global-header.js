(function() {
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
                <div class="${searchWrapperClass}">
                    <input id="global-search" type="search" autocomplete="off" placeholder="Caută: Runflat, pontaj, învoire..." class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500">
                    <div id="global-search-results" class="hidden absolute right-0 mt-2 w-full max-h-80 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl z-50"></div>
                </div>
            </header>
        `;

        host.insertAdjacentHTML('beforeend', headerHTML);

        const mobileBtn = host.querySelector('#global-header-mobile-btn');
        if (mobileBtn && typeof window.toggleMobileMenu === 'function') {
            mobileBtn.addEventListener('click', window.toggleMobileMenu);
        }

        const searchInput = host.querySelector('#global-search');
        if (searchInput && typeof window.renderGlobalSearch === 'function') {
            searchInput.addEventListener('input', window.renderGlobalSearch);
            searchInput.addEventListener('focus', window.renderGlobalSearch);
        }
    }

    window.renderGlobalSearch = window.renderGlobalSearch || function renderGlobalSearch(event) {
        const query = String(event?.target?.value || '').trim().toLocaleLowerCase('ro');
        const content = [...document.querySelectorAll('main article, main section, main .card, main .panel, main li')]
            .filter((element) => !element.closest('#panel-header-host, #panel-global-footer, #panel-sidebar-host'));
        content.forEach((element) => {
            if (!query || element.textContent.toLocaleLowerCase('ro').includes(query)) element.style.removeProperty('display');
            else if (!element.matches('#calculator-input-panel, #calculator-results')) element.style.display = 'none';
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalHeader);
    } else {
        initGlobalHeader();
    }
})();
