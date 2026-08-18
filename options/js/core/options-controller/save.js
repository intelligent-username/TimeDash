import { showToast } from '../../utils/dom.js';

/**
 *
 * @param OptionsController
 */
export function applyOptionsSaveMethods(OptionsController) {
    OptionsController.prototype.setupAutoSave = function setupAutoSave() {
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
            this.updateSaveStatus(I18n.t('savingChanges'), true);
            await this.storageManager.saveSettings(this.settings);
            this.isDirty = false;

            this.updateSaveStatus(I18n.t('saved'), true);
            setTimeout(() => {
                this.updateSaveStatus('', false);
            }, 1000);

            if (!silent) this.showSuccess(I18n.t('settingsSaved'));
        } catch (error) {
            console.error(error);
            this.updateSaveStatus(I18n.t('errorSaving'), true);
            this.showError(I18n.t('failedSaveSettings'));
        }
    };

    OptionsController.prototype.updateSaveStatus = function updateSaveStatus(
        message,
        visible = true
    ) {
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
        showToast(msg, 'success');
    };

    OptionsController.prototype.showError = function showError(msg) {
        showToast(msg, 'error');
    };

    OptionsController.prototype.showWarning = function showWarning(msg) {
        showToast(msg, 'warning');
    };

    OptionsController.prototype.updateRestrictedDomains = function updateRestrictedDomains(
        domains
    ) {
        this.restrictedDomains = domains;
        if (this.analyticsUI && typeof this.analyticsUI.update === 'function') {
            this.analyticsUI.update();
        }
    };

    OptionsController.prototype.showBanner = function showBanner(message, type = 'info') {
        showToast(message, type);
    };
}
