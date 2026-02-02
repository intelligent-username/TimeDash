'use strict';

/**
 * @fileoverview Main options page logic for TimeDash extension
 * Handles settings management, UI state, and user interactions
 */

/**
 * Options page controller class
 * Manages all settings, UI state, and user interactions
 */
class OptionsController {
    constructor() {
        this.storageManager = null;
        this.currentTab = 'general';
        this.isDirty = false;
        this.settings = {};
        this.usage = {};
        this.blockList = [];
        this.videoSpeeds = {};
        this.autoSaveInterval = null;
        this.boundKeyHandler = null;

        this.init();
    }

    /**
     * Initialize the options controller
     */
    async init() {
        try {
            I18n.init(document);
            // StorageManager is now loaded via <script> tag
            this.storageManager = new StorageManager();

            // Load initial data
            await this.loadAllData();

            // Set up event listeners
            this.setupEventListeners();

            // Initialize UI
            this.initializeUI();

            // Announce loaded
            this.showBanner?.('Settings loaded', 'success');
            window.addEventListener('beforeunload', () => this.cleanup());
            console.log('Options page initialized successfully');
        } catch (error) {
            console.error('Failed to initialize options page:', error);
            this.showBanner?.('Failed to load settings', 'error');
        }
    }

    /**
     * Load all data from storage
     */
    async loadAllData() {
        try {
            const [settings, usage, blockList, videoSpeeds] = await Promise.all([
                this.storageManager.getSettings(),
                this.storageManager.getAllUsage(),
                this.storageManager.getBlockList(),
                this.storageManager.getVideoSpeeds(),
            ]);

            this.settings = settings;
            this.usage = usage;
            this.blockList = blockList;
            this.videoSpeeds = videoSpeeds;
        } catch (error) {
            console.error('Failed to load data:', error);
            throw error;
        }
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach((button) => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // General settings
        this.setupGeneralSettings();

        // Video settings
        this.setupVideoSettings();

        // Blocking settings
        this.setupBlockingSettings();

        // Analytics settings
        this.setupAnalyticsSettings();

        // Privacy settings
        this.setupPrivacySettings();

        // Action buttons
        this.setupActionButtons();

        // Keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Auto-save on changes
        this.setupAutoSave();
    }

    /**
     * Set up general settings event listeners
     */
    /**
     * Helper to bind UI elements to settings keys
     * @param {Object} mapping - Key to Element ID mapping
     */
    bindSettings(mapping) {
        Object.entries(mapping).forEach(([key, elementId]) => {
            const element = document.getElementById(elementId);
            if (element) {
                const eventType = (element.type === 'checkbox' || element.tagName === 'SELECT') ? 'change' : 'input';
                element.addEventListener(eventType, () => {
                    this.updateSetting(key, this.getInputValue(element));
                });
            }
        });
    }

    /**
     * Set up general settings event listeners
     */
    setupGeneralSettings() {
        this.bindSettings({
            trackingEnabled: 'trackingEnabled',
            dailyTimeLimitMinutes: 'dailyLimit',
            notificationsEnabled: 'notificationsEnabled',
            quotaWarnings: 'quotaWarnings',
            theme: 'theme',
            badgeEnabled: 'badgeEnabled'
        });
    }

    /**
     * Set up video settings event listeners
     */
    setupVideoSettings() {
        this.bindSettings({
            defaultPlaybackSpeed: 'defaultSpeed',
            maxPlaybackSpeed: 'maxSpeed',
            speedStep: 'speedStep'
        });

        // Speed range validation
        const defaultSpeed = document.getElementById('defaultSpeed');
        const maxSpeed = document.getElementById('maxSpeed');

        if (defaultSpeed && maxSpeed) {
            defaultSpeed.addEventListener('input', () => {
                const value = parseFloat(defaultSpeed.value);
                const max = parseFloat(maxSpeed.value);
                if (!isNaN(value) && !isNaN(max) && value > max) {
                    maxSpeed.value = value;
                    this.updateSetting('maxPlaybackSpeed', value);
                }
            });

            maxSpeed.addEventListener('input', () => {
                const value = parseFloat(maxSpeed.value);
                const defaultVal = parseFloat(defaultSpeed.value);
                if (!isNaN(value) && !isNaN(defaultVal) && value < defaultVal) {
                    defaultSpeed.value = value;
                    this.updateSetting('defaultPlaybackSpeed', value);
                }
            });
        }

        // Keybinds recording
        const keyInputs = [
            { id: 'increaseSpeedKey', key: 'increaseSpeedKey' },
            { id: 'decreaseSpeedKey', key: 'decreaseSpeedKey' }
        ];

        keyInputs.forEach(({ id, key }) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', () => {
                    const originalValue = el.value;
                    el.value = 'Press any key...';
                    el.classList.add('recording');

                    const handler = (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

                        const normalizationMap = {
                            'NumpadSubtract': 'Minus',
                            'Minus': 'Minus',
                            'NumpadAdd': 'Plus',
                            'Equal': 'Plus',
                            'NumpadEnter': 'Enter',
                            'Enter': 'Enter',
                            'NumpadDecimal': 'Period',
                            'NumpadComma': 'Period',
                            'Period': 'Period',
                            'NumpadMultiply': 'Asterisk',
                            'NumpadDivide': 'Slash',
                            'Slash': 'Slash',
                            'NumpadEqual': 'Equal'
                        };

                        // Add number mappings
                        for (let i = 0; i <= 9; i++) {
                            normalizationMap[`Numpad${i}`] = '' + i;
                            normalizationMap[`Digit${i}`] = '' + i;
                        }

                        if (normalizationMap[code]) {
                            code = normalizationMap[code];
                        }

                        el.value = code;
                        el.classList.remove('recording');
                        this.updateSetting(key, code);

                        document.removeEventListener('keydown', handler, true);
                        document.removeEventListener('click', cancelHandler);
                    };

                    const cancelHandler = (e) => {
                        if (e.target !== el) {
                            document.removeEventListener('keydown', handler, true);
                            document.removeEventListener('click', cancelHandler);
                            el.classList.remove('recording');
                            if (el.value === 'Press any key...') {
                                // Revert to saved or default
                                el.value = this.settings[key] || (key === 'increaseSpeedKey' ? 'Plus' : 'Minus');
                            }
                        }
                    };

                    document.addEventListener('keydown', handler, true);
                    setTimeout(() => document.addEventListener('click', cancelHandler), 0);
                });
            }
        });
    }

    /**
     * Set up blocking settings event listeners
     */
    setupBlockingSettings() {
        // Blocked sites UI
        const addBlockedBtn = document.getElementById('addBlockedBtn');
        const blockedDomainInput = document.getElementById('blockedDomainInput');

        if (addBlockedBtn && blockedDomainInput) {
            addBlockedBtn.addEventListener('click', () => {
                this.addSiteRule(blockedDomainInput.value.trim(), 'BLOCKED');
                blockedDomainInput.value = '';
            });

            blockedDomainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addSiteRule(blockedDomainInput.value.trim(), 'BLOCKED');
                    blockedDomainInput.value = '';
                }
            });
        }

        // Restricted sites UI
        const addRestrictedBtn = document.getElementById('addRestrictedBtn');
        const restrictedDomainInput = document.getElementById('restrictedDomainInput');
        const restrictedLimitInput = document.getElementById('restrictedLimitInput');

        if (addRestrictedBtn && restrictedDomainInput) {
            addRestrictedBtn.addEventListener('click', () => {
                const limit = parseInt(restrictedLimitInput?.value) || 30;
                this.addSiteRule(restrictedDomainInput.value.trim(), 'RESTRICTED', limit);
                restrictedDomainInput.value = '';
                if (restrictedLimitInput) restrictedLimitInput.value = '';
            });

            restrictedDomainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const limit = parseInt(restrictedLimitInput?.value) || 30;
                    this.addSiteRule(restrictedDomainInput.value.trim(), 'RESTRICTED', limit);
                    restrictedDomainInput.value = '';
                    if (restrictedLimitInput) restrictedLimitInput.value = '';
                }
            });
        }

        // Load initial rules
        this.loadSiteRules();
    }

    /**
     * Add a site rule via background script
     * @param {string} domain - Domain to add
     * @param {string} ruleType - BLOCKED or RESTRICTED
     * @param {number} timeLimitMinutes - Time limit for restricted sites
     */
    async addSiteRule(domain, ruleType, timeLimitMinutes = 30) {
        if (!domain) {
            this.showWarning('Please enter a domain');
            return;
        }

        // Basic domain validation
        const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/;
        const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

        if (!domainPattern.test(cleanDomain)) {
            this.showWarning('Please enter a valid domain (e.g., facebook.com)');
            return;
        }

        try {
            await chrome.runtime.sendMessage({
                type: 'ADD_SITE_RULE',
                domain: cleanDomain,
                ruleType,
                timeLimitMinutes,
            });
            this.loadSiteRules();
            this.showSuccess(`Added ${cleanDomain} to ${ruleType.toLowerCase()} list`);
        } catch (error) {
            console.error('Error adding site rule:', error);
            this.showError('Failed to add site rule');
        }
    }

    /**
     * Remove a site rule via background script
     * @param {string} domain - Domain to remove
     */
    async removeSiteRule(domain) {
        try {
            await chrome.runtime.sendMessage({
                type: 'REMOVE_SITE_RULE',
                domain,
            });
            this.loadSiteRules();
            this.showSuccess(`Removed ${domain}`);
        } catch (error) {
            console.error('Error removing site rule:', error);
            this.showError('Failed to remove site rule');
        }
    }

    /**
     * Load site rules from background and update UI
     */
    async loadSiteRules() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SITE_RULES' });
            this.renderBlockedList(response.blocked || []);
            this.renderRestrictedList(response.restricted || []);
        } catch (error) {
            console.error('Error loading site rules:', error);
        }
    }

    /**
     * Render the blocked sites list
     * @param {string[]} domains - Array of blocked domains
     */
    renderBlockedList(domains) {
        const list = document.getElementById('blockedList');
        if (!list) return;

        list.innerHTML = '';
        domains.forEach((domain) => {
            const li = document.createElement('li');
            li.className = 'rule-item';
            li.innerHTML = `
                <div class="rule-item-info">
                    <img class="rule-favicon" src="${this.getFaviconUrl(domain)}" alt="" onerror="this.style.display='none'">
                    <span class="rule-domain">${domain}</span>
                </div>
                <button class="rule-delete-btn" data-domain="${domain}" data-type="blocked">Remove</button>
            `;
            li.querySelector('.rule-delete-btn').addEventListener('click', (e) => {
                this.removeSiteRule(e.target.dataset.domain);
            });
            list.appendChild(li);
        });
    }

    /**
     * Get favicon URL for domain
     * @param {string} domain 
     * @returns {string}
     */
    getFaviconUrl(domain) {
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    }

    /**
     * Render the restricted sites list
     * @param {Array<{domain: string, timeLimitMinutes: number}>} sites - Array of restricted site objects
     */
    renderRestrictedList(sites) {
        const list = document.getElementById('restrictedList');
        if (!list) return;

        list.innerHTML = '';
        sites.forEach(({ domain, timeLimitMinutes }) => {
            const li = document.createElement('li');
            li.className = 'rule-item restrict-item';

            const infoDiv = document.createElement('div');
            infoDiv.className = 'rule-item-info';

            const favicon = document.createElement('img');
            favicon.className = 'rule-favicon';
            favicon.src = this.getFaviconUrl(domain);
            favicon.onerror = () => { favicon.style.display = 'none'; };

            const domainSpan = document.createElement('span');
            domainSpan.className = 'rule-domain';
            domainSpan.textContent = domain;

            const limitInput = document.createElement('input');
            limitInput.type = 'number';
            limitInput.className = 'rule-limit-input-edit';
            limitInput.value = timeLimitMinutes;
            limitInput.min = 1;
            limitInput.max = 1440;
            limitInput.title = 'Edit daily limit (minutes)';

            const suffixSpan = document.createElement('span');
            suffixSpan.className = 'limit-suffix';
            suffixSpan.textContent = 'min/day';

            infoDiv.appendChild(favicon);
            infoDiv.appendChild(domainSpan);
            infoDiv.appendChild(limitInput);
            infoDiv.appendChild(suffixSpan);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'rule-delete-btn';
            deleteBtn.textContent = 'Remove';
            deleteBtn.dataset.domain = domain;
            deleteBtn.addEventListener('click', () => this.removeSiteRule(domain));

            // Edit event on change (blur/enter)
            limitInput.addEventListener('change', () => {
                const newLimit = parseInt(limitInput.value);
                if (!isNaN(newLimit) && newLimit > 0 && newLimit <= 1440) {
                    this.addSiteRule(domain, 'RESTRICTED', newLimit);
                } else {
                    limitInput.value = timeLimitMinutes;
                }
            });

            li.appendChild(infoDiv);
            li.appendChild(deleteBtn);
            list.appendChild(li);
        });
    }

    /**
     * Set up analytics settings event listeners
     */
    setupAnalyticsSettings() {
        this.bindSettings({
            trackingFrequency: 'trackingFrequency'
        });
    }

    /**
     * Set up privacy settings event listeners
     */
    setupPrivacySettings() {
        this.bindSettings({
            incognitoTracking: 'incognitoTracking'
        });
    }

    /**
     * Set up action buttons event listeners
     */
    setupActionButtons() {
        // Export data
        const exportBtn = document.getElementById('exportData');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        // Import data
        const importBtn = document.getElementById('importData');
        const importFile = document.getElementById('importFile');
        if (importBtn && importFile) {
            importBtn.addEventListener('click', () => importFile.click());
            importFile.addEventListener('change', (e) => this.importData(e));
        }

        // Reset settings
        const resetBtn = document.getElementById('resetSettings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }

        // Clear data
        const clearDataBtn = document.getElementById('clearData');
        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', () => this.clearAllData());
        }

        // Save settings
        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }
    }

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+S to save
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveSettings();
            }

            // Escape to cancel changes
            if (e.key === 'Escape' && this.isDirty) {
                this.loadAllData().then(() => {
                    this.populateAllSettings();
                    this.markClean();
                });
            }
        });
    }

    /**
     * Set up auto-save functionality
     */
    setupAutoSave() {
        // Auto-save every 30 seconds if there are changes
        setInterval(() => {
            if (this.isDirty) {
                this.saveSettings(true); // Silent save
            }
        }, 30000);

        // Save on page unload (silently, no prompt)
        window.addEventListener('beforeunload', () => {
            if (this.isDirty) {
                this.saveSettings(true);
            }
        });
    }

    /**
     * Initialize the UI with current settings
     */
    initializeUI() {
        this.populateAllSettings();
        this.updateStatistics();

        // Check URL for tab parameter
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        const tab = tabParam ? tabParam.toLowerCase() : null;

        if (tab && document.getElementById(tab)) {
            this.switchTab(tab, false);
        } else {
            this.switchTab('general', false);
        }

        this.markClean();
    }

    /**
     * Populate settings for Video Control tab
     */
    populateVideoSettings() {
        this.setInputValue('defaultSpeed', this.settings.defaultPlaybackSpeed);
        this.setInputValue('maxSpeed', this.settings.maxPlaybackSpeed);
        this.setInputValue('speedStep', this.settings.speedStep || 0.25);
        this.setInputValue('increaseSpeedKey', this.settings.increaseSpeedKey || 'Plus');
        this.setInputValue('decreaseSpeedKey', this.settings.decreaseSpeedKey || 'Minus');
    }

    /**
     * Populate settings for Site Blocking tab
     */
    populateBlockingSettings() {
        const blockList = this.blockList.join('\n');
        this.setInputValue('blockList', blockList);
    }

    /**
     * Populate settings for Analytics tab
     */
    populateAnalyticsSettings() {
        this.setInputValue('trackingFrequency', this.settings.trackingFrequency);
    }

    /**
     * Populate settings for Privacy tab
     */
    populatePrivacySettings() {
        this.setInputValue('incognitoTracking', this.settings.incognitoTracking);
    }

    /**
     * Populate all settings in the UI
     */
    populateAllSettings() {
        // General settings
        this.setInputValue('trackingEnabled', this.settings.trackingEnabled);
        this.setInputValue('dailyLimit', this.settings.dailyTimeLimitMinutes);
        this.setInputValue('notificationsEnabled', this.settings.notificationsEnabled);
        this.setInputValue('quotaWarnings', this.settings.quotaWarnings);
        this.setInputValue('theme', this.settings.theme);
        this.setInputValue('badgeEnabled', this.settings.badgeEnabled);

        // Video settings
        this.populateVideoSettings();

        // Blocking settings
        this.populateBlockingSettings();

        // Analytics settings
        this.populateAnalyticsSettings();

        // Privacy settings
        this.populatePrivacySettings();
    }

    /**
     * Update statistics display
     */
    updateStatistics() {
        const stats = this.calculateStatistics();

        // Update stat elements
        this.updateStatElement('totalSites', stats.totalSites);
        this.updateStatElement('totalTime', stats.totalTime);
        this.updateStatElement('blockedSites', stats.blockedSites);
        this.updateStatElement('avgDaily', stats.avgDaily);
        this.updateStatElement('topSite', stats.topSite);
        this.updateStatElement('dataSize', stats.dataSize);
    }

    /**
     * Calculate usage statistics
     * @returns {Object} Statistics object
     */
    calculateStatistics() {
        const sites = Object.keys(this.usage);
        const totalSites = sites.length;
        const blockedSites = this.blockList.length;

        let totalTime = 0;
        let topSite = { domain: 'None', time: 0 };

        sites.forEach((domain) => {
            const siteData = this.usage[domain];
            const siteTotal = siteData.cumulative || 0;
            totalTime += siteTotal;

            if (siteTotal > topSite.time) {
                topSite = { domain, time: siteTotal };
            }
        });

        const avgDaily = totalSites > 0 ? Math.round(totalTime / totalSites / 60) : 0;
        const dataSize = this.estimateDataSize();

        return {
            totalSites,
            totalTime: this.formatTime(totalTime),
            blockedSites,
            avgDaily: `${avgDaily} min`,
            topSite: topSite.domain,
            dataSize: `${Math.round(dataSize / 1024)} KB`,
        };
    }

    /**
     * Estimate data size in bytes
     * @returns {number} Estimated size in bytes
     */
    estimateDataSize() {
        const dataStr = JSON.stringify({
            usage: this.usage,
            blockList: this.blockList,
            settings: this.settings,
            videoSpeeds: this.videoSpeeds,
        });
        return new Blob([dataStr]).size;
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
     * Switch to a different tab
     * @param {string} tabName - Name of the tab to switch to
     * @param {boolean} updateUrl - Whether to update URL
     */
    switchTab(tabName, updateUrl = true) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach((button) => {
            button.classList.remove('active');
            if (button.dataset.tab === tabName) {
                button.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-pane').forEach((content) => {
            content.classList.remove('active');
            if (content.id === tabName) {
                content.classList.add('active');
            }
        });

        this.currentTab = tabName;

        // Update URL
        if (updateUrl) {
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('tab', tabName);
            window.history.replaceState({ tab: tabName }, '', newUrl);
        }
    }

    /**
     * Update a setting and save immediately
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    updateSetting(key, value) {
        // Validation for numeric fields
        if (typeof value === 'number' && isNaN(value)) {
            return; // Don't save invalid numbers
        }

        // Specific validation for speeds
        if ((key === 'defaultPlaybackSpeed' || key === 'maxPlaybackSpeed') && value === 0) {
            return; // Don't allow 0 speed
        }

        this.settings[key] = value;

        // Apply immediate changes if needed
        this.applyImmediateChanges(key, value);

        // Debounce save (500ms)
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(() => {
            this.saveSettings(true);
        }, 500);

        this.markDirty(); // Updates UI state if needed (though we auto-save)
    }

    /**
     * Apply changes that should take effect immediately
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    applyImmediateChanges(key, value) {
        switch (key) {
            case 'theme':
                document.documentElement.setAttribute('data-theme', value);
                break;
            case 'keyboardShortcuts':
                this.toggleKeyboardShortcutInputs(value);
                break;
            case 'blockSchedule':
                this.toggleScheduleInputs(value);
                break;
        }
    }

    /**
     * Toggle keyboard shortcut input visibility
     * @param {boolean} enabled - Whether shortcuts are enabled
     */
    toggleKeyboardShortcutInputs(enabled) {
        const container = document.getElementById('shortcutInputs');
        if (container) {
            container.style.display = enabled ? 'block' : 'none';
        }
    }

    /**
     * Toggle schedule input visibility
     * @param {boolean} enabled - Whether schedule is enabled
     */
    toggleScheduleInputs(enabled) {
        const container = document.getElementById('scheduleInputs');
        if (container) {
            container.style.display = enabled ? 'block' : 'none';
        }
    }

    /**
     * Get input value based on input type
     * @param {HTMLElement} element - Input element
     * @returns {*} Input value
     */
    getInputValue(element) {
        switch (element.type) {
            case 'checkbox':
                return element.checked;
            case 'number':
            case 'range':
                return parseFloat(element.value);
            default:
                return element.value;
        }
    }

    /**
     * Set input value based on input type
     * @param {string} id - Element ID
     * @param {*} value - Value to set
     */
    setInputValue(id, value) {
        const element = document.getElementById(id);
        if (!element) return;

        switch (element.type) {
            case 'checkbox':
                element.checked = Boolean(value);
                break;
            case 'number':
            case 'range':
                element.value = Number(value);
                break;
            default:
                element.value = String(value);
                break;
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
     * Save all settings to storage
     * @param {boolean} silent - Whether to show success message
     */
    async saveSettings(silent = false) {
        try {
            await this.storageManager.saveSettings(this.settings);
            this.markClean();

            if (!silent) {
                this.showSuccess('Settings saved successfully');
            }

            // Notify background script of changes
            chrome.runtime.sendMessage({
                type: 'SETTINGS_UPDATED',
                settings: this.settings,
            });
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showError('Failed to save settings. Please try again.');
        }
    }

    /**
     * Reset settings to defaults
     */
    async resetSettings() {
        if (
            !confirm(
                'Are you sure you want to reset all settings to defaults? This cannot be undone.'
            )
        ) {
            return;
        }

        try {
            await this.storageManager.resetSettings();
            await this.loadAllData();
            this.populateAllSettings();
            this.markClean();
            this.showSuccess('Settings reset to defaults');
        } catch (error) {
            console.error('Failed to reset settings:', error);
            this.showError('Failed to reset settings. Please try again.');
        }
    }

    /**
     * Export all data to file
     */
    async exportData() {
        try {
            const data = {
                usage: this.usage,
                blockList: this.blockList,
                settings: this.settings,
                videoSpeeds: this.videoSpeeds,
                exportDate: new Date().toISOString(),
                version: '1.0.0',
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json',
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `timedash-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();

            URL.revokeObjectURL(url);
            this.showSuccess('Data exported successfully');
        } catch (error) {
            console.error('Failed to export data:', error);
            this.showError('Failed to export data. Please try again.');
        }
    }

    /**
     * Import data from file
     * @param {Event} event - File input change event
     */
    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Validate data structure
            if (!this.validateImportData(data)) {
                throw new Error('Invalid data format');
            }

            if (
                !confirm(
                    'Are you sure you want to import this data? This will overwrite your current data.'
                )
            ) {
                return;
            }

            // Import data
            if (data.usage) await this.storageManager.saveUsage(data.usage);
            if (data.blockList) await this.storageManager.saveBlockList(data.blockList);
            if (data.settings) await this.storageManager.saveSettings(data.settings);
            if (data.videoSpeeds) await this.storageManager.saveVideoSpeeds(data.videoSpeeds);

            // Reload UI
            await this.loadAllData();
            this.populateAllSettings();
            this.updateStatistics();
            this.markClean();

            this.showSuccess('Data imported successfully');
        } catch (error) {
            console.error('Failed to import data:', error);
            this.showError('Failed to import data. Please check the file format.');
        }
    }

    /**
     * Validate imported data structure
     * @param {Object} data - Data to validate
     * @returns {boolean} Whether data is valid
     */
    validateImportData(data) {
        if (!data || typeof data !== 'object') return false;

        // Check for required fields
        const requiredFields = ['usage', 'blockList', 'settings'];
        return requiredFields.some((field) => data.hasOwnProperty(field));
    }

    /**
     * Clear all data
     */
    async clearAllData() {
        const message =
            'Are you sure you want to delete ALL data? This includes:\n' +
            '• All usage statistics\n' +
            '• Block list\n' +
            '• Video speed settings\n' +
            '• All preferences\n\n' +
            'This action cannot be undone.';

        if (!confirm(message)) return;

        try {
            await this.storageManager.clearAllData();
            await this.loadAllData();
            this.populateAllSettings();
            this.updateStatistics();
            this.markClean();
            this.showSuccess('All data cleared successfully');
        } catch (error) {
            console.error('Failed to clear data:', error);
            this.showError('Failed to clear data. Please try again.');
        }
    }

    /**
     * Mark settings as dirty (unsaved changes)
     */
    markDirty() {
        this.isDirty = true;
        this.updateSaveButton();
    }

    /**
     * Mark settings as clean (saved)
     */
    markClean() {
        this.isDirty = false;
        this.updateSaveButton();
    }

    /**
     * Update save button state
     */
    updateSaveButton() {
        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) {
            saveBtn.disabled = !this.isDirty;
            saveBtn.textContent = this.isDirty ? 'Save Changes' : 'Saved';
        }
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Show warning message
     * @param {string} message - Warning message
     */
    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    /**
     * Show notification message
     * @param {string} message - Message to show
     * @param {string} type - Notification type (success, error, warning)
     */
    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach((n) => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
    setupAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            if (this.isDirty) this.saveSettings(true);
        }, 30000);

        window.addEventListener('beforeunload', () => {
            if (this.isDirty) {
                this.saveSettings(true);
            }
        });
    }

    cleanup() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        if (this.boundKeyHandler) {
            document.removeEventListener('keydown', this.boundKeyHandler);
            this.boundKeyHandler = null;
        }
    }

    // Non-intrusive banner helpers (fallback to existing showSuccess/showError if present)
    showBanner(message, type = 'info') {
        const el = document.getElementById('banner');
        if (!el) return;
        el.className = `banner ${type}`;
        el.textContent = message;
        el.style.display = 'block';
        if (type !== 'error') {
            setTimeout(() => {
                if (el) el.style.display = 'none';
            }, 2500);
        }
    }
}

// Initialize options page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new OptionsController();
});

// Handle URL hash changes for tab navigation
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1);
    if (hash && document.querySelector(`[data-tab="${hash}"]`)) {
        document.querySelector(`[data-tab="${hash}"]`).click();
    }
});
