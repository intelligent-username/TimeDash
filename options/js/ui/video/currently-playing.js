import { showToast } from '../../utils/dom.js';

export class CurrentlyPlayingUI {
    constructor(controller) {
        this.controller = controller;
        this.pollInterval = null;
        this.pollMs = 1000;
        this.isActive = false;
        this.dismissedKeys = new Set();
    }

    async sendMessageWithTimeout(message, timeoutMs = 10000) {
        return await Promise.race([
            chrome.runtime.sendMessage(message),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
        ]);
    }

    setup() {
        const refreshBtn = document.getElementById('currentlyPlayingRefresh');
        const list = document.getElementById('currentlyPlayingList');
        if (!refreshBtn || !list) return;

        refreshBtn.addEventListener('click', async () => {
            await this.forceRefresh();
        });

        list.addEventListener('click', async (event) => {
            try {
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

                if (button.dataset.action === 'focus-tab') {
                    const tabId = Number(button.dataset.tabId);
                    if (!tabId) return;

                    const focusRes = await chrome.runtime.sendMessage({ type: 'FOCUS_VIDEO_TAB', tabId });
                    if (!focusRes || !focusRes.success) {
                        showToast('Could not focus tab', 'error');
                    }
                    return;
                }

                const tabId = Number(button.dataset.tabId);
                const videoId = button.dataset.videoId;
                const action = button.dataset.action;
                const frameId = this.parseFrameId(button.dataset.frameId);
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
            } catch {
                showToast('Action failed', 'error');
            }
        });

        list.addEventListener('change', async (event) => {
            const slider = event.target.closest('.currently-playing-seek');
            if (!slider) return;

            const tabId = Number(slider.dataset.tabId);
            const videoId = slider.dataset.videoId;
            const frameId = this.parseFrameId(slider.dataset.frameId);
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

    parseFrameId(rawFrameId) {
        if (rawFrameId === undefined || rawFrameId === null || rawFrameId === '') {
            return undefined;
        }

        const parsed = Number(rawFrameId);
        return Number.isInteger(parsed) ? parsed : undefined;
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
        const list = document.getElementById('currentlyPlayingList');
        if (list) {
            list.innerHTML = '<div class="analytics-empty-state">Refreshing active videos...</div>';
        }

        this.dismissedKeys.clear();

        try {
            const refreshResponse = await this.sendMessageWithTimeout({ type: 'REFRESH_VIDEO_DETECTION' }, 12000);
            if (!refreshResponse || refreshResponse.success === false) {
                showToast('Video refresh failed', 'error');
            }

            if (refreshResponse && Array.isArray(refreshResponse.sessions)) {
                this.render(refreshResponse.sessions);
                return;
            }
        } catch {
            showToast('Video refresh failed', 'error');
        }

        await this.refreshNow(true);
    }

    async refreshNow(force = false) {
        if (!this.isActive && !force) return;

        const list = document.getElementById('currentlyPlayingList');
        if (!list) return;

        try {
            const response = await this.sendMessageWithTimeout({ type: 'GET_CURRENTLY_PLAYING_VIDEOS' }, 8000);
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
                if (!video || !video.id || !session || !session.tabId) return;

                items.push({
                    tabId: session.tabId,
                    tabTitle: session.title,
                    url: session.url,
                    video,
                    index
                });
            });
        });

        const visibleItems = items.filter((item) => !this.dismissedKeys.has(this.getVideoKey(item)));

        if (visibleItems.length === 0) {
            list.innerHTML = '<div class="analytics-empty-state">No active videos found.</div>';
            return;
        }

        list.innerHTML = visibleItems.map((item) => {
            const duration = Number(item.video.duration || 0);
            const currentTime = Number(item.video.currentTime || 0);
            const isLive = Boolean(item.video.isLive);
            const paused = Boolean(item.video.paused);
            const cleanedTitle = this.escapeHtml(this.cleanTitle(item.tabTitle));
            const sourceLabel = this.escapeHtml(this.normalizeSourceLabel(item.video.sourceLabel, item.url));
            const videoKey = this.getVideoKey(item);

            return `
                <div class="currently-playing-item">
                    <div class="currently-playing-meta currently-playing-meta-row">
                        <div>
                            <button type="button" class="currently-playing-title currently-playing-title-btn" data-action="focus-tab" data-tab-id="${item.tabId}" title="Open tab">${cleanedTitle}</button>
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
            const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
            const hostMap = {
                'youtube.com': 'YouTube',
                'youtu.be': 'YouTube',
                'facebook.com': 'Facebook',
                'm.facebook.com': 'Facebook',
                'vimeo.com': 'Vimeo',
                'twitch.tv': 'Twitch',
                'x.com': 'X',
                'twitter.com': 'X'
            };

            if (hostMap[host]) return hostMap[host];

            const base = host.split('.').slice(-2, -1)[0] || host;
            return base
                .replace(/[-_]+/g, ' ')
                .replace(/\b\w/g, (m) => m.toUpperCase());
        } catch {
            return 'Unknown source';
        }
    }

    normalizeSourceLabel(sourceLabel, url) {
        const source = String(sourceLabel || '').trim();
        if (!source) return this.getHostLabel(url);

        const looksLikeHost = /^[\w.-]+\.[a-z]{2,}$/i.test(source);
        if (looksLikeHost) {
            try {
                return this.getHostLabel(`https://${source}`);
            } catch {
                return this.getHostLabel(url);
            }
        }

        return source;
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
