/**
 * @file Group budget rule — shared daily time limit across multiple domains
 */

/**
 * A group budget aggregates multiple domains under one collective daily time limit.
 * Does NOT extend SiteRule — groups are a compound concept, not a per-domain rule.
 */
class GroupRule {
    /**
     * @param {object} params
     * @param {string} [params.id] - Unique ID (auto-generated if omitted)
     * @param {string} params.name - Human-readable group name
     * @param {string[]} [params.domains] - Domain list
     * @param {number} [params.timeLimitMinutes] - Daily limit in minutes
     * @param {string} [params.isEnabled] - Whether the group is active
     * @param {string} [params.icon] - Group category icon key
     */
    constructor({
        id,
        name,
        domains = [],
        timeLimitMinutes = 60,
        isEnabled = true,
        icon = 'folder',
    } = {}) {
        this.id = id || crypto.randomUUID();
        this.name = name;
        this.domains = domains.map((d) => d.toLowerCase().replace(/^www\./, ''));
        this.timeLimitMinutes = timeLimitMinutes;
        this.isEnabled = isEnabled;
        this.icon = icon || 'folder';
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
        this.deletedAt = null;
    }

    /**
     * Check if a domain belongs to this group
     * @param {string} domain - Domain to check
     * @returns {boolean}
     */
    contains(domain) {
        const normalized = domain.toLowerCase().replace(/^www\./, '');
        return this.domains.includes(normalized);
    }

    /**
     * Evaluate collective usage against the group limit
     * @param {number} groupUsageSeconds - Total seconds used by all group domains today
     * @returns {{ shouldBlock: boolean, reason: string|null, remainingMinutes: number }}
     */
    evaluate(groupUsageSeconds) {
        if (!this.isEnabled) {
            return { shouldBlock: false, reason: null, remainingMinutes: this.timeLimitMinutes };
        }

        const totalMinutesToday = groupUsageSeconds / 60;
        const remaining = Math.max(0, this.timeLimitMinutes - totalMinutesToday);

        if (totalMinutesToday >= this.timeLimitMinutes) {
            return {
                shouldBlock: true,
                reason: 'restricted_group',
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
     * Serialize to plain object for storage
     * @returns {object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            domains: [...this.domains],
            timeLimitMinutes: this.timeLimitMinutes,
            isEnabled: this.isEnabled,
            icon: this.icon,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            deletedAt: this.deletedAt,
        };
    }

    /**
     * Create GroupRule from serialized data
     * @param {object} data - Serialized group data
     * @returns {GroupRule}
     */
    static fromJSON(data) {
        const group = new GroupRule({
            id: data.id,
            name: data.name,
            domains: data.domains || [],
            timeLimitMinutes: data.timeLimitMinutes,
            isEnabled: data.isEnabled,
            icon: data.icon || 'folder',
        });
        group.createdAt = data.createdAt || Date.now();
        group.updatedAt = data.updatedAt || Date.now();
        group.deletedAt = data.deletedAt !== undefined ? data.deletedAt : null;
        return group;
    }
}
