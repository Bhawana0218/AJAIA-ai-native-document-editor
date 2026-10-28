// Loads .env for tests so the DB integration suite can connect when available.
import { loadEnv } from "../scripts/env.mjs";

loadEnv();
process.env.NEXT_TELEMETRY_DISABLED = "1";
