/**
 * Module handling budget groups CRUD operations and undo stack management.
 */
export const groupActions = {
    async createGroup(context, name, domains, limit) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'CREATE_GROUP',
                name,
                domains,
                timeLimitMinutes: limit,
            });
            if (response?.success) {
                await context.loadSiteRules();
                context.controller.showSuccess(`Created group "${name}"`);
            } else {
                context.controller.showWarning(response?.error || 'Failed to create group');
            }
        } catch (error) {
            console.error('Error creating group:', error);
            context.controller.showError('Failed to create group');
        }
    },

    async updateGroupLimit(context, id, limit) {
        try {
            await chrome.runtime.sendMessage({
                type: 'UPDATE_GROUP',
                id,
                timeLimitMinutes: limit,
            });
            await context.loadSiteRules();
        } catch (error) {
            console.error('Error updating group limit:', error);
        }
    },

    async updateGroupIcon(context, id, icon) {
        try {
            await chrome.runtime.sendMessage({
                type: 'UPDATE_GROUP',
                id,
                icon,
            });
        } catch (error) {
            console.error('Error updating group icon:', error);
        }
    },

    async deleteGroup(context, id) {
        try {
            await chrome.runtime.sendMessage({ type: 'DELETE_GROUP', id });
            await context.loadSiteRules();
            context.controller.showSuccess('Group removed');
        } catch (error) {
            console.error('Error deleting group:', error);
        }
    },

    async addDomainToGroup(context, groupId, domain) {
        const cleanDomain = domain
            .toLowerCase()
            .replace(/^www\./, '')
            .trim();
        if (!cleanDomain) return;
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'ADD_DOMAIN_TO_GROUP',
                groupId,
                domain: cleanDomain,
            });
            if (response?.success) {
                if (!context.isUndoing) {
                    if (response.previousGroupId) {
                        context.undoStack.push({
                            type: 'move',
                            domain: cleanDomain,
                            fromGroupId: response.previousGroupId,
                        });
                    } else {
                        context.undoStack.push({ type: 'remove', domain: cleanDomain, groupId });
                    }
                }
                await context.loadSiteRules();
            } else {
                context.controller.showWarning(response?.error || 'Failed to add domain');
            }
        } catch (error) {
            console.error('Error adding domain to group:', error);
        }
    },

    async removeDomainFromGroup(context, groupId, domain) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'REMOVE_DOMAIN_FROM_GROUP',
                groupId,
                domain,
            });
            if (response?.success) {
                if (!context.isUndoing) {
                    context.undoStack.push({ type: 'add', domain, groupId });
                }
                await context.loadSiteRules();
            } else {
                context.controller.showWarning(response?.error || 'Failed to remove domain');
            }
        } catch (error) {
            console.error('Error removing domain from group:', error);
        }
    },

    async undoLastGroupingChange(context) {
        if (context.undoStack.length === 0) {
            context.controller.showWarning('Nothing to undo');
            return;
        }

        const action = context.undoStack.pop();
        context.isUndoing = true;
        try {
            if (action.type === 'remove') {
                await this.removeDomainFromGroup(context, action.groupId, action.domain);
                context.controller.showSuccess(`Undid: Removed ${action.domain} from group`);
            } else if (action.type === 'add') {
                await this.addDomainToGroup(context, action.groupId, action.domain);
                context.controller.showSuccess(`Undid: Re-added ${action.domain} to group`);
            } else if (action.type === 'move') {
                await this.addDomainToGroup(context, action.fromGroupId, action.domain);
                context.controller.showSuccess(`Undid: Moved ${action.domain} back to original group`);
            }
        } catch (error) {
            console.error('Error executing undo:', error);
            context.controller.showError('Failed to undo grouping change');
        } finally {
            context.isUndoing = false;
        }
    },
};
