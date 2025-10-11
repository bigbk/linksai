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
        /** Initializes the application by loading data, calculating dates, and setting up initial state. */
        init() {
            this.loadDataFromLocalStorage();
            this.calculateWeekDates("current");
            this.calculateWeekDates("browse");
            this.importAndLockRequests(false); // Apply requests after week dates are calculated
            this.calculateFairnessScores();
            console.log("Scheduler App Initialized");
        },
        // =================================================================================
        // DATA PERSISTENCE
        // =================================================================================
        /** Loads all application data from the browser's localStorage. */
        loadDataFromLocalStorage() {
            const savedData = localStorage.getItem("schedulerData");
            if (savedData) {
                try {
                    this.data = JSON.parse(savedData);
                    console.log("Data loaded from localStorage.");
                } catch (e) {
                    console.error("Error parsing saved data, setting up defaults.", e);
                    this.setupDefaultData();
                }
            } else {
                console.log("No saved data found, setting up defaults.");
                this.setupDefaultData();
            }
            this.validateDataStructure();
        },

        /** Saves the entire `data` object to localStorage and shows a status message. */
        saveDataToLocalStorage() {
            localStorage.setItem("schedulerData", JSON.stringify(this.data));
            console.log("Data saved to localStorage.");
            this.saveStatus = "Changes Saved!";
            setTimeout(() => (this.saveStatus = ""), 2000);
        
      // Initialize fairness penalty weights if missing
      if (!this.data.advanced_rules.fairness) this.data.advanced_rules.fairness = { weights: {} };
      if (!this.data.advanced_rules.fairness.weights) this.data.advanced_rules.fairness.weights = {};
      const fw = this.data.advanced_rules.fairness.weights;
      if (fw.openingPenalty === undefined) fw.openingPenalty = 0;
      if (fw.closingPenalty === undefined) fw.closingPenalty = 3;
      if (fw.saturdayAnyPenalty === undefined) fw.saturdayAnyPenalty = 2;
      if (fw.fridayClosePenalty === undefined) fw.fridayClosePenalty = 5;
      if (fw.saturdayClosePenalty === undefined) fw.saturdayClosePenalty = 6;
      if (fw.weeklySecondClose === undefined) fw.weeklySecondClose = 4;
},

        /** Sets up a default data structure if no saved data is found. */
        setupDefaultData() {
            const defaultShiftRules = {};
            this.shiftTypes.forEach((shiftType) => {
                const minMax = {};
                this.staffTypes.forEach((st) => {
                    minMax[st] = { min: null, max: null };
                });
                defaultShiftRules[shiftType] = { days: [], min_max: minMax };
            });

            // Special setup for Offer shifts
            defaultShiftRules["Offer"].daily_requirements = {};
            this.daysOfWeek.forEach((day) => {
                defaultShiftRules["Offer"].daily_requirements[day] = 0;
            });

            // Special setup for Lane VCA shifts
            defaultShiftRules["Lane VCA"].daily_requirements = {};
            this.daysOfWeek.forEach((day) => {
                defaultShiftRules["Lane VCA"].daily_requirements[day] = 0;
            });

            const defaultStoreHours = {};
            this.daysOfWeek.forEach((day) => {
                defaultStoreHours[day] = { text: "9a-9p", open: 9, close: 21 };
            });

            this.data = {
                staff: [],
                shift_rules: defaultShiftRules,
                schedules: {},
                store_hours: defaultStoreHours,
            };

            this.data.advanced_rules = {
                cbc: {
                    dailyMax: 4,
                    dayPriority: ["Sat", "Fri", "Mon"],
                },
                apm: {
                    saturdayClosingPenalty: 2,
                    minClosingShifts: 1,
                },
                day_priority: {
                    cbc: this.daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: 7 }), {}),
                    lane: this.daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: 7 }), {}),
                },
                default_shift_hours: {
                    "Offer": "10a-7p",
                    "Training": "9a-5p",
                    "BAAA": "9a-5p",
                    "BAAA Preview": "9a-5p",
                    "MNJ": "9a-5p",
                    "MPA": "9a-5p",
                },
                vca_shift_priority: {
                    "10-7": 1,
                    "11-8": 2,
                    "12-9": 3,
                    "9-6": 4,
                    "8-5": 5,
                },
                naming: { // These maps hold the display names. The keys are the system names.
                    roleNames: this.staffTypes.reduce((acc, type) => ({ ...acc, [type]: type }), {}),
                    shiftTypeNames: this.shiftTypes.reduce((acc, type) => ({ ...acc, [type]: type }), {}),
                },
                // This is a legacy property, keeping it for now to avoid breaking old data.
                // It will be phased out in favor of the logic in generateOfferShifts.
            };
        },

        /**
         * Validates the loaded data structure, ensuring all necessary keys and objects exist.
         * This prevents errors if the app is updated with a new data model.
         */
        validateDataStructure() {
            if (!this.data.store_hours) this.data.store_hours = {};
            this.daysOfWeek.forEach((day) => {
                if (!this.data.store_hours[day]) {
                    this.data.store_hours[day] = { text: "9a-9p", open: 9, close: 21 };
                }
            });

            if (!this.data.shift_rules) this.data.shift_rules = {};
            this.shiftTypes.forEach((shiftType) => {
                if (!this.data.shift_rules[shiftType]) {
                    this.data.shift_rules[shiftType] = { days: [], min_max: {} };
                }
                if (!this.data.shift_rules[shiftType].min_max) {
                    this.data.shift_rules[shiftType].min_max = {};
                }
                // Special validation for Offer shift daily requirements
                if (
                    shiftType === "Offer" &&
                    !this.data.shift_rules[shiftType].daily_requirements
                ) {
                    this.data.shift_rules[shiftType].daily_requirements = {};
                    this.daysOfWeek.forEach((day) => {
                        this.data.shift_rules[shiftType].daily_requirements[day] = 0;
                    });
                }
                // Special validation for Lane VCA shift daily requirements
                if (
                    shiftType === "Lane VCA" &&
                    !this.data.shift_rules[shiftType].daily_requirements
                ) {
                    this.data.shift_rules[shiftType].daily_requirements = {};
                    this.daysOfWeek.forEach(day => this.data.shift_rules[shiftType].daily_requirements[day] = 0);
                }

                this.staffTypes.forEach((staffType) => {
                    if (!this.data.shift_rules[shiftType].min_max[staffType]) {
                        this.data.shift_rules[shiftType].min_max[staffType] = {
                            min: null,
                            max: null,
                        };
                    }
                });
            });
            if (!this.data.staff) this.data.staff = [];
            this.data.staff.forEach((staff) => {
                if (!staff.availability) {
                    staff.availability = { hours: {}, shifts: [] };
                }
                // Migration from old 'days' array to new 'hours' object
                if (staff.availability.days && !staff.availability.hours) {
                    staff.availability.hours = {};
                    this.daysOfWeek.forEach(day => staff.availability.hours[day] = { start: '', end: '' });
                    delete staff.availability.days;
                }
            });
            if (!this.data.time_off) this.data.time_off = [];
            if (!this.data.schedules) this.data.schedules = {};

            // Validate advanced rules
            if (!this.data.advanced_rules) {
                this.data.advanced_rules = {};
            }
            // Define defaults here to avoid issues with `this` context
            const defaultAdvancedRules = {
                cbc: {
                    dailyMax: 4,
                    dayPriority: ["Sat", "Fri", "Mon"],
                },
                apm: { saturdayClosingPenalty: 2, minClosingShifts: 1 },
            };
            if (!this.data.advanced_rules.cbc) this.data.advanced_rules.cbc = defaultAdvancedRules.cbc;
            if (!this.data.advanced_rules.day_priority) {
                this.data.advanced_rules.day_priority = {
                    cbc: this.daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: 7 }), {}),
                    lane: this.daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: 7 }), {}),
                };
            }
            if (!this.data.advanced_rules.day_priority.cbc) this.data.advanced_rules.day_priority.cbc = this.daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: 7 }), {});
            if (!this.data.advanced_rules.day_priority.lane) this.data.advanced_rules.day_priority.lane = this.daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: 7 }), {});
            if (!this.data.advanced_rules.apm) this.data.advanced_rules.apm = defaultAdvancedRules.apm;
            if (!this.data.advanced_rules.vca_shift_priority) {
                this.data.advanced_rules.vca_shift_priority = {
                    "10-7": 1,
                    "11-8": 2,
                    "12-9": 3,
                    "9-6": 4,
                    "8-5": 5,
                };
            }
            if (!this.data.advanced_rules.default_shift_hours) {
                this.data.advanced_rules.default_shift_hours = {
                    "Offer": "10a-7p",
                    "Training": "9a-5p",
                    "BAAA": "9a-5p",
                    "BAAA Preview": "9a-5p",
                    "MNJ": "9a-5p",
                    "MPA": "9a-5p",
                };
            }

            if (this.data.advanced_rules.apm.minClosingShifts === undefined)
                this.data.advanced_rules.apm.minClosingShifts = 1;
            if (typeof this.data.advanced_rules.cbc.dayPriority === "string") {
                // Handle old data format if needed
                this.data.advanced_rules.cbc.dayPriority = this.data.advanced_rules.cbc.dayPriority
                    .split(",")
                    .map((s) => s.trim());
            }
        },

            // =================================================================================
            // STAFF MANAGEMENT
            // =================================================================================
            /**
             * Adds a new staff member to the `data.staff` array.
             * Performs validation to ensure name and roles are provided.
             */
            addStaff() {
                if (!this.newStaffName.trim()) {
                    alert("Please enter a name.");
                    return;
                }
                if (this.newStaffTypes.length === 0) {
                    alert("Please select at least one role.");
                    return;
                }
                this.data.staff.push({
                    id: Date.now(),
                    name: this.newStaffName.trim(),
                    types: this.newStaffTypes,
                    availability: {
                        hours: this.daysOfWeek.reduce((acc, day) => {
                            acc[day] = { start: '', end: '' };
                            return acc;
                        }, {}), shifts: [] },
                });
                this.newStaffName = "";
                this.newStaffTypes = [];
            },

            /**
             * Deletes a staff member after user confirmation.
             * @param {number} staffId - The ID of the staff member to delete.
             */
            deleteStaff(staffId) {
                // Using a custom modal/confirm is better than the browser's confirm
                if (confirm("Are you sure you want to delete this staff member?")) {
                    this.data.staff = this.data.staff.filter((s) => s.id !== staffId);
                }
            },

        // =================================================================================
    // UI & VIEW HELPERS
    // =================================================================================
    /** A computed property that returns the staff list sorted by role hierarchy and then alphabetically. */
    get sortedStaff() {
                if (!this.data.staff) return [];
                // Added other roles to the hierarchy
                const roleOrder = {
                    PM: 1,
                    APM: 2,
                    SB: 3,
                    B: 4,
                    VCA: 5,
                    BA: 6,
                    BAAA: 7,
                    "BAAA Preview": 8,
                    MNJ: 9,
                    MPA: 10,
                };

                return [...this.data.staff].sort((a, b) => {
                    // Find the highest-ranking (lowest number) role for each person
                    const roleA = Math.min(...a.types.map((t) => roleOrder[t] || 99));
                    const roleB = Math.min(...b.types.map((t) => roleOrder[t] || 99));

                    if (roleA !== roleB) {
                        return roleA - roleB;
                    }
                    return a.name.localeCompare(b.name); // Alphabetical for ties
                });
        },

        /** Gets the custom display name for a role. Falls back to the system name. */
        getRoleName(systemName) {
            return this.data.advanced_rules?.naming?.roleNames?.[systemName] || systemName;
        },

        /** Gets the custom display name for a shift type. Falls back to the system name. */
        getShiftTypeName(systemName) {
            return this.data.advanced_rules?.naming?.shiftTypeNames?.[systemName] || systemName;
        },

                // =================================================================================
                // TIME OFF & REQUESTS MANAGEMENT
                // =================================================================================
                /** Adds a new time-off or shift request and re-applies all requests to the schedule. */
                addTimeOff() {                    
                    // If it's a day off request and no end date is provided, default it to the start date.
                    if (this.timeoff.requestType === "Off" && !this.timeoff.endDate) {
                        this.timeoff.endDate = this.timeoff.startDate;
                    } else if (this.timeoff.requestType !== "Off") {
                        this.timeoff.endDate = this.timeoff.startDate; // For single-day shift requests
                    }

                    if (
                        !this.timeoff.staffId ||
                        !this.timeoff.startDate ||
                        !this.timeoff.endDate
                    ) {
                        alert("Please fill out all fields for the request.");
                        return;
                    }
                    const staffMember = this.data.staff.find(
                        (s) => s.id == this.timeoff.staffId
                    );
                    this.data.time_off.push({
                        id: Date.now(),
                        staffId: this.timeoff.staffId,
                        staffName: staffMember.name,
                        startDate: this.timeoff.startDate,
                        endDate: this.timeoff.endDate,
                        requestType: this.timeoff.requestType,
                    });
                    this.timeoff = {
                        staffId: "",
                        startDate: "",
                        endDate: "",
                        requestType: "Off",
                    };
                },

                /**
                 * Removes a time-off request.
                 * @param {number} id - The ID of the time-off request to remove.
                 */
                removeTimeOff(id) {
                    this.data.time_off = this.data.time_off.filter((t) => t.id !== id);
                    this.saveDataToLocalStorage();
                    this.importAndLockRequests(false); // Re-apply to clear the removed request
                },

                    // =================================================================================
                    // DATE & WEEK NAVIGATION
                    // =================================================================================
                    /**
                     * Calculates the full week's dates based on the provided date type ('current' or 'browse').
                     * @param {'current' | 'browse'} type - The type of week to calculate.
                     */
                    calculateWeekDates(type) {
                        console.log(`[calculateWeekDates] for '${type}' starting with date:`, type === "current" ? this.currentDate : this.browseDate);
                        let date = type === "current" ? this.currentDate : this.browseDate;
                        const dayOfWeek = date.getDay(); // Sunday = 0, Saturday = 6
                        const newDates = [];
                        for (let i = 0; i < 7; i++) {
                            // Create a new date in UTC to avoid timezone-related off-by-one errors.
                            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
                            d.setUTCDate(d.getUTCDate() - dayOfWeek + i);

                            const month = d.getUTCMonth() + 1;
                            const day = d.getUTCDate();

                            newDates.push({
                                name: this.daysOfWeek[i],
                                date: `${month}/${day}`,
                                fullDate: d.toISOString().split('T')[0],
                            });
                        }
                        console.log(`[calculateWeekDates] for '${type}' calculated dates:`, JSON.parse(JSON.stringify(newDates)));
                        if (type === "current") {
                            this.weekDates = newDates;
                            this.schedule = this.data.schedules[this.weekDates[0].fullDate] || {};
                        } else {
                            this.browseWeekDates = newDates;
                        }
                    },

                    /**
                     * Navigates the week forward or backward.
                     * @param {number} direction - `-1` for previous, `1` for next.
                     * @param {'current' | 'browse'} type - The view to change.
                     */
                    changeWeek(direction, type) {
                        console.group(`[changeWeek] for '${type}'`);
                        const oldDate = type === "current" ? this.currentDate : this.browseDate;
                        console.log('Old date:', oldDate);
                        const newDate = new Date(oldDate);
                        newDate.setUTCDate(newDate.getUTCDate() + 7 * direction);
                        if (type === "current") this.currentDate = newDate;
                        else this.browseDate = newDate;
                        console.log('New date:', newDate);
                        this.calculateWeekDates(type);
                        if (type === "current") this.calculateFairnessScores(); // Recalculate when week changes
                    },

                    /**
                     * Gets the date range string for display.
                     * @param {'current' | 'browse'} type - The view to get the display for.
                     * @returns {string} The formatted date range (e.g., "1/1 - 1/7").
                     */
                    getWeekDisplay(type) {
                        let dates = type === "current" ? this.weekDates : this.browseWeekDates;
                        if (!dates || dates.length === 0) return "Loading...";
                        return `${dates[0].date} - ${dates[6].date}`;
                    },

                    /** Returns the schedule object for the currently selected week in the 'Browse' tab. */
                    getBrowseSchedule() {
                        if (!this.browseWeekDates || this.browseWeekDates.length === 0)
                            return null;
                        return this.data.schedules[this.browseWeekDates[0].fullDate] || null;
                    },

                        // =================================================================================
                        // SCHEDULE INTERACTION & MANUAL OVERRIDES
                        // =================================================================================
                        /**
                         * Toggles the 'locked' state of a shift.
                         * @param {number} staffId - The ID of the staff member.
                         * @param {string} fullDate - The date of the shift (YYYY-MM-DD).
                         */
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

                        /** Clears all shifts for the current week that are not locked. */
                        clearSchedule() {
                            if (
                                !confirm("Are you sure you want to clear all UNLOCKED shifts for this week?")
                            )
                                return;

                            const weekKey = this.weekDates[0].fullDate;
                            if (!this.data.schedules[weekKey]) return;

                            for (const staffId in this.data.schedules[weekKey]) {
                                for (const date in this.data.schedules[weekKey][staffId]) {
                                    if (!this.data.schedules[weekKey][staffId][date].locked) {
                                        delete this.data.schedules[weekKey][staffId][date];
                                    }
                                }
                            }
                            this.schedule = { ...this.data.schedules[weekKey] }; // Refresh view
                            this.generationErrors.push("Cleared all unlocked shifts.");
                        },

                        /**
                         * Formats a shift object for display in the input field.
                         * @param {number} staffId - The ID of the staff member.
                         * @param {string} fullDate - The date of the shift (YYYY-MM-DD).
                         * @returns {string} The formatted shift string, e.g., "9a-5p (Training)".
                         */
                        formatShiftForDisplay(staffId, fullDate, scheduleContext = null) {
                            const context = scheduleContext || this.schedule;
                            const shift = context[staffId]?.[fullDate];
                            if (!shift) return "";
                            if (shift.type === "OFF") {
                                return "OFF";
                            }
                            return `${shift.time} (${shift.type.toUpperCase()})`;
                        },

                        /**
                         * Updates a shift based on manual user input in the schedule grid.
                         * @param {Event} event - The blur event from the input field.
                         * @param {number} staffId - The ID of the staff member.
                         * @param {string} fullDate - The date of the shift (YYYY-MM-DD).
                         */
                        updateShiftFromInput(event, staffId, fullDate) {
                            const inputValue = event.target.value.trim();
                            const weekKey = this.weekDates[0].fullDate;

                            // Ensure the nested objects exist on both the persistent data and the reactive view model
                            if (!this.data.schedules[weekKey][staffId])
                                this.data.schedules[weekKey][staffId] = {};
                            if (!this.schedule[staffId]) this.schedule[staffId] = {};

                            if (inputValue === "") {
                                // Delete from both data sources
                                delete this.data.schedules[weekKey][staffId][fullDate];
                                delete this.schedule[staffId][fullDate];
                            } else {
                                // Improved parsing: "8-5 cbc" -> "8a-5p (CBC)"
                                const parts = inputValue.split(/\s+/);
                                const timePart = parts[0];
                                const typePart = parts.slice(1).join(" ") || "Manual";

                                const timeMatch = timePart.match(/(\d{1,2})-(\d{1,2})/);
                                let formattedTime = timePart;

                                if (timeMatch) {
                                    let startHour = parseInt(timeMatch[1], 10);
                                    let endHour = parseInt(timeMatch[2], 10);

                                    // If end hour is less than start hour, assume it's a PM shift crossing noon.
                                    // e.g., 10-7 becomes 10am-7pm.
                                    if (endHour < startHour && endHour < 12) {
                                        endHour += 12;
                                    }

                                    formattedTime = `${this.formatTime(startHour)}-${this.formatTime(endHour)}`;
                                }

                                const match = inputValue.match(/([^()]+)\s*\(([^)]+)\)/); // Original regex for `time (type)` format
                                let newShift;
                                if (match) {
                                    newShift = {
                                        time: match[1].trim(),
                                        type: match[2].trim().toUpperCase(),
                                        locked: this.schedule[staffId]?.[fullDate]?.locked || false,
                                    };
                                } else {
                                    newShift = {
                                        time: formattedTime,
                                        type: typePart.toUpperCase() === "OFF" ? "OFF" : typePart,
                                        locked: this.schedule[staffId]?.[fullDate]?.locked || false,
                                    };
                                }
                                // Update both the persistent data and the reactive view model directly
                                this.data.schedules[weekKey][staffId][fullDate] = { ...newShift };
                                this.schedule[staffId][fullDate] = { ...newShift };
                            }
                            // After any manual change, recalculate fairness scores to reflect the update.
                            this.calculateFairnessScores();

                            // Force a refresh of the schedule object to ensure tallies and colors update.
                            // This is a common pattern in Alpine when dealing with deep object mutations.
                            this.schedule = { ...this.schedule };

                        },

                        // =================================================================================
                        // CORE SCHEDULING LOGIC
                        // =================================================================================

                        /**
                         * Iterates through all time-off requests and locks them into the schedule.
                         * @param {boolean} [showMessage=true] - Whether to show a confirmation message in the log.
                         */
                        importAndLockRequests(showMessage = true) {
                            console.groupCollapsed(`[importAndLockRequests] showMessage: ${showMessage}`);
                            if (!this.data.time_off) return;
                            const currentViewWeekKey = this.weekDates[0]?.fullDate;
                            if (!currentViewWeekKey) {
                                console.warn("`importAndLockRequests` called before `weekDates` was initialized. Aborting.");
                                console.groupEnd();
                                return;
                            }
                            console.log(`Current view's week key: ${currentViewWeekKey}`);

                            // First, clear all existing locked shifts that were created from requests.
                            // This ensures that deleting a request and re-importing cleans up the schedule.
                            for (const weekKey in this.data.schedules) {
                                for (const staffId in this.data.schedules[weekKey]) {
                                    for (const date in this.data.schedules[weekKey][staffId]) {
                                        const shift = this.data.schedules[weekKey][staffId][date];
                                        const isRequestType = shift.type === 'OFF' || this.formatRequestTime(shift.type) !== shift.type;

                                        if (shift.locked && isRequestType) {
                                            console.log(`  -> Clearing old request shift for staff ${staffId} on ${date} in week ${weekKey}`);
                                            delete this.data.schedules[weekKey][staffId][date];
                                        }
                                    }
                                }
                            }

                            let importCount = 0;
                            this.data.time_off.forEach((request) => {
                                console.log(`Processing request for ${request.staffName} from ${request.startDate} to ${request.endDate}`);
                                const startDate = new Date(request.startDate + "T00:00:00");
                                const endDate = new Date(request.endDate + "T00:00:00");
 
                                // Correctly loop through the date range without modifying the iterator in the condition.
                                // This is the robust way to prevent date mutation issues.
                                const diffTime = Math.abs(endDate - startDate);
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include the end date
                                for (let i = 0; i < diffDays; i++) {
                                    const d = new Date(startDate);
                                    d.setDate(d.getDate() + i);
                                    const dateStr = d.toISOString().split("T")[0];
                                    const requestWeekKey = this.getWeekKeyForDate(dateStr);
                                    console.log(`  -> Date: ${dateStr}, Week Key: ${requestWeekKey}`);
 
                                    // Always use the calculated requestWeekKey to ensure data integrity,
                                    // regardless of the currently viewed week.
                                    if (!this.data.schedules[requestWeekKey]) {
                                        this.data.schedules[requestWeekKey] = {};
                                        console.log(`  -> Initialized new schedule object for week ${requestWeekKey}`);
                                    }
                                    if (!this.data.schedules[requestWeekKey][request.staffId]) {
                                        this.data.schedules[requestWeekKey][request.staffId] = {};
                                    }

                                    const shiftType =
                                        request.requestType === "Off" ? "OFF" : request.requestType;
                                    const shiftTime =
                                        request.requestType === "Off"
                                            ? "OFF"
                                            : this.formatRequestTime(request.requestType);
                                    console.log(`    -> Locking shift '${shiftTime} (${shiftType})' for staff ${request.staffId} on ${dateStr}`);
                                    this.data.schedules[requestWeekKey][request.staffId][dateStr] = { time: shiftTime, type: shiftType, locked: true };
                                    importCount++;
                                }
                            });

                            if (showMessage && importCount > 0) {
                                this.generationErrors.push(
                                    `Imported and locked ${importCount} requests for this week.`
                                );
                            }

                            this.calculateWeekDates("current"); // This will refresh the view with the newly locked shifts
                        },

                        /**
                         * Main router function to trigger schedule generation for a specific shift type.
                         * @param {string} shiftType - The type of shift to generate (e.g., 'CBC', 'Lane').
                         */
                        generateSchedule(shiftType) {
                            console.group(`--- Generating [${shiftType}] Shifts ---`);
                            this.generationErrors = []; // Always clear old logs on a new run
                            this.calculateFairnessScores(); // Recalculate fresh scores at the start of any generation.
                            const weekKey = this.weekDates[0].fullDate;
                            let tempSchedule = JSON.parse(JSON.stringify(this.schedule));

                            console.log("Starting with schedule:", JSON.parse(JSON.stringify(tempSchedule)));
                            console.log("Using fairness scores:", JSON.parse(JSON.stringify(this.fairnessScores)));

                            // --- LOGIC ROUTER ---
                            switch (shiftType) {
                                case "BAAA":
                                case "BAAA Preview":
                                case "MNJ":
                                case "MPA":
                                    this.generateByDayAndRole(shiftType, tempSchedule);
                                    break;
                                case "Offer":
                                    this.generateOfferShifts(tempSchedule);
                                    break;
                                case "CBC":
                                    this.generateCbcShifts(tempSchedule);
                                    break;
                                case "Lane VCA":
                                    this.generateLaneVcaShifts(tempSchedule);
                                    break;
                                case "Training":
                                    this.generateTrainingShifts(tempSchedule);
                                    break;
                                case "Lane":
                                    this.generateLaneShifts(tempSchedule);
                                    break;
                                default:
                                    this.generationErrors.push(`Unknown shift type: ${shiftType}`);
                            }

                            this.data.schedules[weekKey] = tempSchedule;
                            this.schedule = { ...this.data.schedules[weekKey] };
                            this.validateSchedule(this.schedule); // Run validation at the end
                            console.log("Finished with schedule:", JSON.parse(JSON.stringify(this.schedule)));
                            console.groupEnd();
                        },

                        // =================================================================================
                        // SHIFT GENERATION MODULES
                        // =================================================================================

                        /** Generic generator for roles that are assigned one shift per day based on min requirements. */
                        generateByDayAndRole(shiftType, tempSchedule) {
                            console.log(`Running generateByDayAndRole for [${shiftType}]`);
                            const shiftRule = this.data.shift_rules[shiftType];
                            if (!shiftRule || !shiftRule.days || shiftRule.days.length === 0) return;

                            const staffForRole = this.data.staff.filter(s => s.types.includes(shiftType));
                            if (staffForRole.length === 0) return;

                            // This logic assumes one shift per day for the person with this role.
                            // e.g., The one 'BAAA' gets one 'BAAA' shift on an eligible day.
                            staffForRole.forEach(staff => {
                                // Find an available day for this specific staff member
                                const availableDays = this.weekDates.filter(day =>
                                    shiftRule.days.includes(day.name) &&
                                    this.isStaffEligibleForShift(staff, day, "9a-5p", tempSchedule) // Use a default time for this check
                                );

                                if (availableDays.length > 0) {
                                    // Simple assignment: pick the first available day.
                                    // The shift time will be adjusted by assignShift if needed.
                                    // More complex logic (like fairness) could be added here if needed.
                                    const dayToAssign = availableDays[0];                                    const shiftTime = this.data.advanced_rules.default_shift_hours[shiftType] || "9a-5p";

                                    this.assignShift(staff.id, dayToAssign.fullDate, shiftTime, shiftType, tempSchedule);
                                    this.generationErrors.push(`Assigned ${shiftType} shift to ${staff.name} on ${dayToAssign.name}.`);
                                    this.updateFairnessScoreOnAssignment(staff.id, dayToAssign, shiftTime, shiftType);
                                } else {
                                    this.generationErrors.push(`Warning: Could not find an available day for ${staff.name} for their ${shiftType} shift.`);
                                }
                            });
                            },

                            /** Generator for 'Offer' shifts based on daily required counts. */
                            generateOfferShifts(tempSchedule) {
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
        this.generationErrors.push(`Flipped opener ${staffToFlip.name} on ${day.name} to an Offer shift.`);
        tempSchedule[staffIdToFlip][day.fullDate].type = "Offer";
        assignedCount++;
        continue;
      }
      this.generationErrors.push(`Warning: Could not find or flip a candidate for an Offer shift on ${day.name}.`);
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
,


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
    if (meta.isClosing && staff.types.includes("APM")) {
      const hasCloser = this.checkApmCloserInSchedule(tempSchedule, staff.id);
      if (!hasCloser) score -= 10;
    }
    if (meta.isClosing) {
      const unit = this.data.advanced_rules?.fairness?.weights?.weeklySecondClose ?? 4;
      const already = this.countApmClosingShifts(tempSchedule, staff.id);
      if (already > 0) score += unit * already;
    }
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
  const fw = this.data.advanced_rules?.fairness?.weights || {};
  const W = {
    CLOSE: fw.closingPenalty ?? 3,
    SATURDAY: fw.saturdayAnyPenalty ?? 2,
    FRI_CLOSE: fw.fridayClosePenalty ?? 5,
    SAT_CLOSE: fw.saturdayClosePenalty ?? 6,
    OPEN: fw.openingPenalty ?? 0,
  };
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


                            // =================================================================================
                            // TALLY & COUNTING FUNCTIONS
                            // =================================================================================

                            /**
                             * Counts the number of shifts a staff member has in a given schedule context.
                             * @param {number} staffId
                             * @param {object|null} scheduleContext - The schedule to check. Defaults to the current view.
                             * @returns {number}
                             */
                            getShiftCount(staffId, scheduleContext = null) {
                                const context = scheduleContext || this.schedule || {};
                                if (!context[staffId]) return 0;
                                return Object.keys(context[staffId]).length;
                            },

                            /** Calculates and returns a tally of key shifts (Saturdays, closes, etc.) over the last 5 weeks. */
                            getRollingTally(staffId) {
                                const tally = { saturdays: 0, closes: 0, friCloses: 0, cbc: 0 };                                if (!this.weekDates || this.weekDates.length === 0) return tally; // Guard clause
                                const currentWeekKey = this.weekDates[0].fullDate;

                                for (let i = 0; i < 5; i++) {
                                    const weekStartDate = new Date(currentWeekKey);
                                    weekStartDate.setDate(weekStartDate.getDate() - i * 7);
                                    const weekKey = weekStartDate.toISOString().split("T")[0];

                                    const scheduleToTally =
                                        weekKey === currentWeekKey
                                            ? this.schedule
                                            : this.data.schedules[weekKey];

                                    if (scheduleToTally && scheduleToTally[staffId]) {
                                        for (const dateStr in scheduleToTally[staffId]) {
                                            const shift = scheduleToTally[staffId][dateStr];
                                            if (shift.type === "OFF") continue; // Do not count OFF shifts in tallies

                                            const date = new Date(dateStr + "T00:00:00");
                                            const dayOfWeek = date.getDay();
                                            const dayShortName = this.daysOfWeek[dayOfWeek];

                                            // Count Saturdays
                                            if (dayOfWeek === 6) {
                                                tally.saturdays++;
                                            }

                                            // Count CBC Shifts
                                            if (shift.type === "CBC") {
                                                tally.cbc++;
                                            }

                                            // Count Closing Shifts
                                            const storeHours = this.data.store_hours[dayShortName];
                                            if (storeHours && typeof storeHours.close === "number") {
                                                const closerShiftTime = `${this.formatTime(
                                                    storeHours.close - 9
                                                )}-${this.formatTime(storeHours.close)}`;
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

                            /** Calculates the number of staff assigned to each shift category for a single day. */
                            getDailyTally(fullDate, dayName) {
                                const tally = { open: 0, mid: 0, close: 0, cbc: 0, offsite: 0 };
                                const scheduleForWeek = this.schedule;
                                if (!scheduleForWeek) return tally;

                                const hours = this.data.store_hours[dayName];
                                // If no hours are set, we can't determine shift types, so return empty tally.
                                if (
                                    !hours ||
                                    typeof hours.open !== "number" ||
                                    typeof hours.close !== "number"
                                )
                                    return tally;

                                const openTime = parseInt(hours.open);
                                const closeTime = parseInt(hours.close);
                                const openerShiftTime = `${this.formatTime(openTime)}-${this.formatTime(
                                    openTime + 9
                                )}`;
                                const closerShiftTime = `${this.formatTime(
                                    closeTime - 9
                                )}-${this.formatTime(closeTime)}`;
                                const offsiteTypes = ["BAAA", "BAAA Preview", "MNJ", "MPA"];

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

                            /** Checks if an APM has a closing shift in the given schedule. */
                            checkApmCloserInSchedule(scheduleContext, staffId = null) {
                                const staffList = staffId
                                    ? [this.data.staff.find((s) => s.id === staffId)]
                                    : this.data.staff.filter((s) => s.types.includes("APM"));

                                return staffList.some((staff) => {
                                    if (!staff || !staff.types.includes("APM")) return false;

                                    const staffSchedule = scheduleContext[staff.id];
                                    if (!staffSchedule) return false;

                                    return Object.keys(staffSchedule).some((date) => {
                                        const shift = staffSchedule[date];
                                        const dayName =
                                            this.daysOfWeek[new Date(date + "T00:00:00").getDay()];
                                        if (
                                            !this.data.store_hours[dayName] ||
                                            !this.data.store_hours[dayName].close
                                        )
                                            return false;
                                        const closerShiftTime = `${this.formatTime(
                                            this.data.store_hours[dayName].close - 9
                                        )}-${this.formatTime(this.data.store_hours[dayName].close)}`;
                                        return shift.time === closerShiftTime;
                                    });
                                });
                            },

                            /** Counts the number of closing shifts an APM has in a given schedule. */
                            countApmClosingShifts(scheduleContext, staffId) {
                                const staffSchedule = scheduleContext[staffId];
                                if (!staffSchedule) return 0;

                                let count = 0;
                                for (const date in staffSchedule) {
                                    const shift = staffSchedule[date];
                                    const dayName = this.daysOfWeek[new Date(date + "T00:00:00").getDay()];
                                    const hours = this.data.store_hours[dayName];
                                    if (!hours || !hours.close) continue;
                                    const closerShiftTime = `${this.formatTime(
                                        hours.close - 9
                                    )}-${this.formatTime(hours.close)}`;
                                    if (shift.time === closerShiftTime) count++;
                                }
                                return count;
                            },

                            /** Alias for a more generic counting function. */
                            countRecentCloses(staffId, scheduleContext = null) {
                                return this.countRecentGenericShifts(staffId, "closer", scheduleContext);
                            },

                            /** Counts how many Saturdays a staff member has worked in the last N weeks. */
                            countSaturdaysInLastNWeeks(staffId, N, scheduleContext) {
                                let count = 0;
                                const currentWeekKey = this.weekDates[0].fullDate;

                                // Count in previous N-1 weeks from saved data
                                for (let i = 1; i < N; i++) {
                                    const weekStartDate = new Date(currentWeekKey);
                                    weekStartDate.setDate(weekStartDate.getDate() - i * 7);
                                    const weekKey = weekStartDate.toISOString().split("T")[0];

                                    if (
                                        this.data.schedules[weekKey] &&
                                        this.data.schedules[weekKey][staffId]
                                    ) {
                                        for (const dateStr in this.data.schedules[weekKey][staffId]) {
                                            if (this.data.schedules[weekKey][staffId][dateStr].type === "OFF")
                                                continue;
                                            const dayNum = new Date(dateStr + "T00:00:00").getDay();
                                            if (dayNum === 6) count++; // 6 is Saturday
                                        }
                                    }
                                }

                                // Count in the current week's temporary schedule
                                const context = scheduleContext || this.schedule;
                                if (context && context[staffId]) {
                                    for (const dateStr in context[staffId]) {
                                        if (context[staffId][dateStr].type === "OFF") continue;
                                        const dayNum = new Date(dateStr + "T00:00:00").getDay();
                                        if (dayNum === 6) count++;
                                    }
                                }
                                return count;
                            },

                            /** A generic function to count specific types of shifts over the last 4 weeks + the current week's temp schedule. */
                            countRecentGenericShifts(staffId, countType, scheduleContext = null) {
                                let count = 0;
                                const currentWeekKey = this.weekDates[0].fullDate;

                                // Count in previous 4 weeks from saved data
                                for (let i = 1; i < 5; i++) {
                                    const weekStartDate = new Date(currentWeekKey);
                                    weekStartDate.setDate(weekStartDate.getDate() - i * 7);
                                    const weekKey = weekStartDate.toISOString().split("T")[0];

                                    if (
                                        this.data.schedules[weekKey] &&
                                        this.data.schedules[weekKey][staffId]
                                    ) {
                                        count += this.countShiftsInContext(
                                            this.data.schedules[weekKey][staffId],
                                            countType
                                        );
                                    }
                                }

                                // Count in the current week's temporary schedule
                                const context = scheduleContext || this.schedule;
                                if (context && context[staffId]) {
                                    count += this.countShiftsInContext(context[staffId], countType);
                                }
                                return count;
                            },

                            /** Helper for countRecentGenericShifts to avoid code duplication. */
                            countShiftsInContext(staffSchedule, countType) {
                                let count = 0;
                                for (const dateStr in staffSchedule) {
                                    const shift = staffSchedule[dateStr];
                                    if (shift.type === "OFF") continue;

                                    const dayNum = new Date(dateStr + "T00:00:00").getDay();
                                    const dayName = this.daysOfWeek[dayNum];

                                    if (countType === "saturday" && dayNum === 6) {
                                        count++;
                                        continue;
                                    }
                                    if (countType === "CBC" && shift.type === "CBC") {
                                        count++;
                                        continue;
                                    }
                                    if (countType === "closer" && this.data.store_hours[dayName]) {
                                        const closerShiftTime = `${this.formatTime(
                                            this.data.store_hours[dayName].close - 9
                                        )}-${this.formatTime(this.data.store_hours[dayName].close)}`;
                                        if (shift.time === closerShiftTime) count++;
                                    }
                                }
                                return count;
                            },

                            // =================================================================================
                            // IMPORT / EXPORT FUNCTIONS
                            // =================================================================================
                            /**
                             * Exports the currently visible schedule table to the specified format.
                             * @param {'csv' | 'jpg' | 'pdf'} format - The desired export format.
                             * @param {string} tableContainerId - The ID of the div containing the table to export.
                             */
                            exportScheduleAs(format, tableContainerId) {
                                 const isBrowsePage = tableContainerId.includes("browse");
                                 console.group(`[exportScheduleAs] format: ${format}, page: ${isBrowsePage ? 'Browse' : 'Schedule'}`);
 
                                 if (isBrowsePage && (format === 'pdf' || format === 'csv')) {
                                     // --- Multi-week export logic for PDF and CSV from Browse page ---
                                     const startWeekKey = this.browseWeekDates[0].fullDate;
                                     const futureScheduleKeys = Object.keys(this.data.schedules)
                                         .filter(key => key >= startWeekKey)
                                         .sort();
                                     console.log('Found future schedule keys:', futureScheduleKeys);
 
                                     if (futureScheduleKeys.length === 0) {
                                         alert("No schedules found for the current or future weeks to export.");
                                         return;
                                     }
 
                                     // Use UTC dates to avoid timezone-related off-by-one errors.
                                     const firstWeekKey = futureScheduleKeys[0];
                                     const lastWeekKey = futureScheduleKeys[futureScheduleKeys.length - 1];
                                     console.log(`[Export Debug] First week key: ${firstWeekKey}, Last week key: ${lastWeekKey}`);
 
                                     const firstWeekStartDate = new Date(firstWeekKey + 'T00:00:00Z'); // Treat as UTC
                                     const lastWeekEndDate = new Date(lastWeekKey + 'T00:00:00Z'); // Treat as UTC
                                     lastWeekEndDate.setUTCDate(lastWeekEndDate.getUTCDate() + 6); // Add 6 days in UTC
                                     console.log(`[Export Debug] First week start date (UTC): ${firstWeekStartDate.toISOString()}`);
                                     console.log(`[Export Debug] Last week end date (UTC): ${lastWeekEndDate.toISOString()}`);
 
                                     // Use getUTC... methods to get the correct date parts.
                                     const filename = `Schedule_${firstWeekStartDate.getUTCMonth() + 1}-${firstWeekStartDate.getUTCDate()}_to_${lastWeekEndDate.getUTCMonth() + 1}-${lastWeekEndDate.getUTCDate()}`;
                                     console.log('Generated filename:', filename);
 
                                     if (format === 'pdf') {
                                         const { jsPDF } = window.jspdf;
                                         const pdf = new jsPDF({ orientation: "landscape", unit: "px" });
                                         const processWeek = async (weekKey, isFirstPage) => {
                                             const tempContainer = document.createElement('div');
                                             tempContainer.style.position = 'absolute';
                                             tempContainer.style.left = '-9999px';
                                             tempContainer.style.width = '1200px';
                                             document.body.appendChild(tempContainer);
 
                                             const schedule = this.data.schedules[weekKey];
                                             const weekDates = this.getWeekDatesFor(weekKey);
                                             console.log(`  -> Processing PDF for week key ${weekKey} with dates:`, JSON.parse(JSON.stringify(weekDates)));
                                             const weekDisplay = `${weekDates[0].date} - ${weekDates[6].date}`;
 
                                             let tableHtml = `<h2 style="font-size: 1.5rem; font-weight: 600; margin: 1.5rem 0 1rem 0;">Week of ${weekDisplay}</h2>`;
                                             tableHtml += `<table style="width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; font-size: 0.875rem;">
                                                 <thead style="background-color: #f9fafb;">
                                                     <tr>
                                                         <th style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb; text-align: left;">Staff Member</th>
                                                          ${weekDates.map(day => `<th style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb;">${day.name}<br/><span style="font-size: 0.75rem; color: #6b7280;">${day.date}</span></th>`).join('')}
                                                     </tr>
                                                 </thead>
                                                 <tbody>
                                                     ${this.sortedStaff.map(staff => `
                                                         <tr style="border-top: 1px solid #e5e7eb;">
                                                             <td style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb; font-weight: 500;">${staff.name}</td>
                                                             ${weekDates.map(day => {
                                                                 const shift = schedule?.[staff.id]?.[day.fullDate];
                                                                 const shiftText = this.formatShiftForDisplay(staff.id, day.fullDate, schedule) || '-';
                                                                 const colorClass = this.getShiftColorClass(shift);
                                                                 const bgColor = colorClass ? `background-color: ${colorClass.replace('bg-green-200', '#dcfce7').replace('bg-blue-200', '#dbeafe').replace('bg-red-200', '#fee2e2').replace('bg-gray-300', '#e5e7eb')};` : '';
                                                                 return `<td style="padding: 0.75rem 1rem; border: 1px solid #e5e7eb; text-align: center; ${bgColor}">${shiftText}</td>`;
                                                             }).join('')}
                                                         </tr>
                                                     `).join('')}
                                                 </tbody>
                                             </table>`;
                                             tempContainer.innerHTML = tableHtml;
 
                                             const canvas = await html2canvas(tempContainer, { scale: 2, backgroundColor: "#ffffff" });
                                             const imgData = canvas.toDataURL("image/png");
                                             if (isFirstPage) {
                                                 pdf.internal.pageSize.setWidth(canvas.width);
                                                 pdf.internal.pageSize.setHeight(canvas.height);
                                             } else {
                                                 pdf.addPage([canvas.width, canvas.height], "landscape");
                                             }
                                             pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
                                             document.body.removeChild(tempContainer);
                                         };
 
                                         (async () => {
                                             for (let i = 0; i < futureScheduleKeys.length; i++) {
                                                 await processWeek(futureScheduleKeys[i], i === 0);
                                             }
                                             pdf.save(`${filename}.pdf`);
                                         })();
 
                                     } else if (format === 'csv') {
                                         let csv = [];
                                         futureScheduleKeys.forEach(weekKey => {
                                             const schedule = this.data.schedules[weekKey];
                                             const weekDates = this.getWeekDatesFor(weekKey);
                                             console.log(`  -> Processing CSV for week key ${weekKey} with dates:`, JSON.parse(JSON.stringify(weekDates)));
                                             const weekDisplay = `Week of ${weekDates[0].date} - ${weekDates[6].date}`;
                                             csv.push(weekDisplay);
 
                                             const header = ['Staff Member', ...weekDates.map(day => `${day.name} ${day.date}`)];
                                             csv.push(header.join(','));
 
                                             this.sortedStaff.forEach(staff => {
                                                 const row = [staff.name];
                                                 weekDates.forEach(day => {
                                                     const shiftText = this.formatShiftForDisplay(staff.id, day.fullDate, schedule) || '';
                                                     row.push(`"${shiftText.replace(/"/g, '""')}"`);
                                                 });
                                                 csv.push(row.join(','));
                                             });
                                             csv.push(''); // Add a blank line between weeks
                                         });
 
                                         const csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
                                         const link = document.createElement("a");
                                         link.href = URL.createObjectURL(csvFile);
                                         link.download = `${filename}.csv`;
                                         link.click();
                                         URL.revokeObjectURL(link.href);
                                     }
 
                                 } else {
                                     // --- Original logic for single-week JPG or any export from the main Schedule page ---
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
                                 }
                                 console.groupEnd();
                             },

                                                    /**
                                                     * Helper function to convert an HTML table to a CSV string and trigger a download.
                                                     * @param {HTMLTableElement} table - The table element to convert.
                                                     * @param {string} filename - The desired filename for the downloaded file.
                                                     */
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
                                                                    data = col.innerText
                                                                        .replace(/(\r\n|\n|\r)/gm, " ")
                                                                        .replace(/(\s\s)/gm, " ");
                                                                }
                                                                // Escape double quotes by doubling them
                                                                data = data.replace(/"/g, '""');
                                                                // Enclose in double quotes if it contains a comma, double quote, or newline
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

                                                    /**
                                                     * Imports time-off requests from a user-selected CSV file.
                                                     * @param {Event} event - The file input change event.
                                                     */
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
                                                                const [staffName, startDate, endDate, requestType] = row
                                                                    .split(",")
                                                                    .map((s) => s.trim());
                                                                const staffMember = this.data.staff.find(
                                                                    (s) => s.name.toLowerCase() === staffName.toLowerCase()
                                                                );

                                                                if (staffMember && startDate && endDate && requestType) {
                                                                    this.data.time_off.push({
                                                                        id: Date.now() + Math.random(),
                                                                        staffId: staffMember.id,
                                                                        staffName: staffMember.name,
                                                                        startDate,
                                                                        endDate,
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

                                                    /**
                                                     * Imports a full application state from a JSON backup file.
                                                     * @param {Event} event - The file input change event.
                                                     */
                                                    importAllData(event) {
                                                        const file = event.target.files[0];
                                                        if (!file) return;

                                                        const reader = new FileReader();
                                                        reader.onload = (e) => {
                                                            try {
                                                                const importedData = JSON.parse(e.target.result);

                                                                // Basic validation to check if it's a plausible backup file
                                                                if (
                                                                    !importedData.staff ||
                                                                    !importedData.schedules ||
                                                                    !importedData.shift_rules
                                                                ) {
                                                                    alert(
                                                                        "Error: The selected file does not appear to be a valid scheduler backup file."
                                                                    );
                                                                    return;
                                                                }

                                                                if (
                                                                    confirm(
                                                                        "Are you sure you want to overwrite ALL current data with the contents of this file? This action cannot be undone."
                                                                    )
                                                                ) {
                                                                    this.data = importedData;
                                                                    this.validateDataStructure(); // Ensure data structure is compatible
                                                                    this.saveDataToLocalStorage();
                                                                    alert(
                                                                        "Data imported successfully! The page will now reload to apply the changes."
                                                                    );
                                                                    location.reload();
                                                                }
                                                            } catch (error) {
                                                                alert(
                                                                    "An error occurred while parsing the file. Please ensure it is a valid JSON backup file."
                                                                );
                                                            } finally {
                                                                event.target.value = ""; // Reset file input
                                                            }
                                                        };
                                                        reader.readAsText(file);
                                                    },

                                                    /** Exports the entire application state (all data) to a JSON file for backup/restore. */
                                                    exportAllData() {
                                                        const dataStr = JSON.stringify(this.data, null, 2);
                                                        const blob = new Blob([dataStr], { type: "application/json" });
                                                        const url = URL.createObjectURL(blob);
                                                        const link = document.createElement("a");
                                                        link.href = url;
                                                        link.download = `scheduler_backup_${new Date().toISOString().split("T")[0]
                                                            }.json`;
                                                        link.click();
                                                        URL.revokeObjectURL(url);
                                                    },
                                                }));
});
