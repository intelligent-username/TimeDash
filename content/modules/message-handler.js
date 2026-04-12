/**
 * Message Handler - content/modules/message-handler.js
 * Sets up message listeners for communication with background/options
 * ~160 lines
 */

class MessageHandlerContent {
    constructor(instance) {
        this.instance = instance;
    }

    setup() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (this.instance.isOrphaned) return false;

            switch (message.type) {
                case 'CHECK_VISIBILITY':
                    sendResponse({ visible: !document.hidden });
                    break;
                case 'increase-speed':
                    this.instance.controller.increaseSpeed();
                    sendResponse({ success: true });
                    break;
                case 'decrease-speed':
                    this.instance.controller.decreaseSpeed();
                    sendResponse({ success: true });
                    break;
                case 'SET_SPEED':
                    this.instance.controller.setSpeed(message.speed);
                    sendResponse({ success: true });
                    break;
                case 'GET_CURRENT_SPEED':
                    sendResponse({ speed: this.instance.currentSpeed });
                    break;
                case 'TOGGLE_OVERLAY':
                    if (this.instance.ui) this.instance.ui.toggleModal();
                    sendResponse({ success: true });
                    break;
                case 'GET_VIDEO_PLAYBACK_STATE':
                    sendResponse({ videos: this.instance.playbackState.getPlaybackState() });
                    break;
                case 'FORCE_VIDEO_RESCAN':
                    this.instance.detector.findAndSetupVideos(document);
                    this.instance.detector.scanOpenShadowRoots(document);
                    sendResponse({ success: true, count: this.instance.videos.size });
                    break;
                case 'CONTROL_VIDEO_PLAYBACK':
                    this.instance.controller.controlPlayback(message.action, message.videoId, message.value)
                        .then(sendResponse)
                        .catch((error) => sendResponse({ success: false, error: error.message }));
                    return true;
            }
            return true;
        });
    }

    setupStorageListener() {
        try {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (this.instance.isOrphaned) return;

                if (area === 'local' && changes.settings) {
                    const newSettings = changes.settings.newValue || {};
                    const oldSettings = changes.settings.oldValue || {};
                    this.instance.settings = newSettings;
                    if (this.instance.ui) this.instance.ui.updateSettings(this.instance.settings);

                    if (newSettings.currentPlaybackSpeed !== undefined &&
                        newSettings.currentPlaybackSpeed !== oldSettings.currentPlaybackSpeed) {
                        this.instance.currentSpeed = newSettings.currentPlaybackSpeed;
                        this.instance.controller.updateAllVideoSpeeds();
                        this.instance.controller.showSpeedOverlayIndicator(true);
                    }
                }
            });
        } catch (e) { /* Ignore setup error */ }
    }
}
