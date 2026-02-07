'use strict';

/**
 * Popup helpers for DOM & utilities
 */
class PopupHelpers {
    /**
     * Format time in seconds to readable format
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string
     */
    static formatTime(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes}m`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
    }

    /**
     * Format time for detailed display
     * @param {number} seconds - Time in seconds
     * @returns {string} Detailed formatted time string
     */
    static formatDetailedTime(seconds) {
        if (seconds < 60) {
            return `${seconds} seconds`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            if (remainingSeconds > 0) {
                return `${minutes} minutes, ${remainingSeconds} seconds`;
            }
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            let result = `${hours} hour${hours !== 1 ? 's' : ''}`;
            if (minutes > 0) {
                result += `, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
            }
            return result;
        }
    }

    /**
     * Get favicon URL for a domain
     * @param {string} domain - Domain to get favicon for
     * @returns {string} Favicon URL
     */
    static getFaviconUrl(domain) {
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    }

    /**
     * Capitalize first letter of a string
     * @param {string} str - String to capitalize
     * @returns {string} Capitalized string
     */
    static capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Create a DOM element with attributes and content
     * @param {string} tag - HTML tag name
     * @param {Object} attributes - Element attributes
     * @param {string|Node} content - Element content
     * @returns {HTMLElement} Created element
     */
    static createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);

        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else {
                element.setAttribute(key, value);
            }
        });

        if (typeof content === 'string') {
            element.textContent = content;
        } else if (content instanceof Node) {
            element.appendChild(content);
        }

        return element;
    }

    /**
     * Create a site item element for the sites list
     * @param {Object} siteData - Site data object
     * @returns {HTMLElement} Site item element
     */
    static createSiteItem(siteData) {
        const { domain, todayTime, totalTime, isBlocked, productivity } = siteData;

        const siteItem = this.createElement('div', { className: 'site-item' });

        // Site info
        const siteInfo = this.createElement('div', { className: 'site-item-info' });

        const favicon = this.createElement('img', {
            className: 'site-item-favicon',
            src: this.getFaviconUrl(domain),
            alt: domain,
            onerror: "this.style.display='none'",
        });

        const details = this.createElement('div', { className: 'site-item-details' });
        const name = this.createElement(
            'div',
            { className: 'site-item-name' },
            this.capitalize(domain)
        );
        const time = this.createElement(
            'div',
            { className: 'site-item-time' },
            this.formatDetailedTime(todayTime)
        );

        details.appendChild(name);
        details.appendChild(time);

        siteInfo.appendChild(favicon);
        siteInfo.appendChild(details);

        // Site actions
        const actions = this.createElement('div', { className: 'site-item-actions' });

        const blockBtn = this.createElement('button', {
            className: `site-item-btn ${isBlocked ? 'blocked' : ''}`,
            title: isBlocked ? 'Unblock site' : 'Block site',
            'data-domain': domain,
        });

        blockBtn.innerHTML = isBlocked
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12C20,14.4 19,16.5 17.3,18.1L5.9,6.7C7.5,5 9.6,4 12,4M12,20A8,8 0 0,1 4,12C4,9.6 5,7.5 6.7,5.9L18.1,17.3C16.5,19 14.4,20 12,20Z"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z"/></svg>';

        actions.appendChild(blockBtn);

        siteItem.appendChild(siteInfo);
        siteItem.appendChild(actions);

        return siteItem;
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type of notification (success, error, info)
     * @param {number} duration - Duration in milliseconds
     */
    static showToast(message, type = 'info', duration = 3000) {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const colors = {
            success: '#4CAF50',
            error: '#F44336',
            warning: '#FF9800',
            info: '#2196F3',
        };

        const toast = this.createElement(
            'div',
            {
                className: 'toast',
                style: {
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    background: colors[type] || colors.info,
                    color: 'white',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    zIndex: '10000',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    transform: 'translateX(100%)',
                    transition: 'transform 0.3s ease, opacity 0.3s ease',
                    maxWidth: '300px',
                    wordWrap: 'break-word',
                },
            },
            message
        );

        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
        });

        // Auto-hide
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, duration);
    }

    /**
     * Update element with fade animation
     * @param {HTMLElement} element - Element to update
     * @param {string|Node} content - New content
     */
    static updateWithFade(element, content) {
        element.style.opacity = '0.5';

        setTimeout(() => {
            if (typeof content === 'string') {
                element.textContent = content;
            } else if (content instanceof Node) {
                element.innerHTML = '';
                element.appendChild(content);
            }
            element.style.opacity = '1';
        }, 150);
    }

    /**
     * Animate element entrance
     * @param {HTMLElement} element - Element to animate
     */
    static animateIn(element) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(10px)';
        element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        });
    }

    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function calls
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    static throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    }

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} Success status
     */
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    }

    /**
     * Format large numbers with appropriate units
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    static formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    /**
     * Get productivity color based on score
     * @param {number} score - Productivity score (0-100)
     * @returns {string} Color hex code
     */
    static getProductivityColor(score) {
        if (score >= 80) return '#4CAF50'; // Green
        if (score >= 60) return '#FF9800'; // Orange
        if (score >= 40) return '#FFC107'; // Yellow
        return '#F44336'; // Red
    }

    /**
     * Calculate percentage with safe division
     * @param {number} part - Part value
     * @param {number} total - Total value
     * @returns {number} Percentage (0-100)
     */
    static calculatePercentage(part, total) {
        if (total === 0) return 0;
        return Math.round((part / total) * 100);
    }

    /**
     * Create loading spinner element
     * @returns {HTMLElement} Loading spinner element
     */
    static createLoadingSpinner() {
        const spinner = this.createElement('div', {
            className: 'loading-spinner',
            style: {
                width: '20px',
                height: '20px',
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #2196F3',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                display: 'inline-block',
            },
        });

        // Add spinner animation if not already added
        if (!document.getElementById('spinner-styles')) {
            const styles = this.createElement('style', { id: 'spinner-styles' });
            styles.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styles);
        }

        return spinner;
    }

    /**
     * Sanitize HTML content to prevent XSS
     * @param {string} html - HTML content to sanitize
     * @returns {string} Sanitized HTML
     */
    static sanitizeHTML(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }

    /**
     * Check if element is in viewport
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} True if element is in viewport
     */
    static isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * Show a banner message to the user
     * @param {string} message - Message to display
     * @param {string} type - Banner type (info, success, warning, error)
     */
    static showBanner(message, type = 'info') {
        let banner = document.getElementById('banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'banner';
            document.body.prepend(banner);
        }
        banner.className = `banner ${type}`;
        banner.setAttribute('role', type === 'error' ? 'alert' : 'status');
        banner.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
        banner.textContent = message;
        banner.style.display = 'block';
    }

    /**
     * Hide the banner message
     */
    static hideBanner() {
        const banner = document.getElementById('banner');
        if (banner) banner.style.display = 'none';
    }

    /**
     * Create a skeleton loading line
     * @param {string} width - Width of the skeleton line
     * @returns {HTMLDivElement} Skeleton line element
     */
    static createSkeletonLine(width = '100%') {
        const line = document.createElement('div');
        line.className = 'skeleton-line';
        line.style.width = width;
        return line;
    }

    /**
     * Inject skeleton loading list into container
     * @param {HTMLElement} container - Container to inject skeleton into
     * @param {number} rows - Number of skeleton rows to create
     */
    static injectSkeletonList(container, rows = 3) {
        if (!container) return;
        container.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'skeleton-list';
        for (let i = 0; i < rows; i++) {
            const row = document.createElement('div');
            row.className = 'skeleton-row';
            row.appendChild(this.createSkeletonLine('60%'));
            row.appendChild(this.createSkeletonLine('30%'));
            wrapper.appendChild(row);
        }
        container.appendChild(wrapper);
    }
}

// Make available globally
window.PopupHelpers = PopupHelpers;
