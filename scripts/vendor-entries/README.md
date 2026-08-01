# vendor entries

One-line re-export stubs, one per bare specifier the client imports. `pnpm vendor`
feeds them to esbuild, which bundles each into `public/vendor/<name>.js` so the app
serves its dependencies from its own origin instead of a CDN.

Why stubs exist at all: esbuild takes **file** entry points, not package names. Each
stub is just a handle to hang a package on.

`--splitting` is the load-bearing flag. Without it every entry would inline its own
copy of preact, and a second preact instance leaves `@preact/signals` patching an
`options` object the app never renders through — the list then goes stale on
add/toggle. With it, esbuild hoists preact into one shared chunk that `preact.js`,
`hooks.js` and `signals.js` all import, so there is exactly one instance.

`@preact/signals-core` needs no stub: it is a transitive dep of `@preact/signals`,
so esbuild resolves and bundles it. It is deliberately absent from the importmap in
`src/layout.tsx` — nothing requests it by bare name at runtime.

Adding a dependency: install it, add a stub here, add an importmap entry pointing at
`/vendor/<stub-name>.js`. Use `export { default } from '…'` for default-export
packages (htm, canvas-confetti) and `export * from '…'` for named-export ones.
