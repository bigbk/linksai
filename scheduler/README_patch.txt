
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


----------------------
What’s in this build


Deterministic fairness selector (selectFairCandidateAndAssign) that:

Builds the eligible pool for the target day/shift using your existing availability, time‑off, and weekly‑cap checks. [us-prod.as...rosoft.com]
Computes a burden score from the last 4 weeks + current in‑progress week for each candidate. Closing shifts are “bad,” Saturday shifts are “bad,” Friday & Saturday closing are extra bad. Lowest score wins (no randomness). [us-prod.as...rosoft.com]
New: adds a weekly multi‑closer penalty: if a candidate already has a closing shift this week, each additional closer adds +4 by default (2nd closer = +4; 3rd = +8, etc.). You can override via data.advanced_rules.fairness.weights.weeklySecondClose. 2
Honors APM rules you asked for:

APM priority for opening shifts (if any APMs are eligible, the pool is restricted to APMs). [us-prod.as...rosoft.com]
Bias toward ensuring each APM gets a closing shift during the week (we subtract a big bonus from score when an APM without a closer is considered for a closing slot). [us-prod.as...rosoft.com]





Generators updated to call the fairness selector:

Offer: replaced weighted/random selection with fairness; keeps your “flip opener/closer to Offer” fallbacks when needed. 2
Lane VCA: schedules by pool priority (VCA‑only → APM‑VCA → other VCA) with fairness per shift time (closer first). 2
Lane: fairly assigns closers, then APM openers (low‑coverage days first), then remaining B/SB openers—all via the selector. 2



Everything else preserved (data model, manual edits, locking, exports, validation). The new selector plugs into the same helpers you already use (e.g., isStaffEligibleForShift, assignShift, updateFairnessScoreOnAssignment), so it plays nicely with your UI and saved schedules. [us-prod.as...rosoft.com]



How to use it

Replace the script your page loads:

Rename scheduler.updated.js → scheduler.js, or
Update the <script> in index.html to point at scheduler.updated.js. Your current app references a standalone scheduler.js file—swapping it is all you need. [us-prod.as...rosoft.com]


Refresh the app and generate Lane / Offer / Lane VCA.
Check the Generation Log to see the deterministic selections.


Tuning the “2nd closer this week” penalty
The extra weekly closer penalty defaults to +4 per additional closer. To make it lighter/heavier, you can set:
JavaScript// Run in browser console after the app loads, then click “Save Changes”const app = document.querySelector('[x-data]').__x.$data;app.data.advanced_rules.fairness = app.data.advanced_rules.fairness || {};app.data.advanced_rules.fairness.weights = app.data.advanced_rules.fairness.weights || {};app.data.advanced_rules.fairness.weights.weeklySecondClose = 5; // e.g., +5 per extra closerapp.saveDataToLocalStorage();Show more lines
This is read by the selector at this.data.advanced_rules?.fairness?.weights?.weeklySecondClose ?? 4. 2

Quick smoke‑test checklist

APM opener priority: Run Lane openers—APMs should be picked first when eligible. 2
APM closer coverage: At least one closing shift per APM week (bias helps; validation still warns if unmet). [us-prod.as...rosoft.com]
Second closer deterrent: If someone has already closed this week, they should only get another close when others are ineligible or would be even less fair. 2
Friday/Saturday closing: Those should be assigned last to folks with the lowest recent “badness,” given the extra penalties. 2


If you want the penalties (close / Fri close / Sat close / Sat any / weekly second closer) editable from Advanced Rules UI, say the word and I’ll add a small section in the panel to adjust them—no code edits needed.
