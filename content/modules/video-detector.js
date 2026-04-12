/**
 * Video Detector - content/modules/video-detector.js
 * Handles video discovery and setup
 * ~200 lines
 */

class VideoDetector {
    constructor(instance) {
        this.instance = instance;
        this.mutationObserver = null;
        this.rootObservers = new Set();
        this._deepScanTimer = null;
    }

    setup() {
        this.setupShadowDomHook();
        this.findAndSetupVideos(document);
        this.scanOpenShadowRoots(document);

        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => this.scanNodeForVideos(node));
            });
        });

        const root = document.documentElement || document.body;
        if (root) {
            this.mutationObserver.observe(root, {
                childList: true,
                subtree: true,
            });
        }

        this._deepScanTimer = setInterval(() => {
            if (this.instance.isOrphaned) return;
            this.findAndSetupVideos(document);
            this.scanOpenShadowRoots(document);
        }, 2000);
    }

    findAndSetupVideos(root = document) {
        if (!root || !root.querySelectorAll) return;
        const videos = root.querySelectorAll('video');
        videos.forEach((video) => this.instance.setupVideo(video));
    }

    scanNodeForVideos(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

        if (node.tagName === 'VIDEO') {
            this.instance.setupVideo(node);
        }

        if (node.querySelectorAll) {
            const videos = node.querySelectorAll('video');
            videos.forEach((video) => this.instance.setupVideo(video));
        }

        if (node.shadowRoot) {
            this.findAndSetupVideos(node.shadowRoot);
            this.observeRoot(node.shadowRoot);
            this.scanOpenShadowRoots(node.shadowRoot);
        }
    }

    scanOpenShadowRoots(root = document) {
        if (!root || !root.querySelectorAll) return;
        const hosts = root.querySelectorAll('*');
        hosts.forEach((el) => {
            if (el.shadowRoot) {
                this.findAndSetupVideos(el.shadowRoot);
                this.observeRoot(el.shadowRoot);
            }
        });
    }

    observeRoot(root) {
        if (!root || root.__timedashObserved) return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => this.scanNodeForVideos(node));
            });
        });

        observer.observe(root, { childList: true, subtree: true });
        root.__timedashObserved = true;
        this.rootObservers.add(observer);
    }

    setupShadowDomHook() {
        if (Element.prototype.__timedashPatchedAttachShadow) return;

        const originalAttachShadow = Element.prototype.attachShadow;
        const self = this;

        Element.prototype.attachShadow = function(init) {
            const shadowRoot = originalAttachShadow.call(this, init);
            if (init && init.mode === 'open') {
                self.findAndSetupVideos(shadowRoot);
                self.observeRoot(shadowRoot);
            }
            return shadowRoot;
        };

        Element.prototype.__timedashPatchedAttachShadow = true;
    }

    cleanup() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }

        if (this.rootObservers.size > 0) {
            this.rootObservers.forEach((observer) => observer.disconnect());
            this.rootObservers.clear();
        }

        if (this._deepScanTimer) {
            clearInterval(this._deepScanTimer);
            this._deepScanTimer = null;
        }
    }
}
