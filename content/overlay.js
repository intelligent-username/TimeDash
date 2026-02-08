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
            

            
            /* --- Corner Indicator --- */
            .timedash-speed-indicator {
                position: absolute; top: 10px; right: 10px;
                background: var(--tsd-overlay-color); color: white;
                padding: 4px 8px; border-radius: 4px;
                font-size: 12px; font-family: sans-serif;
                z-index: 9999; pointer-events: none;
                transition: opacity 0.3s ease;
            }


        `;
        document.head.appendChild(style);
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


    updateSettings(settings) {
        this.settings = settings;

        // Apply overlay color
        if (settings.overlayColor) {
            const colorMap = {
                red: '#ef4444',
                orange: '#f97316',
                amber: '#f59e0b',
                green: '#22c55e',
                teal: '#14b8a6',
                cyan: '#06b6d4',
                blue: '#3b82f6',
                indigo: '#6366f1',
                violet: '#8b5cf6',
                purple: '#a855f7',
                pink: '#ec4899',
                rose: '#f43f5e'
            };
            const color = colorMap[settings.overlayColor] || '#2196f3';
            document.documentElement.style.setProperty('--tsd-overlay-color', color);
        }
    }
}

// Make available globally
window.TimeDashOverlayUI = TimeDashOverlayUI;
