/**
 * Video Service - background/modules/video-service.js
 * Routes video playback control and detection refresh commands
 * ~180 lines
 */

class VideoService {
    constructor(instance) {
        this.instance = instance;
    }

    async getCurrentlyPlayingVideos() {
        const tabs = await chrome.tabs.query({});
        const sessionResults = await Promise.all(
            tabs
                .filter((tab) => tab && tab.id && tab.url && /^https?:\/\//.test(tab.url))
                .map(async (tab) => {
                    try {
                        const frameIds = await this.getTabFrameIds(tab.id);
                        const frameResponses = await Promise.all(
                            frameIds.map(async (frameId) => {
                                try {
                                    const response = await chrome.tabs.sendMessage(
                                        tab.id,
                                        { type: 'GET_VIDEO_PLAYBACK_STATE' },
                                        { frameId }
                                    );

                                    if (!response || !Array.isArray(response.videos) || response.videos.length === 0) {
                                        return [];
                                    }

                                    return response.videos.map((video) => ({ ...video, frameId }));
                                } catch {
                                    return [];
                                }
                            })
                        );

                        const videos = frameResponses.flat();
                        if (videos.length === 0) {
                            return null;
                        }

                        return {
                            tabId: tab.id,
                            title: tab.title || 'Untitled tab',
                            url: tab.url,
                            favIconUrl: tab.favIconUrl || '',
                            videos
                        };
                    } catch {
                        return null;
                    }
                })
        );

        return {
            sessions: sessionResults.filter(Boolean),
            updatedAt: Date.now()
        };
    }

    async controlVideoPlayback(message) {
        if (!message || !message.tabId || !message.action) {
            return { success: false, error: 'Invalid control request' };
        }

        try {
            const normalizedAction = message.action === 'step-back'
                ? 'skip-back'
                : message.action === 'step-forward'
                    ? 'skip-forward'
                    : message.action;

            const sendPayload = {
                type: 'CONTROL_VIDEO_PLAYBACK',
                action: normalizedAction,
                videoId: message.videoId,
                value: message.value
            };

            let response = null;

            if (Number.isInteger(message.frameId)) {
                response = await chrome.tabs.sendMessage(message.tabId, sendPayload, { frameId: message.frameId });
            } else {
                response = await chrome.tabs.sendMessage(message.tabId, sendPayload);
            }

            return response || { success: false, error: 'No response from content script' };
        } catch (error) {
            return { success: false, error: error.message || 'Failed to control video' };
        }
    }

    async refreshVideoDetection() {
        const tabs = await chrome.tabs.query({});
        let refreshedFrames = 0;

        await Promise.all(
            tabs
                .filter((tab) => tab && tab.id && tab.url && /^https?:\/\//.test(tab.url))
                .map(async (tab) => {
                    await this.ensureVideoScriptsInjected(tab.id);
                    const frameIds = await this.getTabFrameIds(tab.id);
                    await Promise.all(frameIds.map(async (frameId) => {
                        try {
                            await chrome.tabs.sendMessage(
                                tab.id,
                                { type: 'FORCE_VIDEO_RESCAN' },
                                { frameId }
                            );
                            refreshedFrames++;
                        } catch {
                            // Tab probably closed or doesn't have content script
                        }
                    }));
                })
        );

        return { success: true, refreshedFrames };
    }

    async ensureVideoScriptsInjected(tabId) {
        try {
            if (!chrome.scripting || !chrome.scripting.executeScript) return;
            await chrome.scripting.executeScript({
                target: { tabId, allFrames: true },
                files: [
                    'content/overlay.js',
                    'content/modules/video-detector.js',
                    'content/modules/video-controller.js',
                    'content/modules/playback-state.js',
                    'content/modules/message-handler.js',
                    'content/modules/keyboard-handler.js',
                    'content/content.js'
                ]
            });
        } catch {
            // Silently fail on restricted pages
        }
    }

    async focusVideoTab(message) {
        const tabId = Number(message && message.tabId);
        if (!tabId) return { success: false, error: 'Invalid tab id' };
        try {
            const tab = await chrome.tabs.get(tabId);
            await chrome.tabs.update(tabId, { active: true });
            if (tab && Number.isInteger(tab.windowId)) {
                await chrome.windows.update(tab.windowId, { focused: true });
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getTabFrameIds(tabId) {
        try {
            const frames = await chrome.webNavigation.getAllFrames({ tabId });
            return frames ? frames.map((f) => f.frameId) : [0];
        } catch {
            return [0];
        }
    }
}
