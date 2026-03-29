/**
 * Drop moron_entry and saint_entry tables.
 *
 * These tables are no longer used. All entry/saint data is now stored
 * in the changelog table as an append-only log. The changelog is flushed
 * to static txt files by the cron job.
 */

export function up(knex) {
  return knex.schema.dropTableIfExists("moron_entry").dropTableIfExists("saint_entry");
}

export function down(knex) {
  return knex.schema
    .createTable("moron_entry", (table) => {
      table.string("id", 36).primary();
      table.string("list_platform", 30).notNullable();
      table.string("list_slug", 60).notNullable();
      table.string("platform_user_id", 200).notNullable();
      table.string("display_name", 200);
      table.text("reason");
      table.string("added_by_id", 24).notNullable();
      table.timestamp("created_at").notNullable();

      table
        .foreign(["list_platform", "list_slug"])
        .references(["platform", "slug"])
        .inTable("moron_list")
        .onDelete("CASCADE");
      table.foreign("added_by_id").references("id").inTable("user");
      table.unique(["list_platform", "list_slug", "platform_user_id"]);
      table.index(["list_platform", "list_slug"]);
    })
    .createTable("saint_entry", (table) => {
      table.string("id", 36).primary();
      table.string("list_platform", 30).notNullable();
      table.string("list_slug", 60).notNullable();
      table.string("platform_user_id", 200).notNullable();
      table.text("reason");
      table.string("added_by_id", 24).notNullable();
      table.timestamp("created_at").notNullable();

      table
        .foreign(["list_platform", "list_slug"])
        .references(["platform", "slug"])
        .inTable("moron_list")
        .onDelete("CASCADE");
      table.foreign("added_by_id").references("id").inTable("user");
      table.unique(["list_platform", "list_slug", "platform_user_id"]);
      table.index(["list_platform", "list_slug"]);
    });
}
