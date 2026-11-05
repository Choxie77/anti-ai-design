# Product

<!-- anti-design:product-schema 1 -->

## Platform

web

## Users

Developers, designers and product people who build interfaces with an AI coding agent and are tired of results that all look the same. They already know the problem. They want a tool they can run today, inside the agent they use, that names the problem on a specific file and helps fix it.

## Product Purpose

Anti-AI Design gives an agent a shared design vocabulary (24 commands, each backed by a focused playbook) and gives the team a deterministic detector that flags the habits that make generated interfaces look alike. Success means two things: a person can steer the agent with a named move instead of vague prose, and the interface that comes back passes a design review rather than reading as machine-made.

## Positioning

One source tree, three surfaces: the skill, a command-line detector that needs no model and no API key, and live iteration in the browser. The same design vocabulary is generated for each supported coding tool, so teams do not keep separate prompts per tool. The project is a modified fork of Impeccable (see `UPSTREAM.md`); what we add and change is recorded in the git history.

## Operating Context

Someone installs the skill (from a release when one exists, from source today), runs `init` once so the agent records who the product is for, then directs work through the commands. The detector runs in three places: as a hook in the agent's edit loop, from a terminal or CI, and against a rendered page. Maintainers edit the sources under `skill/`, `crates/`, `scripts/` and `cli/`; the per-tool folders in the repository are generated.

## Capabilities and Constraints

- The skill exposes 24 commands. One of them, `craft`, is a deprecated alias for an ordinary build request.
- The detector's rules are fixed and deterministic. Judgment about whether a design is good stays with a person or with the skill's `critique` command.
- Several parts of the fork call a hosted service that does not exist yet (the `help` command list, the visual-direction catalog, engine downloads). Anything that depends on one must say so rather than fail silently.
- The project is pre-release. Do not describe features as shipped, published or tested end to end unless that has been checked.
- Do not invent customers, testimonials, benchmarks or pricing.

## Brand Commitments

Plain, specific and direct. Say what a command does and what a rule flags. Avoid hype, avoid hedging, and do not lecture people about a problem they already know they have.

Three-word personality: **plain, exact, unfussy**.

The project's own surfaces should pass its own detector. Avoid in anything we publish:

- Generic AI-tool marketing: purple gradients, neon on black, glassmorphism, glowing particles.
- Landing-page filler: hero metrics, identical feature-card grids, "boost your productivity" copy.
- Decoration with no job to do.

## Evidence on Hand

- `README.md` and `README.npm.md` describe the command set, installation paths and detector behavior as they work today, checked against the engine's own `--help` output.
- `skill/` holds the playbooks; `tests/` holds regression coverage for the build and runtime.
- `crates/` and `cli/` are the working engine and launcher.
- There are no customer quotes or quantified outcome studies on record.

## Product Principles

1. **Say only what is true.** A claim in the README must be something we ran or can point to.
2. **Name the move.** A command should tell the agent exactly what kind of change to make and to what.
3. **Same answer every run.** The detector must not depend on a model or on chance.
4. **Pass our own checks.** Our docs, diagrams and demos should not trip the rules we ship.
5. **Credit the source.** The fork notice stays visible and accurate.

## Accessibility & Inclusion

Baseline: WCAG 2.1 AA for anything we publish. Contrast is measured, not judged by eye. Interactive elements work with a keyboard and show focus. Motion respects `prefers-reduced-motion`. Images carry accurate alt text. Copy is written to be readable at a plain-language level; design terms such as OKLCH are fine when they are the exact word.
