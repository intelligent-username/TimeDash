import './popup-helpers.js';
import { TimeDashPopup } from './js/popup/time-dash-popup.js';

document.addEventListener('DOMContentLoaded', () => {
    new TimeDashPopup();
});

window.addEventListener('beforeunload', () => {
    if (window.timeDashPopup) {
        window.timeDashPopup.cleanup();
    }
});
