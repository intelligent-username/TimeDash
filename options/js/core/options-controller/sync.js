export function applyOptionsSyncMethods(OptionsController) {
    OptionsController.prototype.setupHelpLinks = function setupHelpLinks() {
        const privacyLinks = document.querySelectorAll('[id^="privacyPolicyLink"]');
        privacyLinks.forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const privacyTab = document.querySelector('[data-tab=privacy]');
                if (privacyTab) privacyTab.click();
            });
        });
    };

    OptionsController.prototype.setupExternalSettingsSync = function setupExternalSettingsSync() {
        chrome.storage.local.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local' || !changes.settings || !changes.settings.newValue) return;

            const previousTheme = this.settings.theme;
            const previousAccent = this.settings.accentColor;
            const incoming = changes.settings.newValue;

            this.settings = { ...this.settings, ...incoming };

            if (incoming.theme !== undefined && incoming.theme !== previousTheme) {
                this.applyImmediateChanges('theme', incoming.theme);
            }

            if (incoming.accentColor !== undefined && incoming.accentColor !== previousAccent) {
                this.applyImmediateChanges('accentColor', incoming.accentColor);
            }

            this.syncCurrentPlaybackSpeedUI();
        });

        document.addEventListener('visibilitychange', async () => {
            if (document.hidden) return;

            try {
                await chrome.runtime.sendMessage({ type: 'FLUSH_PENDING_UPDATES' }).catch(() => {});
                
                const [latestSettings, latestUsage] = await Promise.all([
                    this.storageManager.getSettings(),
                    this.storageManager.getAllUsage()
                ]);
                
                this.settings = { ...this.settings, ...latestSettings };
                this.usage = latestUsage;

                this.applyImmediateChanges('theme', this.settings.theme || 'light');
                this.applyImmediateChanges('accentColor', this.settings.accentColor || 'blue');
                this.syncCurrentPlaybackSpeedUI();
                
                if (this.analyticsUI) this.analyticsUI.update();
            } catch (error) {
                console.error('Failed to refresh data on visibility change:', error);
            }
        });

        // Periodically refresh the data to keep it as perfectly accurate as the popup
        setInterval(async () => {
            if (document.hidden) return;
            const activeTab = document.querySelector('.sidebar-nav-item.active');
            if (activeTab && activeTab.dataset.tab === 'analytics') {
                try {
                    await chrome.runtime.sendMessage({ type: 'FLUSH_PENDING_UPDATES' }).catch(() => {});
                    this.usage = await this.storageManager.getAllUsage();
                    if (this.analyticsUI) this.analyticsUI.update();
                } catch (error) {
                    console.error('Failed to auto-refresh analytics data:', error);
                }
            }
        }, 30000);
    };

    OptionsController.prototype.syncCurrentPlaybackSpeedUI = function syncCurrentPlaybackSpeedUI() {
        const speed = parseFloat(this.settings.currentPlaybackSpeed);
        if (!Number.isFinite(speed)) return;

        const speedNum = document.getElementById('currentPlaybackSpeed');
        const speedSlider = document.getElementById('currentSpeedSlider');

        if (speedNum) speedNum.value = speed;
        if (speedSlider) speedSlider.value = speed;
    };
}
