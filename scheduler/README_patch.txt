
# Scheduler.js Fairness Patch

This patch adds a deterministic fairness selector and rewires Offer, Lane VCA, and Lane generators to use it.

## How to use

1. Put **patch-scheduler.js** in the same folder as your current **scheduler.js**.
2. Run:

   ```bash
   node patch-scheduler.js
   ```

3. The script will produce:
   - `scheduler.backup.js` (a backup of your original)
   - `scheduler.updated.js` (the merged file with changes)

4. Replace your app's reference to `scheduler.js` with `scheduler.updated.js` (or rename `scheduler.updated.js` back to `scheduler.js`).

## What the patch does
- Inserts a new fairness selector (`selectFairCandidateAndAssign`) plus helpers.
- Replaces the bodies of `generateOfferShifts`, `generateLaneVcaShifts`, `generateLaneShifts` to use the selector.
- Leaves all other logic, storage, and UI intact.

## Rollback
If anything looks off, just restore `scheduler.backup.js` to `scheduler.js`.
