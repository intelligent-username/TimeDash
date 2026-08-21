const _nativeChromeGetMessage =
    typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function'
        ? chrome.i18n.getMessage.bind(chrome.i18n)
        : null;

if (_nativeChromeGetMessage) {
    try {
        chrome.i18n.getMessage = function (key, substitutions) {
            if (I18n.activeMessages && I18n.activeMessages[key]) {
                return I18n.t(key, substitutions);
            }
            return _nativeChromeGetMessage(key, substitutions);
        };
    } catch {
        /* ignore */
    }
}

/**
 * I18n utility for internationalization support with dynamic locale switching
 */
class I18n {
    static currentLocale = 'auto';
    static messagesCache = new Map();
    static activeMessages = null;

    /**
     * Set the current active locale and load its messages
     * @param {string} locale - Locale code ('auto', 'en', 'es', 'de', 'fr', 'it', 'nl', 'pl', 'pt', 'sv', 'zh_CN', 'ar')
     * @returns {Promise<void>}
     */
    static async setLocale(locale = 'auto') {
        this.currentLocale = locale;
        if (!locale || locale === 'auto') {
            this.activeMessages = null;
            return;
        }

        if (this.messagesCache.has(locale)) {
            this.activeMessages = this.messagesCache.get(locale);
            return;
        }

        try {
            const url = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
                ? chrome.runtime.getURL(`_locales/${locale}/messages.json`)
                : `/_locales/${locale}/messages.json`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                this.messagesCache.set(locale, data);
                this.activeMessages = data;
            }
        } catch (e) {
            console.warn(`[I18n] Failed to load locale "${locale}":`, e);
            this.activeMessages = null;
        }
    }

    /**
     * Get localized message
     * @param {string} key - Message key
     * @param {string[]|string|number} substitutions - Substitution values
     * @returns {string} Localized message or key if not found
     */
    static t(key, substitutions = []) {
        const subs = Array.isArray(substitutions) ? substitutions : [substitutions];

        if (this.activeMessages && this.activeMessages[key] && this.activeMessages[key].message) {
            let msg = this.activeMessages[key].message;
            const placeholders = this.activeMessages[key].placeholders;

            if (placeholders) {
                for (const [name, pDef] of Object.entries(placeholders)) {
                    const contentRef = pDef.content; // e.g. "$1"
                    const indexMatch = contentRef && contentRef.match(/^\$(\d+)$/);
                    let subVal = '';
                    if (indexMatch) {
                        const idx = parseInt(indexMatch[1], 10) - 1;
                        subVal = subs[idx] !== undefined ? subs[idx] : '';
                    }
                    const regex = new RegExp(`\\$${name}\\$`, 'gi');
                    msg = msg.replace(regex, subVal);
                }
            }

            subs.forEach((sub, idx) => {
                msg = msg.replace(new RegExp(`\\$${idx + 1}`, 'g'), sub !== undefined ? sub : '');
            });

            return msg;
        }

        try {
            if (_nativeChromeGetMessage) {
                return _nativeChromeGetMessage(key, subs) || key;
            }
            if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
                return chrome.i18n.getMessage(key, subs) || key;
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
        const manifestVersion =
            typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest
                ? chrome.runtime.getManifest()?.version || '1.3.7'
                : '1.3.7';

        const nodes = root.querySelectorAll('[data-i18n], [data-i18n-html]');
        nodes.forEach((node) => {
            const isHtml = node.hasAttribute('data-i18n-html');
            const key = isHtml ? node.getAttribute('data-i18n-html') : node.getAttribute('data-i18n');
            const subs = key === 'helpAboutBody' ? [manifestVersion] : [];
            const text = I18n.t(key, subs);
            if (text) {
                if (isHtml || /<[a-z][\s\S]*>/i.test(text)) {
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
