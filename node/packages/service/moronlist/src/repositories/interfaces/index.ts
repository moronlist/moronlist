/**
 * Repository interface definitions
 * All repository types use domain types (camelCase)
 */

import type {
  User,
  UserRole,
  MoronList,
  Visibility,
  ChangelogEntry,
  ChangelogAction,
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
  findAllPublic(): MoronList[];
  create(data: CreateMoronListData): MoronList;
  update(platform: string, slug: string, data: UpdateMoronListData): MoronList;
  incrementVersion(platform: string, slug: string): number;
  updateEntryCounts(platform: string, slug: string, entryDelta: number, saintDelta: number): void;
  delete(platform: string, slug: string): boolean;
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
  findLatestActionForUser(
    platform: string,
    slug: string,
    platformUserId: string
  ): ChangelogEntry | null;
  create(data: CreateChangelogData): ChangelogEntry;
  createBatch(entries: CreateChangelogData[]): ChangelogEntry[];
  deleteAllByList(platform: string, slug: string): number;
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
  inheritance: IInheritanceRepository;
  changelog: IChangelogRepository;
  subscription: ISubscriptionRepository;
};
