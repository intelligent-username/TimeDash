import { showToast } from '../utils/dom.js';

export class CurrentlyPlayingUI {
    constructor(controller) {
        this.controller = controller;
        this.pollInterval = null;
        this.pollMs = 1000;
        this.isActive = false;
        this.dismissedKeys = new Set();
    }

    setup() {
        const refreshBtn = document.getElementById('currentlyPlayingRefresh');
        const list = document.getElementById('currentlyPlayingList');
        if (!refreshBtn || !list) return;

        refreshBtn.addEventListener('click', async () => {
            await this.forceRefresh();
        });

        list.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;

            if (button.dataset.action === 'dismiss-item') {
                const key = button.dataset.videoKey;
                if (key) {
                    this.dismissedKeys.add(key);
                    this.refreshNow(true);
                }
                return;
            }

            const tabId = Number(button.dataset.tabId);
            const videoId = button.dataset.videoId;
            const action = button.dataset.action;
            const frameId = button.dataset.frameId !== undefined ? Number(button.dataset.frameId) : undefined;
            if (!tabId || !videoId || !action) return;

            const res = await chrome.runtime.sendMessage({
                type: 'CONTROL_VIDEO_PLAYBACK',
                tabId,
                videoId,
                action,
                frameId: Number.isInteger(frameId) ? frameId : undefined
            });

            if (!res || !res.success) {
                showToast('Could not control video', 'error');
            }

            this.refreshNow();
        });

        list.addEventListener('change', async (event) => {
            const slider = event.target.closest('.currently-playing-seek');
            if (!slider) return;

            const tabId = Number(slider.dataset.tabId);
            const videoId = slider.dataset.videoId;
            const frameId = slider.dataset.frameId !== undefined ? Number(slider.dataset.frameId) : undefined;
            const value = Number(slider.value);
            if (!tabId || !videoId || !Number.isFinite(value)) return;

            const res = await chrome.runtime.sendMessage({
                type: 'CONTROL_VIDEO_PLAYBACK',
                tabId,
                videoId,
                action: 'seek',
                value,
                frameId: Number.isInteger(frameId) ? frameId : undefined
            });

            if (!res || !res.success) {
                showToast('Seek failed', 'error');
            }

            this.refreshNow();
        });
    }

    setActive(active) {
        this.isActive = active;
        if (active) {
            this.start();
        } else {
            this.stop();
        }
    }

    start() {
        if (this.pollInterval) return;
        this.refreshNow(true);
        this.pollInterval = setInterval(() => this.refreshNow(), this.pollMs);
    }

    stop() {
        if (!this.pollInterval) return;
        clearInterval(this.pollInterval);
        this.pollInterval = null;
    }

    async forceRefresh() {
        try {
            await chrome.runtime.sendMessage({ type: 'REFRESH_VIDEO_DETECTION' });
        } catch {
            // Ignore and still try reading sessions
        }

        await this.refreshNow(true);
    }

    async refreshNow(force = false) {
        if (!this.isActive && !force) return;

        const list = document.getElementById('currentlyPlayingList');
        if (!list) return;

        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_CURRENTLY_PLAYING_VIDEOS' });
            if (!response || response.error) {
                list.innerHTML = '<div class="analytics-empty-state">Failed to load active videos.</div>';
                return;
            }

            const sessions = Array.isArray(response.sessions) ? response.sessions : [];
            this.render(sessions);
        } catch {
            list.innerHTML = '<div class="analytics-empty-state">Unable to load active videos.</div>';
        }
    }

    render(sessions) {
        const list = document.getElementById('currentlyPlayingList');
        if (!list) return;

        const items = [];
        sessions.forEach((session) => {
            (session.videos || []).forEach((video, index) => {
                items.push({
                    tabId: session.tabId,
                    tabTitle: session.title,
                    url: session.url,
                    video,
                    index
                });
            });
        });

        if (items.length === 0) {
            list.innerHTML = '<div class="analytics-empty-state">No active videos found.</div>';
            return;
        }

        list.innerHTML = items.map((item) => {
            const duration = Number(item.video.duration || 0);
            const currentTime = Number(item.video.currentTime || 0);
            const isLive = Boolean(item.video.isLive);
            const paused = Boolean(item.video.paused);
            const cleanedTitle = this.escapeHtml(this.cleanTitle(item.tabTitle));
            const sourceLabel = this.escapeHtml(item.video.sourceLabel || this.getHostLabel(item.url));
            const videoKey = this.getVideoKey(item);

            return `
                <div class="currently-playing-item">
                    <div class="currently-playing-meta currently-playing-meta-row">
                        <div>
                            <div class="currently-playing-title" title="${cleanedTitle}">${cleanedTitle}</div>
                            <div class="currently-playing-subtitle">${sourceLabel} • ${isLive ? 'Live' : `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`}</div>
                        </div>
                        <button type="button" class="currently-playing-dismiss" data-action="dismiss-item" data-video-key="${this.escapeHtml(videoKey)}" title="Hide video">×</button>
                    </div>
                    <input
                        type="range"
                        class="currently-playing-seek"
                        min="0"
                        max="${Math.max(duration, 1)}"
                        step="0.1"
                        value="${Math.min(currentTime, Math.max(duration, 1))}"
                        data-tab-id="${item.tabId}"
                        data-video-id="${item.video.id}"
                        data-frame-id="${Number.isInteger(item.video.frameId) ? item.video.frameId : ''}"
                        ${isLive ? 'disabled' : ''}
                    />
                    <div class="currently-playing-controls">
                        <button type="button" class="btn btn-outline btn-sm" data-action="skip-back" data-tab-id="${item.tabId}" data-video-id="${item.video.id}" data-frame-id="${Number.isInteger(item.video.frameId) ? item.video.frameId : ''}">Prev</button>
                        <button type="button" class="btn btn-outline btn-sm currently-playing-control-small" title="Rewind" data-action="step-back" data-tab-id="${item.tabId}" data-video-id="${item.video.id}" data-frame-id="${Number.isInteger(item.video.frameId) ? item.video.frameId : ''}">⟲</button>
                        <button type="button" class="btn btn-primary btn-sm" data-action="toggle-play" data-tab-id="${item.tabId}" data-video-id="${item.video.id}" data-frame-id="${Number.isInteger(item.video.frameId) ? item.video.frameId : ''}">${paused ? 'Play' : 'Pause'}</button>
                        <button type="button" class="btn btn-outline btn-sm currently-playing-control-small" title="Skip Ahead" data-action="step-forward" data-tab-id="${item.tabId}" data-video-id="${item.video.id}" data-frame-id="${Number.isInteger(item.video.frameId) ? item.video.frameId : ''}">⟳</button>
                        <button type="button" class="btn btn-outline btn-sm" data-action="skip-forward" data-tab-id="${item.tabId}" data-video-id="${item.video.id}" data-frame-id="${Number.isInteger(item.video.frameId) ? item.video.frameId : ''}">Skip</button>
                    </div>
                </div>
            `;
        }).filter((markup, idx) => {
            const item = items[idx];
            return !this.dismissedKeys.has(this.getVideoKey(item));
        }).join('');

        if (!list.innerHTML) {
            list.innerHTML = '<div class="analytics-empty-state">No active videos found.</div>';
        }
    }

    getVideoKey(item) {
        return `${item.tabId}:${item.video.id}:${Number.isInteger(item.video.frameId) ? item.video.frameId : 'top'}`;
    }

    getHostLabel(url) {
        try {
            const host = new URL(url).hostname.replace(/^www\./, '');
            return host || 'Unknown source';
        } catch {
            return 'Unknown source';
        }
    }

    cleanTitle(title) {
        const raw = String(title || '').trim();
        if (!raw) return 'Untitled video';

        return raw
            .replace(/\s*[\-|•|·]\s*YouTube\s*$/i, '')
            .replace(/\s*[\-|•|·]\s*Vimeo\s*$/i, '')
            .replace(/\s*[\-|•|·]\s*Facebook\s*$/i, '')
            .trim();
    }

    formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
        const total = Math.floor(seconds);
        const mins = Math.floor(total / 60);
        const secs = total % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
