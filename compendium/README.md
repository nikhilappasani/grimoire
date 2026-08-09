# Compendium

The raw evidence behind a Capability Specification: the interview transcript and the source
documents the user supplied, one folder per capability.

```text
compendium/
└── <slug>/
    ├── transcript.md      the full Q&A, verbatim, in question order
    └── documents/         source documents as supplied
```

This is deliberately **not** the knowledge base. `knowledge/` holds small, distilled OKF concepts
meant to be read by a running skill. `compendium/` holds the bulkier, unprocessed material those
concepts were drawn from — it never goes through OKF distillation, and it's expected to grow larger
and messier than the knowledge base. Keeping them apart means document churn here never touches the
knowledge base's git history or its Obsidian-browsing experience.

A document classified confidential, or containing secrets or personal data, is never copied in here
either — the same rule that governs `knowledge/` concepts applies: a short neutral note plus its
`resource:` link, never the content itself. See
`skills/loreweaver/references/KNOWLEDGE-CAPTURE-OKF.md` §7.

## Writing, and publishing

LoreWeaver writes `transcript.md` and `documents/` here at the close of an interview — see
`skills/loreweaver/references/OUTPUT-CONTRACT.md` §3 — and then publishes them in two steps:

```bash
grimoire compendium-push <slug> --review              # prints the content and a digest
grimoire compendium-push <slug> --auto --reviewed <digest>
```

You read the content and approve it; the digest binds that approval to the exact bytes you saw, and
the push is refused if they change. Nothing reaches a remote unreviewed.

That script is the **only** path from Grimoire to a remote. LoreWeaver never runs raw git; the wall
in `skills/loreweaver/SKILL.md` says so explicitly. The script secret-scans every file (a hit blocks
the publish outright — there is no override), commits the slug to a `compendium/<slug>` review
branch cut from the remote's tip, and pushes that branch. Never `main`. Never `--force`.

The Compendium repository's CI opens the pull request from there, which is why the interviewing
machine needs nothing but git push access — no `gh`, no API token. A human reviews and merges;
nothing in the pipeline merges itself.

This directory is the **default** `compendium` root. Point `GRIMOIRE_COMPENDIUM_ROOT` or
`roots.compendium` in `grimoire.config.json` at a separate repository — a "Compendium" repo, distinct
from wherever `knowledge/` points — to use that instead. Or set `compendiumRepository` to that repo's
git URL and let the publish script maintain its own clone under `~/.grimoire/compendium`, which is
what makes a fresh machine work with zero setup.

_No capabilities captured yet._
