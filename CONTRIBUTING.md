# Contributing to Glance

Thank you for your interest in contributing to Glance! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)

## Code of Conduct

Please be respectful and constructive in all interactions. We're building something together.

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm 10 or later
- Git

### Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/glance.git
   cd glance
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

4. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
glance/
├── src/
│   ├── app/                    # Next.js App Router pages and API routes
│   │   ├── api/               # API endpoints
│   │   │   ├── widgets/       # Widget CRUD
│   │   │   ├── credentials/   # Credential management
│   │   │   └── custom-widgets/ # Custom widget execution
│   │   └── dashboard/         # Dashboard page
│   ├── components/
│   │   ├── dashboard/         # Dashboard-specific components
│   │   ├── ui/               # shadcn/ui components
│   │   └── widgets/          # Widget rendering components
│   ├── lib/
│   │   ├── db.ts             # SQLite database
│   │   ├── credentials.ts    # Encrypted credential store
│   │   ├── widget-sdk/       # Widget SDK (components, hooks)
│   │   └── store/            # Zustand state management
│   └── types/                # TypeScript type definitions
├── docs/                     # Documentation
├── scripts/                  # Utility scripts
└── public/                   # Static assets
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/widget-name` - New features
- `fix/issue-description` - Bug fixes
- `docs/section-name` - Documentation updates
- `refactor/component-name` - Code refactoring

### Commit Messages

Write clear, concise commit messages:

```
feat: add GitHub PR count badge to widget

- Show total open PRs in header
- Add refresh button
- Handle rate limiting gracefully
```

Prefixes:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting (no code change)
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### Testing Your Changes

Before submitting:

1. **Run the linter**

   ```bash
   npm run lint
   ```

2. **Check TypeScript types**

   ```bash
   npx tsc --noEmit
   ```

3. **Build the project**

   ```bash
   npm run build
   ```

4. **Test manually**
   - Start the dev server
   - Test your changes in the browser
   - Check both light and dark modes
   - Test with different widget configurations

## Pull Request Process

1. **Create a pull request** against the `main` branch

2. **Fill out the PR template** with:
   - Description of changes
   - Screenshots (for UI changes)
   - Testing steps
   - Related issues

3. **Wait for review** - maintainers will review your PR

4. **Address feedback** - make requested changes

5. **Merge** - once approved, your PR will be merged

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define explicit types for function parameters and return values
- Avoid `any` - use `unknown` if type is truly unknown

### React

- Use functional components with hooks
- Keep components focused and small
- Extract reusable logic into custom hooks

### Styling

- Use Tailwind CSS utility classes
- Follow the existing component patterns
- Support both light and dark modes

### File Organization

- One component per file
- Colocate related files (component + types + styles)
- Use barrel exports (`index.ts`) for directories

### API Routes

- Validate all inputs
- Return consistent error formats
- Use appropriate HTTP status codes

## Widget Development

If you're creating or improving widgets:

1. **Read the Widget SDK docs** at `docs/widget-sdk.md`

2. **Use SDK components** - don't reinvent the wheel

3. **Handle all states**:
   - Loading state
   - Error state
   - Empty state
   - Success state

4. **Be responsive** - widgets can be resized

5. **Test with real data** - use actual API responses

## Questions?

- Open a [GitHub Discussion](https://github.com/acfranzen/glance/discussions) for questions
- Open an [Issue](https://github.com/acfranzen/glance/issues) for bugs or feature requests

Thank you for contributing!
