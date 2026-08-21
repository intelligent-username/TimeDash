'use strict';

function applyBlockUiMethods(BlockPageController) {
    BlockPageController.prototype.loadBlockData = async function loadBlockData() {
        try {
            const usage = await this.storageManager.getAllUsage();
            const domainData = usage[this.blockedDomain] || {};
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            this.blockStats.count = domainData.blockedToday || 1;
            this.blockStats.timeSpent = domainData.cumulative || 0;
            // Prefer the accurate value passed from the background at block time;
            // fall back to storage (e.g. on a manual refresh without the param).
            this.blockStats.todayTime =
                this.usedFromUrl != null ? this.usedFromUrl : domainData[today] || 0;
        } catch (error) {
            console.error('Failed to load block data:', error);
        }
    };

    BlockPageController.prototype.setupEventListeners = function setupEventListeners() {
        const settingsBtn = document.getElementById('settingsBtn');
        if (!settingsBtn) return;

        settingsBtn.addEventListener('click', () => {
            const optionsUrl = chrome.runtime.getURL('options/options.html#blocking');
            chrome.tabs.create({ url: optionsUrl });
        });
    };

    BlockPageController.prototype.updateUI = function updateUI() {
        const blockedUrlEl = document.getElementById('blockedUrl');
        if (blockedUrlEl) blockedUrlEl.textContent = this.blockedDomain;

        const headingEl = document.getElementById('blockHeading');
        const reasonEl = document.getElementById('blockReason');
        const blockIcon = document.querySelector('.block-icon');

        if (this.blockReason === 'restricted') {
            if (headingEl) headingEl.textContent = I18n.t('dailyLimitReached');
            if (reasonEl)
                reasonEl.textContent = I18n.t('restrictedReason', [this.blockedDomain]);
            document.title = I18n.t('limitReachedTitle', [this.blockedDomain]);
            this.updateStat('blockCount', this.formatTime(this.blockStats.todayTime || 0));
            this.updateStatLabel('blockCount', I18n.t('timeUsedToday'));
            if (blockIcon) blockIcon.style.color = '#f59e0b';
        } else if (this.blockReason === 'restricted_group') {
            if (headingEl) headingEl.textContent = I18n.t('groupLimitReached');
            if (reasonEl) reasonEl.textContent = I18n.t('groupLimitReason');
            document.title = I18n.t('groupLimitReachedTitle');
            this.updateStat('blockCount', this.formatTime(this.blockStats.todayTime || 0));
            this.updateStatLabel('blockCount', I18n.t('timeUsedToday'));
            if (blockIcon) blockIcon.style.color = '#f59e0b';
        } else {
            if (headingEl) headingEl.textContent = I18n.t('blockedSite');
            if (reasonEl) reasonEl.textContent = I18n.t('blockReasonDefault');
            document.title = I18n.t('blockedTitleDomain', [this.blockedDomain]);
            this.updateStat('blockCount', this.blockStats.count);
            this.updateStatLabel('blockCount', I18n.t('timesBlockedToday'));
        }

        this.updateStat('timeSpent', this.formatTime(this.blockStats.timeSpent));
        this.updateMotivationalContent();
    };

    BlockPageController.prototype.updateStat = function updateStat(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    BlockPageController.prototype.updateStatLabel = function updateStatLabel(id, label) {
        const el = document.getElementById(id);
        if (el && el.nextElementSibling) el.nextElementSibling.textContent = label;
    };

    BlockPageController.prototype.getMotivationalQuotes = function getMotivationalQuotes() {
        return [
            { quote: I18n.t('quote1'), author: I18n.t('quote1Author') },
            { quote: I18n.t('quote2'), author: I18n.t('quote2Author') },
            { quote: I18n.t('quote3'), author: I18n.t('quote3Author') },
            { quote: I18n.t('quote4'), author: I18n.t('quote4Author') },
            { quote: I18n.t('quote5'), author: I18n.t('quote5Author') },
            { quote: I18n.t('quote6'), author: I18n.t('quote6Author') },
            { quote: I18n.t('quote7'), author: I18n.t('quote7Author') },
            { quote: I18n.t('quote8'), author: I18n.t('quote8Author') },
        ];
    };

    BlockPageController.prototype.getProductivityTips = function getProductivityTips() {
        return [
            I18n.t('tip1'),
            I18n.t('tip2'),
            I18n.t('tip3'),
            I18n.t('tip4'),
            I18n.t('tip5'),
            I18n.t('tip6'),
            I18n.t('tip7'),
        ];
    };

    BlockPageController.prototype.updateMotivationalContent = function updateMotivationalContent() {
        const quotes = this.getMotivationalQuotes();
        const tips = this.getProductivityTips();
        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        const tip = tips[Math.floor(Math.random() * tips.length)];

        const quoteEl = document.querySelector('.motivation-quote blockquote');
        const citeEl = document.querySelector('.motivation-quote cite');
        const tipEl = document.querySelector('.productivity-tip p');

        if (quoteEl) quoteEl.textContent = `"${quote.quote}"`;
        if (citeEl) citeEl.textContent = `— ${quote.author}`;
        if (tipEl) tipEl.textContent = tip;
    };

    BlockPageController.prototype.formatTime = function formatTime(seconds) {
        return TimeUtils.formatTime(seconds);
    };
}
