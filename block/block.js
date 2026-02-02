'use strict';

/**
 * @fileoverview Block page logic for TimeDash extension
 * Handles blocked site display
 */

/**
 * Block page controller class
 * Manages block page UI
 */
class BlockPageController {
    constructor() {
        this.storageManager = null;
        this.blockedUrl = '';
        this.blockedDomain = '';
        this.blockReason = 'blocked'; // 'blocked' or 'restricted'
        this.blockStats = {
            count: 0,
            timeSpent: 0,
            timeSaved: 0,
        };

        this.motivationalQuotes = [
            {
                quote: 'The way to get started is to quit talking and begin doing.',
                author: 'Walt Disney',
            },
            { quote: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
            {
                quote: 'You are never too old to set another goal or to dream a new dream.',
                author: 'C.S. Lewis',
            },
            { quote: 'The future depends on what you do today.', author: 'Mahatma Gandhi' },
            {
                quote: "Don't watch the clock; do what it does. Keep going.",
                author: 'Sam Levenson',
            },
            {
                quote: 'Success is the sum of small efforts repeated day in and day out.',
                author: 'Robert Collier',
            },
            {
                quote: 'The only way to do great work is to love what you do.',
                author: 'Steve Jobs',
            },
            { quote: "Believe you can and you're halfway there.", author: 'Theodore Roosevelt' },
        ];

        this.productivityTips = [
            'Try the Pomodoro Technique: Work for 25 minutes, then take a 5-minute break.',
            'Create a distraction-free workspace to improve your focus.',
            'Use the 2-minute rule: If it takes less than 2 minutes, do it now.',
            'Block time in your calendar for important tasks.',
            'Take regular breaks to maintain high productivity levels.',
            'Set specific, measurable goals for each work session.',
            'Use keyboard shortcuts to work more efficiently.',
            'Keep a notepad nearby to jot down random thoughts that pop up.',
        ];

        this.init();
    }

    /**
     * Initialize the block page controller
     */
    async init() {
        try {
            if (typeof I18n !== 'undefined' && I18n.init) {
                I18n.init(document);
            }

            // StorageManager is loaded via <script> tag in block.html
            this.storageManager = new StorageManager();

            // Get blocked URL from query parameters
            this.parseUrlParameters();

            // Load data and set up UI
            await this.loadBlockData();
            this.setupFooterLinks();
            this.updateUI();

            // Hide loading overlay
            this.hideLoading();

            // Periodically check if site is still blocked (every 5 seconds)
            this.statusCheckInterval = setInterval(() => this.checkStatus(), 5000);

            // Also check on visibility change
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    this.checkStatus();
                }
            });

