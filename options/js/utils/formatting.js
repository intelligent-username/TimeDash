/**
 * Format milliseconds into readable duration
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted string (e.g., "2h 30m" or "45m")
 */
export function formatTime(ms) {
    return TimeUtils.formatMilliseconds(ms);
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
