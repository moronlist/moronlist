/**
 * SQLite Repository Factory
 * Creates all repository implementations for SQLite
 */

import { initTinqerDatabase, type SQLiteDatabase } from "moronlist-db";
import type { Repositories } from "../interfaces/index.js";
import { createUserRepository } from "./user-repository.js";
import { createMoronListRepository } from "./moron-list-repository.js";
import { createMoronEntryRepository } from "./moron-entry-repository.js";
import { createSaintEntryRepository } from "./saint-entry-repository.js";
import { createInheritanceRepository } from "./inheritance-repository.js";
import { createChangelogRepository } from "./changelog-repository.js";
import { createFlushStateRepository } from "./flush-state-repository.js";
import { createSubscriptionRepository } from "./subscription-repository.js";

export function createRepositories(dbPath: string): Repositories {
  const db = initTinqerDatabase({
    type: "sqlite",
    sqlite: { dbPath },
  }) as SQLiteDatabase;

  return {
    user: createUserRepository(db),
    moronList: createMoronListRepository(db),
    moronEntry: createMoronEntryRepository(db),
    saintEntry: createSaintEntryRepository(db),
    inheritance: createInheritanceRepository(db),
    changelog: createChangelogRepository(db),
    flushState: createFlushStateRepository(db),
    subscription: createSubscriptionRepository(db),
  };
}
