# AGENTS.md

This file provides guidance to Coding Agent when working with code in this repository.

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

### Domain Layer Design Principles

This project follows **Dependency Inversion Principle (DIP)** with a clean separation between domain and infrastructure layers.

**Domain Layer** (`app/backend/domain/`):

- Must be **infrastructure-agnostic**
- Class names, interface names, and type names must NOT contain infrastructure technology names (R2, D1, S3, Cloudflare, AWS, etc.)
- Examples:
  - ✅ `StoredObjectMetadata`, `IStoredObjectStorage`, `ObjectKey`, `ISyncService`
  - ❌ `R2FileMetadata`, `IR2FileStorage`, `S3ObjectKey`, `CloudflareSyncService`
- Domain defines interfaces; infrastructure implements them
- This allows swapping infrastructure (e.g., R2 → S3) without changing domain code

**Infrastructure Layer** (`app/backend/infra/`):

- **May use specific technology names** in directory and file names
- Examples: `infra/r2/`, `infra/d1/`, `infra/s3/`
- Implements domain interfaces with concrete technology
- Contains technology-specific adapters and configurations

**Why this matters**:

- Future flexibility: Can switch from R2 to S3 without domain changes
- Testability: Domain logic can be tested with mock implementations
- Clean architecture: Business logic is decoupled from infrastructure details

### CQRS Pattern (Mandatory)

Repositories MUST be split into Command (write) and Query (read) following the pattern in the existing codebase.

**File naming**:

- `*.command-repository.interface.ts` — write-only interface in domain layer
- `*.query-repository.interface.ts` — read-only interface in domain layer
- `*.command-repository.ts` — Command implementation in infra layer
- `*.query-repository.ts` — Query implementation in infra layer

**Example**:

```typescript
// domain/error-log/error-log.command-repository.interface.ts
export interface IErrorLogCommandRepository {
  save(errorLog: ErrorLog<IUnpersisted>): Promise<ErrorLog<IPersisted>>;
  delete(id: string): Promise<void>;
}

// domain/error-log/error-log.query-repository.interface.ts
export interface IErrorLogQueryRepository {
  findById(id: string): Promise<ErrorLog<IPersisted> | undefined>;
  findAll(): Promise<ErrorLog<IPersisted>[]>;
}
```

### Value Object (VO) Pattern

**File naming**: `*.vo.ts` (e.g., `slug.vo.ts`, `log-level.vo.ts`)

**Required structure**:

```typescript
export class Slug implements IValueObject<Slug> {
  private constructor(readonly value: string) {} // private constructor

  static create(value: string): Slug {
    // factory with validation
    if (!Slug.isValid(value)) throw new Error(`Invalid slug: ${value}`);
    return new Slug(value);
  }

  equals(other: Slug): boolean {
    return this.value === other.value;
  }
  toJSON(): string {
    return this.value;
  }

  private static isValid(value: string): boolean {
    return value.length > 0;
  }
}
```

### Entity Persistence State Pattern

Use `IPersisted` / `IUnpersisted` generics to distinguish database state at compile-time.

```typescript
// New entity (not saved yet)
static create(params: { ... }): ErrorLog<IUnpersisted>

// Reconstructed from DB
static reconstruct(params: { id: string; createdAt: Temporal.Instant; ... }): ErrorLog<IPersisted>
```

This makes it a compile-time error to pass an unsaved entity where a persisted one is required.

### Domain Directory Structure

```
domain/
├── aggregate-name/
│   ├── aggregate-name.entity.ts
│   ├── aggregate-name.entity.test.ts
│   ├── aggregate-name.command-repository.interface.ts
│   ├── aggregate-name.query-repository.interface.ts
│   ├── some-concept.vo.ts
│   ├── some-concept.vo.test.ts
│   └── usecases/
│       └── do-something.usecase.ts
├── entity.interface.ts
├── value-object.interface.ts
├── persisted.interface.ts
└── unpersisted.interface.ts

infra/
├── d1/
│   ├── schema/
│   │   ├── index.ts
│   │   └── *.table.ts
│   └── aggregate-name/
│       ├── aggregate-name.command-repository.ts
│       └── aggregate-name.query-repository.ts
└── r2/
    └── aggregate-name.storage.ts
```

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

