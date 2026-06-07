// Side-effect module for standalone entry points (worker, scripts). Next.js
// loads .env itself; tsx-run processes import this first instead.
import path from "node:path";

try {
  process.loadEnvFile(path.join(import.meta.dirname, "..", "..", ".env"));
} catch {
  // No .env file; rely on the ambient environment.
}
