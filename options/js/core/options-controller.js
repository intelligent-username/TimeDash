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
        // Deep compare or simple check
        if (this.settings[key] === value) return;
        this.settings[key] = value;
        this.isDirty = true;
        this.updateSaveButton();
        this.applyImmediateChanges(key, value);
    }

    applyImmediateChanges(key, value) {
        if (key === 'theme') {
            document.documentElement.setAttribute('data-theme', value);
        }
    }

    setupNavigation() {
        document.querySelectorAll('.tab-btn').forEach((button) => {
            button.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

                e.target.classList.add('active');
                const pane = document.getElementById(tab);
                if (pane) pane.classList.add('active');

                if (tab === 'analytics') this.analyticsUI.update();
            });
        });

        const hash = window.location.hash.substring(1);
        if (hash) {
            const btn = document.querySelector(`[data-tab="${hash}"]`);
            if (btn) btn.click();
        }

        window.addEventListener('hashchange', () => {
            const h = window.location.hash.substring(1);
            if (h) {
                const btn = document.querySelector(`[data-tab="${h}"]`);
                if (btn) btn.click();
            }
        });
    }

    setupAutoSave() {
        setInterval(() => {
            if (this.isDirty) this.saveSettings(true);
        }, 5000);

        window.addEventListener('beforeunload', () => {
            if (this.isDirty) this.saveSettings(true);
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
