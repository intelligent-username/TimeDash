export const lifecycleMethods = {
    async init() {
        try {
            PopupHelpers.showBanner(I18n.t('loading'), 'info');
            await this.loadCurrentTab();
            await this.loadData();

            I18n.init(document);
            PopupHelpers.injectSkeletonList(document.getElementById('sitesList'), 5);

            this.setupEventListeners();
            this.updateUI();
            this.startAutoUpdate();
            PopupHelpers.hideBanner();

            if (this.settings && this.settings.firstTimeSetup) {
                this.showSetupModal();
            }
        } catch (error) {
            console.error('Popup init failed:', error);
            PopupHelpers.showBanner(I18n.t('errorGeneric'), 'error');
        }
    },

    async loadCurrentTab() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs[0];
        } catch (error) {
            console.error('Error loading current tab:', error);
        }
    },

    async loadData() {
        try {
            const usageResponse = await chrome.runtime.sendMessage({ type: 'GET_USAGE_DATA' });
            this.usageData = usageResponse;

            const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            this.settings = settingsResponse;
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    },

    startAutoUpdate() {
        this.stopAutoUpdate();
        this.autoUpdateInterval = setInterval(() => this.updateUI(), 30000);
    },

    stopAutoUpdate() {
        if (this.autoUpdateInterval) {
            clearInterval(this.autoUpdateInterval);
            this.autoUpdateInterval = null;
        }
    },

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
};
