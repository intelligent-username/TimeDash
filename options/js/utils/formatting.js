/**
 * Format milliseconds into readable duration
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted string (e.g., "2h 30m" or "45m")
 */
export function formatTime(ms) {
    if (!ms) return '0m';

    // Check if input is seconds (historically might be) or ms
    // Usage is usually stored in ms.

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
}

/**
 * Format date object to YYYY-MM-DD string
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
