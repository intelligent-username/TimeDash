export const timeUtils = {
    formatTime(seconds) {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    },

    formatDetailedTime(seconds) {
        if (seconds < 60) return `${seconds} seconds`;
        if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            if (remainingSeconds > 0) return `${minutes} minutes, ${remainingSeconds} seconds`;
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        let result = `${hours} hour${hours !== 1 ? 's' : ''}`;
        if (minutes > 0) result += `, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
        return result;
    }
};
