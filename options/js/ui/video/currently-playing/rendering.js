export function applyCurrentlyPlayingRenderingMethods(CurrentlyPlayingUI) {
    CurrentlyPlayingUI.prototype.render = function render(sessions) {
        const list = document.getElementById('currentlyPlayingList');
        if (!list) return;

        const items = [];
        sessions.forEach((session) => {
            (session.videos || []).forEach((video, index) => {
                if (!video || !video.id || !session || !session.tabId) return;
                items.push({ tabId: session.tabId, tabTitle: session.title, url: session.url, video, index });
            });
        });

        const visibleItems = items.filter((item) => !this.dismissedKeys.has(this.getVideoKey(item)));
        if (visibleItems.length === 0) {
            list.innerHTML = '<div class="analytics-empty-state">No active videos found.</div>';
            return;
        }

        list.innerHTML = visibleItems.map((item) => this.renderItem(item)).join('');
        if (!list.innerHTML) list.innerHTML = '<div class="analytics-empty-state">No active videos found.</div>';
    };

    CurrentlyPlayingUI.prototype.renderItem = function renderItem(item) {
        const duration = Number(item.video.duration || 0);
        const currentTime = Number(item.video.currentTime || 0);
        const isLive = Boolean(item.video.isLive);
        const paused = Boolean(item.video.paused);
        const cleanedTitle = this.escapeHtml(this.cleanTitle(item.tabTitle));
        const sourceLabel = this.escapeHtml(this.normalizeSourceLabel(item.video.sourceLabel, item.url));
        const videoKey = this.getVideoKey(item);
        const frameId = Number.isInteger(item.video.frameId) ? item.video.frameId : '';

        return `
            <div class="currently-playing-item">
                <div class="currently-playing-meta currently-playing-meta-row">
                    <div>
                        <button type="button" class="currently-playing-title currently-playing-title-btn" data-action="focus-tab" data-tab-id="${item.tabId}" title="Open tab">${cleanedTitle}</button>
                        <div class="currently-playing-subtitle">${sourceLabel} • ${isLive ? 'Live' : `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`}</div>
                    </div>
                    <button type="button" class="currently-playing-dismiss" data-action="dismiss-item" data-video-key="${this.escapeHtml(videoKey)}" title="Hide video">×</button>
                </div>
                <input type="range" class="currently-playing-seek" min="0" max="${Math.max(duration, 1)}" step="0.1" value="${Math.min(currentTime, Math.max(duration, 1))}" data-tab-id="${item.tabId}" data-video-id="${item.video.id}" data-frame-id="${frameId}" ${isLive ? 'disabled' : ''} />
                <div class="currently-playing-controls">
                    <button type="button" class="btn btn-outline btn-sm" data-action="skip-back" data-tab-id="${item.tabId}" data-video-id="${item.video.id}" data-frame-id="${frameId}">Prev</button>
                    <button type="button" class="btn btn-outline btn-sm currently-playing-control-small" title="Rewind" data-action="step-back" data-tab-id="${item.tabId}" data-video-id="${item.video.id}" data-frame-id="${frameId}">⟲</button>
                    <button type="button" class="btn btn-primary btn-sm" data-action="toggle-play" data-tab-id="${item.tabId}" data-video-id="${item.video.id}" data-frame-id="${frameId}">${paused ? 'Play' : 'Pause'}</button>
                    <button type="button" class="btn btn-outline btn-sm currently-playing-control-small" title="Skip Ahead" data-action="step-forward" data-tab-id="${item.tabId}" data-video-id="${item.video.id}" data-frame-id="${frameId}">⟳</button>
                    <button type="button" class="btn btn-outline btn-sm" data-action="skip-forward" data-tab-id="${item.tabId}" data-video-id="${item.video.id}" data-frame-id="${frameId}">Skip</button>
                </div>
            </div>
        `;
    };

    CurrentlyPlayingUI.prototype.getVideoKey = function getVideoKey(item) {
        return `${item.tabId}:${item.video.id}:${Number.isInteger(item.video.frameId) ? item.video.frameId : 'top'}`;
    };

    CurrentlyPlayingUI.prototype.getHostLabel = function getHostLabel(url) {
        try {
            const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
            const hostMap = { 'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'facebook.com': 'Facebook', 'm.facebook.com': 'Facebook', 'vimeo.com': 'Vimeo', 'twitch.tv': 'Twitch', 'x.com': 'X', 'twitter.com': 'X' };
            if (hostMap[host]) return hostMap[host];
            const base = host.split('.').slice(-2, -1)[0] || host;
            return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
        } catch {
            return 'Unknown source';
        }
    };

    CurrentlyPlayingUI.prototype.normalizeSourceLabel = function normalizeSourceLabel(sourceLabel, url) {
        const source = String(sourceLabel || '').trim();
        if (!source) return this.getHostLabel(url);
        const looksLikeHost = /^[\w.-]+\.[a-z]{2,}$/i.test(source);
        if (looksLikeHost) {
            try { return this.getHostLabel(`https://${source}`); }
            catch { return this.getHostLabel(url); }
        }
        return source;
    };

    CurrentlyPlayingUI.prototype.cleanTitle = function cleanTitle(title) {
        const raw = String(title || '').trim();
        if (!raw) return 'Untitled video';
        return raw.replace(/\s*[\-|•|·]\s*YouTube\s*$/i, '').replace(/\s*[\-|•|·]\s*Vimeo\s*$/i, '').replace(/\s*[\-|•|·]\s*Facebook\s*$/i, '').trim();
    };

    CurrentlyPlayingUI.prototype.formatTime = function formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
        const total = Math.floor(seconds);
        const mins = Math.floor(total / 60);
        const secs = total % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    CurrentlyPlayingUI.prototype.escapeHtml = function escapeHtml(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
    };
}
