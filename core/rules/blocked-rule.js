'use strict';

/**
 * @fileoverview Blocked rule - completely denies access to a site
 */


/**
 * Rule that completely blocks access to a site
 * No time-based conditions - site is always inaccessible when enabled
 */
class BlockedRule extends SiteRule {
    /**
     * @param {string} domain - The domain to block
     * @param {boolean} isEnabled - Whether the rule is active
     */
    constructor(domain, isEnabled = true) {
        super(domain, SiteRule.TYPES.BLOCKED, isEnabled);
    }

    /**
     * Evaluate access - always blocks when enabled
     * @param {Object} usageStats - Not used for blocked rules
     * @returns {{ shouldBlock: boolean, reason: string }}
     */
    evaluate(usageStats) {
        if (!this.isEnabled) {
            return { shouldBlock: false, reason: null };
        }
        return {
            shouldBlock: true,
            reason: 'blocked',
        };
    }

    /**
     * Create BlockedRule from serialized data
     * @param {Object} data - Serialized rule data
     * @returns {BlockedRule}
     */
    static fromJSON(data) {
        const rule = new BlockedRule(data.domain, data.isEnabled);
        rule.createdAt = data.createdAt || Date.now();
        return rule;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlockedRule;
}
