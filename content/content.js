'use strict';

/**
 * Content script for TimeDash extension
 * Handles video detection, speed control, and page visibility tracking
 * Delegates UI to TimeDashOverlayUI (loaded from overlay.js)
 */
class TimeDashContent {
    constructor() {
        this.videos = new Set();
        this.currentSpeed = null;  // Don't assume default until loaded
        this.domain = this.extractDomain(window.location.href);
        this.mutationObserver = null;
        this.visibilityCheckInterval = null;
        this.settings = {};
        this.initialized = false;
        this.contextValid = true;
        this._settingSpeed = false; // Guard flag to prevent ratechange loops

        // Initialize UI component (loaded via manifest before this script)
        this.ui = window.TimeDashOverlayUI ? new window.TimeDashOverlayUI({
            onSpeedChange: (speed, video) => {
                this.setSpeed(speed);
                // If specific video triggered it, maybe focus it or just update all
            }
        }) : null;

        this.init();
    }

    /**
     * Initialize content script
     */
    async init() {
        try {
            await this.loadSettings();
            this.initialized = true;

            this.setupVideoDetection();
            this.setupMessageListeners();
            this.setupStorageListener();
            this.setupKeyboardShortcuts();
            this.startVisibilityCheck();
            this.setupFullscreenListener();
            this.setupVisibilityListener();

            console.log(`TimeDash initialized: speed=${this.currentSpeed}x`);

            // Initial UI sync if speeds are set
            if (this.currentSpeed !== 1.0) {
                this.updateAllVideoSpeeds();
            }
        } catch (error) {
            console.error('Error initializing TimeDash content script:', error);
            this.currentSpeed = this.settings?.defaultPlaybackSpeed || 1.0;
            this.initialized = true;
        }
    }

    /**
     * Load settings from storage
     */
    async loadSettings() {
        if (!chrome.runtime?.id) {
            this.contextValid = false;
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            this.settings = response || {};
            this.currentSpeed = this.settings.currentPlaybackSpeed || this.settings.defaultPlaybackSpeed || 1.0;

            // Pass settings to UI if needed (e.g. for theme or preferences)
            if (this.ui) this.ui.updateSettings(this.settings);
        } catch (error) {
            if (error.message?.includes('Extension context invalidated')) {
                this.contextValid = false;
                return;
            }
            console.error('Error loading settings:', error);
            // Fallbacks
            this.settings = {
                currentPlaybackSpeed: 1.0,
                defaultPlaybackSpeed: 1.0,
                maxPlaybackSpeed: 16.0,
                speedStep: 0.25,
                increaseSpeedKey: 'Plus',
                decreaseSpeedKey: 'Minus'
            };
            this.currentSpeed = this.settings.defaultPlaybackSpeed || 1.0;
        }
    }

