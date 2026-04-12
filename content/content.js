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
        this.rootObservers = new Set();
        this._deepScanTimer = null;
        this.visibilityCheckInterval = null;
        this.settings = {};
        this.initialized = false;
        this.contextValid = true;
        this._settingSpeed = false; // Guard flag to prevent ratechange loops
        this.videoIdMap = new WeakMap();
        this.videoIdCounter = 1;
        this.videoInteractionTs = new WeakMap();

        // Initialize UI component (loaded via manifest before this script)
        this.ui = window.TimeDashOverlayUI ? new window.TimeDashOverlayUI({
            onSpeedChange: (speed, video) => {
                this.setSpeed(speed);
                // If specific video triggered it, maybe focus it or just update all
            }
        }) : null;

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
            this.currentSpeed = (this.settings.currentPlaybackSpeed) ? this.settings.currentPlaybackSpeed : (this.settings.defaultPlaybackSpeed ? this.settings.defaultPlaybackSpeed : 1.0);

            // Pass settings to UI if needed (e.g. for theme or preferences)
            if (this.ui) this.ui.updateSettings(this.settings);
        } catch (error) {
            if (error.message && error.message.indexOf('Extension context invalidated') !== -1) {
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
        this.setupShadowDomHook();
        this.findAndSetupVideos(document);
        this.scanOpenShadowRoots(document);

        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => this.scanNodeForVideos(node));
            });
        });

        const root = document.documentElement || document.body;
        if (root) {
            this.mutationObserver.observe(root, {
                childList: true,
                subtree: true,
            });
        }

        this._deepScanTimer = setInterval(() => {
            if (this.isOrphaned) return;
            this.findAndSetupVideos(document);
            this.scanOpenShadowRoots(document);
        }, 2000);
    }

    findAndSetupVideos(root = document) {
        if (!root || !root.querySelectorAll) return;
        const videos = root.querySelectorAll('video');
        videos.forEach((video) => this.setupVideo(video));
    }

    scanNodeForVideos(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

        if (node.tagName === 'VIDEO') {
            this.setupVideo(node);
        }

        if (node.querySelectorAll) {
            const videos = node.querySelectorAll('video');
            videos.forEach((video) => this.setupVideo(video));
        }

        if (node.shadowRoot) {
            this.findAndSetupVideos(node.shadowRoot);
            this.observeRoot(node.shadowRoot);
            this.scanOpenShadowRoots(node.shadowRoot);
        }
    }

    scanOpenShadowRoots(root = document) {
        if (!root || !root.querySelectorAll) return;

        const hosts = root.querySelectorAll('*');
        hosts.forEach((el) => {
            if (el.shadowRoot) {
                this.findAndSetupVideos(el.shadowRoot);
                this.observeRoot(el.shadowRoot);
            }
        });
    }

    observeRoot(root) {
        if (!root || root.__timedashObserved) return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => this.scanNodeForVideos(node));
            });
        });

        observer.observe(root, { childList: true, subtree: true });
        root.__timedashObserved = true;
        this.rootObservers.add(observer);
    }

    setupShadowDomHook() {
        if (Element.prototype.__timedashPatchedAttachShadow) return;

        const originalAttachShadow = Element.prototype.attachShadow;
        const self = this;

        Element.prototype.attachShadow = function(init) {
            const shadowRoot = originalAttachShadow.call(this, init);
            if (init && init.mode === 'open') {
                self.findAndSetupVideos(shadowRoot);
                self.observeRoot(shadowRoot);
            }
            return shadowRoot;
        };

        Element.prototype.__timedashPatchedAttachShadow = true;
    }

    /**
     * Set up individual video element
     */
    setupVideo(video) {
        if (this.videos.has(video)) return;
        this.videos.add(video);

        if (!this.videoIdMap.has(video)) {
            this.videoIdMap.set(video, `v${this.videoIdCounter++}`);
        }

        // Apply speed when ready
        const setupSpeed = () => {
            if (this.currentSpeed !== null && this.initialized) {
                this._settingSpeed = true;
                video.playbackRate = this.currentSpeed;
                this._settingSpeed = false;
                this.markVideoInteraction(video);
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

            this.markVideoInteraction(video);
            if (this.ui) {
                this.ui.showIndicator(video, this.currentSpeed);
            }

            const externalSpeed = video.playbackRate;
            if (Math.abs(externalSpeed - this.currentSpeed) > 0.05) {
                // Site tried to change the speed - fight back by re-applying our speed
                // This prevents site-initiated resets from being saved to storage
                this._settingSpeed = true;
                video.playbackRate = this.currentSpeed;
                this._settingSpeed = false;
                if (this.ui) {
                    this.ui.showIndicator(video, this.currentSpeed);
                }
            }
        });

        video.addEventListener('play', () => this.markVideoInteraction(video));
        video.addEventListener('playing', () => this.markVideoInteraction(video));
        video.addEventListener('seeking', () => this.markVideoInteraction(video));



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
        const staleVideos = [];
        this.videos.forEach((video) => {
            if (!video || !video.isConnected) {
                staleVideos.push(video);
                return;
            }
            if (video) {
                video.playbackRate = this.currentSpeed;
                this.markVideoInteraction(video);
            }
        });
        staleVideos.forEach((video) => this.videos.delete(video));
        this._settingSpeed = false;
    }

    showSpeedOverlayIndicator(force = false) {
        if (!this.ui || this.videos.size === 0) return;
        if (!force && !this.settings.showSpeedOverlay) return;

        this.findAndSetupVideos(document);
        this.scanOpenShadowRoots(document);

        const connectedVideos = [...this.videos].filter((video) => video && video.isConnected);
        if (connectedVideos.length === 0) return;

        const recentVideo = connectedVideos.find((video) => this.hasRecentVideoInteraction(video));
        const activeVideo = recentVideo || connectedVideos.find((video) => !video.paused && !video.ended) || connectedVideos[0];
        this.ui.showIndicator(activeVideo, this.currentSpeed);
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
        this.showSpeedOverlayIndicator(true);

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

        if (this.rootObservers.size > 0) {
            this.rootObservers.forEach((observer) => observer.disconnect());
            this.rootObservers.clear();
        }

        if (this._deepScanTimer) {
            clearInterval(this._deepScanTimer);
            this._deepScanTimer = null;
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

    getVideoById(videoId) {
        for (const video of this.videos) {
            if (!video || !video.isConnected) continue;
            if (this.videoIdMap.get(video) === videoId) {
                return video;
            }
        }
        return null;
    }

    hasAudioTrack(video) {
        if (!video) return false;
        if (video.muted || video.volume === 0) return false;

        if (Array.isArray(video.audioTracks) && video.audioTracks.length > 0) return true;
        if (typeof video.audioTracks === 'object' && video.audioTracks && video.audioTracks.length > 0) return true;
        if (video.mozHasAudio === true) return true;
        if (typeof video.webkitAudioDecodedByteCount === 'number' && video.webkitAudioDecodedByteCount > 0) return true;

        return !video.muted && video.volume > 0;
    }

    getVideoSourceLabel() {
        const parseLdJsonAuthor = () => {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of scripts) {
                const raw = (script.textContent || '').trim();
                if (!raw) continue;
                try {
                    const parsed = JSON.parse(raw);
                    const nodes = Array.isArray(parsed) ? parsed : [parsed];
                    for (const node of nodes) {
                        if (!node || typeof node !== 'object') continue;
                        const author = node.author;
                        if (author && typeof author === 'object' && typeof author.name === 'string' && author.name.trim()) {
                            return author.name.trim();
                        }
                    }
                } catch {
                    // Ignore malformed json-ld
                }
            }
            return '';
        };

        // Try author/channel first
        const authorCandidates = [
            'ytd-watch-metadata ytd-channel-name a',
            'ytd-video-owner-renderer ytd-channel-name a',
            '#owner-name a',
            'ytd-channel-name a',
            '#owner #channel-name a',
            '#upload-info #channel-name a',
            '#upload-info #channel-name yt-formatted-string a',
            'meta[name="author"]',
            'meta[property="article:author"]'
        ];

        const ldJsonAuthor = parseLdJsonAuthor();
        if (ldJsonAuthor) return ldJsonAuthor;

        for (const selector of authorCandidates) {
            const element = document.querySelector(selector);
            if (!element) continue;

            if (element.tagName === 'META') {
                const content = (element.getAttribute('content') || '').trim();
                if (content) return content;
            } else {
                const value = (element.textContent || '').trim();
                if (value) return value;
            }
        }

        const siteMeta = document.querySelector('meta[property="og:site_name"]');
        if (siteMeta) {
            const siteName = (siteMeta.getAttribute('content') || '').trim();
            if (siteName) return siteName;
        }

        const host = (window.location.hostname || '').replace(/^www\./, '');
        return host || 'Unknown source';
    }

    isLikelyPrimaryVideo(video) {
        if (!video) return false;

        const rect = typeof video.getBoundingClientRect === 'function'
            ? video.getBoundingClientRect()
            : { width: 0, height: 0 };

        const minWidth = 240;
        const minHeight = 135;
        if (rect.width < minWidth || rect.height < minHeight) return false;

        const style = window.getComputedStyle ? window.getComputedStyle(video) : null;
        if (style) {
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
                return false;
            }
        }

        if (video.loop && video.muted) return false;
        return true;
    }

    getControllerSkipPaceSeconds() {
        const raw = Number(this.settings && this.settings.controllerSkipPace);
        if (!Number.isFinite(raw)) return 10;
        return Math.max(1, Math.min(600, raw));
    }

    getPlaybackState() {
        // YouTube and SPA players may swap video nodes between route/state changes.
        // Refresh discovery right before snapshot so we don't depend on stale set membership.
        this.findAndSetupVideos(document);
        this.scanOpenShadowRoots(document);

        const videos = [];

        for (const video of this.videos) {
            if (!video || !video.isConnected) continue;
            const recentInteraction = this.hasRecentVideoInteraction(video);
            if (!this.isLikelyPrimaryVideo(video) && !recentInteraction) continue;
            const hasAudio = this.hasAudioTrack(video);

            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
            const isLive = !Number.isFinite(video.duration) || video.duration === Infinity;
            const hasPlaybackHistory = Boolean(video.played && video.played.length > 0);
            const activeOrLooping = Boolean(!video.paused || video.seeking || video.loop || currentTime > 0);

            if (video.ended) continue;
            if (!hasAudio && !activeOrLooping && !recentInteraction) continue;
            if (video.paused && currentTime <= 0 && !video.seeking && !video.autoplay && !recentInteraction && !hasPlaybackHistory) continue;

            videos.push({
                id: this.videoIdMap.get(video),
                currentTime,
                duration,
                paused: Boolean(video.paused),
                playbackRate: Number(video.playbackRate || 1),
                isLive,
                sourceLabel: this.getVideoSourceLabel()
            });
        }

        return videos;
    }

    async controlPlayback(action, videoId, value) {
        const video = this.getVideoById(videoId);
        if (!video) {
            return { success: false, error: 'Video not found' };
        }

        const skipSeconds = this.getControllerSkipPaceSeconds();

        try {
            switch (action) {
                case 'toggle-play':
                    if (video.paused) await video.play();
                    else video.pause();
                    break;
                case 'pause':
                    video.pause();
                    break;
                case 'play':
                    await video.play();
                    break;
                case 'skip-forward':
                case 'step-forward':
                    video.currentTime = Math.min(
                        Number.isFinite(video.duration) ? video.duration : video.currentTime + skipSeconds,
                        video.currentTime + skipSeconds
                    );
                    break;
                case 'skip-back':
                case 'step-back':
                    video.currentTime = Math.max(0, video.currentTime - skipSeconds);
                    break;
                case 'seek': {
                    const target = Number(value);
                    if (!Number.isFinite(target)) {
                        return { success: false, error: 'Invalid seek value' };
                    }
                    const maxSeek = Number.isFinite(video.duration) ? video.duration : target;
                    video.currentTime = Math.max(0, Math.min(maxSeek, target));
                    break;
                }
                default:
                    return { success: false, error: 'Unknown action' };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message || 'Playback control failed' };
        }
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
                case 'GET_VIDEO_PLAYBACK_STATE':
                    sendResponse({ videos: this.getPlaybackState() });
                    break;
                case 'FORCE_VIDEO_RESCAN':
                    this.findAndSetupVideos(document);
                    this.scanOpenShadowRoots(document);
                    sendResponse({ success: true, count: this.videos.size });
                    break;
                case 'CONTROL_VIDEO_PLAYBACK':
                    this.controlPlayback(message.action, message.videoId, message.value)
                        .then(sendResponse)
                        .catch((error) => sendResponse({ success: false, error: error.message }));
                    return true;
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
                        this.showSpeedOverlayIndicator(true);
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
if (!globalThis.__timedashContentBooted) {
    globalThis.__timedashContentBooted = true;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new TimeDashContent());
    } else {
        new TimeDashContent();
    }
}
