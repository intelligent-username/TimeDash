export const miscUtils = {
    formatTime(seconds) {
        return this._localizeDigits(TimeUtils.formatTime(Math.max(0, Math.floor(seconds || 0))));
    },

    formatDetailedTime(seconds) {
        return this._localizeDigits(
            TimeUtils.formatTimeForDisplay(Math.max(0, Math.floor(seconds || 0)))
        );
    },

    /**
     * Render Western digits using the user's locale numbering system
     * @param {string} str - String containing plain integers
     * @returns {string} Locale-formatted string
     */
    _localizeDigits(str) {
        try {
            const formatter = new Intl.NumberFormat(navigator.language);
            return str.replace(/\d+/g, (d) => formatter.format(Number(d)));
        } catch {
            return str;
        }
    },

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    },

    extractDomain(url) {
        return DomainUtils.extractDomain(url);
    },

    shouldTrackUrl(url) {
        return DomainUtils.shouldTrackUrl(url);
    },

    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    },
};
