
/**
 * patch-scheduler.js
 *
 * Usage:
 *   1) Place this file in the same folder as your existing scheduler.js
 *   2) Run:  node patch-scheduler.js
 *   3) Result: scheduler.updated.js (backup: scheduler.backup.js)
 *
 * This script injects a deterministic fairness selector and rewires Offer, Lane VCA,
 * and Lane generators to use it.
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.resolve(process.cwd(), 'scheduler.js');
const BACKUP = path.resolve(process.cwd(), 'scheduler.backup.js');
const OUTPUT = path.resolve(process.cwd(), 'scheduler.updated.js');

if (!fs.existsSync(INPUT)) {
  console.error('ERROR: scheduler.js not found in current directory.');
  process.exit(1);
}

const src = fs.readFileSync(INPUT, 'utf8');
fs.writeFileSync(BACKUP, src, 'utf8');

function escRE(s){
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceFunctionBody(code, funcName, newBody) {
  // Matches: funcName(tempSchedule) { ... }
  const re = new RegExp(
    funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '\\s*\\(\\s*tempSchedule\\s*\\)\\s*\\{[\\s\\S]*?\\n\\},'
  );
  if (!re.test(code)) {
    console.warn(`WARN: Could not find function ${funcName}(tempSchedule) to replace.`);
    return code;
  }
  const replacement = `${funcName}(tempSchedule) ${newBody},`;
  return code.replace(re, replacement);
}

function insertAfterUpdateFairness(code, insertText) {
  // Find the end of updateFairnessScoreOnAssignment(...) method
  const re = /updateFairnessScoreOnAssignment\s*\([^)]*\)\s*\{[\s\S]*?\n\},\n/;
  const match = re.exec(code);
  if (!match) {
    console.warn('WARN: Could not locate updateFairnessScoreOnAssignment(...) block to insert after.');
    return code;
  }
  const idx = match.index + match[0].length;
  return code.slice(0, idx) + '\n' + insertText + '\n' + code.slice(idx);
}

// ---------------- New selector + helpers ----------------
const NEW_HELPERS = `
// =================================================================================
// NEW — DETERMINISTIC FAIRNESS SELECTOR
// Builds a pool of eligible staff for a target shift, scores burden over the
// last 4 schedule weeks + current temp schedule, and assigns the shift to the
// lowest-score (fairest) candidate.
// =================================================================================

/**
 * Selects the fairest eligible candidate for a shift and assigns it.
 * Deterministic: picks the *lowest* predicted burden (no random weighting).
 *
 * @param {Object} params
 * @param {String} params.shiftType   - e.g., "Lane", "Offer", "CBC", "Lane VCA", "Training"
 * @param {Object} params.day         - one of this.weekDates items (has name, fullDate)
 * @param {String} params.shiftTime   - e.g., "9a-5p"
 * @param {Object} params.tempSchedule- the schedule object we're filling (mutable)
 * @param {Function} [params.roleFilter] - optional predicate(staff) => boolean to restrict by role
 * @returns {Object|null} { staff, score } of chosen candidate, or null if none
 */
selectFairCandidateAndAssign({ shiftType, day, shiftTime, tempSchedule, roleFilter = null }) {
  const pool = this._buildEligiblePool({ shiftType, day, shiftTime, tempSchedule, roleFilter });
  if (pool.length === 0) {
    this.generationErrors.push(`Warning: No eligible candidates for ${shiftType} on ${day.name}.`);
    return null;
  }

  const contexts = this._getLastNWeeksContexts(4, tempSchedule);
  const meta = this._getShiftMeta(day, shiftTime, shiftType);

  const scored = pool.map(staff => {
    let score = this._computeBurdenScore(staff.id, contexts, meta, /*assumeAssign*/ true);

    // APM weekly closer encouragement:
    if (meta.isClosing && staff.types.includes("APM")) {
      const hasCloser = this.checkApmCloserInSchedule(tempSchedule, staff.id);
      if (!hasCloser) score -= 10; // strong bias to satisfy "must have a closer"
    }

    // Small tiebreaker: fewer assigned shifts this week gets a tiny advantage
    score += 0.01 * this.getShiftCount(staff.id, tempSchedule);
    return { staff, score };
  });

  scored.sort((a, b) => a.score - b.score || a.staff.name.localeCompare(b.staff.name));
  const chosen = scored[0];

  // Assign and update fairness immediately
  this.assignShift(chosen.staff.id, day.fullDate, shiftTime, shiftType, tempSchedule);
  this.updateFairnessScoreOnAssignment(chosen.staff.id, day, shiftTime, shiftType);

  return chosen;
},

