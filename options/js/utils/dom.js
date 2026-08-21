/**
 * Get Google Favicon URL for a domain
 * @param {string} domain
 * @returns {string} Image URL
 */
export function getFaviconUrl(domain) {
    if (!domain) return '';
    return `https://www.google.com/s2/favicons?domain=https://${domain}&sz=32`;
}

/**
 * Replace failed favicon images inside a container with a letter avatar.
 * Call after setting container.innerHTML with favicon <img> elements.
 * @param {HTMLElement} container
 */
export function attachFaviconFallback(container) {
    if (!container) return;
    container.querySelectorAll('img.analytics-site-favicon').forEach((img) => {
        img.addEventListener(
            'error',
            () => {
                const domain = (img.dataset.domain || '').trim();
                const letter = (domain.replace(/^www\./, '')[0] || '?').toUpperCase();
                const span = document.createElement('span');
                span.className = 'analytics-site-favicon favicon-fallback';
                span.textContent = letter;
                img.replaceWith(span);
            },
            { once: true }
        );
    });
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {string} type
 */
export function showToast(message, type = 'info') {
    // Check if toast container exists
    let container = document.getElementById('toast-notification');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-notification';
        container.className = 'toast';
        document.body.appendChild(container);
    }

    // Create toast element logic (simplified overlay)
    // Or just use the one in options.html

    // Logic from options.js showNotification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('leaving');
        notification.addEventListener('transitionend', () => notification.remove(), { once: true });
        setTimeout(() => notification.remove(), 300); // fallback if transitionend never fires
    }, 5000);
}
