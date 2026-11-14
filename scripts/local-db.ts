// Local PostgreSQL 17 for development and tests, from the npm package
// @embedded-postgres/windows-x64 (no Docker or installer needed). We call its initdb and
// pg_ctl programs directly. The server runs in the background until `npm run db:stop`.
//
//   npm run db:start   → create (first time) and start the server on localhost:54329
//   npm run db:stop    → stop it
//
// The app talks plain SQL through DATABASE_URL, so the same code runs against Supabase cloud
// by changing only that variable. Data lives in .pgdata/ (git-ignored). The local password is
// a local-development value for a localhost-only server holding synthetic data.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";
import { LOCAL_DB } from "../lib/local-db-config";

const root = process.cwd();
const dataDir = path.join(root, ".pgdata");
const logFile = path.join(root, ".pgdata.log");

function binDir(): string {
  const platformPkg = `@embedded-postgres/${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;
  return path.join(root, "node_modules", platformPkg, "native", "bin");
}

function bin(name: string): string {
  return path.join(binDir(), process.platform === "win32" ? `${name}.exe` : name);
}

export function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

function initCluster(): void {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "bhumi-pg-"));
  const pwFile = path.join(tmp, "pw");
  writeFileSync(pwFile, `${LOCAL_DB.password}\n`);
  try {
    execFileSync(
      bin("initdb"),
      [
        `--pgdata=${dataDir}`,
        `--username=${LOCAL_DB.user}`,
        `--pwfile=${pwFile}`,
        "--auth=scram-sha-256",
        "--encoding=UTF8",
        "--locale=C",
      ],
      { stdio: "ignore" },
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Start the local server if it is not already listening, and create the database once. */
export async function ensureLocalDb(): Promise<void> {
  if (await portOpen(LOCAL_DB.port)) return;
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) initCluster();

  // listen_addresses=localhost: never reachable from the network.
  const result = spawnSync(
    bin("pg_ctl"),
    [
      "start",
      "-D",
      dataDir,
      "-l",
      logFile,
      "-w",
      "-t",
      "60",
      "-o",
      `-p ${LOCAL_DB.port} -c listen_addresses=localhost -c max_connections=100`,
    ],
    { stdio: "ignore", windowsHide: true },
  );
  if (result.status !== 0) {
    throw new Error(`pg_ctl start failed (exit ${result.status}). See ${logFile}.`);
  }

  // Create the app database on first run.
  const admin = postgres({
    host: LOCAL_DB.host,
    port: LOCAL_DB.port,
    user: LOCAL_DB.user,
    password: LOCAL_DB.password,
    database: "postgres",
    onnotice: () => {},
  });
  try {
    const rows = await admin`select 1 from pg_database where datname = ${LOCAL_DB.database}`;
    if (rows.length === 0) await admin.unsafe(`create database ${LOCAL_DB.database}`);
  } finally {
    await admin.end();
  }
}

export function stopLocalDb(): void {
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) return;
  spawnSync(bin("pg_ctl"), ["stop", "-D", dataDir, "-m", "fast", "-w"], {
    stdio: "ignore",
    windowsHide: true,
  });
}

const command = process.argv[2];
if (command === "start") {
  ensureLocalDb()
    .then(() => console.log(`Local PostgreSQL ready on localhost:${LOCAL_DB.port}.`))
    .catch((err) => {
      console.error(String(err));
      process.exit(1);
    });
} else if (command === "stop") {
  stopLocalDb();
  console.log("Local PostgreSQL stopped.");
}
