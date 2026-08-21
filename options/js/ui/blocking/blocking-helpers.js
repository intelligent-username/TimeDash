import { handleFaviconError } from '../../utils/dom.js';

export const GROUP_ICONS = {
    folder: `<svg class="icon-folder" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    briefcase: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
    code: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
    book: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
    gamepad: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="3"></rect></svg>`,
    globe: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    play: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
    message: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
    heart: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
    shopping: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
    music: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
    lock: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
};

/**
 * Set up favicon loading with progressive fallbacks:
 * Google's service → the site's own /favicon.ico → letter avatar.
 * @param {HTMLImageElement} img
 * @param {string} domain
 */
export function setupFaviconFallback(img, domain) {
    if (!img || !domain) return;
    img.dataset.domain = domain;
    img.addEventListener('error', () => handleFaviconError(img));
}

/**
 * Create a standardized number input for time limits with validation & arrow controls.
 * @param {number} initialValue
 * @param {number} maxCap
 * @param {Function} onSave - async (newLimit) => void
 * @param {string} title
 * @returns {HTMLInputElement}
 */
export function createLimitInput(initialValue, maxCap, onSave, title = 'Edit daily limit') {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'rule-limit-input-edit';
    input.value = Math.min(initialValue, maxCap);
    input.min = 0;
    input.max = maxCap;
    input.step = 1;
    input.title = title;

    let lastValidLimit = initialValue;

    input.addEventListener('input', () => {
        if (!input.validity.valid || input.value.includes('-')) {
            input.value = input.value.replace(/[-+eE]/g, '');
        }
    });

    const handleSave = async () => {
        const rawVal = input.value.trim();
        let newLimit = parseInt(rawVal, 10);

        if (!input.validity.valid || rawVal === '' || Number.isNaN(newLimit) || newLimit < 0) {
            input.value = lastValidLimit;
            return;
        }

        newLimit = Math.min(newLimit, maxCap);
        input.value = newLimit;

        if (newLimit !== lastValidLimit) {
            lastValidLimit = newLimit;
            await onSave(newLimit);
        }
    };

    input.addEventListener('blur', handleSave);
    input.addEventListener('change', handleSave);
    input.addEventListener('keydown', async (event) => {
        if (['-', '+', 'e', 'E'].includes(event.key)) {
            event.preventDefault();
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            const cur = parseInt(input.value, 10);
            const next = (Number.isNaN(cur) ? 0 : cur) + 1;
            if (next <= maxCap) input.value = next;
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            const cur = parseInt(input.value, 10);
            const next = (Number.isNaN(cur) ? 0 : cur) - 1;
            if (next >= 0) input.value = next;
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            await handleSave();
            input.blur();
        }
    });

    return input;
}
