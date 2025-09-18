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
            if (this.settings?.firstTimeSetup) {
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
        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

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
        const domainData = this.usageData?.domains?.find((d) => d.domain === domain);

        siteName.textContent = PopupHelpers.capitalize(domain);
        siteTime.textContent = domainData
            ? `Today: ${PopupHelpers.formatDetailedTime(domainData.todayTime)}`
            : 'No time recorded today';

        siteFavicon.src = PopupHelpers.getFaviconUrl(domain);
        siteFavicon.style.display = 'block';

        // Update block button
        const isBlocked = domainData?.isBlocked || false;
        blockBtn.textContent = isBlocked ? 'Unblock Site' : 'Block Site';
        blockBtn.className = `action-btn block-btn ${isBlocked ? 'blocked' : ''}`;

        // Update speed indicator (this would come from content script)
        this.updateCurrentSpeed(domain);
    }

    /**
     * Update current video speed display
     */
    async updateCurrentSpeed(domain) {
        try {
            if (this.currentTab) {
                const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                    type: 'GET_CURRENT_SPEED',
                });
                if (response?.speed) {
                    document.getElementById('currentSpeed').textContent = `${response.speed}x`;
                }
            }
        } catch (error) {
            // Content script might not be available, use default
            document.getElementById('currentSpeed').textContent = '1.0x';
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

        if (!this.usageData?.domains || this.usageData.domains.length === 0) {
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

        const isTracking = this.settings?.trackingEnabled !== false;
        const totalSites = this.usageData?.domains?.length || 0;

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
        const domainData = this.usageData?.domains?.find((d) => d.domain === domain);
        return domainData?.isBlocked || false;
    }

    /**
     * Show speed control interface
     */
    async showSpeedControl() {
        if (!this.currentTab) return;

        try {
            await chrome.tabs.sendMessage(this.currentTab.id, { type: 'TOGGLE_OVERLAY' });
        } catch (error) {
            PopupHelpers.showToast('Speed control not available on this page', 'error');
        }
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
                a.download = `timedash-export-${new Date().toISOString().split('T')[0]}.csv`;
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
        document.getElementById('defaultSpeed').value = this.settings.defaultPlaybackSpeed || 1.0;
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
        document.getElementById('settingsBtn')?.focus();
    }

    /**
     * Complete first-time setup
     */
    async completeSetup() {
        try {
            const newSettings = {
                ...this.settings,
                defaultPlaybackSpeed: parseFloat(document.getElementById('defaultSpeed').value),
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

        const last7Days = [];
        const today = new Date();

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            let dayTotal = 0;
            this.usageData.domains.forEach((domain) => {
                // This would need to be implemented in the background script
                // to provide daily breakdowns
                dayTotal += domain.todayTime || 0; // Simplified for now
            });

            last7Days.push(dayTotal);
        }

        const total = last7Days.reduce((sum, day) => sum + day, 0);
        return Math.round(total / 7);
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

    /**
     * Cleanup when popup closes
     */
    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
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
