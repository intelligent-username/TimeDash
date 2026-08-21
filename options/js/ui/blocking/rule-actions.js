/**
 * Module handling background messaging and local updates for site blocking rules.
 */
export const blockingRuleActions = {
    async addSiteRule(context, domain, ruleType, timeLimitMinutes = 30) {
        if (!domain) {
            context.controller.showWarning(chrome.i18n.getMessage('pleaseEnterDomain'));
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
            context.controller.showWarning(chrome.i18n.getMessage('pleaseEnterValidDomain'));
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
            context.controller.showSuccess(
                chrome.i18n.getMessage('addedToList', [cleanDomain, ruleType.toLowerCase()])
            );
        } catch (error) {
            console.error('Error adding site rule:', error);
            context.controller.showError(chrome.i18n.getMessage('failedAddSiteRule'));
        }
    },

    async removeSiteRule(context, domain) {
        try {
            await chrome.runtime.sendMessage({
                type: 'REMOVE_SITE_RULE',
                domain,
            });
            await context.loadSiteRules();
            context.controller.showSuccess(chrome.i18n.getMessage('removedDomain', [domain]));
        } catch (error) {
            console.error('Error removing site rule:', error);
            context.controller.showError(chrome.i18n.getMessage('failedRemoveSiteRule'));
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
