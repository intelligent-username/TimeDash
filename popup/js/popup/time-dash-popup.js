import { lifecycleMethods } from './lifecycle.js';
import { eventMethods } from './events.js';
import { uiMethods } from './ui.js';
import { actionMethods } from './actions.js';

export class TimeDashPopup {
    constructor() {
        this.currentTab = null;
        this.usageData = null;
        this.settings = null;
        this.updateInterval = null;
        this.autoUpdateInterval = null;
        this.boundKeyHandler = null;
        this.currentTabHasVideo = false;

        window.timeDashPopup = this;
        this.init();
    }
}

Object.assign(
    TimeDashPopup.prototype,
    lifecycleMethods,
    eventMethods,
    uiMethods,
    actionMethods
);
