# CI/CD Pipeline Documentation

## Overview

This project uses **GitHub Actions** for continuous integration and deployment. The pipeline consists of three main stages:

1. **Unit Tests** - Fast, isolated tests for both services
2. **Integration Tests** - Database-dependent tests with PostgreSQL
3. **Docker Build & Push** - Build and publish container images

---

## Pipeline Structure

```mermaid
graph TD
    A[Push/PR] --> B[Unit Tests - Subscription]
    A --> C[Unit Tests - Payment]
    B --> D[Integration Tests - Subscription]
    C --> D
    B --> E[Integration Tests - Payment]
    C --> E
    D --> F[Build & Push Images]
    E --> F
    F --> G[Deploy]
```

---

## Workflows

### Main CI Workflow (`.github/workflows/ci.yml`)

**Triggered by:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**Jobs:**

#### 1. Unit Tests (Parallel)
- `unit-test-subscription` - Runs subscription service unit tests
- `unit-test-payment` - Runs payment service unit tests

**Features:**
- Runs in parallel for speed
- Uploads coverage to Codecov
- Uses pnpm for fast dependency installation
- Caches dependencies

#### 2. Integration Tests (Parallel, After Unit Tests)
- `integration-test-subscription` - Subscription service integration tests
- `integration-test-payment` - Payment service integration tests

**Features:**
- Starts PostgreSQL 15 as a service
- Sets up test databases with Prisma
- Runs with real database connections
- Only runs if unit tests pass

#### 3. Build and Push (Matrix, After Integration Tests)
- `build-and-push` - Builds and pushes both Docker images

**Features:**
- Uses matrix strategy for parallel builds
- Builds for both `linux/amd64` and `linux/arm64`
- Pushes to GitHub Container Registry (ghcr.io)
- Creates multiple tags: branch, SHA, latest
- Only runs on push to main/develop
- Uses build cache for faster builds

---

## Local Testing

### Prerequisites

Install `act` to test GitHub Actions locally:

```bash
# macOS
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Windows (with Chocolatey)
choco install act-cli
```

### Quick Start

```bash
# Run quick local CI test
./scripts/test-ci-local.sh

# Or specific commands
./scripts/test-ci-local.sh unit      # Unit tests only
./scripts/test-ci-local.sh build     # Docker builds only
./scripts/test-ci-local.sh quick     # Quick workflow
./scripts/test-ci-local.sh list      # List all jobs
```

### Local Workflow (`ci-local.yml`)

A simplified workflow for local testing:
- Runs unit tests using matrix strategy
- Builds Docker images without pushing
- Faster execution for development

---

## Environment Variables

### Required Secrets

Add these to your GitHub repository secrets:

```bash
# Optional: Code coverage
CODECOV_TOKEN=your-codecov-token-here

# Note: GITHUB_TOKEN is automatically provided by GitHub Actions
```

### Test Environment Variables

These are configured in the workflow files:

```yaml
DATABASE_URL: postgresql://foodizone:foodizone_password@localhost:5432/foodizone?schema=subscription-test
JWT_SECRET: test-jwt-secret-key-for-testing-with-32-chars-minimum-length
JWT_REFRESH_SECRET: test-jwt-refresh-secret-key-for-testing-with-32-chars-minimum
PAYMENT_SERVICE_API_KEY: test-payment-api-key-12345
WEBHOOK_SECRET: test-webhook-secret-key-for-testing-with-32-chars
```

---

## Docker Image Registry

### Image Naming Convention

```
ghcr.io/<owner>/<repo>-<service>-service:<tag>
```

**Examples:**
```
ghcr.io/username/bills-subscription-service:main
ghcr.io/username/bills-subscription-service:develop
ghcr.io/username/bills-subscription-service:sha-abc123
ghcr.io/username/bills-payment-service:latest
```

### Available Tags

| Tag Pattern | Description | Example |
|-------------|-------------|---------|
| `main` | Main branch | `main` |
| `develop` | Develop branch | `develop` |
| `sha-<hash>` | Git commit SHA | `sha-abc123` |
| `latest` | Latest main branch | `latest` |
| `pr-<number>` | Pull request | `pr-42` |

---

## Pipeline Optimization

### Speed Optimizations

1. **Parallel Execution**
   - Unit tests run in parallel
   - Integration tests run in parallel
   - Docker builds use matrix strategy

