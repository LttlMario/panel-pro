(function () {
    const eyeIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M2.06 12.35a1 1 0 0 1 0-.7C3.74 7.96 7.63 5.5 12 5.5s8.26 2.46 9.94 6.15a1 1 0 0 1 0 .7C20.26 16.04 16.37 18.5 12 18.5s-8.26-2.46-9.94-6.15Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    const eyeOffIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="m3 3 18 18"></path><path d="M10.58 10.58a2 2 0 0 0 2.83 2.83"></path><path d="M9.88 5.09A10.94 10.94 0 0 1 12 4.9c4.37 0 8.26 2.46 9.94 6.15a1 1 0 0 1 0 .7 11.4 11.4 0 0 1-2.19 3.15"></path><path d="M6.61 6.61A11.5 11.5 0 0 0 2.06 11.65a1 1 0 0 0 0 .7C3.74 16.04 7.63 18.5 12 18.5c1.61 0 3.13-.32 4.49-.9"></path></svg>';

    function bindPasswordVisibility(input) {
        if (!input || input.dataset.passwordVisibilityBound === 'true') return;
        const spacingClass = input.classList.contains('mt-2') ? 'mt-2' : 'mt-1';
        const holder = document.createElement('div');
        holder.className = `relative ${spacingClass} w-full`;
        input.parentElement.insertBefore(holder, input);
        holder.appendChild(input);
        input.classList.remove('mt-1', 'mt-2');
        input.classList.add('pr-16');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-cyan-300 transition hover:bg-cyan-400/10 hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/50';
        button.style.right = '0.75rem';
        button.style.top = 'calc(50% + 1rem)';
        button.style.transform = 'translateY(-50%)';
        button.innerHTML = eyeIcon;
        button.setAttribute('aria-label', 'Arată parola');
        button.title = 'Arată parola';
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
            const visible = input.type === 'text';
            input.type = visible ? 'password' : 'text';
            button.innerHTML = visible ? eyeIcon : eyeOffIcon;
            button.setAttribute('aria-label', visible ? 'Arată parola' : 'Ascunde parola');
            button.title = visible ? 'Arată parola' : 'Ascunde parola';
            button.setAttribute('aria-pressed', visible ? 'false' : 'true');
        });
        holder.appendChild(button);
        input.dataset.passwordVisibilityBound = 'true';
    }

    function bindAllPasswordFields() {
        document.querySelectorAll('input[type="password"]').forEach(bindPasswordVisibility);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindAllPasswordFields, { once: true });
    } else {
        bindAllPasswordFields();
    }
})();
