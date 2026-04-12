'use strict';

class TimeDashContent {
    constructor() {
        this.videos = new Set();
        this.currentSpeed = null;
        this.domain = this.extractDomain(window.location.href);
        this.settings = {};
        this.initialized = false;
        this.contextValid = true;
        this._settingSpeed = false;
        this.videoIdMap = new WeakMap();
        this.videoIdCounter = 1;
        this.videoInteractionTs = new WeakMap();
        this.isOrphaned = false;
        this.visibilityCheckInterval = null;

        this.ui = window.TimeDashOverlayUI ? new window.TimeDashOverlayUI({
            onSpeedChange: (speed) => this.controller.setSpeed(speed)
        }) : null;

        this.detector = new VideoDetector(this);
        this.controller = new VideoController(this);
        this.playbackState = new PlaybackState(this);
        this.messageHandler = new MessageHandlerContent(this);
        this.keyboardHandler = new KeyboardHandler(this);

        this.init();
    }

    markVideoInteraction(video) {
        if (!video) return;
        this.videoInteractionTs.set(video, Date.now());
    }

    hasRecentVideoInteraction(video, withinMs = 45000) {
        const ts = this.videoInteractionTs.get(video);
        if (!Number.isFinite(ts)) return false;
        return (Date.now() - ts) <= withinMs;
    }

    async init() {
        try {
            await this.loadSettings();
            this.initialized = true;

            this.detector.setup();
            this.messageHandler.setup();
            this.messageHandler.setupStorageListener();
            this.keyboardHandler.setup();
            this.startVisibilityCheck();
            this.setupListeners();

            if (this.currentSpeed !== 1.0) {
                this.controller.updateAllVideoSpeeds();
            }
        } catch (error) {
            console.error('Error initializing TimeDash content script:', error);
            this.currentSpeed = this.settings?.defaultPlaybackSpeed || 1.0;
            this.initialized = true;
        }
    }

    async loadSettings() {
        if (!chrome.runtime?.id) {
            this.contextValid = false;
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            this.settings = response || {};
            this.currentSpeed = this.settings.currentPlaybackSpeed
                ? this.settings.currentPlaybackSpeed
                : (this.settings.defaultPlaybackSpeed ? this.settings.defaultPlaybackSpeed : 1.0);

            if (this.ui) this.ui.updateSettings(this.settings);
        } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
                this.contextValid = false;
                return;
            }
            console.error('Error loading settings:', error);
            this.settings = {
                currentPlaybackSpeed: 1.0,
                defaultPlaybackSpeed: 1.0,
                maxPlaybackSpeed: 16.0,
                speedStep: 0.25,
            };
            this.currentSpeed = this.settings.defaultPlaybackSpeed || 1.0;
        }
    }

    setupVideo(video) {
        this.controller.setupVideo(video);
    }

    async saveCurrentSpeed() {
        if (this.isOrphaned) return;

        if (!chrome.runtime?.id) {
            this.handleOrphanedState();
            return;
        }

        try {
            await chrome.runtime.sendMessage({ type: 'UPDATE_VIDEO_SPEED', speed: this.currentSpeed });
        } catch (error) {
            if (error.message?.includes('Extension context invalidated')) {
                this.handleOrphanedState();
                return;
            }
            console.error('Error saving speed:', error);
        }
    }

    getControllerSkipPaceSeconds() {
        const raw = Number(this.settings && this.settings.controllerSkipPace);
        if (!Number.isFinite(raw)) return 10;
        return Math.max(1, Math.min(600, raw));
    }

    handleOrphanedState() {
        if (this.isOrphaned) return;

        this.isOrphaned = true;
        this.contextValid = false;
        this.detector.cleanup();

        if (this.visibilityCheckInterval) {
            clearInterval(this.visibilityCheckInterval);
            this.visibilityCheckInterval = null;
        }

        this.videos.clear();
    }

    startVisibilityCheck() {
        this.visibilityCheckInterval = setInterval(() => {
            if (this.isOrphaned) {
                clearInterval(this.visibilityCheckInterval);
            }
        }, 1000);
    }

    setupListeners() {
        document.addEventListener('fullscreenchange', () => {
            setTimeout(() => {
                if (!this.isOrphaned) this.controller.updateAllVideoSpeeds();
            }, 100);
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !this.isOrphaned) {
                setTimeout(() => this.controller.updateAllVideoSpeeds(), 100);
            }
        });
    }

    extractDomain(url) {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch {
            return window.location.hostname.replace(/^www\./, '');
        }
    }
}

if (!globalThis.__timedashContentBooted) {
    globalThis.__timedashContentBooted = true;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new TimeDashContent());
    } else {
        new TimeDashContent();
    }
}
