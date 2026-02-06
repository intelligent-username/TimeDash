/**
 * Get Google Favicon URL for a domain
 * @param {string} domain 
 * @returns {string} Image URL
 */
export function getFaviconUrl(domain) {
    if (!domain) return '';
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
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
        notification.remove();
    }, 5000);
}
