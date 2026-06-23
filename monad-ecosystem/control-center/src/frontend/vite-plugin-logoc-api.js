import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Vite plugin that serves the LOGOC corpus as a live API endpoint.
 *
 * Endpoint: GET /api/v1/logoc/corpus
 * Reads from: ../../../../../logs/corpus/master_corpus_v5.9.jsonl
 * Serves the same snapshot structure as the static build.
 */

export function logocApiPlugin() {
  const CORPUS_PATH = path.resolve(
    __dirname,
    "../../../../../logs/corpus/master_corpus_v5.9.jsonl"
  );

  function buildSnapshot() {
    const events = [];
    let accepted = 0;
    let pending = 0;
    const bandCounts = {
      INSTINCT: 0,
      EXPERIENCE: 0,
      FORMAL_THOUGHT: 0,
    };
    const classCounts = {};

    if (fs.existsSync(CORPUS_PATH)) {
      const lines = fs.readFileSync(CORPUS_PATH, "utf-8").split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        const e = JSON.parse(line);

        const fe = {
          schema_version: "1.0",
          event_id: e["event_id"],
          timestamp: e["timestamp"] ?? Date.now(),
          narrative: e["narrative"] ?? "",
          semiotic_flags: e["semiotic_flags"] ?? {},
          peirce: e["peirce"] ?? null,
          peirce_migration_pending: e["peirce_migration_pending"] ?? false,
          peirce_migration_source: e["peirce_migration_source"] ?? null,
          _gnosis_meta: e["_gnosis_meta"] ?? e["meta"] ?? {},
        };

        const peirce = e["peirce"];
        if (peirce && peirce["sign_class_id"] !== undefined && peirce["sign_class_id"] !== null) {
          accepted++;
          const band = String(peirce["pragmatism_band"] ?? "UNKNOWN");
          bandCounts[band] = (bandCounts[band] ?? 0) + 1;
          const cid = String(peirce["sign_class_id"]);
          classCounts[cid] = (classCounts[cid] ?? 0) + 1;

          const fw = Number(peirce["firstness_weight"] ?? 0.33);
          fe["pps"] = 1.0 - fw;
        } else {
          pending++;
        }

        events.push(fe);
      }
    }

    return {
      events,
      generated_at: new Date().toISOString(),
      total: events.length,
      accepted,
      pending,
      band_distribution: bandCounts,
      class_distribution: classCounts,
    };
  }

  return {
    name: "logoc-live-api",
    configureServer(server) {
      server.middlewares.use("/api/v1/logoc/corpus", (req, res, next) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const snapshot = buildSnapshot();
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-cache");
          res.end(JSON.stringify(snapshot));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      // Health check
      server.middlewares.use("/api/v1/logoc/health", (req, res, next) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status: "ok", corpus_path: CORPUS_PATH }));
      });
    },
  };
}
