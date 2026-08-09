# Case Mismatch

The real file is `target.md`. This links to `Target.md`, which passes `fs.existsSync` on a
case-insensitive filesystem and fails on Linux CI: [target](./Target.md).
