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

            console.log(`TimeDash initialized: speed=${this.currentSpeed}x`);

            // Initial UI sync if speeds are set
            if (this.currentSpeed !== 1.0) {
                this.updateAllVideoSpeeds();
            }
        } catch (error) {
            console.error('Error initializing TimeDash content script:', error);
            this.currentSpeed = 1.0;
            this.initialized = true;
        }
    }

    /**
     * Load settings from storage
     */
    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            this.settings = response || {};
            this.currentSpeed = this.settings.currentPlaybackSpeed || 1.0;

            // Pass settings to UI if needed (e.g. for theme or preferences)
            if (this.ui) this.ui.updateSettings(this.settings);
        } catch (error) {
            console.error('Error loading settings:', error);
            // Fallbacks
            this.settings = {
                currentPlaybackSpeed: 1.0,
                maxPlaybackSpeed: 16.0,
                speedStep: 0.25,
                increaseSpeedKey: 'Plus',
                decreaseSpeedKey: 'Minus'
            };
            this.currentSpeed = 1.0;
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
                video.playbackRate = this.currentSpeed;
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
            if (Math.abs(video.playbackRate - this.currentSpeed) > 0.05) {
                this.currentSpeed = video.playbackRate;
                this.saveCurrentSpeed();
                this.updateAllVideoSpeeds(); // Sync other videos
                if (this.ui) this.ui.showToast(`Speed: ${this.currentSpeed}x`);
            }
        });

        // Double click to open Modal Overlay
        video.addEventListener('dblclick', (e) => {
            // Respect setting if exists, or default to enabled
            if (this.settings.disableOverlayTrigger) return;

            // Optional: prevent default if it conflicts, but many users like fullscreen on dblclick.
            // Perhaps we only trigger if modifier key is held? 
            // Or only if NOT fullscreen?
            // For now, let's trigger it.
            if (this.ui) this.ui.showModal(video);
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
        this.videos.forEach((video) => {
            if (video) {
                video.playbackRate = this.currentSpeed;
                if (this.ui && this.settings.showSpeedOverlay) {
                    this.ui.showIndicator(video, this.currentSpeed);
                }
            }
        });
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
        this.setSpeed(1.0);
    }

    setSpeed(speed) {
        const maxSpeed = this.settings.maxPlaybackSpeed || 16.0;
        const clampedSpeed = Math.max(0.25, Math.min(maxSpeed, speed));

        // Round to 2 decimals
        this.currentSpeed = Math.round(clampedSpeed * 100) / 100;

        this.updateAllVideoSpeeds();
        this.saveCurrentSpeed();

        if (this.ui) this.ui.showToast(`Speed: ${this.currentSpeed}x`);
    }

    async saveCurrentSpeed() {
        if (!this.contextValid) return;
        try {
            await chrome.runtime.sendMessage({
                type: 'UPDATE_VIDEO_SPEED',
                speed: this.currentSpeed
            });
        } catch (error) {
            if (error.message?.includes('Extension context invalidated')) {
                this.contextValid = false;
            }
            console.error('Error saving speed:', error);
        }
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
            if (this.isInputFocused()) return;

            // Toggle Overlay: Ctrl+Shift+S (Global shortcut)
            if (event.ctrlKey && event.shiftKey && event.code === 'KeyS') {
                event.preventDefault();
                if (this.ui) this.ui.toggleModal();
                return;
            }

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
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.settings) {
                this.settings = changes.settings.newValue || {};
                if (this.ui) this.ui.updateSettings(this.settings);

                // If max speed changed, might need to clamp current speed?
                // If speed step changed, will apply next time.
            }
        });
    }

    startVisibilityCheck() {
        this.visibilityCheckInterval = setInterval(() => {
            // Keep alive check or visibility reporting
        }, 1000);
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
