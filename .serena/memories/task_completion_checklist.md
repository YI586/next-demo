# Task Completion Checklist

## Before Committing Code

### 1. Code Quality Checks

```bash
# Run type checking
pnpm type-check

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Verify all checks pass
pnpm lint && pnpm type-check && pnpm format:check
```

### 2. Git Workflow

```bash
# Create feature branch (if not already done)
git checkout -b task-{number}-{brief-description}

# Stage changes
git add .

# Commit with conventional format
git commit -m "feat(scope): task-{number} description"

# Push to remote
git push -u origin <branch-name>
```

### 3. Code Review Requirements

- **Type safety** - all TypeScript errors resolved
- **Linting** - all ESLint issues fixed
- **Formatting** - Prettier formatting applied
- **Testing** - manual testing completed (automated tests when implemented)
- **Documentation** - inline comments for complex logic

### 4. Commit Message Format

```
<type>(<scope>): task-{number} <description>

Types:
- feat: New feature
- fix: Bug fix
- refactor: Code refactoring
- chore: Maintenance tasks
- docs: Documentation changes
- style: Code style changes
- test: Adding or updating tests
```

### 5. Pull Request Requirements

- Clear title following task name
- Description linking to backlog task
- List of changes made
- Testing notes for QA validation
- No merge conflicts with main branch

## Verification Steps

1. Build succeeds: `pnpm build`
2. No type errors: `pnpm type-check`
3. No lint errors: `pnpm lint`
4. Code properly formatted: `pnpm format:check`
5. Git hooks pass (automatic on commit)
6. Manual testing completed
7. Feature branch pushed to remote
