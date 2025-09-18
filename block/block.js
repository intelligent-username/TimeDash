'use strict';

/**
 * @fileoverview Block page logic for TimeDash extension
 * Handles blocked site display, temporary access, and alternative actions
 */

/**
 * Block page controller class
 * Manages block page UI, temporary access, and user interactions
 */
class BlockPageController {
    constructor() {
        this.storageManager = null;
        this.blockedUrl = '';
        this.blockedDomain = '';
        this.tempAccessTimer = null;
        this.tempAccessEndTime = null;
        this.boundKeyHandler = null;
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
            I18n?.init?.(document);
            // Import storage manager
            const { StorageManager } = await import('../utils/storage.js');
            this.storageManager = new StorageManager();

            // Get blocked URL from query parameters
            this.parseUrlParameters();

            // Load data and set up UI
            await this.loadBlockData();
            this.setupEventListeners();
            this.updateUI();
            this.checkExistingTempAccess();

            // Hide loading overlay
            this.hideLoading();
            window.addEventListener('beforeunload', () => this.cleanup());

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
        this.blockedUrl = urlParams.get('url') || 'Unknown URL';

        // Extract domain from URL
        try {
            const url = new URL(
                this.blockedUrl.startsWith('http') ? this.blockedUrl : `https://${this.blockedUrl}`
            );
            this.blockedDomain = url.hostname;
        } catch (error) {
            this.blockedDomain = this.blockedUrl;
        }
    }

    /**
     * Load block-related data
     */
    async loadBlockData() {
        try {
            const [usage, blockList, settings] = await Promise.all([
                this.storageManager.getAllUsage(),
                this.storageManager.getBlockList(),
                this.storageManager.getSettings(),
            ]);

            // Calculate block statistics
            this.calculateBlockStats(usage, blockList);

            // Check if temporary access is allowed
            this.setupTempAccessSection(settings);
        } catch (error) {
            console.error('Failed to load block data:', error);
            throw error;
        }
    }

    /**
     * Calculate block statistics for the domain
     * @param {Object} usage - Usage data
     * @param {Array} blockList - Block list
     */
    calculateBlockStats(usage, blockList) {
        const domainData = usage[this.blockedDomain] || {};
        const today = new Date().toDateString();

        // Times blocked today
        this.blockStats.count = domainData.blockedToday || 0;

        // Time spent on this site (total)
        this.blockStats.timeSpent = domainData.cumulative || 0;

        // Estimated time saved today (blocks * average session time)
        const avgSessionTime = 300; // 5 minutes average
        this.blockStats.timeSaved = this.blockStats.count * avgSessionTime;
    }

