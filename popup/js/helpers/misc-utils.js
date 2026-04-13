export const miscUtils = {
    formatTime(seconds) {
        return TimeUtils.formatTime(Math.max(0, Math.floor(seconds || 0)));
    },

    formatDetailedTime(seconds) {
        return TimeUtils.formatTimeForDisplay(Math.max(0, Math.floor(seconds || 0)));
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
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

    formatNumber(num) {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    },

    getProductivityColor(score) {
        if (score >= 80) return '#4CAF50';
        if (score >= 60) return '#FF9800';
        if (score >= 40) return '#FFC107';
        return '#F44336';
    },

    calculatePercentage(part, total) {
        if (total === 0) return 0;
        return Math.round((part / total) * 100);
    },

    sanitizeHTML(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
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
