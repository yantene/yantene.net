# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Router 7 application with server-side rendering (SSR) deployed on Cloudflare Workers. The backend uses Hono to provide API routes alongside the React Router frontend.

## Development Commands

**Package Manager**: This project uses `pnpm`, not `npm`.

### Essential Commands
```bash
pnpm install              # Install dependencies
pnpm run dev              # Start dev server (runs on http://0.0.0.0:5173)
pnpm run build            # Build for production
pnpm run preview          # Preview production build locally
pnpm run typecheck        # Run TypeScript type checking
```

### Testing
```bash
pnpm run test             # Run tests in watch mode
pnpm run test:run         # Run tests once
```

Test files follow the pattern `**/*.test.{ts,tsx}` and use Vitest with happy-dom environment.

### Code Quality
```bash
pnpm run lint             # Lint with ESLint
pnpm run lint:fix         # Lint and auto-fix
pnpm run format           # Check formatting with Prettier
pnpm run format:fix       # Format with Prettier
pnpm run fix              # Run both lint:fix and format:fix
```

### Deployment
```bash
pnpm run deploy           # Build and deploy to Cloudflare Workers
npx wrangler versions upload    # Deploy preview version
npx wrangler versions deploy    # Promote version to production
```

## Architecture

### Directory Structure

```
app/
├── frontend/          # React Router application (appDirectory in config)
│   ├── routes/        # Route modules
│   ├── root.tsx       # Root layout
│   └── entry.server.tsx  # Server entry point for SSR
├── backend/           # Hono backend application
│   └── index.ts       # Backend exports getApp() function
└── lib/               # Shared utilities across frontend and backend

workers/
└── app.ts             # Cloudflare Workers entry point
```

### Path Aliases

- `~/` maps to `./app/` (configured in tsconfig.cloudflare.json)
- Example: `import { getApp } from "~/backend"` resolves to `app/backend/index.ts`

### Request Flow

1. **Cloudflare Workers** (`workers/app.ts`) receives the request
2. **Hono Backend** (`app/backend/index.ts`) handles routing:
   - API routes (e.g., `/hello`) are handled by Hono directly
   - All other routes (`*`) are forwarded to React Router
3. **React Router** (`app/frontend/`) handles SSR and client-side routing

The backend uses a factory pattern: `getApp(handler)` creates a Hono app that wraps the React Router handler. This allows API routes to coexist with the SSR frontend.

### SSR Configuration

- SSR is enabled in `react-router.config.ts`
- `entry.server.tsx` handles streaming SSR with bot detection (using `isbot`)
- Bots and crawlers wait for full content before response (`body.allReady`)

## TypeScript Configuration

- Strict mode enabled throughout
- Two separate tsconfig files:
  - `tsconfig.cloudflare.json`: For application code (frontend, backend, workers)
  - `tsconfig.node.json`: For build/config files (vite.config.ts, eslint.config.ts, etc.)

## Code Style and Conventions

### Naming Conventions (Enforced by ESLint)

- **Boolean variables**: Must have prefix `is`, `has`, `should`, `can`, `will`, or `did` followed by PascalCase
  - ✅ `isLoading`, `hasError`, `canSubmit`
  - ❌ `loading`, `error`, `disabled`
- **Variables**: camelCase (leading underscore allowed for unused variables)
- **Functions**: camelCase or PascalCase (PascalCase for React components)
- **Types/Interfaces**: PascalCase
- **Constants (string/number)**: UPPER_CASE or camelCase

### Import Ordering

Imports are automatically ordered by ESLint:
1. builtin (Node.js)
2. external (npm packages)
3. internal
4. parent
5. sibling
6. index
7. object
8. type

No newlines between groups, alphabetically sorted.

### Type Imports

Use inline type imports:
```typescript
import { type User, getUser } from "~/lib/user";
```

### Strict Rules

- **Explicit return types**: Functions must have explicit return types (arrow functions with expressions are exempt)
- **Async/await**: No floating promises, no misused promises, all async functions must await
- **Boolean expressions**: Strict boolean checks (strings allowed, numbers not allowed)

### React-Specific Rules

- Route files (`**/routes/**/*.tsx`) and `root.tsx` are exempt from `react-refresh/only-export-components`
- Prop types disabled (TypeScript used instead)
- JSX runtime mode (no need to import React)

### Test Files

Test files have relaxed rules:
- `require-await` disabled
- Magic numbers allowed
- Unsafe assignments/member access allowed for mocking

## Language

**Japanese for Reviews**: According to `.github/copilot-instructions.md`, code reviews and feedback should be provided in Japanese.

## Key Dependencies

- **React Router 7**: SSR framework
- **Hono**: Backend/API framework
- **Cloudflare Workers**: Deployment platform
- **Vite**: Build tool
- **Vitest**: Test framework with happy-dom
- **TailwindCSS v4**: Styling
- **TypeScript**: Type safety with strict mode

## Security

The ESLint configuration includes security plugins:
- `eslint-plugin-security`: Detects security issues
- `eslint-plugin-no-secrets`: Prevents committing secrets
