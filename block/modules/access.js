'use strict';

function applyBlockAccessMethods(BlockPageController) {
    BlockPageController.prototype.checkIfStillBlocked = async function checkIfStillBlocked() {
        const accessUrl = this.blockedUrl || `https://${this.blockedDomain}`;
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'CHECK_ACCESS',
                    url: accessUrl,
                    domain: this.blockedDomain,
                });

                if (response && typeof response.shouldBlock === 'boolean') {
                    return response.shouldBlock;
                }
            } catch (error) {
                if (attempt === maxAttempts) {
                    console.error('Error checking access:', error);
                }
            }

            if (attempt < maxAttempts) {
                await this.delay(250 * attempt);
            }
        }

        return true;
    };

    BlockPageController.prototype.delay = function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    };

    BlockPageController.prototype.redirectToOriginalUrl = function redirectToOriginalUrl() {
        try {
            if (!this.blockedUrl) return;
            const normalized = this.blockedUrl.startsWith('http') ? this.blockedUrl : `https://${this.blockedUrl}`;
            const target = new URL(normalized);
            if (!['http:', 'https:'].includes(target.protocol)) return;
            window.location.replace(target.toString());
        } catch (error) {
            console.error('Failed to redirect to original URL:', error);
        }
    };

    BlockPageController.prototype.parseUrlParameters = function parseUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        this.blockedUrl = urlParams.get('url') || '';
        this.blockReason = urlParams.get('reason') || 'blocked';

        if (!this.blockedUrl) {
            const domain = urlParams.get('domain') || 'Unknown Site';
            this.blockedDomain = domain.replace(/^www\./, '');
            return;
        }

        try {
            const url = new URL(this.blockedUrl.startsWith('http') ? this.blockedUrl : `https://${this.blockedUrl}`);
            this.blockedDomain = url.hostname.replace(/^www\./, '');
        } catch {
            this.blockedDomain = this.blockedUrl.replace(/^www\./, '');
        }
    };
}
