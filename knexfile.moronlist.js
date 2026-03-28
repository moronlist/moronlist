import { config as dotenvConfig } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenvConfig();

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_TYPE = process.env.MORONLIST_DB_TYPE || "sqlite";

const DATA_DIR = process.env.MORONLIST_DATA_DIR;
if (DB_TYPE === "sqlite" && !DATA_DIR) {
  console.error("ERROR: MORONLIST_DATA_DIR environment variable is required for SQLite");
  process.exit(1);
}

const sqliteDbPath = DATA_DIR ? join(DATA_DIR, "moronlist.db") : "";

const sqliteConfig = {
  development: {
    client: "sqlite3",
    connection: {
      filename: sqliteDbPath,
    },
    migrations: {
      directory: join(__dirname, "database", "moronlist", "sqlite", "migrations"),
    },
    seeds: {
      directory: join(__dirname, "database", "moronlist", "sqlite", "seeds"),
    },
    useNullAsDefault: true,
  },

  test: {
    client: "sqlite3",
    connection: ":memory:",
    migrations: {
      directory: join(__dirname, "database", "moronlist", "sqlite", "migrations"),
    },
    seeds: {
      directory: join(__dirname, "database", "moronlist", "sqlite", "seeds"),
    },
    useNullAsDefault: true,
  },

  production: {
    client: "sqlite3",
    connection: {
      filename: sqliteDbPath,
    },
    migrations: {
      directory: join(__dirname, "database", "moronlist", "sqlite", "migrations"),
    },
    seeds: {
      directory: join(__dirname, "database", "moronlist", "sqlite", "seeds"),
    },
    useNullAsDefault: true,
    pool: {
      min: 2,
      max: 10,
    },
  },
};

const config = DB_TYPE === "postgres" ? {} : sqliteConfig;

export default config;