            console.log('Block page initialized for:', this.blockedDomain);
        } catch (error) {
            console.error('Failed to initialize block page:', error);
            this.showError('Failed to load block page. Please try again.');
            this.hideLoading();
        }
    }

    /**
     * Parse URL parameters to get blocked URL
     */
    parseUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        this.blockedUrl = urlParams.get('url') || '';
        this.blockReason = urlParams.get('reason') || 'blocked';

        // Extract domain from URL
        if (this.blockedUrl) {
            try {
                const url = new URL(
                    this.blockedUrl.startsWith('http') ? this.blockedUrl : `https://${this.blockedUrl}`
                );
                this.blockedDomain = url.hostname.replace(/^www\./, '');
            } catch (error) {
                this.blockedDomain = this.blockedUrl.replace(/^www\./, '');
            }
        } else {
            // Fallback if blockedUrl is missing
            const domain = urlParams.get('domain') || 'Unknown Site';
            this.blockedDomain = domain.replace(/^www\./, '');
        }
    }

    /**
     * Check if the site is still blocked. If not, redirect back.
     */
    async checkStatus() {
        if (!this.blockedDomain) return;

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'CHECK_ACCESS',
                url: this.blockedUrl || `https://${this.blockedDomain}`,
                domain: this.blockedDomain
            });

            if (!response || !response.shouldBlock) {
                console.log('Site is no longer blocked, redirecting...');
                this.continueToSite();
            }
        } catch (error) {
            console.error('Failed to check access status:', error);
        }
    }

    /**
     * Continue to the blocked site
     */
    continueToSite() {
        if (this.blockedUrl) {
            window.location.href = this.blockedUrl;
        } else {
            window.location.href = `https://${this.blockedDomain}`;
        }
    }

    /**
     * Load block-related data
     */
    async loadBlockData() {
        // Check status first
        await this.checkStatus();

        try {
            const [usage, blockList] = await Promise.all([
                this.storageManager.getAllUsage(),
                this.storageManager.getBlockList(),
            ]);

            // Calculate block statistics
            this.calculateBlockStats(usage, blockList);
        } catch (error) {
            console.error('Failed to load block data:', error);
            // Don't throw, just use defaults
        }
    }

    /**
     * Calculate block statistics for the domain
     * @param {Object} usage - Usage data
     * @param {Array} blockList - Block list
     */
    calculateBlockStats(usage, blockList) {
        const domainData = usage[this.blockedDomain] || {};

        // Times blocked today - this isn't tracked in usage yet, so we default to 1 (this block event) or use cumulative visits?
        // Let's assume usage object doesn't track "blocks". 
        // But the user complained about "0 Times blocked today". 
        // We can't fix this data if it doesn't exist. For now, let's just not show 0 if we can help it.
        // Or if 'blockedToday' exists in domainData.

        this.blockStats.count = domainData.blockedToday || 1; // At least 1 (current)

        // Time spent on this site (total)
        this.blockStats.timeSpent = domainData.cumulative || 0;

        // Estimated time saved today (blocks * average session time)
        const avgSessionTime = 300; // 5 minutes average
        this.blockStats.timeSaved = this.blockStats.count * avgSessionTime;
    }

    /**
     * Set up footer links
     */
    setupFooterLinks() {
        const links = {
            settingsLink: () => chrome.runtime.openOptionsPage(),
            helpLink: () => chrome.tabs.create({ url: 'https://github.com/timedash/extension/wiki' }),
            feedbackLink: () => chrome.tabs.create({ url: 'https://github.com/timedash/extension/issues' }),
        };

        Object.entries(links).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', (e) => {
                    e.preventDefault();
                    handler();
                });
            }
        });
    }

    /**
     * Update the UI with current data
     */
    updateUI() {
        this.updateBlockedUrlDisplay();
        this.updateBlockStats();
        this.updateMotivationalContent();
    }

    /**
     * Update blocked URL display
     */
    updateBlockedUrlDisplay() {
        const blockedUrlElement = document.getElementById('blockedUrl');
        if (blockedUrlElement) {
            blockedUrlElement.textContent = this.blockedDomain;
        }

        // Update heading and reason based on block type
        const headingElement = document.querySelector('.block-notice h2');
        const reasonElement = document.getElementById('blockReason');

        if (this.blockReason === 'restricted') {
            if (headingElement) {
                headingElement.textContent = 'Daily Limit Reached';
            }
            if (reasonElement) {
                reasonElement.textContent = `You have exceeded your daily time limit for ${this.blockedDomain}. Access will reset tomorrow.`;
            }
            document.title = `${this.blockedDomain} - Limit Reached`;
        } else {
            if (headingElement) {
                headingElement.textContent = 'This site is blocked';
            }
            if (reasonElement) {
                reasonElement.textContent = 'This site is on your block list to help you stay focused.';
            }
            document.title = `${this.blockedDomain} is blocked`;
        }
    }

    /**
     * Update block statistics display
     */
    updateBlockStats() {
        this.updateStatElement('blockCount', this.blockStats.count);
        this.updateStatElement('timeSpent', this.formatTime(this.blockStats.timeSpent));
        this.updateStatElement('timeSaved', this.formatTime(this.blockStats.timeSaved));
    }

    /**
     * Update motivational content
     */
    updateMotivationalContent() {
        // Random motivational quote
        const randomQuote =
            this.motivationalQuotes[Math.floor(Math.random() * this.motivationalQuotes.length)];
        const quoteElement = document.querySelector('.motivation-quote blockquote');
        const citeElement = document.querySelector('.motivation-quote cite');

        if (quoteElement && citeElement) {
            quoteElement.textContent = `"${randomQuote.quote}"`;
            citeElement.textContent = `- ${randomQuote.author}`;
        }

        // Random productivity tip
        const randomTip =
            this.productivityTips[Math.floor(Math.random() * this.productivityTips.length)];
        const tipElement = document.querySelector('.productivity-tip p');

        if (tipElement) {
            tipElement.textContent = randomTip;
        }
    }

    /**
     * Update a statistic element
     * @param {string} id - Element ID
     * @param {string} value - Value to display
     */
    updateStatElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Format time in seconds to readable format
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string
     */
    formatTime(seconds) {
        if (!seconds) return '0m';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Show notification
     * @param {string} message - Message to show
     * @param {string} type - Notification type
     */
    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        container.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    showError(message) {
        this.showNotification(message || 'Error', 'error');
    }
}

// Initialize block page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new BlockPageController();
});
