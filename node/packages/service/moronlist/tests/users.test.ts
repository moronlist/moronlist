/**
 * User endpoint integration tests
 */

import { expect } from "chai";
import request from "supertest";
import { getApp, resetDatabase, createTestUser } from "./setup.js";

describe("User routes", () => {
  beforeEach(() => {
    resetDatabase();
  });

  // =========================================
  // GET /api/users/:id
  // =========================================

  describe("GET /api/users/:id", () => {
    it("returns user profile for existing user", async () => {
      const { userId } = createTestUser({ id: "profileuser", name: "Profile User" });

      const res = await request(getApp()).get(`/api/users/${userId}`).expect(200);

      expect(res.body.user).to.not.be.null;
      expect(res.body.user.id).to.equal(userId);
      expect(res.body.user.name).to.equal("Profile User");
      expect(res.body.user.role).to.equal("USER");
      expect(res.body.user.createdAt).to.be.a("string");
    });

    it("returns 404 for nonexistent user", async () => {
      const res = await request(getApp()).get("/api/users/nonexistentuser").expect(404);

      expect(res.body.error).to.equal("User not found");
    });

    it("does not expose email (privacy)", async () => {
      const { userId } = createTestUser({ id: "privacyuser", email: "secret@test.local" });

      const res = await request(getApp()).get(`/api/users/${userId}`).expect(200);

      expect(res.body.user).to.not.have.property("email");
    });
  });

  // =========================================
  // GET /api/users/:id/morons
  // =========================================

  describe("GET /api/users/:id/morons", () => {
    it("returns user's public lists", async () => {
      const { userId, token } = createTestUser({ id: "listuser" });

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "user-public", name: "Public List", visibility: "public" })
        .expect(201);

      const res = await request(getApp()).get(`/api/users/${userId}/morons`).expect(200);

      expect(res.body.lists).to.be.an("array");
      expect(res.body.lists).to.have.lengthOf(1);
      expect(res.body.lists[0].slug).to.equal("user-public");
      expect(res.body.lists[0].visibility).to.equal("public");
    });

    it("does not include private lists", async () => {
      const { userId, token } = createTestUser({ id: "privlistuser" });

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "user-private", name: "Private List", visibility: "private" })
        .expect(201);

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "user-public-too", name: "Public List", visibility: "public" })
        .expect(201);

      const res = await request(getApp()).get(`/api/users/${userId}/morons`).expect(200);

      expect(res.body.lists).to.have.lengthOf(1);
      expect(res.body.lists[0].slug).to.equal("user-public-too");
    });

    it("does not include unlisted lists", async () => {
      const { userId, token } = createTestUser({ id: "unlistuser" });

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          platform: "x",
          slug: "user-unlisted",
          name: "Unlisted List",
          visibility: "unlisted",
        })
        .expect(201);

      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${token}`)
        .send({ platform: "x", slug: "user-pub", name: "Pub List", visibility: "public" })
        .expect(201);

      const res = await request(getApp()).get(`/api/users/${userId}/morons`).expect(200);

      expect(res.body.lists).to.have.lengthOf(1);
      expect(res.body.lists[0].slug).to.equal("user-pub");
    });

    it("returns empty array for user with no lists", async () => {
      const { userId } = createTestUser({ id: "emptylistuser" });

      const res = await request(getApp()).get(`/api/users/${userId}/morons`).expect(200);

      expect(res.body.lists).to.be.an("array");
      expect(res.body.lists).to.have.lengthOf(0);
    });

    it("returns 404 for nonexistent user", async () => {
      const res = await request(getApp()).get("/api/users/ghostuser/morons").expect(404);

      expect(res.body.error).to.equal("User not found");
    });
  });
});
