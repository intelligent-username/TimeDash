'use strict';

/**
 * @fileoverview Base class for site access rules
 * Provides polymorphic interface for evaluating site access policies
 */

/**
 * Abstract base class for site access rules
 * All site policies (blocked, restricted) inherit from this
 */
class SiteRule {
    static TYPES = {
        BLOCKED: 'BLOCKED',
        RESTRICTED: 'RESTRICTED',
    };

    /**
     * @param {string} domain - The domain this rule applies to
     * @param {string} type - Rule type (BLOCKED or RESTRICTED)
     * @param {boolean} isEnabled - Whether the rule is active
     */
    constructor(domain, type, isEnabled = true) {
        if (new.target === SiteRule) {
            throw new Error('SiteRule is abstract and cannot be instantiated directly');
        }
        this.domain = domain.toLowerCase().replace(/^www\./, '');
        this.type = type;
        this.isEnabled = isEnabled;
        this.createdAt = Date.now();
    }

    /**
     * Check if this rule matches the given URL/domain
     * @param {string} urlOrDomain - URL or domain to check
     * @returns {boolean} True if rule applies to this URL
     */
    isMatch(urlOrDomain) {
        try {
            let domain;
            if (urlOrDomain.includes('://')) {
                const url = new URL(urlOrDomain);
                domain = url.hostname.toLowerCase().replace(/^www\./, '');
            } else {
                domain = urlOrDomain.toLowerCase().replace(/^www\./, '');
            }
            return this.domain === domain;
        } catch {
            return false;
        }
    }

    /**
     * Evaluate whether access should be blocked
     * Must be implemented by subclasses
     * @param {Object} usageStats - Usage statistics for the domain
     * @returns {{ shouldBlock: boolean, reason: string }}
     */
    evaluate(usageStats) {
        throw new Error('evaluate() must be implemented by subclass');
    }

    /**
     * Serialize rule to plain object for storage
     * @returns {Object} Serialized rule
     */
    toJSON() {
        return {
            domain: this.domain,
            type: this.type,
            isEnabled: this.isEnabled,
            createdAt: this.createdAt,
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SiteRule;
}
