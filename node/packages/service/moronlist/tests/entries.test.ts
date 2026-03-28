/**
 * Moron entry endpoint integration tests
 */

import { expect } from "chai";
import request from "supertest";
import { getApp, getRepos, resetDatabase, createTestUser } from "./setup.js";

describe("Entry routes", () => {
  let ownerToken: string;
  let ownerId: string;

  beforeEach(async () => {
    resetDatabase();
    const owner = createTestUser({ id: "entryowner" });
    ownerToken = owner.token;
    ownerId = owner.userId;

    // Create a list to work with
    await request(getApp())
      .post("/api/morons")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ platform: "x", slug: "test-list", name: "Test List" })
      .expect(201);
  });

  // =========================================
  // POST /api/morons/:platform/:slug/entries
  // =========================================

  describe("POST /api/morons/x/test-list/entries", () => {
    it("adds an entry and bumps list version", async () => {
      const res = await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "user1", displayName: "User One", reason: "Spamming" })
        .expect(201);

      expect(res.body.entry.platformUserId).to.equal("user1");
      expect(res.body.entry.displayName).to.equal("User One");
      expect(res.body.entry.reason).to.equal("Spamming");
      expect(res.body.entry.id).to.be.a("string");

      // Verify version bumped
      const listRes = await request(getApp()).get("/api/morons/x/test-list").expect(200);
      expect(listRes.body.list.version).to.equal(1);
    });

    it("rejects duplicate platformUserId on the same list", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "dupuser" })
        .expect(201);

      const res = await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "dupuser" })
        .expect(409);

      expect(res.body.error).to.include("already on this list");
    });

    it("rejects non-owner", async () => {
      const { token: otherToken } = createTestUser({ id: "notowner" });

      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ platformUserId: "user2" })
        .expect(403);
    });

    it("returns 401 without auth", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .send({ platformUserId: "user3" })
        .expect(401);
    });

    it("returns 404 for nonexistent list", async () => {
      await request(getApp())
        .post("/api/morons/x/no-such-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "user4" })
        .expect(404);
    });
  });

  // =========================================
  // POST /api/morons/:platform/:slug/entries/batch
  // =========================================

  describe("POST /api/morons/x/test-list/entries/batch", () => {
    it("adds multiple entries in a batch", async () => {
      const res = await request(getApp())
        .post("/api/morons/x/test-list/entries/batch")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          entries: [
            { platformUserId: "batch1", reason: "Bad" },
            { platformUserId: "batch2", reason: "Worse" },
            { platformUserId: "batch3", reason: "Worst" },
          ],
        })
        .expect(201);

      expect(res.body.entries).to.have.lengthOf(3);
      expect(res.body.added).to.equal(3);
      expect(res.body.skipped).to.equal(0);
    });

    it("skips already existing entries", async () => {
      // Add one first
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "existing" })
        .expect(201);

      const res = await request(getApp())
        .post("/api/morons/x/test-list/entries/batch")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          entries: [{ platformUserId: "existing" }, { platformUserId: "newone" }],
        })
        .expect(201);

      expect(res.body.added).to.equal(1);
      expect(res.body.skipped).to.equal(1);
    });

    it("returns 200 with zero added when all are duplicates", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "onlydup" })
        .expect(201);

      const res = await request(getApp())
        .post("/api/morons/x/test-list/entries/batch")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ entries: [{ platformUserId: "onlydup" }] })
        .expect(200);

      expect(res.body.added).to.equal(0);
      expect(res.body.skipped).to.equal(1);
    });
  });

  // =========================================
  // GET /api/morons/:platform/:slug/entries
  // =========================================

  describe("GET /api/morons/x/test-list/entries", () => {
    it("returns paginated entries", async () => {
      // Add some entries
      await request(getApp())
        .post("/api/morons/x/test-list/entries/batch")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          entries: [{ platformUserId: "p1" }, { platformUserId: "p2" }, { platformUserId: "p3" }],
        })
        .expect(201);

      const res = await request(getApp())
        .get("/api/morons/x/test-list/entries?offset=0&limit=2")
        .expect(200);

      expect(res.body.entries).to.have.lengthOf(2);
      expect(res.body.total).to.equal(3);
      expect(res.body.offset).to.equal(0);
      expect(res.body.limit).to.equal(2);
    });

    it("returns 404 for nonexistent list", async () => {
      await request(getApp()).get("/api/morons/x/nope/entries").expect(404);
    });
  });

  // =========================================
  // DELETE /api/morons/:platform/:slug/entries/:id
  // =========================================

  describe("DELETE /api/morons/x/test-list/entries/:id", () => {
    it("removes an entry by id", async () => {
      const createRes = await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "removeme" })
        .expect(201);

      const entryId = createRes.body.entry.id as string;

      const res = await request(getApp())
        .delete(`/api/morons/x/test-list/entries/${entryId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.deleted).to.be.true;

      // Verify it's gone
      const listRes = await request(getApp()).get("/api/morons/x/test-list/entries").expect(200);
      expect(listRes.body.entries).to.have.lengthOf(0);
    });

    it("returns 404 for nonexistent entry", async () => {
      await request(getApp())
        .delete("/api/morons/x/test-list/entries/nonexistent-id")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  // =========================================
  // DELETE /api/morons/:platform/:slug/entries?platformUserId=
  // =========================================

  describe("DELETE /api/morons/x/test-list/entries?platformUserId=", () => {
    it("removes entry by platform user id", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "byplatform" })
        .expect(201);

      const res = await request(getApp())
        .delete("/api/morons/x/test-list/entries?platformUserId=byplatform")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.deleted).to.be.true;
    });

    it("returns 404 when platform user not found", async () => {
      await request(getApp())
        .delete("/api/morons/x/test-list/entries?platformUserId=ghost")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  // =========================================
  // Changelog verification
  // =========================================

  describe("changelog entries", () => {
    it("creates ADD changelog when adding an entry", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "logged_user" })
        .expect(201);

      const changelogRes = await request(getApp())
        .get("/api/morons/x/test-list/changelog")
        .expect(200);

      expect(changelogRes.body.changelog).to.have.lengthOf(1);
      expect(changelogRes.body.changelog[0].action).to.equal("ADD");
      expect(changelogRes.body.changelog[0].platformUserId).to.equal("logged_user");
    });

    it("creates REMOVE changelog when removing an entry", async () => {
      const createRes = await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "removed_user" })
        .expect(201);

      const entryId = createRes.body.entry.id as string;

      await request(getApp())
        .delete(`/api/morons/x/test-list/entries/${entryId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      const changelogRes = await request(getApp())
        .get("/api/morons/x/test-list/changelog")
        .expect(200);

      expect(changelogRes.body.changelog).to.have.lengthOf(2);
      const actions = changelogRes.body.changelog.map(
        (c: { action: string }) => c.action
      ) as string[];
      expect(actions).to.include("ADD");
      expect(actions).to.include("REMOVE");
    });
  });

  // =========================================
  // Changelog query params
  // =========================================

  describe("changelog query params", () => {
    it("GET /api/morons/x/list/changelog returns all entries by default", async () => {
      // Add multiple entries to generate changelog
      await request(getApp())
        .post("/api/morons/x/test-list/entries/batch")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          entries: [
            { platformUserId: "cl_user1" },
            { platformUserId: "cl_user2" },
            { platformUserId: "cl_user3" },
          ],
        })
        .expect(201);

      const res = await request(getApp()).get("/api/morons/x/test-list/changelog").expect(200);

      expect(res.body.changelog).to.be.an("array");
      expect(res.body.changelog).to.have.lengthOf(3);
      expect(res.body.currentVersion).to.be.a("number");
    });

    it("GET /api/morons/x/list/changelog?sinceVersion=N returns only entries after version N", async () => {
      // Add first entry
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "sv_user1" })
        .expect(201);

      // Get the version from changelog (first entry has version 1)
      const cl1 = await request(getApp()).get("/api/morons/x/test-list/changelog").expect(200);
      const versionAfterFirst = cl1.body.changelog[cl1.body.changelog.length - 1].version as number;

      // Add more entries
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "sv_user2" })
        .expect(201);

      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "sv_user3" })
        .expect(201);

      // Get changelog since the first version
      const res = await request(getApp())
        .get(`/api/morons/x/test-list/changelog?sinceVersion=${String(versionAfterFirst)}`)
        .expect(200);

      expect(res.body.changelog).to.be.an("array");
      expect(res.body.changelog).to.have.lengthOf(2);
      // All entries should be after versionAfterFirst
      for (const entry of res.body.changelog as Array<{ version: number }>) {
        expect(entry.version).to.be.greaterThan(versionAfterFirst);
      }
    });

    it("GET /api/morons/x/list/changelog?limit=2 returns limited entries", async () => {
      // Add multiple entries
      await request(getApp())
        .post("/api/morons/x/test-list/entries/batch")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          entries: [
            { platformUserId: "lim_user1" },
            { platformUserId: "lim_user2" },
            { platformUserId: "lim_user3" },
            { platformUserId: "lim_user4" },
          ],
        })
        .expect(201);

      const res = await request(getApp())
        .get("/api/morons/x/test-list/changelog?limit=2")
        .expect(200);

      expect(res.body.changelog).to.be.an("array");
      expect(res.body.changelog).to.have.lengthOf(2);
    });

    it("changelog entries are ordered by version ascending", async () => {
      // Add entries one by one to get distinct versions
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "ord_user1" })
        .expect(201);

      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "ord_user2" })
        .expect(201);

      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "ord_user3" })
        .expect(201);

      const res = await request(getApp()).get("/api/morons/x/test-list/changelog").expect(200);

      const versions = res.body.changelog.map((c: { version: number }) => c.version) as number[];
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i]).to.be.greaterThanOrEqual(versions[i - 1]);
      }
    });
  });
});