2. **Caching**
   - pnpm dependencies cached
   - Docker layer caching with GitHub Actions cache
   - Build cache shared between runs

3. **Conditional Execution**
   - Docker push only on main/develop
   - Integration tests only after unit tests pass

### Build Times

| Stage | Time | Notes |
|-------|------|-------|
| Unit Tests | ~2-3 min | Per service, parallel |
| Integration Tests | ~3-5 min | Per service, parallel |
| Docker Build | ~3-4 min | Per service, parallel |
| **Total Pipeline** | **~10-12 min** | With all optimizations |

---

## Troubleshooting

### Common Issues

#### 1. Docker Build Fails

**Problem:** Lockfile out of date
```
ERR_PNPM_OUTDATED_LOCKFILE
```

**Solution:**
```bash
pnpm install
git add pnpm-lock.yaml
git commit -m "chore: update lockfile"
```

#### 2. Integration Tests Fail

**Problem:** Database connection timeout

**Solution:** Check PostgreSQL service health check in workflow

#### 3. Act Fails Locally

**Problem:** Docker-in-Docker not working

**Solution:** Use `ci-local.yml` workflow which skips integration tests

#### 4. Image Push Permission Denied

**Problem:** Missing packages write permission

**Solution:** Ensure `GITHUB_TOKEN` has `packages: write` permission

---

## Best Practices

### 1. Writing Tests

```typescript
// Good: Fast unit tests
it('should calculate total', () => {
  expect(calculateTotal(10, 20)).toBe(30);
});

// Good: Integration tests with real database
it('should create user in database', async () => {
  const user = await userService.create({ email: 'test@example.com' });
  expect(user.id).toBeDefined();
});
```

### 2. Workflow Maintenance

- Keep workflows DRY using matrix strategy
- Use reusable workflows for common patterns
- Document all environment variables
- Test locally before pushing

### 3. Docker Images

- Use multi-stage builds
- Minimize layer count
- Use .dockerignore
- Tag images appropriately

---

## Manual Workflows

### Trigger Manual Build

```bash
# Via GitHub CLI
gh workflow run ci.yml -f branch=main

# Via GitHub UI
Actions → CI/CD Pipeline → Run workflow
```

### Force Rebuild Docker Images

```bash
# Clear cache and rebuild
gh workflow run ci.yml -f cache=false
```

---

## Monitoring

### GitHub Actions Dashboard

Monitor pipeline status:
1. Go to repository → Actions tab
2. View recent workflow runs
3. Click on any run for detailed logs

### Codecov Integration

View test coverage:
1. Visit codecov.io dashboard
2. See coverage trends over time
3. Get coverage badge for README

### Container Registry

View published images:
1. Repository → Packages
2. Click on package name
3. See all tags and sizes

---

## Future Enhancements

### Planned Improvements

- [ ] E2E tests in pipeline
- [ ] Automatic semantic versioning
- [ ] Deployment to staging/production
- [ ] Performance testing
- [ ] Security scanning (Snyk, Trivy)
- [ ] Automated dependency updates (Dependabot)
- [ ] Slack/Discord notifications
- [ ] Rollback mechanism

### Performance Targets

| Metric | Current | Target |
|--------|---------|--------|
| Pipeline Time | 10-12 min | 8-10 min |
| Unit Test Coverage | 100% | 100% |
| Integration Coverage | 100% | 100% |
| Build Cache Hit Rate | 70% | 90% |

---

## Quick Reference

### Common Commands

```bash
# Test locally
./scripts/test-ci-local.sh quick

# Run specific job
act -W .github/workflows/ci.yml -j unit-test-subscription

# List all jobs
act -W .github/workflows/ci.yml -l

# Dry run (don't actually run)
act -W .github/workflows/ci.yml -n

# Run with specific event
act push -W .github/workflows/ci.yml
```

### Useful Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [act - Run GitHub Actions locally](https://github.com/nektos/act)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [pnpm Action](https://github.com/pnpm/action-setup)

---

## Support

For issues with CI/CD:
1. Check workflow logs in GitHub Actions
2. Test locally with `act`
3. Review this documentation
4. Check GitHub Actions status page
5. Create an issue in the repository

**Last Updated:** $(date)
**Pipeline Version:** 1.0.0

