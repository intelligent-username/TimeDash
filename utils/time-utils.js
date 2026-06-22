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
        if (!seconds || seconds < 0) return '0s';
        const totalSeconds = Math.floor(seconds);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        return `${secs}s`;
    }

    /**
     * Format time for display in UI with appropriate precision
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string for UI
     */
    static formatTimeForDisplay(seconds) {
        return this.formatTime(seconds);
    }

    /**
     * Format seconds as M:SS clock
     * @param {number} seconds - Time in seconds
     * @returns {string} Clock-like string
     */
    static formatClock(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
        const total = Math.floor(seconds);
        const mins = Math.floor(total / 60);
        const secs = total % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    /**
     * Format milliseconds into compact duration
     * @param {number} ms - Time in milliseconds
     * @returns {string} Formatted duration
     */
    static formatMilliseconds(ms) {
        if (!ms || ms < 0) return '0s';
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    }

    /**
     * Get current date in YYYY-MM-DD format (LOCAL timezone)
     * @returns {string} Current date string in local time
     */
    static getCurrentDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Get date range for analytics (last N days) in LOCAL timezone
     * @param {number} days - Number of days to include
     * @returns {Array<string>} Array of date strings in local time
     */
    static getDateRange(days) {
        const dates = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            // Use local date formatting
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            dates.push(`${year}-${month}-${day}`);
        }

        return dates;
    }

    /**
     * Format a Date object to YYYY-MM-DD in LOCAL timezone
     * @param {Date} date - Date object to format
     * @returns {string} Formatted date string
     */
    static formatLocalDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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

        dateRange.forEach((date) => {
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
        return limit * 60 - used;
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

        return hours * 3600 + minutes * 60 + seconds;
    }
}

