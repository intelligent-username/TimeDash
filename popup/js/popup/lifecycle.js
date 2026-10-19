export const lifecycleMethods = {
    async init() {
        try {
            PopupHelpers.showBanner(I18n.t('loading'), 'info');
            await this.loadCurrentTab();
            await this.loadData();

            await I18n.setLocale(this.settings?.language || 'auto');
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

    async sendWithRetry(message, maxAttempts = 3) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await chrome.runtime.sendMessage(message);
            } catch (err) {
                if (attempt === maxAttempts) throw err;
                await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
            }
        }
    },

    async loadData() {
        try {
            this.usageData = await this.sendWithRetry({ type: 'GET_USAGE_DATA' });
            this.settings = await this.sendWithRetry({ type: 'GET_SETTINGS' });

            try {
                const rulesResponse = await this.sendWithRetry({ type: 'GET_SITE_RULES' });
                this.siteRules = rulesResponse || { blocked: [], restricted: [] };
            } catch {
                this.siteRules = { blocked: [], restricted: [] };
            }
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    },

    startAutoUpdate() {
        this.stopAutoUpdate();
        this.autoUpdateInterval = setInterval(async () => {
            try {
                const usageResponse = await chrome.runtime.sendMessage({ type: 'GET_USAGE_DATA' });
                this.usageData = usageResponse;
                this.updateUI();
            } catch (error) {
                console.error('Auto-update failed:', error);
            }
        }, 10000);
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
    },
};
