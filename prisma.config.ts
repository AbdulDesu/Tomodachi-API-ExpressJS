import "dotenv/config";
import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile();
} catch (err) {
  console.error(err);
}

const dbUrl = process.env["DATABASE_URL"];
if (!dbUrl) {
  throw new Error("DATABASE_URL environment variable is missing");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: dbUrl,
  },
});
