(function () {
    const markerPattern = /[ÃÂÄÅÈâðï\uFFFD]/;
    const windows1252Bytes = {
        '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
        'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e,
        '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
        '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f
    };
    const replacements = [
        ['Rom\uFFFDniei', 'României'], ['oric\uFFFDnd', 'oricând'], ['c\uFFFDnd', 'când'],
        ['p\uFFFDn\uFFFD', 'până'], ['p\uFFFDnă', 'până'], ['P\uFFFDnă', 'Până'],
        ['Sf\uFFFD rșitul'.replace(' ', ''), 'Sfârșitul'], ['Sf\uFFFD rșit'.replace(' ', ''), 'Sfârșit'],
        ['înt\uFFFDi', 'întâi'], ['respect\uFFFDnd', 'respectând'], ['r\uFFFDndul', 'rândul'],
        ['r\uFFFDnduri', 'rânduri'], ['c\uFFFDte', 'câte'], ['c\uFFFDteva', 'câteva'],
        ['c\uFFFDmpurile', 'câmpurile'], ['C\uFFFDmpuri', 'Câmpuri'], ['c\uFFFDmpul', 'câmpul'],
        ['c\uFFFDmpului', 'câmpului'], ['c\uFFFDmp', 'câmp'], ['at\uFFFDt', 'atât'],
        ['constr\uFFFDngeri', 'constrângeri'], ['aparțin\uFFFDnd', 'aparținând'],
        ['încep\uFFFDnd', 'începând'], ['s\uFFFDpt\uFFFDm\uFFFDnal', 'săptămânal'],
        ['săptăm\uFFFDnal', 'săptămânal'], ['săptăm\uFFFDna', 'săptămâna'],
        ['V\uFFFDnzare', 'Vânzare'], ['Mai t\uFFFDrziu', 'Mai târziu'],
        ['r\uFFFDm\uFFFDne', 'rămâne'], ['r\uFFFDm\uFFFDn', 'rămân'], ['r\uFFFDmas', 'rămas'],
        ['st\uFFFDnga', 'stânga'], ['st\uFFFDng', 'stâng'], ['dreapta', 'dreapta']
    ];

    function decodeToken(token) {
        if (!markerPattern.test(token)) return token;
        const bytes = [];
        for (const character of token) {
            const code = character.charCodeAt(0);
            if (code <= 255) bytes.push(code);
            else if (windows1252Bytes[character]) bytes.push(windows1252Bytes[character]);
            else return token;
        }
        try {
            return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        } catch (_) {
            return token;
        }
    }

    function normalize(value) {
        let result = String(value ?? '');
        for (let pass = 0; pass < 2; pass += 1) {
            result = result.replace(/[^\s<>"'`=]+/g, decodeToken);
        }
        replacements.forEach(([from, to]) => { result = result.split(from).join(to); });
        result = result
            .replace(/răm\uFFFDne/gi, (value) => value[0] === 'R' ? 'Rămâne' : 'rămâne')
            .replace(/răm\uFFFDn/gi, (value) => value[0] === 'R' ? 'Rămân' : 'rămân')
            .replace(/săptăm\uFFFDna/gi, (value) => value[0] === 'S' ? 'Săptămâna' : 'săptămâna')
            .replace(/săptăm\uFFFDnal/gi, (value) => value[0] === 'S' ? 'Săptămânal' : 'săptămânal');
        return result;
    }

    function normalizeElement(element) {
        if (element.nodeType === Node.TEXT_NODE) {
            const normalized = normalize(element.nodeValue);
            if (normalized !== element.nodeValue) element.nodeValue = normalized;
            return;
        }
        if (element.nodeType !== Node.ELEMENT_NODE) return;
        ['placeholder', 'title', 'aria-label', 'alt', 'value'].forEach((attribute) => {
            if (!element.hasAttribute(attribute)) return;
            const current = element.getAttribute(attribute);
            const normalized = normalize(current);
            if (normalized !== current) element.setAttribute(attribute, normalized);
        });
        if (element.tagName === 'TITLE' || element.tagName === 'OPTION' || element.tagName === 'TEXTAREA') {
            const normalized = normalize(element.textContent);
            if (normalized !== element.textContent) element.textContent = normalized;
        }
    }

    function normalizeTree(root) {
        if (!root) return;
        normalizeElement(root);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        let current;
        while ((current = walker.nextNode())) normalizeElement(current);
    }

    function init() {
        normalizeTree(document.documentElement);
        const observer = new MutationObserver((records) => {
            records.forEach((record) => {
                record.addedNodes.forEach((node) => normalizeTree(node));
                if (record.type === 'characterData') normalizeElement(record.target);
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

        const nativeAlert = window.alert;
        window.alert = (message) => nativeAlert.call(window, normalize(message));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
