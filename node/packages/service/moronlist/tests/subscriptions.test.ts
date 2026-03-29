/**
 * Subscription endpoint integration tests
 */

import { expect } from "chai";
import request from "supertest";
import { getApp, resetDatabase, createTestUser } from "./setup.js";

describe("Subscription routes", () => {
  let ownerToken: string;
  let subscriberToken: string;

  beforeEach(async () => {
    resetDatabase();
    const owner = createTestUser({ id: "subowner" });
    ownerToken = owner.token;

    const subscriber = createTestUser({ id: "subscriber" });
    subscriberToken = subscriber.token;

    // Create a list
    await request(getApp())
      .post("/api/morons")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ platform: "x", slug: "test-list", name: "Test List" })
      .expect(201);
  });

  // =========================================
  // POST /api/subscriptions
  // =========================================

  describe("POST /api/subscriptions", () => {
    it("subscribes to a list", async () => {
      const res = await request(getApp())
        .post("/api/subscriptions")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .send({ moronListId: "x/test-list" })
        .expect(201);

      expect(res.body.subscription.listPlatform).to.equal("x");
      expect(res.body.subscription.listSlug).to.equal("test-list");
      expect(res.body.subscription.listId).to.equal("x/test-list");
      expect(res.body.subscription.subscribedAt).to.be.a("string");
    });

    it("handles duplicate subscription gracefully", async () => {
      // Subscribe once
      await request(getApp())
        .post("/api/subscriptions")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .send({ moronListId: "x/test-list" })
        .expect(201);

      // Subscribe again -- the repo returns the existing subscription
      const res = await request(getApp())
        .post("/api/subscriptions")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .send({ moronListId: "x/test-list" })
        .expect(201);

      expect(res.body.subscription.listId).to.equal("x/test-list");
    });

    it("returns 404 for nonexistent list", async () => {
      await request(getApp())
        .post("/api/subscriptions")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .send({ moronListId: "x/no-such-list" })
        .expect(404);
    });

    it("returns 401 without auth", async () => {
      await request(getApp())
        .post("/api/subscriptions")
        .send({ moronListId: "x/test-list" })
        .expect(401);
    });

    it("validates moronListId format", async () => {
      const res = await request(getApp())
        .post("/api/subscriptions")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .send({ moronListId: "invalid" })
        .expect(400);

      expect(res.body.error).to.equal("Validation error");
    });

    it("cannot subscribe to a private list", async () => {
      // Create a private list
      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          platform: "x",
          slug: "priv-sub-list",
          name: "Private Sub List",
          visibility: "private",
        })
        .expect(201);

      await request(getApp())
        .post("/api/subscriptions")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .send({ moronListId: "x/priv-sub-list" })
        .expect(404);
    });

    it("subscribing to same list twice is idempotent", async () => {
      // Subscribe once
      const res1 = await request(getApp())
        .post("/api/subscriptions")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .send({ moronListId: "x/test-list" })
        .expect(201);

      expect(res1.body.subscription.listId).to.equal("x/test-list");

      // Subscribe again
      const res2 = await request(getApp())
        .post("/api/subscriptions")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .send({ moronListId: "x/test-list" })
        .expect(201);

      expect(res2.body.subscription.listId).to.equal("x/test-list");

      // Verify only one subscription exists
      const meSubs = await request(getApp())
        .get("/api/me/subscriptions")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .expect(200);

      expect(meSubs.body.subscriptions).to.have.lengthOf(1);
    });
  });

  // =========================================
  // DELETE /api/subscriptions/:platform/:slug
  // =========================================

  describe("DELETE /api/subscriptions/x/test-list", () => {
    it("unsubscribes from a list", async () => {
      // Subscribe first
      await request(getApp())
        .post("/api/subscriptions")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .send({ moronListId: "x/test-list" })
        .expect(201);

      const res = await request(getApp())
        .delete("/api/subscriptions/x/test-list")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .expect(200);

      expect(res.body.deleted).to.be.true;
    });

    it("returns 404 when not subscribed", async () => {
      await request(getApp())
        .delete("/api/subscriptions/x/test-list")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .expect(404);
    });
  });

  // =========================================
  // GET /api/me/subscriptions
  // =========================================

  describe("GET /api/me/subscriptions", () => {
    it("returns user subscriptions with list details", async () => {
      // Subscribe to the list
      await request(getApp())
        .post("/api/subscriptions")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .send({ moronListId: "x/test-list" })
        .expect(201);

      const res = await request(getApp())
        .get("/api/me/subscriptions")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .expect(200);

      expect(res.body.subscriptions).to.be.an("array");
      expect(res.body.subscriptions).to.have.lengthOf(1);
      expect(res.body.subscriptions[0].listId).to.equal("x/test-list");
      expect(res.body.subscriptions[0].listName).to.equal("Test List");
      expect(res.body.subscriptions[0].subscribedAt).to.be.a("string");
    });

    it("returns empty array when not subscribed to anything", async () => {
      const res = await request(getApp())
        .get("/api/me/subscriptions")
        .set("Authorization", `Bearer ${subscriberToken}`)
        .expect(200);

      expect(res.body.subscriptions).to.have.lengthOf(0);
    });
  });
});
