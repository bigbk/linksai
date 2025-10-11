
/**
 * patch-scheduler-v2.js
 *
 * Adds deterministic fairness AND a penalty for assigning multiple closing shifts
 * to the same employee in the SAME week (2nd, 3rd, ... closers are penalized).
 *
 * Usage:
 *   1) Place this file in the same folder as your existing scheduler.js
 *   2) Run:  node patch-scheduler-v2.js
 *   3) Result: scheduler.updated.js (backup: scheduler.backup.js)
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

function replaceFunctionBody(code, funcName, newBody) {
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
  const re = /updateFairnessScoreOnAssignment\s*\([^)]*\)\s*\{[\s\S]*?\n\},\n/;
  const match = re.exec(code);
  if (!match) {
    console.warn('WARN: Could not locate updateFairnessScoreOnAssignment(...) block to insert after.');
    return code;
  }
  const idx = match.index + match[0].length;
  return code.slice(0, idx) + '\n' + insertText + '\n' + code.slice(idx);
}

const NEW_HELPERS = `
// =================================================================================
// NEW — DETERMINISTIC FAIRNESS SELECTOR (with multi-closer weekly penalty)
// =================================================================================

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

    // APM weekly closer encouragement
    if (meta.isClosing && staff.types.includes("APM")) {
      const hasCloser = this.checkApmCloserInSchedule(tempSchedule, staff.id);
      if (!hasCloser) score -= 10;
    }

    // NEW: Heavier penalty for 2nd (and subsequent) closers in the SAME week
    if (meta.isClosing) {
      const unit = this.data.advanced_rules?.fairness?.weights?.weeklySecondClose ?? 4; // default +4 each additional
      const already = this.countApmClosingShifts(tempSchedule, staff.id); // works for any staff
      if (already > 0) score += unit * already; // 2nd closer => +4, 3rd => +8, etc.
    }

    // Small tiebreaker: fewer assigned shifts this week
    score += 0.01 * this.getShiftCount(staff.id, tempSchedule);
    return { staff, score };
  });

  scored.sort((a, b) => a.score - b.score || a.staff.name.localeCompare(b.staff.name));
  const chosen = scored[0];

  this.assignShift(chosen.staff.id, day.fullDate, shiftTime, shiftType, tempSchedule);
  this.updateFairnessScoreOnAssignment(chosen.staff.id, day, shiftTime, shiftType);
  return chosen;
},

_buildEligiblePool({ shiftType, day, shiftTime, tempSchedule, roleFilter }) {
  let pool = this.data.staff.filter(staff =>
    staff.availability?.shifts?.includes(shiftType) &&
    (!roleFilter || roleFilter(staff)) &&
    this.isStaffEligibleForShift(staff, day, shiftTime, tempSchedule)
  );

  const meta = this._getShiftMeta(day, shiftTime, shiftType);
  if (meta.isOpening) {
    const apmOnly = pool.filter(s => s.types.includes("APM"));
    if (apmOnly.length > 0) pool = apmOnly;
  }
  return pool;
},

_computeBurdenScore(staffId, contexts, meta, assumeAssign = false) {
  const W = { CLOSE: 3, SATURDAY: 2, FRI_CLOSE: 5, SAT_CLOSE: 6, OPEN: 0 };
  let score = 0;

  const isTypeOnDay = (shift, dayName, kind) => {
    const hours = this.data.store_hours?.[dayName];
    if (!hours || typeof hours.open !== "number" || typeof hours.close !== "number") return false;
    const opener = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
    const closer = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;
    return kind === "open" ? (shift.time === opener) : kind === "close" ? (shift.time === closer) : false;
  };

  contexts.forEach(ctx => {
    const scheduleForStaff = ctx?.[staffId];
    if (!scheduleForStaff) return;
    for (const dateStr in scheduleForStaff) {
      const shift = scheduleForStaff[dateStr];
      if (!shift || shift.type === "OFF") continue;
      const d = new Date(`${dateStr}T00:00:00`);
      const dayIdx = d.getDay();
      const dayName = this.daysOfWeek[dayIdx];
      const isFri = dayIdx === 5;
      const isSat = dayIdx === 6;
      const closing = isTypeOnDay(shift, dayName, "close");
      const opening = isTypeOnDay(shift, dayName, "open");
      if (closing && isSat) { score += W.SAT_CLOSE; continue; }
      if (closing && isFri) { score += W.FRI_CLOSE; continue; }
      if (closing)        { score += W.CLOSE; }
      else if (isSat)     { score += W.SATURDAY; }
      else if (opening)   { score += W.OPEN; }
    }
  });

  if (assumeAssign) {
    if (meta.isClosing && meta.isSaturday)      score += W.SAT_CLOSE;
    else if (meta.isClosing && meta.isFriday)   score += W.FRI_CLOSE;
    else if (meta.isClosing)                    score += W.CLOSE;
    else if (meta.isSaturday)                   score += W.SATURDAY;
    else if (meta.isOpening)                    score += W.OPEN;
  }

  return score;
},

_getShiftMeta(day, shiftTime, shiftType) {
  const hours = this.data.store_hours?.[day.name] || {};
  const opener = (typeof hours.open === "number") ? `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}` : null;
  const closer = (typeof hours.close === "number") ? `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}` : null;
  const isOpening = opener ? (shiftTime === opener) : false;
  const isClosing = closer ? (shiftTime === closer) : false;
  const isFriday  = day.name === "Fri";
  const isSaturday= day.name === "Sat";
  return { isOpening, isClosing, isFriday, isSaturday, dayName: day.name, shiftType, shiftTime };
},

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

// Reuse same generator bodies as v1 patcher
const BODY_OFFER = `{
  console.log("Running generateOfferShifts");
  this.generationErrors.push(`Generating ${this.getShiftTypeName('Offer')} shifts...`);
  const offerRules = this.data.shift_rules["Offer"];
  if (!offerRules || !offerRules.daily_requirements) {
    this.generationErrors.push(`Error: '${this.getShiftTypeName('Offer')}' shift rules are not configured correctly.`);
    return;
  }
  for (const day of this.weekDates) {
    const requiredCount = offerRules.daily_requirements[day.name] ?? 0;
    if (requiredCount === 0) continue;
    let assignedCount = Object.values(tempSchedule).reduce((count, shifts) => (shifts[day.fullDate]?.type === "Offer" ? count + 1 : count), 0);
    while (assignedCount < requiredCount) {
      const shiftTime = this.data.advanced_rules.default_shift_hours["Offer"] ?? "10a-7p";
      const chosen = this.selectFairCandidateAndAssign({ shiftType: "Offer", day, shiftTime, tempSchedule, roleFilter: s => s.types.some(t => ["B","SB","APM"].includes(t)) });
      if (chosen) { assignedCount++; continue; }
      const hours = this.data.store_hours[day.name];
      if (!hours) break;
      const closerShiftTime = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;
      const closingEntry = Object.entries(tempSchedule).find(([id, shifts]) => {
        const st = this.data.staff.find(s => s.id == id);
        return shifts[day.fullDate]?.time === closerShiftTime && shifts[day.fullDate]?.type === "Lane" && st && (st.types.includes("B") || st.types.includes("SB"));
      });
      if (closingEntry) {
        const [id] = closingEntry; const st = this.data.staff.find(s => s.id == id);
        this.generationErrors.push(`Flipped closer ${st.name} on ${day.name} to an Offer shift.`);
        tempSchedule[id][day.fullDate].type = "Offer"; assignedCount++; continue;
      }
      const openerShiftTime = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
      const openingEntry = Object.entries(tempSchedule).find(([id, shifts]) => {
        const st = this.data.staff.find(s => s.id == id);
        return shifts[day.fullDate]?.time === openerShiftTime && shifts[day.fullDate]?.type === "Lane" && st && !st.types.includes("APM");
      });
      if (openingEntry) {
        const [id] = openingEntry; const st = this.data.staff.find(s => s.id == id);
        this.generationErrors.push(`Flipped opener ${st.name} on ${day.name} to an Offer shift.`);
        tempSchedule[id][day.fullDate].type = "Offer"; assignedCount++; continue;
      }
      this.generationErrors.push(`Warning: Could not find or flip a candidate for an Offer shift on ${day.name}.`);
      break;
    }
    const finalCount = Object.values(tempSchedule).reduce((count, shifts) => (shifts[day.fullDate]?.type === "Offer" ? count + 1 : count), 0);
    if (finalCount < requiredCount) this.generationErrors.push(`Warning for ${day.name}: Required ${requiredCount} Offer shifts, but only ${finalCount} could be assigned.`);
  }
`;

const BODY_LANEVCA = `{
  console.log("Running generateLaneVcaShifts");
  this.generationErrors.push("Generating Lane VCA shifts...");
  const laneVcaRules = this.data.shift_rules["Lane VCA"];
  if (!laneVcaRules || !laneVcaRules.daily_requirements) { this.generationErrors.push("Error: 'Lane VCA' shift rules are not configured."); return; }
  const eligibleDays = this.weekDates.filter(d => (laneVcaRules.daily_requirements[d.name] ?? 0) > 0)
    .sort((a,b) => (this.data.advanced_rules.day_priority.lane[a.name] ?? 99) - (this.data.advanced_rules.day_priority.lane[b.name] ?? 99));
  const isVcaOnly = s => s.types.length === 1 && s.types.includes("VCA");
  const isApmVca  = s => s.types.includes("APM") && s.types.includes("VCA");
  const isOtherVca= s => s.types.includes("VCA") && !isVcaOnly(s) && !isApmVca(s);
  const pools = [ {name:'VCA-Only', roleFilter:isVcaOnly}, {name:'APM-VCA',roleFilter:isApmVca}, {name:'Other VCA',roleFilter:isOtherVca} ];
  const otherTimes = Object.entries(this.data.advanced_rules.vca_shift_priority).filter(([,v])=>v>0).sort(([,a],[,b])=>a-b).map(([k])=>this.formatRequestTime(k));
  for (const day of eligibleDays) {
    const required = laneVcaRules.daily_requirements[day.name] ?? 0;
    let assigned = Object.values(tempSchedule).filter(s => s[day.fullDate]?.type === "Lane VCA").length;
    const times = [ `${this.formatTime(this.data.store_hours[day.name].close - 9)}-${this.formatTime(this.data.store_hours[day.name].close)}`, ...otherTimes ];
    let pass = 0;
    while (assigned < required && pass < 10) {
      let inPass = false;
      for (const t of times) {
        if (assigned >= required) break;
        for (const p of pools) {
          const chosen = this.selectFairCandidateAndAssign({ shiftType: "Lane VCA", day, shiftTime: t, tempSchedule, roleFilter: p.roleFilter });
          if (chosen) { assigned++; inPass = true; break; }
        }
        if (inPass) break;
      }
      pass++; if (!inPass) break;
    }
  }
`;

const BODY_LANE = `{
  console.log("Running generateLaneShifts");
  this.generationErrors.push("Generating Lane shifts based on fairness...");
  const laneRules = this.data.shift_rules["Lane"];
  if (!laneRules || laneRules.days.length === 0) { this.generationErrors.push("Error: 'Lane' shift rules are not configured."); return; }
  const sortedDays = this.weekDates.filter(d => laneRules.days.includes(d.name))
    .sort((a,b) => (this.data.advanced_rules.day_priority.lane[a.name] ?? 99) - (this.data.advanced_rules.day_priority.lane[b.name] ?? 99));
  const isVcaOnly = s => s.types.length === 1 && s.types.includes("VCA");

  // Closers
  for (const day of sortedDays) {
    const hours = this.data.store_hours[day.name]; if (!hours || !hours.close) continue;
    const closer = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;
    const closerAssigned = Object.entries(tempSchedule).some(([id, shifts]) => {
      if (shifts[day.fullDate]?.time === closer) { const st = this.data.staff.find(s => s.id == id); return st && !isVcaOnly(st); }
      return false;
    });
    if (closerAssigned) continue;
    const chosen = this.selectFairCandidateAndAssign({ shiftType: "Lane", day, shiftTime: closer, tempSchedule, roleFilter: s => (s.types.includes("APM")||s.types.includes("SB")||s.types.includes("B")) && !isVcaOnly(s) });
    if (!chosen) this.generationErrors.push(`Warning: Could not find an eligible closer for ${day.name}.`);
  }

  // APM openers on low-coverage days
  const apms = this.data.staff.filter(s => s.types.includes("APM"));
  const dayAvail = this.weekDates.reduce((acc,d)=>{ acc[d.name] = this.data.staff.filter(s=>s.availability?.hours?.[d.name]?.start || s.availability?.hours?.[d.name]?.end).length; return acc; }, {});
  for (const apm of apms) {
    let possible = this.weekDates.filter(d=>{ const h=this.data.store_hours[d.name]; if(!h||h.open==null) return false; const op=`${this.formatTime(h.open)}-${this.formatTime(h.open+9)}`; return laneRules.days.includes(d.name) && this.isStaffEligibleForShift(apm,d,op,tempSchedule); }).sort((a,b)=>dayAvail[a.name]-dayAvail[b.name]);
    while (this.getShiftCount(apm.id, tempSchedule) < 5 && possible.length>0) {
      const best = possible.shift(); const h=this.data.store_hours[best.name]; const op=`${this.formatTime(h.open)}-${this.formatTime(h.open+9)}`;
      const assigned = Object.values(tempSchedule).some(s=>s[best.fullDate]?.time===op);
      if (!assigned) this.selectFairCandidateAndAssign({ shiftType:"Lane", day:best, shiftTime:op, tempSchedule, roleFilter:s=>s.types.includes("APM") });
    }
  }

  // Remaining openers to B/SB
  for (const day of sortedDays) {
    const h=this.data.store_hours[day.name]; if(!h||!h.open) continue; const op=`${this.formatTime(h.open)}-${this.formatTime(h.open+9)}`;
    const assigned = Object.values(tempSchedule).some(s=>s[day.fullDate]?.time===op); if (assigned) continue;
    this.selectFairCandidateAndAssign({ shiftType:"Lane", day, shiftTime:op, tempSchedule, roleFilter:s=>(s.types.includes("B")||s.types.includes("SB")) && !isVcaOnly(s) });
  }
`;

let out = src;
out = insertAfterUpdateFairness(out, NEW_HELPERS);
out = replaceFunctionBody(out, 'generateOfferShifts', BODY_OFFER);
out = replaceFunctionBody(out, 'generateLaneVcaShifts', BODY_LANEVCA);
out = replaceFunctionBody(out, 'generateLaneShifts', BODY_LANE);

fs.writeFileSync(OUTPUT, out, 'utf8');
console.log('Patch v2 complete. Wrote:', OUTPUT);
console.log('Backup preserved as:', BACKUP);
