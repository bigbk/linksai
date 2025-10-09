document.addEventListener('alpine:init', () => {
    Alpine.data('schedulerApp', () => ({
        // --- State Management ---
        activeTab: 'schedule',
        currentDate: new Date(),
        browseDate: new Date(),
        weekDates: [],
        browseWeekDates: [],
        schedule: {},
        saveStatus: '',
        generationErrors: [],
        fairnessScores: {},
        editingStaffId: null,

        // --- Form Models ---
        newStaffName: '',
        newStaffTypes: [],
        timeoff: { staffId: "", startDate: '', endDate: '', requestType: 'Off' },

        // --- Constants & Definitions ---
        staffTypes: ['PM', 'APM', 'SB', 'B', 'VCA', 'BA', 'BAAA', 'BAAA Preview', 'MNJ', 'MPA'],
        shiftTypes: ["Offer", "CBC", "BAAA", "BAAA Preview", "MNJ", "MPA", "Remote", "Training", "Lane", "Lane VCA"],
        daysOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        
        // --- Core Data Object ---
        // This object holds all persistent data. It's loaded from and saved to localStorage.
        data: {},

        // =================================================================================
        // INITIALIZATION
        // =================================================================================
        init() {
            this.loadDataFromLocalStorage();
            this.importAndLockRequests(false); // Apply requests on initial load without showing a message
            this.calculateWeekDates('current');
            this.calculateWeekDates('browse');
            this.calculateFairnessScores();
            console.log("Scheduler App Initialized");
        },

        // =================================================================================
        // DATA PERSISTENCE
        // =================================================================================
        loadDataFromLocalStorage() {
            const savedData = localStorage.getItem('schedulerData');
            if (savedData) {
                this.data = JSON.parse(savedData);
                // MIGRATION LOGIC: Ensure older data models are compatible (e.g., single 'type' to array 'types')
                if (this.data.staff && this.data.staff.some(s => s.type)) {
                    this.data.staff.forEach(staff => {
                        if (staff.type && !staff.types) {
                            staff.types = [staff.type];
                            delete staff.type;
                        }
                    });
                }
            } else {
                this.setupDefaultData();
            }
            this.validateDataStructure();
        },

        saveDataToLocalStorage() {
            localStorage.setItem('schedulerData', JSON.stringify(this.data));
            console.log("Data saved to localStorage.");
            this.saveStatus = 'Changes saved successfully!';
            setTimeout(() => this.saveStatus = '', 2000);
        },
        
        setupDefaultData() {
            const defaultShiftRules = {};
            this.shiftTypes.forEach(shiftType => {
                const minMax = {};
                this.staffTypes.forEach(staffType => {
                    minMax[staffType] = { min: 0, max: 4 };
                });
                defaultShiftRules[shiftType] = { days: [], min_max: minMax };
            });
            
            const defaultStoreHours = {};
            this.daysOfWeek.forEach(day => {
                defaultStoreHours[day] = { open: 9, close: 21, text: "9a-9p" }; 
            });

            this.data = {
                staff: [
                    { id: 1, name: 'John Doe', types: ['SB'], availability: { days: [], shifts: [] } },
                    { id: 2, name: 'Jane Smith', types: ['APM', 'B'], availability: { days: [], shifts: [] } }
                ],
                shift_rules: defaultShiftRules,
                time_off: [],
                schedules: {},
                store_hours: defaultStoreHours
            };
        },
        
        // Ensures that the data object has all the necessary keys to prevent errors.
        validateDataStructure() {
            if (!this.data.store_hours) this.data.store_hours = {};
            this.daysOfWeek.forEach(day => {
                if (!this.data.store_hours[day] || !this.data.store_hours[day].text) {
                     this.data.store_hours[day] = { open: 9, close: 21, text: "9a-9p" };
                } else {
                    this.parseHours(day); // Re-parse on load to ensure open/close values are correct
                }
            });

            if (!this.data.shift_rules) this.data.shift_rules = {};
            this.shiftTypes.forEach(shiftType => {
                if (!this.data.shift_rules[shiftType]) {
                    this.data.shift_rules[shiftType] = { days: [], min_max: {} };
                }
                if (!this.data.shift_rules[shiftType].min_max) {
                    this.data.shift_rules[shiftType].min_max = {};
                }
                this.staffTypes.forEach(staffType => {
                    if (!this.data.shift_rules[shiftType].min_max[staffType]) {
                        this.data.shift_rules[shiftType].min_max[staffType] = { min: null, max: null };
                    }
                });
            });
            if(!this.data.time_off) this.data.time_off = [];
            if(!this.data.schedules) this.data.schedules = {};
        },

        // =================================================================================
        // STAFF MANAGEMENT
        // =================================================================================
        addStaff() {
            if (!this.newStaffName.trim()) { alert("Please enter a name."); return; }
            if (this.newStaffTypes.length === 0) { alert("Please select at least one role."); return; }
            
            const newId = this.data.staff.length > 0 ? Math.max(...this.data.staff.map(s => s.id)) + 1 : 1;
            this.data.staff.push({
                id: newId,
                name: this.newStaffName.trim(),
                types: [...this.newStaffTypes],
                availability: { days: [...this.daysOfWeek], shifts: [] } // Default to all days available
            });
            this.newStaffName = '';
            this.newStaffTypes = [];
        },
        
        deleteStaff(staffId) {
            // Using a custom modal/confirm is better than the browser's confirm
            if(confirm('Are you sure you want to delete this staff member?')) {
                this.data.staff = this.data.staff.filter(s => s.id !== staffId);
            }
        },

        get sortedStaff() {
            if (!this.data.staff) return [];
            // Added other roles to the hierarchy
            const roleOrder = { 'PM': 1, 'APM': 2, 'SB': 3, 'B': 4, 'VCA': 5, 'BA': 6, 'BAAA': 7, 'BAAA Preview': 8, 'MNJ': 9, 'MPA': 10 };
            
            return [...this.data.staff].sort((a, b) => {
                // Find the highest-ranking (lowest number) role for each person
                const roleA = Math.min(...a.types.map(t => roleOrder[t] || 99));
                const roleB = Math.min(...b.types.map(t => roleOrder[t] || 99));

                if (roleA !== roleB) {
                    return roleA - roleB;
                }
                return a.name.localeCompare(b.name); // Alphabetical for ties
            });
        },
        
        // =================================================================================
        // TIME OFF & REQUESTS MANAGEMENT
        // =================================================================================
        addTimeOff() {
            if (this.timeoff.requestType !== 'Off') {
                this.timeoff.endDate = this.timeoff.startDate;
            }

            if (!this.timeoff.staffId || !this.timeoff.startDate || !this.timeoff.endDate || !this.timeoff.requestType) {
                alert('Please fill out all fields for the request.');
                return;
            }

            this.data.time_off.push({
                id: Date.now(),
                staffId: parseInt(this.timeoff.staffId),
                staffName: this.data.staff.find(s => s.id == this.timeoff.staffId).name,
                startDate: this.timeoff.startDate,
                endDate: this.timeoff.endDate,
                requestType: this.timeoff.requestType
            });
            
            this.importAndLockRequests(true); // Re-apply all requests to update the schedule
            this.timeoff = { staffId: "", startDate: '', endDate: '', requestType: 'Off' };
        },

        removeTimeOff(id) {
            this.data.time_off = this.data.time_off.filter(t => t.id !== id);
            this.saveDataToLocalStorage(); 
            this.generationErrors.push("Request removed. Manually unlock shift or regenerate schedule to reflect change.");
        },

        // =================================================================================
        // DATE & WEEK NAVIGATION
        // =================================================================================
        calculateWeekDates(type) {
            let date = type === 'current' ? this.currentDate : this.browseDate;
            const dayOfWeek = date.getDay(); // Sunday = 0, Saturday = 6
            const startDate = new Date(date);
            startDate.setDate(startDate.getDate() - dayOfWeek);
            
            const dates = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                dates.push({
                    name: this.daysOfWeek[d.getDay()],
                    date: d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
                    fullDate: d.toISOString().split('T')[0] // YYYY-MM-DD format
                });
            }

            if (type === 'current') {
                this.weekDates = dates;
                const weekKey = this.weekDates[0].fullDate;
                if (!this.data.schedules[weekKey]) this.data.schedules[weekKey] = {};
                this.schedule = { ...this.data.schedules[weekKey] }; // Use spread to ensure reactivity
            } else {
                this.browseWeekDates = dates;
            }
        },

        changeWeek(direction, type) {
            let date = type === 'current' ? this.currentDate : this.browseDate;
            date.setDate(date.getDate() + (7 * direction));
            this.calculateWeekDates(type);
            if (type === 'current') this.calculateFairnessScores(); // Recalculate when week changes
        },

        getWeekDisplay(type) {
            let dates = type === 'current' ? this.weekDates : this.browseWeekDates;
            if (!dates || dates.length === 0) return 'Loading...';
            return `${dates[0].date} - ${dates[6].date}`;
        },
        
        getBrowseSchedule() {
            if (!this.browseWeekDates || this.browseWeekDates.length === 0) return null;
            const weekKey = this.browseWeekDates[0].fullDate;
            return this.data.schedules[weekKey] || null;
        },

        // =================================================================================
        // SCHEDULE INTERACTION & MANUAL OVERRIDES
        // =================================================================================
        toggleShiftLock(staffId, fullDate) {
            const weekKey = this.weekDates[0].fullDate;
            const dataShift = this.data.schedules[weekKey]?.[staffId]?.[fullDate];

            // We need to modify the object that the view is directly bound to.
            const viewShift = this.schedule?.[staffId]?.[fullDate];

            // Only allow locking if a shift exists in the current view.
            if (viewShift) {
                const newLockedState = !viewShift.locked; // Toggle the current state
                viewShift.locked = newLockedState; // Update the reactive view model

                // Also update the persistent data model to ensure it saves correctly.
                if (dataShift) dataShift.locked = newLockedState;
            }
        },

        clearSchedule() {
            if (!confirm("Are you sure you want to clear all unlocked shifts for this week?")) return;
            const weekKey = this.weekDates[0].fullDate;
            const currentSchedule = this.data.schedules[weekKey];
            if (!currentSchedule) return;

            for (const staffId in currentSchedule) {
                for (const date in currentSchedule[staffId]) {
                    const shift = currentSchedule[staffId][date];
                    if (!shift.locked) {
                        delete currentSchedule[staffId][date];
                    }
                }
            }
            this.schedule = { ...currentSchedule }; // Trigger reactivity
            this.generationErrors.push("Cleared all unlocked shifts.");
        },
        
        formatShiftForDisplay(staffId, fullDate) {
            const shift = this.schedule[staffId]?.[fullDate];
            if (!shift) return '';
            return `${shift.time} (${shift.type})`;
        },

        updateShiftFromInput(event, staffId, fullDate) {
            const inputValue = event.target.value.trim();
            const weekKey = this.weekDates[0].fullDate;

            if (!this.data.schedules[weekKey][staffId]) {
                this.data.schedules[weekKey][staffId] = {};
            }

            if (inputValue === '') {
                delete this.data.schedules[weekKey][staffId][fullDate];
            } else {
                const match = inputValue.match(/([^()]+)\s*\(([^)]+)\)/);
                if (match) {
                    this.data.schedules[weekKey][staffId][fullDate] = {
                        time: match[1].trim(),
                        type: match[2].trim().toUpperCase(),
                        locked: this.schedule[staffId]?.[fullDate]?.locked || false
                    };
                } else {
                    // Handle cases with no type, e.g., "8a-5p" or "OFF"
                    this.data.schedules[weekKey][staffId][fullDate] = {
                        time: inputValue,
                        type: inputValue.toUpperCase() === 'OFF' ? 'OFF' : 'Manual',
                        locked: this.schedule[staffId]?.[fullDate]?.locked || false
                    };
                }
            }
            this.schedule = { ...this.data.schedules[weekKey] }; // Force UI update
        },

        // =================================================================================
        // CORE SCHEDULING RULES & LOGIC
        // =================================================================================
        
        importAndLockRequests(showMessage = true) {
            if (!this.data.time_off) return;

            this.data.time_off.forEach(req => {
                let currentDate = new Date(req.startDate + 'T00:00:00');
                const endDate = new Date(req.endDate + 'T00:00:00');

                while(currentDate <= endDate) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const weekKey = this.getWeekKeyForDate(dateStr);

                    if (!this.data.schedules[weekKey]) this.data.schedules[weekKey] = {};
                    if (!this.data.schedules[weekKey][req.staffId]) this.data.schedules[weekKey][req.staffId] = {};
                    
                    let shiftObject = {};
                    if (req.requestType === 'Off') {
                        shiftObject = { time: 'OFF', type: 'OFF', locked: true };
                    } else if (req.requestType === 'CBC') {
                        const shiftTime = currentDate.getDay() === 6 ? '9a-6p' : '10a-7p';
                        shiftObject = { time: shiftTime, type: 'CBC', locked: true };
                    } else {
                        const shiftTime = this.formatRequestTime(req.requestType);
                        shiftObject = { time: shiftTime, type: 'Pre-Asn', locked: true };
                    }

                    this.data.schedules[weekKey][req.staffId][dateStr] = shiftObject;
                    
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            });
            if(showMessage) {
                this.generationErrors.push("Imported and locked all approved requests.");
            }
            this.calculateWeekDates('current'); // This will refresh the view with the newly locked shifts
        },
        
        // Main function to trigger schedule generation for a specific shift type.
        generateSchedule(shiftType) {
            this.generationErrors = []; // Always clear old logs on a new run
            this.calculateFairnessScores(); // Recalculate fresh scores at the start of any generation.
            const weekKey = this.weekDates[0].fullDate;
            let tempSchedule = JSON.parse(JSON.stringify(this.schedule));
            
            // --- LOGIC ROUTER ---
            switch (shiftType) {
                case 'BAAA': case 'BAAA Preview': case 'MNJ': case 'MPA':
                    this.generateByDayAndRole(shiftType, tempSchedule);
                    break;
                case 'CBC':
                    this.generateCbcShifts(tempSchedule);
                    break;
                case 'Lane VCA':
                    this.generateLaneVcaShifts(tempSchedule);
                    break;
                case 'Lane':
                    this.generateLaneShifts(tempSchedule);
                    break;
                default:
                    this.generationErrors.push(`Simulation: Generation logic for '${shiftType}' is not yet implemented.`);
            }

            // --- RUN VALIDATION ---
            this.validateSchedule(tempSchedule);

            this.data.schedules[weekKey] = tempSchedule;
            this.schedule = { ...this.data.schedules[weekKey] };
        },

        // --- Specific Shift Generation Functions ---

        generateByDayAndRole(shiftType, tempSchedule) {
            const shiftRule = this.data.shift_rules[shiftType];
            if (!shiftRule || !shiftRule.days || shiftRule.days.length === 0) {
                this.generationErrors.push(`Info: No days configured for ${shiftType} shifts in Shift Rules.`);
                return;
            }
        
            const role = shiftType;
            const staffRequirement = shiftRule.min_max[role]?.min || 0;
        
            if (staffRequirement === 0) {
                this.generationErrors.push(`Info: No minimum staff set for ${role} on ${shiftType} shifts.`);
                return;
            }
        
            shiftRule.days.forEach(dayName => {
                const day = this.weekDates.find(d => d.name === dayName);
                if (!day) return;
        
                let alreadyAssignedCount = Object.values(tempSchedule).reduce((count, staffShifts) => {
                    return staffShifts[day.fullDate]?.type === shiftType ? count + 1 : count;
                }, 0);
        
                const candidatePool = this.data.staff
                    .filter(staff => 
                        staff.types.includes(role) &&
                        this.isStaffEligibleForShift(staff, day, tempSchedule)
                    );
        
                // Sort by fairness: least total shifts, then fairness score for the role
                candidatePool.sort((a, b) => {
                    const shiftCountDiff = this.getShiftCount(a.id, tempSchedule) - this.getShiftCount(b.id, tempSchedule);
                    if (shiftCountDiff !== 0) return shiftCountDiff;
                    return (this.fairnessScores[a.id]?.[shiftType] || 0) - (this.fairnessScores[b.id]?.[shiftType] || 0);
                });

                for (const candidate of candidatePool) {
                    if (alreadyAssignedCount >= staffRequirement) break;
        
                    this.assignShift(candidate.id, day.fullDate, '7a-4p', shiftType, tempSchedule);
                    this.updateFairnessScoreOnAssignment(candidate.id, day, '7a-4p', shiftType);
                    this.generationErrors.push(`Assigned ${shiftType} to ${candidate.name} on ${day.name}.`);
                    alreadyAssignedCount++;
                }
            });
        },
        
        generateCbcShifts(tempSchedule) {
            this.generationErrors.push("Generating CBC shifts...");
            const cbcRules = this.data.shift_rules['CBC'];
            const dayPriority = { 'Sat': 0, 'Fri': 1, 'Mon': 2 };
            const sortedDays = [...this.weekDates]
                .filter(d => cbcRules.days.includes(d.name))
                .sort((a, b) => (dayPriority[a.name] ?? 99) - (dayPriority[b.name] ?? 99));
        
            let maxPasses = 50; // Increased slightly for more complex scenarios
            let assignmentsMadeInPass;
            let totalPasses = 0;
            do {
                assignmentsMadeInPass = false;
                totalPasses++;
                if (--maxPasses < 0) {
                    this.generationErrors.push("CBC generation timed out.");
                    break;
                }
        
                for (const day of sortedDays) {
                    const totalDailyMax = 4;
                    const dailyCBCCount = Object.values(tempSchedule).reduce((count, staffShifts) => {
                        return staffShifts[day.fullDate]?.type === 'CBC' ? count + 1 : count;
                    }, 0);
        
                    if (dailyCBCCount >= totalDailyMax) continue;
        
                    let candidate = null;
        
                    // --- STEP 1: Prioritize available BA staff ---
                    const eligible_BA = this.data.staff.filter(s => {
                        if (!s.types.includes('BA') || !s.availability.shifts.includes('CBC') || !this.isStaffEligibleForShift(s, day, tempSchedule)) {
                            return false;
                        }
                        if (day.name === 'Sat' && this.countSaturdaysInLastNWeeks(s.id, 4, tempSchedule) >= 3) {
                            return false;
                        }
                        return true;
                    });
                    // Sort by fairness: least total shifts, then least recent CBC shifts
                    eligible_BA.sort((a, b) => {
                        const shiftCountDiff = this.getShiftCount(a.id, tempSchedule) - this.getShiftCount(b.id, tempSchedule);
                        return shiftCountDiff !== 0 ? shiftCountDiff : (this.fairnessScores[a.id]?.cbc || 0) - (this.fairnessScores[b.id]?.cbc || 0);
                    });
                    candidate = eligible_BA[0];
        
                    // --- STEP 2: If no available BA, find available B/SB ---
                    if (!candidate) {
                        const eligible_B_SB = this.data.staff.filter(s =>
                            (s.types.includes('B') || s.types.includes('SB')) &&
                            s.availability.shifts.includes('CBC') &&
                            this.isStaffEligibleForShift(s, day, tempSchedule)
                        );
                        // Sort by fairness: least recent CBC shifts
                        eligible_B_SB.sort((a, b) => {
                            return (this.fairnessScores[a.id]?.cbc || 0) - (this.fairnessScores[b.id]?.cbc || 0);
                        });
                        candidate = eligible_B_SB[0];
                    }
        
                    // --- STEP 3: If still no one, override a BA's off day if necessary ---
                    if (!candidate) {
                        const override_BA = this.data.staff.filter(s => {
                            const isBasicallyEligible = s.types.includes('BA') &&
                                s.availability.shifts.includes('CBC') &&
                                this.getShiftCount(s.id, tempSchedule) < 5 &&
                                !tempSchedule[s.id]?.[day.fullDate] &&
                                !this.isStaffOnTimeOff(s.id, day.fullDate);
                            if (!isBasicallyEligible) return false;
                            if (day.name === 'Sat' && this.countSaturdaysInLastNWeeks(s.id, 4, tempSchedule) >= 3) return false;
                            return !s.availability.days.includes(day.name);
                        });
                        // Sort by fairness: least total shifts, then least recent CBC shifts
                        override_BA.sort((a, b) => {
                            const shiftCountDiff = this.getShiftCount(a.id, tempSchedule) - this.getShiftCount(b.id, tempSchedule);
                            return shiftCountDiff !== 0 ? shiftCountDiff : (this.fairnessScores[a.id]?.cbc || 0) - (this.fairnessScores[b.id]?.cbc || 0);
                        });
                        candidate = override_BA[0];
                        if (candidate) {
                            this.generationErrors.push(`INFO: ${candidate.name}'s off day on ${day.name} was used for CBC coverage.`);
                        }
                    }
        

const totalDailyMax = 4;
let dailyCBCCount = Object.values(tempSchedule).reduce((count, staffShifts) => {
    return staffShifts[day.fullDate]?.type === 'CBC' ? count + 1 : count;
}, 0);

while (dailyCBCCount < totalDailyMax) {
    let candidate = null;

    // STEP 1: Prioritize available BA staff
    const eligible_BA = this.data.staff.filter(s => {
        if (!s.types.includes('BA') ||
            !s.availability.shifts.includes('CBC') ||
            !this.isStaffEligibleForShift(s, day, tempSchedule)) {
            return false;
        }
        if (day.name === 'Sat' && this.countSaturdaysInLastNWeeks(s.id, 4, tempSchedule) >= 3) {
            return false;
        }
        return true;
    }).sort((a, b) => {
        const shiftCountDiff = this.getShiftCount(a.id, tempSchedule) - this.getShiftCount(b.id, tempSchedule);
        return shiftCountDiff !== 0 ? shiftCountDiff : (this.fairnessScores[a.id]?.cbc ?? 0) - (this.fairnessScores[b.id]?.cbc ?? 0);
    });

    candidate = eligible_BA[0];

    // STEP 2: Fallback to B/SB
    if (!candidate) {
        const eligible_B_SB = this.data.staff.filter(s =>
            (s.types.includes('B') || s.types.includes('SB')) &&
            s.availability.shifts.includes('CBC') &&
            this.isStaffEligibleForShift(s, day, tempSchedule)
        ).sort((a, b) => (this.fairnessScores[a.id]?.cbc ?? 0) - (this.fairnessScores[b.id]?.cbc ?? 0));

        candidate = eligible_B_SB[0];
    }

    // STEP 3: Override BA off day if necessary
    if (!candidate) {
        const override_BA = this.data.staff.filter(s => {
            const isBasicallyEligible = s.types.includes('BA') &&
                s.availability.shifts.includes('CBC') &&
                this.getShiftCount(s.id, tempSchedule) < 5 &&
                !tempSchedule[s.id]?.[day.fullDate] &&
                !this.isStaffOnTimeOff(s.id, day.fullDate);
            if (!isBasicallyEligible) return false;
            if (day.name === 'Sat' && this.countSaturdaysInLastNWeeks(s.id, 4, tempSchedule) >= 3) return false;
            return !s.availability.days.includes(day.name);
        }).sort((a, b) => {
            const shiftCountDiff = this.getShiftCount(a.id, tempSchedule) - this.getShiftCount(b.id, tempSchedule);
            return shiftCountDiff !== 0 ? shiftCountDiff : (this.fairnessScores[a.id]?.cbc ?? 0) - (this.fairnessScores[b.id]?.cbc ?? 0);
        });

        candidate = override_BA[0];
        if (candidate) {
            this.generationErrors.push(`INFO: ${candidate.name}'s off day on ${day.name} was used for CBC coverage.`);
        }
    }

    if (!candidate) break;

    const shiftTime = (day.name === 'Sat') ? '9a-6p' : '10a-7p';
    this.assignShift(candidate.id, day.fullDate, shiftTime, 'CBC', tempSchedule);
    this.updateFairnessScoreOnAssignment(candidate.id, day, shiftTime, 'CBC');
    assignmentsMadeInPass = true;
    dailyCBCCount++;
}

                }
                // If we've completed a full loop over every day and made no assignments,
                // it means we are stuck. Break the loop to prevent a timeout.
                if (totalPasses > sortedDays.length && !assignmentsMadeInPass) {
                    break;
                }
            } while (assignmentsMadeInPass || totalPasses <= sortedDays.length);
        },
        
        generateLaneVcaShifts(tempSchedule) {
            this.generationErrors.push("Generating Lane VCA shifts...");
            const laneVcaRules = this.data.shift_rules['Lane VCA'];
            if (!laneVcaRules || laneVcaRules.days.length === 0) {
                this.generationErrors.push("Error: 'Lane VCA' shift rules are not configured.");
                return;
            }
        
            const shiftPriority = ['10a-7p', '12p-9p', '9a-6p', '11a-8p'];
            const pureVcaStaff = this.data.staff.filter(s => s.types.length === 1 && s.types.includes('VCA'));
            if (pureVcaStaff.length === 0) return;

            let maxAssignments = pureVcaStaff.length * 5;
            let assignedCount = pureVcaStaff.reduce((acc, staff) => acc + this.getShiftCount(staff.id, tempSchedule), 0);
            let safetyBreak = 35; 

            while(assignedCount < maxAssignments && safetyBreak > 0) {
                let wasShiftAssignedInPass = false;
                safetyBreak--;

                for (const shiftTime of shiftPriority) {
                    for (const day of this.weekDates) {
                        if (!laneVcaRules.days.includes(day.name)) continue;

                        const isSlotTakenByVCA = pureVcaStaff.some(vca => tempSchedule[vca.id]?.[day.fullDate]?.time === shiftTime);
                        if (isSlotTakenByVCA) continue;

                        const candidates = pureVcaStaff
                            .filter(staff => {
                                if (!this.isStaffEligibleForShift(staff, day, tempSchedule)) {
                                    return false;
                                }

                                if (shiftTime === '12p-9p' && day.name !== 'Sat') {
                                    const saturdayDate = this.weekDates.find(d => d.name === 'Sat').fullDate;
                                    const hasSaturdayClosing = tempSchedule[staff.id]?.[saturdayDate]?.time === '12p-9p';
                                    if (hasSaturdayClosing) {
                                        return false;
                                    }
                                }
                                return true;
                            })
                            .sort((a, b) => {
                                const shiftCountDiff = this.getShiftCount(a.id, tempSchedule) - this.getShiftCount(b.id, tempSchedule);
                                if (shiftCountDiff !== 0) return shiftCountDiff;
                                return (this.fairnessScores[a.id]?.closing || 0) - (this.fairnessScores[b.id]?.closing || 0);
                            });
                        
                        if (candidates.length > 0) {
                            const candidate = candidates[0];
                            this.assignShift(candidate.id, day.fullDate, shiftTime, 'Lane VCA', tempSchedule);
                            this.updateFairnessScoreOnAssignment(candidate.id, day, shiftTime, 'Lane VCA');
                            assignedCount++;
                            wasShiftAssignedInPass = true;
                        }
                    }
                }
                if (!wasShiftAssignedInPass) break;
            }
        },

        generateLaneShifts(tempSchedule) {
            this.generationErrors.push("Generating Lane shifts (APM priority)...");
            const laneRules = this.data.shift_rules['Lane'];
            if (!laneRules || laneRules.days.length === 0) {
                this.generationErrors.push("Error: 'Lane' shift rules are not configured.");
                return;
            }
        
            const apmStaff = this.data.staff.filter(s => s.types.includes('APM'));
            const shuffledLaneDays = this.weekDates
                .filter(day => laneRules.days.includes(day.name))
                .sort(() => Math.random() - 0.5);

            // --- Phase 1: Assign the FIRST 12-9 shift to an APM ---
            let priorityApmCloserAssigned = false;
            for (const day of shuffledLaneDays) {
                if (priorityApmCloserAssigned) break;

                const hours = this.data.store_hours[day.name];
                if (!hours || !hours.close) continue;
                const closerShiftTime = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;

                if (closerShiftTime === '12p-9p') {
                    const apmPool = apmStaff
                        .filter(apm => this.isStaffEligibleForShift(apm, day, tempSchedule) && apm.availability.shifts.includes('Lane'))
                        .sort((a, b) => (this.fairnessScores[a.id]?.closing || 0) - (this.fairnessScores[b.id]?.closing || 0));
                    
                    if (apmPool.length > 0) {
                        this.assignShift(apmPool[0].id, day.fullDate, closerShiftTime, 'Lane', tempSchedule);
                        this.updateFairnessScoreOnAssignment(apmPool[0].id, day, closerShiftTime, 'Lane');
                        this.generationErrors.push(`Assigned priority 12-9 shift to APM ${apmPool[0].name} on ${day.name}.`);
                        priorityApmCloserAssigned = true;
                    }
                }
            }

            // --- Phase 2: Schedule remaining APM shifts ---
            apmStaff.forEach(apm => {
                // 1. Assign exactly one closing shift to each APM based on fairness.
                const hasPreassignedCloser = this.checkApmCloserInSchedule(tempSchedule, apm.id);
                if (!hasPreassignedCloser) {
                    const potentialDays = this.weekDates
                        .filter(day => this.isStaffEligibleForShift(apm, day, tempSchedule) && apm.availability.shifts.includes('Lane'))
                        .map(day => {
                            // Create a "cost" for each day. Lower is better.
                            let cost = this.fairnessScores[apm.id]?.byDay[day.name]?.closing || 0;
                            // Add a heavy penalty for Saturday closes based on 4-week history.
                            if (day.name === 'Sat') {
                                cost += (this.fairnessScores[apm.id]?.saturday || 0) * 2; // Add significant weight to recent Saturday work
                            }
                            return { day, cost };
                        })
                        .sort((a, b) => a.cost - b.cost); // Sort by lowest cost
        
                    if (potentialDays.length > 0) {
                        const bestDay = potentialDays[0].day;
                        const hours = this.data.store_hours[bestDay.name];
                        if (hours && hours.close) {
                            const closerShiftTime = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;
                            this.assignShift(apm.id, bestDay.fullDate, closerShiftTime, 'Lane', tempSchedule);
                            this.updateFairnessScoreOnAssignment(apm.id, bestDay, closerShiftTime, 'Lane');
                            this.generationErrors.push(`Assigned priority closing shift to APM ${apm.name} on ${bestDay.name}.`);
                        }
                    }
                }
        
                // 2. Fill remaining APM days with opening shifts.
                this.weekDates.forEach(day => {
                    if (this.getShiftCount(apm.id, tempSchedule) >= 5) return;
        
                    if (this.isStaffEligibleForShift(apm, day, tempSchedule) && apm.availability.shifts.includes('Lane')) {
                        const hours = this.data.store_hours[day.name];
                        if (hours && hours.open) {
                            const openerShiftTime = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
                            this.assignShift(apm.id, day.fullDate, openerShiftTime, 'Lane', tempSchedule);
                            this.updateFairnessScoreOnAssignment(apm.id, day, openerShiftTime, 'Lane');
                        }
                    }
                });
            });
        
            // --- Phase 3: General Lane Scheduling (for B, SB) ---
            const laneDays = this.weekDates.filter(day => laneRules.days.includes(day.name));
        
            // Assign remaining closers using weighted random selection.
            for (const day of laneDays) {
                const hours = this.data.store_hours[day.name];
                if (!hours || !hours.close) continue;
                const closerShiftTime = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;
        
                const closerAlreadyAssigned = Object.values(tempSchedule).some(s => s[day.fullDate]?.time === closerShiftTime);
                if (closerAlreadyAssigned) continue;

                // If this is a 12-9 shift and no APM has it, an APM must take it if possible.
                if (closerShiftTime === '12p-9p' && !Object.values(tempSchedule).some(s => s[day.fullDate]?.time === '12p-9p' && this.data.staff.find(staff => staff.id == Object.keys(s)[0])?.types.includes('APM'))) {
                    const apmPool = apmStaff.filter(apm => this.isStaffEligibleForShift(apm, day, tempSchedule));
                    if (apmPool.length > 0) {
                        const weightedPool = this.createWeightedPool(apmPool, 'closing');
                        const closer = this.selectRandomFromWeightedPool(weightedPool);
                        if (closer) {
                             this.assignShift(closer.id, day.fullDate, closerShiftTime, 'Lane', tempSchedule);
                             this.updateFairnessScoreOnAssignment(closer.id, day, closerShiftTime, 'Lane');
                             continue; // Skip to next day
                        }
                    }
                }

                const closerPool = this.data.staff.filter(staff =>
                    (staff.types.includes('SB') || staff.types.includes('B')) && // APMs are handled already
                    staff.availability.shifts.includes('Lane') &&
                    this.isStaffEligibleForShift(staff, day, tempSchedule)
                );
        
                if (closerPool.length > 0) {
                    const weightedPool = this.createWeightedPool(closerPool, 'closing');
                    const closer = this.selectRandomFromWeightedPool(weightedPool);
                    if (closer) {
                        this.assignShift(closer.id, day.fullDate, closerShiftTime, 'Lane', tempSchedule);
                        this.updateFairnessScoreOnAssignment(closer.id, day, closerShiftTime, 'Lane');
                    }
                }
            }
        
            // Assign remaining openers using weighted random selection.
            for (const day of laneDays) {
                const hours = this.data.store_hours[day.name];
                if (!hours || !hours.open) continue;
                const openerShiftTime = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
        
                const openerAlreadyAssigned = Object.values(tempSchedule).some(s => s[day.fullDate]?.time === openerShiftTime);
                if (openerAlreadyAssigned) continue;

                const openerPool = this.data.staff.filter(staff =>
                    (staff.types.includes('SB') || staff.types.includes('B')) && // APMs are handled already
                    staff.availability.shifts.includes('Lane') &&
                    this.isStaffEligibleForShift(staff, day, tempSchedule)
                );
        
                if (openerPool.length > 0) {
                    const weightedPool = this.createWeightedPool(openerPool, 'opening');
                    const opener = this.selectRandomFromWeightedPool(weightedPool);
                    if (opener) {
                        this.assignShift(opener.id, day.fullDate, openerShiftTime, 'Lane', tempSchedule);
                        this.updateFairnessScoreOnAssignment(opener.id, day, openerShiftTime, 'Lane');
                    }
                }
            }
        },

        // =================================================================================
        // VALIDATION & WARNINGS
        // =================================================================================
        validateSchedule(scheduleContext) {
            // Helper to get staff member from ID, with caching
            const staffCache = new Map();
            const getStaff = (id) => {
                if (staffCache.has(id)) return staffCache.get(id);
                const staff = this.data.staff.find(s => s.id == id);
                if (staff) staffCache.set(id, staff);
                return staff;
            };

            // Helper to check if a shift is a closing shift
            const isClosingShift = (shift, dayName) => {
                const hours = this.data.store_hours[dayName];
                if (!hours || !hours.close) return false;
                const closerShiftTime = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;
                return shift.time === closerShiftTime;
            };
            const warnings = new Set(); 

            // Checks 1, 2, 3: Opener, Closer, and CBC roles per day
            this.weekDates.forEach(day => {
                const laneShiftsOnDay = this.data.shift_rules['Lane']?.days.includes(day.name);
                if (!laneShiftsOnDay && !this.data.shift_rules['CBC']?.days.includes(day.name)) return;

                const hours = this.data.store_hours[day.name];
                if (!hours || !hours.open || !hours.close) return;

                const openerShiftTime = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
                const closerShiftTime = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;

                let hasB_SBOpener = false;
                let hasB_SBCloser = false;
                let cbc_B_SBCount = 0;

                for (const staffId in scheduleContext) {
                    const shift = scheduleContext[staffId][day.fullDate];
                    if (!shift) continue;

                    const staffMember = getStaff(staffId);
                    if (!staffMember) continue;

                    const isB_SB = staffMember.types.includes('B') || staffMember.types.includes('SB');
                    
                    if (shift.time === openerShiftTime && isB_SB) hasB_SBOpener = true;
                    if (shift.time === closerShiftTime && isB_SB) hasB_SBCloser = true;
                    if (shift.type === 'CBC' && isB_SB) cbc_B_SBCount++;
                }

                if (Object.values(scheduleContext).some(s => s[day.fullDate]?.time === openerShiftTime) && !hasB_SBOpener) {
                    warnings.add(`Warning for ${day.name}: No opener with B or SB role.`);
                }
                if (Object.values(scheduleContext).some(s => s[day.fullDate]?.time === closerShiftTime) && !hasB_SBCloser) {
                    warnings.add(`Warning for ${day.name}: No closer with B or SB role.`);
                }
                 if (Object.values(scheduleContext).some(s => s[day.fullDate]?.type === 'CBC') && cbc_B_SBCount < 2) {
                    warnings.add(`Warning for ${day.name}: Less than 2 B or SB staff on CBC.`);
                }
            });

            // Check 4: Mismatched counts for special roles
            const specialRoles = ['BAAA', 'BAAA Preview', 'MNJ', 'MPA'];
            specialRoles.forEach(role => {
                const staffCountForRole = this.data.staff.filter(s => s.types.includes(role)).length;
                const assignedShiftsForRole = Object.values(scheduleContext).flatMap(staffShifts => 
                    Object.values(staffShifts).filter(shift => shift.type === role)
                ).length;
            
                if (staffCountForRole > 0 && assignedShiftsForRole !== staffCountForRole) {
                    warnings.add(`Warning: Mismatch for ${role}. Expected ${staffCountForRole} shift(s), but found ${assignedShiftsForRole}.`);
                }
            });

            // Check 5: APM Closing Shift
            const apmsOnStaff = this.data.staff.filter(staff => staff.types.includes('APM'));
            apmsOnStaff.forEach(apm => { 
                if (!this.checkApmCloserInSchedule(scheduleContext, apm.id)) {
                    warnings.add(`Warning: APM ${apm.name} has not been assigned a closing shift.`);
                }
            });
            
            // Append warnings to the generation log
            if(warnings.size > 0) {
                 this.generationErrors.push('--- VALIDATION WARNINGS ---');
                 warnings.forEach(w => this.generationErrors.push(w));
            }
        },


        // =================================================================================
        // HELPER FUNCTIONS & ELIGIBILITY CHECKS
        // =================================================================================

        calculateFairnessScores() {
            const scores = {};
            const today = new Date(this.weekDates[0].fullDate);
        
            this.data.staff.forEach(staff => {
                const staffScore = { total: 0, closing: 0, opening: 0, cbc: 0, saturday: 0, byDay: {} };
                this.daysOfWeek.forEach(dayName => { staffScore.byDay[dayName] = { closing: 0, opening: 0, mid: 0 }; });
        
                // Look back 4 weeks from the start of the current schedule week
                for (let i = 0; i < 4; i++) {
                    const weekStartDate = new Date(today);
                    weekStartDate.setDate(weekStartDate.getDate() - (i * 7));
                    const weekKey = weekStartDate.toISOString().split('T')[0];
                    const scheduleToTally = this.data.schedules[weekKey];
        
                    if (scheduleToTally && scheduleToTally[staff.id]) {
                        for (const dateStr in scheduleToTally[staff.id]) {
                            const shift = scheduleToTally[staff.id][dateStr];
                            if (shift.type === 'OFF') continue;
        
                            const date = new Date(dateStr + 'T00:00:00');
                            const dayOfWeek = date.getDay();
                            const dayName = this.daysOfWeek[dayOfWeek];
                            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
                            const weight = isWeekend ? 1.5 : 1; // Weekends have higher weight
        
                            // Tally specific shift types
                            if (shift.type === 'CBC') staffScore.cbc += weight;
                            if (dayOfWeek === 6) { // Saturday
                                const storeHours = this.data.store_hours[dayName];
                                if (storeHours && storeHours.close) {
                                    const closerShiftTime = `${this.formatTime(storeHours.close - 9)}-${this.formatTime(storeHours.close)}`;
                                    if (shift.time === closerShiftTime) {
                                        staffScore.saturday += 1; // Use a simple, unweighted count for Saturday closes
                                    }
                                }
                            }
        
                            // Tally opening/closing
                            const storeHours = this.data.store_hours[dayName];
                            if (storeHours && storeHours.open && storeHours.close) {
                                const openerShiftTime = `${this.formatTime(storeHours.open)}-${this.formatTime(storeHours.open + 9)}`;
                                const closerShiftTime = `${this.formatTime(storeHours.close - 9)}-${this.formatTime(storeHours.close)}`;
        
                                if (shift.time === openerShiftTime) {
                                    staffScore.opening += weight;
                                    staffScore.byDay[dayName].opening += 1;
                                } else if (shift.time === closerShiftTime) {
                                    staffScore.closing += weight;
                                    staffScore.byDay[dayName].closing += 1;
                                } else {
                                    staffScore.byDay[dayName].mid += 1;
                                }
                            }
                            // Add weighted score to total
                            staffScore.total += weight;
                        }
                    }
                }
                scores[staff.id] = staffScore;
            });
        
            this.fairnessScores = scores;
            console.log("Fairness scores calculated:", this.fairnessScores);
        },

        updateFairnessScoreOnAssignment(staffId, day, time, type) {
            if (!this.fairnessScores[staffId]) return; // Safety check

            const staffScore = this.fairnessScores[staffId];
            const dayName = day.name;
            const isWeekend = (day.name === 'Sun' || day.name === 'Sat');
            const weight = isWeekend ? 1.5 : 1;

            staffScore.total += weight;
            if (type === 'CBC') staffScore.cbc += weight;

            const storeHours = this.data.store_hours[dayName];
            if (storeHours && storeHours.open && storeHours.close) {
                const openerShiftTime = `${this.formatTime(storeHours.open)}-${this.formatTime(storeHours.open + 9)}`;
                const closerShiftTime = `${this.formatTime(storeHours.close - 9)}-${this.formatTime(storeHours.close)}`;

                if (time === openerShiftTime) {
                    staffScore.opening += weight;
                } else if (time === closerShiftTime) {
                    staffScore.closing += weight;
                }
            }
            // No need to log here, it would be too noisy.
        },

        // Creates a weighted pool for random selection. Lower scores get more "chances".
        createWeightedPool(pool, scoreType) {
            if (pool.length === 0) return [];
            const maxScore = Math.max(...pool.map(p => this.fairnessScores[p.id]?.[scoreType] || 0)) + 1;
            const weightedPool = [];
            pool.forEach(p => {
                const score = this.fairnessScores[p.id]?.[scoreType] || 0;
                const weight = Math.ceil(maxScore - score); // Higher weight for lower scores
                for (let i = 0; i < weight; i++) {
                    weightedPool.push(p);
                }
            });
            return weightedPool;
        },

        // Selects a random item from a weighted pool.
        selectRandomFromWeightedPool(weightedPool) {
            if (weightedPool.length === 0) return null;
            const randomIndex = Math.floor(Math.random() * weightedPool.length);
            return weightedPool[randomIndex];
        },

        getShiftCellClass(staffId, fullDate) {
            const shift = this.schedule[staffId]?.[fullDate];
            if (!shift) return '';

            const offsiteTypes = ['BAAA', 'BAAA Preview', 'MNJ', 'MPA'];

            if (shift.type === 'Offer') return 'bg-green-100';
            if (shift.type === 'CBC') return 'bg-blue-100';
            if (shift.type === 'Training') return 'bg-red-100';
            if (offsiteTypes.includes(shift.type)) return 'bg-gray-200';

            return '';
        },

        // Centralized place to assign a shift to the temp schedule
        assignShift(staffId, fullDate, time, type, scheduleContext) {
            if (!scheduleContext[staffId]) scheduleContext[staffId] = {};
            scheduleContext[staffId][fullDate] = { time, type, locked: false };
        },
        
        // A generic check to see if a staff member can be assigned ANY shift on a given day.
        isStaffEligibleForShift(staff, day, scheduleContext) {
            const existingShift = scheduleContext[staff.id]?.[day.fullDate];
            
            return staff.availability.days.includes(day.name) &&
                   this.getShiftCount(staff.id, scheduleContext) < 5 && // GLOBAL RULE CHECK
                   (!existingShift || !existingShift.locked) && // The cell is either empty OR not locked
                   !this.isStaffOnTimeOff(staff.id, day.fullDate);
        },

        isStaffOnTimeOff(staffId, checkDateStr) {
            const checkDate = new Date(checkDateStr + 'T00:00:00'); // Normalize time
            for (const request of this.data.time_off) {
                // Only consider "Off" requests as true time off for generation purposes.
                // Specific shift requests are pre-assignments, not unavailability.
                if (request.staffId === staffId && request.requestType === 'Off') {
                    const startDate = new Date(request.startDate + 'T00:00:00');
                    const endDate = new Date(request.endDate + 'T00:00:00');
                    if (checkDate >= startDate && checkDate <= endDate) {
                        return true;
                    }
                }
            }
            return false;
        },

        parseHours(dayName) {
            const text = this.data.store_hours[dayName].text.toLowerCase().replace(/\s/g, '');
            const parts = text.split('-');
            if (parts.length !== 2) return;

            const parseTime = (timeStr) => {
                let hour = parseInt(timeStr.replace(/(a|p)m?/, ''));
                if (isNaN(hour)) return NaN;
                if (timeStr.includes('p') && hour !== 12) hour += 12;
                if (timeStr.includes('a') && hour === 12) hour = 0; // Midnight case
                return hour;
            };
            
            const openHour = parseTime(parts[0]);
            const closeHour = parseTime(parts[1]);

            if (!isNaN(openHour) && !isNaN(closeHour)) {
                this.data.store_hours[dayName].open = openHour;
                this.data.store_hours[dayName].close = closeHour;
            }
        },

        formatTime(hour) {
            hour = parseInt(hour);
            if (hour === 0) return '12a';
            if (hour === 12) return '12p';
            if (hour < 12) return `${hour}a`;
            return `${hour - 12}p`;
        },

        formatRequestTime(requestType) {
            const map = {
                "8-5": "8a-5p",
                "9-6": "9a-6p",
                "10-7": "10a-7p",
                "11-8": "11a-8p",
                "12-9": "12p-9p",
            };
            return map[requestType] || requestType;
        },
        
        getWeekKeyForDate(dateStr) {
            const date = new Date(dateStr + 'T00:00:00');
            const dayOfWeek = date.getDay();
            date.setDate(date.getDate() - dayOfWeek);
            return date.toISOString().split('T')[0];
        },
        
        // =================================================================================
        // TALLY & COUNTING FUNCTIONS
        // =================================================================================

        getShiftCount(staffId, scheduleContext = null) {
            const context = scheduleContext || this.schedule || {};
            if (!context[staffId]) return 0;
            // Filter out "OFF" shifts from the count for the 5-shift-max rule
            return Object.values(context[staffId]).filter(shift => shift.type !== 'OFF').length;
        },

        getRollingTally(staffId) {
            const tally = { saturdays: 0, closes: 0, friCloses: 0, cbc: 0 };
            const currentWeekKey = this.weekDates[0].fullDate;
        
            for (let i = 0; i < 5; i++) {
                const weekStartDate = new Date(currentWeekKey);
                weekStartDate.setDate(weekStartDate.getDate() - (i * 7));
                const weekKey = weekStartDate.toISOString().split('T')[0];
                
                const scheduleToTally = (weekKey === currentWeekKey) ? this.schedule : this.data.schedules[weekKey];
        
                if (scheduleToTally && scheduleToTally[staffId]) {
                    for (const dateStr in scheduleToTally[staffId]) {
                        const shift = scheduleToTally[staffId][dateStr];
                        if (shift.type === 'OFF') continue; // Do not count OFF shifts in tallies

                        const date = new Date(dateStr + 'T00:00:00');
                        const dayOfWeek = date.getDay();
                        const dayShortName = this.daysOfWeek[dayOfWeek];
                        
                        // Count Saturdays
                        if (dayOfWeek === 6) {
                            tally.saturdays++;
                        }
                        
                        // Count CBC Shifts
                        if (shift.type === 'CBC') {
                            tally.cbc++;
                        }
        
                        // Count Closing Shifts
                        const storeHours = this.data.store_hours[dayShortName];
                        if (storeHours && typeof storeHours.close === 'number') {
                            const closerShiftTime = `${this.formatTime(storeHours.close - 9)}-${this.formatTime(storeHours.close)}`;
                            if (shift.time === closerShiftTime) {
                                tally.closes++;
                                // Count Friday Closes specifically
                                if (dayOfWeek === 5) {
                                    tally.friCloses++;
                                }
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
            // If no hours are set, we can't determine shift types, so return empty tally.
            if (!hours || typeof hours.open !== 'number' || typeof hours.close !== 'number') return tally;
        
            const openTime = parseInt(hours.open);
            const closeTime = parseInt(hours.close);
            const openerShiftTime = `${this.formatTime(openTime)}-${this.formatTime(openTime + 9)}`;
            const closerShiftTime = `${this.formatTime(closeTime - 9)}-${this.formatTime(closeTime)}`;
            const offsiteTypes = ['BAAA', 'BAAA Preview', 'MNJ', 'MPA'];
        
            for (const staffId in scheduleForWeek) {
                const shift = scheduleForWeek[staffId][fullDate];
                if (shift && shift.type !== 'OFF') {
                    if (offsiteTypes.includes(shift.type)) {
                        tally.offsite++;
                    } else if (shift.type === 'CBC') {
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

        checkApmCloserInSchedule(scheduleContext, staffId = null){
            const staffList = staffId ? [this.data.staff.find(s => s.id === staffId)] : this.data.staff.filter(s => s.types.includes('APM'));
            
            return staffList.some(staff => {
                if (!staff || !staff.types.includes('APM')) return false;

                const staffSchedule = scheduleContext[staff.id];
                if (!staffSchedule) return false;
                
                return Object.keys(staffSchedule).some(date => {
                    const shift = staffSchedule[date];
                    const dayName = this.daysOfWeek[new Date(date+'T00:00:00').getDay()];
                    if (!this.data.store_hours[dayName] || !this.data.store_hours[dayName].close) return false;
                    const closerShiftTime = `${this.formatTime(this.data.store_hours[dayName].close - 9)}-${this.formatTime(this.data.store_hours[dayName].close)}`;
                    return shift.time === closerShiftTime;
                });
            });
        },

        countRecentCloses(staffId, scheduleContext = null) {
            return this.countRecentGenericShifts(staffId, 'closer', scheduleContext);
        },

        countSaturdaysInLastNWeeks(staffId, N, scheduleContext) {
            let count = 0;
            const currentWeekKey = this.weekDates[0].fullDate;
        
            // Count in previous N-1 weeks from saved data
            for (let i = 1; i < N; i++) {
                const weekStartDate = new Date(currentWeekKey);
                weekStartDate.setDate(weekStartDate.getDate() - (i * 7));
                const weekKey = weekStartDate.toISOString().split('T')[0];
        
                if (this.data.schedules[weekKey] && this.data.schedules[weekKey][staffId]) {
                    for (const dateStr in this.data.schedules[weekKey][staffId]) {
                        if(this.data.schedules[weekKey][staffId][dateStr].type === 'OFF') continue;
                        const dayNum = new Date(dateStr + 'T00:00:00').getDay();
                        if (dayNum === 6) count++; // 6 is Saturday
                    }
                }
            }
        
            // Count in the current week's temporary schedule
            const context = scheduleContext || this.schedule;
            if (context && context[staffId]) {
                for (const dateStr in context[staffId]) {
                    if(context[staffId][dateStr].type === 'OFF') continue;
                    const dayNum = new Date(dateStr + 'T00:00:00').getDay();
                    if (dayNum === 6) count++;
                }
            }
            return count;
        },
        
        // A generic function to count specific types of shifts over the last 4 weeks + the current week's temp schedule.
        countRecentGenericShifts(staffId, countType, scheduleContext = null) {
            let count = 0;
            const currentWeekKey = this.weekDates[0].fullDate;
            
            // Count in previous 4 weeks from saved data
            for (let i = 1; i < 5; i++) {
                const weekStartDate = new Date(currentWeekKey);
                weekStartDate.setDate(weekStartDate.getDate() - (i * 7));
                const weekKey = weekStartDate.toISOString().split('T')[0];

                if (this.data.schedules[weekKey] && this.data.schedules[weekKey][staffId]) {
                    count += this.countShiftsInContext(this.data.schedules[weekKey][staffId], countType);
                }
            }

            // Count in the current week's temporary schedule
            const context = scheduleContext || this.schedule;
             if (context && context[staffId]) {
                count += this.countShiftsInContext(context[staffId], countType);
            }
            return count;
        },
        
        // Helper for countRecentGenericShifts to avoid code duplication
        countShiftsInContext(staffSchedule, countType) {
            let count = 0;
            for (const dateStr in staffSchedule) {
                const shift = staffSchedule[dateStr];
                if (shift.type === 'OFF') continue;

                const dayNum = new Date(dateStr + 'T00:00:00').getDay();
                const dayName = this.daysOfWeek[dayNum];
                
                if (countType === 'saturday' && dayNum === 6) { count++; continue; }
                if (countType === 'CBC' && shift.type === 'CBC') { count++; continue; }
                if (countType === 'closer' && this.data.store_hours[dayName]) {
                    const closerShiftTime = `${this.formatTime(this.data.store_hours[dayName].close - 9)}-${this.formatTime(this.data.store_hours[dayName].close)}`;
                    if (shift.time === closerShiftTime) count++;
                }
            }
            return count;
        },

        // =================================================================================
        // IMPORT / EXPORT FUNCTIONS
        // =================================================================================
        exportScheduleAs(format, tableContainerId) {
            const tableContainer = document.getElementById(tableContainerId);

            if (!tableContainer) {
                alert(`Could not find the element with ID '${tableContainerId}' to export.`);
                return;
            }

            // Determine which week display to use based on the container ID
            const weekType = tableContainerId.includes('browse') ? 'browse' : 'current';
            const weekDisplay = this.getWeekDisplay(weekType);
            const filename = `Schedule_${weekDisplay.replace(/ /g, '').replace(/\//g, '-')}`;

            // Use html2canvas for image-based exports (JPG, PDF)
            if (format === 'jpg' || format === 'pdf') {
                // No timeout needed now that the button is on the same view as the table.
                html2canvas(tableContainer, { scale: 2, backgroundColor: '#ffffff' }).then(canvas => {
                    if (format === 'jpg') {
                        const image = canvas.toDataURL('image/jpeg', 0.9);
                        const link = document.createElement('a');
                        link.href = image;
                        link.download = `${filename}.jpg`;
                        link.click();
                    } else if (format === 'pdf') {
                        const { jsPDF } = window.jspdf;
                        const imgData = canvas.toDataURL('image/png');
                        const pdf = new jsPDF({
                            orientation: 'landscape',
                            unit: 'px',
                            format: [canvas.width, canvas.height]
                        });
                        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                        pdf.save(`${filename}.pdf`);
                    }
                });
            } else if (format === 'csv') {
                this.exportTableToCSV(tableContainer.querySelector('table'), filename);
            }
        },

        exportTableToCSV(table, filename) {
            let csv = [];
            const rows = table.querySelectorAll("tr");

            for (const row of rows) {
                const rowData = [];
                const cols = row.querySelectorAll("td, th");

                for (const col of cols) {
                    // Handle special cases like input fields in the header
                    const input = col.querySelector('input[type="text"]');
                    let data;
                    if (input) {
                        data = input.value;
                    } else {
                        data = col.innerText.replace(/(\r\n|\n|\r)/gm, " ").replace(/(\s\s)/gm, " ");
                    }
                    // Escape double quotes by doubling them
                    data = data.replace(/"/g, '""');
                    // Enclose in double quotes if it contains a comma, double quote, or newline
                    if (data.includes(',') || data.includes('"') || data.includes('\n')) {
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

        importRequestsFromCSV(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const rows = text.split('\n').slice(1); // Skip header row
                let importedCount = 0;

                rows.forEach(row => {
                    if (!row.trim()) return;
                    const [staffName, startDate, endDate, requestType] = row.split(',').map(s => s.trim());
                    const staffMember = this.data.staff.find(s => s.name.toLowerCase() === staffName.toLowerCase());

                    if (staffMember && startDate && endDate && requestType) {
                        this.data.time_off.push({
                            id: Date.now() + Math.random(),
                            staffId: staffMember.id,
                            staffName: staffMember.name,
                            startDate,
                            endDate,
                            requestType
                        });
                        importedCount++;
                    }
                });
                alert(`Successfully imported ${importedCount} requests. Please Save Changes.`);
                event.target.value = ''; // Reset file input
            };
            reader.readAsText(file);
        },

        importAllData(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);

                    // Basic validation to check if it's a plausible backup file
                    if (!importedData.staff || !importedData.schedules || !importedData.shift_rules) {
                        alert('Error: The selected file does not appear to be a valid scheduler backup file.');
                        return;
                    }

                    if (confirm('Are you sure you want to overwrite ALL current data with the contents of this file? This action cannot be undone.')) {
                        this.data = importedData;
                        this.validateDataStructure(); // Ensure data structure is compatible
                        this.saveDataToLocalStorage();
                        alert('Data imported successfully! The page will now reload to apply the changes.');
                        location.reload();
                    }
                } catch (error) {
                    alert('An error occurred while parsing the file. Please ensure it is a valid JSON backup file.');
                } finally {
                    event.target.value = ''; // Reset file input
                }
            };
            reader.readAsText(file);
        },

        exportAllData() {
            const dataStr = JSON.stringify(this.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `scheduler_backup_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
        }

    }));
});
