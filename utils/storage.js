'use strict';

/* global STORAGE_DEFAULT_SETTINGS, applyStorageSettingsMethods,
   applyStorageUsageMethods, applyStorageBlockingMethods,
   applyStorageMiscMethods */

let usageWriteChain = Promise.resolve();

function withUsageLock(task) {
    const result = usageWriteChain.then(() => task());
    usageWriteChain = result.catch(() => {});
    return result;
}

class StorageManager {
    constructor() {
        this.DEFAULT_SETTINGS = { ...STORAGE_DEFAULT_SETTINGS };
    }
}

applyStorageSettingsMethods(StorageManager);
applyStorageUsageMethods(StorageManager);
applyStorageBlockingMethods(StorageManager);
applyStorageMiscMethods(StorageManager);