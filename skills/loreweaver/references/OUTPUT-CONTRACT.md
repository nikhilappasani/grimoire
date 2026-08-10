# Output Contract: where artifacts go and what must never be written

Runtime contract for any Grimoire skill that writes files. Self-contained by design: a skill is
copied into several harnesses, so it must never depend on a file outside its own directory.

Referenced by: [SKILL.md](../SKILL.md), [CAPABILITY-SPEC-TEMPLATE.md](./CAPABILITY-SPEC-TEMPLATE.md).

## 1. Resolving an output root

Three roots exist: `specs`, `knowledge`, `compendium`. Resolve each independently. First hit wins:

1. An explicit path the user gave in this session.
2. Environment: `GRIMOIRE_SPECS_ROOT`, `GRIMOIRE_KNOWLEDGE_ROOT`, `GRIMOIRE_COMPENDIUM_ROOT`.
3. `roots` in `grimoire.config.json` at the repository root.

**A configured root that does not exist is an error.** Ask the user where it should be. NEVER create
it silently and NEVER fall back to the current directory; writing captured knowledge into an
unexpected place is worse than refusing to write at all.

One exception, for `compendium` only: when nothing above resolves and `compendiumRepository` (a git
URL) is set in `grimoire.config.json`, the publish script maintains its own managed clone under
`~/.grimoire/compendium`, cloning on first use. That is not a silent `mkdir` of a configured root;
nothing the user configured is missing. It is what makes a zero-setup machine work: the user answers
questions, and the tooling handles where the repository lives.

`compendium` is expected to point at a **separate capture repository**. Everything one interview
produces lands under a single slug there: the raw transcript, the documents the user supplied, and
the OKF concepts distilled from them. A capture is then reviewable as one unit, rather than split
across two repositories that must be read side by side for either to make sense.

**NEVER write to the `knowledge` root.** It is the *downstream* destination: when a skill is later
built from an approved capture, its concepts are promoted there. Keeping capture separate from
promotion means the shared knowledge base stays curated by construction, instead of accumulating
every draft concept from every interview, including the ones from captures nobody merged.

The `knowledge` root still resolves, and a running skill still reads from it. It is simply not
something this skill writes to.

## 2. What goes where

| Artifact | Root | Rule |
|---|---|---|
| `<slug>-capability-spec.md` | `specs` | One file per capability. Never overwrite; see the collision rule in [CAPABILITY-SPEC-TEMPLATE.md](./CAPABILITY-SPEC-TEMPLATE.md) §1. |
| Interview transcript | `compendium/<slug>/transcript.md` | The full Q&A, verbatim, in question order. Written once, at close (§5). |
| Supplied source documents | `compendium/<slug>/documents/` | Stored as provided. Concepts link here rather than duplicating the content. |
| Concept files | `compendium/<slug>/knowledge/` | One concept per file; the directory is decided by the concept's `type`; see [KNOWLEDGE-CAPTURE-OKF.md](./KNOWLEDGE-CAPTURE-OKF.md) §2. |
| Design Record | inside the specification | Appendix A. NEVER in `compendium/`. Its "Raw transcript" field records the `compendium/<slug>/transcript.md` path. |
| — | `knowledge` root | **Nothing.** Written later by the build step, not by this skill. |

## 3. The compendium write and publish

At close, after the user approves the read-back (per
[GRILL-DISCIPLINE.md](./GRILL-DISCIPLINE.md) §10), write:

- `compendium/<slug>/transcript.md`: every question and answer, in order, including resolved
  `OPEN:`/`ASSUMPTION:` markers. This is the raw record the Design Record's rationale is built from.
  It MUST open with the capture header in §3a.
- `compendium/<slug>/documents/<original-name>`: each document the user supplied, stored as given.
  Apply the same sensitivity rule as knowledge concepts: a document classified confidential, or
  containing secrets or personal data, is **never copied in**; write a short neutral note plus its
  `resource:` link instead.
- `compendium/<slug>/knowledge/<type-directory>/<concept>.md`: the OKF concepts distilled from the
  interview, one per file, in the directory its `type` dictates per
  [KNOWLEDGE-CAPTURE-OKF.md](./KNOWLEDGE-CAPTURE-OKF.md) §2. NEVER invent a directory outside that
  table, and NEVER write these to the `knowledge` root.

### 3a. The capture header

`transcript.md` MUST open with this frontmatter block. A concept can only record
`source_system: Tribal/interview`. It can never say *whose* head the fact came from, and that is
usually the question a capture is reopened to answer. The header carries what no concept can.

