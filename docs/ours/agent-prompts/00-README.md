# Agent prompts: run order

Paste ONE file per new session. The dashboard (python3 tools/dashboard/serve.py -> http://localhost:4173) shows progress.

1. The long-running session keeps going (tasks 46-49). Do not touch its files.
2. NOW, in parallel (touch only their own files, worktrees from `main`):
   - A4-branding.md
   - A5-release.md
3. Tell the assistant here when the long-running session is idle -> it does the repo clean-up (remove .env/.pnpm from git, scrub history, add the Choxie77 remote, create `integration`).
4. Then R-rename.md alone (nothing else running).
5. Then Z-integrator.md.
