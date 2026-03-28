/**
 * Delta sync endpoint integration tests
 */

import { expect } from "chai";
import request from "supertest";
import { getApp, getRepos, resetDatabase, createTestUser } from "./setup.js";

describe("Sync routes", () => {
  let ownerToken: string;
  let ownerId: string;
  let userToken: string;
  let userId: string;

  beforeEach(async () => {
    resetDatabase();
    const owner = createTestUser({ id: "syncowner" });
    ownerToken = owner.token;
    ownerId = owner.userId;

    const user = createTestUser({ id: "syncuser" });
    userToken = user.token;
    userId = user.userId;
  });

  /** Create a list and optionally subscribe the sync user */
  async function seedList(
    slug: string,
    opts: { subscribe?: boolean; entries?: string[]; saints?: string[] } = {}
  ): Promise<void> {
    await request(getApp())
      .post("/api/morons")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ platform: "x", slug, name: `List ${slug}` })
      .expect(201);

    if (opts.entries !== undefined && opts.entries.length > 0) {
      await request(getApp())
        .post(`/api/morons/x/${slug}/entries/batch`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          entries: opts.entries.map((id) => ({ platformUserId: id })),
        })
        .expect(201);
    }

    if (opts.saints !== undefined && opts.saints.length > 0) {
      await request(getApp())
        .post(`/api/morons/x/${slug}/saints/batch`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          saints: opts.saints.map((id) => ({ platformUserId: id })),
        })
        .expect(201);
    }

    if (opts.subscribe === true) {
      await request(getApp())
        .post("/api/subscriptions")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ moronListId: `x/${slug}` })
        .expect(201);
    }
  }

  // =========================================
  // POST /api/v1/sync
  // =========================================

  describe("POST /api/v1/sync", () => {
    it("returns full snapshot when client version is 0", async () => {
      await seedList("snaplist", {
        entries: ["moron1", "moron2"],
        saints: ["saint1"],
      });

      const res = await request(getApp())
        .post("/api/v1/sync")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ lists: { "x/snaplist": 0 } })
        .expect(200);

      const delta = res.body.deltas["x/snaplist"];
      expect(delta).to.not.be.undefined;
      // Snapshot has morons/saints arrays
      expect(delta.morons).to.be.an("array");
      expect(delta.morons).to.have.lengthOf(2);
      expect(delta.saints).to.be.an("array");
      expect(delta.saints).to.have.lengthOf(1);
      expect(delta.version).to.be.a("number");
    });

    it("returns empty changes when client is up to date", async () => {
      await seedList("uptodate", { entries: ["m1"] });

      // Get current version
      const listRes = await request(getApp()).get("/api/morons/x/uptodate").expect(200);
      const currentVersion = listRes.body.list.version as number;

      const res = await request(getApp())
        .post("/api/v1/sync")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ lists: { "x/uptodate": currentVersion } })
        .expect(200);

      // No delta for this list since client is current
      expect(res.body.deltas).to.not.have.property("x/uptodate");
    });

    it("returns ADD deltas after adding entries", async () => {
      // Seed with one entry so version > 0
      await seedList("deltaadd", { entries: ["existing"] });

      // Get version before adding more
      const listBefore = await request(getApp()).get("/api/morons/x/deltaadd").expect(200);
      const versionBefore = listBefore.body.list.version as number;
      expect(versionBefore).to.be.greaterThan(0);

      // Add another entry
      await request(getApp())
        .post("/api/morons/x/deltaadd/entries")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "newmoron" })
        .expect(201);

      const res = await request(getApp())
        .post("/api/v1/sync")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ lists: { "x/deltaadd": versionBefore } })
        .expect(200);

      const delta = res.body.deltas["x/deltaadd"];
      expect(delta).to.not.be.undefined;
      expect(delta.changes).to.be.an("array");
      expect(delta.changes).to.have.lengthOf(1);
      expect(delta.changes[0].a).to.equal("add");
      expect(delta.changes[0].u).to.equal("newmoron");
    });

    it("returns REMOVE deltas after removing entries", async () => {
      await seedList("deltarm", { entries: ["victim"] });

      const listBefore = await request(getApp()).get("/api/morons/x/deltarm").expect(200);
      const versionBefore = listBefore.body.list.version as number;

      // Remove the entry
      await request(getApp())
        .delete("/api/morons/x/deltarm/entries?platformUserId=victim")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      const res = await request(getApp())
        .post("/api/v1/sync")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ lists: { "x/deltarm": versionBefore } })
        .expect(200);

      const delta = res.body.deltas["x/deltarm"];
      expect(delta).to.not.be.undefined;
      expect(delta.changes).to.be.an("array");
      const rmChange = delta.changes.find((c: { a: string; u: string }) => c.a === "rm");
      expect(rmChange).to.not.be.undefined;
      expect(rmChange.u).to.equal("victim");
    });

    it("returns SAINT and UNSAINT deltas for saints", async () => {
      // Seed with an entry so version > 0
      await seedList("deltasaint", { entries: ["baseentry"] });

      const listBefore = await request(getApp()).get("/api/morons/x/deltasaint").expect(200);
      const v0 = listBefore.body.list.version as number;
      expect(v0).to.be.greaterThan(0);

      // Add a saint
      await request(getApp())
        .post("/api/morons/x/deltasaint/saints")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platformUserId: "goodperson" })
        .expect(201);

      // Check saint delta
      const res1 = await request(getApp())
        .post("/api/v1/sync")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ lists: { "x/deltasaint": v0 } })
        .expect(200);

      const delta1 = res1.body.deltas["x/deltasaint"];
      expect(delta1.changes).to.be.an("array");
      expect(delta1.changes[0].a).to.equal("saint");
      expect(delta1.changes[0].u).to.equal("goodperson");

      // Now remove the saint
      const v1 = delta1.version as number;

      await request(getApp())
        .delete("/api/morons/x/deltasaint/saints?platformUserId=goodperson")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      const res2 = await request(getApp())
        .post("/api/v1/sync")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ lists: { "x/deltasaint": v1 } })
        .expect(200);

      const delta2 = res2.body.deltas["x/deltasaint"];
      expect(delta2.changes).to.be.an("array");
      expect(delta2.changes[0].a).to.equal("unsaint");
    });

    it("returns inherited list references", async () => {
      // Create parent with entries, child inherits
      await seedList("inh-parent", { entries: ["inherited_moron"], saints: ["inherited_saint"] });
      await seedList("inh-child");

      // Set inheritance
      const putRes = await request(getApp())
        .put("/api/morons/x/inh-child/parents")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ parents: ["x/inh-parent"] })
        .expect(200);

      expect(putRes.body.parents).to.have.lengthOf(1);

      // Sync both the child and parent — when syncing child, parent should be in inherited
      const res = await request(getApp())
        .post("/api/v1/sync")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ lists: { "x/inh-child": 0 } })
        .expect(200);

      // The child should be in deltas (snapshot since version 0)
      expect(res.body.deltas).to.have.property("x/inh-child");

      // The parent data should be in inherited
      expect(res.body.inherited).to.have.property("x/inh-parent");
      expect(res.body.inherited["x/inh-parent"].morons).to.include("inherited_moron");
      expect(res.body.inherited["x/inh-parent"].saints).to.include("inherited_saint");
    });

    it("places unknown list in removed array", async () => {
      const res = await request(getApp())
        .post("/api/v1/sync")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ lists: { "x/deleted-list": 5 } })
        .expect(200);

      expect(res.body.removed).to.include("x/deleted-list");
    });

    it("excludes private lists from non-owners", async () => {
      // Create a private list
      await request(getApp())
        .post("/api/morons")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ platform: "x", slug: "private-sync", name: "Private", visibility: "private" })
        .expect(201);

      // Non-owner tries to sync it
      const res = await request(getApp())
        .post("/api/v1/sync")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ lists: { "x/private-sync": 0 } })
        .expect(200);

      expect(res.body.removed).to.include("x/private-sync");
    });

    it("returns 401 without auth", async () => {
      await request(getApp()).post("/api/v1/sync").send({ lists: {} }).expect(401);
    });

    it("validates request body", async () => {
      await request(getApp())
        .post("/api/v1/sync")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ lists: "not-an-object" })
        .expect(400);
    });

    it("handles empty lists object", async () => {
      const res = await request(getApp())
        .post("/api/v1/sync")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ lists: {} })
        .expect(200);

      expect(res.body.deltas).to.deep.equal({});
      expect(res.body.inherited).to.deep.equal({});
      expect(res.body.removed).to.deep.equal([]);
    });

    it("handles multiple lists in a single sync request", async () => {
      await seedList("multi-a", { entries: ["ma1"] });
      await seedList("multi-b", { entries: ["mb1", "mb2"] });

      const res = await request(getApp())
        .post("/api/v1/sync")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          lists: {
            "x/multi-a": 0,
            "x/multi-b": 0,
          },
        })
        .expect(200);

      expect(res.body.deltas).to.have.property("x/multi-a");
      expect(res.body.deltas).to.have.property("x/multi-b");
      expect(res.body.deltas["x/multi-a"].morons).to.have.lengthOf(1);
      expect(res.body.deltas["x/multi-b"].morons).to.have.lengthOf(2);
    });
  });
});
