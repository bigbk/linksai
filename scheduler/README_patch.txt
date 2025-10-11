
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

Love it—great callout. I added a weekly multi‑closer penalty so that giving someone a 2nd closing shift in the same week (and any additional closers) is penalized extra during selection. It integrates into the deterministic fairness selector we added earlier.
What changed
Inside the fairness selector (selectFairCandidateAndAssign), right after the base burden score is computed:

If the target assignment is a closing shift, we count how many closers this candidate already has in this week (based on the current in‑progress tempSchedule).
For each existing closer, we add an extra penalty (+4 per closer by default).

So the 2nd closer costs +4, 3rd costs +8, etc.


This penalty stacks on top of your existing Friday/Saturday close penalties (Fri close +5, Sat close +6). [carmax-my....epoint.com]


The count uses your existing helper countApmClosingShifts(tempSchedule, staffId) which works for any staff, not just APMs—it looks at the shift times vs. store close for each day of the current week. [carmax-my....epoint.com]


Download the updated patcher (v2)

Patch script (v2): patch-scheduler-v2.js


This replaces the fairness selector we added earlier and rewires Offer, Lane VCA, and Lane generators to use it—with the new multi‑closer penalty built in. Save this file next to your current scheduler.js. 2

How to apply

Place patch-scheduler-v2.js in the same folder as your live scheduler.js. 2
Run:
Shellnode patch-scheduler-v2.jsShow more lines
It will produce:

scheduler.backup.js (original backup)
scheduler.updated.js (merged with new fairness and penalties) 2


Point your app at scheduler.updated.js (or rename it back to scheduler.js). Your index.html already loads the scheduler script—just ensure it references the updated filename. [us-prod.as...rosoft.com]


The exact code you’re getting (core snippet)
For transparency, here’s the key part added to the selector’s scoring:
JavaScript// NEW: Heavier penalty for 2nd (and subsequent) closers in the SAME weekif (meta.isClosing) {  const unit = this.data.advanced_rules?.fairness?.weights?.weeklySecondClose ?? 4; // default +4 each additional  const already = this.countApmClosingShifts(tempSchedule, staff.id); // counts current week closers  if (already > 0) score += unit * already;  // 2nd closer => +4, 3rd => +8, etc.}Show more lines
This runs before we sort candidates by final score. Lower is better, so people who’ve already closed this week will look worse for another closer (especially on Fri/Sat). 2

Optional: Make the penalty configurable in UI
I set the value to +4 per extra closer by default and made it config‑ready at data.advanced_rules.fairness.weights.weeklySecondClose (if present). If you want, I can add a small control under Advanced Rules so you can tweak it without code. 2 [carmax-my....epoint.com]

Sanity test you can try

Create a week where Alice has already been assigned one closer.
Attempt to fill another closing slot on a different day.
You should see the selector prefer someone other than Alice—unless others are ineligible—because Alice carries the extra +4 burden on top of regular close penalties. The Generation Log should reflect the assignment as usual. [carmax-my....epoint.com]

If you want me to bake this into a fully merged scheduler.js for immediate download, upload your current file and I’ll return a ready-to-use version.
