---
type: Reference
title: Let's Get Rusty Cheat Sheet v1.0.5
description: Quick-reference card covering Rust's core syntax and concepts on one page
why: Fastest lookup for syntax a learner half-remembers — PAC points here for immediate reminders before deeper book references
resource: file:///home/nikhilappasani/Downloads/Lets%20Get%20Rusty%20Cheat%20Sheet.pdf
tags: [rust, learning, cheat-sheet, reference]
timestamp: 2025-07-15
source_system: Local file
access_state: extracted
sensitivity: public
---

# Let's Get Rusty Cheat Sheet v1.0.5

Local copy at `/home/nikhilappasani/Downloads/Lets Get Rusty Cheat Sheet.pdf`.
YouTube channel: <https://www.youtube.com/c/LetsGetRust>

## What it covers (full table of contents)

- **Basic Types & Variables** — `bool`, `u8`–`u128`, `i8`–`i128`, `f32`/`f64`, `usize`/`isize`, `char`, `&str`, `String`, tuples, arrays, slices, `HashMap`, constants, static variables, mutability, shadowing, type aliases
- **Control Flow** — `if`/`if let`, `loop` (with break values), nested loops and labels, `while`/`while let`, `for`, `match`
- **References, Ownership & Borrowing** — the three ownership rules, the two borrowing rules, moves vs. copies, clone, ownership through functions, mutable references
- **Pattern Matching** — `match`, `if let`, `while let`, destructuring structs/enums/tuples
- **Iterators** — `iter()`, `into_iter()`, `iter_mut()`, common adapters (`map`, `filter`, `fold`, `zip`, `enumerate`, `collect`)
- **Error Handling** — `panic!`, `Option` (`Some`/`None`), `Result` (`Ok`/`Err`), `?` operator, `unwrap`, `expect`
- **Generics, Traits & Lifetimes** — generic functions/structs/enums, trait definitions and implementations, trait bounds, default implementations, lifetime annotations
- **Functions, Closures & Function Pointers** — function syntax, closures (`Fn`/`FnMut`/`FnOnce`), function pointers
- **Pointers** — references, `Box<T>`, `Rc<T>`, `RefCell<T>`, raw pointers
- **Packages, Crates & Modules** — `mod`, `use`, `pub`, `super`, `self`, `extern crate`

## When PAC should cite this

- When a learner needs a syntax reminder mid-step and doesn't need a full chapter explanation
- Cite as: "Quick syntax reference: Let's Get Rusty Cheat Sheet — [section name]."
- Always follow up with The Rust Book chapter if the learner needs the *why*, not just the *what*.
