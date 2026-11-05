---
name: Anti-AI Design
description: Plain paper-and-ink identity for the project's README art and documents. One red accent, a serif for headings, system mono for code. No site exists yet.
colors:
  paper: "#f4f1ea"
  ink: "#1c1b19"
  muted: "#5a574f"
  accent: "#b3361c"
typography:
  heading:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "ui-monospace, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0px"
---

# Design System: Anti-AI Design

## 1. Overview

This file describes the identity of what the project publishes today: the README diagram in `docs/images/overview.svg` and the documents next to it. There is no website yet. When one exists, extend this file instead of replacing it.

The look is a printed page: warm paper, near-black ink, square corners, hairline-free flat shapes, and a single red used for the one thing that should be followed (an arrow, a flagged finding). It is deliberately the opposite of the patterns the detector flags.

## 2. Colors

- **Paper** (`#f4f1ea`): page ground.
- **Ink** (`#1c1b19`): text and outlines.
- **Muted** (`#5a574f`): captions and notes.
- **Accent** (`#b3361c`): arrows and flagged items. The only accent.

Ink on paper and muted on paper both clear the WCAG AA contrast ratio for small text. Accent is used for strokes, not for body text.

## 3. Typography

Headings use a system serif (Georgia). Code, labels and captions use the system monospace stack. No web fonts are loaded, so nothing is fetched and nothing flashes.

## 4. Shape and elevation

Square corners, 2px outlines, no shadows, no gradients, no blur.

## 5. Do's and Don'ts

- **Do** keep to one accent color and let paper and ink carry the rest.
- **Do** give every image an accurate title and description.
- **Don't** add gradients, glows, glass or decorative icons.
- **Don't** reuse artwork from the upstream project; make an original drawing instead.
