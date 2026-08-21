/**
 * Format milliseconds into readable duration with locale-aware digits
 * @param {number} ms - Time in milliseconds
 * @param compact
 * @returns {string} Formatted string (e.g., "45m")
 */
export function formatTime(ms, compact = false) {
    const formatted = TimeUtils.formatMilliseconds(ms, compact);
    try {
        const formatter = new Intl.NumberFormat(navigator.language);
        return formatted.replace(/\d+/g, (d) => formatter.format(Number(d)));
    } catch {
        return formatted;
    }
}

/**
 * Format date object to YYYY-MM-DD string
 * NOTE: output is the storage-key format used in usage lookups; do not localize.
 * @param {Date} date
 * @returns {string}
 */
export function formatDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Escape HTML special characters
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
