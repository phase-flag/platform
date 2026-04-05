## Summary of Changes

<!-- Briefly describe what this PR does and why. Reference any related issues with "Fixes #123" or "Closes #123". -->

## Type of Change

<!-- Check all that apply. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behaviour — requires a major version bump and migration guide)
- [ ] Performance improvement
- [ ] Refactor (no functional change)
- [ ] Documentation update
- [ ] CI / infrastructure change

## Testing Done

<!-- Describe the tests you ran and how to reproduce them. Include relevant command output where helpful. -->

```bash
# Example
cd core/api
poetry run pytest tests/ -v
```

## Checklist

- [ ] All existing tests pass (`poetry run pytest` / `npm test` / `go test ./...`)
- [ ] New tests added for new behaviour or bug fix
- [ ] Linting passes (`ruff check .` / `npm run lint` / `gofmt -l .`)
- [ ] Documentation updated (inline docstrings, `docs/` pages, or README) where applicable
- [ ] Breaking changes are clearly described above and a migration path is provided
- [ ] No secrets, credentials, or personally identifiable information are included
- [ ] Alembic migration included if the data model changed (and migration is reversible)

## Screenshots (if applicable)

<!-- For UI changes, before/after screenshots help reviewers a lot. -->
