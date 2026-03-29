/**
 * Repository interface definitions
 * All repository types use domain types (camelCase)
 */

import type {
  User,
  UserRole,
  MoronList,
  Visibility,
  MoronEntry,
  SaintEntry,
  ChangelogEntry,
  ChangelogAction,
  FlushState,
  Subscription,
  InheritanceLink,
} from "../../types.js";

// User Repository
export type CreateUserData = {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
};

export type IUserRepository = {
  findById(id: string): User | null;
  findByEmail(email: string): User | null;
  isUserIdAvailable(id: string): boolean;
  create(data: CreateUserData): User;
  update(
    id: string,
    data: { name?: string; role?: UserRole; banned?: boolean; banReason?: string | null }
  ): User;
};

// Moron List Repository
export type CreateMoronListData = {
  platform: string;
  slug: string;
  ownerId: string;
  name: string;
  description?: string;
  visibility: Visibility;
  forkedFromPlatform?: string;
  forkedFromSlug?: string;
};

export type UpdateMoronListData = {
  name?: string;
  description?: string;
  visibility?: Visibility;
};

export type IMoronListRepository = {
  findByPlatformAndSlug(platform: string, slug: string): MoronList | null;
  findByOwnerId(ownerId: string): MoronList[];
  findByPlatform(platform: string, offset: number, limit: number): MoronList[];
  countByPlatform(platform: string): number;
  searchByPlatform(platform: string, query: string, offset: number, limit: number): MoronList[];
  findPopularByPlatform(platform: string, offset: number, limit: number): MoronList[];
  create(data: CreateMoronListData): MoronList;
  update(platform: string, slug: string, data: UpdateMoronListData): MoronList;
  incrementVersion(platform: string, slug: string): number;
  updateEntryCounts(platform: string, slug: string, entryDelta: number, saintDelta: number): void;
  delete(platform: string, slug: string): boolean;
};

// Moron Entry Repository
export type CreateMoronEntryData = {
  listPlatform: string;
  listSlug: string;
  platformUserId: string;
  displayName?: string;
  reason?: string;
  addedById: string;
};

export type IMoronEntryRepository = {
  findById(id: string): MoronEntry | null;
  findByListAndPlatformUser(
    platform: string,
    slug: string,
    platformUserId: string
  ): MoronEntry | null;
  findByList(platform: string, slug: string, offset: number, limit: number): MoronEntry[];
  countByList(platform: string, slug: string): number;
  findAllByList(platform: string, slug: string): MoronEntry[];
  create(data: CreateMoronEntryData): MoronEntry;
  createBatch(entries: CreateMoronEntryData[]): MoronEntry[];
  deleteById(id: string): boolean;
  deleteByPlatformUser(platform: string, slug: string, platformUserId: string): boolean;
  deleteAllByList(platform: string, slug: string): number;
};

// Saint Entry Repository
export type CreateSaintEntryData = {
  listPlatform: string;
  listSlug: string;
  platformUserId: string;
  reason?: string;
  addedById: string;
};

export type ISaintEntryRepository = {
  findById(id: string): SaintEntry | null;
  findByListAndPlatformUser(
    platform: string,
    slug: string,
    platformUserId: string
  ): SaintEntry | null;
  findByList(platform: string, slug: string, offset: number, limit: number): SaintEntry[];
  countByList(platform: string, slug: string): number;
  findAllByList(platform: string, slug: string): SaintEntry[];
  create(data: CreateSaintEntryData): SaintEntry;
  createBatch(entries: CreateSaintEntryData[]): SaintEntry[];
  deleteById(id: string): boolean;
  deleteByPlatformUser(platform: string, slug: string, platformUserId: string): boolean;
  deleteAllByList(platform: string, slug: string): number;
};

// Inheritance Repository
export type IInheritanceRepository = {
  findParents(childPlatform: string, childSlug: string): InheritanceLink[];
  findChildren(parentPlatform: string, parentSlug: string): InheritanceLink[];
  setParents(
    childPlatform: string,
    childSlug: string,
    parents: { platform: string; slug: string }[]
  ): void;
  deleteAllForList(platform: string, slug: string): number;
};

// Changelog Repository
export type CreateChangelogData = {
  listPlatform: string;
  listSlug: string;
  version: number;
  action: ChangelogAction;
  platformUserId: string;
  userId: string;
  reason?: string;
};

export type IChangelogRepository = {
  findByList(
    platform: string,
    slug: string,
    sinceVersion: number | undefined,
    limit: number
  ): ChangelogEntry[];
  findUnflushed(platform: string, slug: string): ChangelogEntry[];
  findLatestActionForUser(
    platform: string,
    slug: string,
    platformUserId: string
  ): ChangelogEntry | null;
  create(data: CreateChangelogData): ChangelogEntry;
  createBatch(entries: CreateChangelogData[]): ChangelogEntry[];
  markFlushed(platform: string, slug: string, upToVersion: number): void;
  deleteAllByList(platform: string, slug: string): number;
};

// Flush State Repository
export type IFlushStateRepository = {
  getState(platform: string, slug: string): FlushState | null;
  updateState(platform: string, slug: string, version: number): void;
};

// Subscription Repository
export type ISubscriptionRepository = {
  findByUser(userId: string): Subscription[];
  findByList(platform: string, slug: string): Subscription[];
  isSubscribed(userId: string, platform: string, slug: string): boolean;
  subscribe(userId: string, platform: string, slug: string): Subscription;
  unsubscribe(userId: string, platform: string, slug: string): boolean;
  deleteAllByList(platform: string, slug: string): number;
  countByList(platform: string, slug: string): number;
};

// Aggregate repositories type
export type Repositories = {
  user: IUserRepository;
  moronList: IMoronListRepository;
  moronEntry: IMoronEntryRepository;
  saintEntry: ISaintEntryRepository;
  inheritance: IInheritanceRepository;
  changelog: IChangelogRepository;
  flushState: IFlushStateRepository;
  subscription: ISubscriptionRepository;
};
