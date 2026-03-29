/**
 * Saint entry endpoint integration tests (changelog-only)
 */

import { expect } from "chai";
import request from "supertest";
import { getApp, resetDatabase, createTestUser } from "./setup.js";

describe("Saint routes", () => {
  let ownerToken: string;

  beforeEach(async () => {
    resetDatabase();
    const owner = createTestUser({ id: "saintowner" });
    ownerToken = owner.token;

    await request(getApp())
      .post("/api/morons")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ platform: "x", slug: "test-list", name: "Test List" })
      .expect(201);
  });

  // =========================================
  // POST /api/morons/:platform/:slug/saints
  // =========================================

  describe("POST /api/morons/x/test-list/saints", () => {
    it("adds a single saint via array body", async () => {
      const res = await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "saint1", reason: "Helpful person" }])
        .expect(201);

      expect(res.body.added).to.equal(1);
      expect(res.body.skipped).to.equal(0);
    });

    it("adds multiple saints in a single call", async () => {
      const res = await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([
          { platformUserId: "bs1", reason: "Great" },
          { platformUserId: "bs2", reason: "Awesome" },
          { platformUserId: "bs3", reason: "Wonderful" },
        ])
        .expect(201);

      expect(res.body.added).to.equal(3);
      expect(res.body.skipped).to.equal(0);
    });

    it("skips duplicates (already sainted)", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "dup_saint" }])
        .expect(201);

      const res = await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "dup_saint" }, { platformUserId: "new_saint" }])
        .expect(201);

      expect(res.body.added).to.equal(1);
      expect(res.body.skipped).to.equal(1);
    });

    it("returns 200 with zero added when all are duplicates", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "onlydup" }])
        .expect(201);

      const res = await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "onlydup" }])
        .expect(200);

      expect(res.body.added).to.equal(0);
      expect(res.body.skipped).to.equal(1);
    });

    it("increments version once per batch, not per item", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "v1" }, { platformUserId: "v2" }, { platformUserId: "v3" }])
        .expect(201);

      const listRes = await request(getApp()).get("/api/morons/x/test-list").expect(200);
      expect(listRes.body.list.version).to.equal(1);
    });

    it("updates saint_count on the list", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "c1" }, { platformUserId: "c2" }])
        .expect(201);

      const listRes = await request(getApp()).get("/api/morons/x/test-list").expect(200);
      expect(listRes.body.list.saintCount).to.equal(2);
    });

    it("rejects non-owner with 403", async () => {
      const { token: otherToken } = createTestUser({ id: "saintintruder" });

      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${otherToken}`)
        .send([{ platformUserId: "saint2" }])
        .expect(403);
    });

    it("returns 401 without auth", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .send([{ platformUserId: "saint3" }])
        .expect(401);
    });

    it("returns 404 for nonexistent list", async () => {
      await request(getApp())
        .post("/api/morons/x/no-such-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "saint4" }])
        .expect(404);
    });
  });

  // =========================================
  // DELETE /api/morons/:platform/:slug/saints
  // =========================================

  describe("DELETE /api/morons/x/test-list/saints", () => {
    it("removes saints via array body", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "remove_saint" }])
        .expect(201);

      const res = await request(getApp())
        .delete("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "remove_saint" }])
        .expect(200);

      expect(res.body.removed).to.equal(1);
      expect(res.body.skipped).to.equal(0);
    });

    it("skips saints not currently on the list", async () => {
      const res = await request(getApp())
        .delete("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "ghost_saint" }])
        .expect(200);

      expect(res.body.removed).to.equal(0);
      expect(res.body.skipped).to.equal(1);
    });

    it("increments version once per batch removal", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "rm1" }, { platformUserId: "rm2" }])
        .expect(201);

      await request(getApp())
        .delete("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "rm1" }, { platformUserId: "rm2" }])
        .expect(200);

      // Version should be 2 (one for add, one for remove)
      const listRes = await request(getApp()).get("/api/morons/x/test-list").expect(200);
      expect(listRes.body.list.version).to.equal(2);
    });

    it("decrements saint_count on the list", async () => {
      // Add 3
      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "d1" }, { platformUserId: "d2" }, { platformUserId: "d3" }])
        .expect(201);

      // Remove 1
      await request(getApp())
        .delete("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "d2" }])
        .expect(200);

      const listRes = await request(getApp()).get("/api/morons/x/test-list").expect(200);
      expect(listRes.body.list.saintCount).to.equal(2);
    });

    it("rejects non-owner with 403", async () => {
      const { token: otherToken } = createTestUser({ id: "delnotowner" });

      await request(getApp())
        .delete("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${otherToken}`)
        .send([{ platformUserId: "saint2" }])
        .expect(403);
    });

    it("returns 401 without auth", async () => {
      await request(getApp())
        .delete("/api/morons/x/test-list/saints")
        .send([{ platformUserId: "saint3" }])
        .expect(401);
    });

    it("returns 404 for nonexistent list", async () => {
      await request(getApp())
        .delete("/api/morons/x/no-such-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "saint4" }])
        .expect(404);
    });
  });

  // =========================================
  // Changelog verification
  // =========================================

  describe("changelog entries for saints", () => {
    it("creates ADD_SAINT changelog when adding", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "cl_saint" }])
        .expect(201);

      const changelogRes = await request(getApp())
        .get("/api/morons/x/test-list/changelog")
        .expect(200);

      expect(changelogRes.body.changelog).to.have.lengthOf(1);
      expect(changelogRes.body.changelog[0].action).to.equal("ADD_SAINT");
      expect(changelogRes.body.changelog[0].platformUserId).to.equal("cl_saint");
    });

    it("creates REMOVE_SAINT changelog when removing", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "rm_saint" }])
        .expect(201);

      await request(getApp())
        .delete("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send([{ platformUserId: "rm_saint" }])
        .expect(200);

      const changelogRes = await request(getApp())
        .get("/api/morons/x/test-list/changelog")
        .expect(200);

      const actions = changelogRes.body.changelog.map(
        (c: { action: string }) => c.action
      ) as string[];
      expect(actions).to.include("ADD_SAINT");
      expect(actions).to.include("REMOVE_SAINT");
    });
  });
});
