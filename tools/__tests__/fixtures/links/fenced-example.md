# Fenced Example

A real link that must resolve: [target](./target.md).

An illustrative link inside a fence, which must be ignored:

```markdown
See [Retention Window](../policies/retention-window.md) for the rule.
```

An illustrative link inside an inline code span, also ignored: `[x](./nope.md)`.

A tilde fence, also ignored:

~~~markdown
[y](./also-nope.md)
~~~
