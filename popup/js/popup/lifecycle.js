export const lifecycleMethods = {
    async init() {
        let loadingFallback = null;
        try {
            // Fail-safe: popup renders instantly; loading UI only appears if data load stalls past 1s
            loadingFallback = setTimeout(() => {
                const siteName = document.getElementById('siteName');
                const siteTime = document.getElementById('siteTime');
                const sitesLoading = document.getElementById('sitesLoading');
                if (siteName && !siteName.textContent.trim()) {
                    siteName.textContent = I18n.t('loadingSite');
                }
                if (siteTime && !siteTime.textContent.trim()) {
                    siteTime.textContent = I18n.t('calculatingSite');
                }
                if (sitesLoading && !sitesLoading.textContent.trim()) {
                    sitesLoading.textContent = I18n.t('loadingSites');
                }
                PopupHelpers.showBanner(I18n.t('loading'), 'info');
            }, 1000);

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
        } finally {
            clearTimeout(loadingFallback);
        }
    },

    async loadCurrentTab() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs[0];

            // Paint the site name immediately from the tab URL — don't wait for data/messaging
            const siteName = document.getElementById('siteName');
            if (siteName && this.currentTab?.url && PopupHelpers.shouldTrackUrl(this.currentTab.url)) {
                siteName.textContent = PopupHelpers.capitalize(
                    PopupHelpers.extractDomain(this.currentTab.url)
                );
            }
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
            // Extension context gone (reload/update) — stop ticking instead of
            // hammering a dead message port.
            if (!chrome.runtime?.id) {
                this.stopAutoUpdate();
                return;
            }
            try {
                const usageResponse = await this.sendWithRetry({ type: 'GET_USAGE_DATA' });
                this.usageData = usageResponse;
                this.updateUI();
            } catch (error) {
                // SW briefly unavailable (idle wake-up race) — retry next tick.
                console.warn('Auto-update skipped:', error?.message || error);
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
