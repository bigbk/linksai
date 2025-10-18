function schedulerApp() {
    return {
        activeTab: 'schedule',
        isSolving: false,
        generationLog: [],
        isLlmModalOpen: false,
        weeksToGenerate: 1,
        saveStatus: '',
        weekDates: [],
        browseWeekDates: [],
        currentWeekKey: '',
        browseWeekKey: '',
        displayScores: {},
        schedule: {},
        newStaffName: '',
        newStaffTypes: [],
        timeoff: {
            staffId: '',
            startDate: '',
            endDate: '',
            requestType: 'Off'
        },
        daysOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        shiftTypes: ["Lane VCA", "BAAA", "BAAA Preview", "MNJ", "MPA", "Lane", "CBC", "Offer", "Training", "Remote"],
        staffTypes: ['PM', 'APM', 'SB', 'B', 'VCA', 'BA', 'BAAA', 'BAAA Preview', 'MNJ', 'MPA'],
        data: {
            staff: [],
            time_off: [],
            shift_rules: {},
            store_hours: {},
            advanced_rules: {},
            past_schedules: {},
            llm_constraints: { hard: [], soft: [], coverage: [] }
        },

        init() {
            console.log("Scheduler App Initializing...");
            this.loadDataFromLocalStorage();
            const today = new Date();
            this.currentWeekKey = this.getWeekKeyForDate(today.toISOString().split('T')[0]);
            this.browseWeekKey = this.currentWeekKey;
            this.calculateWeekDates('current');
            this.calculateWeekDates('browse');
            this.initializeDataStructures();
            this.calculateFairnessScores();
            console.log("Initialization complete.");
        },

        initializeDataStructures() {
            if (!this.data.store_hours) this.data.store_hours = {};
            this.daysOfWeek.forEach(day => {
                if (!this.data.store_hours[day]) {
                    if (day === "Sunday") {
                        this.data.store_hours[day] = { text: "6a-6a" };
                    } else {
                        this.data.store_hours[day] = { text: "8a-9p" };
                    }
                }
            });

            if (!this.data.shift_rules) this.data.shift_rules = {};
            this.shiftTypes.forEach(type => {
                if (!this.data.shift_rules[type]) {
                    this.data.shift_rules[type] = {
                        days: [...this.daysOfWeek],
                        daily_requirements: this.daysOfWeek.reduce((acc, day) => { acc[day] = 0; return acc; }, {})
                    };
                } else if (!this.data.shift_rules[type].daily_requirements) {
                    // Ensure daily_requirements object exists for older data structures
                    this.data.shift_rules[type].daily_requirements = this.daysOfWeek.reduce((acc, day) => { acc[day] = 0; return acc; }, {});
                }
            });

            // Validate and fix staff availability structure
            if (this.data.staff) {
                this.data.staff.forEach(staff => {
                    if (!staff.availability) staff.availability = { hours: {}, shifts: [] };
                    if (!staff.availability.hours) staff.availability.hours = {};
                    this.daysOfWeek.forEach(day => {
                        if (!staff.availability.hours[day]) {
                            staff.availability.hours[day] = { start: '', end: '' };
                        }
                    });
                });
            }

            if (!this.data.advanced_rules) {
                this.data.advanced_rules = {
                    cbc: { dailyMax: 4, dayPriority: ["Saturday", "Friday", "Monday"] },
                    apm: { saturdayClosingPenalty: 2, minClosingShifts: 1 },
                    day_priority: {
                        cbc: this.daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: 7 }), {}),
                        lane: this.daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: 7 }), {}),
                    },
                    default_shift_hours: {
                        "Offer": "10a-7p",
                        "Training": "9a-5p",
                        "BAAA": "7:45a-2p",
                        "BAAA Preview": "9a-5p",
                        "MNJ": "8a-2p",
                        "MPA": "7:15a-3p",
                    },
                    vca_shift_priority: {
                        "10-7": 1,
                        "11-8": 2,
                        "12-9": 3,
                        "9-6": 4,
                        "8-5": 5,
                    },
                    naming: {
                        roleNames: this.staffTypes.reduce((acc, type) => ({ ...acc, [type]: type }), {}),
                        shiftTypeNames: this.shiftTypes.reduce((acc, type) => ({ ...acc, [type]: type }), {}),
                    },
                    fairness: { weights: {} } // Ensure fairness object exists
                };
            }
            // Merge fairness weights to avoid overwriting
            const defaultFairnessWeights = { saturday: 2, fridayClose: 5, saturdayClose: 6, totalClose: 3, cbc: 2, secondCloser: 4 };
            if (!this.data.advanced_rules.fairness) this.data.advanced_rules.fairness = { weights: {} };
            this.data.advanced_rules.fairness.weights = { ...defaultFairnessWeights, ...this.data.advanced_rules.fairness.weights };

            if (!this.schedule) this.schedule = {};
            if (!this.data.past_schedules) this.data.past_schedules = {};
            if (!this.data.time_off) this.data.time_off = [];

            if (!this.data.llm_constraints || !this.data.llm_constraints.hard || !this.data.llm_constraints.soft || !this.data.llm_constraints.coverage) {
                this.data.llm_constraints = {
                    hard: [
                        "Each employee must be scheduled for exactly 5 shifts per week, unless they have approved time off.",
                        "An employee can only work one shift per day.",
                        "An employee must have the correct 'Eligible for Shift Type' to be assigned that shift.",
                        "An employee with the 'APM' role can have a maximum of 1 closing shift per week.",
                        "The shift 'BAAA' must be from 7:45a-2p.",
                        "The shift 'BAAA Preview' must be from 9a-5p.",
                        "The shift 'MNJ' must be from 8a-2p.",
                        "The shift 'MPA' must be from 7:15a-3p."
                    ],
                    soft: [
                        "Fairness: Distribute undesirable shifts (closings, Saturdays) as evenly as possible among eligible employees.",
                        "VCA Priority: 'Lane VCA' shifts should be preferentially assigned to employees whose ONLY role is 'VCA'."
                    ],
                    coverage: [
                        "For \"Offer\" shifts, try to provide the best coverage throughout the day based on employee availability.",
                        "When working a standard \"Lane\" shift, employees with roles 'B', 'SB', or 'APM' should have their shifts start exactly at the store's opening time for that day.",
                        "When working a \"Lane VCA\" shift, employees with the 'VCA' role should have their shifts start at 9:00 AM."

                    ]
                };
            }
        },

        loadDataFromLocalStorage() {
            const savedData = localStorage.getItem('schedulerData');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                // Merge loaded data with defaults to prevent errors if structure changed
                this.data = { ...this.data, ...parsedData };
                this.schedule = this.data.past_schedules[this.currentWeekKey] || {};
            }
        },

        saveDataToLocalStorage() {
            // Before saving, store the current week's schedule
            if (this.currentWeekKey) {
                if (!this.data.past_schedules) {
                    this.data.past_schedules = {};
                }
                this.data.past_schedules[this.currentWeekKey] = JSON.parse(JSON.stringify(this.schedule));
            }

            localStorage.setItem('schedulerData', JSON.stringify(this.data));
            this.saveStatus = 'Saved!';
            setTimeout(() => this.saveStatus = '', 2000);
        },
        
        addTimeOff() {
            if (!this.timeoff.staffId || !this.timeoff.startDate) {
                alert("Please select a staff member and start date.");
                return;
            }
            if (this.timeoff.requestType === 'Off' && !this.timeoff.endDate) {
                alert("Please select an end date for Day Off requests.");
                return;
            }

            const staff = this.data.staff.find(s => s.id === this.timeoff.staffId);
            if (!staff) return;

            const endDate = this.timeoff.requestType === 'Off' ? this.timeoff.endDate : this.timeoff.startDate;

            // Create the start and end ZonedDateTime for the solver
            const startDateTime = new Date(`${this.timeoff.startDate}T00:00:00.000Z`);
            const endDateTime = new Date(endDate);
            endDateTime.setUTCHours(23, 59, 59, 999);

            this.data.time_off.push({
                id: `timeoff-${Date.now()}`,
                staffId: staff.id,
                staffName: staff.name,
                startDate: this.timeoff.startDate,
                endDate: endDate,
                requestType: this.timeoff.requestType,
                // Add solver-compatible start/end times
                start: startDateTime.toISOString(),
                end: endDateTime.toISOString()
            });

            this.timeoff.staffId = '';
            this.timeoff.startDate = '';
            this.timeoff.endDate = '';
            this.timeoff.requestType = 'Off';
            this.saveDataToLocalStorage();
        },

        // --- Fairness Scoring Logic ---
        calculateFairnessScores() {
            const newScores = {};
            const contexts = this._getLastNWeeksContexts(4, this.schedule);

            this.data.staff.forEach(staff => {
                const burdenScore = this._computeBurdenScore(staff.id, contexts, null, this.schedule, false);
                const cbcScore = this._computeCbcScore(staff.id, contexts, null, false);
                newScores[staff.id] = { burdenScore, cbcScore };
            });

            this.displayScores = newScores;
        },

        _getLastNWeeksContexts(n, currentSchedule) {
            const contexts = [];
            const currentWeekKey = this.currentWeekKey;
            if (!currentWeekKey) return contexts;

            // Add past schedules
            for (let i = 1; i <= n; i++) {
                const d = new Date(`${currentWeekKey}T00:00:00Z`);
                d.setUTCDate(d.getUTCDate() - 7 * i);
                const key = this.getWeekKeyForDate(d.toISOString().split("T")[0]);
                if (this.data.past_schedules?.[key]) {
                    contexts.push(this.data.past_schedules[key]);
                }
            }
            // Add the current week's schedule
            contexts.push(currentSchedule);
            return contexts;
        },

        _getShiftMeta(day, shiftTime, shiftType) {
            const hours = this.data.store_hours?.[day.name] || {};
            this.updateStoreHours(day.name);
            const openHour = this.parseHour(hours.text?.split('-')[0]);
            const closeHour = this.parseHour(hours.text?.split('-')[1]);
            const opener = (typeof openHour === "number") ? `${this.formatTime(openHour)}-${this.formatTime(openHour + 9)}` : null;
            const closer = (typeof closeHour === "number") ? `${this.formatTime(closeHour - 9)}-${this.formatTime(closeHour)}` : null;
            
            return {
                isOpening: opener ? (shiftTime === opener) : false,
                isClosing: closer ? (shiftTime === closer) : false,
                isFriday: day.name === "Friday",
                isSaturday: day.name === "Saturday",
                dayName: day.name,
                shiftType,
                shiftTime
            };
        },

        _computeBurdenScore(staffId, contexts, meta, scheduleContext, assumeAssign = false) {
            const fw = this.data.advanced_rules.fairness?.weights || {};
            const W = {
                CLOSE: fw.totalClose ?? 3,
                SATURDAY: fw.saturday ?? 2,
                FRI_CLOSE: fw.fridayClose ?? 5,
                SAT_CLOSE: fw.saturdayClose ?? 6,
                OPEN: 0,
            };

            let score = 0;
            contexts.forEach(ctx => {
                const scheduleForStaff = ctx?.[staffId];
                if (!scheduleForStaff) return;
                for (const dateStr in scheduleForStaff) {
                    const shift = scheduleForStaff[dateStr];
                    if (!shift || shift.type === "OFF") continue;
                    const d = new Date(`${dateStr}T00:00:00Z`);
                    const dayName = this.daysOfWeek[d.getUTCDay()];
                    const shiftMeta = this._getShiftMeta({ name: dayName }, shift.time, shift.type);
                    if (shiftMeta.isClosing && shiftMeta.isSaturday) { score += W.SAT_CLOSE; }
                    else if (shiftMeta.isClosing && shiftMeta.isFriday) { score += W.FRI_CLOSE; }
                    else if (shiftMeta.isClosing) { score += W.CLOSE; }
                    else if (shiftMeta.isSaturday) { score += W.SATURDAY; }
                    else if (shiftMeta.isOpening) { score += W.OPEN; }
                }
            });
            return score;
        },

        _computeCbcScore(staffId, contexts, meta, assumeAssign = false) {
            const cbcPenalty = this.data.advanced_rules.fairness.weights.cbc ?? 2;
            let score = 0;

            contexts.forEach(ctx => {
                const scheduleForStaff = ctx?.[staffId];
                if (!scheduleForStaff) return;
                for (const dateStr in scheduleForStaff) {
                    if (scheduleForStaff[dateStr]?.type === "CBC") {
                        score += cbcPenalty;
                    }
                }
            });
            return score;
        },

        get sortedStaff() {
            if (!this.data.staff) return [];
            
            // Define the desired role order for sorting.
            const roleOrder = ['PM', 'APM', 'SB', 'B', 'VCA', 'BA', 'BAAA', 'BAAA Preview', 'MNJ', 'MPA'];

            // Helper function to get the highest role index for a staff member.
            const getRoleIndex = (staff) => {
                if (!staff.types || staff.types.length === 0) {
                    return roleOrder.length; // Put staff with no roles at the end.
                }
                // Find the minimum index from the roleOrder array for the roles the staff has.
                let highestRoleIndex = roleOrder.length;
                staff.types.forEach(role => {
                    const index = roleOrder.indexOf(role);
                    if (index !== -1 && index < highestRoleIndex) {
                        highestRoleIndex = index;
                    }
                });
                return highestRoleIndex;
            };

            return [...this.data.staff].sort((a, b) => {
                const aIndex = getRoleIndex(a);
                const bIndex = getRoleIndex(b);

                // If roles are different, sort by role index.
                if (aIndex !== bIndex) {
                    return aIndex - bIndex;
                }

                // If roles are the same, sort by name.
                return a.name.localeCompare(b.name);
            });
        },

        getWeekKeyForDate(date) {
            // Use UTC to prevent timezone-related off-by-one day errors.
            const parts = date.split('-').map(p => parseInt(p, 10));
            const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
            // This is a more reliable way to find the preceding Sunday.
            d.setUTCDate(d.getUTCDate() - d.getUTCDay());
            return d.toISOString().split('T')[0];
        },

        getWeekDisplay(type) {
            const weekKey = type === 'current' ? this.currentWeekKey : this.browseWeekKey;
            if (!weekKey) return '';
            const startDate = new Date(weekKey + 'T00:00:00Z');
            const endDate = new Date(startDate);
            endDate.setUTCDate(startDate.getUTCDate() + 6);
            const format = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
            return `${format(startDate)} - ${format(endDate)}`;
        },

        getWeekDatesFor(weekKey) {
            const startDate = new Date(weekKey + 'T00:00:00Z');
            const dates = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(startDate.getTime());
                d.setUTCDate(d.getUTCDate() + i);
                dates.push({
                    name: this.daysOfWeek[d.getUTCDay()],
                    date: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
                    fullDate: d.toISOString().split("T")[0]
                });
            }
            return dates;
        },

        calculateWeekDates(type) {
            const weekKey = type === 'current' ? this.currentWeekKey : this.browseWeekKey;
            if (type === 'current') {
                this.weekDates = this.getWeekDatesFor(weekKey);
            } else {
                this.browseWeekDates = this.getWeekDatesFor(weekKey);
            }
        },

        changeWeek(direction, type) {
            let weekKey = type === 'current' ? this.currentWeekKey : this.browseWeekKey;
            const date = new Date(weekKey + 'T00:00:00Z');
            date.setUTCDate(date.getUTCDate() + (direction * 7));
            const newWeekKey = date.toISOString().split('T')[0];

            if (type === 'current') {
                this.saveDataToLocalStorage(); // Save current week before changing
                this.currentWeekKey = this.getWeekKeyForDate(newWeekKey);
                this.schedule = this.data.past_schedules[this.currentWeekKey] || {};
            } else {
                this.browseWeekKey = this.getWeekKeyForDate(newWeekKey);
            }
            this.calculateWeekDates(type);
        },

        addStaff() {
            if (!this.newStaffName.trim()) {
                alert('Please enter a name for the staff member.');
                return;
            }
            this.data.staff.push({
                id: `staff-${Date.now()}`,
                name: this.newStaffName,
                types: this.newStaffTypes,
                availability: {
                    hours: this.daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: { start: '', end: '' } }), {}),
                    shifts: [...this.shiftTypes]
                }
            });
            this.newStaffName = '';
            this.newStaffTypes = [];
            this.saveDataToLocalStorage();
        },

        deleteStaff(staffId) {
            if (confirm('Are you sure you want to delete this staff member? This cannot be undone.')) {
                this.data.staff = this.data.staff.filter(s => s.id !== staffId);
                delete this.schedule[staffId];
                this.saveDataToLocalStorage();
            }
        },

        getRoleName(systemName) {
            return systemName; // Simple mapping for now
        },

        getShiftTypeName(systemName) {
            return systemName; // Simple mapping for now
        },

        formatShiftForDisplay(staffId, date, shiftObject = null) {
            const scheduleSource = shiftObject || this.schedule;
            if (!scheduleSource) return '';

            const shift = scheduleSource[staffId]?.[date];
            if (!shift) return ''; // No shift for this staff/date

            // If the shift object has a 'time' property, it's already in our desired UI format.
            if (shift.time) {
                 return `${shift.time} (${shift.type})`;
            }

            // Otherwise, it's a raw shift object from the solver, so we format it.
            const start = new Date(shift.start);
            const end = new Date(shift.end);
            const startTimeString = this.formatTime(start.getUTCHours());
            const endTimeString = this.formatTime(end.getUTCHours());

            return `${startTimeString}-${endTimeString} (${shift.type})`;
        },

        updateShiftFromInput(event, staffId, date) {
            const value = event.target.value.trim();
            if (!this.schedule[staffId]) this.schedule[staffId] = {};

            if (value === '' || value === '-') {
                delete this.schedule[staffId][date];
                this.calculateFairnessScores();
                return;
            }
        
            // Regex to capture time (e.g., 8-5, 8a-5p) and an optional type (e.g., lane)
            const inputRegex = /^((\d{1,2})[ap]?m?)-?((\d{1,2})[ap]?m?)\s*(\w*.*)?$/i;
            const match = value.match(inputRegex);
        
            if (match) {
                const startHourRaw = match[2];
                const endHourRaw = match[4];
                const typeRaw = (match[5] || '').trim();
        
                // Format the time correctly (e.g., 8-5 -> 8a-5p)
                const formattedTime = this.formatRequestTime(`${startHourRaw}-${endHourRaw}`);
                
                // Determine the shift type, defaulting to 'Lane'
                const shiftType = this.shiftTypes.find(st => st.toLowerCase() === typeRaw.toLowerCase()) || 'Lane';
        
                const newShift = this.createShiftObject(date, formattedTime, shiftType);
                this.schedule[staffId][date] = newShift;
        
                // Update the input visually to the full, correct format
                event.target.value = this.formatShiftForDisplay(staffId, date);
                this.calculateFairnessScores();
            } else {
                alert(`Invalid input. Use a format like "8-5" or "10a-7p Lane".`);
                event.target.value = this.formatShiftForDisplay(staffId, date); // Revert
            }
        },

        createShiftObject(date, time, type) {
            if (typeof time !== 'string' || !time.includes('-')) { return null; }
            const [startStr, endStr] = time.toLowerCase().split('-');
            const parseTime = (timeStr) => {
                if (typeof timeStr !== 'string' || !timeStr) return NaN;
                let hour = parseInt(timeStr);
                if (timeStr.includes('p') && hour < 12) hour += 12;
                if (timeStr.includes('a') && hour === 12) hour = 0; // Midnight case
                return hour;
            };
            const startHour = parseTime(startStr);
            let endHour = parseTime(endStr);
            if (endHour < startHour && endHour <= 12) endHour += 12;

            if (isNaN(startHour) || isNaN(endHour) || date == null) { return null; }
            const startDateTime = new Date(Date.UTC(new Date(date).getUTCFullYear(), new Date(date).getUTCMonth(), new Date(date).getUTCDate(), startHour));
            const endDateTime = new Date(Date.UTC(new Date(date).getUTCFullYear(), new Date(date).getUTCMonth(), new Date(date).getUTCDate(), endHour));

            return { id: `${date}-${type}-${time}-${Math.random()}`, start: startDateTime.toISOString(), end: endDateTime.toISOString(), type: type, employee: null, locked: false };
        },

        toggleShiftLock(staffId, date) {
            const shift = this.schedule[staffId]?.[date];
            if (shift) {
                shift.locked = !shift.locked;
            }
        },

        clearSchedule() {
            if (!confirm('This will clear all unlocked shifts for the current week. Are you sure?')) return;
            Object.keys(this.schedule).forEach(staffId => {
                Object.keys(this.schedule[staffId]).forEach(date => {
                    if (!this.schedule[staffId][date].locked) {
                        delete this.schedule[staffId][date];
                    }
                });
            });
            this.calculateFairnessScores();
        },

        getWeekKeysForGeneration() {
            const keys = [];
            let current = new Date(this.currentWeekKey + 'T00:00:00Z');
            for (let i = 0; i < this.weeksToGenerate; i++) {
                keys.push(this.getWeekKeyForDate(current.toISOString().split('T')[0]));
                current.setUTCDate(current.getUTCDate() + 7);
            }
            return keys;
        },

        // Manual generation and other placeholders
        generateManual(shiftType) { // Renamed from generateSchedule to match button click
            const numWeeks = this.weeksToGenerate || 1;
            this.generationLog = [`⚙️ Starting MANUAL generation for [${this.getShiftTypeName(shiftType)}] for ${numWeeks} week(s)...`]; // Use generationLog
            this.calculateFairnessScores();

            const allWeekDates = [];
            let tempSchedule = {};
            const startWeekKey = this.currentWeekKey;

            for (let i = 0; i < numWeeks; i++) {
                const d = new Date(startWeekKey + 'T00:00:00Z');
                d.setUTCDate(d.getUTCDate() + (i * 7));
                const weekKey = this.getWeekKeyForDate(d.toISOString().split('T')[0]);
                const weekDatesForGen = this.getWeekDatesFor(weekKey);
                allWeekDates.push(...weekDatesForGen);

                const existingWeekSchedule = this.data.past_schedules[weekKey] || {}; // Use past_schedules
                for (const staffId in existingWeekSchedule) {
                    if (!tempSchedule[staffId]) tempSchedule[staffId] = {};
                    Object.assign(tempSchedule[staffId], existingWeekSchedule[staffId]);
                }
            }

            // This is a temporary override for the generation logic to span multiple weeks
            const originalWeekDates = this.weekDates;
            this.weekDates = allWeekDates;

            // --- LOGIC ROUTER ---
            switch (shiftType) {
                case "Offer": this.generateOfferShifts(tempSchedule); break;
                case "CBC": this.generateCbcShifts(tempSchedule); break;
                case "Lane": 
                    this.generateLaneShifts(tempSchedule); 
                    break;
                case "Lane VCA": this.generateLaneVcaShifts(tempSchedule); break;
                case "Training": this.generateTrainingShifts(tempSchedule); break;
                default: this.generateByDayAndRole(shiftType, tempSchedule);
            }

            // --- Split tempSchedule back into weekly schedules ---
            for (let i = 0; i < numWeeks; i++) {
                const d = new Date(startWeekKey + 'T00:00:00Z');
                d.setUTCDate(d.getUTCDate() + (i * 7));
                const weekKey = this.getWeekKeyForDate(d.toISOString().split('T')[0]);
                this.data.past_schedules[weekKey] = this.data.past_schedules[weekKey] || {};
                for (const staffId in tempSchedule) {
                    for (const date in tempSchedule[staffId]) {
                        if (this.getWeekKeyForDate(date) === weekKey) {
                            if (!this.data.past_schedules[weekKey][staffId]) this.data.past_schedules[weekKey][staffId] = {};
                            this.data.past_schedules[weekKey][staffId][date] = tempSchedule[staffId][date];
                        }
                    }
                }
            }

            // Restore original week dates for the UI
            this.weekDates = originalWeekDates;
            
            // This would save the results of tempSchedule back to the main data object.
            this.schedule = { ...this.data.past_schedules[startWeekKey] };
            
            this.validateSchedule(tempSchedule);
            this.calculateFairnessScores(); // Recalculate scores to update the UI
            this.generationLog.push("✅ Manual generation step complete.");
        },

        generateByDayAndRole(shiftType, tempSchedule) {
            this.generationLog.push(`Generating ${this.getShiftTypeName(shiftType)} shifts...`);
            const shiftRule = this.data.shift_rules[shiftType];
            if (!shiftRule || !shiftRule.days || shiftRule.days.length === 0) return;

            const staffForRole = this.data.staff.filter(s => s.types.includes(shiftType));
            if (staffForRole.length === 0) return;

            staffForRole.forEach(staff => {
                const shiftTime = this.data.advanced_rules.default_shift_hours?.[shiftType] || "9a-5p";
                const availableDays = this.weekDates.filter(day =>
                    shiftRule.days.includes(day.name) &&
                    this.isStaffEligibleForShift(staff, day, shiftTime, tempSchedule)
                );

                if (availableDays.length > 0) {
                    const dayToAssign = availableDays[0];
                    this.assignShift(staff.id, dayToAssign.fullDate, shiftTime, shiftType, tempSchedule);
                    this.generationLog.push(`Assigned ${this.getShiftTypeName(shiftType)} shift to ${staff.name} on ${dayToAssign.name}.`);
                } else {
                    this.generationLog.push(`Warning: Could not find an available day for ${staff.name} for their ${this.getShiftTypeName(shiftType)} shift.`);
                }
            });
        },

        generateOfferShifts(tempSchedule) {
            this.generationLog.push(`Generating ${this.getShiftTypeName('Offer')} shifts...`);
            const offerRules = this.data.shift_rules["Offer"];
            if (!offerRules || !offerRules.daily_requirements) {
                this.generationLog.push(`Error: '${this.getShiftTypeName("Offer")}' shift rules are not configured correctly.`);
                return;
            }

            for (const day of this.weekDates) {
                const requiredCount = offerRules.daily_requirements[day.name] ?? 0;
                if (requiredCount === 0) continue;

                let assignedCount = Object.values(tempSchedule).reduce((count, staffShifts) => (staffShifts[day.fullDate]?.type === "Offer" ? count + 1 : count), 0);

                while (assignedCount < requiredCount) {
                    const chosen = this.selectFairCandidateAndAssign({
                        shiftType: "Offer",
                        day,
                        shiftTime: this.data.advanced_rules.default_shift_hours?.["Offer"] ?? "10a-7p",
                        tempSchedule,
                        roleFilter: (s) => s.availability.shifts.includes("Offer") && s.types.some(t => ["B", "SB", "APM"].includes(t))
                    });
                    if (chosen) {
                        assignedCount++;
                    } else {
                        this.generationLog.push(`Warning: No free staff for Offer on ${day.name}.`);
                        break;
                    }
                }
            }
        },

        generateCbcShifts(tempSchedule) { // This function is rewritten for better fairness and randomness.
            this.generationLog.push("Generating CBC shifts...");
            const cbcRules = this.data.shift_rules["CBC"];
            if (!cbcRules) {
                this.generationLog.push("Error: CBC shift rules are not defined.");
                return;
            }

            // --- Phase 1: Prioritize filling schedules for BA-only staff ---
            this.generationLog.push("CBC Phase 1: Prioritizing BA-only staff to reach 5 shifts.");
            const baOnlyStaff = this.data.staff.filter(s => s.types.length === 1 && s.types.includes("BA"));

            for (const staff of baOnlyStaff) {
                const numWeeks = this.weeksToGenerate || 1;
                const startWeekKey = this.weekDates[0].fullDate;

                for (let i = 0; i < numWeeks; i++) {
                    const d = new Date(startWeekKey + 'T00:00:00Z');
                    d.setUTCDate(d.getUTCDate() + (i * 7));
                    const weekKey = this.getWeekKeyForDate(d.toISOString().split('T')[0]);
                    const weekDatesForLoop = this.getWeekDatesFor(weekKey);
                    let shiftsInWeek = Object.keys(tempSchedule[staff.id] || {}).filter(date => this.getWeekKeyForDate(date) === weekKey).length;

                    while (shiftsInWeek < 5) {
                        const potentialAssignments = [];
                        for (const day of weekDatesForLoop) {
                            const shiftTime = day.name === "Saturday" ? "9a-6p" : "10a-7p";
                            if (cbcRules.days.includes(day.name) && this.isStaffEligibleForShift(staff, day, shiftTime, tempSchedule)) {
                                const meta = this._getShiftMeta(day, shiftTime, "CBC");
                                const score = this._computeBurdenScore(staff.id, this._getLastNWeeksContexts(4, tempSchedule), meta, tempSchedule, true, true);
                                potentialAssignments.push({ day, score, shiftTime });
                            }
                        }

                        if (potentialAssignments.length > 0) {
                            potentialAssignments.sort((a, b) => a.score - b.score);
                            const lowestScore = potentialAssignments[0].score;
                            const bestDays = potentialAssignments.filter(p => p.score === lowestScore);
                            const chosenAssignment = bestDays[Math.floor(Math.random() * bestDays.length)];

                            this.assignShift(staff.id, chosenAssignment.day.fullDate, chosenAssignment.shiftTime, "CBC", tempSchedule);
                            this.generationLog.push(`Assigned priority CBC to ${staff.name} on ${chosenAssignment.day.name}.`);
                            shiftsInWeek++;
                        } else {
                            break; // No more available days in this week for this staff member.
                        }
                    }
                }
            }

            // --- Phase 2: Fill remaining daily CBC requirements ---
            this.generationLog.push("CBC Phase 2: Filling remaining daily requirements.");
            const dayPriority = Array.isArray(this.data.advanced_rules.cbc.dayPriority) 
                ? this.data.advanced_rules.cbc.dayPriority 
                : (this.data.advanced_rules.cbc.dayPriority || '').split(',');
            const getPriority = (dayName) => dayPriority.indexOf(dayName.substring(0, 3)) === -1 ? 99 : dayPriority.indexOf(dayName.substring(0, 3));
            const sortedDays = [...this.weekDates].filter((d) => cbcRules.days.includes(d.name)).sort((a, b) => getPriority(a.name) - getPriority(b.name));

            for (const day of sortedDays) {
                const dailyMax = this.data.advanced_rules.cbc.dailyMax;
                let assignedCount = Object.values(tempSchedule).filter(s => s[day.fullDate]?.type === "CBC").length;
                while (assignedCount < dailyMax) {
                    const shiftTime = day.name === "Saturday" ? "9a-6p" : "10a-7p";
                    const chosen = this.selectFairCandidateAndAssign({
                        shiftType: "CBC",
                        day,
                        shiftTime,
                        tempSchedule,
                        roleFilter: (s) => s.availability.shifts.includes("CBC") && !(s.types.length === 1 && s.types.includes("VCA"))
                    });
                    if (!chosen) break;
                    assignedCount++;
                }
            }
        },

        generateLaneVcaShifts(tempSchedule) { // This function is rewritten to iterate shifts first, then days.
            this.generationLog.push("Generating Lane VCA shifts...");
            const vcaRules = this.data.shift_rules["Lane VCA"];
            if (!vcaRules || !vcaRules.daily_requirements) {
                this.generationLog.push("Error: Lane VCA shift rules are not configured.");
                return;
            }
            
            const dayPriority = Array.isArray(this.data.advanced_rules.cbc.dayPriority) 
                ? this.data.advanced_rules.cbc.dayPriority 
                : (this.data.advanced_rules.cbc.dayPriority || '').split(',');
            const getPriority = (dayName) => dayPriority.indexOf(dayName.substring(0, 3)) === -1 ? 99 : dayPriority.indexOf(dayName.substring(0, 3));
            const sortedDays = [...this.weekDates].sort((a, b) => getPriority(a.name) - getPriority(b.name));

            const staticShiftTimes = Object.entries(this.data.advanced_rules.vca_shift_priority || {})
                .filter(([, value]) => value > 0)
                .sort(([, a], [, b]) => a - b)
                .map(([key]) => this.formatRequestTime(key));

            // Iterate through each SHIFT type first, in order of its priority
            for (const shiftTime of staticShiftTimes) {
                // Then iterate through each DAY, in order of its priority
                for (const day of sortedDays) {
                    this.updateStoreHours(day.name);
                    const hours = this.data.store_hours[day.name];
                    if (!hours || typeof hours.open !== 'number' || typeof hours.close !== 'number' || hours.open >= hours.close) {
                        continue;
                    }

                    const requiredCount = vcaRules.daily_requirements[day.name] || 0;
                    let assignedCount = Object.values(tempSchedule).filter(s => s[day.fullDate]?.type === 'Lane VCA').length;

                    const vcaOnlyNeedShifts = () => this.data.staff
                        .filter(s => s.types.length === 1 && s.types.includes("VCA"))
                        .some(s => this.getTotalWorkDays(s.id, tempSchedule) < 5);

                    // If we are below the minimum OR a VCA-only person needs a shift, try to assign one.
                    if (assignedCount < requiredCount || vcaOnlyNeedShifts()) {
                        this.selectFairCandidateAndAssign({
                            shiftType: "Lane VCA",
                            day,
                            shiftTime: shiftTime,
                            tempSchedule,
                        });
                    }
                }
            }
        },

        generateTrainingShifts(tempSchedule) {
            this.generationLog.push("Generating Training shifts...");
            const staffNeedingTraining = this.data.staff.filter(s => s.availability.shifts.includes("Training"));
            const shiftTime = this.data.advanced_rules.default_shift_hours?.["Training"] || "9a-5p";

            staffNeedingTraining.forEach(staff => {
                while (Object.keys(tempSchedule[staff.id] || {}).length < 5) {
                    const availableDay = this.weekDates.find(day => this.isStaffEligibleForShift(staff, day, shiftTime, tempSchedule));
                    if (availableDay) {
                        this.assignShift(staff.id, availableDay.fullDate, shiftTime, "Training", tempSchedule);
                        this.generationLog.push(`Assigned Training shift to ${staff.name} on ${availableDay.name}.`);
                    } else {
                        break;
                    }
                }
            });
        },

        generateLaneShifts(tempSchedule) {
            this.generationLog.push("Generating Lane shifts...");
            const laneRules = this.data.shift_rules["Lane"];
            if (!laneRules) {
                this.generationLog.push("Error: Lane shift rules are not defined.");
                return;
            }

            for (const day of this.weekDates) {
                const hours = this.data.store_hours[day.name];
                this.updateStoreHours(day.name); // Ensure hours are calculated before use
                const openHour = this.parseHour(hours.text.split('-')[0]);
                const closeHour = this.parseHour(hours.text.split('-')[1]);

                if (!hours || !hours.text || hours.text.toLowerCase() === 'closed' || isNaN(openHour) || isNaN(closeHour) || openHour >= closeHour) {
                    continue; // Skip closed or invalid days
                }
                
                const openerShiftTime = `${this.formatTime(openHour)}-${this.formatTime(openHour + 9)}`;
                const closerShiftTime = `${this.formatTime(closeHour - 9)}-${this.formatTime(closeHour)}`;

                const openerAssigned = Object.values(tempSchedule).some(s => s[day.fullDate]?.time === openerShiftTime);
                if (!openerAssigned) {
                    this.selectFairCandidateAndAssign({ shiftType: "Lane", day, shiftTime: openerShiftTime, tempSchedule, roleFilter: (s) => s.availability.shifts.includes("Lane") });
                }

                const closerAssigned = Object.values(tempSchedule).some(s => s[day.fullDate]?.time === closerShiftTime);
                if (!closerAssigned) {
                    this.selectFairCandidateAndAssign({ shiftType: "Lane", day, shiftTime: closerShiftTime, tempSchedule, roleFilter: (s) => s.availability.shifts.includes("Lane") });
                }
            }
        },

        validateSchedule(schedule) {
            const warnings = new Set();
            this.weekDates.forEach(day => {
                const isLaneDay = this.data.shift_rules["Lane"]?.days.includes(day.name);
                if (!isLaneDay) return;
                const hours = this.data.store_hours[day.name];
                if (!hours || !hours.text || hours.text.toLowerCase() === 'closed') return;

                const closeHour = this.parseHour(hours.text.split('-')[1]);
                const closerShiftTime = `${this.formatTime(closeHour - 9)}-${this.formatTime(closeHour)}`;
                const hasAnyCloser = Object.values(schedule).some(s => s[day.fullDate]?.time === closerShiftTime);
                if (!hasAnyCloser) {
                    warnings.add(`Warning for ${day.name}: Day is missing a closer.`);
                }
            });

            this.data.staff.filter(s => s.types.includes("APM")).forEach(apm => {
                const closerCount = Object.values(schedule[apm.id] || {}).filter(shift => {
                    const d = new Date(Object.keys(schedule[apm.id]).find(key => schedule[apm.id][key] === shift) + "T00:00:00");
                    const dayName = this.daysOfWeek[d.getUTCDay()];
                    const hours = this.data.store_hours[dayName];
                    if (!hours || !hours.text || hours.text.toLowerCase() === 'closed') return false;
                    const closeHour = this.parseHour(hours.text.split('-')[1]);
                    const closerTime = `${this.formatTime(closeHour - 9)}-${this.formatTime(closeHour)}`;
                    return shift.time === closerTime;
                }).length;

                const required = this.data.advanced_rules.apm.minClosingShifts;
                if (closerCount < required) {
                    warnings.add(`Warning: APM ${apm.name} requires ${required} closing shift(s), but has ${closerCount}.`);
                }
            });

            if (warnings.size > 0) {
                this.generationLog.push("--- VALIDATION WARNINGS ---");
                warnings.forEach((w) => this.generationLog.push(w));
            } else {
                this.generationLog.push("Manual step complete. No immediate warnings found.");
            }
        },

        getShiftColorClass(shift) {
            if (!shift) return "";
            const offsiteTypes = ["BAAA", "BAAA Preview", "MNJ", "MPA", "Remote"];

            if (shift.type === "Offer") return "bg-green-200";
            if (shift.type === "CBC") return "bg-blue-200";
            if (shift.type === "Training") return "bg-red-200";
            if (offsiteTypes.includes(shift.type)) return "bg-gray-300";
            return "";
        },

        isScheduleIncomplete(staffId) {
            return (this.getTotalWorkDays(staffId, this.schedule) < 5);
        },

        getRollingTally(staffId) {
            const tally = { saturdays: 0, closes: 0, friCloses: 0, cbc: 0 };
            if (!this.weekDates || this.weekDates.length === 0) return tally;
            const currentWeekKey = this.currentWeekKey;

            for (let i = 0; i < 5; i++) {
                const d = new Date(currentWeekKey + 'T00:00:00Z');
                d.setUTCDate(d.getUTCDate() - (i * 7));
                const weekKey = this.getWeekKeyForDate(d.toISOString().split('T')[0]);

                const scheduleToTally = (weekKey === currentWeekKey) ? this.schedule : this.data.past_schedules[weekKey];

                if (scheduleToTally && scheduleToTally[staffId]) {
                    for (const dateStr in scheduleToTally[staffId]) {
                        const shift = scheduleToTally[staffId][dateStr];
                        if (shift.type === "OFF") continue;

                        const date = new Date(dateStr + "T00:00:00Z");
                        const dayOfWeek = date.getUTCDay();
                        const dayShortName = this.daysOfWeek[dayOfWeek];

                        if (dayOfWeek === 6) { tally.saturdays++; }
                        if (shift.type === "CBC") { tally.cbc++; }

                        const storeHours = this.data.store_hours[dayShortName];
                        const closeHour = this.parseHour(storeHours?.text?.split('-')[1]);
                        if (storeHours && typeof closeHour === "number") {
                            const closerShiftTime = `${this.formatTime(closeHour - 9)}-${this.formatTime(closeHour)}`;
                            if (shift.time === closerShiftTime) {
                                tally.closes++;
                                if (dayOfWeek === 5) { tally.friCloses++; }
                            }
                        }
                    }
                }
            }
            return tally;
        },

        getDailyTally(fullDate, dayName) {
            const tally = { open: 0, mid: 0, close: 0, cbc: 0, offsite: 0 };
            const scheduleForWeek = this.schedule;
            if (!scheduleForWeek) return tally;

            const hours = this.data.store_hours[dayName];
            const openHour = this.parseHour(hours?.text?.split('-')[0]);
            const closeHour = this.parseHour(hours?.text?.split('-')[1]);

            if (!hours || typeof openHour !== "number" || typeof closeHour !== "number") {
                return tally;
            }

            const openerShiftTime = `${this.formatTime(openHour)}-${this.formatTime(openHour + 9)}`;
            const closerShiftTime = `${this.formatTime(closeHour - 9)}-${this.formatTime(closeHour)}`;
            const offsiteTypes = ["BAAA", "BAAA Preview", "MNJ", "MPA", "Remote"];

            for (const staffId in scheduleForWeek) {
                const shift = scheduleForWeek[staffId][fullDate];
                if (shift && shift.type !== "OFF") {
                    if (offsiteTypes.includes(shift.type)) {
                        tally.offsite++;
                    } else if (shift.type === "CBC") {
                        tally.cbc++;
                    } else if (shift.time === openerShiftTime) {
                        tally.open++;
                    } else if (shift.time === closerShiftTime) {
                        tally.close++;
                    } else {
                        tally.mid++;
                    }
                }
            }
            return tally;
        },

        updateStoreHours(dayName) {
            const hours = this.data.store_hours[dayName];
            if (!hours || !hours.text) return;

            const text = hours.text.toLowerCase().trim();
            if (text === 'closed' || text === '') {
                hours.open = null;
                hours.close = null;
                return;
            }
            
            const match = text.match(/(\d{1,2})(am|pm|a|p)?\s*-\s*(\d{1,2})(am|pm|a|p)?/);
            if (match) {
                const parseHour = (hourStr, ampmStr) => {
                    let hour = parseInt(hourStr);
                    if ((ampmStr?.startsWith('p')) && hour !== 12) {
                        hour += 12;
                    }
                    if ((ampmStr?.startsWith('a')) && hour === 12) {
                        hour = 0; // Midnight case
                    }
                    return hour;
                };
                hours.open = parseHour(match[1], match[2]);
                hours.close = parseHour(match[3], match[4]);
            } else { // Fallback for simple formats like "9-9"
                 const simpleMatch = text.match(/(\d{1,2})\s*-\s*(\d{1,2})/);
                 if (simpleMatch) {
                    let open = parseInt(simpleMatch[1]);
                    let close = parseInt(simpleMatch[2]);
                    if(open < 7) open += 12;
                    if(close <= 7) close += 12;
                    // If open is greater than or equal to close, it's an overnight shift or a closed day.
                    // Add 12 to close time if it's a PM hour that wasn't caught.
                    if(open >= close && close < 12) close += 12;
                    hours.open = open;
                    hours.close = close;
                 }
            }
        },
        removeTimeOff(id) { this.data.time_off = this.data.time_off.filter(t => t.id !== id); this.saveDataToLocalStorage(); },
        
        importAndLockRequests(showMessage = true) {
            if (!this.data.time_off) return;
            
            // Clear existing non-manually-locked shifts that were from requests
            for (const weekKey in this.data.past_schedules) {
                for (const staffId in this.data.past_schedules[weekKey]) {
                    for (const date in this.data.past_schedules[weekKey][staffId]) {
                        const shift = this.data.past_schedules[weekKey][staffId][date];
                        const isRequestType = shift.type === 'OFF' || this.formatRequestTime(shift.type) !== shift.type;
                        if (shift.locked && isRequestType) {
                            delete this.data.past_schedules[weekKey][staffId][date];
                        }
                    }
                }
            }

            let importCount = 0;
            this.data.time_off.forEach((request) => {
                const startDate = new Date(request.startDate + "T00:00:00Z");
                const endDate = new Date(request.endDate + "T00:00:00Z");

                for (let d = startDate; d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
                    const dateStr = d.toISOString().split("T")[0];
                    const requestWeekKey = this.getWeekKeyForDate(dateStr);

                    if (!this.data.past_schedules[requestWeekKey]) this.data.past_schedules[requestWeekKey] = {};
                    if (!this.data.past_schedules[requestWeekKey][request.staffId]) this.data.past_schedules[requestWeekKey][request.staffId] = {};

                    const shiftType = request.requestType === "Off" ? "OFF" : request.requestType;
                    const shiftTime = request.requestType === "Off" ? "OFF" : this.formatRequestTime(request.requestType);
                    
                    this.data.past_schedules[requestWeekKey][request.staffId][dateStr] = { time: shiftTime, type: shiftType, locked: true };
                    importCount++;
                }
            });

            if (showMessage && importCount > 0) {
            }
            this.schedule = { ...(this.data.past_schedules[this.currentWeekKey] || {}) };
            this.calculateFairnessScores();
        },

        exportScheduleAs(format, tableContainerId) {
            const isBrowsePage = tableContainerId.includes("browse");
            const tableContainer = document.getElementById(tableContainerId);
            if (!tableContainer) {
                alert(`Could not find the element with ID '${tableContainerId}' to export.`);
                return;
            }

            const weekType = isBrowsePage ? "browse" : "current";
            const weekDisplay = this.getWeekDisplay(weekType);
            const filename = `Schedule_${weekDisplay.replace(/ /g, "").replace(/\//g, "-")}`;

            if (format === "jpg" || format === "pdf") {
                html2canvas(tableContainer, { scale: 2, backgroundColor: "#ffffff" }).then((canvas) => {
                    if (format === "jpg") {
                        const image = canvas.toDataURL("image/jpeg", 0.9);
                        const link = document.createElement("a");
                        link.href = image;
                        link.download = `${filename}.jpg`;
                        link.click();
                    } else if (format === "pdf") {
                        const { jsPDF } = window.jspdf;
                        const imgData = canvas.toDataURL("image/png");
                        const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
                        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
                        pdf.save(`${filename}.pdf`);
                    }
                });
            } else if (format === "csv") {
                this.exportTableToCSV(tableContainer.querySelector("table"), filename);
            }
        },

        exportTableToCSV(table, filename) {
            let csv = [];
            const rows = table.querySelectorAll("tr");

            for (const row of rows) {
                const rowData = [];
                const cols = row.querySelectorAll("td, th");

                for (const col of cols) {
                    const input = col.querySelector('input[type="text"]');
                    let data = input ? input.value : col.innerText.replace(/(\r\n|\n|\r)/gm, " ").replace(/(\s\s)/gm, " ");
                    data = data.replace(/"/g, '""');
                    if (data.includes(",") || data.includes('"') || data.includes("\n")) {
                        data = `"${data}"`;
                    }
                    rowData.push(data);
                }
                csv.push(rowData.join(","));
            }

            const csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(csvFile);
            link.download = `${filename}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        },

        getBrowseSchedule() { return this.data.past_schedules[this.browseWeekKey]; },

        importRequestsFromCSV(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const rows = text.split("\n").slice(1); // Skip header row
                let importedCount = 0;

                rows.forEach((row) => {
                    if (!row.trim()) return;
                    const [staffName, startDate, endDate, requestType] = row.split(",").map((s) => s.trim());
                    const staffMember = this.data.staff.find((s) => s.name.toLowerCase() === staffName.toLowerCase());

                    if (staffMember && startDate && requestType) {
                        this.data.time_off.push({
                            id: Date.now() + Math.random(),
                            staffId: staffMember.id,
                            staffName: staffMember.name,
                            startDate,
                            endDate: endDate || startDate,
                            requestType,
                        });
                        importedCount++;
                    }
                });
                alert(`Successfully imported ${importedCount} requests. Please Save Changes.`);
                event.target.value = ""; // Reset file input
            };
            reader.readAsText(file);
        },

        _exportPartialData(dataKey, filenamePrefix) {
            const dataToExport = { [dataKey]: this.data[dataKey] };
            const dataStr = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${filenamePrefix}_${new Date().toISOString().split("T")[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
        },

        exportStaffData() {
            this._exportPartialData('staff', 'scheduler_staff_data');
        },

        exportTimeOffData() {
            this._exportPartialData('time_off', 'scheduler_time_off_data');
        },

        exportAllRules() {
            const rulesData = {
                shift_rules: this.data.shift_rules,
                advanced_rules: this.data.advanced_rules,
                llm_constraints: this.data.llm_constraints
            };
            const dataStr = JSON.stringify(rulesData, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `scheduler_rules_backup_${new Date().toISOString().split("T")[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
        },

        importPartialData(event, keysToImport) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    let importedKeysCount = 0;
                    keysToImport.forEach(key => {
                        if (importedData.hasOwnProperty(key)) {
                            this.data[key] = importedData[key];
                            importedKeysCount++;
                        }
                    });
                    if (importedKeysCount > 0) {
                        this.saveDataAndReload(`Successfully imported ${keysToImport.join(', ')}.`);
                    } else {
                        alert(`The selected file does not contain the required data keys: ${keysToImport.join(', ')}.`);
                    }
                } catch (err) { alert(`Error reading or parsing file: ${err.message}`); }
            };
            reader.readAsText(file);
            event.target.value = ''; // Reset file input
        },

        exportAllData() {
            const dataStr = JSON.stringify(this.data, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `scheduler_backup_${new Date().toISOString().split("T")[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
        },

        saveDataAndReload(message) {
            this.saveDataToLocalStorage();
            alert(message + " The page will now reload to apply changes.");
            location.reload();
        },

        importAllData(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                if (confirm("This will overwrite all current data. Are you sure?")) {
                    this.data = { ...this.data, ...JSON.parse(e.target.result) };
                    this.saveDataAndReload("Data imported successfully!");
                }
            };
            reader.readAsText(file);
            event.target.value = ''; // Reset file input
        },

        // Helper functions from reference
        isStaffEligibleForShift(staff, day, proposedShiftTime, scheduleContext) {
            const weekKey = this.getWeekKeyForDate(day.fullDate);
            const existingShift = scheduleContext[staff.id]?.[day.fullDate];
            if (existingShift) return false;

            const shiftsThisWeek = Object.keys(scheduleContext[staff.id] || {}).filter(date => this.getWeekKeyForDate(date) === weekKey).length;
            if (shiftsThisWeek >= 5) return false;

            if (this.isStaffOnTimeOff(staff.id, day.fullDate)) return false;

            const { isAvailable } = this.getAdjustedShiftForAvailability(staff, day, proposedShiftTime);
            return isAvailable;
        },

        getTotalWorkDays(staffId, scheduleContext) {
            const scheduledShifts = scheduleContext[staffId] ? Object.keys(scheduleContext[staffId]) : [];
            const shiftCount = scheduledShifts.length;

            const timeOffDaysInWeek = this.weekDates.filter(day => {
                // Only count time off if the day is NOT already counted as a shift
                return !scheduledShifts.includes(day.fullDate) && this.isStaffOnTimeOff(staffId, day.fullDate);
            });

            return shiftCount + timeOffDaysInWeek.length;
        },


        isStaffOnTimeOff(staffId, fullDate) {
            return (this.data.time_off || []).some((req) => {
                if (String(req.staffId) !== String(staffId)) return false;
                const reqStart = new Date(req.startDate + "T00:00:00");
                const reqEnd = new Date(req.endDate + "T00:00:00");
                const checkDate = new Date(fullDate + "T00:00:00");
                return checkDate >= reqStart && checkDate <= reqEnd;
            });
        },

        getAdjustedShiftForAvailability(staff, day, proposedShiftTime) {
            const availability = staff.availability?.hours?.[day.name];
            if (!availability || !availability.start || !availability.end) {
                return { isAvailable: true, adjustedTime: proposedShiftTime };
            }
            const parseTime = (timeStr) => {
                if (!timeStr) return NaN;
                let hour = parseInt(timeStr.replace(/(a|p)m?/, ""));
                if (isNaN(hour)) return NaN;
                if (timeStr.includes("p") && hour !== 12) hour += 12;
                if (timeStr.includes("a") && hour === 12) hour = 0;
                return hour;
            };
            const availStart = parseTime(availability.start);
            const availEnd = parseTime(availability.end);
            const shiftParts = proposedShiftTime.split('-');
            if (shiftParts.length !== 2) return { isAvailable: false, adjustedTime: proposedShiftTime };
            let shiftStart = parseTime(shiftParts[0]);
            let shiftEnd = parseTime(shiftParts[1]);

            // If availStart or availEnd are NaN, it means the availability is open.
            // Only return false if the shift times themselves are invalid.
            if (isNaN(availStart) || isNaN(availEnd) || isNaN(shiftStart) || isNaN(shiftEnd)) {
                const isOpenAvailability = isNaN(availStart) && isNaN(availEnd);
                return { isAvailable: isOpenAvailability, adjustedTime: proposedShiftTime };
            }
            const newStart = Math.max(availStart, shiftStart);
            const newEnd = Math.min(availEnd, shiftEnd);
            if (newEnd > newStart) {
                return { isAvailable: true, adjustedTime: `${this.formatTime(newStart)}-${this.formatTime(newEnd)}` };
            }
            return { isAvailable: false, adjustedTime: proposedShiftTime };
        },

        assignShift(staffId, fullDate, time, type, scheduleContext) {
            const staff = this.data.staff.find(s => s.id == staffId);
            const day = this.weekDates.find(d => d.fullDate === fullDate);
            if (!staff || !day) return;
            const { adjustedTime } = this.getAdjustedShiftForAvailability(staff, day, time);
            if (!scheduleContext[staffId]) scheduleContext[staffId] = {};
            scheduleContext[staffId][fullDate] = { time: adjustedTime, type, locked: false };
        },

        parseHour(timeStr) {
            if (typeof timeStr !== 'string' || !timeStr) return NaN;
            let hour = parseInt(timeStr);
            if (timeStr.includes('p') && hour < 12) hour += 12;
            if (timeStr.includes('a') && hour === 12) hour = 0; // Midnight case
            return hour;
        },

        formatTime(hour) {
            hour = parseInt(hour, 10);
            if (isNaN(hour)) return "";
            if (hour === 0) return "12a";
            if (hour === 12) return "12p";
            if (hour < 12) return `${hour}a`;
            if (hour > 23) return `${hour - 12}p`;
            return `${hour - 12}p`;
        },

        formatRequestTime(requestType) {
            // Check if it's a simple time format like "10-7"
            const match = requestType.match(/^(\d{1,2})-(\d{1,2})$/);
            if (match) {
                let startHour = parseInt(match[1], 10);
                let endHour = parseInt(match[2], 10);

                // Handle shifts that cross noon (e.g., 10-7 means 10am to 7pm)
                if (endHour < startHour && endHour < 12) {
                    endHour += 12;
                }
                return `${this.formatTime(startHour)}-${this.formatTime(endHour)}`;
            }
            return requestType; // Return original if it's not a simple time format (e.g., "CBC", "Off")
        },

        importFromLlm() {
            const jsonString = this.$refs.llmOutput.value;
            if (!jsonString) {
                alert("Please paste the JSON output from the LLM.");
                return;
            }

            try {
                this.generationLog = ["🤖 Importing schedule from LLM output..."];
                const llmResponse = JSON.parse(jsonString);

                if (llmResponse.note) {
                    this.generationLog.push(`LLM Note: "${llmResponse.note}"`);
                }

                const llmSchedule = llmResponse.schedule;
                if (!llmSchedule) {
                    this.generationLog.push("❌ Error: The 'schedule' key was not found in the LLM response.");
                    alert("The LLM response is missing the 'schedule' key. Please check the format.");
                    return;
                }
                // Clear unlocked shifts for all weeks that were part of the generation request
                const weekKeysToImport = this.getWeekKeysForGeneration();
                weekKeysToImport.forEach(weekKey => {
                    if (this.data.past_schedules[weekKey]) {
                        Object.keys(this.data.past_schedules[weekKey]).forEach(staffId => {
                            Object.keys(this.data.past_schedules[weekKey][staffId]).forEach(date => {
                                if (!this.data.past_schedules[weekKey][staffId][date].locked) {
                                    delete this.data.past_schedules[weekKey][staffId][date];
                                }
                            });
                        });
                    }
                });

                for (const staffName in llmSchedule) {
                    const staffMember = this.data.staff.find(s => s.name.trim().toLowerCase() === staffName.trim().toLowerCase());
                    if (!staffMember) {
                        this.generationLog.push(`- ⚠️ Warning: Could not find staff member named "${staffName}".`);
                        continue;
                    }
                    for (const date in llmSchedule[staffName]) {
                        const weekKeyForDate = this.getWeekKeyForDate(date);
                        if (!this.data.past_schedules[weekKeyForDate]) this.data.past_schedules[weekKeyForDate] = {};
                        if (!this.data.past_schedules[weekKeyForDate][staffMember.id]) this.data.past_schedules[weekKeyForDate][staffMember.id] = {};

                        const shiftString = llmSchedule[staffName][date];
                        if (shiftString.toUpperCase() !== 'OFF') {
                            const match = shiftString.match(/([^()]+)\s+\(([^)]+)\)/);
                            if (match) {
                                this.data.past_schedules[weekKeyForDate][staffMember.id][date] = { time: match[1].trim(), type: match[2].trim(), locked: false };
                            }
                        }
                    }
                }
                this.generationLog.push("✅ Schedule imported successfully.");
                this.schedule = { ...this.data.past_schedules[this.currentWeekKey] }; // Refresh the UI for the current week
                this.validateSchedule(this.schedule); // Run validation
                this.calculateFairnessScores(); // Recalculate scores for the new schedule
                this.isLlmModalOpen = false;
            } catch (e) {
                alert(`Error parsing JSON: ${e.message}`);
                this.generationLog.push(`❌ Error parsing JSON: ${e.message}`);
            }
        },

        generateLlmPrompt() {
            // --- Helper to get previous 4 weeks of schedule data ---
            const getHistoricalSchedules = () => {
                let history = {};
                for (let i = 1; i <= 4; i++) {
                    const d = new Date(this.currentWeekKey + 'T00:00:00Z');
                    d.setUTCDate(d.getUTCDate() - (i * 7));
                    const weekKey = this.getWeekKeyForDate(d.toISOString().split('T')[0]);
                    const weekSchedule = this.data.past_schedules[weekKey];
                    if (weekSchedule) {
                        history[weekKey] = weekSchedule;
                    }
                }
                return history;
            };

            const historicalSchedules = getHistoricalSchedules();
            let historyPrompt = 'No historical data available for the last 4 weeks.';
            if (Object.keys(historicalSchedules).length > 0) {
                historyPrompt = 'Here is the schedule data for the previous 4 weeks for fairness context. The format is `TIME (TYPE)`:\n\n';
                Object.keys(historicalSchedules).forEach(weekKey => {
                    const weekData = historicalSchedules[weekKey];
                    historyPrompt += `**Week of ${weekKey}:**\n`;
                    Object.keys(weekData).forEach(staffId => {
                        const staffMember = this.data.staff.find(s => s.id === staffId);
                        if (staffMember) {
                            historyPrompt += `  *${staffMember.name}*:\n`;
                            Object.keys(weekData[staffId]).forEach(date => {
                                const shift = weekData[staffId][date];
                                historyPrompt += `    - ${date}: ${shift.time} (${shift.type})\n`;
                            });
                        }
                    });
                });
            }

            // --- Helper to get locked shifts for the current week ---
            let lockedShiftsPrompt = 'No shifts are currently locked for this week.';
            const lockedShifts = [];
            Object.keys(this.schedule).forEach(staffId => {
                Object.keys(this.schedule[staffId]).forEach(date => {
                    const shift = this.schedule[staffId][date];
                    if (shift && shift.locked) {
                        const staffMember = this.data.staff.find(s => s.id === staffId);
                        if (staffMember) {
                            lockedShifts.push(`- ${staffMember.name} is locked for ${date}: ${shift.time} (${shift.type})`);
                        }
                    }
                });
            });
            if (lockedShifts.length > 0) {
                lockedShiftsPrompt = 'The following shifts are already assigned and locked. They MUST be included in the final schedule exactly as specified:\n' + lockedShifts.join('\n');
            }




            const weekKeys = this.getWeekKeysForGeneration();
            const allWeekDates = weekKeys.flatMap(weekKey => this.getWeekDatesFor(weekKey));


            let prompt = `You are an expert store manager responsible for creating a fair and efficient weekly employee schedule.
    
Your task is to generate a complete schedule for the upcoming week based on the following information, constraints, and objectives.
    
**Output Format:**
Please provide the final schedule in a JSON format with two top-level keys: "schedule" and "note".
- The "schedule" key should contain an object where keys are employee names and values are their weekly schedules.
- The "note" key should contain a string summarizing if all constraints were met, and if not, which ones could not be fulfilled.
    
Example:
{
  "schedule": {
    "vca1": {
      "2025-10-27": "10a-7p (Lane VCA)",
      "2025-10-28": "11a-8p (Lane VCA)"
    },
    "apm": { "2025-10-27": "8a-5p (Lane)" }
  },
  "note": "All hard constraints and daily shift requirements have been met. It was not possible to give every employee 5 shifts due to time off requests."
}
    
---
    
### 1. Schedule Period
    
The schedule is for ${weekKeys.length} week(s), starting from the week of ${weekKeys[0]}.
The dates to schedule are:
${allWeekDates.map(d => `- ${d.name}: ${d.fullDate}`).join('\n')}
    
---
    
### 2. Store Hours
    
The store's operating hours for this week are:
${this.daysOfWeek.map(day => `- ${day}: ${this.data.store_hours[day].text}`).join('\n')}
A time of "6a-6a" means the store is closed.
    
---
    
### 3. Staff Roster & Availability
    
Here is the list of available employees, their roles, and their specific availability constraints.
    
`;
    
            this.data.staff.forEach(staff => {
                if (staff.types.length === 1 && staff.types[0] === 'PM') return; // Skip PMs as requested
    
                prompt += `**Employee: ${staff.name}**
- Roles: ${staff.types.join(', ')}
- Eligible for Shift Types: ${staff.availability.shifts.join(', ')}
- General Availability:
${this.daysOfWeek.map(day => {
    const hours = staff.availability.hours[day];
    return `  - ${day}: ${hours.start && hours.end ? `${hours.start} to ${hours.end}` : 'Fully Available'}`;
}).join('\n')}
`;
            });
    
            prompt += `\n---
    
### 4. Time Off Requests
    
The following time off requests MUST be honored. These employees cannot be scheduled on these days.
${this.data.time_off.length > 0 ? this.data.time_off.map(to => `- ${to.staffName} is OFF from ${to.startDate} to ${to.endDate}.`).join('\n') : 'No time off requests for this period.'}
    
---
    
### 6. Daily Required Shift Counts

The following number of shifts for specific types MUST be filled for each specified day.
${(() => {
    const requiredShiftTypes = ["Offer", "BAAA", "BAAA Preview", "MNJ", "MPA", "Lane VCA"];
    let requirementsText = "";
    requiredShiftTypes.forEach(shiftType => {
        const rules = this.data.shift_rules[shiftType];
        if (rules && rules.daily_requirements) {
            const dailyCounts = this.daysOfWeek.map(day => ({ day, count: rules.daily_requirements[day] || 0 })).filter(d => d.count > 0);
            if (dailyCounts.length > 0) {
                requirementsText += `\n**${this.getShiftTypeName(shiftType)}:**\n` + dailyCounts.map(d => `- ${d.day}: ${d.count} shift(s)`).join('\n');
            }
        }
    });
    return requirementsText || "\nNo specific daily shift counts are required for this week.\n";
})()}
---
    
### 5. Shift Requirements & Rules (Constraints)
    
**Hard Constraints (MUST be followed):**
${(() => {
    const dynamicHardConstraints = [];
    // Add CBC max shifts rule from Advanced Rules
    if (this.data.advanced_rules?.cbc?.dailyMax) {
        dynamicHardConstraints.push(`- The maximum number of 'CBC' shifts per day is ${this.data.advanced_rules.cbc.dailyMax}.`);
    }

    const shiftTypesWithDefaultHours = ["Offer", "Training", "BAAA", "BAAA Preview", "MNJ", "MPA"];
    if (this.data.advanced_rules.default_shift_hours) {
        shiftTypesWithDefaultHours.forEach(shiftType => {
            const hours = this.data.advanced_rules.default_shift_hours[shiftType];
            if (hours) {
                dynamicHardConstraints.push(`- The shift '${shiftType}' must be from ${hours}.`);
            }
        });
    }
    const allHardConstraints = dynamicHardConstraints.concat(this.data.llm_constraints.hard.map(c => `- ${c}`)).join('\n');
    return allHardConstraints || 'None';
})()}

**Soft Constraints (Objectives to optimize for, in order of importance):**
${this.data.llm_constraints.soft.map(c => `- ${c}`).join('\n') || 'None'}
    
**Shift Coverage Objectives:**
${this.data.llm_constraints.coverage.map(c => `- ${c}`).join('\n') || 'None'}

---

### 7. Pre-Assigned & Historical Data

**Locked Shifts for Current Week:**
${lockedShiftsPrompt}

**Historical Schedule (Last 4 Weeks for Fairness Context):**
${historyPrompt}

---
    
Please generate the complete and optimal schedule based on all the information above.
`;
    
            navigator.clipboard.writeText(prompt);
            alert("Prompt generated and copied to your clipboard!");
        }
    };
}
