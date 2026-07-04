/**
 * Domain utility functions for parsing and normalizing URLs and domains
 */
class DomainUtils {
    /**
     * Extract domain from URL
     * @param {string} url - Full URL
     * @returns {string} Domain name
     */
    static extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '');
        } catch {
            // Fallback for invalid URLs
            const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^/?#]+)/);
            return match ? match[1].replace(/^www\./, '') : url;
        }
    }

    /**
     * Normalize domain for consistent storage
     * @param {string} domain - Domain to normalize
     * @returns {string} Normalized domain
     */
    static normalizeDomain(domain) {
        return domain
            .toLowerCase()
            .replace(/^www\./, '')
            .trim();
    }

    /**
     * Check if domain is valid
     * @param {string} domain - Domain to validate
     * @returns {boolean} True if domain is valid
     */
    static isValidDomain(domain) {
        const domainRegex =
            /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;
        return domainRegex.test(domain) && domain.includes('.');
    }

    /**
     * Check if URL should be tracked (exclude internal browser pages, extensions, etc.)
     * @param {string} url - URL to check
     * @returns {boolean} True if URL should be tracked
     */
    static shouldTrackUrl(url) {
        if (!url) return false;

        const excludedSchemes = [
            'chrome:',
            'chrome-extension:',
            'moz-extension:',
            'edge:',
            'about:',
            'file:',
            'data:',
        ];
        const excludedDomains = ['localhost', '127.0.0.1', '0.0.0.0'];

        // Check for excluded schemes
        if (excludedSchemes.some((scheme) => url.startsWith(scheme))) {
            return false;
        }

        try {
            const domain = this.extractDomain(url);

            // Check for excluded domains
            if (excludedDomains.includes(domain)) {
                return false;
            }

            // Check if it's a valid trackable domain
            return this.isValidDomain(domain);
        } catch {
            return false;
        }
    }

    /**
     * Get favicon URL for a domain
     * @param {string} domain - Domain to get favicon for
     * @returns {string} Favicon URL
     */
    static getFaviconUrl(domain) {
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    }

    /**
     * Get display name for domain (capitalize first letter)
     * @param {string} domain - Domain to get display name for
     * @returns {string} Display name
     */
    static getDisplayName(domain) {
        return domain.charAt(0).toUpperCase() + domain.slice(1);
    }

    /**
     * Group domains by category for analytics
     * @param {Array<string>} domains - Array of domains
     * @returns {object} Grouped domains by category
     */
}
