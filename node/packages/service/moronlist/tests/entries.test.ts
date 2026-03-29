/**
 * Moron entry endpoint integration tests (changelog-only)
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
    it("adds a single entry via array body", async () => {
      const res = await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "user1", reason: "Spamming" }])
        .expect(201);

      expect(res.body.added).to.equal(1);
      expect(res.body.skipped).to.equal(0);
    });

    it("adds multiple entries in a single call", async () => {
      const res = await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([
          { platformUserId: "batch1", reason: "Bad" },
          { platformUserId: "batch2", reason: "Worse" },
          { platformUserId: "batch3", reason: "Worst" },
        ])
        .expect(201);

      expect(res.body.added).to.equal(3);
      expect(res.body.skipped).to.equal(0);
    });

    it("skips duplicates (already on the list)", async () => {
      // Add first
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "existing" }])
        .expect(201);

      // Try to add again along with a new one
      const res = await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "existing" }, { platformUserId: "newone" }])
        .expect(201);

      expect(res.body.added).to.equal(1);
      expect(res.body.skipped).to.equal(1);
    });

    it("returns 200 with zero added when all are duplicates", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "onlydup" }])
        .expect(201);

      const res = await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "onlydup" }])
        .expect(200);

      expect(res.body.added).to.equal(0);
      expect(res.body.skipped).to.equal(1);
    });

    it("increments version once per batch, not per item", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "v1" }, { platformUserId: "v2" }, { platformUserId: "v3" }])
        .expect(201);

      const listRes = await request(getApp()).get("/api/morons/x/test-list").expect(200);
      expect(listRes.body.list.version).to.equal(1);
    });

    it("updates entry_count on the list", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "c1" }, { platformUserId: "c2" }])
        .expect(201);

      const listRes = await request(getApp()).get("/api/morons/x/test-list").expect(200);
      expect(listRes.body.list.entryCount).to.equal(2);
    });

    it("rejects non-owner with 403", async () => {
      const { token: otherToken } = createTestUser({ id: "notowner" });

      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${otherToken}`)
        .send([{ platformUserId: "user2" }])
        .expect(403);
    });

    it("returns 401 without auth", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .send([{ platformUserId: "user3" }])
        .expect(401);
    });

    it("returns 404 for nonexistent list", async () => {
      await request(getApp())
        .post("/api/morons/x/no-such-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "user4" }])
        .expect(404);
    });
  });

  // =========================================
  // DELETE /api/morons/:platform/:slug/entries
  // =========================================

  describe("DELETE /api/morons/x/test-list/entries", () => {
    it("removes entries via array body", async () => {
      // Add entries first
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "removeme" }])
        .expect(201);

      const res = await request(getApp())
        .delete("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "removeme" }])
        .expect(200);

      expect(res.body.removed).to.equal(1);
      expect(res.body.skipped).to.equal(0);
    });

    it("skips entries not currently on the list", async () => {
      const res = await request(getApp())
        .delete("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "ghost" }])
        .expect(200);

      expect(res.body.removed).to.equal(0);
      expect(res.body.skipped).to.equal(1);
    });

    it("increments version once per batch removal", async () => {
      // Add entries
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "rm1" }, { platformUserId: "rm2" }])
        .expect(201);

      // Remove them
      await request(getApp())
        .delete("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "rm1" }, { platformUserId: "rm2" }])
        .expect(200);

      // Version should be 2 (one for add, one for remove)
      const listRes = await request(getApp()).get("/api/morons/x/test-list").expect(200);
      expect(listRes.body.list.version).to.equal(2);
    });

    it("decrements entry_count on the list", async () => {
      // Add 3
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "d1" }, { platformUserId: "d2" }, { platformUserId: "d3" }])
        .expect(201);

      // Remove 1
      await request(getApp())
        .delete("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "d2" }])
        .expect(200);

      const listRes = await request(getApp()).get("/api/morons/x/test-list").expect(200);
      expect(listRes.body.list.entryCount).to.equal(2);
    });

    it("rejects non-owner with 403", async () => {
      const { token: otherToken } = createTestUser({ id: "delnotowner" });

      await request(getApp())
        .delete("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${otherToken}`)
        .send([{ platformUserId: "user2" }])
        .expect(403);
    });

    it("returns 401 without auth", async () => {
      await request(getApp())
        .delete("/api/morons/x/test-list/entries")
        .send([{ platformUserId: "user3" }])
        .expect(401);
    });

    it("returns 404 for nonexistent list", async () => {
      await request(getApp())
        .delete("/api/morons/x/no-such-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "user4" }])
        .expect(404);
    });
  });

  // =========================================
  // Changelog verification
  // =========================================

  describe("changelog entries", () => {
    it("creates ADD changelog when adding entries", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "logged_user" }])
        .expect(201);

      const changelogRes = await request(getApp())
        .get("/api/morons/x/test-list/changelog")
        .expect(200);

      expect(changelogRes.body.changelog).to.have.lengthOf(1);
      expect(changelogRes.body.changelog[0].action).to.equal("ADD");
      expect(changelogRes.body.changelog[0].platformUserId).to.equal("logged_user");
    });

    it("creates REMOVE changelog when removing entries", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "removed_user" }])
        .expect(201);

      await request(getApp())
        .delete("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "removed_user" }])
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
    it("GET changelog returns all entries by default", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([
          { platformUserId: "cl_user1" },
          { platformUserId: "cl_user2" },
          { platformUserId: "cl_user3" },
        ])
        .expect(201);

      const res = await request(getApp()).get("/api/morons/x/test-list/changelog").expect(200);

      expect(res.body.changelog).to.be.an("array");
      expect(res.body.changelog).to.have.lengthOf(3);
      expect(res.body.currentVersion).to.be.a("number");
    });

    it("GET changelog?sinceVersion=N returns only entries after version N", async () => {
      // Add first entry (version 1)
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "sv_user1" }])
        .expect(201);

      const cl1 = await request(getApp()).get("/api/morons/x/test-list/changelog").expect(200);
      const versionAfterFirst = cl1.body.changelog[cl1.body.changelog.length - 1].version as number;

      // Add more entries (version 2, 3)
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "sv_user2" }])
        .expect(201);

      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "sv_user3" }])
        .expect(201);

      const res = await request(getApp())
        .get(`/api/morons/x/test-list/changelog?sinceVersion=${String(versionAfterFirst)}`)
        .expect(200);

      expect(res.body.changelog).to.be.an("array");
      expect(res.body.changelog).to.have.lengthOf(2);
      for (const entry of res.body.changelog as Array<{ version: number }>) {
        expect(entry.version).to.be.greaterThan(versionAfterFirst);
      }
    });

    it("GET changelog?limit=2 returns limited entries", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([
          { platformUserId: "lim_user1" },
          { platformUserId: "lim_user2" },
          { platformUserId: "lim_user3" },
          { platformUserId: "lim_user4" },
        ])
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
        .send([{ platformUserId: "ord_user1" }])
        .expect(201);

      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "ord_user2" }])
        .expect(201);

      await request(getApp())
        .post("/api/morons/x/test-list/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "ord_user3" }])
        .expect(201);

      const res = await request(getApp()).get("/api/morons/x/test-list/changelog").expect(200);

      const versions = res.body.changelog.map((c: { version: number }) => c.version) as number[];
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i]).to.be.greaterThanOrEqual(versions[i - 1]);
      }
    });
  });
});
