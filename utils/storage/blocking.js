'use strict';

function applyStorageBlockingMethods(StorageManager) {
    StorageManager.prototype.getBlockList = async function getBlockList() {
        try {
            const result = await chrome.storage.local.get('blockList');
            return result.blockList || [];
        } catch (error) {
            console.error('Failed to get block list:', error);
            return [];
        }
    };

    StorageManager.prototype.addToBlockList = async function addToBlockList(domain) {
        try {
            const blockList = await this.getBlockList();
            if (!blockList.includes(domain)) {
                blockList.push(domain);
                await chrome.storage.local.set({ blockList });
            }
            return true;
        } catch (error) {
            console.error('Failed to add to block list:', error);
            return false;
        }
    };

    StorageManager.prototype.removeFromBlockList = async function removeFromBlockList(domain) {
        try {
            const blockList = await this.getBlockList();
            const updatedList = blockList.filter((value) => value !== domain);
            await chrome.storage.local.set({ blockList: updatedList });
            return true;
        } catch (error) {
            console.error('Failed to remove from block list:', error);
            return false;
        }
    };

    StorageManager.prototype.incrementBlockCount = async function incrementBlockCount(domain) {
        try {
            const result = await chrome.storage.local.get('usage');
            const usage = result.usage || {};
            const domainUsage = usage[domain] || { cumulative: 0, lastVisit: Date.now() };

            const today = new Date().toDateString();
            if (domainUsage.lastBlockDate !== today) {
                domainUsage.blockedToday = 0;
                domainUsage.lastBlockDate = today;
            }

            domainUsage.blockedToday = (domainUsage.blockedToday || 0) + 1;
            usage[domain] = domainUsage;

            await chrome.storage.local.set({ usage });
            return true;
        } catch (error) {
            console.error('Failed to update block count:', error);
            return false;
        }
    };
}
