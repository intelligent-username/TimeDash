'use strict';

/**
 * @fileoverview Restricted rule - allows access until a time limit is exceeded
 */


/**
 * Rule that restricts access based on daily time usage
 * Site is accessible until the configured time limit is exceeded
 */
class RestrictedRule extends SiteRule {
    static DEFAULT_LIMIT_MINUTES = 30;

    /**
     * @param {string} domain - The domain to restrict
     * @param {number} timeLimitMinutes - Daily time limit in minutes
     * @param {boolean} isEnabled - Whether the rule is active
     */
    constructor(domain, timeLimitMinutes = RestrictedRule.DEFAULT_LIMIT_MINUTES, isEnabled = true) {
        super(domain, SiteRule.TYPES.RESTRICTED, isEnabled);
        this.timeLimitMinutes = timeLimitMinutes;
    }

    /**
     * Evaluate access based on usage time
     * @param {Object} usageStats - Must contain { todayTimeSeconds }
     * @returns {{ shouldBlock: boolean, reason: string, remainingMinutes?: number }}
     */
    evaluate(usageStats) {
        if (!this.isEnabled) {
            return { shouldBlock: false, reason: null };
        }

        const todayTimeMinutes = (usageStats?.todayTimeSeconds || 0) / 60;
        const remaining = this.timeLimitMinutes - todayTimeMinutes;

        if (todayTimeMinutes >= this.timeLimitMinutes) {
            return {
                shouldBlock: true,
                reason: 'restricted',
                remainingMinutes: 0,
            };
        }

        return {
            shouldBlock: false,
            reason: null,
            remainingMinutes: Math.ceil(remaining),
        };
    }

    /**
     * Serialize rule to plain object for storage
     * @returns {Object} Serialized rule
     */
    toJSON() {
        return {
            ...super.toJSON(),
            timeLimitMinutes: this.timeLimitMinutes,
        };
    }

    /**
     * Create RestrictedRule from serialized data
     * @param {Object} data - Serialized rule data
     * @returns {RestrictedRule}
     */
    static fromJSON(data) {
        const rule = new RestrictedRule(data.domain, data.timeLimitMinutes, data.isEnabled);
        rule.createdAt = data.createdAt || Date.now();
        return rule;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RestrictedRule;
}
