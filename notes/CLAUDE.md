# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo built with SST (Serverless Stack) managing multiple packages through Bun workspaces. The architecture follows a clear separation of concerns:

- **`web/`** - Frontend React app using Vite, TanStack Router, and Tailwind CSS
- **`backend/`** - Lambda functions using Hono framework for API routes  
- **`core/`** - Shared business logic, database schemas (Drizzle ORM), and email templates
- **`vps/`** - VPS-hosted API service with Hono, also using Drizzle ORM
- **`mobile/`** - Expo/React Native mobile app
- **`infra/`** - SST infrastructure definitions (imported automatically by sst.config.ts)

## Development Commands

### Root Level Commands
- pnpm add - to add dependencies. This project uses pnpm for package management!
- `bun dev` - Start SST development environment
- `bun typecheck` - Type check all workspace packages
- `bun deploy` - Deploy to dev stage
- `bun deploy:prod` - Deploy to production stage

### Web Package (`web/`)
- `bun dev` - Start Vite dev server
- `bun build` - Build for production (includes typecheck)
- `bun bio` - Run Biome linting and formatting
- `bun typecheck` - TypeScript type checking

### VPS Package (`vps/`)
- `bun dev` - Start development server with hot reload
- `bun db:studio` - Launch Drizzle Studio
- `bun db:yeet` - Push schema changes to database
- `bun db:gen` - Generate database migrations
- `bun db:migrate` - Run migrations
- `bun db:migrate:prod` - Run migrations on production

### Core Package (`core/`)
- `bun dev` - Start email development server
- `bun db:seed` - Seed development database
- `bun db:seed:mixes` - Seed mix data specifically

### Mobile Package (`mobile/`)
- `bun start` - Start Expo dev server
- `bun ios` - Start iOS development
- `bun android` - Start Android development

## Key Architecture Patterns

### Database Strategy
- Uses Drizzle ORM with PostgreSQL
- Database schemas defined in `core/src/drizzle/schemas/`
- Migration files in `core/migrations/` and `vps/drizzle/`
- Separate repositories pattern for data access (see `core/src/user/` for examples)

### API Architecture
- **Backend package**: AWS Lambda functions with Hono framework
- **VPS package**: Self-hosted API also using Hono
- Both use similar patterns but different deployment strategies
- OpenAPI documentation generated via `@hono/zod-openapi`

### Frontend Architecture
- React 19 with TanStack Router for routing
- State management via Zustand stores (`web/src/store/`)
- Component library using Radix UI primitives (`web/src/components/ui/`)
- MDX support for content rendering

### Authentication
- Lucia-based authentication strategy
- Session management via database tables
- JWT tokens for API communication

### Infrastructure
- AWS-based deployment via SST
- Cloudflare integration for DNS
- SES for transactional emails
- S3 for file storage

## Common Development Workflows

### Making Database Changes
1. Modify schemas in `core/src/drizzle/schemas/` or `vps/drizzle/schema.ts`
2. Generate migrations: `bun db:gen` (from appropriate package)
3. Apply migrations: `bun db:migrate`
4. For production: `bun db:migrate:prod` (vps package)

### Adding New API Routes
- Backend: Add to `backend/src/api/`
- VPS: Add to `vps/src/api/`
- Both use Hono framework with Zod validation

### Code Quality
- Frontend uses Biome for linting/formatting: `bun bio`
- TypeScript checking across all packages: `bun typecheck`
- No specific test commands found - verify with codebase owner

## Environment Configuration
- SST handles environment variables and secrets
- Development stage: `--stage=dev` (default)
- Production stage: `--stage=prod`
