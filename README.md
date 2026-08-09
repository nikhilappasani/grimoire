# Grimoire

**Get what's in an expert's head out of their head — into something a machine can build from and a human can review.**

Grimoire is a collection of agent skills. The first one, **LoreWeaver**, interviews you (or a
colleague) about something you know how to do, and turns that conversation into two durable files: a
specification of the capability, and a knowledge base of the facts behind it.

It works with Claude Code, Codex, GitHub Copilot / VS Code, and pi.

---

## Contents

- [The problem](#the-problem)
- [The idea](#the-idea)
- [What's in the box](#whats-in-the-box)
- [Quick start](#quick-start)
- [Installing](#installing)
- [Using LoreWeaver](#using-loreweaver)
- [What you get out](#what-you-get-out)
- [Inside the interview](#inside-the-interview)
- [The knowledge base](#the-knowledge-base)
- [Obsidian sync](#obsidian-sync)
- [Configuration](#configuration)
- [Publishing a capture](#publishing-a-capture)
- [Sharing with your team](#sharing-with-your-team)
- [Working on Grimoire itself](#working-on-grimoire-itself)
- [What this deliberately does not do](#what-this-deliberately-does-not-do)
- [Troubleshooting](#troubleshooting)
- [Glossary](#glossary)

---

## The problem

Every team has a few people who just *know things*. How the nightly job actually works. Which
exceptions matter. Why that one field is never trusted. What "done" really means for a release.

None of it is written down. It lives in one person's head, and it walks out the door with them.

When someone finally tries to capture it, two things go wrong:

1. **The interview is shallow.** You get a list of steps, not the judgment behind them. The
   interesting knowledge — the exceptions, the early warning signs, the rules of thumb — never comes
   up, because nobody asked the right question.
2. **The output rots.** Someone writes a prompt, or a script, or a wiki page. Six months later the
   tooling changed, the model changed, and the artifact is wrong. The knowledge inside it was fine.
   The wrapper around it wasn't.

## The idea

**The specification is the asset. Everything else is generated from it.**

A specification says *what capability should exist and what qualities it must have*. It doesn't say
how to implement it. That means when the model changes, the harness changes, or the tooling changes,
you regenerate the implementation and the specification stays exactly as true as it was.

So Grimoire separates two jobs that are usually mashed together:

| Job | Who does it | Output |
|---|---|---|
| **Specify** — find out what's actually needed | LoreWeaver (this repo) | A specification + a knowledge base |
| **Realize** — build the thing | A separate generator skill, built later | Code, skills, docs — regenerable |

Keeping them apart is the whole point. If the interviewer could also write the code, everyone would
skip straight to the code and the specification would become a formality nobody maintains.

## What's in the box

**v0.1.0 — LoreWeaver only.**

LoreWeaver is a structured interview. It asks one question at a time, adapts its questions to the
kind of work you're describing, and refuses to make things up. When it doesn't know something, it
writes `OPEN:` instead of guessing. When it infers something, it says so out loud and makes you
confirm it.

At the end you get:

- **A Capability Specification** — a reviewable markdown document describing the capability.
- **A knowledge bundle** — one markdown file per concept, each recording where the fact came from.

Plus the tooling to install it into your editor, validate what it produces, and share it with your
team.

## Quick start

Five minutes, assuming you have Node 20 or newer and Claude Code.

```bash
git clone <your-repo-url> grimoire
cd grimoire
npm install -g .                              # installs the `grimoire` command
grimoire sync                                 # build the editor artifacts
grimoire install --target claude-code --home  # install into ~/.claude/skills
```

Then open any project in Claude Code and say:

> **grill me about our deployment process**

LoreWeaver takes it from there.

> **Nothing was installed?** Every install is sandboxed unless you pass `--home` or `--dest`. Run
> without them first to see exactly what would happen: `grimoire install --target claude-code --dry-run`

## Installing

### Requirements

Node.js 20 or newer. That's it — Grimoire has **zero runtime dependencies**.

```bash
node --version   # must be v20 or higher
```

### Step 1 — get the code

```bash
git clone <your-repo-url> grimoire
cd grimoire
```

### Step 2 — install the CLI

```bash
npm install -g .
grimoire help
```

If you'd rather not install globally, every command also works directly:

```bash
node bin/grimoire.js help
```

### Step 3 — generate the editor artifacts

```bash
grimoire sync
```

This reads `skills/loreweaver/SKILL.md` and writes a copy for each editor into `.claude/`,
`.codex/`, `.copilot/`, and `.pi/`. These are generated files — never edit them, and they're
gitignored.

### Step 4 — install into your editor

```bash
grimoire install --target claude-code --home
```

| Editor | `--target` | Installs to |
|---|---|---|
| Claude Code | `claude-code` | `~/.claude/skills/` |
| Codex | `codex` | `~/.codex/skills/` |
| Copilot / VS Code | `copilot` | `~/.copilot/skills/` |
| pi | `pi` | `~/.pi/skills/` |

**Safety by default.** Without `--home` or `--dest`, everything installs into `.grimoire-sandbox/`
inside the repo, so you can see the result before it touches anything real. Add `--dry-run` to print
every action and write nothing at all.

Each install backs up whatever was there before (`*.backup-<timestamp>`) and keeps the last three.

### Alternative — no install at all

If you work inside the Grimoire repo itself, the `.claude/skills/` directory that `grimoire sync`
creates is picked up automatically. Just run `grimoire sync` and start talking to it.

## Using LoreWeaver

### Starting a session

Say any of these to your agent:

- "grill me about X"
- "interview me about our on-call process"
- "I want to spec out a new capability"
- "extract what I know about the claims pipeline"
- "help me decide what skill to build for X"

### What the conversation feels like

LoreWeaver asks **one question at a time** and waits. It doesn't hand you a form or a numbered list —
those get skimmed, and the question that mattered gets a one-word answer.

A few things it does that a normal chat won't:

**It looks things up instead of asking you.** If the answer is in your codebase, your config, or a
document you pointed it at, it goes and reads it. You only get asked about things only you can
decide — trade-offs, priorities, business rules.

**It pulls your answers up a level.**

> **You:** I want something that lints our SQL.
> **It:** So the outcome is: SQL conforms to the house standard before it merges — correct?

You described a tool. It captured the goal. If your linter gets replaced next year, the goal is still
right.

**It refuses to guess.** Ask it something it doesn't know and it writes `OPEN:` in the document
rather than inventing a plausible answer. An `OPEN:` is a *good* outcome — it's a real gap, flagged
for a human, instead of a confident-sounding fabrication nobody catches.

**It says what it inferred.** Anything it worked out rather than being told becomes `ASSUMPTION:`,
and you confirm or correct every one before anything is written.

**It won't finish early.** Before emitting, it reads the whole thing back to you, lists every `OPEN:`
and `ASSUMPTION:`, and waits for you to explicitly approve. "Seems fine" doesn't count.

### How long it takes

Expect **30–60 minutes** for a real capability. It's a proper interview, not a form. You can stop and
resume — just tell it where you left off.

### Two markers you'll see a lot

| Marker | Means | What to do |
|---|---|---|
| `OPEN:` | Nobody has supplied this yet | Answer it, or ship it as a known gap |
| `ASSUMPTION:` | It inferred this; plausible but unconfirmed | Confirm or correct it before close |

## What you get out

### 1. The Capability Specification

One markdown file, written to `specs/<name>-capability-spec.md`. Ten sections covering: what it is,
the problem, the observable outcomes, what should trigger it, inputs and outputs, the knowledge it
needs, what it must always and never do, how you'd know a run succeeded, who gets it, what's out of
scope, and how it should be built.

An excerpt:

```markdown
## 3. Desired Outcomes
- Flags every column containing customer identifiers before the table is published
- Produces a report a data steward can action without opening the pipeline code

## 7b. Constraints (hard "never" rules)
- Never writes to a production table
- Never reports a column as safe when classification is unknown — OPEN: is the correct output

## 8b. Evaluation Dimensions (ranked — top three)
1. Safety
2. Correctness
3. Maintainability
```

Notice the outcomes are **checkable**. "Improves data quality" would be rejected; "flags columns
before publish" can be verified.

### 2. The knowledge bundle

One markdown file per fact, written into `knowledge/`. Each records what the fact is, why it matters,
and where it came from:

```markdown
---
type: Policy
title: Retention Window
description: The period a record must be kept before it may be purged.
why: Purging early breaks audit; purging late breaks the storage budget.
resource: https://wiki.example.com/retention-window
source_system: Wiki
access_state: extracted
sensitivity: internal
timestamp: 2026-08-08
---

# Retention Window

Records are held a minimum of seven years from close. See [Purge Playbook](../playbooks/purge.md).
```

Every concept carries its provenance, so six months later you can trace any claim back to its source
and check whether it's still true.

### 3. The Design Record

An appendix inside the specification holding the *reasoning* — decisions made, alternatives rejected,
assumptions resolved. This is why the spec says what it says. It never enters the knowledge base,
because it's about how the thing was designed, not about the domain.

## Inside the interview

### The base script — 10 sections

Metadata → Problem & Outcomes → Triggers → Inputs & Outputs → Required Knowledge → Knowledge
Provenance → Behaviour & Constraints → Success & Evaluation → Distribution → Scope → Generation
Guidance.

Forty questions, each with a permanent ID (`base.s4.q11`). IDs never get reused, so an answer stays
attached to its question even when the wording changes later.

### Role banks — the questions your work specifically demands

After the first few questions, LoreWeaver works out what *kind* of work you're describing and layers
on the right question bank.

**Nine by type of work** — pick one:

| Bank | For work that… |
|---|---|
| Diagnostic | finds root causes |
| Authoring | produces an artifact |
| Analysis | interprets data and reports findings |
| Validation | passes or fails something against a standard |
| Orchestration | coordinates steps or systems |
| Discovery | finds and inventories things |
| Planning | produces a plan someone else executes |
| Review | evaluates someone else's work |
| Transformation | converts A into B |

**Six by role** — layer on any that apply: Data Engineer, Reviewer, Onboarding, Architect,
Deployment/Ops, Convention enforcement.

### The universal deep-probe bank

When nothing fits, LoreWeaver uses a bank built for one purpose: getting at what you know but have
never written down.

> *"What does someone experienced at this know that a competent newcomer would get wrong on their
> first attempt?"*
>
> *"What rule of thumb do you use that isn't written down anywhere?"*
>
> *"What signal tells you early that something is off, before it becomes obvious?"*
>
> *"If you left tomorrow, what would your replacement need that isn't documented?"*
>
> *"Which of the facts you have told me would a colleague dispute?"*

That last one matters more than it looks. A fact two experts disagree about isn't knowledge yet — it
gets marked `OPEN:` with both positions recorded, rather than one being quietly written down as
settled.

When the universal bank gets used, the specification says so explicitly:
`bank matched: none (universal fallback used)`. It never silently falls back — if that line keeps
appearing, it's a signal that a new bank should be written.

## The knowledge base

The specification tells you what to build. The knowledge base is what makes it *correct* — the facts,
rules, and definitions the thing needs to know to do its job properly.

### Why it's separate from the spec

A specification describes one capability. The same facts show up across many capabilities. Retention
rules matter to the archiver, the reporter, and the deletion job. Capturing them once, in files that
cross-link, means the second interview about your domain is faster than the first — and the tenth is
much faster.

That's the compounding effect: **every interview makes the next one cheaper.**

### The format

Plain markdown with YAML frontmatter, following the [Open Knowledge Format](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/).
No database, no SDK, no proprietary tooling. It renders on GitHub, diffs cleanly in a pull request,
and opens in any text editor.

```text
knowledge/
├── index.md
├── glossary/     ← what terms mean
├── policies/     ← what the rules are
├── playbooks/    ← how things get done
└── log.md
```

One concept per file. Concepts link to each other with ordinary relative markdown links, which is
what turns a folder of notes into a graph.

### The rules it follows

- **Never fabricate.** Knowledge behind a login that you haven't supplied becomes a stub with a link
  and an `OPEN:`, never an invented body.
- **Confidential is link-only, no exceptions.** Anything sensitive gets a short neutral summary and a
  link back to the source — never the content itself, even in a private repo. This is enforced in
  code, not just asked for politely.
- **Everything is attributed.** Every concept says where it came from.
- **No real personal data, ever.** Examples are synthetic.

### Where it lives

By default, `knowledge/` inside this repo. In practice you'll want it in **its own repository**, so
the knowledge outlives any one project and can be shared independently of the tooling. Point
`roots.knowledge` at it (see [Configuration](#configuration)).

## Obsidian sync

The knowledge base is deliberately just markdown files with frontmatter and relative links — which
happens to be exactly what Obsidian reads natively. No exporter, no plugin, no conversion step.

### Setting it up

**Option A — point Grimoire at your vault.** Simplest. Edit `grimoire.config.json`:

```json
{ "roots": { "knowledge": "/home/you/Documents/Obsidian Vault/Knowledge" } }
```

**Option B — keep the knowledge base as its own git repo and symlink it in.** Better if you want the
knowledge version-controlled and shareable separately from your personal notes:

```bash
ln -s ~/code/my-knowledge-base ~/Documents/Obsidian\ Vault/Knowledge
```

### What you get in Obsidian

- **Properties panel** — the YAML frontmatter (`type`, `source_system`, `sensitivity`, `tags`, `why`)
  shows up as Obsidian properties, so you can filter and query by them.
- **Graph view** — the relative links between concepts render as a real graph of your domain.
- **Backlinks** — every concept shows what else references it.
- **Search** — full-text across everything you've ever captured.

### One setting to check

In Obsidian: **Settings → Files & Links → "Use [[Wikilinks]]" → OFF.**

Grimoire writes standard markdown links (`[Text](../path/file.md)`) because those also work on
GitHub, in VS Code, and in any other editor. Obsidian reads them fine, but with wikilinks enabled it
will *write* new links in its own format, and those won't render outside Obsidian.

### The bigger idea

Your knowledge base becomes a second brain that isn't just yours — it's structured, sourced, and
machine-readable. You can browse it as notes in Obsidian, review changes to it in pull requests, and
feed it to an agent as the ground truth for building something. Same files, three audiences.

## Configuration

`grimoire.config.json` at the repo root:

```json
{
  "contentVersion": "0.3.0",
  "specVersion": "0.2.0",
  "roots": {
    "specs": "./specs",
    "knowledge": "./knowledge",
    "compendium": "./compendium"
  },
  "compendiumRepository": "https://github.com/you/compendium.git",
  "harnesses": ["claude-code", "codex", "copilot", "pi"]
}
```

### The three roots

| Root | Holds |
|---|---|
| `specs` | Capability Specifications |
| `knowledge` | The knowledge base — distilled facts, point this at your own repo |
| `compendium` | The raw interview transcript and supplied documents, one folder per capability — bulkier and unprocessed on purpose, kept separate so it never bloats the knowledge base's history |

Each resolves in this order, first hit wins:

1. A path you give during the session ("write it to ~/work/specs")
2. An environment variable — `GRIMOIRE_SPECS_ROOT`, `GRIMOIRE_KNOWLEDGE_ROOT`, `GRIMOIRE_COMPENDIUM_ROOT`
3. `grimoire.config.json`

```bash
export GRIMOIRE_KNOWLEDGE_ROOT=~/code/my-knowledge-base
```

**A configured root that doesn't exist is an error, not a silent `mkdir`.** If you typo a path,
LoreWeaver stops and asks — it won't quietly write your knowledge base somewhere you'll never find
it.

### `compendiumRepository`

One extra key, used only by publishing. Point it at the git URL of your Compendium repo:

```json
"compendiumRepository": "https://github.com/you/compendium.git"
```

When it's set and no `compendium` root resolves from the three rules above, `grimoire
compendium-push` maintains its own clone at `~/.grimoire/compendium`, cloning it on first use. That
is the one place Grimoire creates a directory for you, and it's deliberate: it's what lets a machine
that has never seen your Compendium repo publish a capture without anyone setting anything up. It
isn't the "silent `mkdir` of a configured root" the rule above forbids — nothing you configured is
missing.

If you'd rather manage the clone yourself, set `GRIMOIRE_COMPENDIUM_ROOT` (or `roots.compendium`) to
it and that wins.

## Publishing a capture

At the close of an interview — after you approve the read-back — LoreWeaver runs:

```bash
grimoire compendium-push <slug> --auto
```

You don't type it. Your approval at close *is* the confirmation for the network write, which is what
`--auto` means. The result is a pull request on your Compendium repo waiting for review.

### What it actually does

| Step | What happens |
|---|---|
| 1. Resolve | Finds the Compendium clone, or clones `compendiumRepository` to `~/.grimoire/compendium` |
| 2. Import | Copies `<slug>/transcript.md` + `<slug>/documents/` into the clone if they were staged elsewhere |
| 3. Secret scan | Scans every file. **A hit blocks the publish. There is no override flag.** |
| 4. Branch | Cuts `compendium/<slug>` from the remote's tip — never commits to `main` |
| 5. Push | Plain `git push -u origin <branch>`. Never `--force` |
| 6. Report | Prints the branch, the PR list URL, and a manual compare URL as a fallback |

The Compendium repo's own CI takes it from there: it validates the capture's structure, re-runs a
secret scan with gitleaks, and opens the pull request. **A human reviews and merges. Nothing in this
pipeline ever merges, closes, or approves anything.**

### Why there's no `gh` requirement

Opening a pull request needs a GitHub API token. Asking every expert who sits for an interview to
install the `gh` CLI and authenticate it is exactly the hassle this avoids — so the PR is opened
*server-side*, by the Compendium repo's workflow, using the token GitHub Actions already has.

The interviewing machine therefore needs one thing and one thing only: **git push access to the
Compendium repo.** No `gh`, no token, no Grimoire-specific setup.

That access comes from whatever the machine already has:

| If the machine has | It works via |
|---|---|
| An SSH key on the GitHub account | `git@github.com:you/compendium.git` — set `compendiumRepository` to the SSH URL |
| A git credential helper (macOS Keychain, Windows Credential Manager, `git-credential-libsecret`) | The HTTPS URL, using the stored credential |
| GitHub Codespaces / Actions / most cloud dev environments | The ambient token those environments inject |
| None of the above | The publish fails cleanly and tells you — see below |

### When it fails

Nothing is lost. The transcript and documents are already written to local disk before the publish
is attempted, and the failure output names the exact step that failed and the state of the clone.
Fix the cause and re-run the same command by hand:

```bash
grimoire compendium-push <slug>
```

Run without `--auto`, it asks for confirmation in the terminal. Add `--dry-run` to see the plan —
which files, which branch, which repo — without writing or pushing anything.

Publishing the same slug twice never overwrites the first branch. It gets `compendium/<slug>`, then
`compendium/<slug>-<YYYYMMDD>`, then `-2`, `-3` — the same collision convention specifications use.

## Sharing with your team

### Option 1 — share the repo (recommended)

```bash
# They run:
git clone <your-repo-url> grimoire
cd grimoire
npm install -g .
grimoire sync
grimoire install --target claude-code --home
```

Everyone stays on the same version, and improvements flow through git like any other code.

### Option 2 — send a tarball

For someone who can't reach your git host:

```bash
npm pack                 # produces nikhilappasani-grimoire-0.1.0.tgz
```

```bash
# They run:
npm install -g ./nikhilappasani-grimoire-0.1.0.tgz
grimoire sync
grimoire install --target claude-code --home
```

### Option 3 — publish to a registry

The package is scoped (`@nikhilappasani/grimoire`) because the unscoped name `grimoire` is already
taken by an unrelated package on the public registry. A scoped package defaults to **private** on
first publish — pass `--access public` once to make it installable by anyone:

```bash
npm publish --access public              # public, first time only
npm publish                              # every publish after that
npm publish --registry https://registry.internal.example.com   # internal registry instead
```

Then anyone runs `npm install -g @nikhilappasani/grimoire`. `prepublishOnly` runs the full preflight,
so a broken build can't be published.

### Option 4 — just copy the folder

The skill is only markdown. Copy `.claude/skills/loreweaver/` into their `~/.claude/skills/` and it
works. Fine for a quick demo; you lose the ability to update it cleanly.

### What to tell a colleague

> Install it, then say "grill me about \<the thing you know that nobody else does\>". It'll ask you
> questions for about 45 minutes. At the end you get a document describing what you know, and a set
> of notes recording where each fact came from. It won't make anything up — if it doesn't know, it
> writes `OPEN:` and asks you.

### Sharing knowledge, not just skills

Keep the knowledge base in **its own repository** so colleagues can contribute facts without touching
the tooling, and so the knowledge survives independently. Point everyone's
`GRIMOIRE_KNOWLEDGE_ROOT` at their clone of it, and reviews of new knowledge happen as pull requests.

## Working on Grimoire itself

### Layout

```text
grimoire/
├── skills/loreweaver/
│   ├── SKILL.md              ← the only source of truth
│   └── references/           ← loaded on demand
├── tools/                    ← validators + shared parsers + tests
├── scripts/                  ← sync + install
├── bin/grimoire.js           ← CLI
├── specs/ knowledge/ compendium/ ← default output roots
└── CONVENTIONS.md            ← binding rules for contributors
```

### The checks

```bash
npm test                # 20 fixture tests over the shared parsers
npm run validate        # structure: manifests, frontmatter, naming, version lockstep
npm run lint            # skill quality: description, body length, links, self-containment
npm run check-knowledge # knowledge base: vocabulary, provenance, confidential-is-link-only
npm run preflight       # all of the above, in order

grimoire sync --check   # fails if generated artifacts are stale
```

All of it must pass before anything ships. `prepublishOnly` enforces it.

### Rules worth knowing before you edit

- **`SKILL.md` is the only source.** Everything under `.claude/`, `.codex/`, `.copilot/`, `.pi/` is
  generated. Edit the source, run `grimoire sync`.
- **A skill must be self-contained** — no link may point outside its own directory. Skills get copied
  verbatim into four editors; a link that escapes works in the repo and breaks everywhere else. The
  linter enforces this.
- **`SKILL.md` stays under 100 lines.** Detail goes into `references/`, loaded only when needed.
- **Some facts have exactly one home.** The knowledge vocabulary lives in `KNOWLEDGE-CAPTURE-OKF.md`;
  the interview rules live in `GRILL-DISCIPLINE.md`; the evaluation dimensions live in
  `CAPABILITY-SPEC-TEMPLATE.md`. Everything else references them. A test fails if the code and the
  document ever disagree.
- **New skills are named verb-noun** (`forge-skill`, `curate-lore`). `loreweaver` is a documented
  exception because it's the flagship.

Full rules in [CONVENTIONS.md](./CONVENTIONS.md).

## What this deliberately does not do

Not oversights — deliberate boundaries.

- **It doesn't generate skills or code.** That's a separate generator, built separately. If the
  interviewer could also build the thing, everyone would skip the specification.
- **It doesn't validate or evaluate implementations.**
- **It doesn't fetch content behind a login.** It captures the link and asks you for the content.
  It'll never guess what's behind a URL it can't open.
- **It doesn't merge, approve, or close pull requests.** It pushes one thing — a `compendium/<slug>`
  review branch, through a single governed script, never `--force` and never to `main`. Everything
  after that is human review. That's the gate, and nothing in the pipeline can open it.
- **It doesn't deduplicate knowledge across sessions.** Curating and merging the knowledge base is a
  separate job, not something the interviewer does mid-conversation.

### Roadmap

| Next | What |
|---|---|
| The generator | Turns an approved specification into an installable skill |
| More grills | `plan-project`, `diagnose-issue` — different questions, same interview discipline |
| Knowledge curation | Merging, deduplicating, and refreshing concepts as sources change |

## Troubleshooting

**`grimoire: command not found`**
`npm install -g .` didn't finish, or npm's global bin directory isn't on your `PATH`. Find it with
`npm prefix -g` — the binaries live in `<that path>/bin`. You can always use `node bin/grimoire.js`
instead.

**The skill doesn't show up in my editor**
Run `grimoire sync` first, then `grimoire install --target <editor> --home`. Without `--home` it
installs to a sandbox on purpose. Restart the editor afterwards.

**"Configured root does not exist"**
A path in `grimoire.config.json` or a `GRIMOIRE_*_ROOT` variable points somewhere that isn't there.
Deliberate — fix the path, or create the directory.

**"Generated artifacts are out of date"**
Someone edited a `SKILL.md` without re-running sync. Run `grimoire sync`.

**"Link escapes the skill directory"**
A reference file links outside its skill. Skills must be self-contained. Move the content inside the
skill, or drop the link.

**"Cannot clone … This machine may not be authenticated to the repository yet"**
The publish needs git push access to the Compendium repo and this machine doesn't have it. Set up an
SSH key or a git credential helper, then re-run `grimoire compendium-push <slug>`. Your transcript
and documents are already saved locally — nothing was lost.

**"Secret scan found N match(es); publish blocked"**
A file in the capture looks like it contains a credential. This is intentionally not overridable.
The output names the file, line, and kind of match — never the secret itself. Remove the value or
replace it with a `resource:` link to where it actually lives, then re-run.

**"The compendium clone has unrelated uncommitted changes"**
Your Compendium clone has edits outside the slug being published. The publish only ever commits the
one slug, so it refuses rather than sweeping your other work into the commit. Commit, stash, or
discard those changes first.

**The PR didn't appear after a successful push**
The push succeeded; the Compendium repo's CI opens the PR. Check the repo's Actions tab — a failing
structure or gitleaks check blocks the `open-pr` job on purpose. The publish output also prints a
compare URL you can use to open the PR by hand.

**The interview feels too long**
It is a real interview. You can stop and resume, or tell it to focus on specific sections. If a
question genuinely doesn't apply, say so — it'll mark it and move on.

## Glossary

| Term | Meaning |
|---|---|
| **Capability Specification** | The output document. What should exist and what qualities it needs — not how to build it. |
| **OKF** | Open Knowledge Format. Markdown files with YAML frontmatter, one concept each. |
| **Concept** | One knowledge file. One fact, term, policy, or playbook. |
| **Design Record** | Appendix in the spec holding the reasoning — decisions, rejected options, resolved assumptions. |
| **`OPEN:`** | Unresolved. Nobody has supplied this yet. |
| **`ASSUMPTION:`** | Inferred, not confirmed. Gets checked with you before close. |
| **MECE** | Mutually Exclusive, Collectively Exhaustive. Nothing double-counted, nothing missing. |
| **Role bank** | A set of questions specific to a kind of work, layered onto the base interview. |
| **Harness** | An editor or agent runtime — Claude Code, Codex, Copilot, pi. |
| **Fail closed** | When unsure, stop and mark it rather than guess. |

---

**v0.1.0** · Node ≥ 20 · zero runtime dependencies · [MIT](./LICENSE) · see [CHANGELOG.md](./CHANGELOG.md)
