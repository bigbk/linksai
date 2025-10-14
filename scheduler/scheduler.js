/** Generator for 'Lane VCA' shifts based on daily required counts and priority. */
generateLaneVcaShifts(tempSchedule) {
    console.log("Running generateLaneVcaShifts");
    this.generationErrors.push("Generating Lane VCA shifts...");
    const vcaRules = this.data.shift_rules["Lane VCA"];
    if (!vcaRules || !vcaRules.daily_requirements) {
        this.generationErrors.push("Error: Lane VCA shift rules are not configured.");
        return;
    }

    const shiftPriorities = this.data.advanced_rules.vca_shift_priority;
    const sortedShifts = Object.keys(shiftPriorities)
        .filter(key => shiftPriorities[key] > 0)
        .sort((a, b) => shiftPriorities[a] - shiftPriorities[b]);

    for (const day of this.weekDates) {
        // --- Phase 1: Fulfill daily requirements with role prioritization ---
        const hours = this.data.store_hours[day.name];
        // Skip this day entirely if the store is closed.
        if (!hours || typeof hours.open !== 'number' || typeof hours.close !== 'number' || hours.open >= hours.close) {
            continue;
        }

        const requiredCount = vcaRules.daily_requirements[day.name] || 0;
        let assignedCount = Object.values(tempSchedule).filter(s => s[day.fullDate]?.type === 'Lane VCA').length;

        const otherShiftTimes = Object.entries(this.data.advanced_rules.vca_shift_priority)
            .filter(([, value]) => value > 0)
            .sort(([, a], [, b]) => a - b)
            .map(([key]) => this.formatRequestTime(key));

        const shiftTimesToTry = [
            `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`, // Closer is highest priority
            ...otherShiftTimes
        ];

        let pass = 0; // Safety break
        while (assignedCount < requiredCount && pass < 10) {
            let assignedInPass = false;
            for (const shiftTime of shiftTimesToTry) {
                if (assignedCount >= requiredCount) break; // Stop if we've met the requirement
                const chosen = this.selectFairCandidateAndAssign({
                    shiftType: "Lane VCA",
                    day,
                    shiftTime,
                    tempSchedule,
                    // Role filtering is now handled inside _buildEligiblePool
                });

                if (chosen) {
                    assignedCount++;
                    assignedInPass = true;
                }
            }
            pass++;
            // If a full pass over all shift types yields no assignment, break to prevent infinite loop.
            if (!assignedInPass) {
                this.generationErrors.push(`Warning: Could not assign a VCA for ${day.name}. Required ${requiredCount}, assigned ${assignedCount}.`);
                break; // No more candidates for this day
            }
        }
    }

    // --- Phase 2: Backfill VCA-only staff to ensure they have 5 shifts ---
    console.log("Lane VCA Phase 2: Backfilling VCA-only staff schedules.");
    const isVcaOnly = (s) => s.types.length === 1 && s.types.includes("VCA");
    const vcaOnlyStaff = this.data.staff.filter(isVcaOnly);

    for (const staff of vcaOnlyStaff) {
        let totalWorkDays = this.getTotalWorkDays(staff.id, tempSchedule);

        while (totalWorkDays < 5) {
            let assignedShift = false;
            // Find an available day and shift time, respecting shift priority
            for (const day of this.weekDates) {
                const dayHours = this.data.store_hours[day.name];
                // Also check here to ensure we don't backfill on closed days.
                if (!dayHours || typeof dayHours.open !== 'number' || typeof dayHours.close !== 'number' || dayHours.open >= dayHours.close) {
                    continue;
                }

                const shiftTimesToTry = Object.keys(this.data.advanced_rules.vca_shift_priority)
                    .filter(key => this.data.advanced_rules.vca_shift_priority[key] > 0)
                    .sort((a, b) => this.data.advanced_rules.vca_shift_priority[a] - this.data.advanced_rules.vca_shift_priority[b]);

                for (const shiftTime of shiftTimesToTry) {
                    if (this.isStaffEligibleForShift(staff, day, shiftTime, tempSchedule)) {
                        this.assignShift(staff.id, day.fullDate, shiftTime, "Lane VCA", tempSchedule);
                        this.generationErrors.push(`Assigned backfill VCA shift to ${staff.name} on ${day.name}.`);
                        totalWorkDays++;
                        assignedShift = true;
                        break; // Exit shift time loop
                    }
                }
                if (assignedShift) break; // Exit day loop
            }

            // If no shift could be assigned in a full pass, break to avoid infinite loop
            if (!assignedShift) break;
        }
    }
},
