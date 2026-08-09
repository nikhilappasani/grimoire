# Interview Script — the base grill

- `content_version`: 0.3.0
- Question IDs are stable and never reused. Rewording keeps the ID; replacing the intent retires it
  and issues a new one.

Run this **one question at a time**. Follow up until each section is answered or explicitly deferred
with `OPEN:`.

**Read [GRILL-DISCIPLINE.md](./GRILL-DISCIPLINE.md) first.** It holds the rules — facts versus
decisions, pull up one level, MECE, fail closed, no real data, the close protocol. They are not
restated here.

This is the **base script**: the 10 sections every capability needs. It is **not the whole grill.** As
soon as you classify the capability in Section 1, open
[ROLE-QUESTION-BANKS.md](./ROLE-QUESTION-BANKS.md) and interleave that bank's questions. The goal is
that the user finishes unable to name a role-critical question you didn't ask.

---

## Section 1 — Metadata

- `base.s1.q1` — "In one sentence, what capability do you want to exist?"
- `base.s1.q2` — "Who are the personas that will invoke it?"
- `base.s1.q3` — "What domain does it live in?" (e.g. Data Engineering, Developer Experience, Support)
- `base.s1.q4` — "Is this a **Convention**, **Domain Knowledge**, or an **Execution Capability**? If
  execution — Diagnostic, Authoring, Analysis, Validation, Orchestration, Discovery, Planning, Review,
  or Transformation?"
- `base.s1.q5` — "Give it a short human-readable name."

> **Now branch to the role bank.** From persona + category + subtype, pick the matching bank in
> [ROLE-QUESTION-BANKS.md](./ROLE-QUESTION-BANKS.md). If nothing matches strongly, use the **Universal
> deep-probe bank** and record `bank matched: none (universal fallback used)` in the Design Record.
> Never fall through to the universal bank silently.
>
> Running example — a Data Engineer says "help with pipelines." Is that pipeline authoring, or
> data-quality validation, or schema review, or orchestration design? Those are *different
> capabilities*. Force the user to pick one or split into several.

## Section 2 — Problem & Outcomes

- `base.s2.q6` — "What problem or pain exists today? Describe it without mentioning skills or prompts."
- `base.s2.q7` — "When this works, what **observable** outcomes should it consistently produce?"
  Push for things you could check: *'produces a model that passes CI'*, *'flags unclassified columns
  before a table is published'*. Reject aspirational answers like *'improves quality'*.
- `base.s2.q8` — "What does *bad today* look like — the failure you are trying to prevent?"

## Section 3 — User Intent (triggers)

- `base.s3.q9` — "What kinds of requests should invoke this? Give me three real phrasings a user would
  type."
- `base.s3.q9a` — "What phrasings look similar but should **not** invoke it? Name the near-misses so
  the trigger boundary is sharp."

> Example triggers: "build me an ingestion pipeline for X", "review this data model", "why is my
> scheduled job failing?", "design a partitioning strategy".

## Section 4 — Inputs & Outputs

- `base.s4.q10` — "What information does it need to do the job? For each: **Required**, **Optional**,
  or **Derived**?"
- `base.s4.q11` — "What artifacts should it produce?"
- `base.s4.q12` — "Any data contracts or schemas it must honor? Name them — `OPEN:` if unknown. Do not
  paraphrase from memory."
- `base.s4.q12a` — "What must a *good* output contain to be acceptable, and what is the acceptance
  check for each artifact?"

## Section 5 — Enterprise Knowledge

- `base.s5.q13` — **Conventions.** "What standards must it follow?" (naming, layout, project
  structure, style, repository standards)
- `base.s5.q14` — **Business/Domain Facts Required.** "What organization-specific facts must it know
  to be correct?" (lineage rules, retention and governance, data classification, business glossary)
- `base.s5.q15` — **External Systems.** "What systems does it touch? For each — read-only or write?"

> `base.s5.q14` captures what the capability *needs to know*. Do not confuse it with the Capability
> Category "Domain Knowledge" in `base.s1.q4`, which is what the capability *is*.

## Section 5b — Knowledge Provenance & Capture

Capabilities depend on knowledge that usually is **not in the repository**. Find it, get it out,
package it. Full protocol: [KNOWLEDGE-CAPTURE-OKF.md](./KNOWLEDGE-CAPTURE-OKF.md). Grill until the
knowledge inventory is MECE.

