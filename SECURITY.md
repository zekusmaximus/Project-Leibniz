# Security policy and historical credential notice

## Feature-frozen repository

Project-Leibniz is a reference implementation and is not a supported production service. Security changes remain permitted during feature freeze.

## Historical MongoDB credential

A real MongoDB Atlas connection string was committed in earlier Git history. It is absent from the current tracked tree and `.env` files are ignored, but removal from the current tree does not make the historical secret safe.

External status update, July 13, 2026: the owner signed in to Atlas and confirmed that the associated project and free-tier cluster still existed, appeared to be running, and showed no recent use.

Remediation confirmed July 13, 2026:

1. the owner deleted the compromised SCRAM database user;
2. the owner deleted both project IP access-list entries, including the public-internet entry; and
3. the confirmation was recorded in the Narramorph Phase 0 consolidation issue without posting sensitive identifiers.

Deleting the database user makes the historical connection string unusable. Removing the access-list entries also closes the prototype's direct network path while preserving the Atlas project, cluster, and stored data. The credential-remediation condition of the archive gate is satisfied.

Unused deployment or repository secrets containing the old URI should still be removed as routine hygiene if any are later discovered; they cannot restore the deleted Atlas database identity.

## Reporting

Do not open a public issue containing credentials or sensitive logs. Report security concerns privately to the repository owner.

## Supported changes

Only security, provenance, extraction-support, and archival-preparation changes are accepted during consolidation. No new backend deployment should be created from this repository.
