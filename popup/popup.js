'use strict';

/**
 * Main popup script for TimeDash extension
 * Handles UI interactions and communication with background script
 */
class TimeDashPopup {
    constructor() {
        this.currentTab = null;
        this.usageData = null;
        this.settings = null;
        this.updateInterval = null;
        this.autoUpdateInterval = null;
        this.boundKeyHandler = null;
        this.currentTabHasVideo = false;
        window.timeDashPopup = this;

        this.init();
    }

    /**
     * Initialize popup
     */
    async init() {
        try {
            PopupHelpers.showBanner(I18n.t('loading'), 'info');
            await this.loadCurrentTab();
            await this.loadData();

            // i18n apply
            I18n.init(document);

            // Skeletons while first render
            PopupHelpers.injectSkeletonList(document.getElementById('sitesList'), 5);

            this.setupEventListeners();
            this.updateUI();
            this.startAutoUpdate();
            PopupHelpers.hideBanner();

            // Check for first-time setup
            if (this.settings && this.settings.firstTimeSetup) {
                this.showSetupModal();
            }
        } catch (error) {
            console.error('Popup init failed:', error);
            PopupHelpers.showBanner(I18n.t('errorGeneric'), 'error');
        }
    }

    /**
     * Load current active tab information
     */
    async loadCurrentTab() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs[0];
        } catch (error) {
            console.error('Error loading current tab:', error);
        }
    }

    /**
     * Load usage data and settings from background script
     */
    async loadData() {
        try {
            // Load usage data
            const usageResponse = await chrome.runtime.sendMessage({ type: 'GET_USAGE_DATA' });
            this.usageData = usageResponse;

            // Load settings
            const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            this.settings = settingsResponse;
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    /**
     * Set up event listeners for popup interactions
     */
    setupEventListeners() {
        chrome.storage.local.onChanged.addListener((changes) => {
            if (changes.settings && changes.settings.newValue) {
                this.settings = changes.settings.newValue;
                this.updateCurrentSpeed();
            }
        });
        // Settings Button
        document.getElementById('settingsBtn').addEventListener('click', async () => {
            let tab = 'general';

            if (this.currentTab) {
                // Check if we are on the blocked page
                if (this.currentTab.url.includes('block.html')) {
                    tab = 'blocking';
                } else {
                    const domain = this.extractDomain(this.currentTab.url);
                    const isBlocked = await this.isBlocked(domain);

                    if (isBlocked) {
                        tab = 'blocking';
                    } else if (this.currentTabHasVideo) {
                        tab = 'video';
                    }
                }
            }

            const optionsUrl = chrome.runtime.getURL(`options/options.html?tab=${tab}`);
            chrome.tabs.create({ url: optionsUrl });
        });

        // Decrease/Increase Speed buttons
        const decSpeedBtn = document.getElementById('decreaseSpeedBtn');
        if (decSpeedBtn) {
            decSpeedBtn.addEventListener('click', () => this.changeSpeed(-1));
        }
        
        const incSpeedBtn = document.getElementById('increaseSpeedBtn');
        if (incSpeedBtn) {
            incSpeedBtn.addEventListener('click', () => this.changeSpeed(1));
        }

        // Block/unblock button
        document.getElementById('blockBtn').addEventListener('click', () => {
            this.toggleCurrentSiteBlock();
        });

        // Speed button
        document.getElementById('speedBtn').addEventListener('click', () => {
            this.showSpeedControl();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // Toggle tracking
        document.getElementById('toggleTracking').addEventListener('click', () => {
            this.toggleTracking();
        });

        // Global keybinds inside popup
        document.addEventListener('keydown', (event) => {
            if (this.settings && this.settings.firstTimeSetup) return; // Don't interfere with modal
            
            // Check if user is typing in an input
            const activeElement = document.activeElement;
            const isInput = activeElement && (
                activeElement.tagName === 'INPUT' || 
                activeElement.tagName === 'TEXTAREA' || 
                activeElement.isContentEditable
            );
            if (isInput) return;

            const getKeyAliases = (baseKey) => {
                const map = {
                    'Plus': ['Equal', 'NumpadAdd', 'Plus'],
                    'Minus': ['Minus', 'NumpadSubtract'],
                    'Period': ['Period', 'NumpadDecimal', 'NumpadComma'],
                    'Enter': ['Enter', 'NumpadEnter']
                };
                return [baseKey, ...(map[baseKey] || [])];
            };

            const increaseKeys = getKeyAliases((this.settings && this.settings.increaseSpeedKey) || 'Plus');
            const decreaseKeys = getKeyAliases((this.settings && this.settings.decreaseSpeedKey) || 'Minus');
            const resetKeys = getKeyAliases((this.settings && this.settings.resetSpeedKey) || 'Period');

            if (!event.ctrlKey && !event.altKey && !event.metaKey) {
                if (increaseKeys.includes(event.code)) {
                    event.preventDefault();
                    this.changeSpeed(1);
                } else if (decreaseKeys.includes(event.code)) {
                    event.preventDefault();
                    this.changeSpeed(-1);
                } else if (resetKeys.includes(event.code)) {
                    event.preventDefault();
                    this.resetSpeed();
                }
            }
        });

        // Dashboard button
        document.getElementById('openDashboard').addEventListener('click', () => {
            this.openDashboard();
        });

        // Setup modal completion
        document.getElementById('completeSetup').addEventListener('click', () => {
            this.completeSetup();
        });

        // Site item actions (delegated event handling)
        document.getElementById('sitesList').addEventListener('click', (e) => {
            const button = e.target.closest('.site-item-btn');
            if (button) {
                const domain = button.dataset.domain;
                this.toggleSiteBlock(domain);
            }
        });
    }

    /**
     * Update the entire UI
     */
    updateUI() {
        // Apply theme and accent
        if (this.settings) {
            document.documentElement.setAttribute('data-theme', this.settings.theme || 'auto');
            document.documentElement.setAttribute('data-accent', this.settings.accentColor || 'blue');
            this.updateCurrentSpeed();
        }

        this.updateCurrentSite();
        this.updateQuickStats();
        this.updateTopSites();
        this.updateFooter();
    }

    /**
     * Update current site information
     */
    updateCurrentSite() {
        const currentSiteEl = document.getElementById('currentSite');
        const siteName = document.getElementById('siteName');
        const siteTime = document.getElementById('siteTime');
        const siteFavicon = document.getElementById('siteFavicon');
        const blockBtn = document.getElementById('blockBtn');
        const currentSpeed = document.getElementById('currentSpeed');

        if (!this.currentTab || !this.currentTab.url || !this.shouldTrackUrl(this.currentTab.url)) {
            siteName.textContent = 'Non-trackable page';
            siteTime.textContent = 'Time tracking disabled for this page';
            siteFavicon.style.display = 'none';
            blockBtn.style.display = 'none';
            return;
        }

        const domain = this.extractDomain(this.currentTab.url);
        const domainData = (this.usageData && this.usageData.domains) ? this.usageData.domains.find((d) => d.domain === domain) : null;

        siteName.textContent = PopupHelpers.capitalize(domain);
        siteTime.textContent = domainData
            ? `Today: ${PopupHelpers.formatDetailedTime(domainData.todayTime)}`
            : 'No time recorded today';

        siteFavicon.src = PopupHelpers.getFaviconUrl(domain);
        siteFavicon.style.display = 'block';

        // Update block button
        const isBlocked = (domainData && domainData.isBlocked) || false;
        blockBtn.textContent = isBlocked ? 'Unblock Site' : 'Block Site';
        blockBtn.className = `action-btn block-btn ${isBlocked ? 'blocked' : ''}`;
    }

    /**
     * Update current video speed display
     */
    async updateCurrentSpeed() {
        this.currentTabHasVideo = true; // universally assume speed applies
        const speed = (this.settings && this.settings.currentPlaybackSpeed) || 1.0;
        document.getElementById('currentSpeed').textContent = `${Number(speed).toFixed(2)}x`;
    }

    /**
     * Change Speed
     */
    async changeSpeed(direction) {
        if (!this.settings) return;
        
        const step = this.settings.speedStep || 0.25;
        const max = this.settings.maxPlaybackSpeed || 16.0;
        const min = 0.05;
        
        let newSpeed = (this.settings.currentPlaybackSpeed || 1.0) + (direction * step);
        newSpeed = Math.round(newSpeed / step) * step; // avoids floats
        
        if (newSpeed > max) newSpeed = max;
        if (newSpeed < min) newSpeed = min;
        
        const newSettings = {
            ...this.settings,
            currentPlaybackSpeed: newSpeed
        };

        try {
            await chrome.runtime.sendMessage({
                type: 'UPDATE_SETTINGS',
                settings: newSettings
            });
            this.settings = newSettings;
            this.updateCurrentSpeed();
        } catch (error) {
            console.error('Failed to change speed:', error);
            PopupHelpers.showToast('Failed to change speed', 'error');
        }
    }

    /**
     * Reset Speed
     */
    async resetSpeed() {
        if (!this.settings) return;
        const defaultSpeed = this.settings.defaultPlaybackSpeed || 1.0;
        
        const newSettings = {
            ...this.settings,
            currentPlaybackSpeed: defaultSpeed
        };

        try {
            await chrome.runtime.sendMessage({
                type: 'UPDATE_SETTINGS',
                settings: newSettings
            });
            this.settings = newSettings;
            this.updateCurrentSpeed();
        } catch (error) {
            console.error('Failed to reset speed:', error);
        }
    }

    /**
     * Update quick statistics
     */
    updateQuickStats() {
        const todayTotal = document.getElementById('todayTotal');
        const weekAverage = document.getElementById('weekAverage');
        const totalTime = document.getElementById('totalTime');

        if (!this.usageData) return;

        const { totalToday, totalOverall } = this.usageData;

        todayTotal.textContent = PopupHelpers.formatTime(totalToday);
        totalTime.textContent = PopupHelpers.formatTime(totalOverall);

        // Calculate week average
        const avgDaily = this.calculateWeeklyAverage();
        weekAverage.textContent = PopupHelpers.formatTime(avgDaily);
    }

    /**
     * Update top sites list
     */
    updateTopSites() {
        const sitesList = document.getElementById('sitesList');

        if (!this.usageData || !this.usageData.domains || this.usageData.domains.length === 0) {
            sitesList.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
                    </svg>
                    <p>No sites tracked yet.<br>Start browsing to see your usage!</p>
                </div>
            `;
            return;
        }

        // Show top 5 sites with time today
        const topSites = this.usageData.domains.filter((site) => site.todayTime > 0).slice(0, 5);

        if (topSites.length === 0) {
            sitesList.innerHTML = `
                <div class="empty-state">
                    <p>No activity today yet.<br>Your tracked sites will appear here.</p>
                </div>
            `;
            return;
        }

        sitesList.innerHTML = '';
        topSites.forEach((siteData) => {
            const siteItem = PopupHelpers.createSiteItem(siteData);
            PopupHelpers.animateIn(siteItem);
            sitesList.appendChild(siteItem);
        });
    }

    /**
     * Update footer information
     */
    updateFooter() {
        const trackingStatus = document.getElementById('trackingStatus');
        const sitesCount = document.getElementById('sitesCount');
        const toggleBtn = document.getElementById('toggleTracking');

        const isTracking = (this.settings && this.settings.trackingEnabled) !== false;
        const totalSites = (this.usageData && this.usageData.domains) ? this.usageData.domains.length : 0;

        trackingStatus.textContent = isTracking ? '● Tracking Active' : '● Tracking Paused';
        trackingStatus.className = `tracking-status ${isTracking ? 'active' : 'paused'}`;

        sitesCount.textContent = `${totalSites} sites tracked`;

        toggleBtn.textContent = isTracking ? 'Pause Tracking' : 'Resume Tracking';
        toggleBtn.className = `toggle-btn ${isTracking ? '' : 'paused'}`;
    }

    /**
     * Toggle blocking for current site
     */
    async toggleCurrentSiteBlock() {
        if (!this.currentTab || !this.shouldTrackUrl(this.currentTab.url)) {
            PopupHelpers.showToast('Cannot block this type of page', 'error');
            return;
        }

        const domain = this.extractDomain(this.currentTab.url);
        await this.toggleSiteBlock(domain);
    }

    /**
     * Toggle blocking for a specific domain
     */
    async toggleSiteBlock(domain) {
        try {
            await chrome.runtime.sendMessage({
                type: 'TOGGLE_BLOCK',
                domain: domain,
            });

            PopupHelpers.showToast(
                `${domain} ${(await this.isBlocked(domain)) ? 'unblocked' : 'blocked'}`,
                'success'
            );

            // Refresh data to update UI
            await this.refreshData();
        } catch (error) {
            console.error('Error toggling site block:', error);
            PopupHelpers.showToast('Failed to toggle site blocking', 'error');
        }
    }

    /**
     * Check if domain is blocked
     */
    async isBlocked(domain) {
        const domainData = (this.usageData && this.usageData.domains) ? this.usageData.domains.find((d) => d.domain === domain) : null;
        return (domainData && domainData.isBlocked) || false;
    }

    /**
     * Show speed control interface
     */
    async showSpeedControl() {
        const optionsUrl = chrome.runtime.getURL('options/options.html?tab=video');
        chrome.tabs.create({ url: optionsUrl });
    }

    /**
     * Export usage data
     */
    async exportData() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'EXPORT_DATA' });

            if (response.data) {
                // Create and download file
                const blob = new Blob([response.data], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `TDE_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);

                PopupHelpers.showToast('Data exported successfully', 'success');
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            PopupHelpers.showToast('Failed to export data', 'error');
        }
    }

    /**
     * Refresh data from background script
     */
    async refreshData() {
        try {
            const refreshBtn = document.getElementById('refreshBtn');
            const originalContent = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '';
            refreshBtn.appendChild(PopupHelpers.createLoadingSpinner());

            await this.loadData();
            this.updateUI();

            refreshBtn.innerHTML = originalContent;
            PopupHelpers.showToast('Data refreshed', 'success');
        } catch (error) {
            console.error('Error refreshing data:', error);
            PopupHelpers.showToast('Failed to refresh data', 'error');
        }
    }

    /**
     * Toggle time tracking on/off
     */
    async toggleTracking() {
        try {
            const newSettings = {
                ...this.settings,
                trackingEnabled: !this.settings.trackingEnabled,
            };

            await chrome.runtime.sendMessage({
                type: 'UPDATE_SETTINGS',
                settings: newSettings,
            });

            this.settings = newSettings;
            this.updateFooter();

            const status = newSettings.trackingEnabled ? 'enabled' : 'disabled';
            PopupHelpers.showToast(`Time tracking ${status}`, 'success');
        } catch (error) {
            console.error('Error toggling tracking:', error);
            PopupHelpers.showToast('Failed to toggle tracking', 'error');
        }
    }

    /**
     * Open full dashboard in new tab
     */
    openDashboard() {
        chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
    }

    /**
     * Show first-time setup modal
     */
    showSetupModal() {
        const modal = document.getElementById('setupModal');
        const content = modal.querySelector('.modal-content');
        modal.hidden = false;
        modal.classList.add('show');

        // Focus trap
        const focusable = content.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const onKeydown = (e) => {
            if (e.key === 'Escape') {
                this.closeSetupModal();
            } else if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        this.boundKeyHandler = onKeydown;
        document.addEventListener('keydown', onKeydown);
        (first || content).focus();

        // Set default values
        document.getElementById('defaultSpeed').value = this.settings.currentPlaybackSpeed || 1.0;
        document.getElementById('maxSpeed').value = this.settings.maxPlaybackSpeed || 16.0;
        document.getElementById('dailyLimit').value = this.settings.dailyTimeLimitMinutes || 0;
        document.getElementById('enableNotifications').checked =
            this.settings.notificationsEnabled !== false;
    }

    /**
     * Close setup modal
     */
    closeSetupModal() {
        const modal = document.getElementById('setupModal');
        modal.classList.remove('show');
        modal.hidden = true;
        if (this.boundKeyHandler) {
            document.removeEventListener('keydown', this.boundKeyHandler);
            this.boundKeyHandler = null;
        }
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) settingsBtn.focus();
    }

    /**
     * Complete first-time setup
     */
    async completeSetup() {
        try {
            const newSettings = {
                ...this.settings,
                currentPlaybackSpeed: parseFloat(document.getElementById('defaultSpeed').value),
                maxPlaybackSpeed: parseFloat(document.getElementById('maxSpeed').value),
                dailyTimeLimitMinutes: parseInt(document.getElementById('dailyLimit').value),
                notificationsEnabled: document.getElementById('enableNotifications').checked,
                firstTimeSetup: false,
            };

            await chrome.runtime.sendMessage({
                type: 'UPDATE_SETTINGS',
                settings: newSettings,
            });

            this.settings = newSettings;

            PopupHelpers.showBanner(I18n.t('setupComplete'), 'success');
            this.closeSetupModal();
        } catch (error) {
            console.error('Error completing setup:', error);
            PopupHelpers.showBanner(I18n.t('setupFailed'), 'error');
        }
    }

    /**
     * Start auto-update timer
     */
    startAutoUpdate() {
        this.stopAutoUpdate();
        this.autoUpdateInterval = setInterval(() => this.updateUI(), 30000);
    }

    stopAutoUpdate() {
        if (this.autoUpdateInterval) {
            clearInterval(this.autoUpdateInterval);
            this.autoUpdateInterval = null;
        }
    }

    cleanup() {
        this.stopAutoUpdate();
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.boundKeyHandler) {
            document.removeEventListener('keydown', this.boundKeyHandler);
            this.boundKeyHandler = null;
        }
    }

    /**
     * Calculate weekly average daily usage
     */
    calculateWeeklyAverage() {
        if (!this.usageData?.domains) return 0;

        // Calculate average based on total time and number of tracked domains
        // Using totalToday as a representative daily sample
        const todayTotal = this.usageData.totalToday || 0;

        // If we have totalOverall and domains, estimate average daily usage
        // by dividing total time by estimated active days (conservative: use 7)
        const totalOverall = this.usageData.totalOverall || 0;

        if (totalOverall > 0 && todayTotal > 0) {
            // Estimate days of usage based on ratio of total to today
            // Cap at 7 days for weekly average
            const estimatedDays = Math.min(7, Math.max(1, Math.round(totalOverall / todayTotal)));
            return Math.round(totalOverall / estimatedDays);
        }

        // Fallback: just return today's total as the average
        return todayTotal;
    }

    /**
     * Extract domain from URL
     */
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '');
        } catch (error) {
            return url;
        }
    }

    /**
     * Check if URL should be tracked
     */
    shouldTrackUrl(url) {
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
        return !excludedSchemes.some((scheme) => url.startsWith(scheme));
    }

    /**
     * Show error message
     */
    showError(message) {
        PopupHelpers.showToast(message, 'error');
    }


}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new TimeDashPopup();
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (window.timeDashPopup) {
        window.timeDashPopup.cleanup();
    }
});
