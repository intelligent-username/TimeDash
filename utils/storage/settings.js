'use strict';

function applyStorageSettingsMethods(StorageManager) {
    StorageManager.prototype.init = async function init() {
        try {
            const result = await chrome.storage.local.get(['settings', 'usage', 'blockList']);

            if (!result.settings) {
                await this.setSettings(this.DEFAULT_SETTINGS);
            } else {
                if (result.settings.defaultPlaybackSpeed !== undefined && result.settings.currentPlaybackSpeed === undefined) {
                    result.settings.currentPlaybackSpeed = result.settings.defaultPlaybackSpeed;
                    delete result.settings.defaultPlaybackSpeed;
                    await this.setSettings(result.settings);
                }

                if (result.settings.firstInstallDate === undefined || result.settings.firstInstallDate === null) {
                    result.settings.firstInstallDate = Date.now();
                    await this.setSettings(result.settings);
                }
            }

            if (!result.usage) {
                await chrome.storage.local.set({ usage: {} });
            }

            if (!result.blockList) {
                await chrome.storage.local.set({ blockList: [] });
            }
        } catch (error) {
            console.error('StorageManager initialization failed:', error);
        }
    };

    StorageManager.prototype.getSettings = async function getSettings() {
        try {
            const result = await chrome.storage.local.get('settings');
            return { ...this.DEFAULT_SETTINGS, ...result.settings };
        } catch (error) {
            console.error('Failed to get settings:', error);
            return this.DEFAULT_SETTINGS;
        }
    };

    StorageManager.prototype.setSettings = async function setSettings(newSettings) {
        try {
            const currentSettings = await this.getSettings();
            const updatedSettings = { ...currentSettings, ...newSettings };
            await chrome.storage.local.set({ settings: updatedSettings });
            return true;
        } catch (error) {
            console.error('Failed to set settings:', error);
            return false;
        }
    };

    StorageManager.prototype.resetSettings = async function resetSettings() {
        try {
            await this.setSettings(this.DEFAULT_SETTINGS);
            return true;
        } catch (error) {
            console.error('Failed to reset settings:', error);
            return false;
        }
    };

    StorageManager.prototype.saveSettings = async function saveSettings(settings) {
        try {
            await this.setSettings(settings);
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            return false;
        }
    };
}
