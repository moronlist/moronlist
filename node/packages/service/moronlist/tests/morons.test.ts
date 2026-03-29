/**
 * Moron list CRUD integration tests
 */

import { expect } from "chai";
import request from "supertest";
import { getApp, getRepos, resetDatabase, createTestUser, createAuthToken } from "./setup.js";

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

    it("validates visibility enum (rejects bogus value)", async () => {
      const { token } = createTestUser();

      const res = await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          platform: "x",
          slug: "bad-vis",
          name: "Bad Visibility",
          visibility: "bogus",
        })
        .expect(400);

      expect(res.body.error).to.equal("Validation error");
    });

    it("creates list with visibility unlisted", async () => {
      const { token } = createTestUser();

      const res = await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          platform: "x",
          slug: "unlisted-list",
          name: "Unlisted List",
          visibility: "unlisted",
        })
        .expect(201);

      expect(res.body.list.visibility).to.equal("unlisted");
    });

    it("creates list with visibility private", async () => {
      const { token } = createTestUser();

      const res = await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          platform: "x",
          slug: "private-list",
          name: "Private List",
          visibility: "private",
        })
        .expect(201);

      expect(res.body.list.visibility).to.equal("private");
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

    it("partial update (only name, description unchanged)", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          platform: "x",
          slug: "partial-upd",
          name: "Original Name",
          description: "Original Desc",
        })
        .expect(201);

      const res = await request(getApp())
        .put("/api/morons/x/partial-upd")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "New Name" })
        .expect(200);

      expect(res.body.list.name).to.equal("New Name");
      expect(res.body.list.description).to.equal("Original Desc");
    });

    it("change visibility from public to private", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          platform: "x",
          slug: "vis-change",
          name: "Vis Change",
          visibility: "public",
        })
        .expect(201);

      const res = await request(getApp())
        .put("/api/morons/x/vis-change")
        .set("Authorization", `Bearer ${token}`)
        .send({ visibility: "private" })
        .expect(200);

      expect(res.body.list.visibility).to.equal("private");
    });

    it("returns 401 when unauthenticated", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "noauth-upd", name: "No Auth" })
        .expect(201);

      await request(getApp())
        .put("/api/morons/x/noauth-upd")
        .send({ name: "Hijacked" })
        .expect(401);
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

    it("cascading cleanup: subscriptions are deleted when list is deleted", async () => {
      const { token: ownerToken } = createTestUser({ id: "cascadeowner" });
      const { token: subToken } = createTestUser({ id: "cascadesub" });

      // Create a list
      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platform: "x", slug: "cascade-list", name: "Cascade" })
        .expect(201);

      // Subscribe to it
      await request(getApp())
        .post("/api/subscriptions")
        .set("Authorization", `Bearer ${subToken}`)
        .send({ moronListId: "x/cascade-list" })
        .expect(201);

      // Verify subscription exists
      const subsBefore = await request(getApp())
        .get("/api/me/subscriptions")
        .set("Authorization", `Bearer ${subToken}`)
        .expect(200);
      expect(subsBefore.body.subscriptions).to.have.lengthOf(1);

      // Delete the list
      await request(getApp())
        .delete("/api/morons/x/cascade-list")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      // Verify subscription is gone
      const subsAfter = await request(getApp())
        .get("/api/me/subscriptions")
        .set("Authorization", `Bearer ${subToken}`)
        .expect(200);
      expect(subsAfter.body.subscriptions).to.have.lengthOf(0);
    });

    it("cascading cleanup: changelog entries are deleted when list is deleted", async () => {
      const { token: ownerToken } = createTestUser({ id: "casclogowner" });

      // Create a list and add entries
      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platform: "x", slug: "casclog-list", name: "Cascade Log" })
        .expect(201);

      await request(getApp())
        .post("/api/morons/x/casclog-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "user1" }, { platformUserId: "user2" }])
        .expect(201);

      // Delete the list
      await request(getApp())
        .delete("/api/morons/x/casclog-list")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      // Re-create the list with the same slug and verify no old entries carry over
      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platform: "x", slug: "casclog-list", name: "Cascade Log v2" })
        .expect(201);

      // Adding the same entries should succeed with added=2 (not skipped as duplicates)
      const res = await request(getApp())
        .post("/api/morons/x/casclog-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "user1" }, { platformUserId: "user2" }])
        .expect(201);

      expect(res.body.added).to.equal(2);
      expect(res.body.skipped).to.equal(0);
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

    it("forked list has entries and saints copied from source", async () => {
      const { token } = createTestUser({ id: "forkcount_owner" });
      const { token: forkerToken } = createTestUser({ id: "forkcount_forker" });

      // Create source list
      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "count-source", name: "Count Source" })
        .expect(201);

      // Add entries and saints
      await request(getApp())
        .post("/api/morons/x/count-source/entries")
        .set("Authorization", `Bearer ${token}`)
        .send([{ platformUserId: "m1" }, { platformUserId: "m2" }, { platformUserId: "m3" }])
        .expect(201);

      await request(getApp())
        .post("/api/morons/x/count-source/saints")
        .set("Authorization", `Bearer ${token}`)
        .send([{ platformUserId: "s1" }])
        .expect(201);

      // Fork
      await request(getApp())
        .post("/api/morons/x/count-source/actions/fork")
        .set("Authorization", `Bearer ${forkerToken}`)
        .send({ slug: "count-fork" })
        .expect(201);

      // Check the forked list appears in my lists
      const myListsRes = await request(getApp())
        .get("/api/me/morons")
        .set("Authorization", `Bearer ${forkerToken}`)
        .expect(200);

      const forked = myListsRes.body.lists.find((l: { slug: string }) => l.slug === "count-fork");
      expect(forked).to.not.be.undefined;

      // Verify entries were copied by removing them from the forked list
      const removeEntries = await request(getApp())
        .delete("/api/morons/x/count-fork/entries")
        .set("Authorization", `Bearer ${forkerToken}`)
        .send([{ platformUserId: "m1" }, { platformUserId: "m2" }, { platformUserId: "m3" }])
        .expect(200);

      expect(removeEntries.body.removed).to.equal(3);
      expect(removeEntries.body.skipped).to.equal(0);

      // Verify saints were copied by removing them from the forked list
      const removeSaints = await request(getApp())
        .delete("/api/morons/x/count-fork/saints")
        .set("Authorization", `Bearer ${forkerToken}`)
        .send([{ platformUserId: "s1" }])
        .expect(200);

      expect(removeSaints.body.removed).to.equal(1);
      expect(removeSaints.body.skipped).to.equal(0);
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

    it("cannot fork a private list", async () => {
      const { token: ownerToken } = createTestUser({ id: "privforkowner" });
      const { token: forkerToken } = createTestUser({ id: "privforker" });

      // Create a private list
      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          platform: "x",
          slug: "priv-source",
          name: "Private Source",
          visibility: "private",
        })
        .expect(201);

      const res = await request(getApp())
        .post("/api/morons/x/priv-source/actions/fork")
        .set("Authorization", `Bearer ${forkerToken}`)
        .send({ slug: "priv-fork" })
        .expect(403);

      expect(res.body.code).to.equal("FORBIDDEN");
    });

    it("fork copies parents from source list", async () => {
      const { token } = createTestUser({ id: "forkparowner" });
      const { token: forkerToken } = createTestUser({ id: "forkparforker" });

      // Create parent lists
      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "fp-parent-a", name: "Fork Parent A", visibility: "public" })
        .expect(201);

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "fp-parent-b", name: "Fork Parent B", visibility: "public" })
        .expect(201);

      // Create source list with parents
      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          platform: "x",
          slug: "fp-source",
          name: "Fork Parent Source",
          visibility: "public",
        })
        .expect(201);

      await request(getApp())
        .put("/api/morons/x/fp-source/parents")
        .set("Authorization", `Bearer ${token}`)
        .send({ parents: ["x/fp-parent-a", "x/fp-parent-b"] })
        .expect(200);

      // Fork the source
      await request(getApp())
        .post("/api/morons/x/fp-source/actions/fork")
        .set("Authorization", `Bearer ${forkerToken}`)
        .send({ slug: "fp-forked" })
        .expect(201);

      // Verify the forked list inherited the parents via the repository
      const repos = getRepos();
      const forkedParents = repos.inheritance.findParents("x", "fp-forked");
      expect(forkedParents).to.have.lengthOf(2);
      const parentSlugs = forkedParents.map((p) => p.parentSlug);
      expect(parentSlugs).to.include("fp-parent-a");
      expect(parentSlugs).to.include("fp-parent-b");
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
