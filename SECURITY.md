# Security policy and historical credential notice

## Feature-frozen repository

Project-Leibniz is a reference implementation and is not a supported production service. Security changes remain permitted during feature freeze.

## Historical MongoDB credential

A real MongoDB Atlas connection string was committed in earlier Git history. It is absent from the current tracked tree and `.env` files are ignored, but removal from the current tree does not make the historical secret safe.

External status update, July 13, 2026: the owner signed in to Atlas and confirmed that the associated project and free-tier cluster still exist, appear to be running, and show no recent use. This does not confirm whether the historical database user/password remains valid. Until that database user is deleted or its password is reset, the exposed credential must still be treated as usable by an unauthorized party.

Required owner action:

1. delete the affected Atlas database user if the backend is retired, or reset its password to a new unique value if the user is still needed;
2. review Atlas access/network rules and recent activity;
3. remove unused deployment/repository secrets;
4. record the confirmation in the Narramorph Phase 0 consolidation issue without posting the secret or replacement credential.

Repository automation cannot prove external revocation. Project-Leibniz must not pass its archive gate until the owner confirms this action.

## Reporting

Do not open a public issue containing credentials or sensitive logs. Report security concerns privately to the repository owner.

## Supported changes

Only security, provenance, extraction-support, and archival-preparation changes are accepted during consolidation. No new backend deployment should be created from this repository.
