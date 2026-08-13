/**
 * Module handling background messaging and local updates for site blocking rules.
 */
export const blockingRuleActions = {
    async addSiteRule(context, domain, ruleType, timeLimitMinutes = 30) {
        if (!domain) {
            context.controller.showWarning('Please enter a domain');
            return;
        }

        const maxCap = context.controller?.settings?.restrictedSliderMax || 120;
        const cappedLimit = Math.max(0, Math.min(timeLimitMinutes, maxCap));

        const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/;
        const cleanDomain = domain
            .toLowerCase()
            .replace(/^(https?:\/\/)?(www\.)?/, '')
            .split('/')[0];

        if (!domainPattern.test(cleanDomain)) {
            context.controller.showWarning('Please enter a valid domain (e.g., facebook.com)');
            return;
        }

        try {
            await chrome.runtime.sendMessage({
                type: 'ADD_SITE_RULE',
                domain: cleanDomain,
                ruleType,
                timeLimitMinutes: cappedLimit,
            });
            await context.loadSiteRules();
            context.controller.showSuccess(`Added ${cleanDomain} to ${ruleType.toLowerCase()} list`);
        } catch (error) {
            console.error('Error adding site rule:', error);
            context.controller.showError('Failed to add site rule');
        }
    },

    async removeSiteRule(context, domain) {
        try {
            await chrome.runtime.sendMessage({
                type: 'REMOVE_SITE_RULE',
                domain,
            });
            await context.loadSiteRules();
            context.controller.showSuccess(`Removed ${domain}`);
        } catch (error) {
            console.error('Error removing site rule:', error);
            context.controller.showError('Failed to remove site rule');
        }
    },

    async loadSiteRules(context) {
        try {
            const [rulesResponse, groups] = await Promise.all([
                chrome.runtime.sendMessage({ type: 'GET_SITE_RULES' }),
                chrome.runtime.sendMessage({ type: 'GET_GROUPS' }).catch(() => []),
            ]);
            context.renderBlockedList(rulesResponse?.blocked || []);
            context.renderRestrictedList(rulesResponse?.restricted || [], groups || []);
            context.controller.updateRestrictedDomains(
                rulesResponse?.restricted ? rulesResponse.restricted.map((r) => r.domain) : []
            );
        } catch (error) {
            console.error('Error loading site rules:', error);
        }
    },
};
