/**
 * Moron list CRUD integration tests
 */

import { expect } from "chai";
import request from "supertest";
import { getApp, resetDatabase, createTestUser, createAuthToken } from "./setup.js";

describe("Moron list routes", () => {
  beforeEach(() => {
    resetDatabase();
  });

  // =========================================
  // POST /api/morons — create list
  // =========================================

  describe("POST /api/morons", () => {
    it("creates a list", async () => {
      const { token, userId } = createTestUser();

      const res = await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          platform: "x",
          slug: "test-list",
          name: "Test List",
          description: "A test list",
          visibility: "public",
        })
        .expect(201);

      expect(res.body.list).to.include({
        platform: "x",
        slug: "test-list",
        name: "Test List",
        description: "A test list",
        visibility: "public",
        ownerId: userId,
        version: 0,
      });
      expect(res.body.list.id).to.equal("x/test-list");
      expect(res.body.list.forkedFrom).to.be.null;
    });

    it("validates required fields", async () => {
      const { token } = createTestUser();

      const res = await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.error).to.equal("Validation error");
    });

    it("rejects duplicate platform/slug", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "dup-list", name: "First" })
        .expect(201);

      const res = await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "dup-list", name: "Second" })
        .expect(409);

      expect(res.body.code).to.equal("ALREADY_EXISTS");
    });

    it("returns 401 when unauthenticated", async () => {
      await request(getApp())
        .post("/api/morons")
        .send({ platform: "x", slug: "nope", name: "Nope" })
        .expect(401);
    });
  });

  // =========================================
  // PUT /api/morons/:platform/:slug — update list
  // =========================================

  describe("PUT /api/morons/:platform/:slug", () => {
    it("updates a list", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "upd-list", name: "Original" })
        .expect(201);

      const res = await request(getApp())
        .put("/api/morons/x/upd-list")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated", description: "New desc" })
        .expect(200);

      expect(res.body.list.name).to.equal("Updated");
      expect(res.body.list.description).to.equal("New desc");
    });

    it("rejects non-owner update", async () => {
      const { token: ownerToken } = createTestUser({ id: "listowner" });
      const { token: otherToken } = createTestUser({ id: "intruder" });

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platform: "x", slug: "owned-list", name: "Owned" })
        .expect(201);

      const res = await request(getApp())
        .put("/api/morons/x/owned-list")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ name: "Hijacked" })
        .expect(403);

      expect(res.body.code).to.equal("FORBIDDEN");
    });

    it("returns 404 for nonexistent list", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .put("/api/morons/x/nope")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Nope" })
        .expect(404);
    });
  });

  // =========================================
  // DELETE /api/morons/:platform/:slug — delete list
  // =========================================

  describe("DELETE /api/morons/:platform/:slug", () => {
    it("deletes a list", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "del-list", name: "Delete Me" })
        .expect(201);

      const res = await request(getApp())
        .delete("/api/morons/x/del-list")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.deleted).to.be.true;

      // Verify it's gone via /api/me/morons
      const meRes = await request(getApp())
        .get("/api/me/morons")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const slugs = meRes.body.lists.map((l: { slug: string }) => l.slug) as string[];
      expect(slugs).to.not.include("del-list");
    });

    it("rejects non-owner delete", async () => {
      const { token: ownerToken } = createTestUser({ id: "delowner" });
      const { token: otherToken } = createTestUser({ id: "delbystander" });

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platform: "x", slug: "no-del", name: "No Delete" })
        .expect(201);

      const res = await request(getApp())
        .delete("/api/morons/x/no-del")
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(403);

      expect(res.body.code).to.equal("FORBIDDEN");
    });
  });

  // =========================================
  // POST /api/morons/:platform/:slug/actions/fork — fork list
  // =========================================

  describe("POST /api/morons/:platform/:slug/actions/fork", () => {
    it("forks a list, copying entries and saints via changelog", async () => {
      const { token } = createTestUser({ id: "forkowner" });
      const { token: forkerToken, userId: forkerId } = createTestUser({ id: "forker" });

      // Create source list
      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "source-list", name: "Source" })
        .expect(201);

      // Add entries to source via new array-body API
      await request(getApp())
        .post("/api/morons/x/source-list/entries")
        .set("Authorization", `Bearer ${token}`)
        .send([{ platformUserId: "moron1", reason: "Being bad" }])
        .expect(201);

      // Add a saint to source via new array-body API
      await request(getApp())
        .post("/api/morons/x/source-list/saints")
        .set("Authorization", `Bearer ${token}`)
        .send([{ platformUserId: "saint1", reason: "Being good" }])
        .expect(201);

      // Fork it
      const res = await request(getApp())
        .post("/api/morons/x/source-list/actions/fork")
        .set("Authorization", `Bearer ${forkerToken}`)
        .send({ slug: "forked-list", name: "My Fork" })
        .expect(201);

      expect(res.body.list.slug).to.equal("forked-list");
      expect(res.body.list.name).to.equal("My Fork");
      expect(res.body.list.ownerId).to.equal(forkerId);
      expect(res.body.list.forkedFrom).to.equal("x/source-list");

      // Verify the forked list appears in the forker's owned lists
      const meRes = await request(getApp())
        .get("/api/me/morons")
        .set("Authorization", `Bearer ${forkerToken}`)
        .expect(200);

      const forkedInList = meRes.body.lists.find((l: { slug: string }) => l.slug === "forked-list");
      expect(forkedInList).to.not.be.undefined;
    });

    it("returns 404 when source does not exist", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons/x/nonexistent/actions/fork")
        .set("Authorization", `Bearer ${token}`)
        .send({ slug: "fork-nope" })
        .expect(404);
    });

    it("returns 409 when target slug already exists", async () => {
      const { token } = createTestUser({ id: "forkdup" });

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "orig", name: "Original" })
        .expect(201);

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "taken-slug", name: "Taken" })
        .expect(201);

      await request(getApp())
        .post("/api/morons/x/orig/actions/fork")
        .set("Authorization", `Bearer ${token}`)
        .send({ slug: "taken-slug" })
        .expect(409);
    });
  });

  // =========================================
  // GET /api/me/morons — my lists
  // =========================================

  describe("GET /api/me/morons", () => {
    it("returns the authenticated user's owned lists", async () => {
      const { token, userId } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "my-list-a", name: "List A" })
        .expect(201);

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "my-list-b", name: "List B" })
        .expect(201);

      const res = await request(getApp())
        .get("/api/me/morons")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.lists).to.be.an("array");
      expect(res.body.lists).to.have.lengthOf(2);
      const slugs = res.body.lists.map((l: { slug: string }) => l.slug) as string[];
      expect(slugs).to.include("my-list-a");
      expect(slugs).to.include("my-list-b");
    });

    it("returns empty array when user has no lists", async () => {
      const { token } = createTestUser();

      const res = await request(getApp())
        .get("/api/me/morons")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.lists).to.be.an("array");
      expect(res.body.lists).to.have.lengthOf(0);
    });

    it("returns 401 when unauthenticated", async () => {
      await request(getApp()).get("/api/me/morons").expect(401);
    });
  });

  // =========================================
  // Unlisted visibility
  // =========================================

  describe("unlisted visibility", () => {
    it("unlisted list DOES appear in GET /api/me/morons for the owner", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          platform: "x",
          slug: "unlisted-mine",
          name: "Unlisted Mine",
          visibility: "unlisted",
        })
        .expect(201);

      const res = await request(getApp())
        .get("/api/me/morons")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const slugs = res.body.lists.map((l: { slug: string }) => l.slug) as string[];
      expect(slugs).to.include("unlisted-mine");
    });
  });

  // =========================================
  // Admin/moderator role actions
  // =========================================

  describe("role-based delete", () => {
    it("ROOT user can delete another user's list", async () => {
      const { token: ownerToken } = createTestUser({ id: "roleowner" });
      const { userId: rootId } = createTestUser({ id: "rootuser", role: "ROOT" });
      const rootToken = createAuthToken({ userId: rootId, roles: ["ROOT"] });

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platform: "x", slug: "root-del", name: "Root Delete Target" })
        .expect(201);

      const res = await request(getApp())
        .delete("/api/morons/x/root-del")
        .set("Authorization", `Bearer ${rootToken}`)
        .expect(200);

      expect(res.body.deleted).to.be.true;

      // Verify it's gone via the owner's list
      const meRes = await request(getApp())
        .get("/api/me/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      const slugs = meRes.body.lists.map((l: { slug: string }) => l.slug) as string[];
      expect(slugs).to.not.include("root-del");
    });

    it("ADMIN user can delete another user's list", async () => {
      const { token: ownerToken } = createTestUser({ id: "adminowner" });
      const { userId: adminId } = createTestUser({ id: "adminuser", role: "ADMIN" });
      const adminToken = createAuthToken({ userId: adminId, roles: ["ADMIN"] });

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platform: "x", slug: "admin-del", name: "Admin Delete Target" })
        .expect(201);

      const res = await request(getApp())
        .delete("/api/morons/x/admin-del")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.deleted).to.be.true;
    });

    it("MODERATOR user cannot delete another user's list", async () => {
      const { token: ownerToken } = createTestUser({ id: "modowner" });
      const { userId: modId } = createTestUser({ id: "moduser", role: "MODERATOR" });
      const modToken = createAuthToken({ userId: modId, roles: ["MODERATOR"] });

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platform: "x", slug: "mod-del", name: "Mod Delete Target" })
        .expect(201);

      const res = await request(getApp())
        .delete("/api/morons/x/mod-del")
        .set("Authorization", `Bearer ${modToken}`)
        .expect(403);

      expect(res.body.code).to.equal("FORBIDDEN");
    });

    it("regular USER cannot delete another user's list", async () => {
      const { token: ownerToken } = createTestUser({ id: "regowner" });
      const { token: userToken } = createTestUser({ id: "reguser" });

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platform: "x", slug: "user-del", name: "User Delete Target" })
        .expect(201);

      const res = await request(getApp())
        .delete("/api/morons/x/user-del")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.code).to.equal("FORBIDDEN");
    });
  });
});
