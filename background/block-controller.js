'use strict';

/**
 * Block controller for managing site blocking logic
 * Handles redirect mechanisms and temporary access
 */
class BlockController {
    constructor() {
        this.temporaryAccess = new Map(); // domain -> expiry timestamp
        this.TEMP_ACCESS_DURATION = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Check if domain is currently blocked
     * @param {string} domain - Domain to check
     * @returns {Promise<boolean>} True if blocked
     */
    async isBlocked(domain) {
        try {
            // Check temporary access first
            if (this.hasTemporaryAccess(domain)) {
                return false;
            }

            // Check block list
            const result = await chrome.storage.local.get('blockList');
            const blockList = result.blockList || [];
            return blockList.includes(domain);
        } catch (error) {
            console.error('Error checking block status:', error);
            return false;
        }
    }

    /**
     * Grant temporary access to blocked domain
     * @param {string} domain - Domain to grant access
     * @param {number} duration - Duration in milliseconds (default: 5 minutes)
     */
    grantTemporaryAccess(domain, duration = this.TEMP_ACCESS_DURATION) {
        const expiry = Date.now() + duration;
        this.temporaryAccess.set(domain, expiry);
        
        // Set timeout to clean up expired access
        setTimeout(() => {
            this.cleanupExpiredAccess();
        }, duration);
    }

    /**
     * Check if domain has temporary access
     * @param {string} domain - Domain to check
     * @returns {boolean} True if has temporary access
     */
    hasTemporaryAccess(domain) {
        const expiry = this.temporaryAccess.get(domain);
        if (!expiry) return false;
        
        if (Date.now() >= expiry) {
            this.temporaryAccess.delete(domain);
            return false;
        }
        
        return true;
    }

    /**
     * Get remaining temporary access time
     * @param {string} domain - Domain to check
     * @returns {number} Remaining time in milliseconds
     */
    getRemainingAccessTime(domain) {
        const expiry = this.temporaryAccess.get(domain);
        if (!expiry) return 0;
        
        const remaining = expiry - Date.now();
        return remaining > 0 ? remaining : 0;
    }

    /**
     * Revoke temporary access for domain
     * @param {string} domain - Domain to revoke access
     */
    revokeTemporaryAccess(domain) {
        this.temporaryAccess.delete(domain);
    }

    /**
     * Clean up expired temporary access entries
     */
    cleanupExpiredAccess() {
        const now = Date.now();
        for (const [domain, expiry] of this.temporaryAccess.entries()) {
            if (now >= expiry) {
                this.temporaryAccess.delete(domain);
            }
        }
    }

    /**
     * Handle block page interactions
     * @param {Object} message - Message from block page
     * @returns {Object} Response object
     */
    async handleBlockPageMessage(message) {
        const { type, domain, originalUrl } = message;
        
        switch (type) {
            case 'REQUEST_TEMP_ACCESS':
                this.grantTemporaryAccess(domain);
                return { 
                    success: true, 
                    redirectUrl: originalUrl,
                    duration: this.TEMP_ACCESS_DURATION / 1000 / 60 // minutes
                };
                
            case 'REMOVE_FROM_BLOCKLIST':
                try {
                    const result = await chrome.storage.local.get('blockList');
                    const blockList = result.blockList || [];
                    const updatedList = blockList.filter(d => d !== domain);
                    await chrome.storage.local.set({ blockList: updatedList });
                    return { success: true, redirectUrl: originalUrl };
                } catch (error) {
                    return { success: false, error: error.message };
                }
                
            case 'GO_BACK':
                return { success: true, action: 'goBack' };
                
            default:
                return { success: false, error: 'Unknown message type' };
        }
    }

    /**
     * Check if user should be redirected to block page
     * @param {string} url - URL being visited
     * @returns {Promise<Object>} Redirect info or null
     */
    async shouldRedirectToBlockPage(url) {
        try {
            // Extract domain from URL
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace(/^www\./, '');
            
            // Check if domain is blocked
            if (await this.isBlocked(domain)) {
                return {
                    shouldBlock: true,
                    domain,
                    originalUrl: url,
                    blockPageUrl: chrome.runtime.getURL('block/block.html') + 
                        `?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(url)}`
                };
            }
            
            return { shouldBlock: false };
        } catch (error) {
            console.error('Error checking redirect:', error);
            return { shouldBlock: false };
        }
    }

    /**
     * Get block statistics for domain
     * @param {string} domain - Domain to get stats for
     * @returns {Promise<Object>} Block statistics
     */
    async getBlockStats(domain) {
        try {
            const result = await chrome.storage.local.get('blockStats');
            const stats = result.blockStats || {};
            const domainStats = stats[domain] || {
                totalBlocks: 0,
                lastBlocked: null,
                tempAccessUsed: 0
            };
            
            return domainStats;
        } catch (error) {
            console.error('Error getting block stats:', error);
            return {
                totalBlocks: 0,
                lastBlocked: null,
                tempAccessUsed: 0
            };
        }
    }

    /**
     * Record block event for statistics
     * @param {string} domain - Domain that was blocked
     */
    async recordBlockEvent(domain) {
        try {
            const result = await chrome.storage.local.get('blockStats');
            const stats = result.blockStats || {};
            
            if (!stats[domain]) {
                stats[domain] = {
                    totalBlocks: 0,
                    lastBlocked: null,
                    tempAccessUsed: 0
                };
            }
            
            stats[domain].totalBlocks++;
            stats[domain].lastBlocked = new Date().toISOString();
            
            await chrome.storage.local.set({ blockStats: stats });
        } catch (error) {
            console.error('Error recording block event:', error);
        }
    }

    /**
     * Record temporary access usage for statistics
     * @param {string} domain - Domain that was given temporary access
     */
    async recordTempAccessUsage(domain) {
        try {
            const result = await chrome.storage.local.get('blockStats');
            const stats = result.blockStats || {};
            
            if (!stats[domain]) {
                stats[domain] = {
                    totalBlocks: 0,
                    lastBlocked: null,
                    tempAccessUsed: 0
                };
            }
            
            stats[domain].tempAccessUsed++;
            
            await chrome.storage.local.set({ blockStats: stats });
        } catch (error) {
            console.error('Error recording temp access usage:', error);
        }
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlockController;
}
