/**
 * Get Google Favicon URL for a domain
 * @param {string} domain - Domain name.
 * @returns {string} Image URL
 */
export function getFaviconUrl(domain) {
    if (!domain) return '';
    return `https://www.google.com/s2/favicons?domain=https://${domain}&sz=32`;
}

// ── Favicon cache (30-day TTL, stored in chrome.storage.local) ──────────────

const FAVICON_CACHE_PREFIX = 'faviconCache:';
const FAVICON_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

async function faviconCacheGet(domain) {
    try {
        const result = await chrome.storage.local.get(FAVICON_CACHE_PREFIX + domain);
        return result[FAVICON_CACHE_PREFIX + domain] || null;
    } catch {
        return null;
    }
}

async function faviconCacheSet(domain, dataUrl) {
    try {
        // Purge any trace of the previous entry before writing the new one
        await chrome.storage.local.remove(FAVICON_CACHE_PREFIX + domain);
        await chrome.storage.local.set({
            [FAVICON_CACHE_PREFIX + domain]: { dataUrl, fetchedAt: Date.now() },
        });
    } catch {
        /* cache write failures are non-critical */
    }
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function fetchFaviconDataUrl(url) {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return null;
        const blob = await response.blob();
        if (!blob.type.startsWith('image/') || blob.size === 0) return null;
        return await blobToDataUrl(blob);
    } catch {
        return null;
    }
}

/**
 * Fill an <img data-domain> from the favicon cache, refreshing from the
 * network at most once per TTL (30 days) per domain. Google's service is
 * the primary source; the site's own /favicon.ico is the backup. A failed
 * lookup is also cached (negative entry) so dead sites don't re-request
 * until the TTL expires.
 * @param {HTMLImageElement} img - Image element to hydrate.
 */
export async function hydrateFavicon(img) {
    const domain = (img.dataset.domain || '').trim().replace(/^www\./, '');
    if (!domain) return;

    const cached = await faviconCacheGet(domain);
    if (cached && Date.now() - cached.fetchedAt < FAVICON_CACHE_TTL) {
        if (cached.dataUrl) {
            img.src = cached.dataUrl;
        } else {
            replaceWithAvatar(img, domain);
        }
        return;
    }

    let dataUrl = await fetchFaviconDataUrl(getFaviconUrl(domain));
    if (!dataUrl) {
        dataUrl = await fetchFaviconDataUrl(`https://${domain}/favicon.ico`);
    }

    await faviconCacheSet(domain, dataUrl);

    if (dataUrl) {
        img.src = dataUrl;
    } else {
        replaceWithAvatar(img, domain);
    }
}

/**
 * Hydrate every favicon <img data-domain> inside a container.
 * Call after setting container.innerHTML with favicon <img> elements.
 * @param {HTMLElement} container - Parent element containing favicon images.
 */
export function hydrateFavicons(container) {
    if (!container) return;
    container.querySelectorAll('img[data-domain]').forEach((img) => {
        hydrateFavicon(img);
    });
}

function replaceWithAvatar(img, domain) {
    const letter = (domain[0] || '?').toUpperCase();
    const span = document.createElement('span');
    span.className = `${img.className} favicon-fallback`.trim();
    span.textContent = letter;
    img.replaceWith(span);
}

/**
 * Progressively recover a failed favicon image:
 * 1. retry against the site's own /favicon.ico
 * 2. replace with a letter-avatar tile
 * @param {HTMLImageElement} img - Image with data-domain attribute
 */
export function handleFaviconError(img) {
    const domain = (img.dataset.domain || '').trim().replace(/^www\./, '');
    const stage = img.dataset.faviconStage || '0';

    if (stage === '0' && domain) {
        img.dataset.faviconStage = '1';
        img.src = `https://${domain}/favicon.ico`;
        return;
    }

    replaceWithAvatar(img, domain);
}

/**
 * Show a toast notification
 * @param {string} message - Message text.
 * @param {string} [type] - Toast style type ('info' | 'success' | 'error' | 'warning').
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
