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
                const latestSettings = await this.storageManager.getSettings();
                this.settings = { ...this.settings, ...latestSettings };

                this.applyImmediateChanges('theme', this.settings.theme || 'light');
                this.applyImmediateChanges('accentColor', this.settings.accentColor || 'blue');
                this.syncCurrentPlaybackSpeedUI();
            } catch (error) {
                console.error('Failed to refresh settings on visibility change:', error);
            }
        });
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
