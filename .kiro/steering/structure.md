# Project Structure

## Organization Philosophy

**Domain Separation**: Application code split into three distinct domains within `app/`:

- `frontend/`: React Router application (SSR routes and components)
- `backend/`: Hono backend (API middleware and handlers)
- `lib/`: Shared utilities used across frontend and backend

**Workers Entry Point**: `workers/` contains Cloudflare Workers entry point that wires Hono backend with React Router SSR handler.

## Directory Patterns

### Frontend Domain

**Location**: `app/frontend/`
**Purpose**: React Router application with SSR
**Example**:

```
app/frontend/
├── routes/           # Route modules (file-based routing)
├── root.tsx          # Root layout with ErrorBoundary
├── entry.server.tsx  # SSR entry point (streaming, bot detection)
└── welcome/          # Feature modules (components + tests)
```

**Configuration**: `react-router.config.ts` sets `appDirectory: "app/frontend"`

### Backend Domain

**Location**: `app/backend/`
**Purpose**: Hono API middleware and route handlers
**Example**:

```typescript
// app/backend/index.ts
export const getApp = (handler) => {
  const app = new Hono()
    .get("/hello", (c) => c.text("Hello, World!"))
    .all("*", async (context) => handler(...));
  return app;
};
```

**Pattern**: Factory function that wraps React Router handler, enabling API routes to coexist with SSR.

### Shared Utilities

**Location**: `app/lib/`
**Purpose**: Code shared between frontend and backend
**Example**: `app/lib/constants/http-status.ts` (HTTP status code constants)

### Workers Entry Point

**Location**: `workers/app.ts`
**Purpose**: Cloudflare Workers entry point that wires everything together
**Pattern**:

```typescript
import { createRequestHandler } from "react-router";
import { getApp } from "~/backend";

const requestHandler = createRequestHandler(...);
const app = getApp(requestHandler);
export default app satisfies ExportedHandler<Env>;
```

### Configuration Files

**Location**: Root directory
**Purpose**: Build, deployment, and development tool configuration
**Key Files**:

- `react-router.config.ts`: React Router configuration
- `wrangler.jsonc`: Cloudflare Workers deployment config
- `eslint.config.ts`: ESLint flat config with strict rules
- `tsconfig.cloudflare.json`: Application TypeScript config
- `tsconfig.node.json`: Build tools TypeScript config

## Naming Conventions

- **Files**: camelCase, PascalCase, or kebab-case (enforced by ESLint unicorn/filename-case)
- **Components**: PascalCase (React components follow function naming convention)
- **Route Files**: kebab-case or PascalCase (e.g., `home.tsx`)
- **Test Files**: `*.test.{ts,tsx}` pattern
- **Boolean Variables**: `is/has/should/can/will/did` prefix + PascalCase (e.g., `isLoading`, `hasError`)

## Import Organization

```typescript
// Automatic ordering by ESLint import plugin
import path from "node:path"; // 1. builtin
import { Hono } from "hono"; // 2. external
import { getApp } from "~/backend"; // 3. internal (via alias)
import { type User } from "../types"; // 4. parent
import { Button } from "./button"; // 5. sibling
import type { Config } from "./types"; // 6. type
```

**Path Aliases**:

- `~/`: Maps to `./app/` (configured in `tsconfig.cloudflare.json`)
- Example: `import { getApp } from "~/backend"` resolves to `app/backend/index.ts`

**Type Imports**: Use inline style: `import { type User, getUser } from "..."`

## Code Organization Principles

**React Router Route Exemptions**: Files in `**/routes/**/*.tsx` and `root.tsx` are exempt from `react-refresh/only-export-components` to support React Router's special exports (`loader`, `action`, `meta`, `links`, etc.).

**Test File Relaxations**: `**/*.test.{ts,tsx}` files have relaxed ESLint rules (no `require-await`, magic numbers allowed) to enable flexible mocking and test assertions.

**Type Definition Separation**: Two TypeScript projects prevent mixing concerns:

- `tsconfig.cloudflare.json`: Application code (strict mode, DOM types)
- `tsconfig.node.json`: Build/config files (Node.js types)

**Factory Pattern for Backend**: `getApp(handler)` factory enables dependency injection of React Router handler, making backend testable and composable.

**Shared Constants**: Common constants live in `app/lib/constants/` for reuse across frontend and backend (e.g., HTTP status codes).

---

_created_at: 2026-01-24_
