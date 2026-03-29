/**
 * Moron entry endpoint integration tests
 */

import { expect } from "chai";
import request from "supertest";
import { getApp, resetDatabase, createTestUser } from "./setup.js";

describe("Entry routes", () => {
  let ownerToken: string;

  beforeEach(async () => {
    resetDatabase();
    const owner = createTestUser({ id: "entryowner" });
    ownerToken = owner.token;

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
});
