# PlanetScale backup ownership decision — 2026-08-08

## Decision

Guide Fari explicitly chose to retire the repository-owned daily PostgreSQL dump task and manage backups directly in PlanetScale.

This decision removes the failed and redundant SST `BackupTaskInvoker`/`DatabaseBackupTask` path from the application deployment. It also removes repository restore tooling so there is one operational owner for backup and restore work.

## Transition safety

- Existing S3 backup objects are not deleted by this change.
- The unlinked `DatabaseBackups` bucket remains under its 30-day expiry policy until it is empty.
- The bucket is excluded from the S3-to-R2 copy.
- Remove the retained bucket declaration only after confirming that no objects remain.

## PlanetScale operator actions

Outside this repository, the operator owns:

1. backup cadence and retention;
2. restore access;
3. a tested restore procedure.

The repository does not store PlanetScale backup credentials or claim that these operational checks have been exercised.
