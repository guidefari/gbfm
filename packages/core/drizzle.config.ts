import { Resource } from "sst"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "src/db/models/**/**schema.ts",
  dialect: "postgresql",
  out: "src/db/migrations",
  dbCredentials: {
    url: Resource.SquealDBUrl.value,
  },
  verbose: true,
  strict: true,
})
