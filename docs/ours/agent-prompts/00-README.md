# Agent prompts: run order

Paste ONE file per new session. The dashboard (python3 tools/dashboard/serve.py -> http://localhost:4173) shows progress.

1. The long-running session keeps going (tasks 46-49). Do not touch its files.
2. NOW, in parallel (touch only their own files, worktrees from `main`):
   - A4-branding.md
   - A5-release.md
   - B-contract-safefix.md  (tasks 47 + 48; the long-running session finished 46 and is idle)
3. DONE so far: branding, release and safefix are merged into main.
4. NOW: R-rename.md alone (all other sessions idle).
5. Then Z-integrator.md (it also reconciles local main with the GitHub history, see its notes).
