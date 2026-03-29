/**
 * IndexedDB storage for blocked and sainted user sets.
 *
 * Designed for million-entry scale. Each username is stored as a key
 * in an object store, enabling O(1) lookups without loading the full
 * set into memory.
 *
 * Used by the service worker. Content scripts query via CHECK_USER messages.
 */

const DB_NAME = "moronlist";
const DB_VERSION = 1;
const BLOCKED_STORE = "blocked";
const SAINTED_STORE = "sainted";

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance !== null) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOCKED_STORE)) {
        db.createObjectStore(BLOCKED_STORE);
      }
      if (!db.objectStoreNames.contains(SAINTED_STORE)) {
        db.createObjectStore(SAINTED_STORE);
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(new Error("Failed to open IndexedDB"));
    };
  });
}

function hasKey(storeName: string, key: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    openDB()
      .then((db) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const request = store.getKey(key);
        request.onsuccess = () => {
          resolve(request.result !== undefined);
        };
        request.onerror = () => {
          reject(new Error("IndexedDB getKey failed"));
        };
      })
      .catch(reject);
  });
}

function batchPut(storeName: string, keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    openDB()
      .then((db) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        for (const key of keys) {
          store.put(true, key);
        }
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          reject(new Error("IndexedDB batchPut failed"));
        };
      })
      .catch(reject);
  });
}

function batchDelete(storeName: string, keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    openDB()
      .then((db) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        for (const key of keys) {
          store.delete(key);
        }
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          reject(new Error("IndexedDB batchDelete failed"));
        };
      })
      .catch(reject);
  });
}

function clearStore(storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    openDB()
      .then((db) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          reject(new Error("IndexedDB clear failed"));
        };
      })
      .catch(reject);
  });
}

function countStore(storeName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    openDB()
      .then((db) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const request = store.count();
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(new Error("IndexedDB count failed"));
        };
      })
      .catch(reject);
  });
}

async function replaceStore(storeName: string, keys: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    for (const key of keys) {
      store.put(true, key);
    }
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(new Error("IndexedDB replace failed"));
    };
  });
}

// Public API

export async function isBlocked(username: string): Promise<boolean> {
  return hasKey(BLOCKED_STORE, username.toLowerCase());
}

export async function isSainted(username: string): Promise<boolean> {
  return hasKey(SAINTED_STORE, username.toLowerCase());
}

export async function checkUser(username: string): Promise<{ blocked: boolean; sainted: boolean }> {
  const lower = username.toLowerCase();
  const [blocked, sainted] = await Promise.all([
    hasKey(BLOCKED_STORE, lower),
    hasKey(SAINTED_STORE, lower),
  ]);
  return { blocked, sainted };
}

export async function addBlocked(usernames: string[]): Promise<void> {
  return batchPut(
    BLOCKED_STORE,
    usernames.map((u) => u.toLowerCase())
  );
}

export async function removeBlocked(usernames: string[]): Promise<void> {
  return batchDelete(
    BLOCKED_STORE,
    usernames.map((u) => u.toLowerCase())
  );
}

export async function addSainted(usernames: string[]): Promise<void> {
  return batchPut(
    SAINTED_STORE,
    usernames.map((u) => u.toLowerCase())
  );
}

export async function removeSainted(usernames: string[]): Promise<void> {
  return batchDelete(
    SAINTED_STORE,
    usernames.map((u) => u.toLowerCase())
  );
}

export async function replaceBlocked(usernames: string[]): Promise<void> {
  return replaceStore(
    BLOCKED_STORE,
    usernames.map((u) => u.toLowerCase())
  );
}

export async function replaceSainted(usernames: string[]): Promise<void> {
  return replaceStore(
    SAINTED_STORE,
    usernames.map((u) => u.toLowerCase())
  );
}

export async function clearBlocked(): Promise<void> {
  return clearStore(BLOCKED_STORE);
}

export async function clearSainted(): Promise<void> {
  return clearStore(SAINTED_STORE);
}

export async function getBlockedCount(): Promise<number> {
  return countStore(BLOCKED_STORE);
}

export async function getSaintedCount(): Promise<number> {
  return countStore(SAINTED_STORE);
}
