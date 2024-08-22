import { defineConfig } from "drizzle-kit"

console.log(process.env.DATABASE_URL)

export default defineConfig({
  schema: "src/db/schema/index.ts",
  dialect: "postgresql",
  out: "src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
    
  },
  verbose: true,
  strict: true,
})
