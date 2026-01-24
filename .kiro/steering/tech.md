# Technology Stack

## Architecture

**Hybrid SSR + API Architecture**: Cloudflare Workers entry point routes requests through Hono middleware, which delegates to either API handlers or React Router SSR based on path matching. API routes are handled directly, while all other routes pass through to React Router for server-side rendering.

**Request Flow**: Workers (`workers/app.ts`) → Hono Backend (`app/backend/`) → React Router SSR (`app/frontend/`) or API response

## Core Technologies

- **Language**: TypeScript (strict mode)
- **Frontend Framework**: React 19 with React Router 7 (SSR-enabled)
- **Backend Framework**: Hono v4 (API middleware)
- **Runtime**: Node.js 24.11.1 (development), Cloudflare Workers (production)
- **Deployment**: Cloudflare Workers with Wrangler CLI
- **Package Manager**: pnpm 9.15.4

## Key Libraries

- **Styling**: TailwindCSS v4 with Vite plugin
- **Testing**: Vitest with happy-dom environment, React Testing Library
- **Bot Detection**: isbot (for SSR streaming optimization)
- **Build Tool**: Vite 7 with React Router dev plugin

## Development Standards

### Type Safety

- TypeScript strict mode enabled across all projects
- Separate tsconfig files for application code (`tsconfig.cloudflare.json`) and build tools (`tsconfig.node.json`)
- Explicit function return types required (except arrow function expressions)
- Inline type imports preferred: `import { type User, getUser } from "..."`
- Project references enabled for incremental builds

### Code Quality

- **ESLint**: TypeScript strict type-checked rules with security plugins
- **Prettier**: Automatic formatting (integrated with ESLint)
- **Naming Conventions**:
  - Boolean variables must use `is/has/should/can/will/did` prefix + PascalCase
  - Variables: camelCase, Functions: camelCase or PascalCase (React components)
  - Types/Interfaces: PascalCase
- **Import Ordering**: Automatic sorting (builtin → external → internal → parent → sibling → index → object → type)
- **Security**: eslint-plugin-security and eslint-plugin-no-secrets detect vulnerabilities

### Testing

- Vitest with happy-dom for DOM simulation
- Test files: `**/*.test.{ts,tsx}` pattern
- Relaxed rules for test files (async/await, magic numbers, unsafe assignments)
- Commands: `pnpm run test` (watch), `pnpm run test:run` (once)

## Development Environment

### Required Tools

- Node.js 24.11.1 (managed via DevContainer features)
- pnpm 9.15.4
- Wrangler CLI (Cloudflare Workers deployment)

### Common Commands

```bash
# Development
pnpm run dev              # Start dev server (http://0.0.0.0:5173)
pnpm run typecheck        # TypeScript type checking

# Build & Deploy
pnpm run build            # Production build
pnpm run deploy           # Build + deploy to Cloudflare
npx wrangler versions upload   # Deploy preview version
npx wrangler versions deploy   # Promote to production

# Code Quality
pnpm run fix              # Auto-fix lint + format
pnpm run test             # Run tests in watch mode
```

## Key Technical Decisions

**Why React Router 7**: Modern SSR framework with file-based routing, built-in data loading, and Vite integration for optimal developer experience.

**Why Hono**: Lightweight edge-compatible middleware framework that wraps React Router handler, enabling API routes without additional complexity.

**Why Cloudflare Workers**: Edge deployment with global distribution, low latency, and built-in observability without server management.

**Why Strict TypeScript**: Comprehensive type safety (strict mode + ESLint type-checked rules) prevents runtime errors and improves maintainability.

**Path Alias Strategy**: Single `~/` alias maps to `./app/` for consistent imports across frontend, backend, and shared utilities.

**SSR Bot Detection**: Different streaming strategies for bots (wait for `allReady`) vs. users (stream immediately) optimizes SEO and perceived performance.

---

_created_at: 2026-01-24_
