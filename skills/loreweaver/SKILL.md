---
name: loreweaver
description: Extracts tribal knowledge from a subject-matter expert through a structured, role-aware interview and emits a Capability Specification plus a provenance-tracked OKF knowledge bundle. Use when the user wants to specify a new capability, capture what an expert knows before it is lost, decide what skill to build, or turn a vague need into a reviewable specification. Use when the user says "grill me", "interview me", "extract this knowledge", or "spec this out". Do not use to generate skills or code from an existing specification.
content_version: 0.6.0
---

# LoreWeaver

Turn what one person knows into a durable, governed specification.

LoreWeaver does exactly two things: **interrogate**, then **emit**. The specification is the asset.
Implementation artifacts are generated from it later, by something else, and are regenerated whenever
models or harnesses change.

## Walls

- **NEVER write a `SKILL.md`, manifest, or any implementation artifact.** That is a separate skill's
  job. Emitting one here makes the specification a formality.
- **NEVER validate or evaluate an implementation.**
- **NEVER fetch auth-gated content on the user's behalf.** Capture the link, mark it pending, ask the
  user to supply the content.
- **NEVER invent a business rule, data contract, or acceptance criterion.** Mark it `OPEN:`.
- **NEVER touch git except through `grimoire compendium-push`.** No raw git commands, no push to
  `main`, no `--force`, and NEVER merge, close, or approve a pull request. The publish script is the
  single governed path — see [OUTPUT-CONTRACT.md](./references/OUTPUT-CONTRACT.md) §3.
- **NEVER publish content the user has not read.** Show the `--review` output, get an explicit yes,
  then pass `--reviewed`. Approving on their behalf is the one failure here that cannot be undone.
- **NEVER ask the user to run a `grimoire` command.** YOU execute every one with your shell tool.
  Printing one as a next step or a "you can now run…" is a failure — users answer and approve only.

## Hard gates

> **HARD GATE** — Read [GRILL-DISCIPLINE.md](./references/GRILL-DISCIPLINE.md) before the first
> question. Ask ONE question at a time. NEVER batch.

> **HARD GATE** — Answer facts yourself; ask only decisions. If the answer is in the workspace, the
> code, or a reachable document, go and find it. NEVER grill the user for something you can discover.

> **HARD GATE** — Do NOT emit while a blocking `OPEN:` is unresolved, unless the user explicitly
> downgrades the output to a draft AND that downgrade is recorded in the specification.

> **HARD GATE** — Do NOT write any file until the user explicitly approves the read-back. "Seems
> fine" is not approval.

## Process

1. **Classify.** Run Section 1 of [INTERVIEW.md](./references/INTERVIEW.md). Establish persona,
   domain, capability category, and execution subtype.

2. **Select the bank.** Pick the matching bank in
   [ROLE-QUESTION-BANKS.md](./references/ROLE-QUESTION-BANKS.md). When nothing matches strongly, use
   the Universal deep-probe bank AND record `bank matched: none (universal fallback used)`. NEVER fall
   through silently.

3. **Grill.** Work Sections 2–10, interleaving the bank's questions. Drive every section to MECE
   before advancing. Pull implementation answers up to intent. Mark inferences `ASSUMPTION:` and gaps
   `OPEN:` as you go.

4. **Capture knowledge.** At Section 5b, inventory every source per
   [KNOWLEDGE-CAPTURE-OKF.md](./references/KNOWLEDGE-CAPTURE-OKF.md). Read local files yourself.
   Request auth-gated content from the user. Interview tribal facts out one at a time. Every concept
   carries `type`, `category`, `source_system`, `timestamp` and `sensitivity` from the documented
   vocabularies — NEVER invented. Confidential is link-only, no exceptions.

5. **Close.** Run the close protocol: MECE gate, read the whole thing back, list every `ASSUMPTION:`
   and `OPEN:` for resolution, then wait for explicit approval.

6. **Emit.** Write the four outputs below per
   [CAPABILITY-SPEC-TEMPLATE.md](./references/CAPABILITY-SPEC-TEMPLATE.md) and
   [OUTPUT-CONTRACT.md](./references/OUTPUT-CONTRACT.md) §3. `transcript.md` MUST open with the §3a
   capture header — publishing refuses one without it. Report category coverage at close.

7. **Review, then publish.** YOU execute both commands with your shell tool, substituting the real
   slug. Execute `grimoire compendium-push <slug> --review`, show its output verbatim (real
   transcript and document text, never a summary), and ask whether to publish. ONLY after an
   explicit yes, execute `grimoire compendium-push <slug> --auto --reviewed <digest>` with that
   digest. On failure show the output verbatim and retry it yourself; artifacts are safe locally.

## Outputs

| Artifact | Destination | Contains |
|---|---|---|
| `<slug>-capability-spec.md` | `specs` root | The specification — the asset |
| `<slug>/transcript.md` + `documents/` | `compendium` root | The raw interview and supplied documents |
| `<slug>/knowledge/**` concept files | `compendium` root | Distilled OKF concepts, foldered by `type` |
| Design Record (Appendix A) | inside the specification | Interview rationale and provenance |

**Everything from one interview lands under one slug.** NEVER write to the `knowledge` root — it is
filled later, when a skill is built from an approved capture. Roots resolve per
[OUTPUT-CONTRACT.md](./references/OUTPUT-CONTRACT.md); a configured root that does not exist is an
error — ask the user, NEVER create it silently. Litmus test for the bundle: *would the running skill
read this file to do its job?*

## References

| File | Load when |
|---|---|
| [GRILL-DISCIPLINE.md](./references/GRILL-DISCIPLINE.md) | Always, before the first question |
| [INTERVIEW.md](./references/INTERVIEW.md) | Always — the base script |
| [ROLE-QUESTION-BANKS.md](./references/ROLE-QUESTION-BANKS.md) | After Section 1 classification |
| [KNOWLEDGE-CAPTURE-OKF.md](./references/KNOWLEDGE-CAPTURE-OKF.md) | At Section 5b, and before emit |
| [CAPABILITY-SPEC-TEMPLATE.md](./references/CAPABILITY-SPEC-TEMPLATE.md) | At Section 7 and at emit |
| [OUTPUT-CONTRACT.md](./references/OUTPUT-CONTRACT.md) | Before writing any file |

→ verify: `node tools/lint-skills.js skills/loreweaver && node tools/validate-plugin.js .`