```yaml
---
slug: <the capture's directory name, must match>
title: <human name of the capability>
theme: <the dominant category, from KNOWLEDGE-CAPTURE-OKF.md §3a>
categories: [<every category this interview touched>]
interviewee: <who answered the questions>
interviewee_role: <the role they answered in>
interviewer: LoreWeaver (Grimoire)
date: <ISO-8601 date of the interview>
content_version: <the reference bundle version this ran against>
spec_version: <the specification template version>
banks_used: [<question banks used>]
spec: <path to the specification this produced>
---
```

`interviewee_role` is not decoration: the same statement means different things from a Solutions
Architect and from a QA Engineer, and a reader six months later has no other way to weigh it.
`content_version` lets a capture be read in the context of the questions that existed when it ran.

Every field above is required except `spec` and `banks_used`, which warn. **`grimoire
compendium-push` refuses to publish a capture whose header is missing or invalid**, because
publishing is the point after which it stops being fixable in private.

The existing human-readable summary lines stay directly beneath the block; the frontmatter is
additive, not a replacement.

### 3b. Per-question categories

Label each question with the category it was probing, using the existing annotation convention:

```markdown
**Q (base.s5b.q15b)** · *External Systems* — Where does that knowledge live?
```

Use `—` where a question is pure metadata and no category applies. These labels are **best-effort
and never gated**: they feed the coverage summary at close, and blocking an emit over a labelling
miss would trade a real output for a bookkeeping detail. The header's `theme` and `categories` ARE
required: they are the claim; the labels are the evidence.

At close, report which categories the interview covered and which it never touched. An untouched
category is not automatically a defect (most capabilities do not span all five), but it is the
cheapest way to notice that nobody asked about Conventions at all.

Then publish. The user runs nothing, but they **approve the content first**, in two commands:

```
grimoire compendium-push <slug> --review
grimoire compendium-push <slug> --auto --reviewed <digest>
```

**You execute both, with your shell tool, substituting the real slug.** Never print a command for
the user to run, never end a turn with "you can now run…", and never treat publishing as a task you
hand back. The entire promise of this flow is that the user answers questions and approves; the
moment they are asked to type a command, the skill has failed at the thing it exists to do. If a
command fails, fix the cause and run it again yourself. Report, do not delegate.

`--review` prints every artifact's actual content: the transcript text, each document, binary files
described rather than dumped, plus a short digest of exactly those bytes. It writes nothing and
pushes nothing.

**Show that output to the user and ask before continuing.** The read-back approval at close covers
the *specification*; it is not approval to publish the raw transcript and the documents they handed
over, which is a separate and irreversible act. Content that reached a remote has been seen, cached,
and possibly indexed even if the branch is deleted minutes later.

Only after an explicit yes, run the second command with the digest the review printed. The script
recomputes the digest from disk and refuses to push if it moved, so an approval is bound to the exact
bytes the user read. If the artifacts changed in between, the publish stops rather than shipping
something nobody saw. `--auto` therefore means "no terminal here", not "no approval needed".

If the user wants changes, edit the artifacts and start over at `--review`. The digest changes with
them, and a stale one is rejected.

The script is the single governed path to the remote. It secret-scans every file (a hit blocks the
publish, no override exists), commits the slug to a `compendium/<slug>` review branch cut from the
remote's tip, pushes that branch, never `main` and never `--force`. The compendium repository's
CI opens the pull request. A human reviews and merges on GitHub; nothing merges itself.

If the publish fails (no network, no git access on this machine, scan hit, stale digest), the
artifacts remain intact on local disk and the failure output says exactly what happened and how to
retry. Report that output to the user verbatim. NEVER attempt the push with raw git commands
instead, and NEVER pass `--reviewed` with a digest the user has not actually approved.

## 4. Writing rules

- **Confirm before writing.** Show the user what will be written and where. Wait for explicit
  approval.
- **Never overwrite.** If a target file exists, apply the collision rule or stop and ask.
- **No silent partial writes.** When a multi-file emit fails partway, report which files were written,
  which were not, and what state each root is in. A half-written bundle that reports success is worse
  than a clean failure.
- **Never write outside a resolved root.** No absolute paths, no `..` escapes.

## 5. Never written, anywhere

- Secrets, credentials, tokens, or keys.
- Real personal or regulated data. Examples are synthetic, always.
- The body of anything classified `sensitivity: confidential`: a short neutral summary plus a
  `resource:` link only. See [KNOWLEDGE-CAPTURE-OKF.md](./KNOWLEDGE-CAPTURE-OKF.md) §7.
- Fabricated business rules, contracts, or acceptance criteria. Those are `OPEN:`.
- Implementation artifacts: `SKILL.md`, manifests, prompt bodies. A specification that contains its
  own implementation has stopped being a specification.
