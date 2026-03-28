/**
 * Auth endpoint integration tests
 */

import { expect } from "chai";
import request from "supertest";
import {
  getApp,
  resetDatabase,
  createAuthToken,
  createPendingToken,
  createTestUser,
} from "./setup.js";

describe("Auth routes", () => {
  beforeEach(() => {
    resetDatabase();
  });

  // =========================================
  // GET /auth/me
  // =========================================

  describe("GET /auth/me", () => {
    it("returns user when authenticated with valid token", async () => {
      const { userId, token } = createTestUser({ name: "Alice" });

      const res = await request(getApp())
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.user).to.not.be.null;
      expect(res.body.user.id).to.equal(userId);
      expect(res.body.user.name).to.equal("Alice");
      expect(res.body.user.role).to.equal("USER");
      expect(res.body.user.createdAt).to.be.a("string");
    });

    it("returns 401 when not authenticated", async () => {
      const res = await request(getApp()).get("/auth/me").expect(401);

      expect(res.body.user).to.be.null;
    });

    it("returns 401 for an invalid token", async () => {
      const res = await request(getApp())
        .get("/auth/me")
        .set("Authorization", "Bearer invalid-garbage-token")
        .expect(401);

      expect(res.body.user).to.be.null;
    });

    it("returns needsOnboarding when identity has no userId", async () => {
      const token = createPendingToken({ email: "new@test.local", name: "New Person" });

      const res = await request(getApp())
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.user).to.be.null;
      expect(res.body.needsOnboarding).to.be.true;
      expect(res.body.identity).to.have.property("email", "new@test.local");
    });

    it("returns 403 when user is banned", async () => {
      const { token } = createTestUser({ id: "banneduser" });

      // Ban the user directly in the repo
      const repos = (await import("./setup.js")).getRepos();
      repos.user.update("banneduser", { banned: true, banReason: "Violated terms" });

      const res = await request(getApp())
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      expect(res.body.banned).to.be.true;
      expect(res.body.banReason).to.equal("Violated terms");
    });
  });

  // =========================================
  // GET /auth/pending-profile
  // =========================================

  describe("GET /auth/pending-profile", () => {
    it("returns pending profile for new identity", async () => {
      const token = createPendingToken({ email: "newuser@test.local", name: "New User" });

      const res = await request(getApp())
        .get("/auth/pending-profile")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.profile).to.not.be.null;
      expect(res.body.profile.email).to.equal("newuser@test.local");
      expect(res.body.profile.name).to.equal("New User");
    });

    it("returns alreadyOnboarded when identity has userId", async () => {
      const { token } = createTestUser();

      const res = await request(getApp())
        .get("/auth/pending-profile")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.profile).to.be.null;
      expect(res.body.alreadyOnboarded).to.be.true;
    });

    it("returns null profile when no token provided", async () => {
      const res = await request(getApp()).get("/auth/pending-profile").expect(200);

      expect(res.body.profile).to.be.null;
    });
  });

  // =========================================
  // POST /auth/complete-onboarding
  // =========================================

  describe("POST /auth/complete-onboarding", () => {
    it("creates a user and returns success", async () => {
      const token = createPendingToken({ email: "onboard@test.local", name: "Onboard Me" });

      const res = await request(getApp())
        .post("/auth/complete-onboarding")
        .set("Authorization", `Bearer ${token}`)
        .send({ id: "newuser", name: "My Display Name" })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.user.id).to.equal("newuser");
      expect(res.body.user.name).to.equal("My Display Name");
    });

    it("returns 401 when not authenticated", async () => {
      await request(getApp())
        .post("/auth/complete-onboarding")
        .send({ id: "someone", name: "Someone" })
        .expect(401);
    });

    it("rejects duplicate usernames", async () => {
      createTestUser({ id: "taken_name" });
      const token = createPendingToken({ email: "another@test.local" });

      const res = await request(getApp())
        .post("/auth/complete-onboarding")
        .set("Authorization", `Bearer ${token}`)
        .send({ id: "taken_name", name: "Another" })
        .expect(400);

      expect(res.body.error).to.include("already taken");
    });

    it("validates username format - too short", async () => {
      const token = createPendingToken();

      const res = await request(getApp())
        .post("/auth/complete-onboarding")
        .set("Authorization", `Bearer ${token}`)
        .send({ id: "ab", name: "Short" })
        .expect(400);

      expect(res.body.error).to.be.a("string");
    });

    it("validates username format - too long", async () => {
      const token = createPendingToken();

      const res = await request(getApp())
        .post("/auth/complete-onboarding")
        .set("Authorization", `Bearer ${token}`)
        .send({ id: "a".repeat(25), name: "Long" })
        .expect(400);

      expect(res.body.error).to.be.a("string");
    });

    it("validates username format - no uppercase", async () => {
      const token = createPendingToken();

      const res = await request(getApp())
        .post("/auth/complete-onboarding")
        .set("Authorization", `Bearer ${token}`)
        .send({ id: "BadCase", name: "Bad" })
        .expect(400);

      expect(res.body.error).to.be.a("string");
    });

    it("validates username format - must start with letter", async () => {
      const token = createPendingToken();

      const res = await request(getApp())
        .post("/auth/complete-onboarding")
        .set("Authorization", `Bearer ${token}`)
        .send({ id: "123abc", name: "Numeric" })
        .expect(400);

      expect(res.body.error).to.be.a("string");
    });

    it("validates username format - no special chars except underscore", async () => {
      const token = createPendingToken();

      const res = await request(getApp())
        .post("/auth/complete-onboarding")
        .set("Authorization", `Bearer ${token}`)
        .send({ id: "bad-name", name: "Hyphen" })
        .expect(400);

      expect(res.body.error).to.be.a("string");
    });

    it("accepts valid username with underscore", async () => {
      const token = createPendingToken();

      const res = await request(getApp())
        .post("/auth/complete-onboarding")
        .set("Authorization", `Bearer ${token}`)
        .send({ id: "valid_user", name: "Valid" })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.user.id).to.equal("valid_user");
    });

    it("rejects missing name", async () => {
      const token = createPendingToken();

      await request(getApp())
        .post("/auth/complete-onboarding")
        .set("Authorization", `Bearer ${token}`)
        .send({ id: "noname" })
        .expect(400);
    });
  });
});
