# Suggested Commands for next-demo Project

## Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Run production build
pnpm start
```

## Code Quality Commands

```bash
# Type checking
pnpm type-check

# Linting
pnpm lint
pnpm lint:fix

# Code formatting
pnpm format
pnpm format:check
```

## Dependency Management

```bash
# Check for outdated packages
pnpm deps:check

# Update dependencies
pnpm deps:update

# Install new package
pnpm add <package-name>

# Install dev dependency
pnpm add -D <package-name>
```

## Git Workflow Commands

```bash
# Setup git hooks (run after clone)
pnpm prepare

# Create feature branch for task
git checkout -b task-{number}-{brief-description}

# Commit with conventional format
git commit -m "feat(scope): task-{number} description"

# Push feature branch
git push -u origin <branch-name>
```

## System Commands (Darwin)

```bash
# File operations
ls -la          # List files with details
find . -name    # Find files by name
grep -r         # Search in files recursively

# Directory navigation
cd              # Change directory
pwd             # Print working directory

# Git operations
git status      # Check git status
git diff        # Show changes
git log --oneline # Show commit history
```
