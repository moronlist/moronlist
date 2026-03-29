/**
 * Health endpoint integration tests
 */

import { expect } from "chai";
import request from "supertest";
import { getApp } from "./setup.js";

describe("Health routes", () => {
  describe("GET /health", () => {
    it("returns 200 with status healthy", async () => {
      const res = await request(getApp()).get("/health").expect(200);

      expect(res.body.status).to.equal("healthy");
    });
  });
});
