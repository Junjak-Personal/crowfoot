// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
//
// The schema model on its own, without the deparsers and the migration
// operations the package root also carries. Those reach `@crowfoot/neverthrow`,
// which is TypeScript source in another workspace package — fine for anything
// bundled by Vite, fatal for the CLI, whose rollup build compiles only its own
// sources. Same split, and same reason, as `./parser`.
export * from './schema/index.js'
