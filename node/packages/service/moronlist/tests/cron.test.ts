/**
 * Cron flush-data integration tests
 */

import { expect } from "chai";
import { join } from "path";
import { mkdirSync, readFileSync, existsSync, rmSync } from "fs";
import request from "supertest";
import { getApp, getRepos, resetDatabase, createTestUser } from "./setup.js";
import { flushData } from "../src/cron/flush-data.js";

describe("Cron: flush-data", () => {
  let ownerToken: string;
  const testOutputDir = join(process.cwd(), ".tests", "cron-output-" + Date.now());

  beforeEach(async () => {
    resetDatabase();
    const owner = createTestUser({ id: "cronowner" });
    ownerToken = owner.token;

    // Create test output dir
    mkdirSync(testOutputDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it("generates txt file from changelog entries", async () => {
    // Create a list and add entries via API
    await request(getApp())
      .post("/api/morons")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ platform: "x", slug: "flush-test", name: "Flush Test" })
      .expect(201);

    await request(getApp())
      .post("/api/morons/x/flush-test/entries")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send([{ platformUserId: "bot1", reason: "spammer" }, { platformUserId: "bot2" }])
      .expect(201);

    await request(getApp())
      .post("/api/morons/x/flush-test/saints")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send([{ platformUserId: "good1", reason: "false positive" }])
      .expect(201);

    // Run flush
    const repos = getRepos();
    const result = flushData(repos, testOutputDir);

    expect(result.flushed).to.be.greaterThan(0);
    expect(result.errors).to.equal(0);

    // Check txt file exists and has correct content (files start at 1.txt)
    const txtPath = join(testOutputDir, "x", "flush-test", "1.txt");
    expect(existsSync(txtPath)).to.be.true;

    const content = readFileSync(txtPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines.length).to.equal(3);
    expect(lines[0]).to.equal("+bot1 spammer");
    expect(lines[1]).to.equal("+bot2");
    expect(lines[2]).to.equal("*good1 false positive");

    // Check meta.json
    const metaPath = join(testOutputDir, "x", "flush-test", "meta.json");
    expect(existsSync(metaPath)).to.be.true;

    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    expect(meta.platform).to.equal("x");
    expect(meta.slug).to.equal("flush-test");
    expect(meta.entries).to.equal(3);
    expect(meta.files).to.equal(1);
  });

  it("generates correct txt format for remove and saint operations", async () => {
    // Create a list and add entries
    await request(getApp())
      .post("/api/morons")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ platform: "x", slug: "ops-test", name: "Ops Test" })
      .expect(201);

    // Add an entry
    await request(getApp())
      .post("/api/morons/x/ops-test/entries")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send([{ platformUserId: "addme", reason: "added" }])
      .expect(201);

    // Remove it
    await request(getApp())
      .delete("/api/morons/x/ops-test/entries")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send([{ platformUserId: "addme" }])
      .expect(200);

    // Add a saint
    await request(getApp())
      .post("/api/morons/x/ops-test/saints")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send([{ platformUserId: "goodone", reason: "nice person" }])
      .expect(201);

    // Remove the saint
    await request(getApp())
      .delete("/api/morons/x/ops-test/saints")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send([{ platformUserId: "goodone" }])
      .expect(200);

    // Flush
    const repos = getRepos();
    const result = flushData(repos, testOutputDir);
    expect(result.flushed).to.be.greaterThan(0);

    const txtPath = join(testOutputDir, "x", "ops-test", "1.txt");
    expect(existsSync(txtPath)).to.be.true;

    const content = readFileSync(txtPath, "utf-8");
    const lines = content.trim().split("\n");

    // Expect: +addme added, -addme, *goodone nice person, ~goodone
    expect(lines).to.include("+addme added");
    expect(lines).to.include("-addme");
    expect(lines).to.include("*goodone nice person");
    expect(lines).to.include("~goodone");
  });

  it("meta.json includes parent tree when list has parents", async () => {
    // Create parent list
    await request(getApp())
      .post("/api/morons")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ platform: "x", slug: "meta-parent", name: "Meta Parent", visibility: "public" })
      .expect(201);

    // Create child list
    await request(getApp())
      .post("/api/morons")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ platform: "x", slug: "meta-child", name: "Meta Child", visibility: "public" })
      .expect(201);

    // Set parent
    await request(getApp())
      .put("/api/morons/x/meta-child/parents")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ parents: ["x/meta-parent"] })
      .expect(200);

    // Add an entry to the child so it has something to flush
    await request(getApp())
      .post("/api/morons/x/meta-child/entries")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send([{ platformUserId: "someone" }])
      .expect(201);

    // Flush
    const repos = getRepos();
    flushData(repos, testOutputDir);

    const metaPath = join(testOutputDir, "x", "meta-child", "meta.json");
    expect(existsSync(metaPath)).to.be.true;

    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    expect(meta.parents).to.be.an("array");
    expect(meta.parents).to.have.lengthOf(1);
    expect(meta.parents[0].slug).to.equal("meta-parent");
    expect(meta.parents[0].name).to.equal("Meta Parent");
  });

  it("second flush appends to existing file (not overwrites)", async () => {
    // Create a list and add entries
    await request(getApp())
      .post("/api/morons")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ platform: "x", slug: "append-test", name: "Append Test" })
      .expect(201);

    await request(getApp())
      .post("/api/morons/x/append-test/entries")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send([{ platformUserId: "first" }])
      .expect(201);

    // First flush
    const repos = getRepos();
    flushData(repos, testOutputDir);

    const txtPath = join(testOutputDir, "x", "append-test", "1.txt");
    const contentAfterFirst = readFileSync(txtPath, "utf-8");
    expect(contentAfterFirst.trim().split("\n")).to.have.lengthOf(1);

    // Add more entries
    await request(getApp())
      .post("/api/morons/x/append-test/entries")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send([{ platformUserId: "second" }, { platformUserId: "third" }])
      .expect(201);

    // Second flush
    flushData(repos, testOutputDir);

    const contentAfterSecond = readFileSync(txtPath, "utf-8");
    const lines = contentAfterSecond.trim().split("\n");
    expect(lines).to.have.lengthOf(3);
    expect(lines[0]).to.equal("+first");
    expect(lines[1]).to.equal("+second");
    expect(lines[2]).to.equal("+third");
  });

  it("does not re-flush already flushed entries", async () => {
    await request(getApp())
      .post("/api/morons")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ platform: "x", slug: "reflush-test", name: "Reflush" })
      .expect(201);

    await request(getApp())
      .post("/api/morons/x/reflush-test/entries")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send([{ platformUserId: "once" }])
      .expect(201);

    const repos = getRepos();

    // First flush
    const result1 = flushData(repos, testOutputDir);
    expect(result1.flushed).to.be.greaterThan(0);

    const txtPath = join(testOutputDir, "x", "reflush-test", "1.txt");
    const contentAfterFirst = readFileSync(txtPath, "utf-8");

    // Second flush -- no new DB entries, so file content should not change
    flushData(repos, testOutputDir);

    const contentAfterSecond = readFileSync(txtPath, "utf-8");
    expect(contentAfterSecond).to.equal(contentAfterFirst);
  });
});
