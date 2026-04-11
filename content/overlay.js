'use strict';

/**
 * TimeDash Overlay UI Manager
 * Handles all UI elements injected into the page:
 * 1. Speed Control Modal (Center)
 * 2. Speed Indicator (Corner)
 */
class TimeDashOverlayUI {
    constructor(callbacks = {}) {
        this.callbacks = callbacks; // { onSpeedChange }
        this._indicator = null;    // Persistent element; never removed, avoids stale closures
        this._hideTimer = null;    // Class-level timer ref so clearTimeout always works
        this.modal = null;
        this.isModalVisible = false;
        this.currentVideo = null;
        this.speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 8.0, 16.0];
        this._boundKeyHandler = null;

        this.init();
    }

    init() {
        this.injectStyles();
        this._createModal();
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
                --tsd-modal-bg: rgba(18, 18, 24, 0.97);
                --tsd-modal-border: rgba(255, 255, 255, 0.1);
                --tsd-btn-bg: rgba(255, 255, 255, 0.07);
                --tsd-btn-hover: rgba(255, 255, 255, 0.14);
                --tsd-text: #f0f0f0;
                --tsd-text-muted: rgba(255, 255, 255, 0.45);
            }

            /* --- Corner Indicator --- */
            #timedash-speed-indicator {
                position: fixed;
                background: var(--tsd-overlay-color);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-family: sans-serif;
                line-height: 1;
                width: fit-content;
                white-space: nowrap;
                z-index: 2147483647;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            /* --- Modal Backdrop --- */
            #timedash-modal-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.55);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                opacity: 0;
                transition: opacity 0.2s ease;
                font-family: system-ui, -apple-system, sans-serif;
            }
            #timedash-modal-overlay.visible {
                opacity: 1;
            }

            /* --- Modal Card --- */
            #timedash-modal-card {
                background: var(--tsd-modal-bg);
                border: 1px solid var(--tsd-modal-border);
                border-radius: 16px;
                padding: 20px 20px 18px;
                min-width: 290px;
                box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65);
                transform: scale(0.94) translateY(8px);
                transition: transform 0.2s ease;
            }
            #timedash-modal-overlay.visible #timedash-modal-card {
                transform: scale(1) translateY(0);
            }

            /* --- Modal Header --- */
            #timedash-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 14px;
            }
            #timedash-modal-title {
                color: var(--tsd-text);
                font-size: 13px;
                font-weight: 600;
                letter-spacing: 0.4px;
                margin: 0;
                text-transform: uppercase;
            }
            #timedash-modal-close {
                all: unset;
                color: var(--tsd-text-muted);
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
                padding: 3px 7px;
                border-radius: 6px;
                transition: color 0.15s, background 0.15s;
            }
            #timedash-modal-close:hover {
                color: var(--tsd-text);
                background: rgba(255, 255, 255, 0.1);
            }

            /* --- Speed Button Grid --- */
            #timedash-speed-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 7px;
            }
            .timedash-speed-btn {
                all: unset;
                background: var(--tsd-btn-bg);
                border: 1px solid transparent;
                border-radius: 8px;
                color: var(--tsd-text);
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                padding: 9px 4px;
                text-align: center;
                transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.1s;
                box-sizing: border-box;
            }
            .timedash-speed-btn:hover {
                background: var(--tsd-btn-hover);
                transform: scale(1.04);
            }
            .timedash-speed-btn.active {
                background: var(--tsd-overlay-color);
                border-color: var(--tsd-overlay-color);
                color: white;
                font-weight: 700;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Build the modal DOM once and keep it in the DOM permanently.
     * Shown/hidden via class + hidden attribute — no re-creation.
     */
    _createModal() {
        if (document.getElementById('timedash-modal-overlay')) {
            this.modal = document.getElementById('timedash-modal-overlay');
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'timedash-modal-overlay';
        overlay.hidden = true;

        const card = document.createElement('div');
        card.id = 'timedash-modal-card';

        // Header
        const header = document.createElement('div');
        header.id = 'timedash-modal-header';

        const title = document.createElement('p');
        title.id = 'timedash-modal-title';
        title.textContent = 'Playback Speed';

        const closeBtn = document.createElement('button');
        closeBtn.id = 'timedash-modal-close';
        closeBtn.setAttribute('aria-label', 'Close speed picker');
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this._hideModal());

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Speed grid
        const grid = document.createElement('div');
        grid.id = 'timedash-speed-grid';

        this.speeds.forEach((speed) => {
            const btn = document.createElement('button');
            btn.className = 'timedash-speed-btn';
            btn.dataset.speed = speed;
            btn.textContent = `${speed}x`;
            btn.addEventListener('click', () => {
                if (this.callbacks.onSpeedChange) {
                    this.callbacks.onSpeedChange(speed);
                }
                this._syncModalActiveSpeed(speed);
                this._hideModal();
            });
            grid.appendChild(btn);
        });

        card.appendChild(header);
        card.appendChild(grid);
        overlay.appendChild(card);

        // Close on backdrop click (not the card itself)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this._hideModal();
        });

        document.body.appendChild(overlay);
        this.modal = overlay;
    }

    /**
     * Toggle speed modal visibility — implements the TOGGLE_OVERLAY message handler
     */
    toggleModal() {
        if (this.isModalVisible) {
            this._hideModal();
        } else {
            this._showModal();
        }
    }

    _showModal() {
        if (!this.modal) return;
        this.modal.hidden = false;
        // Double rAF ensures the hidden→visible transition actually plays
        requestAnimationFrame(() => {
            requestAnimationFrame(() => this.modal.classList.add('visible'));
        });
        this.isModalVisible = true;

        this._boundKeyHandler = (e) => {
            if (e.key === 'Escape') this._hideModal();
        };
        document.addEventListener('keydown', this._boundKeyHandler);
    }

    _hideModal() {
        if (!this.modal) return;
        this.modal.classList.remove('visible');
        // Wait for CSS transition before hiding from accessibility tree
        setTimeout(() => {
            if (!this.isModalVisible) this.modal.hidden = true;
        }, 210);
        this.isModalVisible = false;

        if (this._boundKeyHandler) {
            document.removeEventListener('keydown', this._boundKeyHandler);
            this._boundKeyHandler = null;
        }
    }

    /**
     * Show Corner Indicator.
     * Uses a single persistent element (never removed) and a class-level
     * timer reference — eliminates the stale closure bug from .remove().
     */
    showIndicator(video, speed) {
        // Create once, keep in DOM forever (opacity controls visibility)
        if (!this._indicator) {
            this._indicator = document.createElement('div');
            this._indicator.id = 'timedash-speed-indicator';
            document.body.appendChild(this._indicator);
        }

        const rect = video.getBoundingClientRect();
        this._indicator.style.top = (rect.top + 10) + 'px';
        this._indicator.style.right = (window.innerWidth - rect.right + 10) + 'px';
        this._indicator.textContent = `${speed}x`;
        this._indicator.style.opacity = '1';

        // Cancel any pending fade — this._hideTimer always refers to the current timer
        clearTimeout(this._hideTimer);
        this._hideTimer = setTimeout(() => {
            // this._indicator is always the live element; no stale closure risk
            if (this._indicator) this._indicator.style.opacity = '0';
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

        // Keep modal active state in sync with stored speed
        if (settings.currentPlaybackSpeed !== undefined) {
            this._syncModalActiveSpeed(settings.currentPlaybackSpeed);
        }
    }

    _syncModalActiveSpeed(speed) {
        if (!this.modal) return;
        this.modal.querySelectorAll('.timedash-speed-btn').forEach((btn) => {
            btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
        });
    }
}

// Make available globally
window.TimeDashOverlayUI = TimeDashOverlayUI;
