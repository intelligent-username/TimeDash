export const miscUtils = {
    formatTime(seconds) {
        return TimeUtils.formatTime(Math.max(0, Math.floor(seconds || 0)));
    },

    formatDetailedTime(seconds) {
        return TimeUtils.formatTimeForDisplay(Math.max(0, Math.floor(seconds || 0)));
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
    }
};
