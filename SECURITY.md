# Security Policy

## Scope

This policy covers **crowfoot** — the [`crowfoot`](https://www.npmjs.com/package/crowfoot)
npm package and this repository.

crowfoot is a fork of [Liam ERD](https://github.com/liam-hq/liam) and shares much of
its code. A vulnerability you find here may also exist upstream, but **reports about
upstream belong upstream** — please do not send crowfoot reports to ROUTE06, or the
other way round.

## Supported Versions

Only the latest published version receives security fixes. Older versions are not
patched retroactively.

## Reporting a Vulnerability

Email **haring157@gmail.com**. Please do not open a public issue for a vulnerability.

Include whatever you have: steps to reproduce, the version (`npx crowfoot --version`),
and what an attacker could do with it.

This is a personal project maintained by one person, so there is no guaranteed
response time. You will get an acknowledgement as soon as it is seen, and a note when
a fix ships. If you would like to be credited in the release notes, say so.

For a vulnerability in a third-party dependency, report it to that project — though
telling us as well is welcome, so the dependency can be updated or replaced here.

## What Happens Next

1. The report is confirmed and the impact assessed.
2. A fix is developed and released as a new version.
3. The release notes describe the issue once a fixed version is available.
