/**
 * @file Base class for site access rules
 * Provides polymorphic interface for evaluating site access policies
 */

/* global DomainUtils */

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
        this.domain = DomainUtils.normalizeDomain(domain);
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
            const domain = urlOrDomain.includes('://')
                ? DomainUtils.extractDomain(urlOrDomain)
                : DomainUtils.normalizeDomain(urlOrDomain);
            return this.domain === domain;
        } catch {
            return false;
        }
    }

    /**
     * Evaluate whether access should be blocked
     * Must be implemented by subclasses
     * @param {object} _usageStats - Usage statistics for the domain
     * @returns {{ shouldBlock: boolean, reason: string }}
     */
    evaluate(_usageStats) {
        throw new Error('evaluate() must be implemented by subclass');
    }

    /**
     * Serialize rule to plain object for storage
     * @returns {object} Serialized rule
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
