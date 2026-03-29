/**
 * Changelog source of truth migration
 * - Add reason and flush_version to changelog
 * - Add flush_state table
 * - Add entry_count and saint_count to moron_list
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Add reason and flush_version columns to changelog
  await knex.schema.alterTable("changelog", (table) => {
    table.text("reason");
    table.integer("flush_version").defaultTo(null);
  });

  // Add index on changelog(list_platform, list_slug, flush_version)
  await knex.schema.alterTable("changelog", (table) => {
    table.index(["list_platform", "list_slug", "flush_version"]);
  });

  // Create flush_state table
  await knex.schema.createTable("flush_state", (table) => {
    table.string("list_platform", 50).notNullable();
    table.string("list_slug", 100).notNullable();
    table.primary(["list_platform", "list_slug"]);
    table
      .foreign(["list_platform", "list_slug"])
      .references(["platform", "slug"])
      .inTable("moron_list");
    table.integer("last_flushed_version").notNullable().defaultTo(0);
    table.text("last_flushed_at");
  });

  // Add entry_count and saint_count to moron_list
  await knex.schema.alterTable("moron_list", (table) => {
    table.integer("entry_count").notNullable().defaultTo(0);
    table.integer("saint_count").notNullable().defaultTo(0);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // Drop flush_state table
  await knex.schema.dropTableIfExists("flush_state");

  // Remove columns from changelog
  // SQLite does not support DROP COLUMN in older versions, but Knex handles this via table copy
  await knex.schema.alterTable("changelog", (table) => {
    table.dropIndex(["list_platform", "list_slug", "flush_version"]);
  });

  await knex.schema.alterTable("changelog", (table) => {
    table.dropColumn("reason");
    table.dropColumn("flush_version");
  });

  // Remove columns from moron_list
  await knex.schema.alterTable("moron_list", (table) => {
    table.dropColumn("entry_count");
    table.dropColumn("saint_count");
  });
}
