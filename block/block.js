'use strict';

/**
 * Block page controller - simplified
 */
class BlockPageController {
    constructor() {
        this.storageManager = null;
        this.blockedUrl = '';
        this.blockedDomain = '';
        this.blockReason = 'blocked';
        this.blockStats = {
            count: 0,
            timeSpent: 0,
        };

        this.motivationalQuotes = [
            { quote: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
            { quote: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
            { quote: 'You are never too old to set another goal or to dream a new dream.', author: 'C.S. Lewis' },
            { quote: 'The future depends on what you do today.', author: 'Mahatma Gandhi' },
            { quote: "Don't watch the clock; do what it does. Keep going.", author: 'Sam Levenson' },
            { quote: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier' },
            { quote: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
            { quote: "Believe you can and you're halfway there.", author: 'Theodore Roosevelt' },
        ];

        this.productivityTips = [
            'Try the Pomodoro Technique: Work for 25 minutes, then take a 5-minute break.',
            'Create a distraction-free workspace to improve your focus.',
            'Use the 2-minute rule: If it takes less than 2 minutes, do it now.',
            'Block time in your calendar for important tasks.',
            'Take regular breaks to maintain high productivity levels.',
            'Set specific, measurable goals for each work session.',
            'Keep a notepad nearby to jot down random thoughts that pop up.',
        ];

        this.init();
    }

    async init() {
        try {
            this.storageManager = new StorageManager();
            this.parseUrlParameters();

            // Apply theme immediately
            await this.applyTheme();

            // Check if access is now allowed (time limit may have been changed)
            const stillBlocked = await this.checkIfStillBlocked();
            if (!stillBlocked && this.blockedUrl) {
                // Access is now allowed - redirect back to the original site
                window.location.href = this.blockedUrl;
                return;
            }

            await this.loadBlockData();
            this.setupEventListeners();
            this.updateUI();
        } catch (error) {
            console.error('Failed to initialize block page:', error);
        }
    }

    async applyTheme() {
        const settings = await this.storageManager.getSettings();
        if (settings) {
            document.documentElement.setAttribute('data-theme', settings.theme || 'auto');
            document.documentElement.setAttribute('data-accent', settings.accentColor || 'blue');
        }
    }

    /**
     * Check if the site should still be blocked
     * @returns {Promise<boolean>} True if still blocked
     */
    async checkIfStillBlocked() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'CHECK_ACCESS',
                url: this.blockedUrl || `https://${this.blockedDomain}`,
                domain: this.blockedDomain
            });
            return response?.shouldBlock === true;
        } catch (error) {
            console.error('Error checking access:', error);
            return true; // Assume still blocked on error
        }
    }

    parseUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        this.blockedUrl = urlParams.get('url') || '';
        this.blockReason = urlParams.get('reason') || 'blocked';

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
            const domain = urlParams.get('domain') || 'Unknown Site';
            this.blockedDomain = domain.replace(/^www\./, '');
        }
    }

    async loadBlockData() {
        try {
            const usage = await this.storageManager.getAllUsage();
            const domainData = usage[this.blockedDomain] || {};

            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            this.blockStats.count = domainData.blockedToday || 1;
            this.blockStats.timeSpent = domainData.cumulative || 0;
            this.blockStats.todayTime = domainData[today] || 0;
        } catch (error) {
            console.error('Failed to load block data:', error);
        }
    }

    setupEventListeners() {
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                chrome.runtime.openOptionsPage();
            });
        }
    }

    updateUI() {
        // Domain display
        const blockedUrlEl = document.getElementById('blockedUrl');
        if (blockedUrlEl) {
            blockedUrlEl.textContent = this.blockedDomain;
        }

        // Update heading, reason, and stats based on block type
        const headingEl = document.getElementById('blockHeading');
        const reasonEl = document.getElementById('blockReason');
        const blockIcon = document.querySelector('.block-icon');

        if (this.blockReason === 'restricted') {
            // Restricted site - time limit reached
            if (headingEl) headingEl.textContent = 'Daily Limit Reached';
            if (reasonEl) reasonEl.textContent = `You've used all your allotted time for ${this.blockedDomain} today. Access will reset at midnight.`;
            document.title = `${this.blockedDomain} - Limit Reached`;

            // Show time used today instead of block count
            this.updateStat('blockCount', this.formatTime(this.blockStats.todayTime || 0));
            this.updateStatLabel('blockCount', 'Time used today');

            // Change icon color to orange for restricted
            if (blockIcon) blockIcon.style.color = '#f59e0b';
        } else {
            // Fully blocked site
            if (headingEl) headingEl.textContent = 'This site is blocked';
            if (reasonEl) reasonEl.textContent = 'This site is on your block list to help you stay focused.';
            document.title = `${this.blockedDomain} is blocked`;

            this.updateStat('blockCount', this.blockStats.count);
            this.updateStatLabel('blockCount', 'Times blocked today');
        }

        // Always show cumulative time spent
        this.updateStat('timeSpent', this.formatTime(this.blockStats.timeSpent));

        // Motivational content
        this.updateMotivationalContent();
    }

    updateStat(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    updateStatLabel(id, label) {
        const el = document.getElementById(id);
        if (el && el.nextElementSibling) {
            el.nextElementSibling.textContent = label;
        }
    }

    updateMotivationalContent() {
        const quote = this.motivationalQuotes[Math.floor(Math.random() * this.motivationalQuotes.length)];
        const tip = this.productivityTips[Math.floor(Math.random() * this.productivityTips.length)];

        const quoteEl = document.querySelector('.motivation-quote blockquote');
        const citeEl = document.querySelector('.motivation-quote cite');
        const tipEl = document.querySelector('.productivity-tip p');

        if (quoteEl) quoteEl.textContent = `"${quote.quote}"`;
        if (citeEl) citeEl.textContent = `— ${quote.author}`;
        if (tipEl) tipEl.textContent = tip;
    }

    formatTime(seconds) {
        if (!seconds) return '0m';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BlockPageController();
});
