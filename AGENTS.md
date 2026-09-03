# AIBUS workflow

## Scope

- This repository uses only the AIBUS project in each work tracker.
- Asana project: `aibus` (`1217763072063613`). Asana remains the coordination source of truth.
- Plane workspace: `adam` at `https://plane.adam.uz`; use only AIBUS project `d703e7b9-7349-498a-9659-1406a928c6b7`.
- `.todos/` is the local execution mirror. Never write tracker items into another project.

## Task synchronization

Every non-trivial task must exist in Asana, Plane, and `.todos/`. Keep both remote IDs on the local line:

```markdown
- [ ] 🟠 🔨 Task title <!-- asana:<gid> plane:<uuid> -->
```

Update Asana first, Plane second, then `.todos/`. Stop on any failed write or mismatch.

| State | `.todos` | Asana | Plane |
| --- | --- | --- | --- |
| Queued | `todo.md` | Todo, incomplete | Todo |
| Active | `inprogress.md` | In Progress, incomplete | In Progress |
| Review | `inprogress.md` | In Review, incomplete | In Review |
| Verified | `done.md` | Done, complete | Done |

Do not complete a task until code verification, GitLab CI, and remote-state reconciliation succeed.

## GitLab delivery

- Canonical repository: `https://gitlab.adam.uz/adam/aibus.git` after the initial migration is verified.
- Use short-lived feature/fix branches; do not push feature work directly to `main`.
- Push the branch, open a merge request, link the Plane and Asana task IDs, and require passing CI before merge.
- Move trackers to In Review when the merge request opens; move to Done only after merge and successful target-branch CI.
- Never place Plane, GitLab, Telegram, or other secrets in tracked files; use macOS Keychain or protected GitLab CI variables.