### Functional Programming (Mandatory)

This project enforces functional programming principles throughout.

**Non-destructive operations** — Never mutate existing data structures:

```typescript
// ❌ Destructive (forbidden)
array.push(item);
array.sort(compareFn);
array.splice(0, 1);
obj.key = value;

// ✅ Non-destructive (required)
const newArray = [...array, item];
const sorted = array.toSorted(compareFn); // ES2023
const sliced = array.toSpliced(0, 1); // ES2023
const newObj = { ...obj, key: value };
```

Prefer ES2023 non-destructive array methods: `toSorted()`, `toReversed()`, `toSpliced()`, `with()`.

**Pure functions** — Functions must not produce side effects and must return the same output for the same input:

```typescript
// ❌ Impure (forbidden)
let total = 0;
function addToTotal(n: number): void {
  total += n;
}

// ✅ Pure (required)
function add(a: number, b: number): number {
  return a + b;
}
```

**Declarative style** — Express _what_ to compute, not _how_ to iterate:

```typescript
// ❌ Imperative (avoid)
const result = [];
for (const item of items) {
  if (item.active) result.push(item.value * 2);
}

// ✅ Declarative (required)
const result = items
  .filter((item) => item.active)
  .map((item) => item.value * 2);
```

Use `map()`, `filter()`, `reduce()`, `flatMap()` and similar higher-order functions in place of imperative loops wherever practical.

### Test-Driven Development (Mandatory)

Follow the Red → Green → Refactor cycle for all implementation work:

1. **Red**: Write a failing test that captures the desired behavior before writing any implementation code.
2. **Green**: Write the minimum implementation to make the test pass.
3. **Refactor**: Clean up the code while keeping all tests green.

Rules:

- Never write implementation code without a corresponding test written first.
- Each test must target a single behavior or edge case.
- Tests are the living specification — if a behavior is not tested, it does not exist.

### Immutability

Use `readonly` on all properties and array types that should not be mutated. Use `as const` for literal values used as constants.

```typescript
// ✅
interface Config {
  readonly baseUrl: string;
  readonly retries: number;
}

function process(items: readonly string[]): readonly string[] { ... }

const ALLOWED_EXTENSIONS = ["png", "jpg", "webp"] as const;
```

Never use `readonly` as a workaround for a design problem — if a property genuinely needs to change, model it as a new value (return a new object).

### Error Handling Strategy

**Domain errors** are modeled as typed classes, not plain `Error`. Define custom error classes in the domain layer:

```typescript
// domain/stored-object/errors.ts
export class ObjectNotFoundError extends Error {
  constructor(objectKey: string) {
    super(`Object not found: ${objectKey}`);
    this.name = "ObjectNotFoundError";
  }
}
```

**HTTP mapping** is done exclusively in the handler layer — never inside domain or service code:

```typescript
// handler
try {
  const result = await useCase.execute(key);
  return c.json(result);
} catch (err) {
  if (err instanceof ObjectNotFoundError)
    return c.json({ error: err.message }, 404);
  throw err;
}
```

Domain and service layers must not import Hono or any HTTP primitives.

### Guard Clauses (Early Return)

Reduce nesting by returning or throwing early instead of wrapping logic in `if` blocks:

```typescript
// ❌ Nested (avoid)
function process(user: User | undefined): string {
  if (user) {
    if (user.isActive) {
      return user.name;
    }
  }
  return "";
}

// ✅ Guard clauses (required)
function process(user: User | undefined): string {
  if (!user) return "";
  if (!user.isActive) return "";
  return user.name;
}
```

