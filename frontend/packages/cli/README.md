# erdkit

Command-line tool that generates a standalone web app displaying ER diagrams.

A fork of [Liam ERD](https://github.com/liam-hq/liam) (Apache-2.0, ROUTE06, Inc.)
adding persisted table positions, canvas memos, colour coding, a read-only
default with an explicit edit mode, and MySQL schema export. See `NOTICE` for the
full list of changes.

## Usage

```bash
npx erdkit erd build --input schema.sql --format postgres --output-dir dist
```

`--format` accepts `postgres`, `schemarb`, `prisma`, `drizzle`, `tbls`, `liam`.
The output directory is a static SPA — serve it over HTTP, `file://` will not work:

```bash
npx serve dist/
```

Parser and format details are documented upstream at https://liambx.com/docs/cli.

## Development

```bash
pnpm run build   # executable at dist-cli/bin/cli.js
pnpm run test
node ./dist-cli/bin/cli.js erd build --input ./fixtures/input.schema.rb --format schemarb
```

`pnpm dev` builds the CLI, runs it against `fixtures/input.schema.rb`, copies the
generated `schema.json` into `public/` and starts the Vite dev server.

## Project File Structure

- **`bin/cli.ts`**: main CLI script.
- **`src/cli/`**: CLI source.
- **`fixtures/input.schema.rb`**: sample input for testing and development.
- **`src/{App,main}.tsx`**, **`index.html`**: the ER diagram web app entry point.
