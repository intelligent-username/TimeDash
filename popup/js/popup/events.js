export const eventMethods = {
    setupEventListeners() {
        chrome.storage.local.onChanged.addListener((changes) => {
            if (changes.settings && changes.settings.newValue) {
                this.settings = { ...(this.settings || {}), ...changes.settings.newValue };
                this.applyThemeAndAccent();
                this.updateCurrentSpeed();
            }
        });

        document.getElementById('settingsBtn').addEventListener('click', async () => {
            let tab = 'general';

            if (this.currentTab) {
                if (this.currentTab.url.includes('block.html')) {
                    tab = 'blocking';
                } else {
                    const domain = PopupHelpers.extractDomain(this.currentTab.url);
                    const isBlocked = await this.isBlocked(domain);
                    if (isBlocked) tab = 'blocking';
                    else if (this.currentTabHasVideo) tab = 'video';
                }
            }

            const optionsUrl = chrome.runtime.getURL(`options/options.html?tab=${tab}`);
            chrome.tabs.create({ url: optionsUrl });
        });

        const decSpeedBtn = document.getElementById('decreaseSpeedBtn');
        if (decSpeedBtn) decSpeedBtn.addEventListener('click', () => this.changeSpeed(-1));

        const incSpeedBtn = document.getElementById('increaseSpeedBtn');
        if (incSpeedBtn) incSpeedBtn.addEventListener('click', () => this.changeSpeed(1));

        document.getElementById('blockBtn').addEventListener('click', () => this.toggleCurrentSiteBlock());
        document.getElementById('speedBtn').addEventListener('click', () => this.showSpeedControl());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());
        document.getElementById('toggleTracking').addEventListener('click', () => this.toggleTracking());
        document.getElementById('openDashboard').addEventListener('click', () => this.openDashboard());
        document.getElementById('completeSetup').addEventListener('click', () => this.completeSetup());

        document.getElementById('sitesList').addEventListener('click', (e) => {
            const button = e.target.closest('.site-item-btn');
            if (button) this.toggleSiteBlock(button.dataset.domain);
        });

        document.addEventListener('keydown', (event) => {
            if (this.settings && this.settings.firstTimeSetup) return;

            const activeElement = document.activeElement;
            const isInput = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable
            );
            if (isInput) return;

            const getKeyAliases = (baseKey) => {
                const map = {
                    Plus: ['Equal', 'NumpadAdd', 'Plus'],
                    Minus: ['Minus', 'NumpadSubtract'],
                    Period: ['Period', 'NumpadDecimal', 'NumpadComma'],
                    Enter: ['Enter', 'NumpadEnter']
                };
                return [baseKey, ...(map[baseKey] || [])];
            };

            const increaseKeys = getKeyAliases((this.settings && this.settings.increaseSpeedKey) || 'Plus');
            const decreaseKeys = getKeyAliases((this.settings && this.settings.decreaseSpeedKey) || 'Minus');
            const resetKeys = getKeyAliases((this.settings && this.settings.resetSpeedKey) || 'Period');

            if (!event.ctrlKey && !event.altKey && !event.metaKey) {
                if (increaseKeys.includes(event.code)) {
                    event.preventDefault();
                    this.changeSpeed(1);
                } else if (decreaseKeys.includes(event.code)) {
                    event.preventDefault();
                    this.changeSpeed(-1);
                } else if (resetKeys.includes(event.code)) {
                    event.preventDefault();
                    this.resetSpeed();
                }
            }
        });
    }
};
