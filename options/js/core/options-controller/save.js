export function applyOptionsSaveMethods(OptionsController) {
    OptionsController.prototype.setupAutoSave = function setupAutoSave() {
        setInterval(() => {
            if (this.isDirty) this.saveSettings(true);
        }, 5000);

        window.addEventListener('beforeunload', () => {
            if (this.isDirty) this.saveSettings(true);
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isDirty) {
                this.saveSettings(true);
            }
        });
    };

    OptionsController.prototype.saveSettings = async function saveSettings(silent = false) {
        try {
            this.updateSaveStatus('Saving changes...', true);
            await this.storageManager.saveSettings(this.settings);
            this.isDirty = false;

            this.updateSaveStatus('Saved', true);
            setTimeout(() => {
                this.updateSaveStatus('', false);
            }, 1000);

            if (!silent) this.showSuccess('Settings saved');
            chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: this.settings });
        } catch (error) {
            console.error(error);
            this.updateSaveStatus('Error saving', true);
            this.showError('Failed to save settings');
        }
    };

    OptionsController.prototype.updateSaveStatus = function updateSaveStatus(message, visible = true) {
        const status = document.getElementById('saveStatus');
        if (!status) return;

        const msg = status.querySelector('.save-message');
        if (message && msg) {
            msg.textContent = message;
        }

        status.style.opacity = visible ? '1' : '0';
        status.style.pointerEvents = visible ? 'auto' : 'none';
    };

    OptionsController.prototype.updateSaveButton = function updateSaveButton() {
        this.updateSaveStatus('', false);
    };

    OptionsController.prototype.showSuccess = function showSuccess(msg) {
        this.showToast(msg, 'success');
    };

    OptionsController.prototype.showError = function showError(msg) {
        this.showToast(msg, 'error');
    };

    OptionsController.prototype.showWarning = function showWarning(msg) {
        this.showToast(msg, 'warning');
    };

    OptionsController.prototype.updateRestrictedDomains = function updateRestrictedDomains(domains) {
        this.restrictedDomains = domains;
    };

    OptionsController.prototype.showBanner = function showBanner(message, type = 'info') {
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
    };
}
