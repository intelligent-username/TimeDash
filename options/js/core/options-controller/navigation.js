export function applyOptionsNavigationMethods(OptionsController) {
    OptionsController.prototype.setupNavigation = function setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach((button) => {
            button.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const tab = target.dataset.tab;

                navItems.forEach((item) => item.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.remove('active'));

                target.classList.add('active');
                const pane = document.getElementById(tab);

                if (pane) {
                    pane.classList.add('active');
                    pane.classList.remove('fade-in');
                    void pane.offsetWidth;
                    pane.classList.add('fade-in');
                }

                this.updateHeader(tab);
                this.updateTabInUrl(tab);

                if (tab === 'analytics' && this.analyticsUI) {
                    this.analyticsUI.update();
                }

                if (this.currentlyPlayingUI) {
                    this.currentlyPlayingUI.setActive(tab === 'video');
                }
            });
        });

        this.activateInitialTab();
        this.setupQuickLinks();
        this.setupLogoNavigation();
        this.setupHashNavigation();
    };

    OptionsController.prototype.updateTabInUrl = function updateTabInUrl(tab) {
        const url = new URL(window.location);
        url.searchParams.set('tab', tab);
        url.hash = '';
        history.replaceState(null, '', url);
    };

    OptionsController.prototype.activateInitialTab = function activateInitialTab() {
        const hash = window.location.hash.substring(1);
        const urlParams = new URLSearchParams(window.location.search);
        const initialTab = hash || urlParams.get('tab');
        const fallback = document.querySelector('.nav-item');

        const targetButton = initialTab
            ? document.querySelector(`.nav-item[data-tab="${initialTab}"]`)
            : fallback;

        if (targetButton) {
            targetButton.click();
            return;
        }

        if (fallback) {
            fallback.click();
            this.updateHeader(fallback.dataset.tab);
        }
    };

    OptionsController.prototype.setupQuickLinks = function setupQuickLinks() {
        document.querySelectorAll('.quick-link[data-tab]').forEach((link) => {
            link.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                const navBtn = document.querySelector(`.nav-item[data-tab="${tab}"]`);
                if (navBtn) navBtn.click();
            });
        });
    };

    OptionsController.prototype.setupLogoNavigation = function setupLogoNavigation() {
        const logoBtn = document.getElementById('sidebarLogoBtn');
        if (!logoBtn) return;

        logoBtn.addEventListener('click', () => {
            const generalBtn = document.querySelector('.nav-item[data-tab="general"]');
            if (generalBtn) generalBtn.click();
        });
    };

    OptionsController.prototype.setupHashNavigation = function setupHashNavigation() {
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.substring(1);
            if (!hash) return;

            const btn = document.querySelector(`.nav-item[data-tab="${hash}"]`);
            if (btn) btn.click();
        });
    };

    OptionsController.prototype.updateHeader = function updateHeader(tab) {
        const titleEl = document.getElementById('pageTitle');
        const subtitleEl = document.getElementById('pageSubtitle');
        if (!titleEl || !subtitleEl) return;

        const titles = {
            analytics: 'Analytics',
            general: 'General Settings',
            video: 'Video Control',
            blocking: 'Site Blocking',
            privacy: 'Privacy & Data',
            help: 'Help ',
        };

        const subtitles = {
            general: 'Appearance and notifications',
            analytics: 'Usage overview',
            video: 'Customize speed controls',
            blocking: 'Manage blocked and restricted sites',
            privacy: 'Control your data and privacy settings',
            help: 'FAQ and support',
            undefined: 'Settings',
        };

        titleEl.textContent = titles[tab] || 'Settings';
        subtitleEl.textContent = subtitles[tab] || '';
    };
}