/**
 * Builds the eligible pool for a shift using your existing checks + APM opening priority.
 */
_buildEligiblePool({ shiftType, day, shiftTime, tempSchedule, roleFilter }) {
  let pool = this.data.staff.filter(staff =>
    staff.availability?.shifts?.includes(shiftType) &&
    (!roleFilter || roleFilter(staff)) &&
    this.isStaffEligibleForShift(staff, day, shiftTime, tempSchedule)
  );

  const meta = this._getShiftMeta(day, shiftTime, shiftType);

  // APM priority for OPENING shifts: if any APMs are eligible, restrict pool to APMs.
  if (meta.isOpening) {
    const apmOnly = pool.filter(s => s.types.includes("APM"));
    if (apmOnly.length > 0) pool = apmOnly;
  }

  return pool;
},

/**
 * Computes burden score across the last 4 saved weeks + current temp schedule.
 * Then (optionally) adds the penalty of the candidate receiving THIS shift now.
 *
 * Penalty model (defaults; can later move to advanced_rules if you like):
 * - Closing (Sun–Thu):              +3
 * - Saturday (any shift):           +2
 * - Friday closing:                 +5
 * - Saturday closing:               +6   (extra bad)
 * - Opening:                        +0
 *
 * Lower score = less burden = more fair.
 */
_computeBurdenScore(staffId, contexts, meta, assumeAssign = false) {
  const W = {
    CLOSE: 3,
    SATURDAY: 2,
    FRI_CLOSE: 5,
    SAT_CLOSE: 6,
    OPEN: 0,
  };

  let score = 0;

  const isTypeOnDay = (shift, dayName, kind) => {
    const hours = this.data.store_hours?.[dayName];
    if (!hours || typeof hours.open !== "number" || typeof hours.close !== "number") return false;
    const opener = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
    const closer = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;
    return kind === "open" ? (shift.time === opener)
         : kind === "close" ? (shift.time === closer)
         : false;
  };

  contexts.forEach(ctx => {
    const scheduleForStaff = ctx?.[staffId];
    if (!scheduleForStaff) return;

    for (const dateStr in scheduleForStaff) {
      const shift = scheduleForStaff[dateStr];
      if (!shift || shift.type === "OFF") continue;

      const d = new Date(`${dateStr}T00:00:00`);
      const dayIdx = d.getDay(); // 0..6
      const dayName = this.daysOfWeek[dayIdx];
      const isFri = dayIdx === 5;
      const isSat = dayIdx === 6;

      const closing = isTypeOnDay(shift, dayName, "close");
      const opening = isTypeOnDay(shift, dayName, "open");

      if (closing && isSat)      { score += W.SAT_CLOSE; continue; }
      if (closing && isFri)      { score += W.FRI_CLOSE; continue; }
      if (closing)               { score += W.CLOSE; }
      else if (isSat)            { score += W.SATURDAY; }
      else if (opening)          { score += W.OPEN; } // 0
    }
  });

  if (assumeAssign) {
    if (meta.isClosing && meta.isSaturday)      score += W.SAT_CLOSE;
    else if (meta.isClosing && meta.isFriday)   score += W.FRI_CLOSE;
    else if (meta.isClosing)                    score += W.CLOSE;
    else if (meta.isSaturday)                   score += W.SATURDAY;
    else if (meta.isOpening)                    score += W.OPEN; // 0
  }

  return score;
},

/** Characterize a potential shift: isOpening/isClosing/Friday/Saturday. */
_getShiftMeta(day, shiftTime, shiftType) {
  const hours = this.data.store_hours?.[day.name] || {};
  const opener = (typeof hours.open === "number")
    ? `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`
    : null;
  const closer = (typeof hours.close === "number")
    ? `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`
    : null;

  const isOpening = opener ? (shiftTime === opener) : false;
  const isClosing = closer ? (shiftTime === closer) : false;
  const isFriday  = day.name === "Fri";
  const isSaturday= day.name === "Sat";

  return { isOpening, isClosing, isFriday, isSaturday, dayName: day.name, shiftType, shiftTime };
},

