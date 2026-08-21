/**
 * I18n utility for internationalization support
 */
class I18n {
    /**
     * Get localized message
     * @param {string} key - Message key
     * @param {string[]} substitutions - Substitution values
     * @returns {string} Localized message or key if not found
     */
    static t(key, substitutions = []) {
        try {
            if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
                return chrome.i18n.getMessage(key, substitutions) || key;
            }
        } catch {
            /* chrome.i18n unavailable */
        }
        return key;
    }

    /**
     * Initialize i18n for DOM elements with data-i18n attributes
     * @param {Element} root - Root element to search within
     */
    static init(root = document) {
        const nodes = root.querySelectorAll('[data-i18n]');
        nodes.forEach((node) => {
            const key = node.getAttribute('data-i18n');
            const text = I18n.t(key);
            if (text) {
                // Prefer textContent to prevent XSS; allow data-i18n-html for intentional HTML
                if (node.hasAttribute('data-i18n-html')) {
                    node.innerHTML = text;
                } else {
                    node.textContent = text;
                }
            }
        });

        // aria-label translations
        const ariaNodes = root.querySelectorAll('[data-i18n-aria-label]');
        ariaNodes.forEach((node) => {
            const key = node.getAttribute('data-i18n-aria-label');
            const text = I18n.t(key);
            if (text) node.setAttribute('aria-label', text);
        });

        // title/tooltip translations
        const titleNodes = root.querySelectorAll('[data-i18n-title]');
        titleNodes.forEach((node) => {
            const key = node.getAttribute('data-i18n-title');
            const text = I18n.t(key);
            if (text) node.setAttribute('title', text);
        });

        // placeholder translations
        const placeholderNodes = root.querySelectorAll('[data-i18n-placeholder]');
        placeholderNodes.forEach((node) => {
            const key = node.getAttribute('data-i18n-placeholder');
            const text = I18n.t(key);
            if (text) node.setAttribute('placeholder', text);
        });
    }

    /**
     * Format a count using paired plural keys ($COUNT$ placeholder)
     * @param {number} count - Count value
     * @param {string} oneKey - Message key for count === 1
     * @param {string} manyKey - Message key for other counts
     * @returns {string} Localized string with $COUNT$ substituted
     */
    static plural(count, oneKey, manyKey) {
        return I18n.t(count === 1 ? oneKey : manyKey, [I18n.formatNumber(count)]);
    }

    /**
     * Format number using locale-specific formatting
     * @param {number} value - Value to format
     * @param {string} locale - Locale string
     * @returns {string} Formatted number
     */
    static formatNumber(value, locale = navigator.language) {
        try {
            return new Intl.NumberFormat(locale).format(value);
        } catch {
            return String(value);
        }
    }

    /**
     * Format date using locale-specific formatting
     * @param {Date} date - Date to format
     * @param {object} options - Formatting options
     * @param {string} locale - Locale string
     * @returns {string} Formatted date
     */
    static formatDate(date, options = {}, locale = navigator.language) {
        try {
            return new Intl.DateTimeFormat(locale, options).format(date);
        } catch {
            return date.toString();
        }
    }
}

// Export for module usage
