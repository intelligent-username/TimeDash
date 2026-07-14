/* global SiteRule, BlockedRule, RestrictedRule, GroupRule, DomainUtils */

/**
 * @file RuleManager - manages all site access rules
 * Central point for evaluating and persisting site policies
 */

/**
 * Manages collection of site access rules
 * Handles persistence and evaluation
 */
class RuleManager {
    static STORAGE_KEY = 'siteRules';

    constructor() {
        /** @type {Map<string, SiteRule>} */
        this.rules = new Map();
        /** @type {GroupRule[]} */
        this.groups = [];
    }

    /**
     * Initialize by loading rules from storage
     */
    async init() {
        await this.loadFromStorage();
        await this.loadGroupsFromStorage();
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
     * @param {object} data - Serialized rule data
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
        const normalizedDomain = DomainUtils.normalizeDomain(domain);
        this.rules.delete(normalizedDomain);
    }

    getRule(domain) {
        const normalizedDomain = DomainUtils.normalizeDomain(domain);
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
     * Save groups to storage
     */
    async saveGroupsToStorage() {
        try {
            const serialized = this.groups.map((g) => g.toJSON());
            await chrome.storage.local.set({ siteGroups: serialized });
        } catch (error) {
            console.error('Error saving groups to storage:', error);
        }
    }

    /**
     * Load groups from storage
     */
    async loadGroupsFromStorage() {
        try {
            const result = await chrome.storage.local.get('siteGroups');
            const stored = result.siteGroups || [];
            this.groups = stored.map((data) => GroupRule.fromJSON(data));
        } catch (error) {
            console.error('Error loading groups from storage:', error);
            this.groups = [];
        }
    }

    /**
     * Find an active group that contains the given domain
     * @param {string} domain - Domain to look up
     * @returns {GroupRule|null}
     */
    getGroupForDomain(domain) {
        const normalized = DomainUtils.normalizeDomain(domain);
        return (
            this.groups.find((g) => !g.deletedAt && g.isEnabled && g.contains(normalized)) || null
        );
    }

    /**
     * Find an active group by name (for duplicate name check)
     * @param {string} name - Group name
     * @returns {GroupRule|null}
     */
    getGroupByName(name) {
        return this.groups.find((g) => !g.deletedAt && g.name === name) || null;
    }

    /**
     * Find an active group containing a domain (for membership validation)
     * @param {string} domain - Domain to check
     * @returns {GroupRule|null}
     */
    getGroupContainingDomain(domain) {
        const normalized = DomainUtils.normalizeDomain(domain);
        return this.groups.find((g) => !g.deletedAt && g.domains.includes(normalized)) || null;
    }

    /**
     * Evaluate whether access to a URL should be blocked
     * Checks individual rules first, then group budgets.
     * @param {string} url - URL to evaluate
     * @param {object} usageStats - Usage statistics {todayTimeSeconds}
     * @param {object} [groupUsageSecondsMap] - Map of groupId -> total seconds used today
     * @returns {{ shouldBlock: boolean, reason: string|null, domain: string, groupName?: string }}
     */
    evaluateAccess(url, usageStats = {}, groupUsageSecondsMap = {}) {
        try {
            const domain = DomainUtils.extractDomain(url);

            // 1. Individual rule check
            const rule = this.getRule(domain);
            if (rule && rule.isEnabled) {
                const result = rule.evaluate(usageStats);
                if (result.shouldBlock) {
                    return { ...result, domain };
                }
            }

            // 2. Group budget check
            const group = this.getGroupForDomain(domain);
            if (group) {
                const groupSeconds = groupUsageSecondsMap[group.id];
                if (groupSeconds !== undefined) {
                    const groupResult = group.evaluate(groupSeconds);
                    if (groupResult.shouldBlock) {
                        return { ...groupResult, domain, groupName: group.name };
                    }
                }
            }

            return { shouldBlock: false, reason: null, domain };
        } catch (error) {
            console.error('Error evaluating access:', error);
            return { shouldBlock: false, reason: null, domain: '' };
        }
    }
}

// Export for use in other modules
