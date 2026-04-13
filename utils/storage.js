'use strict';

class StorageManager {
    constructor() {
        this.DEFAULT_SETTINGS = { ...STORAGE_DEFAULT_SETTINGS };
    }
}

applyStorageSettingsMethods(StorageManager);
applyStorageUsageMethods(StorageManager);
applyStorageBlockingMethods(StorageManager);
applyStorageMiscMethods(StorageManager);

// Export for use in other modules
