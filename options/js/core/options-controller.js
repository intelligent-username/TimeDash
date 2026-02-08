import { SettingsManager } from '../ui/settings.js';
import { DataManager } from '../ui/data.js';
import { BlockingUI } from '../ui/blocking-ui.js';
import { AnalyticsUI } from '../ui/analytics-ui.js';
import { SiteSpeedList } from '../ui/site-speed-list.js';
import { showToast } from '../utils/dom.js';

export class OptionsController {
    constructor() {
        this.storageManager = new StorageManager();
        this.settingsManager = new SettingsManager(this);
        this.dataManager = new DataManager(this);
        this.blockingUI = new BlockingUI(this);
        this.analyticsUI = new AnalyticsUI(this);
        this.siteSpeedList = new SiteSpeedList(this);

        this.settings = {};
        this.usage = {};
        this.blockList = [];
        this.restrictedDomains = [];
        this.earliestDate = null;
        this.isDirty = false;

        this.init();
    }

    async init() {
        if (typeof I18n !== 'undefined') I18n.init(document);

        await this.loadAllData();

        this.settingsManager.setup();
        this.dataManager.setup();
        this.blockingUI.setup();
        this.analyticsUI.setup();
        this.siteSpeedList.setup();

        this.setupNavigation();
        this.refreshUI();
        this.setupAutoSave();

        this.showBanner('Settings loaded', 'success');
    }

    async loadAllData() {
        const [settings, usage, blockList, rules] = await Promise.all([
            this.storageManager.getSettings(),
            this.storageManager.getAllUsage(),
            this.storageManager.getBlockList(),
            chrome.runtime.sendMessage({ type: 'GET_SITE_RULES' }).catch(() => ({}))
        ]);

        this.settings = settings;
        this.usage = usage;
        this.blockList = blockList;
        this.restrictedDomains = rules?.restricted?.map(r => r.domain) || [];
    }

    refreshUI() {
        this.settingsManager.populateAll(this.settings);
        this.blockingUI.loadSiteRules(); // Let it fetch and render its own rules
        this.analyticsUI.update();
        this.updateSaveButton();
    }

    updateSetting(key, value) {
        // Always apply theme/accent changes immediately since DOM might be out of sync
        if (key === 'theme' || key === 'accentColor') {
            this.applyImmediateChanges(key, value);
        }

        // Deep compare or simple check
        if (this.settings[key] === value) return;
        this.settings[key] = value;
        this.isDirty = true;
        this.updateSaveButton();

        // Apply other immediate changes
        if (key !== 'theme' && key !== 'accentColor') {
            this.applyImmediateChanges(key, value);
        }

        // Debounce save (1s) to ensure content scripts get updates quickly
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            if (this.isDirty) this.saveSettings(true);
        }, 1000);
    }

    applyImmediateChanges(key, value) {
        if (key === 'theme') {
            console.log('[TimeDash] Applying theme:', value);
            document.documentElement.setAttribute('data-theme', value);
        }
        if (key === 'accentColor') {
            console.log('[TimeDash] Applying accent:', value);
            document.documentElement.setAttribute('data-accent', value);
        }
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach((button) => {
            button.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const tab = target.dataset.tab;

                navItems.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

                target.classList.add('active');
                const pane = document.getElementById(tab);
                if (pane) {
                    pane.classList.add('active');
                    // Add fade-in animation re-trigger
                    pane.classList.remove('fade-in');
                    void pane.offsetWidth; // trigger reflow
                    pane.classList.add('fade-in');
                }

                this.updateHeader(tab);

                if (tab === 'analytics' && this.analyticsUI) {
                    this.analyticsUI.update();
                }
            });
        });

        const hash = window.location.hash.substring(1);
        if (hash) {
            const btn = document.querySelector(`.nav-item[data-tab="${hash}"]`);
            if (btn) btn.click();
        } else {
            // Default to analytics or first tab
            const first = document.querySelector('.nav-item');
            if (first) {
                first.click();
                this.updateHeader(first.dataset.tab);
            }
        }

        // Quick Access Hub links
        document.querySelectorAll('.quick-link[data-tab]').forEach((link) => {
            link.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                const navBtn = document.querySelector(`.nav-item[data-tab="${tab}"]`);
                if (navBtn) navBtn.click();
            });
        });

        window.addEventListener('hashchange', () => {
            const h = window.location.hash.substring(1);
            if (h) {
                const btn = document.querySelector(`.nav-item[data-tab="${h}"]`);
                if (btn) btn.click();
            }
        });
    }

    updateHeader(tab) {
        const titleEl = document.getElementById('pageTitle');
        const subtitleEl = document.getElementById('pageSubtitle');
        if (!titleEl || !subtitleEl) return;

        const titles = {
            'analytics': 'Analytics',
            'general': 'General Settings',
            'video': 'Video Control',
            'blocking': 'Site Blocking',
            'privacy': 'Privacy & Data',
            'help': 'Help & About'
        };
        const subtitles = {
            'analytics': 'Overview of your productivity',
            'general': 'Manage appearance and notifications',
            'video': 'Customize playback speed controls',
            'blocking': 'Manage blocked and restricted sites',
            'privacy': 'Control your data and privacy settings',
            'help': 'Guides and feature overview',
            'undefined': 'Settings'
        };

        titleEl.textContent = titles[tab] || 'Settings';
        subtitleEl.textContent = subtitles[tab] || '';
    }

    setupAutoSave() {
        // Backup interval (keep it just in case)
        setInterval(() => {
            if (this.isDirty) this.saveSettings(true);
        }, 5000);

        window.addEventListener('beforeunload', () => {
            if (this.isDirty) this.saveSettings(true);
        });

        // Save immediately when switching tabs (e.g. to test usage)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isDirty) {
                this.saveSettings(true);
            }
        });
    }

    async saveSettings(silent = false) {
        try {
            await this.storageManager.saveSettings(this.settings);
            this.isDirty = false;
            this.updateSaveButton();
            if (!silent) this.showSuccess('Settings saved');
            chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: this.settings });
        } catch (e) {
            console.error(e);
            this.showError('Failed to save settings');
        }
    }

    updateSaveButton() {
        const status = document.getElementById('saveStatus');
        if (status) {
            const msg = status.querySelector('.save-message');
            if (this.isDirty) {
                status.style.opacity = '1';
                if (msg) msg.textContent = 'Unsaved changes...';
            } else {
                status.style.opacity = '0.7';
                if (msg) msg.textContent = 'Settings saved automatically';
            }
        }
    }

    showSuccess(msg) { showToast(msg, 'success'); }
    showError(msg) { showToast(msg, 'error'); }
    showWarning(msg) { showToast(msg, 'warning'); }

    updateRestrictedDomains(domains) {
        this.restrictedDomains = domains;
    }

    showBanner(message, type = 'info') {
        const el = document.getElementById('banner');
        if (!el) return;
        el.className = `banner ${type}`;
        el.textContent = message;
        el.style.display = 'block';
        if (type !== 'error') {
            setTimeout(() => { if (el) el.style.display = 'none'; }, 2500);
        }
    }
}
