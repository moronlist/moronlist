/**
 * Inheritance (DAG) endpoint integration tests
 */

import { expect } from "chai";
import request from "supertest";
import { getApp, resetDatabase, createTestUser } from "./setup.js";

describe("Inheritance routes", () => {
  let ownerToken: string;
  let ownerId: string;

  beforeEach(async () => {
    resetDatabase();
    const owner = createTestUser({ id: "dagowner" });
    ownerToken = owner.token;
    ownerId = owner.userId;
  });

  /** Helper: create a public list */
  async function createList(
    platform: string,
    slug: string,
    name: string,
    token?: string
  ): Promise<void> {
    await request(getApp())
      .post("/api/morons")
      .set("Authorization", `Bearer ${token ?? ownerToken}`)
      .send({ platform, slug, name, visibility: "public" })
      .expect(201);
  }

  // =========================================
  // PUT /api/morons/:platform/:slug/parents
  // =========================================

  describe("PUT /api/morons/x/child/parents", () => {
    it("sets parents for a list", async () => {
      await createList("x", "parent-a", "Parent A");
      await createList("x", "parent-b", "Parent B");
      await createList("x", "child", "Child");

      const res = await request(getApp())
        .put("/api/morons/x/child/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/parent-a", "x/parent-b"] })
        .expect(200);

      expect(res.body.parents).to.have.lengthOf(2);
      const ids = res.body.parents.map((p: { id: string }) => p.id) as string[];
      expect(ids).to.include("x/parent-a");
      expect(ids).to.include("x/parent-b");
    });

    it("full replace removes old and adds new parents", async () => {
      await createList("x", "old-parent", "Old Parent");
      await createList("x", "new-parent", "New Parent");
      await createList("x", "child", "Child");

      // Set first parent
      await request(getApp())
        .put("/api/morons/x/child/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/old-parent"] })
        .expect(200);

      // Replace with new parent
      const res = await request(getApp())
        .put("/api/morons/x/child/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/new-parent"] })
        .expect(200);

      expect(res.body.parents).to.have.lengthOf(1);
      expect(res.body.parents[0].id).to.equal("x/new-parent");

      // Verify old parent is gone
      const parentsRes = await request(getApp()).get("/api/morons/x/child/parents").expect(200);

      expect(parentsRes.body.parents).to.have.lengthOf(1);
      expect(parentsRes.body.parents[0].id).to.equal("x/new-parent");
    });

    it("empty array removes all parents", async () => {
      await createList("x", "some-parent", "Some Parent");
      await createList("x", "child", "Child");

      await request(getApp())
        .put("/api/morons/x/child/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/some-parent"] })
        .expect(200);

      const res = await request(getApp())
        .put("/api/morons/x/child/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: [] })
        .expect(200);

      expect(res.body.parents).to.have.lengthOf(0);
    });

    it("detects simple cycle (A -> B -> A)", async () => {
      await createList("x", "lista", "List A");
      await createList("x", "listb", "List B");

      // B inherits from A
      await request(getApp())
        .put("/api/morons/x/listb/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/lista"] })
        .expect(200);

      // Try to make A inherit from B => cycle
      const res = await request(getApp())
        .put("/api/morons/x/lista/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/listb"] })
        .expect(409);

      expect(res.body.code).to.equal("CYCLE_DETECTED");
    });

    it("detects deep cycle (A -> B -> C -> A)", async () => {
      await createList("x", "la", "List A");
      await createList("x", "lb", "List B");
      await createList("x", "lc", "List C");

      // B -> A
      await request(getApp())
        .put("/api/morons/x/lb/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/la"] })
        .expect(200);

      // C -> B
      await request(getApp())
        .put("/api/morons/x/lc/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/lb"] })
        .expect(200);

      // Try A -> C => cycle (A -> C -> B -> A)
      const res = await request(getApp())
        .put("/api/morons/x/la/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/lc"] })
        .expect(409);

      expect(res.body.code).to.equal("CYCLE_DETECTED");
    });

    it("rejects self-reference", async () => {
      await createList("x", "selfref", "Self Ref");

      const res = await request(getApp())
        .put("/api/morons/x/selfref/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/selfref"] })
        .expect(400);

      expect(res.body.code).to.equal("CANNOT_INHERIT_OWN_LIST");
    });

    it("rejects nonexistent parent", async () => {
      await createList("x", "child", "Child");

      const res = await request(getApp())
        .put("/api/morons/x/child/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/does-not-exist"] })
        .expect(404);

      expect(res.body.code).to.equal("NOT_FOUND");
    });

    it("rejects non-owner setting parents", async () => {
      const { token: otherToken } = createTestUser({ id: "dagnope" });
      await createList("x", "dchild", "Child");
      await createList("x", "dparent", "Parent");

      const res = await request(getApp())
        .put("/api/morons/x/dchild/parents")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ parents: ["x/dparent"] })
        .expect(403);

      expect(res.body.code).to.equal("FORBIDDEN");
    });

    it("blocks non-public parent lists", async () => {
      await createList("x", "child", "Child");

      // Create a private list
      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platform: "x", slug: "private-parent", name: "Private", visibility: "private" })
        .expect(201);

      const res = await request(getApp())
        .put("/api/morons/x/child/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/private-parent"] })
        .expect(400);

      expect(res.body.code).to.equal("LIST_NOT_PUBLIC");
    });

    it("rejects inheritance across platforms", async () => {
      await createList("x", "xchild", "X Child");
      await createList("bluesky", "bsparent", "Bluesky Parent");

      const res = await request(getApp())
        .put("/api/morons/x/xchild/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["bluesky/bsparent"] })
        .expect(400);

      expect(res.body.code).to.equal("INVALID_INPUT");
      expect(res.body.error).to.include("Cannot inherit across platforms");
    });
  });

  // =========================================
  // GET /api/morons/:platform/:slug/parents
  // =========================================

  describe("GET /api/morons/x/child/parents", () => {
    it("returns parent list details", async () => {
      await createList("x", "par", "The Parent");
      await createList("x", "chi", "The Child");

      await request(getApp())
        .put("/api/morons/x/chi/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/par"] })
        .expect(200);

      const res = await request(getApp()).get("/api/morons/x/chi/parents").expect(200);

      expect(res.body.parents).to.have.lengthOf(1);
      expect(res.body.parents[0].id).to.equal("x/par");
      expect(res.body.parents[0].name).to.equal("The Parent");
      expect(res.body.parents[0].createdAt).to.be.a("string");
    });
  });

  // =========================================
  // GET /api/morons/:platform/:slug/resolve
  // =========================================

  describe("GET /api/morons/x/child/resolve", () => {
    it("returns full ancestor tree", async () => {
      await createList("x", "grandparent", "Grandparent");
      await createList("x", "parent", "Parent");
      await createList("x", "child", "Child");

      // parent -> grandparent
      await request(getApp())
        .put("/api/morons/x/parent/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/grandparent"] })
        .expect(200);

      // child -> parent
      await request(getApp())
        .put("/api/morons/x/child/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/parent"] })
        .expect(200);

      const res = await request(getApp()).get("/api/morons/x/child/resolve").expect(200);

      expect(res.body.ancestors).to.be.an("array");
      expect(res.body.ancestors).to.have.lengthOf(2);

      // Find parent and grandparent in response
      const parentNode = res.body.ancestors.find((a: { id: string }) => a.id === "x/parent");
      const gpNode = res.body.ancestors.find((a: { id: string }) => a.id === "x/grandparent");

      expect(parentNode).to.not.be.undefined;
      expect(parentNode.depth).to.equal(1);
      expect(parentNode.parents).to.include("x/grandparent");

      expect(gpNode).to.not.be.undefined;
      expect(gpNode.depth).to.equal(2);
    });

    it("returns empty ancestors for list with no parents", async () => {
      await createList("x", "orphan", "Orphan");

      const res = await request(getApp()).get("/api/morons/x/orphan/resolve").expect(200);

      expect(res.body.ancestors).to.have.lengthOf(0);
    });

    it("returns 404 for nonexistent list", async () => {
      await request(getApp()).get("/api/morons/x/nolist/resolve").expect(404);
    });
  });
});
