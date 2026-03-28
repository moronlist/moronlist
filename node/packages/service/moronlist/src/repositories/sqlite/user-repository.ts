/**
 * User SQLite Repository
 */

import { executeSelect, executeInsert, executeUpdate } from "@tinqerjs/better-sqlite3-adapter";
import { schema, type SQLiteDatabase } from "moronlist-db";
import type { IUserRepository, CreateUserData } from "../interfaces/index.js";
import type { User, UserRole } from "../../types.js";
import { mapUserFromDb } from "../../types.js";

function findById(db: SQLiteDatabase, id: string): User | null {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("user")
        .where((u) => u.id === p.id)
        .select((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          banned: u.banned,
          ban_reason: u.ban_reason,
          created_at: u.created_at,
          updated_at: u.updated_at,
        }))
        .take(1),
    { id }
  );

  const row = rows[0];
  return row !== undefined ? mapUserFromDb(row) : null;
}

function findByEmail(db: SQLiteDatabase, email: string): User | null {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("user")
        .where((u) => u.email === p.email)
        .select((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          banned: u.banned,
          ban_reason: u.ban_reason,
          created_at: u.created_at,
          updated_at: u.updated_at,
        }))
        .take(1),
    { email }
  );

  const row = rows[0];
  return row !== undefined ? mapUserFromDb(row) : null;
}

function isUserIdAvailable(db: SQLiteDatabase, id: string): boolean {
  return findById(db, id) === null;
}

function create(db: SQLiteDatabase, data: CreateUserData): User {
  const now = new Date().toISOString();
  const role = data.role ?? "USER";

  executeInsert(
    db,
    schema,
    (q, p) =>
      q.insertInto("user").values({
        id: p.id,
        email: p.email,
        name: p.name,
        role: p.role,
        banned: p.banned,
        ban_reason: p.banReason,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }),
    {
      id: data.id,
      email: data.email,
      name: data.name,
      role,
      banned: 0,
      banReason: null as string | null,
      createdAt: now,
      updatedAt: now,
    }
  );

  const user = findById(db, data.id);
  if (user === null) {
    throw new Error("Failed to create user");
  }
  return user;
}

function update(
  db: SQLiteDatabase,
  id: string,
  data: { name?: string; role?: UserRole; banned?: boolean; banReason?: string | null }
): User {
  const now = new Date().toISOString();

  // Read current record and merge with partial update data
  const existing = findById(db, id);
  if (existing === null) {
    throw new Error(`User ${id} not found`);
  }

  const name = data.name ?? existing.name;
  const role = data.role ?? existing.role;
  const banned = data.banned !== undefined ? (data.banned ? 1 : 0) : existing.banned ? 1 : 0;
  const banReason = data.banReason !== undefined ? data.banReason : existing.banReason;

  executeUpdate(
    db,
    schema,
    (q, p) =>
      q
        .update("user")
        .set({
          name: p.name,
          role: p.role,
          banned: p.banned,
          ban_reason: p.banReason,
          updated_at: p.updatedAt,
        })
        .where((u) => u.id === p.id),
    { id, name, role, banned, banReason: banReason, updatedAt: now }
  );

  const user = findById(db, id);
  if (user === null) {
    throw new Error(`User ${id} not found after update`);
  }
  return user;
}

export function createUserRepository(db: SQLiteDatabase): IUserRepository {
  return {
    findById: (id) => findById(db, id),
    findByEmail: (email) => findByEmail(db, email),
    isUserIdAvailable: (id) => isUserIdAvailable(db, id),
    create: (data) => create(db, data),
    update: (id, data) => update(db, id, data),
  };
}