/**
 * Returns an array of contexts to scan: [ week-1, week-2, week-3, week-4, current-temp ].
 */
_getLastNWeeksContexts(n, tempSchedule) {
  const contexts = [];
  const currentWeekKey = this.weekDates?.[0]?.fullDate;
  if (!currentWeekKey) return contexts;

  for (let i = 1; i <= n; i++) {
    const d = new Date(`${currentWeekKey}T00:00:00`);
    d.setDate(d.getDate() - 7 * i);
    const key = d.toISOString().split("T")[0];
    if (this.data.schedules?.[key]) contexts.push(this.data.schedules[key]);
  }
  contexts.push(tempSchedule);
  return contexts;
},
`;

// ---------------- Replacement bodies (as JS string with leading space and brace) ----------------
const BODY_OFFER = `{
  console.log("Running generateOfferShifts");
  this.generationErrors.push(`Generating ${this.getShiftTypeName('Offer')} shifts...`);
  const offerRules = this.data.shift_rules["Offer"];
  if (!offerRules || !offerRules.daily_requirements) {
    this.generationErrors.push(
      `Error: '${this.getShiftTypeName('Offer')}' shift rules are not configured correctly.`
    );
    return;
  }

  for (const day of this.weekDates) {
    const requiredCount = offerRules.daily_requirements[day.name] ?? 0;
    if (requiredCount === 0) continue;

    let assignedCount = Object.values(tempSchedule).reduce(
      (count, staffShifts) => (staffShifts[day.fullDate]?.type === "Offer" ? count + 1 : count),
      0
    );

    while (assignedCount < requiredCount) {
      const shiftTime = this.data.advanced_rules.default_shift_hours["Offer"] ?? "10a-7p";
      const chosen = this.selectFairCandidateAndAssign({
        shiftType: "Offer",
        day,
        shiftTime,
        tempSchedule,
        roleFilter: (s) => s.types.some(t => ["B", "SB", "APM"].includes(t))
      });

      if (chosen) { assignedCount++; continue; }

      // --- Fallback: try flipping per original logic ---
      const hours = this.data.store_hours[day.name];
      if (!hours) break;

      const closerShiftTime = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;
      const closingStaffEntry = Object.entries(tempSchedule).find(([staffId, shifts]) => {
        const staff = this.data.staff.find(s => s.id == staffId);
        return shifts[day.fullDate]?.time === closerShiftTime &&
               shifts[day.fullDate]?.type === "Lane" &&
               staff && (staff.types.includes("B") || staff.types.includes("SB"));
      });
      if (closingStaffEntry) {
        const [staffIdToFlip] = closingStaffEntry;
        const staffToFlip = this.data.staff.find(s => s.id == staffIdToFlip);
        console.log(`[Offer] Flipping closer ${staffToFlip.name} on ${day.name} to Offer.`);
        this.generationErrors.push(`Flipped closer ${staffToFlip.name} on ${day.name} to an Offer shift.`);
        tempSchedule[staffIdToFlip][day.fullDate].type = "Offer";
        assignedCount++;
        continue;
      }

      const openerShiftTime = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
      const openingStaffEntry = Object.entries(tempSchedule).find(([staffId, shifts]) => {
        const staff = this.data.staff.find(s => s.id == staffId);
        return shifts[day.fullDate]?.time === openerShiftTime &&
               shifts[day.fullDate]?.type === "Lane" &&
               staff && !staff.types.includes("APM");
      });
      if (openingStaffEntry) {
        const [staffIdToFlip] = openingStaffEntry;
        const staffToFlip = this.data.staff.find(s => s.id == staffIdToFlip);
        console.log(`[Offer] Flipping opener ${staffToFlip.name} on ${day.name} to Offer.`);
        this.generationErrors.push(`Flipped opener ${staffToFlip.name} on ${day.name} to an Offer shift.`);
        tempSchedule[staffIdToFlip][day.fullDate].type = "Offer";
        assignedCount++;
        continue;
      }

      this.generationErrors.push(
        `Warning: Could not find or flip a candidate for an Offer shift on ${day.name}.`
      );
      break;
    }

    const finalAssignedCount = Object.values(tempSchedule).reduce(
      (count, staffShifts) => (staffShifts[day.fullDate]?.type === "Offer" ? count + 1 : count),
      0
    );
    if (finalAssignedCount < requiredCount) {
      this.generationErrors.push(
        `Warning for ${day.name}: Required ${requiredCount} Offer shifts, but only ${finalAssignedCount} could be assigned.`
      );
    }
  }
`;

const BODY_LANEVCA = `{
  console.log("Running generateLaneVcaShifts");
  this.generationErrors.push("Generating Lane VCA shifts...");
  const laneVcaRules = this.data.shift_rules["Lane VCA"];
  if (!laneVcaRules || !laneVcaRules.daily_requirements) {
    this.generationErrors.push("Error: 'Lane VCA' shift rules are not configured.");
    return;
  }

  const eligibleDays = this.weekDates
    .filter(day => (laneVcaRules.daily_requirements[day.name] ?? 0) > 0)
    .sort((a, b) => (this.data.advanced_rules.day_priority.lane[a.name] ?? 99) - (this.data.advanced_rules.day_priority.lane[b.name] ?? 99));

  const isVcaOnly = (s) => s.types.length === 1 && s.types.includes("VCA");
  const isApmVca  = (s) => s.types.includes("APM") && s.types.includes("VCA");
  const isOtherVca= (s) => s.types.includes("VCA") && !isVcaOnly(s) && !isApmVca(s);

  const candidatePools = [
    { name: "VCA-Only", roleFilter: isVcaOnly },
    { name: "APM-VCA",  roleFilter: isApmVca },
    { name: "Other VCA", roleFilter: isOtherVca },
  ];

  const otherShiftTimes = Object.entries(this.data.advanced_rules.vca_shift_priority)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => a - b)
    .map(([key]) => this.formatRequestTime(key));

  for (const day of eligibleDays) {
    const requiredCount = laneVcaRules.daily_requirements[day.name] ?? 0;
    let assignedCount = Object.values(tempSchedule).filter(s => s[day.fullDate]?.type === "Lane VCA").length;

    const shiftTimesToTry = [
      `${this.formatTime(this.data.store_hours[day.name].close - 9)}-${this.formatTime(this.data.store_hours[day.name].close)}`,
      ...otherShiftTimes
    ];

    let pass = 0;
    while (assignedCount < requiredCount && pass < 10) {
      let assignedInPass = false;

      for (const shiftTime of shiftTimesToTry) {
        if (assignedCount >= requiredCount) break;

        for (const pool of candidatePools) {
          const chosen = this.selectFairCandidateAndAssign({
            shiftType: "Lane VCA",
            day,
            shiftTime,
            tempSchedule,
            roleFilter: pool.roleFilter
          });

          if (chosen) {
            console.log(`VCA on ${day.name} (Pass ${pass + 1}): Assigned ${shiftTime} to ${chosen.staff.name} from pool "${pool.name}"`);
            assignedCount++;
            assignedInPass = true;
            break;
          }
        }
        if (assignedInPass) break;
      }

      pass++;
      if (!assignedInPass) break;
    }
  }
`;

const BODY_LANE = `{
  console.log("Running generateLaneShifts");
  this.generationErrors.push("Generating Lane shifts based on fairness...");
  const laneRules = this.data.shift_rules["Lane"];
  if (!laneRules || laneRules.days.length === 0) {
    this.generationErrors.push("Error: 'Lane' shift rules are not configured.");
    return;
  }

  const sortedLaneDays = this.weekDates
    .filter(day => laneRules.days.includes(day.name))
    .sort((a, b) => (this.data.advanced_rules.day_priority.lane[a.name] ?? 99) - (this.data.advanced_rules.day_priority.lane[b.name] ?? 99));

  const isVcaOnly = (staff) => staff.types.length === 1 && staff.types.includes("VCA");

  // -------- Phase 1: Closing shifts per day using fairness --------
  for (const day of sortedLaneDays) {
    const hours = this.data.store_hours[day.name];
    if (!hours || !hours.close) continue;

    const closerShiftTime = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;

    const closerAlreadyAssigned = Object.entries(tempSchedule).some(([staffId, shifts]) => {
      if (shifts[day.fullDate]?.time === closerShiftTime) {
        const staffMember = this.data.staff.find(s => s.id == staffId);
        return staffMember && !isVcaOnly(staffMember);
      }
      return false;
    });
    if (closerAlreadyAssigned) continue;

    const chosen = this.selectFairCandidateAndAssign({
      shiftType: "Lane",
      day,
      shiftTime: closerShiftTime,
      tempSchedule,
      roleFilter: (s) => (s.types.includes("APM") || s.types.includes("SB") || s.types.includes("B")) && !isVcaOnly(s)
    });

    if (!chosen) {
      this.generationErrors.push(`Warning: Could not find an eligible closer for ${day.name}.`);
    } else {
      console.log(`[Lane] Assigned closer ${chosen.staff.name} on ${day.name}.`);
    }
  }

  // -------- Phase 2: APM openers on low-coverage days --------
  const apmStaff = this.data.staff.filter(s => s.types.includes("APM"));
  const dayAvailability = this.weekDates.reduce((acc, d) => {
    acc[d.name] = this.data.staff.filter(s => s.availability?.hours?.[d.name]?.start || s.availability?.hours?.[d.name]?.end).length;
    return acc;
  }, {});

  for (const apm of apmStaff) {
    let potentialDaysForApm = this.weekDates
      .filter(d => {
        const hours = this.data.store_hours[d.name];
        if (!hours || hours.open == null) return false;
        const openerShiftTime = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
        return laneRules.days.includes(d.name) && this.isStaffEligibleForShift(apm, d, openerShiftTime, tempSchedule);
      })
      .sort((a, b) => dayAvailability[a.name] - dayAvailability[b.name]);

    while (this.getShiftCount(apm.id, tempSchedule) < 5 && potentialDaysForApm.length > 0) {
      const bestDay = potentialDaysForApm.shift();
      if (!bestDay) break;
      const hours = this.data.store_hours[bestDay.name];
      const openerShiftTime = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;

      const openerAlreadyAssigned = Object.values(tempSchedule).some(s => s[bestDay.fullDate]?.time === openerShiftTime);
      if (!openerAlreadyAssigned) {
        const chosen = this.selectFairCandidateAndAssign({
          shiftType: "Lane",
          day: bestDay,
          shiftTime: openerShiftTime,
          tempSchedule,
          roleFilter: (s) => s.types.includes("APM")
        });
        if (chosen) console.log(`[Lane] Assigned APM opener ${chosen.staff.name} on ${bestDay.name}.`);
      }
    }
  }

  // -------- Phase 3: Remaining openers to B/SB --------
  for (const day of sortedLaneDays) {
    const hours = this.data.store_hours[day.name];
    if (!hours || !hours.open) continue;

    const openerShiftTime = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
    const openerAlreadyAssigned = Object.values(tempSchedule).some(s => s[day.fullDate]?.time === openerShiftTime);
    if (openerAlreadyAssigned) continue;

    const chosen = this.selectFairCandidateAndAssign({
      shiftType: "Lane",
      day,
      shiftTime: openerShiftTime,
      tempSchedule,
      roleFilter: (s) => (s.types.includes("B") || s.types.includes("SB")) && !isVcaOnly(s)
    });

    if (chosen) console.log(`[Lane] Assigned B/SB opener ${chosen.staff.name} on ${day.name}.`);
  }
`;

let out = src;

// 1) Inject new helpers after updateFairnessScoreOnAssignment
out = insertAfterUpdateFairness(out, NEW_HELPERS);

// 2) Replace the three generator bodies
out = replaceFunctionBody(out, 'generateOfferShifts', BODY_OFFER);
out = replaceFunctionBody(out, 'generateLaneVcaShifts', BODY_LANEVCA);
out = replaceFunctionBody(out, 'generateLaneShifts', BODY_LANE);

fs.writeFileSync(OUTPUT, out, 'utf8');
console.log('Patch complete. Wrote:', OUTPUT);
console.log('Backup preserved as:', BACKUP);
