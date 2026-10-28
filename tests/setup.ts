import { loadEnv } from "../scripts/env.mjs";

loadEnv();
process.env.NEXT_TELEMETRY_DISABLED = "1";