    /**
     * Set up temporary access section based on settings
     * @param {Object} settings - Extension settings
     */
    setupTempAccessSection(settings) {
        const tempAccessSection = document.getElementById('tempAccessSection');

        if (!settings.tempAccessEnabled || settings.strictMode) {
            tempAccessSection.style.display = 'none';
            return;
        }

        // Set default duration
        const durationSelect = document.getElementById('accessDuration');
        if (durationSelect) {
            durationSelect.value = settings.tempAccessDuration || 15;
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Request access button
        const requestAccessBtn = document.getElementById('requestAccessBtn');
        if (requestAccessBtn) {
            requestAccessBtn.addEventListener('click', () => this.requestTempAccess());
        }

        // Continue button
        const continueBtn = document.getElementById('continueBtn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.continueToSite());
        }

        // Alternative action cards
        this.setupAlternativeActions();

        // Footer links
        this.setupFooterLinks();

        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    /**
     * Set up alternative action event listeners
     */
    setupAlternativeActions() {
        const actions = {
            openProductiveTab: () => this.openProductiveSites(),
            openWorkTab: () => this.openWorkTools(),
            takeBreak: () => this.suggestBreakActivity(),
            openSettings: () => this.openSettings(),
        };

        Object.entries(actions).forEach(([id, handler]) => {
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
     * Set up footer links
     */
    setupFooterLinks() {
        const links = {
            settingsLink: () => this.openSettings(),
            helpLink: () => this.openHelp(),
            feedbackLink: () => this.openFeedback(),
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
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Escape key to close/go back
            if (e.key === 'Escape') {
                window.close();
            }

            // R key to request access
            if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.altKey) {
                const requestBtn = document.getElementById('requestAccessBtn');
                if (requestBtn && !requestBtn.disabled) {
                    this.requestTempAccess();
                }
            }

            // S key to open settings
            if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.altKey) {
                this.openSettings();
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
        this.applyTheme();
    }

    /**
     * Update blocked URL display
     */
    updateBlockedUrlDisplay() {
        const blockedUrlElement = document.getElementById('blockedUrl');
        if (blockedUrlElement) {
            blockedUrlElement.textContent = this.blockedDomain;
        }

        // Update page title
        document.title = `${this.blockedDomain} is blocked - TimeDash`;
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
     * Apply theme based on user settings
     */
    async applyTheme() {
        try {
            const settings = await this.storageManager.getSettings();
            document.documentElement.setAttribute('data-theme', settings.theme || 'light');
        } catch (error) {
            console.error('Failed to apply theme:', error);
        }
    }

    /**
     * Request temporary access to the blocked site
     */
    async requestTempAccess() {
        try {
            const duration = parseInt(document.getElementById('accessDuration').value);
            const reason = document.getElementById('accessReason').value.trim();

            if (!duration || duration <= 0) {
                this.showError('Please select a valid duration.');
                return;
            }

            // Request temporary access from background script
            const response = await chrome.runtime.sendMessage({
                type: 'REQUEST_TEMP_ACCESS',
                domain: this.blockedDomain,
                duration: duration,
                reason: reason,
            });

            if (response.success) {
                this.startTempAccessTimer(duration);
                this.showSuccess(`Temporary access granted for ${duration} minutes.`);

                // Log the temporary access
                await this.logTempAccess(duration, reason);
            } else {
                this.showError(response.error || 'Failed to grant temporary access.');
            }
        } catch (error) {
            console.error('Failed to request temporary access:', error);
            this.showError('Failed to request access. Please try again.');
        }
    }

    /**
     * Start the temporary access timer
     * @param {number} duration - Duration in minutes
     */
    startTempAccessTimer(duration) {
        this.tempAccessEndTime = Date.now() + duration * 60 * 1000;

        // Hide request section and show timer
        document.querySelector('.access-controls').style.display = 'none';
        document.getElementById('accessTimer').style.display = 'block';

        // Update timer display
        this.updateTimer();

        // Start timer interval
        this.tempAccessTimer = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }

    /**
     * Update timer display
     */
    updateTimer() {
        const remaining = Math.max(0, this.tempAccessEndTime - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        const timerElement = document.getElementById('timerRemaining');
        if (timerElement) {
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        // Timer expired
        if (remaining <= 0) {
            this.clearTempAccessTimer();
            this.showWarning('Temporary access has expired.');
        }
    }

    /**
     * Clear temporary access timer
     */
    clearTempAccessTimer() {
        if (this.tempAccessTimer) {
            clearInterval(this.tempAccessTimer);
            this.tempAccessTimer = null;
        }

        // Reset UI
        document.querySelector('.access-controls').style.display = 'block';
        document.getElementById('accessTimer').style.display = 'none';
    }

    /**
     * Check for existing temporary access
     */
    async checkExistingTempAccess() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'CHECK_TEMP_ACCESS',
                domain: this.blockedDomain,
            });

            if (response.hasAccess && response.remainingTime > 0) {
                const remainingMinutes = Math.ceil(response.remainingTime / 60000);
                this.startTempAccessTimer(remainingMinutes);
            }
        } catch (error) {
            console.error('Failed to check existing temp access:', error);
        }
    }

    /**
     * Continue to the blocked site
     */
    continueToSite() {
        // Redirect to the original URL
        window.location.href = this.blockedUrl;
    }

    /**
     * Log temporary access request
     * @param {number} duration - Duration in minutes
     * @param {string} reason - Access reason
     */
    async logTempAccess(duration, reason) {
        try {
            await chrome.runtime.sendMessage({
                type: 'LOG_TEMP_ACCESS',
                domain: this.blockedDomain,
                duration: duration,
                reason: reason,
                timestamp: Date.now(),
            });
        } catch (error) {
            console.error('Failed to log temp access:', error);
        }
    }

    /**
     * Open productive sites
     */
    openProductiveSites() {
        const productiveSites = [
            'https://wikipedia.org',
            'https://coursera.org',
            'https://khanacademy.org',
            'https://ted.com',
            'https://github.com',
        ];

        const randomSite = productiveSites[Math.floor(Math.random() * productiveSites.length)];
        chrome.tabs.create({ url: randomSite });
    }

    /**
     * Open work tools
     */
    openWorkTools() {
        const workTools = [
            'https://docs.google.com',
            'https://calendar.google.com',
            'https://trello.com',
            'https://notion.so',
            'https://slack.com',
        ];

        const randomTool = workTools[Math.floor(Math.random() * workTools.length)];
        chrome.tabs.create({ url: randomTool });
    }

    /**
     * Suggest break activity
     */
    suggestBreakActivity() {
        const activities = [
            'Take a 5-minute walk outside',
            'Do some quick stretching exercises',
            'Practice deep breathing for 2 minutes',
            'Drink a glass of water',
            'Look out the window and rest your eyes',
            'Do 10 jumping jacks',
            'Meditate for 5 minutes',
            'Organize your workspace',
        ];

        const randomActivity = activities[Math.floor(Math.random() * activities.length)];
        this.showInfo(`💡 Break suggestion: ${randomActivity}`);
    }

    /**
     * Open extension settings
     */
    openSettings() {
        chrome.runtime.openOptionsPage();
    }

    /**
     * Open help page
     */
    openHelp() {
        chrome.tabs.create({ url: 'https://github.com/timedash/extension/wiki' });
    }

    /**
     * Open feedback page
     */
    openFeedback() {
        chrome.tabs.create({ url: 'https://github.com/timedash/extension/issues' });
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
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    /**
     * Show loading overlay
     */
    showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
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
     * Show success notification
     * @param {string} message - Success message
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    /**
     * Show error notification
     * @param {string} message - Error message
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Show warning notification
     * @param {string} message - Warning message
     */
    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    /**
     * Show info notification
     * @param {string} message - Info message
     */
    showInfo(message) {
        this.showNotification(message, 'info');
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

    setupKeyboardShortcuts() {
        const handler = (e) => {
            // Add keyboard shortcuts here if needed
        };
        this.boundKeyHandler = handler;
        document.addEventListener('keydown', handler);
    }

    showSuccess(message) {
        this.showBanner(message, 'success');
    }

    showError(message) {
        this.showBanner(message || 'Error', 'error', /*assertive*/ true);
    }

    showWarning(message) {
        this.showBanner(message, 'warning');
    }

    showInfo(message) {
        this.showBanner(message, 'info');
    }

    showBanner(message, type = 'info', assertive = false) {
        const el = document.getElementById('banner');
        if (el) {
            el.className = `banner ${type}`;
            el.setAttribute('role', assertive ? 'alert' : 'status');
            el.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
            el.textContent = message;
            el.style.display = 'block';
            if (!assertive) {
                setTimeout(() => {
                    el.style.display = 'none';
                }, 3000);
            }
        }
        const live = document.getElementById('ariaLive');
        if (live) live.textContent = message;
    }

    cleanup() {
        this.clearTempAccessTimer();
        if (this.boundKeyHandler) {
            document.removeEventListener('keydown', this.boundKeyHandler);
            this.boundKeyHandler = null;
        }
    }
}

// Initialize block page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new BlockPageController();
});
