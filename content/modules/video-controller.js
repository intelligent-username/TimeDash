/**
 * Video Controller - content/modules/video-controller.js
 * Manages speed control and playback for all detected videos
 * ~220 lines
 */

class VideoController {
    constructor(instance) {
        this.instance = instance;
    }

    setupVideo(video) {
        if (this.instance.videos.has(video)) return;
        this.instance.videos.add(video);

        if (!this.instance.videoIdMap.has(video)) {
            this.instance.videoIdMap.set(video, `v${this.instance.videoIdCounter++}`);
        }

        const setupSpeed = () => {
            if (this.instance.currentSpeed !== null && this.instance.initialized) {
                this.instance._settingSpeed = true;
                video.playbackRate = this.instance.currentSpeed;
                this.instance._settingSpeed = false;
                this.instance.markVideoInteraction(video);
                if (this.instance.ui && this.instance.settings.showSpeedOverlay) {
                    this.instance.ui.showIndicator(video, this.instance.currentSpeed);
                }
            }
        };

        if (video.readyState >= 1 && this.instance.initialized) {
            setupSpeed();
        } else {
            video.addEventListener('loadedmetadata', setupSpeed, { once: true });
        }

        // Listen for internal rate changes
        video.addEventListener('ratechange', () => {
            if (this.instance._settingSpeed) return;

            this.instance.markVideoInteraction(video);
            if (this.instance.ui) {
                this.instance.ui.showIndicator(video, this.instance.currentSpeed);
            }

            const externalSpeed = video.playbackRate;
            if (Math.abs(externalSpeed - this.instance.currentSpeed) > 0.05) {
                this.instance._settingSpeed = true;
                video.playbackRate = this.instance.currentSpeed;
                this.instance._settingSpeed = false;
                if (this.instance.ui) {
                    this.instance.ui.showIndicator(video, this.instance.currentSpeed);
                }
            }
        });

        video.addEventListener('play', () => this.instance.markVideoInteraction(video));
        video.addEventListener('playing', () => this.instance.markVideoInteraction(video));
        video.addEventListener('seeking', () => this.instance.markVideoInteraction(video));

        const cleanupObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === video || (node.contains && node.contains(video))) {
                        this.instance.videos.delete(video);
                        cleanupObserver.disconnect();
                    }
                });
            });
        });

        if (video.parentNode) {
            cleanupObserver.observe(video.parentNode, { childList: true, subtree: true });
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
                video.playbackRate = this.instance.currentSpeed;
                this.instance.markVideoInteraction(video);
            }
        });
        staleVideos.forEach((video) => this.instance.videos.delete(video));
        this.instance._settingSpeed = false;
    }

    showSpeedOverlayIndicator(force = false) {
        if (!this.instance.ui || this.instance.videos.size === 0) return;
        if (!force && !this.instance.settings.showSpeedOverlay) return;

        const detector = this.instance.detector;
        detector.findAndSetupVideos(document);
        detector.scanOpenShadowRoots(document);

        const connectedVideos = [...this.instance.videos].filter((video) => video && video.isConnected);
        if (connectedVideos.length === 0) return;

        const recentVideo = connectedVideos.find((video) => this.instance.hasRecentVideoInteraction(video));
        const activeVideo = recentVideo || connectedVideos.find((video) => !video.paused && !video.ended) || connectedVideos[0];
        this.instance.ui.showIndicator(activeVideo, this.instance.currentSpeed);
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

        if (newSpeed >= 0.25) this.setSpeed(newSpeed);
        else this.setSpeed(0.25);
    }

    resetSpeed() {
        const defaultSpeed = parseFloat(this.instance.settings.defaultPlaybackSpeed) || 1.0;
        this.setSpeed(defaultSpeed);
    }

    setSpeed(speed) {
        const maxSpeed = this.instance.settings.maxPlaybackSpeed || 16.0;
        const clampedSpeed = Math.max(0.25, Math.min(maxSpeed, speed));
        this.instance.currentSpeed = Math.round(clampedSpeed * 100) / 100;

        this.updateAllVideoSpeeds();
        this.showSpeedOverlayIndicator(true);
        this.instance.saveCurrentSpeed();
    }

    async controlPlayback(action, videoId, value) {
        const video = this.getVideoById(videoId);
        if (!video) {
            return { success: false, error: 'Video not found' };
        }

        const stepSeconds = this.instance.getControllerSkipPaceSeconds();
        const skipSeconds = Math.max(stepSeconds * 3, 10);

        try {
            switch (action) {
                case 'toggle-play':
                    if (video.paused) await video.play();
                    else video.pause();
                    break;
                case 'pause':
                    video.pause();
                    break;
                case 'play':
                    await video.play();
                    break;
                case 'skip-forward':
                    video.currentTime = Math.min(
                        Number.isFinite(video.duration) ? video.duration : video.currentTime + skipSeconds,
                        video.currentTime + skipSeconds
                    );
                    break;
                case 'step-forward':
                    video.currentTime = Math.min(
                        Number.isFinite(video.duration) ? video.duration : video.currentTime + stepSeconds,
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
                        return { success: false, error: 'Invalid seek value' };
                    }
                    const maxSeek = Number.isFinite(video.duration) ? video.duration : target;
                    video.currentTime = Math.max(0, Math.min(maxSeek, target));
                    break;
                }
                default:
                    return { success: false, error: 'Unknown action' };
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message || 'Playback control failed' };
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

        if (!videoId && connectedVideos.length > 0) {
            const recentVideo = connectedVideos.find((video) => this.instance.hasRecentVideoInteraction(video));
            return recentVideo || connectedVideos.find((video) => !video.paused && !video.ended) || connectedVideos[0];
        }

        if (connectedVideos.length > 0) {
            const recentVideo = connectedVideos.find((video) => this.instance.hasRecentVideoInteraction(video));
            return recentVideo || connectedVideos.find((video) => !video.paused && !video.ended) || connectedVideos[0];
        }

        return null;
    }
}
