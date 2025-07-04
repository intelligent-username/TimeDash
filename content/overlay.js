'use strict';

/**
 * Speed control overlay for videos
 * Provides an optional in-page UI for video speed control
 */
class SpeedOverlay {
    constructor() {
        this.overlay = null;
        this.isVisible = false;
        this.currentVideo = null;
        this.speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 8.0, 16.0];
        
        this.init();
    }

    /**
     * Initialize overlay
     */
    init() {
        this.createOverlay();
        this.setupEventListeners();
        this.watchForVideos();
    }

    /**
     * Create overlay HTML structure
     */
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'timedash-speed-overlay';
        this.overlay.innerHTML = `
            <div class="speed-overlay-content">
                <div class="speed-overlay-header">
                    <span class="speed-overlay-title">Playback Speed</span>
                    <button class="speed-overlay-close" title="Close">&times;</button>
                </div>
                <div class="speed-overlay-controls">
                    <div class="speed-buttons">
                        ${this.speeds.map(speed => 
                            `<button class="speed-btn" data-speed="${speed}">${speed}x</button>`
                        ).join('')}
                    </div>
                    <div class="speed-slider-container">
                        <input type="range" class="speed-slider" 
                               min="0" max="${this.speeds.length - 1}" 
                               step="1" value="3">
                        <div class="speed-display">1.0x</div>
                    </div>
                    <div class="speed-shortcuts">
                        <small>Shortcuts: Ctrl+Shift+, / Ctrl+Shift+.</small>
                    </div>
                </div>
            </div>
        `;

        this.overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 999999;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-width: 300px;
            max-width: 400px;
        `;

        this.addOverlayStyles();
        document.body.appendChild(this.overlay);
    }

    /**
     * Add CSS styles for overlay
     */
    addOverlayStyles() {
        if (document.getElementById('timedash-overlay-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'timedash-overlay-styles';
        styles.textContent = `
            .timedash-speed-overlay.visible {
                opacity: 1 !important;
                visibility: visible !important;
                transform: translate(-50%, -50%) scale(1) !important;
            }

            .speed-overlay-content {
                padding: 20px;
            }

            .speed-overlay-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 12px;
                border-bottom: 1px solid #e0e0e0;
            }

            .speed-overlay-title {
                font-size: 18px;
                font-weight: 600;
                color: #333;
            }

            .speed-overlay-close {
                background: none;
                border: none;
                font-size: 24px;
                color: #666;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 0.2s ease;
            }

            .speed-overlay-close:hover {
                background-color: #f0f0f0;
                color: #333;
            }

            .speed-buttons {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin-bottom: 20px;
            }

            .speed-btn {
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                background: white;
                color: #333;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .speed-btn:hover {
                background: #f5f5f5;
                border-color: #2196F3;
            }

            .speed-btn.active {
                background: #2196F3;
                color: white;
                border-color: #2196F3;
            }

            .speed-slider-container {
                margin-bottom: 16px;
            }

            .speed-slider {
                width: 100%;
                height: 6px;
                border-radius: 3px;
                background: #ddd;
                outline: none;
                margin-bottom: 12px;
                -webkit-appearance: none;
                appearance: none;
            }

            .speed-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #2196F3;
                cursor: pointer;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
            }

            .speed-slider::-moz-range-thumb {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #2196F3;
                cursor: pointer;
                border: none;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
            }

            .speed-display {
                text-align: center;
                font-size: 16px;
                font-weight: 600;
                color: #2196F3;
            }

            .speed-shortcuts {
                text-align: center;
                color: #666;
            }

            .speed-shortcuts small {
                font-size: 12px;
            }
        `;

        document.head.appendChild(styles);
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Close button
        this.overlay.querySelector('.speed-overlay-close').addEventListener('click', () => {
            this.hide();
        });

        // Speed buttons
        this.overlay.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseFloat(btn.dataset.speed);
                this.setSpeed(speed);
            });
        });

        // Speed slider
        const slider = this.overlay.querySelector('.speed-slider');
        slider.addEventListener('input', () => {
            const speed = this.speeds[parseInt(slider.value)];
            this.setSpeed(speed);
        });

        // Close on outside click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });

        // Show overlay on Ctrl+Shift+S
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyS') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    /**
     * Watch for videos and add overlay trigger
     */
    watchForVideos() {
        const observer = new MutationObserver(() => {
            this.addOverlayTriggers();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Initial setup
        this.addOverlayTriggers();
    }

    /**
     * Add overlay triggers to videos
     */
    addOverlayTriggers() {
        const videos = document.querySelectorAll('video:not([data-timedash-trigger])');
        
        videos.forEach(video => {
            video.setAttribute('data-timedash-trigger', 'true');
            
            // Add double-click trigger
            video.addEventListener('dblclick', (e) => {
                e.preventDefault();
                this.currentVideo = video;
                this.show();
            });

            // Add context menu item (limited in content scripts)
            video.addEventListener('contextmenu', (e) => {
                // Note: Custom context menu items require different approach
                // This is a placeholder for potential future enhancement
            });
        });
    }

    /**
     * Show overlay
     */
    show() {
        if (this.isVisible) return;

        this.isVisible = true;
        this.overlay.classList.add('visible');
        this.updateUI();

        // Focus management
        const firstButton = this.overlay.querySelector('.speed-btn');
        if (firstButton) {
            firstButton.focus();
        }
    }

    /**
     * Hide overlay
     */
    hide() {
        if (!this.isVisible) return;

        this.isVisible = false;
        this.overlay.classList.remove('visible');
        this.currentVideo = null;

        // Return focus to video or document
        if (this.currentVideo) {
            this.currentVideo.focus();
        }
    }

    /**
     * Toggle overlay visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            // Find current video
            const videos = document.querySelectorAll('video');
            this.currentVideo = Array.from(videos).find(v => !v.paused) || videos[0];
            this.show();
        }
    }

    /**
     * Set video speed
     * @param {number} speed - New playback speed
     */
    setSpeed(speed) {
        if (!this.currentVideo) return;

        this.currentVideo.playbackRate = speed;
        this.updateUI();

        // Notify content script
        chrome.runtime.sendMessage({
            type: 'UPDATE_VIDEO_SPEED',
            domain: window.location.hostname.replace(/^www\./, ''),
            speed: speed
        });

        // Show temporary notification
        this.showSpeedNotification(speed);
    }

    /**
     * Update UI to reflect current speed
     */
    updateUI() {
        if (!this.currentVideo) return;

        const currentSpeed = this.currentVideo.playbackRate;
        
        // Update buttons
        this.overlay.querySelectorAll('.speed-btn').forEach(btn => {
            const btnSpeed = parseFloat(btn.dataset.speed);
            btn.classList.toggle('active', Math.abs(btnSpeed - currentSpeed) < 0.01);
        });

        // Update slider
        const speedIndex = this.speeds.findIndex(s => Math.abs(s - currentSpeed) < 0.01);
        if (speedIndex !== -1) {
            this.overlay.querySelector('.speed-slider').value = speedIndex;
        }

        // Update display
        this.overlay.querySelector('.speed-display').textContent = `${currentSpeed}x`;
    }

    /**
     * Show speed change notification
     * @param {number} speed - New speed
     */
    showSpeedNotification(speed) {
        // Remove existing notification
        const existing = document.querySelector('.timedash-speed-notification');
        if (existing) {
            existing.remove();
        }

        // Create notification
        const notification = document.createElement('div');
        notification.className = 'timedash-speed-notification';
        notification.textContent = `Speed: ${speed}x`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #2196F3;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            z-index: 1000000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
        });

        // Auto-hide
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 1500);
    }

    /**
     * Destroy overlay
     */
    destroy() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }

        const styles = document.getElementById('timedash-overlay-styles');
        if (styles) {
            styles.remove();
        }
    }
}

// Initialize overlay if enabled
chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }).then(settings => {
    if (settings?.showSpeedOverlay !== false) {
        new SpeedOverlay();
    }
}).catch(() => {
    // Default to showing overlay if can't get settings
    new SpeedOverlay();
});
