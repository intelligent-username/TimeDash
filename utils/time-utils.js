'use strict';

/**
 * Time utility functions for formatting and calculating durations
 */
class TimeUtils {
    /**
     * Format seconds into human-readable time string
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string
     */
    static formatTime(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = seconds % 60;
            
            let result = `${hours}h`;
            if (minutes > 0) result += ` ${minutes}m`;
            if (remainingSeconds > 0) result += ` ${remainingSeconds}s`;
            
            return result;
        }
    }

    /**
     * Format time for display in UI with appropriate precision
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string for UI
     */
    static formatTimeForDisplay(seconds) {
        if (seconds < 60) {
            return `${seconds} seconds`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            
            let result = `${hours} hour${hours !== 1 ? 's' : ''}`;
            if (minutes > 0) {
                result += ` ${minutes} minute${minutes !== 1 ? 's' : ''}`;
            }
            
            return result;
        }
    }

    /**
     * Get current date in YYYY-MM-DD format
     * @returns {string} Current date string
     */
    static getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Get date range for analytics (last N days)
     * @param {number} days - Number of days to include
     * @returns {Array<string>} Array of date strings
     */
    static getDateRange(days) {
        const dates = [];
        const today = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
        }
        
        return dates;
    }

    /**
     * Calculate total time for a domain across all days
     * @param {Object} domainData - Domain usage data
     * @returns {number} Total time in seconds
     */
    static calculateTotalTime(domainData) {
        return domainData.cumulative || 0;
    }

    /**
     * Calculate time for today for a domain
     * @param {Object} domainData - Domain usage data
     * @returns {number} Today's time in seconds
     */
    static calculateTodayTime(domainData) {
        const today = this.getCurrentDate();
        return domainData[today] || 0;
    }

    /**
     * Calculate average daily time for a domain
     * @param {Object} domainData - Domain usage data
     * @param {number} days - Number of days to average over
     * @returns {number} Average daily time in seconds
     */
    static calculateAverageTime(domainData, days = 7) {
        const dateRange = this.getDateRange(days);
        let totalTime = 0;
        let activeDays = 0;
        
        dateRange.forEach(date => {
            if (domainData[date]) {
                totalTime += domainData[date];
                activeDays++;
            }
        });
        
        return activeDays > 0 ? Math.round(totalTime / activeDays) : 0;
    }

    /**
     * Get time remaining until daily limit
     * @param {number} used - Time already used today
     * @param {number} limit - Daily limit in minutes
     * @returns {number} Remaining time in seconds (negative if over limit)
     */
    static getTimeRemaining(used, limit) {
        if (limit === 0) return Infinity; // No limit
        return (limit * 60) - used;
    }

    /**
     * Check if time is within working hours (9 AM - 5 PM)
     * @returns {boolean} True if within working hours
     */
    static isWorkingHours() {
        const now = new Date();
        const hour = now.getHours();
        return hour >= 9 && hour < 17;
    }

    /**
     * Parse time string to seconds
     * @param {string} timeStr - Time string like "1h 30m 45s"
     * @returns {number} Time in seconds
     */
    static parseTimeString(timeStr) {
        const regex = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/;
        const match = timeStr.match(regex);
        
        if (!match) return 0;
        
        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        const seconds = parseInt(match[3]) || 0;
        
        return (hours * 3600) + (minutes * 60) + seconds;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeUtils;
}
