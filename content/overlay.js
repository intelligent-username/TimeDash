'use strict';

/**
 * TimeDash Overlay UI Manager
 * Handles all UI elements injected into the page:
 * 1. Speed Control Modal (Center)
 * 2. Speed Indicator (Corner)
 * 3. Toast Notification (Top Right)
 */
class TimeDashOverlayUI {
    constructor(callbacks = {}) {
        this.callbacks = callbacks; // { onSpeedChange }
        this.modal = null;
        this.isVisible = false; // Modal visibility
        this.currentVideo = null;
        this.speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 8.0, 16.0];

        this.init();
    }

    init() {
        this.injectStyles();
        this.createModal();
        this.setupModalListeners();
    }

    /**
     * Inject all CSS styles
     */
    injectStyles() {
        if (document.getElementById('timedash-styles')) return;

        const style = document.createElement('style');
        style.id = 'timedash-styles';
        style.textContent = `
            /* --- Color Variables --- */
            :root {
                --tsd-overlay-color: #2196F3;
            }
            
            /* --- Modal Overlay --- */
            .timedash-speed-modal {
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
                padding: 20px;
                color: #333;
            }
            .timedash-speed-modal.visible {
                opacity: 1 !important;
                visibility: visible !important;
                transform: translate(-50%, -50%) scale(1) !important;
            }
            .tsd-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 12px;
                border-bottom: 1px solid #e0e0e0;
            }
            .tsd-modal-title { font-size: 18px; font-weight: 600; }
            .tsd-modal-close {
                background: none; border: none; font-size: 24px; color: #666; cursor: pointer;
                width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                transition: background 0.2s;
            }
            .tsd-modal-close:hover { background: #f0f0f0; }
            .tsd-speed-grid {
                display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px;
            }
            .tsd-speed-btn {
                padding: 8px; border: 1px solid #ddd; border-radius: 6px; background: white;
                font-size: 14px; cursor: pointer; transition: all 0.2s;
            }
            .tsd-speed-btn:hover { background: #f5f5f5; border-color: var(--tsd-overlay-color); }
            .tsd-speed-btn.active { background: var(--tsd-overlay-color); color: white; border-color: var(--tsd-overlay-color); }
            .tsd-slider-container { margin-bottom: 16px; text-align: center; }
            .tsd-slider { width: 100%; margin-bottom: 10px; cursor: pointer; }
            .tsd-current-val { font-size: 16px; font-weight: 600; color: var(--tsd-overlay-color); }
            
            /* --- Corner Indicator --- */
            .timedash-speed-indicator {
                position: absolute; top: 10px; right: 10px;
                background: var(--tsd-overlay-color); color: white;
                padding: 4px 8px; border-radius: 4px;
                font-size: 12px; font-family: sans-serif;
                z-index: 9999; pointer-events: none;
                transition: opacity 0.3s ease;
            }

            /* --- Toast Notification --- */
            .timedash-toast {
                position: fixed; top: 20px; right: 20px;
                background: var(--tsd-overlay-color); color: white;
                padding: 10px 16px; border-radius: 8px;
                font-size: 14px; font-family: sans-serif;
                z-index: 999999; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                transform: translateX(120%); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .timedash-toast.visible { transform: translateX(0); }
        `;
        document.head.appendChild(style);
    }

    /**
     * Create the Modal DOM structure
     */
    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'timedash-speed-modal';
        this.modal.innerHTML = `
            <div class="tsd-modal-header">
                <span class="tsd-modal-title">Playback Speed</span>
                <button class="tsd-modal-close">&times;</button>
            </div>
            <div class="tsd-speed-grid">
                ${this.speeds.map(s => `<button class="tsd-speed-btn" data-speed="${s}">${s}x</button>`).join('')}
            </div>
            <div class="tsd-slider-container">
                <input type="range" class="tsd-slider" min="0" max="${this.speeds.length - 1}" step="1" value="3">
                <div class="tsd-current-val">1.0x</div>
            </div>
            <div style="text-align: center; font-size: 12px; color: #666;">
                Use Shortcuts: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> to toggle this menu
            </div>
        `;
        document.body.appendChild(this.modal);
    }

    setupModalListeners() {
        // Close
        this.modal.querySelector('.tsd-modal-close').addEventListener('click', () => this.hideModal());

        // Buttons
        this.modal.querySelectorAll('.tsd-speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseFloat(btn.dataset.speed);
                this.triggerSpeedChange(speed);
            });
        });

        // Slider
        const slider = this.modal.querySelector('.tsd-slider');
        slider.addEventListener('input', () => {
            const speed = this.speeds[parseInt(slider.value)];
            this.triggerSpeedChange(speed);
        });

        // Outside click
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.modal.contains(e.target) && !e.target.closest('[data-timedash-trigger]')) {
                this.hideModal();
            }
        });

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) this.hideModal();
        });
    }

    triggerSpeedChange(speed) {
        if (this.callbacks.onSpeedChange && this.currentVideo) {
            this.callbacks.onSpeedChange(speed, this.currentVideo);
        }
        this.updateModalUI(speed);
    }

    /**
     * Show Modal for a specific video
     */
    showModal(video) {
        this.currentVideo = video;
        this.isVisible = true;
        this.modal.classList.add('visible');
        this.updateModalUI(video.playbackRate);
    }

    hideModal() {
        this.isVisible = false;
        this.modal.classList.remove('visible');
        if (this.currentVideo) this.currentVideo.focus(); // Return focus
    }

    toggleModal(video) {
        if (this.isVisible) this.hideModal();
        else {
            // Find visible video if not provided
            const target = video || document.querySelector('video:not([paused])') || document.querySelector('video');
            if (target) this.showModal(target);
        }
    }

    updateModalUI(speed) {
        // Update buttons state
        this.modal.querySelectorAll('.tsd-speed-btn').forEach(btn => {
            const s = parseFloat(btn.dataset.speed);
            btn.classList.toggle('active', Math.abs(s - speed) < 0.1);
        });

        // Update slider
        const idx = this.speeds.findIndex(s => Math.abs(s - speed) < 0.1);
        if (idx !== -1) this.modal.querySelector('.tsd-slider').value = idx;

        this.modal.querySelector('.tsd-current-val').textContent = `${speed}x`;
    }

    /**
     * Show Corner Indicator
     */
    showIndicator(video, speed) {
        // Remove existing
        const existing = video.parentNode?.querySelector('.timedash-speed-indicator');
        if (existing) existing.remove();

        const indicator = document.createElement('div');
        indicator.className = 'timedash-speed-indicator';
        indicator.textContent = `${speed}x`;

        // Ensure relative positioning
        if (video.parentNode && getComputedStyle(video.parentNode).position === 'static') {
            video.parentNode.style.position = 'relative';
        }

        video.parentNode?.appendChild(indicator);

        // Auto hide
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 300);
        }, 2000);
    }

    /**
     * Show Toast Notification
     */
    showToast(text) {
        const existing = document.querySelector('.timedash-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'timedash-toast';
        toast.textContent = text;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('visible'));

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
    updateSettings(settings) {
        this.settings = settings;

        // Apply overlay color
        if (settings.overlayColor) {
            const colorMap = {
                blue: '#2196f3',
                purple: '#9c27b0',
                green: '#4caf50',
                orange: '#ff9800',
                red: '#f44336',
                teal: '#009688',
                pink: '#e91e63',
                cyan: '#00bcd4'
            };
            const color = colorMap[settings.overlayColor] || '#2196f3';
            document.documentElement.style.setProperty('--tsd-overlay-color', color);
        }
    }
}

// Make available globally
window.TimeDashOverlayUI = TimeDashOverlayUI;
