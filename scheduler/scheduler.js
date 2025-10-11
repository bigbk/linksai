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
                                // This function is defined later in the file.
                                // This is a placeholder to fix the structure. It will be overwritten by the real implementation below.
                                // This is a known side-effect of the current file structure.
                            },

                            /** Generator to fill remaining empty shifts with 'Training'. */
                            generateTrainingShifts(tempSchedule) {
                                // This function is defined later in the file.
                                // This is a placeholder to fix the structure.
                            },

                            /** Generator for 'CBC' shifts with complex role and day prioritization. */
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
                                    const requiredCount = offerRules.daily_requirements[day.name] || 0;
                                    if (requiredCount === 0) continue;

                                    let assignedCount = Object.values(tempSchedule).reduce(
                                        (count, staffShifts) => {
                                            return staffShifts[day.fullDate]?.type === "Offer"
                                                ? count + 1
                                                : count;
                                        },
                                        0
                                    );

                                    // Offer shifts are for B, SB, and APM roles by default.
                                    // This logic is kept internal to the function for stability.
                                    const eligibleRoles = ['B', 'SB', 'APM'];

                                    while (assignedCount < requiredCount) {
                                        const candidatePool = this.data.staff.filter(
                                            (staff) =>
                                                staff.types.some(t => eligibleRoles.includes(t)) &&
                                                staff.availability.shifts.includes("Offer") &&
                                                this.isStaffEligibleForShift(staff, day, this.data.advanced_rules.default_shift_hours["Offer"] || "10a-7p", tempSchedule)
                                        );

                                        if (candidatePool.length === 0) {
                                            this.generationErrors.push(
                                                `Warning: Could not find an eligible candidate for an Offer shift on ${day.name}.`
                                            );
                                            break; // Stop trying for this day if no one is available
                                        }
                                        console.log(`[Offer] on [${day.name}]: Found ${candidatePool.length} candidates.`);
                                        const candidate = this.selectRandomFromWeightedPool(
                                            this.createWeightedPool(candidatePool, "total")
                                        );
                                        if (candidate) {
                                            const shiftTime = this.data.advanced_rules.default_shift_hours["Offer"] || "10a-7p";
                                            this.assignShift(candidate.id, day.fullDate, shiftTime, "Offer", tempSchedule);
                                            assignedCount++;
                                            this.updateFairnessScoreOnAssignment(candidate.id, day, shiftTime, "Offer");
                                            continue; // Move to the next required shift
                                        }
                                    }

                                    // If we still haven't met the required count, try flipping existing shifts.
                                    if (assignedCount < requiredCount) {
                                        this.generationErrors.push(`Warning: No free staff for Offer on ${day.name}. Attempting to flip a shift.`);

                                        // --- Flip Priority 1: A closing B or SB ---
                                        const hours = this.data.store_hours[day.name];
                                        if (hours && hours.close) {
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
                                                console.log(`[Offer] Flipping closer ${staffToFlip.name} on ${day.name} to an Offer shift.`);
                                                this.generationErrors.push(`Flipped closer ${staffToFlip.name} on ${day.name} to an Offer shift.`);
                                                tempSchedule[staffIdToFlip][day.fullDate].type = "Offer"; // Only change the type
                                                assignedCount++;
                                                continue; // Move to the next required shift
                                            }
                                        }

                                        // --- Flip Priority 2: An opening shift (non-APM) ---
                                        if (assignedCount < requiredCount && hours && hours.open) {
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
                                                console.log(`[Offer] Flipping opener ${staffToFlip.name} on ${day.name} to an Offer shift.`);
                                                this.generationErrors.push(`Flipped opener ${staffToFlip.name} on ${day.name} to an Offer shift.`);
                                                tempSchedule[staffIdToFlip][day.fullDate].type = "Offer"; // Only change the type
                                                assignedCount++;
                                                continue; // Move to the next required shift
                                            }
                                        }
                                    }

                                    // After trying to fill the shifts for the day, validate the final count.
                                    const finalAssignedCount = Object.values(tempSchedule).reduce((count, staffShifts) => (staffShifts[day.fullDate]?.type === "Offer" ? count + 1 : count), 0);

                                    if (finalAssignedCount < requiredCount) {
                                        this.generationErrors.push(`Warning for ${day.name}: Required ${requiredCount} Offer shifts, but only ${finalAssignedCount} could be assigned.`);
                                    }
                                }
                            },

                            /** Generator to fill remaining empty shifts with 'Training'. */
                            generateTrainingShifts(tempSchedule) {
                                this.generationErrors.push("Generating Training shifts...");
                                this.data.staff.forEach((staff) => {
                                    if (!staff.availability.shifts.includes('Training')) {
                                        return; // Skip staff not available for training
                                    }

                                    // Use a while loop to ensure we fill up to 5 shifts if possible
                                    while (this.getShiftCount(staff.id, tempSchedule) < 5) {
                                        // Find the first available day that doesn't have a shift yet
                                        const availableDay = this.weekDates.find(day =>
                                            this.isStaffEligibleForShift(staff, day, this.data.advanced_rules.default_shift_hours["Training"] || "9a-5p", tempSchedule)
                                        );

                                        if (availableDay) {
                                            const shiftTime = this.data.advanced_rules.default_shift_hours["Training"] || "9a-5p";
                                            this.assignShift(staff.id, availableDay.fullDate, shiftTime, "Training", tempSchedule);
                                            this.generationErrors.push(`Assigned Training shift to ${staff.name} on ${availableDay.name}.`);
                                            this.updateFairnessScoreOnAssignment(staff.id, availableDay, shiftTime, "Training");
                                        } else {
                                            break; // No more available days for this staff member, exit the while loop
                                        }
                                    }
                                });
                            },

                            /** Generator for 'CBC' shifts with complex role and day prioritization. */
                            generateCbcShifts(tempSchedule) {
                                console.log("Running generateCbcShifts");
                                this.generationErrors.push("Generating CBC shifts...");
                                const cbcRules = this.data.shift_rules["CBC"];
                                const dayPriority = this.data.advanced_rules.day_priority.cbc;
                                const sortedDays = [...this.weekDates]
                                    .filter((d) => cbcRules.days.includes(d.name))
                                    .sort((a, b) => (dayPriority[a.name] ?? 99) - (dayPriority[b.name] ?? 99));

                                const isBaOnly = (staff) => staff.types.length === 1 && staff.types.includes("BA");

                                let maxPasses = 50;
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
                                        const totalDailyMax = this.data.advanced_rules.cbc.dailyMax;
                                        const dailyCBCCount = Object.values(tempSchedule).reduce(
                                            (count, staffShifts) => {
                                                return staffShifts[day.fullDate]?.type === "CBC"
                                                    ? count + 1
                                                    : count;
                                            },
                                            0
                                        );

                                        if (dailyCBCCount >= totalDailyMax) continue;

                                        const cbcStaffOnDay = Object.entries(tempSchedule)
                                            .filter(([, shifts]) => shifts[day.fullDate]?.type === "CBC")
                                            .map(([staffId]) => this.data.staff.find(s => s.id == staffId));

                                        const hasSBPriority = cbcStaffOnDay.some(s => s?.types.includes("SB"));
                                        let candidatePool = [];

                                        // --- STEP 1: Prioritize BA-only staff ---
                                        candidatePool = this.data.staff.filter(s =>
                                            isBaOnly(s) &&
                                            s.availability.shifts.includes("CBC") &&
                                            this.isStaffEligibleForShift(s, day, "10a-7p", tempSchedule) // Use a representative time
                                        );
                                        if (candidatePool.length > 0) {
                                            console.log(`[CBC] on [${day.name}]: Prioritizing BA-only pool.`);
                                        }

                                        // --- STEP 2: If no BA-only, prioritize SB for leadership ---
                                        if (candidatePool.length === 0) {
                                            if (!hasSBPriority) {
                                                candidatePool = this.data.staff.filter(s =>
                                                    s.types.includes("SB") &&
                                                    s.availability.shifts.includes("CBC") &&
                                                    this.isStaffEligibleForShift(s, day, "10a-7p", tempSchedule)
                                                );
                                                if (candidatePool.length > 0) {
                                                    console.log(`[CBC] on [${day.name}]: Prioritizing SB pool.`);
                                                }
                                            }
                                        }

                                        // --- STEP 3: If still no candidate, prioritize other BA staff ---
                                        if (candidatePool.length === 0) {
                                            candidatePool = this.data.staff.filter(s =>
                                                s.types.includes("BA") &&
                                                !isBaOnly(s) && // Exclude BA-only, as they were already checked
                                                s.availability.shifts.includes("CBC") &&
                                                this.isStaffEligibleForShift(s, day, "10a-7p", tempSchedule)
                                            );
                                        }

                                        // --- STEP 4: If still no candidate, create a pool of all B and SB ---
                                        if (candidatePool.length === 0) {
                                            candidatePool = this.data.staff.filter(s =>
                                                (s.types.includes("B") || s.types.includes("SB")) &&
                                                s.availability.shifts.includes("CBC") &&
                                                this.isStaffEligibleForShift(s, day, "10a-7p", tempSchedule)
                                            );
                                        }

                                        if (candidatePool.length > 0) {
                                            const weightedPool = this.createWeightedPool(candidatePool, "cbc");
                                            const candidate = this.selectRandomFromWeightedPool(weightedPool);                                            if (!candidate) continue; // Should not happen if pool has items, but a good guard.

                                            console.log(`[CBC] on [${day.name}]: Selected ${candidate?.name} from a pool of ${candidatePool.length}.`);
                                            const shiftTime = day.name === "Sat" ? "9a-6p" : "10a-7p";
                                            this.assignShift(candidate.id, day.fullDate, shiftTime, "CBC", tempSchedule);
                                            this.updateFairnessScoreOnAssignment(candidate.id, day, shiftTime, "CBC");
                                            assignmentsMadeInPass = true;
                                        }
                                    }
                                    // If we've completed a full loop over every day and made no assignments,
                                    // it means we are stuck. Break the loop to prevent a timeout.
                                    if (totalPasses > sortedDays.length && !assignmentsMadeInPass) {
                                        break;
                                    }
                                } while (assignmentsMadeInPass);
                            },

                            /** Generator for 'Lane VCA' shifts, targeting only staff with the single 'VCA' role. */
                            generateLaneVcaShifts(tempSchedule) {
                                console.log("Running generateLaneVcaShifts");
                                this.generationErrors.push("Generating Lane VCA shifts...");
                                const laneVcaRules = this.data.shift_rules["Lane VCA"];
                                if (!laneVcaRules || !laneVcaRules.daily_requirements) {
                                    this.generationErrors.push("Error: 'Lane VCA' shift rules are not configured.");
                                    return;
                                }
                                const eligibleDays = this.weekDates
                                    .filter(day => (laneVcaRules.daily_requirements[day.name] || 0) > 0)
                                    .sort((a, b) => (this.data.advanced_rules.day_priority.lane[a.name] ?? 99) - (this.data.advanced_rules.day_priority.lane[b.name] ?? 99));

                                // Define candidate pools in order of priority
                                const isVcaOnly = (s) => s.types.length === 1 && s.types.includes("VCA");
                                const isApmVca = (s) => s.types.includes("APM") && s.types.includes("VCA");
                                const isOtherVca = (s) => s.types.includes("VCA") && !isVcaOnly(s) && !isApmVca(s);

                                const candidatePools = [
                                    { name: "VCA-Only", staff: this.data.staff.filter(isVcaOnly) },
                                    { name: "APM-VCA", staff: this.data.staff.filter(isApmVca) },
                                    { name: "Other VCA", staff: this.data.staff.filter(isOtherVca) },
                                ];

                                const otherShiftTimes = Object.entries(this.data.advanced_rules.vca_shift_priority)
                                    .filter(([key, value]) => value > 0) // Filter out shifts with priority 0
                                    .sort(([, a], [, b]) => a - b) // Sort by priority number
                                    .map(([key]) => this.formatRequestTime(key)); // Format to '10a-7p' style

                                for (const day of eligibleDays) {
                                    const requiredCount = laneVcaRules.daily_requirements[day.name] || 0;
                                    let assignedCount = Object.values(tempSchedule).filter(s => s[day.fullDate]?.type === "Lane VCA").length;

                                    const shiftTimesToTry = [
                                        `${this.formatTime(this.data.store_hours[day.name].close - 9)}-${this.formatTime(this.data.store_hours[day.name].close)}`, // Closer is always highest priority
                                        ...otherShiftTimes
                                    ];

                                    // Loop until requirements are met or we can't assign more shifts
                                    let pass = 0;
                                    while(assignedCount < requiredCount && pass < 10) { // Safety break at 10 passes
                                        let assignedInPass = false;
                                        for (const shiftTime of shiftTimesToTry) {
                                            if (assignedCount >= requiredCount) break;

                                            for (const pool of candidatePools) {
                                                if (pool.staff.length === 0) continue;

                                                const candidates = pool.staff.filter(staff => this.isStaffEligibleForShift(staff, day, shiftTime, tempSchedule));
                                                if (candidates.length > 0) {
                                                    const scoreType = shiftTime.includes('9p') ? 'closing' : 'total';
                                                    const weightedPool = this.createWeightedPool(candidates, scoreType, day.name === "Sat");
                                                    const candidate = this.selectRandomFromWeightedPool(weightedPool);
                                                    if (candidate) {
                                                        console.log(`VCA Scheduling on ${day.name} (Pass ${pass + 1}): Assigning ${shiftTime} to ${candidate.name} from pool "${pool.name}"`);
                                                        this.assignShift(candidate.id, day.fullDate, shiftTime, "Lane VCA", tempSchedule);
                                                        this.updateFairnessScoreOnAssignment(candidate.id, day, shiftTime, "Lane VCA");
                                                        assignedCount++;
                                                        assignedInPass = true;
                                                        break; // Break from the pool loop once a candidate is found and assigned
                                                    }
                                                }
                                            }
                                            if (assignedInPass) break; // Break from shift time loop to restart priority
                                        }
                                        pass++;
                                        // If a full pass over all shift types and pools yields no assignment, break to prevent infinite loop
                                        if (!assignedInPass) break;
                                    }
                                }
                            },

                            /** Generator for 'Lane' shifts, with special priority logic for APMs. */
                            generateLaneShifts(tempSchedule) {
                                console.log("Running generateLaneShifts");
                                this.generationErrors.push("Generating Lane shifts based on fairness...");
                                const laneRules = this.data.shift_rules["Lane"];
                                if (!laneRules || laneRules.days.length === 0) {
                                    this.generationErrors.push(
                                        "Error: 'Lane' shift rules are not configured."
                                    );
                                    return;
                                }
                                const sortedLaneDays = this.weekDates
                                    .filter((day) => laneRules.days.includes(day.name))
                                    .sort((a, b) => (this.data.advanced_rules.day_priority.lane[a.name] ?? 99) - (this.data.advanced_rules.day_priority.lane[b.name] ?? 99));

                                // --- Phase 1: Assign a single priority closing shift to an APM ---
                                console.log("Phase 1: Assigning priority closing shift to an APM.");
                                let priorityCloserAssigned = false;
                                const isVcaOnly = (staff) => staff.types.length === 1 && staff.types.includes("VCA");

                                const potentialAssignments = [];
                                const apmStaff = this.data.staff.filter((s) => s.types.includes("APM"));

                                // Create a pool of all possible APM closing shifts for the week
                                for (const apm of apmStaff) {
                                    for (const day of sortedLaneDays) {
                                        const hours = this.data.store_hours[day.name];
                                        const closerShiftTime = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;
                                        if (this.isStaffEligibleForShift(apm, day, closerShiftTime, tempSchedule) && apm.availability.shifts.includes("Lane")) {
                                            const dayPriority = this.data.advanced_rules.day_priority.lane[day.name] ?? 7;
                                            const closingScore = this.fairnessScores[apm.id]?.closing || 0;
                                            const saturdayPenalty = (day.name === 'Sat') ? (this.fairnessScores[apm.id]?.saturday || 0) * this.data.advanced_rules.apm.saturdayClosingPenalty : 0;
                                            const cost = dayPriority + closingScore + saturdayPenalty;
                                            potentialAssignments.push({ apm, day, cost });
                                        }
                                    }
                                }

                                if (potentialAssignments.length > 0) {
                                    // Create a weighted pool where lower cost = higher chance of being selected.
                                    const maxCost = Math.max(...potentialAssignments.map(p => p.cost)) + 1;
                                    const weightedPool = [];
                                    potentialAssignments.forEach(p => {
                                        const weight = Math.ceil(maxCost - p.cost);
                                        for (let i = 0; i < weight; i++) {
                                            weightedPool.push(p);
                                        }
                                    });

                                    const chosenAssignment = this.selectRandomFromWeightedPool(weightedPool);

                                    if (chosenAssignment) {
                                        const { apm, day } = chosenAssignment;
                                        const hours = this.data.store_hours[day.name];
                                        const closerShiftTime = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;
                                        console.log(`[Lane] Assigning priority closer ${apm.name} on ${day.name}.`);
                                        this.assignShift(apm.id, day.fullDate, closerShiftTime, "Lane", tempSchedule);
                                        this.updateFairnessScoreOnAssignment(apm.id, day, closerShiftTime, "Lane");
                                        priorityCloserAssigned = true;
                                    }
                                }
                                if (!priorityCloserAssigned) {
                                    this.generationErrors.push("Warning: Could not assign a priority closing shift to any APM.");
                                }


                                // --- Phase 2: Assign remaining closing shifts first, based on fairness ---
                                console.log("Phase 2: Assigning remaining closing shifts.");
                                for (const day of sortedLaneDays) {
                                    const hours = this.data.store_hours[day.name];
                                    if (!hours || !hours.close) continue;
                                    const closerShiftTime = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;

                                    // Check if a closer is already assigned for this day
                                    const closerAlreadyAssigned = Object.entries(tempSchedule).some(([staffId, shifts]) => {
                                        if (shifts[day.fullDate]?.time === closerShiftTime) {
                                            const staffMember = this.data.staff.find(s => s.id == staffId);
                                            // A closer is considered assigned only if they are NOT a VCA-only role.
                                            return staffMember && !isVcaOnly(staffMember);
                                        }
                                        return false;
                                    });

                                    if (closerAlreadyAssigned) continue;

                                    const hasClosingShift = (staffId) => {
                                        return Object.entries(tempSchedule[staffId] || {}).some(([dateStr, shift]) => {
                                            const dayName = this.daysOfWeek[new Date(dateStr + "T00:00:00").getDay()];
                                            const hours = this.data.store_hours[dayName];
                                            if (!hours || !hours.close) return false;
                                            return shift.time === `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;
                                        });
                                    };

                                    // First, try to find candidates who do NOT have a closing shift yet.
                                    let closerPool = this.data.staff.filter(
                                        (staff) =>
                                            (staff.types.includes("APM") || staff.types.includes("SB") || staff.types.includes("B")) &&
                                            staff.availability.shifts.includes("Lane") && this.isStaffEligibleForShift(staff, day, closerShiftTime, tempSchedule) &&
                                            !isVcaOnly(staff) &&
                                            !hasClosingShift(staff.id)
                                    );

                                    // If no one is left without a closing shift, create a pool of all eligible candidates.
                                    if (closerPool.length === 0) {
                                        console.log(`No closers without a closing shift found for ${day.name}. Expanding pool.`);
                                        closerPool = this.data.staff.filter(
                                            (staff) =>
                                                (staff.types.includes("APM") || staff.types.includes("SB") || staff.types.includes("B")) &&
                                                staff.availability.shifts.includes("Lane") && this.isStaffEligibleForShift(staff, day, closerShiftTime, tempSchedule) &&
                                                !isVcaOnly(staff)
                                        );
                                    }

                                    if (closerPool.length > 0) {
                                        // Apply APM Saturday penalty during pool creation/weighting
                                        const weightedPool = this.createWeightedPool(closerPool, "closing", day.name === "Sat");
                                        const closer = this.selectRandomFromWeightedPool(weightedPool);
                                        if (closer) {
                                            console.log(`[Lane] Assigning closer ${closer.name} on ${day.name}.`);
                                            this.assignShift(
                                                closer.id,
                                                day.fullDate,
                                                closerShiftTime,
                                                "Lane",
                                                tempSchedule
                                            );
                                            // Recalculate scores immediately to affect the next assignment
                                            this.updateFairnessScoreOnAssignment(closer.id, day, closerShiftTime, "Lane");
                                        }
                                    } else {
                                        this.generationErrors.push(`Warning: Could not find an eligible closer for ${day.name}.`);
                                    }
                                }

                                // --- Phase 3: Fill APM schedules with openers, prioritizing low-availability days ---
                                console.log("Phase 3: Assigning APM opening shifts based on coverage needs.");
                                const dayAvailability = this.weekDates.reduce((acc, day) => {
                                    // Correctly check the new availability.hours structure. Blank means available.
                                    acc[day.name] = this.data.staff.filter(s => s.availability?.hours?.[day.name]?.start || s.availability?.hours?.[day.name]?.end).length;
                                    return acc;
                                }, {});

                                for (const apm of apmStaff) {
                                    // The opener shift time needs to be determined for each potential day inside the filter/loop.
                                    let potentialDaysForApm = this.weekDates
                                            .filter(day => {
                                                const hours = this.data.store_hours[day.name];
                                                const openerShiftTime = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
                                                return laneRules.days.includes(day.name) && this.isStaffEligibleForShift(apm, day, openerShiftTime, tempSchedule);
                                            })
                                            .sort((a, b) => dayAvailability[a.name] - dayAvailability[b.name]); // Sort by least available day first

                                    while (this.getShiftCount(apm.id, tempSchedule) < 5 && potentialDaysForApm.length > 0) {
                                        const bestDay = potentialDaysForApm.shift(); // Get and remove the best day from the list
                                        if (!bestDay) break; 

                                        const hours = this.data.store_hours[bestDay.name];
                                        if (hours && hours.open) {
                                            const openerShiftTime = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
                                            const openerAlreadyAssigned = Object.values(tempSchedule).some(s => s[bestDay.fullDate]?.time === openerShiftTime);

                                            if (!openerAlreadyAssigned) {
                                                console.log(`[Lane] Assigning APM opener ${apm.name} to low-coverage day ${bestDay.name}.`);
                                                this.assignShift(apm.id, bestDay.fullDate, openerShiftTime, "Lane", tempSchedule);                                                this.updateFairnessScoreOnAssignment(apm.id, bestDay, openerShiftTime, "Lane");
                                            }
                                        }
                                    }
                                }

                                // --- Phase 4: Assign remaining opening shifts to B/SB roles ---
                                console.log("Phase 4: Assigning remaining opening shifts to B/SB roles.");
                                for (const day of sortedLaneDays) {
                                    const hours = this.data.store_hours[day.name];
                                    if (!hours || !hours.open) continue;
                                    const openerShiftTime = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
                                    const openerAlreadyAssigned = Object.values(tempSchedule).some(s => s[day.fullDate]?.time === openerShiftTime);
                                    if (openerAlreadyAssigned) continue;

                                    const bsOpenerPool = this.data.staff.filter(staff =>
                                        (staff.types.includes("B") || staff.types.includes("SB")) &&
                                        staff.availability.shifts.includes("Lane") &&
                                        this.isStaffEligibleForShift(staff, day, openerShiftTime, tempSchedule) &&
                                        !isVcaOnly(staff)
                                    );

                                    if (bsOpenerPool.length > 0) {
                                        const weightedPool = this.createWeightedPool(bsOpenerPool, "opening", false);
                                        const opener = this.selectRandomFromWeightedPool(weightedPool);
                                        if (opener) {
                                            console.log(`[Lane] Assigning B/SB opener ${opener.name} on ${day.name}.`);
                                            this.assignShift(opener.id, day.fullDate, openerShiftTime, "Lane", tempSchedule);                                            this.updateFairnessScoreOnAssignment(opener.id, day, openerShiftTime, "Lane");
                                        }
                                    }
                                }
                            },

                            // =================================================================================
                            // VALIDATION & WARNINGS
                            // =================================================================================
                            /**
                             * Runs a series of checks on the generated schedule to find potential issues.
                             * @param {object} scheduleContext - The temporary schedule object to validate.
                             */
                            validateSchedule(scheduleContext) {
                                // Helper to get staff member from ID, with caching
                                const staffCache = new Map();
                                const getStaff = (id) => {
                                    if (staffCache.has(id)) return staffCache.get(id);
                                    const staff = this.data.staff.find((s) => s.id == id);
                                    if (staff) staffCache.set(id, staff);
                                    return staff;
                                };

                                // Helper to check if a shift is a closing shift
                                const isClosingShift = (shift, dayName) => {
                                    const hours = this.data.store_hours[dayName];
                                    if (!hours || !hours.close) return false;
                                    const closerShiftTime = `${this.formatTime(
                                        hours.close - 9
                                    )}-${this.formatTime(hours.close)}`;
                                    return shift.time === closerShiftTime;
                                };
                                const warnings = new Set();
                                const dailyTallies = {};

                                // Pre-calculate daily tallies for all roles and shift types
                                this.weekDates.forEach((day) => {
                                    dailyTallies[day.fullDate] = { opener: false, closer: false };
                                    this.shiftTypes.forEach(st => {
                                        dailyTallies[day.fullDate][st] = {};
                                        this.staffTypes.forEach(rt => {
                                            dailyTallies[day.fullDate][st][rt] = 0;
                                        });
                                    });

                                    for (const staffId in scheduleContext) {
                                        const shift = scheduleContext[staffId][day.fullDate];
                                        if (!shift) continue;
                                        const staffMember = getStaff(staffId);
                                        if (!staffMember) continue;

                                        // Tally roles for this shift type
                                        staffMember.types.forEach(role => {
                                            if (dailyTallies[day.fullDate][shift.type]?.[role] !== undefined) {
                                                dailyTallies[day.fullDate][shift.type][role]++;
                                            }
                                        });

                                        // Check for opener/closer presence
                                        const hours = this.data.store_hours[day.name];
                                        if (hours && hours.open && hours.close) {
                                            const openerShiftTime = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
                                            const closerShiftTime = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;
                                            if (shift.time === openerShiftTime) dailyTallies[day.fullDate].opener = true;
                                            if (shift.time === closerShiftTime) dailyTallies[day.fullDate].closer = true;
                                        }
                                    }
                                });

                                // --- Run Validation Checks ---

                                // Check 1: Min/Max requirements from shift rules
                                this.weekDates.forEach(day => {
                                    this.shiftTypes.forEach(shiftType => {
                                        const rule = this.data.shift_rules[shiftType];
                                        if (!rule || !rule.days.includes(day.name)) return;

                                        this.staffTypes.forEach(roleType => {
                                            const min = rule.min_max[roleType]?.min;
                                            const max = rule.min_max[roleType]?.max;
                                            const actual = dailyTallies[day.fullDate]?.[shiftType]?.[roleType] || 0;

                                            if (min !== null && actual < min) {
                                                warnings.add(`Warning for ${day.name}: ${this.getShiftTypeName(shiftType)} requires at least ${min} ${this.getRoleName(roleType)}, but found ${actual}.`);
                                            }
                                            if (max !== null && actual > max) {
                                                warnings.add(`Warning for ${day.name}: ${this.getShiftTypeName(shiftType)} has a max of ${max} ${this.getRoleName(roleType)}, but found ${actual}.`);
                                            }
                                        });
                                    });
                                });

                                // Check 2: Missing Openers/Closers on Lane days
                                this.weekDates.forEach(day => {
                                    const isLaneDay = this.data.shift_rules["Lane"]?.days.includes(day.name);
                                    if (!isLaneDay) return;

                                    const hasAnyOpener = Object.values(scheduleContext).some(s => {
                                        const shift = s[day.fullDate];
                                        if (!shift) return false;
                                        const hours = this.data.store_hours[day.name];
                                        const openerShiftTime = `${this.formatTime(hours.open)}-${this.formatTime(hours.open + 9)}`;
                                        return shift.time === openerShiftTime;
                                    });

                                    const hasAnyCloser = Object.values(scheduleContext).some(s => {
                                        const shift = s[day.fullDate];
                                        if (!shift) return false;
                                        const hours = this.data.store_hours[day.name];
                                        const closerShiftTime = `${this.formatTime(hours.close - 9)}-${this.formatTime(hours.close)}`;
                                        return shift.time === closerShiftTime;
                                    });

                                    if (hasAnyOpener && !dailyTallies[day.fullDate].opener) {
                                        // This case is implicitly handled by the min/max check, but could be a specific warning if needed.
                                    }
                                    if (!hasAnyCloser) {
                                        warnings.add(`Warning for ${day.name}: Day is missing a closer.`);
                                    }
                                });


                                // Check 3: APM Closing Shift Requirement
                                const apmsOnStaff = this.data.staff.filter((staff) =>
                                    staff.types.includes("APM")
                                );
                                apmsOnStaff.forEach((apm) => {
                                    const closerCount = this.countApmClosingShifts(scheduleContext, apm.id);
                                    const required = this.data.advanced_rules.apm.minClosingShifts;
                                    if (closerCount < required) {
                                        warnings.add(
                                            `Warning: APM ${apm.name} requires ${required} closing shift(s), but has ${closerCount}.`
                                        );
                                    }
                                });

                                // Append warnings to the generation log
                                if (warnings.size > 0) {
                                    this.generationErrors.push("--- VALIDATION WARNINGS ---");
                                    warnings.forEach((w) => this.generationErrors.push(w));
                                }
                            },

                            // =================================================================================
                            // FAIRNESS & ELIGIBILITY HELPERS
                            // =================================================================================

                            /**
                             * Calculates a "fairness score" for each staff member based on the last 4 weeks of schedules.
                             * Higher scores mean the staff member has worked more of a certain type of shift recently.
                             * Weekend shifts are weighted more heavily.
                             */
                            calculateFairnessScores(scheduleContext = null) {
                                const scores = {};
                                const currentWeekKey = this.weekDates[0].fullDate;
                                const today = new Date(currentWeekKey);

                                this.data.staff.forEach((staff) => {
                                    const staffScore = {
                                        total: 0,
                                        closing: 0,
                                        opening: 0,
                                        cbc: 0,
                                        saturday: 0,
                                        byDay: {},
                                    };
                                    this.daysOfWeek.forEach((dayName) => {
                                        staffScore.byDay[dayName] = { closing: 0, opening: 0, mid: 0 };
                                    });

                                    // --- Part 1: Tally past 4 weeks from saved data ---
                                    for (let i = 0; i < 4; i++) {
                                        const weekStartDate = new Date(today);
                                        weekStartDate.setDate(weekStartDate.getDate() - i * 7);
                                        // We want to look at weeks *before* the current one
                                        const weekKey = this.getWeekKeyForDate(weekStartDate.toISOString().split("T")[0]);
                                        const scheduleToTally = this.data.schedules[weekKey];

                                        if (scheduleToTally && scheduleToTally[staff.id]) {
                                            for (const dateStr in scheduleToTally[staff.id]) {
                                                const shift = scheduleToTally[staff.id][dateStr];
                                                if (shift.type === "OFF") continue;

                                                const date = new Date(dateStr + "T00:00:00");
                                                const dayOfWeek = date.getDay();
                                                const dayName = this.daysOfWeek[dayOfWeek];
                                                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;                                                const weight = isWeekend ? 1.5 : 1; // Weekends have higher weight

                                                // Tally specific shift types
                                                if (shift.type === "CBC") staffScore.cbc += weight;
                                                if (dayOfWeek === 6) { // Saturday
                                                    staffScore.saturday += 1;
                                                }

                                                // Tally opening/closing
                                                const storeHours = this.data.store_hours[dayName];
                                                if (storeHours && storeHours.open && storeHours.close) {
                                                    const openerShiftTime = `${this.formatTime(
                                                        storeHours.open
                                                    )}-${this.formatTime(storeHours.open + 9)}`;
                                                    const closerShiftTime = `${this.formatTime(
                                                        storeHours.close - 9
                                                    )}-${this.formatTime(storeHours.close)}`;

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

                                    // --- Part 2: Tally the current week being generated (if provided) with higher weight ---
                                    if (scheduleContext && scheduleContext[staff.id]) {
                                        const currentWeekWeightMultiplier = 2.0; // Shifts in the current week count more

                                        for (const dateStr in scheduleContext[staff.id]) {
                                            const shift = scheduleContext[staff.id][dateStr];
                                            if (shift.type === "OFF") continue;

                                            const date = new Date(dateStr + "T00:00:00");
                                            const dayOfWeek = date.getDay();
                                            const dayName = this.daysOfWeek[dayOfWeek];
                                            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                            const weight = (isWeekend ? 1.5 : 1) * currentWeekWeightMultiplier;

                                            if (shift.type === "CBC") staffScore.cbc += weight;
                                            if (dayOfWeek === 6) { // Saturday
                                                staffScore.saturday += 1 * currentWeekWeightMultiplier;
                                            }

                                            const storeHours = this.data.store_hours[dayName];
                                            if (storeHours && storeHours.open && storeHours.close) {
                                                const openerShiftTime = `${this.formatTime(
                                                    storeHours.open
                                                )}-${this.formatTime(storeHours.open + 9)}`;
                                                const closerShiftTime = `${this.formatTime(
                                                    storeHours.close - 9
                                                )}-${this.formatTime(storeHours.close)}`;

                                                if (shift.time === openerShiftTime) {
                                                    staffScore.opening += weight;
                                                } else if (shift.time === closerShiftTime) {
                                                    staffScore.closing += weight;
                                                }
                                            }
                                        }
                                    }

                                    scores[staff.id] = staffScore;
                                });

                                this.fairnessScores = scores;
                                // This log is very useful for debugging fairness.
                                console.log("Fairness scores calculated:", this.fairnessScores);
                            },

                            /**
                             * Updates a staff member's fairness score in real-time as a shift is assigned during generation.
                             * @param {number} staffId
                             * @param {object} day
                             * @param {string} time
                             * @param {string} type
                             */
                            updateFairnessScoreOnAssignment(staffId, day, time, type) {
                                if (!this.fairnessScores[staffId]) return; // Safety check

                                const staffScore = this.fairnessScores[staffId];
                                const dayName = day.name;
                                const isWeekend = day.name === "Sun" || day.name === "Sat";                                const currentWeekWeightMultiplier = 2.0; // Match the weight from the main calculation
                                const weight = (isWeekend ? 1.5 : 1) * currentWeekWeightMultiplier;

                                staffScore.total += weight;
                                if (type === "CBC") staffScore.cbc += weight;
                                if (day.name === "Sat") staffScore.saturday += 1 * currentWeekWeightMultiplier;

                                const storeHours = this.data.store_hours[dayName];
                                if (storeHours && storeHours.open && storeHours.close) {
                                    const openerShiftTime = `${this.formatTime(
                                        storeHours.open
                                    )}-${this.formatTime(storeHours.open + 9)}`;
                                    const closerShiftTime = `${this.formatTime(
                                        storeHours.close - 9
                                    )}-${this.formatTime(storeHours.close)}`;

                                    if (time === openerShiftTime) {
                                        staffScore.opening += weight;
                                    } else if (time === closerShiftTime) {
                                        staffScore.closing += weight;
                                    }
                                }
                                // No need to log here, it would be too noisy during generation.
                            },

                            /**
                             * Creates a "weighted" array of candidates. Staff with lower fairness scores appear more
                             * times in the array, increasing their chances of being selected randomly.
                             * @param {Array} pool - The array of candidate staff objects.
                             * @param {string} scoreType - The fairness score to use for weighting (e.g., 'closing', 'cbc').
                             * @returns {Array} A new array with duplicated candidates based on weight.
                             */
                            createWeightedPool(pool, scoreType, isSaturday = false) {
                                if (pool.length === 0) return [];

                                // Calculate scores with penalties before finding the max score
                                const poolWithScores = pool.map(p => {
                                    let score = this.fairnessScores[p.id]?.[scoreType] || 0;
                                    // Apply APM Saturday closing penalty
                                    if (p.types.includes("APM") && scoreType === 'closing' && isSaturday) {
                                        score += (this.fairnessScores[p.id]?.saturday || 0) * this.data.advanced_rules.apm.saturdayClosingPenalty;
                                    }
                                    return { staff: p, score: score };
                                });

                                const maxScore = Math.max(...poolWithScores.map(p => p.score)) + 1;

                                const weightedPool = [];
                                poolWithScores.forEach((p) => {
                                    const { staff, score } = p;
                                    const weight = Math.ceil(maxScore - score); // Higher weight for lower scores
                                    for (let i = 0; i < weight; i++) {
                                        weightedPool.push(staff);
                                    }
                                });
                                return weightedPool;
                            },

                            /**
                             * Selects a random item from a weighted pool created by `createWeightedPool`.
                             * @param {Array} weightedPool - The weighted array of candidates.
                             * @returns {object|null} The selected staff member object, or null if the pool is empty.
                             */
                            selectRandomFromWeightedPool(weightedPool) {
                                if (weightedPool.length === 0) return null;
                                const randomIndex = Math.floor(Math.random() * weightedPool.length);
                                return weightedPool[randomIndex];
                            },

                            /**
                             * A generic check to see if a staff member can be assigned ANY shift on a given day.
                             * @param {object} staff - The staff member object.
                             * @param {object} day - The day object from `weekDates`.
                             * @param {object} scheduleContext - The temporary schedule object.
                             * @returns {boolean}
                             */
                            isStaffEligibleForShift(staff, day, proposedShiftTime, scheduleContext) {
                                console.groupCollapsed(`[isStaffEligibleForShift] Checking ${staff.name} for ${day.name} (${proposedShiftTime})`);
                                const existingShift = scheduleContext[staff.id]?.[day.fullDate];
                                const shiftCount = this.getShiftCount(staff.id, scheduleContext);

                                // --- Disqualifying Checks ---
                                if (existingShift) {
                                    console.log(` -> Ineligible: Already has a shift on this day.`);
                                    console.groupEnd();
                                    return false;
                                }

                                if (shiftCount >= 5) {
                                    console.log(` -> Ineligible: Already has ${shiftCount} shifts this week.`);
                                    console.groupEnd();
                                    return false;
                                }

                                if (this.isStaffOnTimeOff(staff.id, day.fullDate)) {
                                    console.log(` -> Ineligible: Has an approved time-off request.`);
                                    console.groupEnd();
                                    return false;
                                }

                                // New availability check
                                const availability = this.getAdjustedShiftForAvailability(staff, day, proposedShiftTime);
                                if (!availability.isAvailable) {
                                    console.log(` -> Ineligible: Not available during the proposed shift time.`);
                                    console.groupEnd();
                                    return false;
                                }
                                console.log(` -> Eligible: All checks passed.`);
                                console.groupEnd();
                                return availability.isAvailable;
                            },

                            /**
                             * Checks staff availability for a proposed shift and returns an adjusted shift time.
                             * @param {object} staff - The staff member object.
                             * @param {object} day - The day object from `weekDates`.
                             * @param {string} proposedShiftTime - The shift time to check, e.g., "9a-5p".
                             * @returns {{isAvailable: boolean, adjustedTime: string}}
                             */
                            getAdjustedShiftForAvailability(staff, day, proposedShiftTime) {
                                const availability = staff.availability?.hours?.[day.name];
                                // If availability hours are blank for the day, assume they are available for the entire proposed shift.
                                if (!availability || !availability.start || !availability.end) {
                                    return { isAvailable: true, adjustedTime: proposedShiftTime };
                                }

                                const parseTime = (timeStr) => {
                                    if (!timeStr) return NaN;
                                    let hour = parseInt(timeStr.replace(/(a|p)m?/, ""));
                                    if (isNaN(hour)) return NaN;
                                    if (timeStr.includes("p") && hour !== 12) hour += 12;
                                    if (timeStr.includes("a") && hour === 12) hour = 0; // Midnight case
                                    return hour;
                                };

                                const availStart = parseTime(availability.start);
                                const availEnd = parseTime(availability.end);

                                const shiftParts = proposedShiftTime.split('-');
                                if (shiftParts.length !== 2) return { isAvailable: false, adjustedTime: proposedShiftTime };

                                let shiftStart = parseTime(shiftParts[0]);
                                let shiftEnd = parseTime(shiftParts[1]);

                                if (isNaN(availStart) || isNaN(availEnd) || isNaN(shiftStart) || isNaN(shiftEnd)) {
                                    return { isAvailable: false, adjustedTime: proposedShiftTime };
                                }

                                // Calculate the new, overlapping shift time
                                const newStart = Math.max(availStart, shiftStart);
                                const newEnd = Math.min(availEnd, shiftEnd);

                                // The shift is valid if the new duration is at least 1 hour
                                if (newEnd > newStart) {
                                    return {
                                        isAvailable: true,
                                        adjustedTime: `${this.formatTime(newStart)}-${this.formatTime(newEnd)}`
                                    };
                                }

                                return { isAvailable: false, adjustedTime: proposedShiftTime };
                            },






                            /**
                             * Checks if a staff member has an approved 'Off' request for a specific date.
                             * @param {number} staffId
                             * @param {string} checkDateStr - YYYY-MM-DD
                             * @returns {boolean}
                             */
                            isStaffOnTimeOff(staffId, checkDateStr) {
                                const checkDate = new Date(checkDateStr + "T00:00:00"); // Normalize time
                                for (const request of this.data.time_off) {
                                    // Only consider "Off" requests as true time off for generation purposes.
                                    // Specific shift requests are pre-assignments, not unavailability.
                                    if (request.staffId === staffId && request.requestType === "Off") {
                                        const startDate = new Date(request.startDate + "T00:00:00");
                                        const endDate = new Date(request.endDate + "T00:00:00");
                                        if (checkDate >= startDate && checkDate <= endDate) {
                                            return true;
                                        }
                                    }
                                }
                                return false;
                            },

                            // =================================================================================
                            // UTILITY & FORMATTING HELPERS
                            // =================================================================================

                            /**
                             * Gets the appropriate background color class for a shift object.
                             * @param {object} shift - The shift object { time, type, locked }.
                             * @returns {string} The Tailwind CSS background class.
                             */
                            getShiftColorClass(shift) {
                                if (!shift) return "";
                                const offsiteTypes = ["BAAA", "BAAA Preview", "MNJ", "MPA"];

                                if (shift.type === "Offer") return "bg-green-200";
                                if (shift.type === "CBC") return "bg-blue-200";
                                if (shift.type === "Training") return "bg-red-200";
                                if (offsiteTypes.includes(shift.type)) return "bg-gray-300";
                                return "";
                            },
                            /**
                             * Gets the appropriate background color class for a shift cell.
                             * @param {number} staffId
                             * @param {string} fullDate - YYYY-MM-DD
                             * @returns {string} The Tailwind CSS background class.
                             */
                            getShiftCellClass(staffId, fullDate) {
                                const shift = this.schedule[staffId]?.[fullDate];
                                return this.getShiftColorClass(shift);
                            },

                            /**
                             * Centralized function to assign a shift to the temporary schedule object.
                             * @param {number} staffId
                             * @param {string} fullDate - YYYY-MM-DD
                             * @param {string} time - e.g., "9a-5p"
                             * @param {string} type - e.g., "Lane"
                             * @param {object} scheduleContext - The temporary schedule object.
                             */
                            assignShift(staffId, fullDate, time, type, scheduleContext) {
                                const staff = this.data.staff.find(s => s.id == staffId);
                                const day = this.weekDates.find(d => d.fullDate === fullDate);
                                const { adjustedTime } = this.getAdjustedShiftForAvailability(staff, day, time);
                                if (!scheduleContext[staffId]) scheduleContext[staffId] = {};
                                scheduleContext[staffId][fullDate] = { time: adjustedTime, type, locked: false };
                            },

                            /**
                             * Parses the store hours text (e.g., "9a-9p") into numeric open/close hours.
                             * @param {string} dayName - The name of the day (e.g., "Mon").
                             */
                            parseHours(dayName) {
                                const text = this.data.store_hours[dayName].text
                                    .toLowerCase()
                                    .replace(/\s/g, "");
                                const parts = text.split("-");
                                if (parts.length !== 2) return;

                                const parseTime = (timeStr) => {
                                    let hour = parseInt(timeStr.replace(/(a|p)m?/, ""));
                                    if (isNaN(hour)) return NaN;
                                    if (timeStr.includes("p") && hour !== 12) hour += 12;
                                    if (timeStr.includes("a") && hour === 12) hour = 0; // Midnight case
                                    return hour;
                                };

                                const openHour = parseTime(parts[0]);
                                const closeHour = parseTime(parts[1]);

                                if (!isNaN(openHour) && !isNaN(closeHour)) {
                                    this.data.store_hours[dayName].open = openHour;
                                    this.data.store_hours[dayName].close = closeHour;
                                }
                            },

                            /**
                             * Formats a 24-hour number into a "12a" or "1p" style string.
                             * @param {number} hour
                             * @returns {string}
                             */
                            formatTime(hour) {
                                hour = parseInt(hour, 10);
                                if (isNaN(hour)) return "";
                                if (hour === 0) return "12a";
                                if (hour === 12) return "12p";
                                if (hour < 12) return `${hour}a`;
                                if (hour > 23) return `${hour - 12}p`; // Handle cases like 24 for midnight
                                return `${hour - 12}p`;
                            },

                            /**
                             * Formats a request type from the time-off form into a standard shift time string.
                             * @param {string} requestType - e.g., "8-5"
                             * @returns {string} e.g., "8a-5p"
                             */
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

                            /**
                             * Gets the week's starting date (key) for any given date string.
                             * @param {string} dateStr - YYYY-MM-DD
                             * @returns {string} The YYYY-MM-DD string of the Sunday of that week.
                             */
                            getWeekKeyForDate(dateStr) {
                                // Use UTC dates to prevent timezone-related off-by-one errors.
                                const [year, month, day] = dateStr.split('-').map(Number);
                                const date = new Date(Date.UTC(year, month - 1, day));
                                const dayOfWeek = date.getUTCDay(); // 0 for Sunday, 1 for Monday, etc.
                                date.setUTCDate(date.getUTCDate() - dayOfWeek);
                                return date.toISOString().split('T')[0];
                            },

                            /**
                             * Generates an array of week date objects for a given week's starting key.
                             * @param {string} weekKey - The YYYY-MM-DD string of the Sunday of the week.
                             * @returns {Array} An array of 7 day objects.
                             */
getWeekDatesFor(weekKey) {
    // Create a pure UTC date object from the start-of-week key.
    const startDate = new Date(weekKey + 'T00:00:00Z'); 
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        // Explicitly use setUTCDate() to modify the date in UTC.
        d.setUTCDate(d.getUTCDate() + i); 
        dates.push({
            name: this.daysOfWeek[i],
            // Use getUTCMonth() and getUTCDate() to get the correct values.
            date: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
            fullDate: d.toISOString().split("T")[0]
        });
    }
    return dates;
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
