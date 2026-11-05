# Skill bundle signatures

`anti-ai-design install`, `update`, and `check` authenticate a remote skill ZIP
before extracting it. `universal.zip.sig.json` is an Ed25519 signature over
the ZIP's SHA-256 digest, byte length, release version, artifact name, and key
ID. The engine trusts only `scripts/bundle-signing-keys.json`, compiled into
the binary. A signature cannot introduce a new trusted key.

The release lives in GitHub Releases of `Choxie77/anti-ai-design`, under the
tag `skill-v<version>`. The installer resolves the download to that release
once and fetches the ZIP and its signature from the same release. Every
subsequent redirect must use HTTPS. Missing signatures, unknown keys, changed
metadata, and changed ZIP bytes stop the operation before extraction or
writes to installed skills. The temporary download directory is removed on
failure.

## The production key

| | |
|---|---|
| Key ID | `aad-release-2026-11` |
| Algorithm | Ed25519 |
| Public key | `scripts/bundle-signing-keys.json` (committed, 32 bytes hex) |
| Private key | PKCS#8 PEM, **never in the repository** |

The private key was generated on the maintainer's machine and written to
`~/aad-secrets/bundle-signing-private.pem` (directory `0700`, file `0600`).
Treat that file as the only copy until it is stored in two places you control
(for example a password manager and the GitHub secret below). Do not paste it
into chat, an issue, a log, or a command line. Anyone holding it can sign
bundles the shipped engine will trust.

Store it as a GitHub Actions secret named `ANTI_AI_DESIGN_SIGNING_KEY`
(Settings, Secrets and variables, Actions). From the key's directory:

```sh
gh secret set ANTI_AI_DESIGN_SIGNING_KEY --repo Choxie77/anti-ai-design < ~/aad-secrets/bundle-signing-private.pem
```

`gh secret set` reads the value from stdin, so it never appears in the shell
history or the process list. For stricter control, create a `release`
environment with required reviewers, put the secret there, and add
`environment: release` to the `sign-and-publish` job in
`.github/workflows/release.yml`.

## Sign a release

Normally you do not sign by hand: pushing the tag `v<version>` runs
`.github/workflows/release.yml`, which builds `dist/universal.zip` from the
tagged commit, signs it with `ANTI_AI_DESIGN_SIGNING_KEY`, checks the signature
against the committed public key, and publishes `universal.zip` and
`universal.zip.sig.json` together as the release `skill-v<version>`.

`scripts/sign-bundle.mjs` reads the private key from the first of these that
is set:

1. `ANTI_AI_DESIGN_SIGNING_KEY_FILE`: path to a PKCS#8 PEM. The file must not be
   group or world accessible.
2. `ANTI_AI_DESIGN_SIGNING_KEY`: the PEM itself (what the workflow passes in).
3. 1Password: `ANTI_AI_DESIGN_SIGNING_KEY_REF` (`op://vault/item/field`), with
   `OP_ACCOUNT` or the local git settings `anti-ai-design.signingAccount` /
   `anti-ai-design.signingKeyRef`.

Local signing of a build you made yourself:

```sh
export ANTI_AI_DESIGN_SIGNING_KEY_FILE="$HOME/aad-secrets/bundle-signing-private.pem"
node scripts/sign-bundle.mjs 4.8.0 dist/universal.zip
```

The key is read in-process, checked against the trusted keyring (a key that
is not listed is refused), and used to write `universal.zip.sig.json` next to
the ZIP. It is never passed as a command argument, written to a temporary
file, or printed, and read failures are reported without forwarding the
underlying error text.

`bun run release:skill -- --dry-run` does not read any key or create a
signature. It checks the usual release prerequisites and shows both assets in
the upload plan; it does not prove that signing credentials work.

Check a sidecar against the Rust verifier and compiled public key:

```sh
ANTI_AI_DESIGN_VERIFY_BUNDLE=/path/to/universal.zip \
ANTI_AI_DESIGN_VERIFY_BUNDLE_VERSION=4.8.0 \
cargo test -p anti-ai-design-skills verifies_reviewed_release_with_production_keyring -- --ignored
```

Never regenerate an old ZIP and sign those different bytes as the old
release. Uploading a sidecar for an already-published ZIP is a separate
maintainer approval step.

## Rollout and rotation

Before shipping the enforcing engine, publish a valid signature beside the
exact ZIP the installer will resolve (the first `skill-v<version>` release
made by the workflow does this). Verify the pair using a locally built engine,
then release the engine, its npm platform packages, and the CLI/skill pins.
Keep the existing release available throughout. Do not release an enforcing
engine with an empty keyring or an unsigned served ZIP.

The engine binary embeds `scripts/bundle-signing-keys.json` at build time, so
**an engine built before the key was replaced does not trust this key.**
Release a new engine (a new `ENGINE_VERSION`) after the keyring changes.

For planned rotation, ship an engine trusting both the old and new public
keys before signing with the new key. Older engines that do not know the new
key will refuse the download and ask for a CLI update. A compromised key
requires an engine update removing that public key; removing it from a
website does not revoke trust in already-installed binaries. Keep the
signing key separate from GitHub account credentials, npm tokens and
deployment credentials.

## Scope

This protects against bundle substitution when an attacker can change the
download endpoint, release asset, or both, but cannot use the signing key or
replace the trusted engine. It is not a freshness protocol: a previously
signed release can still be replayed. Signed timestamp metadata and rollback
state are separate work. Signatures do not establish that authored skill
content is safe. Separately downloaded engine binaries are covered only
through the `scripts/engine-checksums.txt` digests the signed bundle carries.

`ANTI_AI_DESIGN_BUNDLE_PATH` and `anti-ai-design link` are explicit local-development
trust paths. They continue to accept unsigned local files/directories. Do not
use those overrides to get around a failed remote verification. There is no
unsigned-network fallback or skip-signature flag.

## Wire format

JSON sidecar fields: `schema` (1), `keyId`, `version`, `artifact`
(`universal.zip`), `size`, `sha256`, `signature`. Hex strings are lowercase;
the public key is 32 bytes and the signature is 64 bytes. Unknown or repeated
fields are rejected. The signature payload is UTF-8 with LF line endings
and a final LF:

```text
anti-ai-design-skill-bundle-v1
<keyId>
skill-v<version>
universal.zip
<size as decimal>
<sha256 as lowercase hex>
```

The Node signer and Rust verifier share a fixed test vector under
`tests/fixtures/bundle-signature.json`. Its deterministic test key must never
be added to the production keyring.
