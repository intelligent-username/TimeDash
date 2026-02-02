'use strict';

/**
 * @fileoverview RuleManager - manages all site access rules
 * Central point for evaluating and persisting site policies
 */

// SiteRule, BlockedRule, RestrictedRule are loaded via importScripts in background.js

/**
 * Manages collection of site access rules
 * Handles persistence and evaluation
 */
class RuleManager {
    static STORAGE_KEY = 'siteRules';

    constructor() {
        /** @type {Map<string, SiteRule>} */
        this.rules = new Map();
        this.temporaryAccess = new Map(); // domain -> expiry timestamp
        this.TEMP_ACCESS_DURATION = 5 * 60 * 1000; // 5 minutes default
    }

    /**
     * Initialize by loading rules from storage
     */
    async init() {
        await this.loadFromStorage();
    }

    /**
     * Load rules from chrome storage
     */
    async loadFromStorage() {
        try {
            const result = await chrome.storage.local.get([RuleManager.STORAGE_KEY, 'blockList']);
            const storedRules = result[RuleManager.STORAGE_KEY] || [];

            // Migration: convert old blockList format if needed
            if (result.blockList && result.blockList.length > 0 && storedRules.length === 0) {
                for (const domain of result.blockList) {
                    this.addRule(new BlockedRule(domain));
                }
                await this.saveToStorage();
                // Clear old format after migration
                await chrome.storage.local.remove('blockList');
            } else {
                // Load from new format
                for (const data of storedRules) {
                    const rule = this.deserializeRule(data);
                    if (rule) {
                        this.rules.set(rule.domain, rule);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading rules from storage:', error);
        }
    }

    /**
     * Save rules to chrome storage
     */
    async saveToStorage() {
        try {
            const serialized = Array.from(this.rules.values()).map((rule) => rule.toJSON());
            await chrome.storage.local.set({ [RuleManager.STORAGE_KEY]: serialized });
        } catch (error) {
            console.error('Error saving rules to storage:', error);
        }
    }

    /**
     * Deserialize rule data to appropriate class instance
     * @param {Object} data - Serialized rule data
     * @returns {SiteRule|null}
     */
    deserializeRule(data) {
        switch (data.type) {
            case SiteRule.TYPES.BLOCKED:
                return BlockedRule.fromJSON(data);
            case SiteRule.TYPES.RESTRICTED:
                return RestrictedRule.fromJSON(data);
            default:
                console.warn('Unknown rule type:', data.type);
                return null;
        }
    }

    /**
     * Add a rule
     * @param {SiteRule} rule - Rule to add
     */
    addRule(rule) {
        this.rules.set(rule.domain, rule);
    }

    /**
     * Remove a rule by domain
     * @param {string} domain - Domain to remove
     */
    removeRule(domain) {
        const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
        this.rules.delete(normalizedDomain);
    }

    /**
     * Get a rule by domain
     * @param {string} domain - Domain to look up
     * @returns {SiteRule|undefined}
     */
    getRule(domain) {
        const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
        return this.rules.get(normalizedDomain);
    }

    /**
     * Get all rules of a specific type
     * @param {string} type - Rule type (BLOCKED or RESTRICTED)
     * @returns {SiteRule[]}
     */
    getRulesByType(type) {
        return Array.from(this.rules.values()).filter((rule) => rule.type === type);
    }

    /**
     * Get all blocked domains
     * @returns {string[]}
     */
    getBlockedDomains() {
        return this.getRulesByType(SiteRule.TYPES.BLOCKED).map((r) => r.domain);
    }

    /**
     * Get all restricted domains with their limits
     * @returns {Array<{domain: string, timeLimitMinutes: number}>}
     */
    getRestrictedDomains() {
        return this.getRulesByType(SiteRule.TYPES.RESTRICTED).map((r) => ({
            domain: r.domain,
            timeLimitMinutes: r.timeLimitMinutes,
        }));
    }

    /**
     * Grant temporary access to a domain
     * @param {string} domain - Domain to grant access
     * @param {number} duration - Duration in milliseconds
     */
    grantTemporaryAccess(domain, duration = this.TEMP_ACCESS_DURATION) {
        const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
        const expiry = Date.now() + duration;
        this.temporaryAccess.set(normalizedDomain, expiry);

        setTimeout(() => {
            this.cleanupExpiredAccess();
        }, duration);
    }

    /**
     * Check if domain has temporary access
     * @param {string} domain - Domain to check
     * @returns {boolean}
     */
    hasTemporaryAccess(domain) {
        const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
        const expiry = this.temporaryAccess.get(normalizedDomain);
        if (!expiry) return false;

        if (Date.now() >= expiry) {
            this.temporaryAccess.delete(normalizedDomain);
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
        const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
        const expiry = this.temporaryAccess.get(normalizedDomain);
        if (!expiry) return 0;

        const remaining = expiry - Date.now();
        return remaining > 0 ? remaining : 0;
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
     * Evaluate whether access to a URL should be blocked
     * @param {string} url - URL to evaluate
     * @param {Object} usageStats - Usage statistics {todayTimeSeconds}
     * @returns {{ shouldBlock: boolean, reason: string|null, domain: string }}
     */
    evaluateAccess(url, usageStats = {}) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');

            // Check temporary access first
            if (this.hasTemporaryAccess(domain)) {
                return { shouldBlock: false, reason: null, domain };
            }

            const rule = this.rules.get(domain);
            if (!rule || !rule.isEnabled) {
                return { shouldBlock: false, reason: null, domain };
            }

            const result = rule.evaluate(usageStats);
            return { ...result, domain };
        } catch (error) {
            console.error('Error evaluating access:', error);
            return { shouldBlock: false, reason: null, domain: '' };
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuleManager;
}
