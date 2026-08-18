import { showToast } from '../../../utils/dom.js';

/**
 *
 * @param CurrentlyPlayingUI
 */
export function applyCurrentlyPlayingLifecycleMethods(CurrentlyPlayingUI) {
    CurrentlyPlayingUI.prototype.setup = function setup() {
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
                    const focusRes = await chrome.runtime.sendMessage({
                        type: 'FOCUS_VIDEO_TAB',
                        tabId,
                    });
                    if (!focusRes || !focusRes.success) showToast(chrome.i18n.getMessage('couldNotFocusTab'), 'error');
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
                    frameId: Number.isInteger(frameId) ? frameId : undefined,
                });

                if (!res || !res.success) {
                    showToast(chrome.i18n.getMessage('couldNotControlVideo'), 'error');
                    this.refreshNow();
                    return;
                }

                if (action === 'toggle-play') {
                    // Set the label from the authoritative paused state returned by
                    // the content script, so it reflects reality immediately.
                    const toggleBtn = list.querySelector(
                        `.currently-playing-toggle-btn[data-video-id="${videoId}"]`
                    );
                    if (toggleBtn && typeof res.paused === 'boolean') {
                        toggleBtn.textContent = res.paused ? 'Play' : 'Pause';
                    }
                } else {
                    this.refreshNow();
                }
            } catch {
                showToast(chrome.i18n.getMessage('actionFailed'), 'error');
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
                frameId: Number.isInteger(frameId) ? frameId : undefined,
            });

            if (!res || !res.success) showToast(chrome.i18n.getMessage('seekFailed'), 'error');
            this.refreshNow();
        });
    };

    CurrentlyPlayingUI.prototype.setActive = function setActive(active) {
        this.isActive = active;
        if (active) this.start();
        else this.stop();
    };

    CurrentlyPlayingUI.prototype.start = function start() {
        if (this.pollInterval) return;
        this.refreshNow(true);
        this.pollInterval = setInterval(() => this.refreshNow(), this.pollMs);
    };

    CurrentlyPlayingUI.prototype.stop = function stop() {
        if (!this.pollInterval) return;
        clearInterval(this.pollInterval);
        this.pollInterval = null;
    };

    CurrentlyPlayingUI.prototype.forceRefresh = async function forceRefresh() {
        const list = document.getElementById('currentlyPlayingList');
        if (list)
            list.innerHTML = '<div class="analytics-empty-state">Refreshing active videos…</div>';

        try {
            const refreshResponse = await this.sendMessageWithTimeout(
                { type: 'REFRESH_VIDEO_DETECTION' },
                12000
            );
            if (!refreshResponse || refreshResponse.success === false)
                showToast(chrome.i18n.getMessage('videoRefreshFailed'), 'error');
            if (refreshResponse && Array.isArray(refreshResponse.sessions)) {
                this.render(refreshResponse.sessions);
                return;
            }
        } catch {
            showToast(chrome.i18n.getMessage('videoRefreshFailed'), 'error');
        }

        await this.refreshNow(true);
    };

    CurrentlyPlayingUI.prototype.refreshNow = async function refreshNow(force = false) {
        if (!this.isActive && !force) return;

        const list = document.getElementById('currentlyPlayingList');
        if (!list) return;

        try {
            const response = await this.sendMessageWithTimeout(
                { type: 'GET_CURRENTLY_PLAYING_VIDEOS' },
                8000
            );
            if (!response || response.error) {
                list.innerHTML =
                    `<div class="analytics-empty-state">${chrome.i18n.getMessage('failedLoadVideos')}</div>`;
                return;
            }

            const sessions = Array.isArray(response.sessions) ? response.sessions : [];
            this.render(sessions);
        } catch {
            list.innerHTML =
                `<div class="analytics-empty-state">${chrome.i18n.getMessage('unableLoadVideos')}</div>`;
        }
    };
}
