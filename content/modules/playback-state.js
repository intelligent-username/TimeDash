/**
 * Playback State - content/modules/playback-state.js
 * Retrieves and filters current playback state of all videos
 * ~180 lines
 */

class PlaybackState {
    constructor(instance) {
        this.instance = instance;
    }

    getPlaybackState() {
        const detector = this.instance.detector;
        detector.findAndSetupVideos(document);
        detector.scanOpenShadowRoots(document);

        const videos = [];

        for (const video of this.instance.videos) {
            if (!video || !video.isConnected) continue;
            const recentInteraction = this.instance.hasRecentVideoInteraction(video);
            if (!this.isLikelyPrimaryVideo(video) && !recentInteraction) continue;
            const hasAudio = this.hasAudioTrack(video);

            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
            const isLive = !Number.isFinite(video.duration) || video.duration === Infinity;
            const hasPlaybackHistory = Boolean(video.played && video.played.length > 0);
            const activeOrLooping = Boolean(!video.paused || video.seeking || video.loop || currentTime > 0);

            if (video.ended) continue;
            if (!hasAudio && !activeOrLooping && !recentInteraction) continue;
            if (video.paused && currentTime <= 0 && !video.seeking && !video.autoplay && !recentInteraction && !hasPlaybackHistory) continue;

            videos.push({
                id: this.instance.videoIdMap.get(video),
                currentTime,
                duration,
                paused: Boolean(video.paused),
                playbackRate: Number(video.playbackRate || 1),
                isLive,
                sourceLabel: this.getVideoSourceLabel()
            });
        }

        return videos;
    }

    isLikelyPrimaryVideo(video) {
        if (!video) return false;

        const rect = typeof video.getBoundingClientRect === 'function'
            ? video.getBoundingClientRect()
            : { width: 0, height: 0 };

        const minWidth = 240;
        const minHeight = 135;
        if (rect.width < minWidth || rect.height < minHeight) return false;

        const style = window.getComputedStyle ? window.getComputedStyle(video) : null;
        if (style) {
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
                return false;
            }
        }

        if (video.loop && video.muted) return false;
        return true;
    }

    hasAudioTrack(video) {
        if (!video) return false;
        if (video.muted || video.volume === 0) return false;

        if (Array.isArray(video.audioTracks) && video.audioTracks.length > 0) return true;
        if (typeof video.audioTracks === 'object' && video.audioTracks && video.audioTracks.length > 0) return true;
        if (video.mozHasAudio === true) return true;
        if (typeof video.webkitAudioDecodedByteCount === 'number' && video.webkitAudioDecodedByteCount > 0) return true;

        return !video.muted && video.volume > 0;
    }

    getVideoSourceLabel() {
        const parseLdJsonAuthor = () => {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of scripts) {
                const raw = (script.textContent || '').trim();
                if (!raw) continue;
                try {
                    const parsed = JSON.parse(raw);
                    const nodes = Array.isArray(parsed) ? parsed : [parsed];
                    for (const node of nodes) {
                        if (!node || typeof node !== 'object') continue;
                        const author = node.author;
                        if (author && typeof author === 'object' && typeof author.name === 'string' && author.name.trim()) {
                            return author.name.trim();
                        }
                    }
                } catch {
                    // Ignore malformed json-ld
                }
            }
            return '';
        };

        // Try author/channel first
        const authorCandidates = [
            'ytd-watch-metadata ytd-channel-name a',
            'ytd-video-owner-renderer ytd-channel-name a',
            '#owner-name a',
            'ytd-channel-name a',
            '#owner #channel-name a',
            '#upload-info #channel-name a',
            '#upload-info #channel-name yt-formatted-string a',
            'meta[name="author"]',
            'meta[property="article:author"]'
        ];

        const ldJsonAuthor = parseLdJsonAuthor();
        if (ldJsonAuthor) return ldJsonAuthor;

        for (const selector of authorCandidates) {
            const element = document.querySelector(selector);
            if (!element) continue;

            if (element.tagName === 'META') {
                const content = (element.getAttribute('content') || '').trim();
                if (content) return content;
            } else {
                const value = (element.textContent || '').trim();
                if (value) return value;
            }
        }

        const siteMeta = document.querySelector('meta[property="og:site_name"]');
        if (siteMeta) {
            const siteName = (siteMeta.getAttribute('content') || '').trim();
            if (siteName) return siteName;
        }

        const host = (window.location.hostname || '').replace(/^www\./, '');
        return host || 'Unknown source';
    }
}
