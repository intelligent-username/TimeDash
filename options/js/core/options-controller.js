import { SettingsManager } from '../ui/settings.js';
import { DataManager } from '../ui/data.js';
import { BlockingUI } from '../ui/blocking-ui.js';
import { AnalyticsUI } from '../ui/analytics/analytics-ui.js';
import { SiteSpeedList } from '../ui/video/site-speed-list.js';
import { CurrentlyPlayingUI } from '../ui/video/currently-playing.js';
import { showToast } from '../utils/dom.js';
import { applyOptionsAppearanceMethods } from './options-controller/appearance.js';
import { applyOptionsNavigationMethods } from './options-controller/navigation.js';
import { applyOptionsSyncMethods } from './options-controller/sync.js';
import { applyOptionsSaveMethods } from './options-controller/save.js';

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

        this.ready = this.init();
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
        this.setupExternalSettingsSync();

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
        this.restrictedDomains = (rules && rules.restricted) ? rules.restricted.map((rule) => rule.domain) : [];
    }

    refreshUI() {
        this.settingsManager.populateAll(this.settings);
        this.applyImmediateChanges('theme', this.settings.theme || 'light');
        this.applyImmediateChanges('accentColor', this.settings.accentColor || 'blue');

        const versionEl = document.querySelector('.version-text');
        if (versionEl) {
            versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
        }

        this.blockingUI.loadSiteRules();
        this.analyticsUI.update();
        this.updateSaveButton();
    }

    updateSetting(key, value) {
        if (key === 'theme' || key === 'accentColor') {
            this.applyImmediateChanges(key, value);
        }

        if (this.settings[key] === value) return;

        this.settings[key] = value;
        this.isDirty = true;
        this.updateSaveButton();

        if (key !== 'theme' && key !== 'accentColor') {
            this.applyImmediateChanges(key, value);
        }

        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            if (this.isDirty) this.saveSettings(true);
        }, 1000);
    }

    showToast(message, type) {
        showToast(message, type);
    }
}

applyOptionsAppearanceMethods(OptionsController);
applyOptionsNavigationMethods(OptionsController);
applyOptionsSyncMethods(OptionsController);
applyOptionsSaveMethods(OptionsController);
