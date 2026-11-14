// Settings for the local development database (scripts/local-db.ts).
// Local only: bound to localhost, holds synthetic data, never used for the cloud database.
export const LOCAL_DB = {
  host: "localhost",
  port: 54329,
  user: "postgres",
  password: "local-dev-only",
  database: "bhumisathi",
} as const;

export const LOCAL_DATABASE_URL = `postgres://${LOCAL_DB.user}:${LOCAL_DB.password}@${LOCAL_DB.host}:${LOCAL_DB.port}/${LOCAL_DB.database}`;
