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
        const sourceLabel = this.getVideoSourceLabel();

        for (const video of this.instance.videos) {
            if (!video || !video.isConnected) continue;
            let videoId = this.instance.videoIdMap.get(video);
            if (!videoId) {
                videoId = `v${this.instance.videoIdCounter++}`;
                this.instance.videoIdMap.set(video, videoId);
            }

            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
            const isLive = !Number.isFinite(video.duration) || video.duration === Infinity;

            if (video.ended) continue;

            const hasKnownTimeline = isLive || duration > 0 || currentTime > 0;
            const isPlayingNow = !video.paused || video.seeking;
            if (!hasKnownTimeline && !isPlayingNow) continue;

            videos.push({
                id: videoId,
                currentTime,
                duration,
                paused: Boolean(video.paused),
                playbackRate: Number(video.playbackRate || 1),
                isLive,
                sourceLabel
            });
        }

        return videos;
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
            '[itemprop="author"]',
            '[itemprop="creator"]',
            '[rel="author"]',
            '.author',
            '.channel',
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

        const twitterSite = document.querySelector('meta[name="twitter:site"]');
        if (twitterSite) {
            const siteName = (twitterSite.getAttribute('content') || '').trim().replace(/^@/, '');
            if (siteName) return siteName;
        }

        const host = (window.location.hostname || '').replace(/^www\./, '');
        return host || 'Unknown source';
    }
}
