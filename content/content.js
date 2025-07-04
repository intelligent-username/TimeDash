'use strict';

/**
 * Content script for TimeDash extension
 * Handles video detection, speed control, and page visibility tracking
 */
class TimeDashContent {
    constructor() {
        this.videos = new Set();
        this.currentSpeed = 1.0;
        this.domain = this.extractDomain(window.location.href);
        this.mutationObserver = null;
        this.visibilityCheckInterval = null;
        this.speedOverlay = null;
        this.settings = {};
        
        this.init();
    }

    /**
     * Initialize content script
     */
    async init() {
        try {
            // Load settings
            await this.loadSettings();
            
            // Set up video detection
            this.setupVideoDetection();
            
            // Set up message listeners
            this.setupMessageListeners();
            
            // Set up keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            // Start visibility checking
            this.startVisibilityCheck();
            
            console.log('TimeDash content script initialized for:', this.domain);
        } catch (error) {
            console.error('Error initializing TimeDash content script:', error);
        }
    }

    /**
     * Load settings from storage
     */
    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            this.settings = response || {};
            
            // Load domain-specific video speed
            const speedResponse = await chrome.runtime.sendMessage({
                type: 'GET_VIDEO_SPEED',
                domain: this.domain
            });
            this.currentSpeed = speedResponse?.speed || this.settings.defaultPlaybackSpeed || 1.0;
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = { defaultPlaybackSpeed: 1.0, maxPlaybackSpeed: 16.0 };
            this.currentSpeed = 1.0;
        }
    }

    /**
     * Set up video detection using MutationObserver
     */
    setupVideoDetection() {
        // Find existing videos
        this.findAndSetupVideos();
        
        // Watch for new videos
        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'VIDEO') {
                            this.setupVideo(node);
                        } else if (node.querySelectorAll) {
                            const videos = node.querySelectorAll('video');
                            videos.forEach(video => this.setupVideo(video));
                        }
                    }
                });
            });
        });
        
        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Find and set up existing videos on the page
     */
    findAndSetupVideos() {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => this.setupVideo(video));
    }

    /**
     * Set up individual video element
     * @param {HTMLVideoElement} video - Video element to set up
     */
    setupVideo(video) {
        if (this.videos.has(video)) return;
        
        this.videos.add(video);
        
        // Wait for video metadata to load
        const setupSpeed = () => {
            if (video.readyState >= 1) { // HAVE_METADATA
                video.playbackRate = this.currentSpeed;
                this.showSpeedIndicator(video);
            }
        };
        
        if (video.readyState >= 1) {
            setupSpeed();
        } else {
            video.addEventListener('loadedmetadata', setupSpeed, { once: true });
        }
        
        // Listen for manual speed changes
        video.addEventListener('ratechange', () => {
            if (Math.abs(video.playbackRate - this.currentSpeed) > 0.01) {
                this.currentSpeed = video.playbackRate;
                this.saveCurrentSpeed();
                this.updateAllVideoSpeeds();
            }
        });
        
        // Clean up when video is removed
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
     * Set up message listeners for communication with background script
     */
    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'CHECK_VISIBILITY':
                    sendResponse({ visible: this.isPageVisible() });
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
                    this.toggleSpeedOverlay();
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ error: 'Unknown message type' });
            }
            
            return true; // Keep message channel open
        });
    }

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        if (!this.settings.keyboardShortcutsEnabled) return;
        
        document.addEventListener('keydown', (event) => {
            // Only handle shortcuts if no input element is focused
            if (this.isInputFocused()) return;
            
            // Direct shortcuts: Plus/Minus keys
            if (!event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
                switch (event.code) {
                    case 'Equal': // Plus key (= key, which is + when shifted, but we want it without shift)
                    case 'NumpadAdd': // Numpad plus
                        event.preventDefault();
                        this.increaseSpeed();
                        break;
                        
                    case 'Minus': // Minus key
                    case 'NumpadSubtract': // Numpad minus
                        event.preventDefault();
                        this.decreaseSpeed();
                        break;
                }
            }
            
            // Alternative shortcuts for when videos are playing (same as above but with video check)
            if (this.videos.size > 0 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                switch (event.code) {
                    case 'Equal': // Plus key
                    case 'NumpadAdd':
                        if (this.isVideoPlaying()) {
                            event.preventDefault();
                            this.increaseSpeed();
                        }
                        break;
                        
                    case 'Minus':
                    case 'NumpadSubtract':
                        if (this.isVideoPlaying()) {
                            event.preventDefault();
                            this.decreaseSpeed();
                        }
                        break;
                }
            }
        });
    }

    /**
     * Start visibility checking for time tracking
     */
    startVisibilityCheck() {
        this.visibilityCheckInterval = setInterval(() => {
            // This is checked by background script via message
        }, 1000);
    }

    /**
     * Check if page is currently visible
     * @returns {boolean} True if page is visible
     */
    isPageVisible() {
        return document.visibilityState === 'visible' && !document.hidden;
    }

    /**
     * Check if an input element is currently focused
     * @returns {boolean} True if input is focused
     */
    isInputFocused() {
        const activeElement = document.activeElement;
        const inputTypes = ['input', 'textarea', 'select'];
        return inputTypes.includes(activeElement?.tagName?.toLowerCase()) ||
               activeElement?.contentEditable === 'true';
    }

    /**
     * Check if any video is currently playing
     * @returns {boolean} True if any video is playing
     */
    isVideoPlaying() {
        return Array.from(this.videos).some(video => !video.paused && !video.ended);
    }

    /**
     * Increase video playback speed
     */
    increaseSpeed() {
        const increments = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 8.0, 16.0];
        const maxSpeed = this.settings.maxPlaybackSpeed || 16.0;
        
        const currentIndex = increments.findIndex(speed => Math.abs(speed - this.currentSpeed) < 0.01);
        const nextIndex = currentIndex + 1;
        
        if (nextIndex < increments.length && increments[nextIndex] <= maxSpeed) {
            this.setSpeed(increments[nextIndex]);
        }
    }

    /**
     * Decrease video playback speed
     */
    decreaseSpeed() {
        const increments = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 8.0, 16.0];
        
        const currentIndex = increments.findIndex(speed => Math.abs(speed - this.currentSpeed) < 0.01);
        const prevIndex = currentIndex - 1;
        
        if (prevIndex >= 0) {
            this.setSpeed(increments[prevIndex]);
        }
    }

    /**
     * Set video playback speed
     * @param {number} speed - New playback speed
     */
    setSpeed(speed) {
        const maxSpeed = this.settings.maxPlaybackSpeed || 16.0;
        const clampedSpeed = Math.max(0.25, Math.min(maxSpeed, speed));
        
        this.currentSpeed = clampedSpeed;
        this.updateAllVideoSpeeds();
        this.saveCurrentSpeed();
        this.showSpeedNotification();
    }

    /**
     * Update speed for all videos on the page
     */
    updateAllVideoSpeeds() {
        this.videos.forEach(video => {
            if (video && !video.paused) {
                video.playbackRate = this.currentSpeed;
            }
        });
    }

    /**
     * Save current speed to storage
     */
    async saveCurrentSpeed() {
        try {
            await chrome.runtime.sendMessage({
                type: 'UPDATE_VIDEO_SPEED',
                domain: this.domain,
                speed: this.currentSpeed
            });
        } catch (error) {
            console.error('Error saving video speed:', error);
        }
    }

    /**
     * Show speed indicator on video
     * @param {HTMLVideoElement} video - Video element
     */
    showSpeedIndicator(video) {
        if (!this.settings.showSpeedOverlay) return;
        
        // Remove existing indicator
        const existingIndicator = video.parentNode?.querySelector('.timedash-speed-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Create new indicator
        const indicator = document.createElement('div');
        indicator.className = 'timedash-speed-indicator';
        indicator.textContent = `${this.currentSpeed}x`;
        indicator.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-family: Arial, sans-serif;
            z-index: 9999;
            pointer-events: none;
            transition: opacity 0.3s ease;
        `;
        
        // Position relative to video
        if (video.parentNode) {
            const parent = video.parentNode;
            if (getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
            }
            parent.appendChild(indicator);
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.style.opacity = '0';
                    setTimeout(() => {
                        if (indicator.parentNode) {
                            indicator.remove();
                        }
                    }, 300);
                }
            }, 3000);
        }
    }

    /**
     * Show speed change notification
     */
    showSpeedNotification() {
        // Remove existing notification
        const existingNotification = document.querySelector('.timedash-speed-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = 'timedash-speed-notification';
        notification.textContent = `Speed: ${this.currentSpeed}x`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2196F3;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-family: Arial, sans-serif;
            z-index: 999999;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transform: translateX(100%);
            transition: transform 0.3s ease, opacity 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });
        
        // Auto-hide after 2 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 2000);
    }

    /**
     * Toggle speed overlay visibility
     */
    toggleSpeedOverlay() {
        this.settings.showSpeedOverlay = !this.settings.showSpeedOverlay;
        
        // Update all existing indicators
        const indicators = document.querySelectorAll('.timedash-speed-indicator');
        indicators.forEach(indicator => {
            indicator.style.display = this.settings.showSpeedOverlay ? 'block' : 'none';
        });
    }

    /**
     * Extract domain from URL
     * @param {string} url - URL to extract domain from
     * @returns {string} Domain name
     */
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '');
        } catch (error) {
            return window.location.hostname.replace(/^www\./, '');
        }
    }

    /**
     * Clean up content script
     */
    cleanup() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        if (this.visibilityCheckInterval) {
            clearInterval(this.visibilityCheckInterval);
        }
        
        // Remove any UI elements
        const notifications = document.querySelectorAll('.timedash-speed-notification');
        notifications.forEach(n => n.remove());
        
        const indicators = document.querySelectorAll('.timedash-speed-indicator');
        indicators.forEach(i => i.remove());
    }
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new TimeDashContent();
    });
} else {
    new TimeDashContent();
}
