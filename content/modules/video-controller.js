/**
 * Video Controller - content/modules/video-controller.js
 * Manages speed control and playback for all detected videos
 * ~220 lines
 */

class VideoController {
    constructor(instance) {
        this.instance = instance;
        this.videoCleanups = new WeakMap();
        this.rateCorrections = new WeakMap();
    }

    applyNativePlaybackRate(video, rate) {
        if (!video) return;
        if (Math.abs(video.playbackRate - rate) < 0.0001) return;
        try {
            const descriptor = Object.getOwnPropertyDescriptor(
                HTMLMediaElement.prototype,
                'playbackRate'
            );
            if (descriptor && typeof descriptor.set === 'function') {
                descriptor.set.call(video, rate);
            } else {
                video.playbackRate = rate;
            }
        } catch (error) {
            console.warn('Unable to apply video playback speed:', error);
        }
    }

    setupVideo(video) {
        if (this.instance.videos.has(video)) return;

        // Clean up previous listeners if video element is being recycled
        const prevCleanup = this.videoCleanups.get(video);
        if (prevCleanup) {
            prevCleanup();
            this.videoCleanups.delete(video);
        }

        this.instance.videos.add(video);

        if (!this.instance.videoIdMap.has(video)) {
            this.instance.videoIdMap.set(video, `v${this.instance.videoIdCounter++}`);
        }

        const abortController = new AbortController();
        const { signal } = abortController;

        const setupSpeed = () => {
            if (this.instance.currentSpeed !== null && this.instance.initialized) {
                this.instance._settingSpeed = true;
                this.applyNativePlaybackRate(video, this.instance.currentSpeed);
                this.instance._settingSpeed = false;
            }
        };

        if (video.readyState >= 1 && this.instance.initialized) {
            setupSpeed();
        }

        video.addEventListener('loadedmetadata', setupSpeed, { signal });
        video.addEventListener('loadeddata', setupSpeed, { signal });
        video.addEventListener('canplay', setupSpeed, { signal });

        // Listen for internal rate changes
        video.addEventListener(
            'ratechange',
            () => {
                const externalSpeed = video.playbackRate;
                if (Math.abs(externalSpeed - this.instance.currentSpeed) > 0.0001) {
                    const now = Date.now();
                    const correction = this.rateCorrections.get(video) || { last: 0, timer: null };
                    this.rateCorrections.set(video, correction);
                    if (now - correction.last < 500) {
                        if (!correction.timer) {
                            correction.timer = setTimeout(() => {
                                correction.timer = null;
                                if (!video.isConnected || this.instance.isOrphaned) return;
                                correction.last = Date.now();
                                this.applyNativePlaybackRate(video, this.instance.currentSpeed);
                            }, 500 - (now - correction.last));
                        }
                        return;
                    }
                    correction.last = now;
                    this.applyNativePlaybackRate(video, this.instance.currentSpeed);
                }
            },
            { signal }
        );

        video.addEventListener(
            'play',
            () => {
                setupSpeed();
                this.instance.markVideoInteraction(video);
            },
            { signal }
        );
        video.addEventListener(
            'playing',
            () => {
                setupSpeed();
                this.instance.markVideoInteraction(video);
            },
            { signal }
        );
        video.addEventListener('seeking', () => this.instance.markVideoInteraction(video), {
            signal,
        });

        let cleanupObserver = null;
        if (video.parentNode) {
            cleanupObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.removedNodes.forEach((node) => {
                        if (node === video || (node.contains && node.contains(video))) {
                            this.cleanupVideo(video);
                        }
                    });
                });
            });
            cleanupObserver.observe(video.parentNode, { childList: true, subtree: true });
        }

        this.videoCleanups.set(video, () => {
            abortController.abort();
            if (cleanupObserver) {
                cleanupObserver.disconnect();
                cleanupObserver = null;
            }
        });
    }

    cleanupVideo(video) {
        if (!video) return;
        const correction = this.rateCorrections.get(video);
        if (correction?.timer) clearTimeout(correction.timer);
        this.rateCorrections.delete(video);
        this.instance.videos.delete(video);
        const cleanup = this.videoCleanups.get(video);
        if (cleanup) {
            cleanup();
            this.videoCleanups.delete(video);
        }
        if (this.instance.ui && typeof this.instance.ui.hideIndicator === 'function') {
            this.instance.ui.hideIndicator(video);
        }
    }

    updateAllVideoSpeeds() {
        this.instance._settingSpeed = true;
        const staleVideos = [];
        this.instance.videos.forEach((video) => {
            if (!video || !video.isConnected) {
                staleVideos.push(video);
                return;
            }
            if (video) {
                this.applyNativePlaybackRate(video, this.instance.currentSpeed);
            }
        });
        staleVideos.forEach((video) => this.cleanupVideo(video));
        this.instance._settingSpeed = false;
    }

    showSpeedOverlayIndicator(force = false) {
        if (!this.instance.ui || this.instance.videos.size === 0) return;
        if (!force && !this.instance.settings.showSpeedOverlay) return;

        const connectedVideos = [...this.instance.videos].filter(
            (video) => video && video.isConnected
        );
        if (connectedVideos.length === 0) return;

        // Pick best video: prefer actively playing, then most recent interaction
        let activeVideo = connectedVideos[0];
        let bestScore = -Infinity;

        for (const video of connectedVideos) {
            const ts = this.instance.videoInteractionTs.get(video) || 0;
            const isPlaying = !video.paused && !video.ended;
            const fullscreen = document.fullscreenElement;
            const score = (fullscreen && (fullscreen === video || fullscreen.contains(video)) ? 1e16 : 0) + (isPlaying ? 1e15 : 0) + ts;
            if (score > bestScore) {
                bestScore = score;
                activeVideo = video;
            }
        }

        this.instance.ui.showIndicator(activeVideo, activeVideo.playbackRate);
    }

    increaseSpeed() {
        const step = parseFloat(this.instance.settings.speedStep) || 0.25;
        const maxSpeed = parseFloat(this.instance.settings.maxPlaybackSpeed) || 16.0;
        let newSpeed = this.instance.currentSpeed + step;
        newSpeed = Math.round(newSpeed * 100) / 100;

        if (newSpeed <= maxSpeed) this.setSpeed(newSpeed);
        else this.setSpeed(maxSpeed);
    }

    decreaseSpeed() {
        const step = parseFloat(this.instance.settings.speedStep) || 0.25;
        let newSpeed = this.instance.currentSpeed - step;
        newSpeed = Math.round(newSpeed * 100) / 100;

        if (newSpeed >= 0.05) this.setSpeed(newSpeed);
        else this.setSpeed(0.05);
    }

    resetSpeed() {
        const defaultSpeed = parseFloat(this.instance.settings.defaultPlaybackSpeed) || 1.0;
        this.setSpeed(defaultSpeed);
    }

    setSpeed(speed) {
        const maxSpeed = this.instance.settings.maxPlaybackSpeed || 16.0;
        const clampedSpeed = Math.max(0.05, Math.min(maxSpeed, speed));
        this.instance.currentSpeed = Math.round(clampedSpeed * 100) / 100;

        this.updateAllVideoSpeeds();
        this.showSpeedOverlayIndicator();
        this.instance.saveCurrentSpeed();
    }

    async controlPlayback(action, videoId, value) {
        const video = this.getVideoById(videoId);
        if (!video) {
            return { success: false, error: chrome.i18n.getMessage('videoNotFound') };
        }

        const stepSeconds = this.instance.getControllerSkipPaceSeconds();
        const skipSeconds = Math.max(stepSeconds * 3, 10);

        try {
            switch (action) {
                case 'toggle-play':
                    if (video.paused) await video.play();
                    else video.pause();
                    return { success: true, paused: video.paused };
                case 'pause':
                    video.pause();
                    break;
                case 'play':
                    await video.play();
                    break;
                case 'skip-forward':
                    video.currentTime = Math.min(
                        Number.isFinite(video.duration)
                            ? video.duration
                            : video.currentTime + skipSeconds,
                        video.currentTime + skipSeconds
                    );
                    break;
                case 'step-forward':
                    video.currentTime = Math.min(
                        Number.isFinite(video.duration)
                            ? video.duration
                            : video.currentTime + stepSeconds,
                        video.currentTime + stepSeconds
                    );
                    break;
                case 'skip-back':
                    video.currentTime = Math.max(0, video.currentTime - skipSeconds);
                    break;
                case 'step-back':
                    video.currentTime = Math.max(0, video.currentTime - stepSeconds);
                    break;
                case 'seek': {
                    const target = Number(value);
                    if (!Number.isFinite(target)) {
                        return {
                            success: false,
                            error: chrome.i18n.getMessage('invalidSeekValue'),
                        };
                    }
                    const maxSeek = Number.isFinite(video.duration) ? video.duration : target;
                    video.currentTime = Math.max(0, Math.min(maxSeek, target));
                    break;
                }
                default:
                    return { success: false, error: chrome.i18n.getMessage('unknownAction') };
            }
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message || chrome.i18n.getMessage('playbackControlFailed'),
            };
        }
    }

    getVideoById(videoId) {
        const connectedVideos = [];

        for (const video of this.instance.videos) {
            if (!video || !video.isConnected) continue;
            connectedVideos.push(video);
            if (this.instance.videoIdMap.get(video) === videoId) {
                return video;
            }
        }

        if (connectedVideos.length > 0) {
            const recentVideo = connectedVideos.find((video) =>
                this.instance.hasRecentVideoInteraction(video)
            );
            return (
                recentVideo ||
                connectedVideos.find((video) => !video.paused && !video.ended) ||
                connectedVideos[0]
            );
        }

        return null;
    }
}
