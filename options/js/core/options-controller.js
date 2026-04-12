import { SettingsManager } from '../ui/settings.js';
import { DataManager } from '../ui/data.js';
import { BlockingUI } from '../ui/blocking-ui.js';
import { AnalyticsUI } from '../ui/analytics-ui.js';
import { SiteSpeedList } from '../ui/site-speed-list.js';
import { CurrentlyPlayingUI } from '../ui/currently-playing.js';
import { showToast } from '../utils/dom.js';

export class OptionsController {
    constructor() {
        this.storageManager = new StorageManager();
        this.settingsManager = new SettingsManager(this);
        this.dataManager = new DataManager(this);
        this.blockingUI = new BlockingUI(this);
        this.analyticsUI = new AnalyticsUI(this);
        this.siteSpeedList = new SiteSpeedList(this);
        this.currentlyPlayingUI = new CurrentlyPlayingUI(this);

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
        this.currentlyPlayingUI.setup();

        this.setupNavigation();
        this.refreshUI();
        this.setupAutoSave();
        this.setupHelpLinks();

        this.showBanner('Settings loaded', 'success');
    }

    setupHelpLinks() {
        const privacyLink = document.getElementById('privacyPolicyLink');
        if (privacyLink) {
            privacyLink.addEventListener('click', (e) => {
                e.preventDefault();
                const privacyTab = document.querySelector('[data-tab=privacy]');
                if (privacyTab) privacyTab.click();
            });
        }
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
        this.restrictedDomains = (rules && rules.restricted) ? rules.restricted.map(r => r.domain) : [];
    }

    refreshUI() {
        this.settingsManager.populateAll(this.settings);
        
        // Update version text from manifest
        const versionEl = document.querySelector('.version-text');
        if (versionEl) {
            versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
        }
        
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

                // Update URL so refreshing returns to this tab
                const url = new URL(window.location);
                url.searchParams.set('tab', tab);
                url.hash = '';
                history.replaceState(null, '', url);

                if (tab === 'analytics' && this.analyticsUI) {
                    this.analyticsUI.update();
                }

                if (this.currentlyPlayingUI) {
                    this.currentlyPlayingUI.setActive(tab === 'video');
                }
            });
        });

        // Determine initial tab: hash takes priority, then ?tab= query param
        const hash = window.location.hash.substring(1);
        const urlParams = new URLSearchParams(window.location.search);
        const initialTab = hash || urlParams.get('tab');

        if (initialTab) {
            const btn = document.querySelector(`.nav-item[data-tab="${initialTab}"]`);
            if (btn) {
                btn.click();
            } else {
                const first = document.querySelector('.nav-item');
                if (first) {
                    first.click();
                    this.updateHeader(first.dataset.tab);
                }
            }
        } else {
            // Default to first tab
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

        // Logo click -> General tab
        const logoBtn = document.getElementById('sidebarLogoBtn');
        if (logoBtn) {
            logoBtn.addEventListener('click', () => {
                const generalBtn = document.querySelector(`.nav-item[data-tab="general"]`);
                if (generalBtn) generalBtn.click();
            });
        }

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
            'help': 'Help '
        };
        const subtitles = {
            'general': 'Appearance and notifications',
            'analytics': 'Usage overview',
            'video': 'Customize speed controls',
            'blocking': 'Manage blocked and restricted sites',
            'privacy': 'Control your data and privacy settings',
            'help': 'FAQ and support',
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
            this.updateSaveStatus('Saving changes...', true);
            await this.storageManager.saveSettings(this.settings);
            this.isDirty = false;
            
            // Show "Saved" for a second then disappear
            this.updateSaveStatus('Saved', true);
            setTimeout(() => {
                this.updateSaveStatus('', false);
            }, 1000);

            if (!silent) this.showSuccess('Settings saved');
            chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: this.settings });
        } catch (e) {
            console.error(e);
            this.updateSaveStatus('Error saving', true);
            this.showError('Failed to save settings');
        }
    }

    updateSaveStatus(message, visible = true) {
        const status = document.getElementById('saveStatus');
        if (status) {
            const msg = status.querySelector('.save-message');
            if (message && msg) msg.textContent = message;
            status.style.opacity = visible ? '1' : '0';
            status.style.pointerEvents = visible ? 'auto' : 'none';
        }
    }

    updateSaveButton() {
        // Obsolete but kept to avoid errors from other calls
        this.updateSaveStatus('', false);
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
