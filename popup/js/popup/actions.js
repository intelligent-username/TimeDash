export const actionMethods = {
    async changeSpeed(direction) {
        if (!this.settings) return;

        const step = this.settings.speedStep || 0.25;
        const max = this.settings.maxPlaybackSpeed || 16.0;
        const min = 0.05;

        let newSpeed = (this.settings.currentPlaybackSpeed || 1.0) + (direction * step);
        newSpeed = Math.round(newSpeed / step) * step;
        if (newSpeed > max) newSpeed = max;
        if (newSpeed < min) newSpeed = min;

        const newSettings = { ...this.settings, currentPlaybackSpeed: newSpeed };

        try {
            await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: newSettings });
            this.settings = newSettings;
            this.updateCurrentSpeed();
        } catch (error) {
            console.error('Failed to change speed:', error);
            PopupHelpers.showToast('Failed to change speed', 'error');
        }
    },

    async resetSpeed() {
        if (!this.settings) return;
        const defaultSpeed = this.settings.defaultPlaybackSpeed || 1.0;
        const newSettings = { ...this.settings, currentPlaybackSpeed: defaultSpeed };

        try {
            await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: newSettings });
            this.settings = newSettings;
            this.updateCurrentSpeed();
        } catch (error) {
            console.error('Failed to reset speed:', error);
        }
    },

    async toggleCurrentSiteBlock() {
        if (!this.currentTab || !PopupHelpers.shouldTrackUrl(this.currentTab.url)) {
            PopupHelpers.showToast('Cannot block this type of page', 'error');
            return;
        }

        const domain = PopupHelpers.extractDomain(this.currentTab.url);
        await this.toggleSiteBlock(domain);
    },

    async toggleSiteBlock(domain) {
        try {
            await chrome.runtime.sendMessage({ type: 'TOGGLE_BLOCK', domain });
            PopupHelpers.showToast(`${domain} ${(await this.isBlocked(domain)) ? 'unblocked' : 'blocked'}`, 'success');
            await this.refreshData();
        } catch (error) {
            console.error('Error toggling site block:', error);
            PopupHelpers.showToast('Failed to toggle site blocking', 'error');
        }
    },

    async isBlocked(domain) {
        const domainData = (this.usageData && this.usageData.domains)
            ? this.usageData.domains.find((d) => d.domain === domain)
            : null;
        return (domainData && domainData.isBlocked) || false;
    },

    async showSpeedControl() {
        const optionsUrl = chrome.runtime.getURL('options/options.html?tab=video');
        chrome.tabs.create({ url: optionsUrl });
    },

    async exportData() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'EXPORT_DATA_JSON' });
            const exportPayload = response?.data;
            if (!exportPayload) throw new Error('Missing export payload');

            const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `TDE_${new Date().toISOString().split('T')[0]}.json`;
            anchor.click();
            URL.revokeObjectURL(url);
            PopupHelpers.showToast('Data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            PopupHelpers.showToast('Failed to export data', 'error');
        }
    },

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
    },

    async toggleTracking() {
        try {
            const newSettings = {
                ...this.settings,
                trackingEnabled: !this.settings.trackingEnabled
            };

            await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: newSettings });
            this.settings = newSettings;
            this.updateFooter();
            PopupHelpers.showToast(`Time tracking ${newSettings.trackingEnabled ? 'enabled' : 'disabled'}`, 'success');
        } catch (error) {
            console.error('Error toggling tracking:', error);
            PopupHelpers.showToast('Failed to toggle tracking', 'error');
        }
    },

    openDashboard() {
        chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
    },

    showSetupModal() {
        const modal = document.getElementById('setupModal');
        const content = modal.querySelector('.modal-content');
        modal.hidden = false;
        modal.classList.add('show');

        const focusable = content.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
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

        document.getElementById('defaultSpeed').value = this.settings.currentPlaybackSpeed || 1.0;
    },

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
    },

    async completeSetup() {
        try {
            const newSettings = {
                ...this.settings,
                currentPlaybackSpeed: parseFloat(document.getElementById('defaultSpeed').value),
                firstTimeSetup: false
            };

            await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: newSettings });
            this.settings = newSettings;
            PopupHelpers.showBanner(I18n.t('setupComplete'), 'success');
            this.closeSetupModal();
        } catch (error) {
            console.error('Error completing setup:', error);
            PopupHelpers.showBanner(I18n.t('setupFailed'), 'error');
        }
    },

    showError(message) {
        PopupHelpers.showToast(message, 'error');
    }
};
