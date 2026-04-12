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
                position: fixed;
                background: var(--tsd-overlay-color); color: white;
                padding: 4px 8px; border-radius: 4px;
                font-size: 12px; font-family: sans-serif; line-height: 1;
                width: fit-content; white-space: nowrap;
                z-index: 2147483647; pointer-events: none;
                transition: opacity 0.3s ease;
            }


        `;
        document.head.appendChild(style);
    }



    /**
     * Show Corner Indicator
     */
    showIndicator(video, speed) {
        // Single persistent element on body — avoids inheriting parent sizing/layout
        let indicator = document.getElementById('timedash-speed-indicator');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'timedash-speed-indicator';
            indicator.className = 'timedash-speed-indicator';
            document.body.appendChild(indicator);
        }

        // Position in top-right corner of the video using fixed viewport coords
        const rect = video.getBoundingClientRect();
        indicator.style.top = (rect.top + 10) + 'px';
        indicator.style.right = (window.innerWidth - rect.right + 10) + 'px';

        // Immediately update text and ensure fully visible
        indicator.textContent = `${speed}x`;
        indicator.style.opacity = '1';

        // Cancel any pending hide timers
        clearTimeout(indicator._hideTimer);
        clearTimeout(indicator._removeTimer);

        // Auto hide after 2 s
        indicator._hideTimer = setTimeout(() => {
            indicator.style.opacity = '0';
            indicator._removeTimer = setTimeout(() => indicator.remove(), 300);
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
                blue: '#00b7ff',
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
