/* global StorageManager, applyBlockAccessMethods, applyBlockUiMethods */
class BlockPageController {
    constructor() {
        this.storageManager = null;
        this.blockedUrl = '';
        this.blockedDomain = '';
        this.blockReason = 'blocked';
        this.blockStats = {
            count: 0,
            timeSpent: 0,
            todayTime: 0,
        };
        this.usedFromUrl = null;
        this.init();
    }

    async init() {
        try {
            this.storageManager = new StorageManager();
            this.parseUrlParameters();

            const settings = await this.storageManager.getSettings();
            if (typeof I18n !== 'undefined') {
                await I18n.setLocale(settings?.language || 'auto');
                I18n.init(document);
            }

            // Apply theme immediately
            await this.applyTheme();

            const loadingEl = document.getElementById('blockLoading');
            if (loadingEl) loadingEl.hidden = false;

            // Check if access is now allowed (time limit may have been changed)
            const stillBlocked = await this.checkIfStillBlocked();

            if (loadingEl) loadingEl.hidden = true;
            if (!stillBlocked && this.blockedUrl) {
                // Access is now allowed - redirect back to the original site
                this.redirectToOriginalUrl();
                return;
            }

            await this.loadBlockData();
            this.setupEventListeners();
            this.updateUI();

            this._storageHandler = (changes, area) => {
                if (area !== 'local') return;
                this._recheckAccess();
            };
            chrome.storage.onChanged.addListener(this._storageHandler);

            this._recheckTimer = setInterval(() => this._recheckAccess(), 30000);
        } catch (error) {
            console.error('Failed to initialize block page:', error);
        }
    }

    async applyTheme() {
        const settings = await this.storageManager.getSettings();
        if (settings) {
            document.documentElement.setAttribute('data-theme', settings.theme || 'auto');
            document.documentElement.setAttribute('data-accent', settings.accentColor || 'blue');
            if (settings.animationsEnabled === false) {
                document.documentElement.setAttribute('data-reduced-motion', 'true');
            } else {
                document.documentElement.removeAttribute('data-reduced-motion');
            }
        }
    }

    async _recheckAccess() {
        const stillBlocked = await this.checkIfStillBlocked();
        if (!stillBlocked && this.blockedUrl) {
            this.redirectToOriginalUrl();
        }
    }
}

applyBlockAccessMethods(BlockPageController);
applyBlockUiMethods(BlockPageController);

document.addEventListener('DOMContentLoaded', () => {
    const ctrl = new BlockPageController();
    window.addEventListener('beforeunload', () => {
        if (ctrl._recheckTimer) clearInterval(ctrl._recheckTimer);
        if (ctrl._storageHandler) chrome.storage.onChanged.removeListener(ctrl._storageHandler);
    });
});
