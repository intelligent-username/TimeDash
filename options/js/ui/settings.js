import { generalSettingsMethods } from './settings/general-settings.js';
import { videoSettingsMethods } from './settings/video-settings.js';
import { privacySettingsMethods } from './settings/privacy-settings.js';
import { sharedSettingsMethods } from './settings/shared-settings.js';

export class SettingsManager {
    constructor(controller) {
        this.controller = controller;
    }

    setup() {
        this.setupGeneral();
        this.setupVideo();
        this.setupPrivacy();
        this.setupAnalytics();
    }
}

Object.assign(
    SettingsManager.prototype,
    generalSettingsMethods,
    videoSettingsMethods,
    privacySettingsMethods,
    sharedSettingsMethods
);
