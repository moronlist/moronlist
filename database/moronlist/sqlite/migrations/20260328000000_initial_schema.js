/**
 * MoronList database schema - initial migration
 * Collaborative block list platform
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // ============================================
  // USER TABLE
  // ============================================

  // User table
  // id is user-chosen (3-24 chars, alphanumeric + underscore)
  await knex.schema.createTable("user", (table) => {
    table.string("id", 24).primary();
    table.string("email").notNullable().unique();
    table.string("name").notNullable();
    table.string("role", 20).notNullable().defaultTo("USER"); // ROOT, ADMIN, MODERATOR, USER
    table.integer("banned").notNullable().defaultTo(0);
    table.text("ban_reason");
    table.text("created_at").notNullable();
    table.text("updated_at").notNullable();

    table.index(["email"]);
    table.index(["role"]);
  });

  // ============================================
  // MORON LIST TABLE
  // ============================================

  // Moron list table - composite primary key (platform, slug)
  await knex.schema.createTable("moron_list", (table) => {
    table.string("platform", 50).notNullable();
    table.string("slug", 100).notNullable();
    table.primary(["platform", "slug"]);
    table.string("owner_id", 24).notNullable().references("id").inTable("user");
    table.string("name").notNullable();
    table.text("description");
    table.string("visibility", 20).notNullable().defaultTo("public"); // public, private, unlisted
    table.integer("version").notNullable().defaultTo(0);
    table.string("forked_from_platform", 50);
    table.string("forked_from_slug", 100);
    table.text("created_at").notNullable();
    table.text("updated_at").notNullable();

    table.index(["owner_id"]);
    table.index(["visibility"]);
  });

  // Add FK for forked_from after table creation (composite FK)
  await knex.schema.alterTable("moron_list", (table) => {
    table
      .foreign(["forked_from_platform", "forked_from_slug"])
      .references(["platform", "slug"])
      .inTable("moron_list");
  });

  // ============================================
  // MORON ENTRY TABLE
  // ============================================

  // Moron entry table - users on the block list
  await knex.schema.createTable("moron_entry", (table) => {
    table.string("id", 36).primary(); // UUID
    table.string("list_platform", 50).notNullable();
    table.string("list_slug", 100).notNullable();
    table
      .foreign(["list_platform", "list_slug"])
      .references(["platform", "slug"])
      .inTable("moron_list");
    table.string("platform_user_id").notNullable();
    table.string("display_name");
    table.text("reason");
    table.string("added_by_id", 24).notNullable().references("id").inTable("user");
    table.text("created_at").notNullable();

    table.unique(["list_platform", "list_slug", "platform_user_id"]);
    table.index(["list_platform", "list_slug"]);
    table.index(["added_by_id"]);
  });

  // ============================================
  // SAINT ENTRY TABLE
  // ============================================

  // Saint entry table - users on the allow list
  await knex.schema.createTable("saint_entry", (table) => {
    table.string("id", 36).primary(); // UUID
    table.string("list_platform", 50).notNullable();
    table.string("list_slug", 100).notNullable();
    table
      .foreign(["list_platform", "list_slug"])
      .references(["platform", "slug"])
      .inTable("moron_list");
    table.string("platform_user_id").notNullable();
    table.text("reason");
    table.string("added_by_id", 24).notNullable().references("id").inTable("user");
    table.text("created_at").notNullable();

    table.unique(["list_platform", "list_slug", "platform_user_id"]);
    table.index(["list_platform", "list_slug"]);
    table.index(["added_by_id"]);
  });

  // ============================================
  // MORON LIST INHERITANCE TABLE
  // ============================================

  // Moron list inheritance - parent/child relationships between lists
  await knex.schema.createTable("moron_list_inheritance", (table) => {
    table.string("child_platform", 50).notNullable();
    table.string("child_slug", 100).notNullable();
    table.string("parent_platform", 50).notNullable();
    table.string("parent_slug", 100).notNullable();
    table.primary(["child_platform", "child_slug", "parent_platform", "parent_slug"]);
    table
      .foreign(["child_platform", "child_slug"])
      .references(["platform", "slug"])
      .inTable("moron_list");
    table
      .foreign(["parent_platform", "parent_slug"])
      .references(["platform", "slug"])
      .inTable("moron_list");
    table.text("created_at").notNullable();

    table.index(["child_platform", "child_slug"]);
    table.index(["parent_platform", "parent_slug"]);
  });

  // ============================================
  // CHANGELOG TABLE
  // ============================================

  // Changelog table - tracks changes to lists
  await knex.schema.createTable("changelog", (table) => {
    table.string("id", 36).primary(); // UUID
    table.string("list_platform", 50).notNullable();
    table.string("list_slug", 100).notNullable();
    table
      .foreign(["list_platform", "list_slug"])
      .references(["platform", "slug"])
      .inTable("moron_list");
    table.integer("version").notNullable();
    table.string("action", 20).notNullable(); // ADD, REMOVE, ADD_SAINT, REMOVE_SAINT
    table.string("platform_user_id").notNullable();
    table.string("user_id", 24).notNullable().references("id").inTable("user");
    table.text("created_at").notNullable();

    table.index(["list_platform", "list_slug"]);
    table.index(["list_platform", "list_slug", "version"]);
    table.index(["user_id"]);
  });

  // ============================================
  // SUBSCRIPTION TABLE
  // ============================================

  // Subscription table - users subscribing to lists
  await knex.schema.createTable("subscription", (table) => {
    table.string("user_id", 24).notNullable().references("id").inTable("user");
    table.string("list_platform", 50).notNullable();
    table.string("list_slug", 100).notNullable();
    table.primary(["user_id", "list_platform", "list_slug"]);
    table
      .foreign(["list_platform", "list_slug"])
      .references(["platform", "slug"])
      .inTable("moron_list");
    table.text("subscribed_at").notNullable();

    table.index(["user_id"]);
    table.index(["list_platform", "list_slug"]);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // Drop in reverse order of creation (respecting FK dependencies)
  await knex.schema.dropTableIfExists("subscription");
  await knex.schema.dropTableIfExists("changelog");
  await knex.schema.dropTableIfExists("moron_list_inheritance");
  await knex.schema.dropTableIfExists("saint_entry");
  await knex.schema.dropTableIfExists("moron_entry");

  // Remove self-referential FK before dropping moron_list
  await knex.schema.alterTable("moron_list", (table) => {
    table.dropForeign(["forked_from_platform", "forked_from_slug"]);
  });
  await knex.schema.dropTableIfExists("moron_list");

  await knex.schema.dropTableIfExists("user");
}