    /**
     * Set up video detection using MutationObserver
     */
    setupVideoDetection() {
        this.findAndSetupVideos();

        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'VIDEO') {
                            this.setupVideo(node);
                        } else if (node.querySelectorAll) {
                            const videos = node.querySelectorAll('video');
                            videos.forEach((video) => this.setupVideo(video));
                        }
                    }
                });
            });
        });

        if (document.body) {
            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: true,
            });
        }
    }

    findAndSetupVideos() {
        const videos = document.querySelectorAll('video');
        videos.forEach((video) => this.setupVideo(video));
    }

    /**
     * Set up individual video element
     */
    setupVideo(video) {
        if (this.videos.has(video)) return;
        this.videos.add(video);

        // Apply speed when ready
        const setupSpeed = () => {
            if (this.currentSpeed !== null && this.initialized) {
                this._settingSpeed = true;
                video.playbackRate = this.currentSpeed;
                this._settingSpeed = false;
                if (this.ui && this.settings.showSpeedOverlay) {
                    this.ui.showIndicator(video, this.currentSpeed);
                }
            }
        };

        if (video.readyState >= 1 && this.initialized) {
            setupSpeed();
        } else {
            video.addEventListener('loadedmetadata', setupSpeed, { once: true });
        }

        // Listen for internal rate changes (e.g. YouTube controls)
        video.addEventListener('ratechange', () => {
            // Skip events we triggered ourselves
            if (this._settingSpeed) return;

            const externalSpeed = video.playbackRate;
            if (Math.abs(externalSpeed - this.currentSpeed) > 0.05) {
                // Site tried to change the speed - fight back by re-applying our speed
                // This prevents site-initiated resets from being saved to storage
                this._settingSpeed = true;
                video.playbackRate = this.currentSpeed;
                this._settingSpeed = false;
            }
        });



        // Cleanup on removal
        const cleanupObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === video || (node.contains && node.contains(video))) {
                        this.videos.delete(video);
                        cleanupObserver.disconnect();
                    }
                });
            });
        });

        if (video.parentNode) {
            cleanupObserver.observe(video.parentNode, { childList: true, subtree: true });
        }
    }

    /**
     * Update speed for all videos
     */
    updateAllVideoSpeeds() {
        this._settingSpeed = true;
        this.videos.forEach((video) => {
            if (video) {
                video.playbackRate = this.currentSpeed;
                if (this.ui && this.settings.showSpeedOverlay) {
                    this.ui.showIndicator(video, this.currentSpeed);
                }
            }
        });
        this._settingSpeed = false;
    }

    increaseSpeed() {
        const step = parseFloat(this.settings.speedStep) || 0.25;
        const maxSpeed = parseFloat(this.settings.maxPlaybackSpeed) || 16.0;
        let newSpeed = this.currentSpeed + step;
        newSpeed = Math.round(newSpeed * 100) / 100;

        if (newSpeed <= maxSpeed) this.setSpeed(newSpeed);
        else this.setSpeed(maxSpeed);
    }

    decreaseSpeed() {
        const step = parseFloat(this.settings.speedStep) || 0.25;
        let newSpeed = this.currentSpeed - step;
        newSpeed = Math.round(newSpeed * 100) / 100;

        if (newSpeed >= 0.25) this.setSpeed(newSpeed);
        else this.setSpeed(0.25);
    }

    resetSpeed() {
        const defaultSpeed = parseFloat(this.settings.defaultPlaybackSpeed) || 1.0;
        this.setSpeed(defaultSpeed);
    }

    setSpeed(speed) {
        const maxSpeed = this.settings.maxPlaybackSpeed || 16.0;
        const clampedSpeed = Math.max(0.25, Math.min(maxSpeed, speed));

        // Round to 2 decimals
        this.currentSpeed = Math.round(clampedSpeed * 100) / 100;

        this.updateAllVideoSpeeds();
        this.saveCurrentSpeed();
    }

    async saveCurrentSpeed() {
        if (this.isOrphaned) return;

        // Final sanity check before network request
        if (!chrome.runtime?.id) {
            this.handleOrphanedState();
            return;
        }

        try {
            await chrome.runtime.sendMessage({
                type: 'UPDATE_VIDEO_SPEED',
                speed: this.currentSpeed
            });
        } catch (error) {
            if (error.message?.includes('Extension context invalidated')) {
                this.handleOrphanedState();
                return; // Stop here, script is now dead
            }
            console.error('Error saving speed:', error);
        }
    }

    /**
     * Handle the state where the extension has been reloaded/updated
     * and this content script is now "orphaned" (disconnected from backend).
     */
    handleOrphanedState() {
        if (this.isOrphaned) return;

        console.log('TimeDash: Extension context invalidated. Cleaning up orphaned script.');
        this.isOrphaned = true;
        this.contextValid = false;

        // 1. Disconnect observers to stop detecting new videos
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }

        // 2. Stop visibility polling
        if (this.visibilityCheckInterval) {
            clearInterval(this.visibilityCheckInterval);
            this.visibilityCheckInterval = null;
        }

        // 3. Clear video set references (helps GC)
        this.videos.clear();

        // 4. (Optional) Remove UI elements if desired, or leave them static
        // if (this.ui) this.ui.remove(); 
    }

    /**
     * Keyboard Shortcuts
     */
    setupKeyboardShortcuts() {
        const getAliases = (code) => {
            const map = {
                'Plus': ['Equal', 'NumpadAdd'],
                'Minus': ['Minus', 'NumpadSubtract'],
                'Enter': ['Enter', 'NumpadEnter'],
                'Period': ['Period', 'NumpadDecimal', 'NumpadComma'],
                'Asterisk': ['NumpadMultiply'],
                'Slash': ['Slash', 'NumpadDivide'],

                'Equal': ['Plus', 'NumpadAdd']
            };
            for (let i = 0; i <= 9; i++) {
                map['' + i] = [`Digit${i}`, `Numpad${i}`];
            }
            return [code, ...(map[code] || [])];
        };

        document.addEventListener('keydown', (event) => {
            if (this.isOrphaned) return; // Stop handling if orphaned
            if (this.isInputFocused()) return;

            if (!this.settings.keyboardShortcutsEnabled) return;

            const increaseKey = this.settings.increaseSpeedKey || 'Plus';
            const decreaseKey = this.settings.decreaseSpeedKey || 'Minus';
            const resetKey = this.settings.resetSpeedKey || 'Period';

            const increaseKeys = getAliases(increaseKey);
            const decreaseKeys = getAliases(decreaseKey);
            const resetKeys = getAliases(resetKey);

            if (!event.ctrlKey && !event.altKey && !event.metaKey) {
                if (increaseKeys.includes(event.code)) {
                    event.preventDefault();
                    this.increaseSpeed();
                } else if (decreaseKeys.includes(event.code)) {
                    event.preventDefault();
                    this.decreaseSpeed();
                } else if (resetKeys.includes(event.code)) {
                    event.preventDefault();
                    this.resetSpeed();
                }
            }
        });
    }

    isInputFocused() {
        const activeElement = document.activeElement;
        const inputTypes = ['input', 'textarea', 'select'];
        return (
            activeElement && (
                inputTypes.includes(activeElement.tagName.toLowerCase()) ||
                activeElement.isContentEditable
            )
        );
    }

    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (this.isOrphaned) return false;

            switch (message.type) {
                case 'CHECK_VISIBILITY':
                    sendResponse({ visible: !document.hidden });
                    break;
                case 'increase-speed':
                    this.increaseSpeed();
                    sendResponse({ success: true });
                    break;
                case 'decrease-speed':
                    this.decreaseSpeed();
                    sendResponse({ success: true });
                    break;
                case 'SET_SPEED':
                    this.setSpeed(message.speed);
                    sendResponse({ success: true });
                    break;
                case 'GET_CURRENT_SPEED':
                    sendResponse({ speed: this.currentSpeed });
                    break;
                case 'TOGGLE_OVERLAY':
                    if (this.ui) this.ui.toggleModal();
                    sendResponse({ success: true });
                    break;
            }
            return true;
        });
    }

    setupStorageListener() {
        // We can't easily remove this listener, but it won't fire if context is invalid
        try {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (this.isOrphaned) return;

                if (area === 'local' && changes.settings) {
                    const newSettings = changes.settings.newValue || {};
                    const oldSettings = changes.settings.oldValue || {};
                    this.settings = newSettings;
                    if (this.ui) this.ui.updateSettings(this.settings);

                    // If speed changed in storage, apply it to all videos
                    if (newSettings.currentPlaybackSpeed !== undefined &&
                        newSettings.currentPlaybackSpeed !== oldSettings.currentPlaybackSpeed) {
                        this.currentSpeed = newSettings.currentPlaybackSpeed;
                        this.updateAllVideoSpeeds();
                    }
                }
            });
        } catch (e) { /* Ignore setup error */ }
    }

    startVisibilityCheck() {
        this.visibilityCheckInterval = setInterval(() => {
            if (this.isOrphaned) {
                clearInterval(this.visibilityCheckInterval);
                return;
            }
            // Keep alive check or visibility reporting
        }, 1000);
    }

    setupFullscreenListener() {
        document.addEventListener('fullscreenchange', () => {
            // Sites often reset playback speed during fullscreen transitions
            // Re-apply our speed after a short delay
            setTimeout(() => {
                if (!this.isOrphaned) {
                    this.updateAllVideoSpeeds();
                }
            }, 100);
        });
    }

    setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            // Re-apply speed when tab becomes visible again
            if (!document.hidden && !this.isOrphaned) {
                setTimeout(() => this.updateAllVideoSpeeds(), 100);
            }
        });
    }


    extractDomain(url) {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch (error) {
            return window.location.hostname.replace(/^www\./, '');
        }
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new TimeDashContent());
} else {
    new TimeDashContent();
}
