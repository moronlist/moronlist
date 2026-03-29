/**
 * Test runner entry point.
 * Sets up the global test environment and imports all test suites.
 */

import { setupTestEnvironment, teardownTestEnvironment } from "./setup.js";

// Global hooks
before(async function () {
  this.timeout(30000);
  await setupTestEnvironment();
});

after(async function () {
  this.timeout(15000);
  await teardownTestEnvironment();
});

// Import all test suites
import "./health.test.js";
import "./auth.test.js";
import "./morons.test.js";
import "./entries.test.js";
import "./saints.test.js";
import "./inheritance.test.js";
import "./subscriptions.test.js";
import "./cron.test.js";
