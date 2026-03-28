/**
 * Saint entry endpoint integration tests
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
    it("adds a saint", async () => {
      const res = await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "saint1", reason: "Helpful person" })
        .expect(201);

      expect(res.body.saint.platformUserId).to.equal("saint1");
      expect(res.body.saint.reason).to.equal("Helpful person");
      expect(res.body.saint.id).to.be.a("string");
    });

    it("rejects duplicate platformUserId", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "dup_saint" })
        .expect(201);

      const res = await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "dup_saint" })
        .expect(409);

      expect(res.body.error).to.include("already on the saint list");
    });

    it("rejects non-owner", async () => {
      const { token: otherToken } = createTestUser({ id: "saintintruder" });

      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ platformUserId: "saint2" })
        .expect(403);
    });
  });

  // =========================================
  // POST /api/morons/:platform/:slug/saints/batch
  // =========================================

  describe("POST /api/morons/x/test-list/saints/batch", () => {
    it("batch adds saints", async () => {
      const res = await request(getApp())
        .post("/api/morons/x/test-list/saints/batch")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          saints: [
            { platformUserId: "bs1", reason: "Great" },
            { platformUserId: "bs2", reason: "Awesome" },
          ],
        })
        .expect(201);

      expect(res.body.saints).to.have.lengthOf(2);
      expect(res.body.added).to.equal(2);
      expect(res.body.skipped).to.equal(0);
    });

    it("skips existing saints in batch", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "existing_saint" })
        .expect(201);

      const res = await request(getApp())
        .post("/api/morons/x/test-list/saints/batch")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          saints: [{ platformUserId: "existing_saint" }, { platformUserId: "new_saint" }],
        })
        .expect(201);

      expect(res.body.added).to.equal(1);
      expect(res.body.skipped).to.equal(1);
    });
  });

  // =========================================
  // GET /api/morons/:platform/:slug/saints
  // =========================================

  describe("GET /api/morons/x/test-list/saints", () => {
    it("returns paginated saints", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/saints/batch")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          saints: [{ platformUserId: "s1" }, { platformUserId: "s2" }, { platformUserId: "s3" }],
        })
        .expect(201);

      const res = await request(getApp())
        .get("/api/morons/x/test-list/saints?offset=0&limit=2")
        .expect(200);

      expect(res.body.saints).to.have.lengthOf(2);
      expect(res.body.total).to.equal(3);
    });
  });

  // =========================================
  // DELETE /api/morons/:platform/:slug/saints/:id
  // =========================================

  describe("DELETE /api/morons/x/test-list/saints/:id", () => {
    it("removes a saint by id", async () => {
      const createRes = await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "remove_saint" })
        .expect(201);

      const saintId = createRes.body.saint.id as string;

      const res = await request(getApp())
        .delete(`/api/morons/x/test-list/saints/${saintId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.deleted).to.be.true;

      // Verify gone
      const listRes = await request(getApp()).get("/api/morons/x/test-list/saints").expect(200);
      expect(listRes.body.saints).to.have.lengthOf(0);
    });

    it("returns 404 for nonexistent saint", async () => {
      await request(getApp())
        .delete("/api/morons/x/test-list/saints/fake-id")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  // =========================================
  // DELETE /api/morons/:platform/:slug/saints?platformUserId=
  // =========================================

  describe("DELETE /api/morons/x/test-list/saints?platformUserId=", () => {
    it("removes saint by platform user id", async () => {
      await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "byplat_saint" })
        .expect(201);

      const res = await request(getApp())
        .delete("/api/morons/x/test-list/saints?platformUserId=byplat_saint")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.deleted).to.be.true;
    });

    it("returns 404 when platform user not found", async () => {
      await request(getApp())
        .delete("/api/morons/x/test-list/saints?platformUserId=ghost_saint")
        .set("Authorization", `Bearer ${ownerToken}`)
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
        .send({ platformUserId: "cl_saint" })
        .expect(201);

      const changelogRes = await request(getApp())
        .get("/api/morons/x/test-list/changelog")
        .expect(200);

      expect(changelogRes.body.changelog).to.have.lengthOf(1);
      expect(changelogRes.body.changelog[0].action).to.equal("ADD_SAINT");
      expect(changelogRes.body.changelog[0].platformUserId).to.equal("cl_saint");
    });

    it("creates REMOVE_SAINT changelog when removing", async () => {
      const createRes = await request(getApp())
        .post("/api/morons/x/test-list/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "rm_saint" })
        .expect(201);

      const saintId = createRes.body.saint.id as string;

      await request(getApp())
        .delete(`/api/morons/x/test-list/saints/${saintId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
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
