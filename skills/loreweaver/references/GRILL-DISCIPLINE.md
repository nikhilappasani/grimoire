# Grill Discipline: the rules that govern any Grimoire interview

This file is the **single source** for how a Grimoire skill interrogates a human. It is deliberately
independent of *what* is being elicited. `INTERVIEW.md` supplies the questions; this file supplies the
epistemics. A future `plan-project` or `diagnose-issue` grill inherits this file unchanged rather than
forking it.

Referenced by: [INTERVIEW.md](./INTERVIEW.md), [CAPABILITY-SPEC-TEMPLATE.md](./CAPABILITY-SPEC-TEMPLATE.md).

## 1. Facts versus decisions

The most common way an interview wastes a human's attention is asking them something you could have
found out yourself.

- **Facts:** discoverable by reading the workspace, the code, the config, the docs, or a reachable
  URL. **Go and find them. Never ask.**
- **Decisions:** trade-offs, priorities, preferences, business rules, acceptance thresholds. Only a
  human can settle these. **Always ask. Never infer silently.**

Before asking any question, test it: *could I answer this myself in under a minute?* If yes, answer it
yourself and state what you found. Never grill yourself.

## 2. One question at a time

Ask one question. Stop. Read the answer. Follow up on its **weakest part** before advancing.

Never batch questions. A numbered list of six questions returns six shallow answers, and the user
answers the easy ones and skips the one that mattered.

## 3. Pull up one level

Users answer with implementations because implementations are what they were thinking about. Convert
each one into the intent behind it, and read it back for confirmation.

> User: "Write instructions that lint our SQL."
> You: "So the outcome is: SQL conforms to the house standard before it merges, correct?"

The specification captures the intent. The implementation is regenerated from it later. Recording the
implementation instead of the intent is how a specification becomes obsolete the day the tooling
changes.

## 4. Prefer enumerated choices

Where a question has a known answer set, offer it. Enumerated answers are close to deterministic;
open prose has to be interpreted, and interpretation is where meaning is lost.

Offer your recommended option and say why. A user correcting a recommendation gives you more signal
than a user facing a blank field.

## 5. MECE coverage

Drive every section to be **Mutually Exclusive** (no item belongs in two buckets) and **Collectively
Exhaustive** (nothing relevant is left uncaptured).

Do not advance a section while a plausible gap or overlap remains. Name it and resolve it:

> "You listed the schema registry under both external systems and data contracts. Which is it, or is
> it genuinely both with different concerns?"

## 6. Exhaust the bank

A section is not finished until its base questions **and** the applicable role-bank questions are each
answered or explicitly marked `OPEN:`.

The target is that the user finishes unable to name a question you should have asked and didn't.

## 7. Name assumptions out loud

Anything you infer becomes `ASSUMPTION:` in the emitted artifact and is confirmed before close. An
unconfirmed inference presented as fact is the single most expensive failure this process has, because
it is invisible downstream.

## 8. Fail closed

A missing business rule, data contract, acceptance criterion, or system name becomes `OPEN:` and you
keep asking. **Never invent one.** `OPEN:` is a successful outcome; it marks a real gap for a human to
close. A plausible fabrication is an unmarked defect.

Two markers, and only two:

| Marker | Means | Resolution |
|---|---|---|
| `OPEN:` | Unresolved. Nobody has supplied this yet. | The user answers it, or it ships as a known gap. |
| `ASSUMPTION:` | You inferred it. Plausible but unconfirmed. | The user confirms or corrects it at close. |

## 9. No real data

Never solicit real personal, regulated, or customer data. Synthetic examples only, everywhere, without
exception. If a user starts pasting real records, stop them and ask for a synthetic equivalent.

## 10. Close protocol

Before emitting anything:

1. **MECE gate.** Confirm every section is Collectively Exhaustive and Mutually Exclusive. Confirm the
   role bank is exhausted. Walk the knowledge inventory item by item; each source has exactly one
   location, one access state, one sensitivity, none ambiguous.
2. **Read it back.** Summarize the whole thing in your own words. Misunderstandings surface here or
   they surface in production.
3. **Resolve the markers.** List every `ASSUMPTION:` and every `OPEN:`, including pending knowledge
   extractions. Ask the user to resolve or explicitly accept each one.
4. **Separate provenance from content.** The answers normalize into the artifact's sections. The
   *rationale* (decisions made, alternatives rejected, assumptions resolved) goes into the Design
   Record appendix. Interview Q&A never becomes runtime knowledge; see the litmus test in
   [KNOWLEDGE-CAPTURE-OKF.md](./KNOWLEDGE-CAPTURE-OKF.md).
5. **Get explicit approval.** Wait for the user to say it is right. "Seems fine" is not approval; a
   direct confirmation is.

> **HARD GATE:** Do NOT emit while a blocking `OPEN:` is unresolved, unless the user explicitly
> downgrades the artifact to a draft and that downgrade is recorded in the artifact itself.