### No Boolean Flag Parameters

Boolean arguments hide intent at the call site. Replace them with named options or separate functions:

```typescript
// ❌ Unclear at call site
upsert(metadata, true);

// ✅ Named option
upsert(metadata, { preserveDownloadCount: true });

// ✅ Or separate functions
insert(metadata);
update(metadata);
```

### Single Responsibility

Each function and class must do exactly one thing. When you find yourself writing "and" to describe what a function does, split it.

- Functions: aim for ≤ 20 lines; anything longer is a candidate for extraction.
- Classes: one reason to change. A repository class must not also contain business logic.
- Files: one primary export. Co-locate related helpers, but avoid mixing unrelated concerns.

## Git Workflow

### Commit Messages and Pull Requests

This project uses **squash merge** for Pull Requests. Individual commit messages do not need to follow conventional commit format. Only the Pull Request title should follow conventional commit format.

**Conventional Commit Format for PR Titles**:

- `feat: description` - New features
- `fix: description` - Bug fixes
- `docs: description` - Documentation changes
- `chore: description` - Maintenance tasks
- `ci: description` - CI/CD changes
- `refactor: description` - Code refactoring
- `test: description` - Test additions or modifications
- `style: description` - Code style changes (formatting, etc.)

**Example Workflow**:

1. Create feature branch and make commits with descriptive messages (conventional commit format is optional)
2. Open Pull Request with title in conventional commit format (e.g., `feat: add user authentication`)
3. Squash merge to main - the PR title becomes the commit message on main branch

**Note**: Since all commits are squashed on merge, focus on clear, descriptive commit messages during development without worrying about strict conventional commit format. The PR title is what matters for the final commit history on the main branch.

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

## AI-DLC and Spec-Driven Development

Kiro-style Spec Driven Development implementation on AI-DLC (AI Development Life Cycle)

### Project Context

#### Paths

- Steering: `.kiro/steering/`
- Specs: `.kiro/specs/`

#### Steering vs Specification

**Steering** (`.kiro/steering/`) - Guide AI with project-wide rules and context
**Specs** (`.kiro/specs/`) - Formalize development process for individual features

#### Active Specifications

- Check `.kiro/specs/` for active specifications
- Use `/kiro:spec-status [feature-name]` to check progress

### Development Guidelines

- Think in English, generate responses in Japanese. All Markdown content written to project files (e.g., requirements.md, design.md, tasks.md, research.md, validation reports) MUST be written in the target language configured for this specification (see spec.json.language).

### Minimal Workflow

- Phase 0 (optional): `/kiro:steering`, `/kiro:steering-custom`
- Phase 1 (Specification):
  - `/kiro:spec-init "description"`
  - `/kiro:spec-requirements {feature}`
  - `/kiro:validate-gap {feature}` (optional: for existing codebase)
  - `/kiro:spec-design {feature} [-y]`
  - `/kiro:validate-design {feature}` (optional: design review)
  - `/kiro:spec-tasks {feature} [-y]`
- Phase 2 (Implementation): `/kiro:spec-impl {feature} [tasks]`
  - `/kiro:validate-impl {feature}` (optional: after implementation)
- Progress check: `/kiro:spec-status {feature}` (use anytime)

### Development Rules

- 3-phase approval workflow: Requirements → Design → Tasks → Implementation
- Human review required each phase; use `-y` only for intentional fast-track
- Keep steering current and verify alignment with `/kiro:spec-status`
- Follow the user's instructions precisely, and within that scope act autonomously: gather the necessary context and complete the requested work end-to-end in this run, asking questions only when essential information is missing or the instructions are critically ambiguous.

### Steering Configuration

- Load entire `.kiro/steering/` as project memory
- Default files: `product.md`, `tech.md`, `structure.md`
- Custom files are supported (managed via `/kiro:steering-custom`)
