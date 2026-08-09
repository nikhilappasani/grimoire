---
type: Reference
title: The Rust Reference
description: Authoritative formal specification of the Rust language — syntax, semantics, and behaviour
why: When The Rust Book's explanation isn't precise enough, the Reference is the ground truth
resource: https://doc.rust-lang.org/reference/
tags: [rust, reference, specification]
timestamp: 2025-07-15
source_system: Public docs
access_state: linked
sensitivity: public
---

# The Rust Reference

Official language reference at <https://doc.rust-lang.org/reference/>. Free online.

## When PAC should cite this

- When a learner asks about precise language behaviour (not just how to use a feature, but exactly what it does)
- When the learner encounters an edge case the Rust Book doesn't cover
- When explaining: type coercions, pattern matching exhaustiveness, trait resolution order, macro hygiene
- Cite as: "The Rust Reference — [Section name] covers this precisely."

## Key sections

| Section | When to cite |
| --- | --- |
| Expressions | Evaluation order, place expressions, value expressions |
| Statements | `let`, `item`, expression statements |
| Patterns | Exhaustiveness, binding modes, `ref` patterns |
| Types | Type inference limits, `!` type, `dyn Trait` sizing |
| Traits | Object safety, coherence rules, blanket implementations |
| Lifetimes | Elision rules, variance |
| Macros | `macro_rules!` syntax and hygiene |
| Unsafe | What `unsafe` permits and what it doesn't |

## Usage note

The Reference is dense and formal. Point learners here for precision, not for first learning.
Always pair a Reference citation with a plain-language explanation of what the relevant section says.
