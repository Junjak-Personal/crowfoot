# Changelog

Notable changes per release. Written for someone deciding whether to upgrade, so it
records behaviour and reasons rather than commits — `git log` already has those.

Versions follow [semver](https://semver.org/). While the major is `0`, a minor bump
is where a breaking change may appear.

> Starts at `0.1.3`. `0.1.0`–`0.1.2` shipped the same day this project was renamed
> from `erdkit` and are on npm without notes; the history before that — including the
> fork from [Liam ERD](https://github.com/liam-hq/liam) — is recorded in
> [`NOTICE`](./NOTICE) and in git, and is deliberately not restated here.

## Unreleased

## 0.1.3

### Fixed

- The package page on npm documented a `pnpm dev` that runs against `fixtures/`. It
  fetches a remote schema over the network, so anyone following it offline watched a
  command fail for a reason the docs denied.
- Its only reference link pointed at upstream's CLI documentation, which describes a
  different command. It now points at the parser format docs, which do still apply,
  labelled as upstream — plus this repository's own usage guide, which the package
  page never offered.

### Added

- The npm page now states the `--input` relative-path constraint, that the output
  mounts at a sub-path unchanged, that `LICENSE` and `NOTICE` ship inside it, and the
  `--force` caveat for `erd-core`-only rebuilds.
