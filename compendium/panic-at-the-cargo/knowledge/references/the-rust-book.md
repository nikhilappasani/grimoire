---
type: Reference
title: The Rust Programming Language (The Rust Book)
description: The official, free, comprehensive introduction to Rust — the canonical first reference
why: Every Rust learner starts here; PAC cites it for foundational concepts and chapter-level guidance
resource: https://doc.rust-lang.org/book/
tags: [rust, learning, reference]
timestamp: 2025-07-15
source_system: Public docs
access_state: extracted
sensitivity: public
---

# The Rust Programming Language (The Rust Book)

Official book by Steve Klabnik and Carol Nichols. Free online at <https://doc.rust-lang.org/book/>.

## Key chapters for PAC guidance

| Chapter | Topic | Cite when learner hits |
| --- | --- | --- |
| 4 | Ownership, References, Borrowing | Borrow checker errors, move errors |
| 5 | Structs | Defining and instantiating structs |
| 6 | Enums and Pattern Matching | `Option`, `Result`, `match` |
| 7 | Packages, Crates, Modules | `use`, `mod`, visibility |
| 8 | Common Collections | `Vec`, `String`, `HashMap` |
| 9 | Error Handling | `panic!`, `Result`, `?` operator |
| 10 | Generics, Traits, Lifetimes | Trait bounds, lifetime annotations |
| 13 | Iterators and Closures | `iter()`, `map`, `filter`, `collect` |
| 15 | Smart Pointers | `Box`, `Rc`, `RefCell` |
| 16 | Concurrency | Threads, `Arc`, `Mutex` |
| 17 | Async/Await | `async fn`, `.await`, futures |

## Usage note

Prefer citing a chapter number and title. Example: "See Chapter 4 — Understanding Ownership
in The Rust Book." Always point to the online version so the learner can follow the link immediately.
