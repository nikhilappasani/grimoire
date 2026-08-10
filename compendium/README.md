# Compendium

Everything one interview produces, one folder per capability.

```text
compendium/
└── <slug>/
    ├── transcript.md      the full Q&A, verbatim, in question order
    ├── documents/         source documents as supplied
    └── knowledge/         OKF concepts distilled from the interview
        ├── index.md
        └── <type-directory>/<concept>.md
```

Each concept carries a `type` (what shape it is) and a `category` (what area it concerns), plus
enforced provenance: `source_system`, `resource`, `timestamp`, `sensitivity`. `transcript.md` opens
with a capture header recording who was interviewed, in what role, when, and against which versions.
`grimoire compendium-push` refuses a capture without it.

Concepts are foldered by their `type`, so `Reference` goes in `references/`, `Playbook` in
`playbooks/`, and so on. The full mapping is in
`skills/loreweaver/references/KNOWLEDGE-CAPTURE-OKF.md` §2, and `grimoire check-knowledge` fails the
build if a concept's folder disagrees with its type. A path is a concept's identity; a tree that
lies about what it holds is worse than no tree.

## Why everything stays together

A reviewer judging whether a concept is correct needs the transcript line it came from and the
document that backs it. Split across roots, checking one claim means reading two repositories.

This is **not** the shared `knowledge/` root. That root holds the curated base a running skill reads,
and it is filled later, when a capture is approved and a skill is built from it. Concepts here are
drafts under review. Promoting on build keeps the shared base curated by construction instead of
accumulating concepts from captures nobody merged.

## The sensitivity rule

A document classified confidential, or containing secrets or personal data, is never copied in here.
It gets a short neutral note plus its `resource:` link, never the content itself. Identical to the
rule for knowledge concepts. See `skills/loreweaver/references/KNOWLEDGE-CAPTURE-OKF.md` §7.

## Writing, and publishing

LoreWeaver writes the capture here at the close of an interview (see
`skills/loreweaver/references/OUTPUT-CONTRACT.md` §3), then publishes it in two steps:

```bash
grimoire compendium-push <slug> --review              # prints the content and a digest
grimoire compendium-push <slug> --auto --reviewed <digest>
```

You read the content and approve it; the digest binds that approval to the exact bytes you saw, and
the push is refused if they change. Nothing reaches a remote unreviewed.

That script is the **only** path from Grimoire to a remote. It secret-scans every file (a hit blocks
the publish outright, with no override), commits the slug to a `compendium/<slug>` review branch cut
from the remote's tip, and pushes that branch. Never `main`. Never `--force`. The Compendium
repository's CI opens the pull request, so the interviewing machine needs nothing but git push
access: no `gh`, no API token. A human reviews and merges.

## Where this points

This directory is the **default** `compendium` root. Point `GRIMOIRE_COMPENDIUM_ROOT` or
`roots.compendium` in `grimoire.config.json` at a separate repository to use that instead, or set
`compendiumRepository` to its git URL and let the publish script maintain its own clone under
`~/.grimoire/compendium`, the zero-setup path for a fresh machine.