- `base.s5b.q15a` — "Is there any **document, wiki, or knowledge base** this should be built from or
  enhanced by?" Enumerate every one.
- `base.s5b.q15b` — For each source: "**Where does it live** — a local file, a wiki, a document store,
  a shared drive, code, or is it tribal, in someone's head?"
- `base.s5b.q15c` — **Auth-gated source:** "I can't reach that behind a login — please **extract and
  paste or attach** the relevant content, and give me the page URL so I can cite it." Record the URL;
  keep the concept an `OPEN:` stub until content arrives.
- `base.s5b.q15d` — **Local file in the workspace:** confirm the path, read it yourself, distill the
  durable knowledge into concepts, keep a relative link. This is a fact, not a decision — do not ask
  the user what the file says.
- `base.s5b.q15e` — **Tribal:** interview the fact out, one at a time. Mark unverified facts `OPEN:`
  until confirmed.
- `base.s5b.q15f` — For each item, capture the field list in
  [KNOWLEDGE-CAPTURE-OKF.md](./KNOWLEDGE-CAPTURE-OKF.md) §8.
- `base.s5b.q15g` — "Does any of this contain **secrets, personal, or regulated data**?" If yes, link
  rather than copy. Never embed sensitive content.

> Onboarding example: HR policies in a document store, the team's runbook wiki, a local `setup.md`.
> Architecture example: a capability model, domain glossaries, diagram standards, and reference
> architectures — often spread across several wiki spaces.

## Section 6 — Behavior & Constraints

- `base.s6.q16` — "What must it **always** do?" (ask for missing information, prefer house conventions,
  reuse existing assets, explain its reasoning)
- `base.s6.q17` — "What must it **never** do?" Hard rules. (never expose personal data, never alter
  production state without confirmation, never invent a data contract, never bypass governance)
- `base.s6.q18` — "When it is unsure, what should it do — stop, ask, or proceed with a stated
  assumption?"
- `base.s6.q18a` — "Which of its actions are irreversible or hard to undo, and which of those require
  explicit human confirmation before proceeding?"

## Section 7 — Success & Evaluation

- `base.s7.q19` — "How do we know a single run succeeded?" Observable, per-run.
- `base.s7.q20` — "Which quality dimensions matter most here? Rank the top three." **Read the user the
  nine dimensions and their definitions** from [CAPABILITY-SPEC-TEMPLATE.md](./CAPABILITY-SPEC-TEMPLATE.md)
  §8b. Never ask for a ranking against a menu the user cannot see.
- `base.s7.q20a` — "What is the worst-case failure if it gets this wrong, and how would we detect it?"

## Section 8 — Distribution & Lifecycle

- `base.s8.q21` — "Who should get this — Enterprise, Organization, Product, Team, Repository, or a
  single Workspace?"
- `base.s8.q22` — "Starting lifecycle state — Proposed, Experimental, or Pilot?"
- `base.s8.q23` — "Who owns it, who reviews it, and does it depend on other capabilities?"

## Section 9 — Scope Boundaries

- `base.s9.q24` — "What is explicitly **out of scope**? Name the adjacent things it should *not* try
  to do."
- `base.s9.q25` — "Any notes a future maintainer needs that are not implementation directives?"

## Section 10 — Generation Guidance (preferences, not mandates)

- `base.s10.q26` — "Should its context be Always Loaded, Just-In-Time, Conditional, or User Prompted?"
- `base.s10.q27` — "Preferred execution mode — Deterministic, Interactive, or Autonomous?"
- `base.s10.q28` — "Preferred realization shape — Instruction, Skill, Workflow, Agent, or Hybrid? You
  may leave this to the build team."
- `base.s10.q29` — "Preferred evaluation strategy — Unit, Scenario, Human Review, or Regression Suite?"

---

## Close

Run the close protocol in [GRILL-DISCIPLINE.md](./GRILL-DISCIPLINE.md) §10 in full: MECE gate, read
it back, resolve every marker, separate provenance from content, get explicit approval.

Then emit per [CAPABILITY-SPEC-TEMPLATE.md](./CAPABILITY-SPEC-TEMPLATE.md) — the specification, the
OKF `knowledge/` bundle, and the Design Record appendix.
