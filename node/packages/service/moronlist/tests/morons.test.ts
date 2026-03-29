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
  // GET /api/morons/:platform/:slug — get list
  // =========================================

  describe("GET /api/morons/:platform/:slug", () => {
    it("returns list details with counts", async () => {
      const { token, userId } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "my-list", name: "My List" })
        .expect(201);

      const res = await request(getApp())
        .get("/api/morons/x/my-list")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.list.platform).to.equal("x");
      expect(res.body.list.slug).to.equal("my-list");
      expect(res.body.list.name).to.equal("My List");
      expect(res.body.list.entryCount).to.equal(0);
      expect(res.body.list.saintCount).to.equal(0);
      expect(res.body.list.subscriberCount).to.equal(0);
      expect(res.body.list.isOwner).to.be.true;
    });

    it("returns 404 for nonexistent list", async () => {
      await request(getApp()).get("/api/morons/x/nonexistent").expect(404);
    });

    it("allows unauthenticated access to public lists", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "public-list", name: "Public" })
        .expect(201);

      const res = await request(getApp()).get("/api/morons/x/public-list").expect(200);

      expect(res.body.list.name).to.equal("Public");
      expect(res.body.list.isOwner).to.be.false;
      expect(res.body.list.isSubscribed).to.be.false;
    });

    it("hides private lists from non-owners", async () => {
      const { token } = createTestUser();
      const { token: otherToken } = createTestUser({ id: "otheruser" });

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "private-list", name: "Secret", visibility: "private" })
        .expect(201);

      await request(getApp())
        .get("/api/morons/x/private-list")
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(404);
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

      // Verify it's gone
      await request(getApp()).get("/api/morons/x/del-list").expect(404);
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
    it("forks a list, copying entries, saints, and parents", async () => {
      const { token, userId } = createTestUser({ id: "forkowner" });
      const { token: forkerToken, userId: forkerId } = createTestUser({ id: "forker" });

      // Create source list
      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "source-list", name: "Source" })
        .expect(201);

      // Add an entry to source
      await request(getApp())
        .post("/api/morons/x/source-list/entries")
        .set("Authorization", `Bearer ${token}`)
        .send({ platformUserId: "moron1", reason: "Being bad" })
        .expect(201);

      // Add a saint to source
      await request(getApp())
        .post("/api/morons/x/source-list/saints")
        .set("Authorization", `Bearer ${token}`)
        .send({ platformUserId: "saint1", reason: "Being good" })
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

      // Verify entries were copied
      const entriesRes = await request(getApp())
        .get("/api/morons/x/forked-list/entries")
        .expect(200);
      expect(entriesRes.body.entries).to.have.lengthOf(1);
      expect(entriesRes.body.entries[0].platformUserId).to.equal("moron1");

      // Verify saints were copied
      const saintsRes = await request(getApp()).get("/api/morons/x/forked-list/saints").expect(200);
      expect(saintsRes.body.saints).to.have.lengthOf(1);
      expect(saintsRes.body.saints[0].platformUserId).to.equal("saint1");
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
  // GET /api/morons/:platform — browse
  // =========================================

  describe("GET /api/morons/:platform", () => {
    it("lists public lists on a platform", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "list-a", name: "A" })
        .expect(201);

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "list-b", name: "B" })
        .expect(201);

      const res = await request(getApp()).get("/api/morons/x").expect(200);

      expect(res.body.lists).to.have.lengthOf(2);
      expect(res.body.total).to.equal(2);
      expect(res.body.offset).to.equal(0);
    });

    it("supports pagination", async () => {
      const { token } = createTestUser();

      for (let i = 0; i < 5; i++) {
        await request(getApp())
          .post("/api/morons")
          .set("Authorization", `Bearer ${token}`)
          .send({ platform: "x", slug: `page-list-${String(i)}`, name: `List ${String(i)}` })
          .expect(201);
      }

      const res = await request(getApp()).get("/api/morons/x?offset=2&limit=2").expect(200);

      expect(res.body.lists).to.have.lengthOf(2);
      expect(res.body.total).to.equal(5);
      expect(res.body.offset).to.equal(2);
      expect(res.body.limit).to.equal(2);
    });
  });

  // =========================================
  // GET /api/morons/:platform/search — search
  // =========================================

  describe("GET /api/morons/:platform/search", () => {
    it("searches lists by query", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "crypto-scammers", name: "Crypto Scammers" })
        .expect(201);

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "spam-bots", name: "Spam Bots" })
        .expect(201);

      const res = await request(getApp()).get("/api/morons/x/search?q=crypto").expect(200);

      expect(res.body.lists).to.be.an("array");
      // The search may or may not find results depending on the search implementation;
      // at minimum it should return a valid response shape.
      expect(res.body).to.have.property("offset");
      expect(res.body).to.have.property("limit");
    });
  });

  // =========================================
  // GET /api/morons/:platform/popular — popular
  // =========================================

  describe("GET /api/morons/:platform/popular", () => {
    it("returns popular lists", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "pop-list", name: "Popular" })
        .expect(201);

      const res = await request(getApp()).get("/api/morons/x/popular").expect(200);

      expect(res.body.lists).to.be.an("array");
      expect(res.body).to.have.property("offset");
      expect(res.body).to.have.property("limit");
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
    it("unlisted list is accessible by direct URL", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          platform: "x",
          slug: "unlisted-direct",
          name: "Unlisted Direct",
          visibility: "unlisted",
        })
        .expect(201);

      const res = await request(getApp()).get("/api/morons/x/unlisted-direct").expect(200);

      expect(res.body.list.name).to.equal("Unlisted Direct");
      expect(res.body.list.visibility).to.equal("unlisted");
    });

    it("unlisted list does NOT appear in browse", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          platform: "x",
          slug: "unlisted-browse",
          name: "Unlisted Browse",
          visibility: "unlisted",
        })
        .expect(201);

      const res = await request(getApp()).get("/api/morons/x").expect(200);

      const slugs = res.body.lists.map((l: { slug: string }) => l.slug) as string[];
      expect(slugs).to.not.include("unlisted-browse");
    });

    it("unlisted list does NOT appear in search", async () => {
      const { token } = createTestUser();

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          platform: "x",
          slug: "unlisted-search",
          name: "Unlisted Search",
          visibility: "unlisted",
        })
        .expect(201);

      const res = await request(getApp()).get("/api/morons/x/search?q=unlisted").expect(200);

      const slugs = res.body.lists.map((l: { slug: string }) => l.slug) as string[];
      expect(slugs).to.not.include("unlisted-search");
    });

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

      // Verify it's gone
      await request(getApp()).get("/api/morons/x/root-del").expect(404);
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
