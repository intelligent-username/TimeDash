'use strict';

function applyAlarmNotificationMethods(AlarmManager) {
    AlarmManager.prototype.checkAndSendQuotaWarnings = async function checkAndSendQuotaWarnings(totalUsage, dailyLimit, percentage) {
        const warnings = await chrome.storage.local.get('quotaWarningsSent');
        const sentWarnings = warnings.quotaWarningsSent || {};
        const today = this.getLocalDateString();

        if (!sentWarnings[today]) {
            sentWarnings[today] = [];
        }

        if (percentage >= 75 && !sentWarnings[today].includes('75')) {
            await this.sendQuotaWarning(75, totalUsage, dailyLimit);
            sentWarnings[today].push('75');
        }

        if (percentage >= 90 && !sentWarnings[today].includes('90')) {
            await this.sendQuotaWarning(90, totalUsage, dailyLimit);
            sentWarnings[today].push('90');
        }

        if (percentage >= 100 && !sentWarnings[today].includes('100')) {
            await this.sendQuotaWarning(100, totalUsage, dailyLimit);
            sentWarnings[today].push('100');
        }

        await chrome.storage.local.set({ quotaWarningsSent: sentWarnings });
    };

    AlarmManager.prototype.sendQuotaWarning = async function sendQuotaWarning(percentage, totalUsage, dailyLimit) {
        const title = percentage >= 100 ? 'Daily Limit Exceeded!' : 'Daily Limit Warning';
        const message =
            percentage >= 100
                ? `You've exceeded your daily limit of ${Math.floor(dailyLimit / 60)} minutes.`
                : `You've used ${percentage}% of your daily limit (${Math.floor(totalUsage / 60)}/${Math.floor(dailyLimit / 60)} minutes).`;

        await chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title,
            message,
        });
    };

    AlarmManager.prototype.sendDailySummaryNotification = async function sendDailySummaryNotification() {
        try {
            const usage = await chrome.storage.local.get('usage');
            const usageData = usage.usage || {};
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = this.getLocalDateString(yesterday);

            let totalYesterdayUsage = 0;
            let topDomain = '';
            let topDomainTime = 0;

            for (const [domain, domainData] of Object.entries(usageData)) {
                const dayUsage = domainData[yesterdayStr] || 0;
                totalYesterdayUsage += dayUsage;

                if (dayUsage > topDomainTime) {
                    topDomainTime = dayUsage;
                    topDomain = domain;
                }
            }

            if (totalYesterdayUsage > 0) {
                const message = `Yesterday: ${Math.floor(totalYesterdayUsage / 60)} minutes total. Top site: ${topDomain} (${Math.floor(topDomainTime / 60)} min)`;
                await chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'TimeDash Daily Summary',
                    message,
                });
            }
        } catch (error) {
            console.error('Error sending daily summary:', error);
        }
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { applyAlarmNotificationMethods };
}
