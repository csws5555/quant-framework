# Included Conexus Core snapshot

`vendor/conexus` is a verified source export from the Conexus project.
The exact source commit and per-file hashes are recorded in its `EXPORT.json`;
`integrations/conexus/runtime.lock.json` pins the bundled version. Deployment refs separately identify the running version.

The 2026-10-20 CI maintenance export is commit
`5c7eec9cd50f61b9fe776d17c609719976975614`, created from the verified standalone
export of upstream `dcc74445382d73be7f1ff06b7bde147c95e7240d`. Its explicit
`provenance` records that base. It upgrades the embedded App CSS compiler to
Tailwind 4 and patches dependencies, preserving source-only scanning, custom
surface colors and the absence of global preflight. It also canonicalizes workspace
root comparisons for macOS aliases and Windows junctions/short paths, while
rejecting linked content outside the workspace. No private checkout was
imported. The verified source files remain read-only build inputs; refresh them
through `scripts/sync_conexus_core.py --export-root <reviewed-export>`.

The owner has selected the runtime core and local service for opening. The Canvas
editor/UI and commercial services remain private and are not in this snapshot.
The Conexus license has not yet been selected; the snapshot is an internal source
candidate, not a published open-source release. AlphaLab's package license metadata
does not select or replace the Conexus license.

JavaScript dependencies are recorded in the snapshot's own package lock and retain
their upstream licenses. Generated dependencies, credentials, workspaces and Git
history are excluded from this source snapshot. See its README for the source
boundary and standalone build instructions.
