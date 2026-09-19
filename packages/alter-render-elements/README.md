# @alter/render-elements

`<alter-compare>` — the before/after reveal slider, as a custom element. No framework
dependency, so it works in React, Vue, Svelte, Angular, Astro, Rails, WordPress, or a
plain HTML file. Shadow DOM keeps your host CSS out and its CSS in.

```html
<script type="module">import '@alter/render-elements';</script>

<alter-compare before="/before.jpg" after="/after.jpg" label-after="Alter render"></alter-compare>
```

A real `role="slider"`: focusable, arrow keys nudge by 1, Shift+arrow and Page keys by 10,
Home/End jump to the ends. Pointer capture keeps a drag tracking after it leaves the
element. The reveal layer is clipped rather than resized, so the seam stays pixel-aligned.

Attributes, events, CSS custom properties and `::part()` hooks are documented in
[`packages/README.md`](../README.md).
