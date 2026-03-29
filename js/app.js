/**
 * Wheaton Family Practice Vacation Portal
 * Main application logic using Alpine.js
 */

function app() {
    return {
        // --- Auth State ---
        authenticated: false,
        doctorName: '',
        doctors: [],
        password: '',
        showPassword: false,
        loginError: '',
        loginLoading: false,
        configPassword: '',

        // --- Calendar State ---
        calendar: null,
        calendarTitle: '',
        pendingDates: [],
        submittedDates: [],
        submitting: false,
        submitMessage: '',
        submitMessageType: '',

        // --- Config ---
        cutoffDate: null,

        // --- Heatmap ---
        allVacations: [],
        heatmapData: {},

        // --- Holidays ---
        holidays: {},  // { "2026-05-25": "Memorial Day", ... }

        // --- Lifecycle ---
        async init() {
            // Wait for database to be ready (module script may still be loading)
            while (!window._dbReady) {
                await new Promise(r => setTimeout(r, 50));
            }
            await window._dbReady;

            // Load config and doctors list
            try {
                const config = await window.db.getConfig();
                this.configPassword = config.password || '';
                this.cutoffDate = config.cutoffDate || null;

                const docs = await window.db.getDoctors();
                this.doctors = docs;
            } catch (e) {
                console.error("[Portal] Failed to load initial data:", e);
            }

            // Check for existing session
            const session = sessionStorage.getItem('portal_doctor');
            if (session) {
                this.doctorName = session;
                this.authenticated = true;
                // Defer calendar init until DOM is ready
                this.$nextTick(() => this.initCalendar());
            }
        },

        // --- Auth Methods ---
        async login() {
            this.loginError = '';
            this.loginLoading = true;

            try {
                if (!this.doctorName) {
                    this.loginError = 'Please select your name.';
                    return;
                }

                if (!this.password) {
                    this.loginError = 'Please enter the practice password.';
                    return;
                }

                if (this.password !== this.configPassword) {
                    this.loginError = 'Incorrect password. Please try again.';
                    this.password = '';
                    return;
                }

                // Success
                sessionStorage.setItem('portal_doctor', this.doctorName);
                this.authenticated = true;
                this.password = '';
                this.loginError = '';

                // Init calendar after login transition
                this.$nextTick(() => this.initCalendar());
            } finally {
                this.loginLoading = false;
            }
        },

        logout() {
            sessionStorage.removeItem('portal_doctor');
            this.authenticated = false;
            this.doctorName = '';
            this.password = '';
            this.pendingDates = [];
            this.submittedDates = [];
            if (this.calendar) {
                this.calendar.destroy();
                this.calendar = null;
            }
        },

        // --- Calendar Methods ---
        async initCalendar() {
            if (this.calendar) return;

            // Poll until the calendar element is in the DOM and visible (has width)
            await new Promise(resolve => {
                const check = () => {
                    const el = document.getElementById('calendar-el');
                    if (el && el.offsetWidth > 0) resolve();
                    else requestAnimationFrame(check);
                };
                check();
            });

            // Load submitted dates, all vacations for heatmap, and holidays
            await this.loadSubmittedDates();
            await this.loadAllVacations();
            await this.loadHolidays();

            // Store Alpine's reactive proxy reference
            const alpine = this;
            this.calendar = new FullCalendar.Calendar(document.getElementById('calendar-el'), {
                initialView: 'multiMonthYear',
                headerToolbar: false,
                height: 'auto',
                multiMonthMaxColumns: 3,
                fixedWeekCount: false,
                selectable: true,
                unselectAuto: true,
                selectMirror: true,
                dayMaxEvents: false,

                // Handles both single clicks and drag-to-select
                select: function(info) {
                    // info.start is inclusive, info.end is exclusive
                    const start = new Date(info.start);
                    const end = new Date(info.end);

                    // Calculate how many days in selection
                    const dayCount = Math.round((end - start) / (1000 * 60 * 60 * 24));

                    if (dayCount === 1) {
                        // Single day click — toggle behavior
                        const dateStr = start.toISOString().split('T')[0];
                        if (alpine.submittedDates.includes(dateStr)) {
                            // Don't toggle submitted dates
                        } else {
                            const currentPending = [...alpine.pendingDates];
                            const idx = currentPending.indexOf(dateStr);
                            if (idx >= 0) {
                                currentPending.splice(idx, 1);
                            } else {
                                currentPending.push(dateStr);
                                currentPending.sort();
                            }
                            alpine.pendingDates = currentPending;
                        }
                    } else {
                        // Multi-day drag — add all dates in range
                        const current = new Date(start);
                        const newDates = [];
                        while (current < end) {
                            const dateStr = current.toISOString().split('T')[0];
                            if (!alpine.pendingDates.includes(dateStr) &&
                                !alpine.submittedDates.includes(dateStr)) {
                                newDates.push(dateStr);
                            }
                            current.setDate(current.getDate() + 1);
                        }
                        alpine.pendingDates = [...alpine.pendingDates, ...newDates].sort();
                    }

                    alpine.renderCalendarEvents();
                },

                // Add info icon to heatmap days and holiday tooltips
                dayCellDidMount: function(arg) {
                    alpine.addHeatmapTooltip(arg.el, arg.date);
                    alpine.addHolidayPill(arg.el, arg.date);
                },

                events: []
            });

            this.calendar.render();
            // Defer title read until after FullCalendar finishes rendering
            await new Promise(r => setTimeout(r, 100));
            this.calendarTitle = this.calendar.view.title || '';
            this.renderCalendarEvents();
        },

        // --- Custom Calendar Navigation ---
        updateCalendarTitle() {
            if (!this.calendar) return;
            this.calendarTitle = this.calendar.view.title;
        },

        calendarPrev() {
            if (!this.calendar) return;
            this.calendar.prev();
            this.updateCalendarTitle();
        },

        calendarNext() {
            if (!this.calendar) return;
            this.calendar.next();
            this.updateCalendarTitle();
        },

        calendarToday() {
            if (!this.calendar) return;
            this.calendar.today();
            this.updateCalendarTitle();
        },

        async loadSubmittedDates() {
            try {
                const vacations = await window.db.getVacations(this.doctorName);
                this.submittedDates = vacations.map(v => v.date).sort();
            } catch (e) {
                console.error("[Portal] Failed to load submitted dates:", e);
            }
        },

        async loadAllVacations() {
            try {
                const all = await window.db.getVacations();
                // Group by date, excluding current doctor
                this.heatmapData = {};
                for (const v of all) {
                    if (v.doctor === this.doctorName) continue;
                    if (!this.heatmapData[v.date]) {
                        this.heatmapData[v.date] = [];
                    }
                    this.heatmapData[v.date].push(v.doctor);
                }
            } catch (e) {
                console.error("[Portal] Failed to load all vacations:", e);
                this.heatmapData = {};
            }
        },

        // Short display names for calendar pills
        holidayShortNames: {
            "Independence Day": "July 4th",
            "Thanksgiving Day": "Thanksgiving",
        },

        async loadHolidays() {
            try {
                const holidays = await window.db.getHolidays();
                this.holidays = {};
                for (const h of holidays) {
                    this.holidays[h.date] = this.holidayShortNames[h.name] || h.name;
                }
            } catch (e) {
                console.error("[Portal] Failed to load holidays:", e);
                this.holidays = {};
            }
        },

        addHolidayPill(cellEl, date) {
            const dateStr = date.toISOString().split('T')[0];
            const holidayName = this.holidays[dateStr];
            if (!holidayName) return;

            const pill = document.createElement('div');
            pill.className = 'holiday-pill';
            pill.textContent = holidayName;

            const eventsContainer = cellEl.querySelector('.fc-daygrid-day-events');
            if (eventsContainer) {
                eventsContainer.prepend(pill);
            }
        },

        getHeatmapColor(count) {
            if (count >= 3) return 'rgba(229, 57, 53, 0.25)';
            if (count === 2) return 'rgba(255, 183, 77, 0.35)';
            if (count === 1) return 'rgba(255, 243, 205, 0.6)';
            return 'transparent';
        },

        addHeatmapTooltip(cellEl, date) {
            const dateStr = date.toISOString().split('T')[0];
            const doctors = this.heatmapData[dateStr];
            if (!doctors || doctors.length === 0) return;

            // Remove any existing tooltip icon
            const existing = cellEl.querySelector('.heatmap-info');
            if (existing) existing.remove();

            // Create info icon
            const icon = document.createElement('span');
            icon.className = 'heatmap-info';
            icon.textContent = 'ℹ️';
            icon.title = `${doctors.length} colleague(s) off:\n${doctors.join(', ')}`;

            // Create tooltip for hover
            const tooltip = document.createElement('div');
            tooltip.className = 'heatmap-tooltip';
            const strong = document.createElement('strong');
            strong.textContent = `${doctors.length} off: `;
            tooltip.appendChild(strong);
            tooltip.appendChild(document.createTextNode(doctors.join(', ')));

            icon.addEventListener('mouseenter', () => {
                tooltip.classList.add('visible');
            });
            icon.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });

            const container = document.createElement('div');
            container.className = 'heatmap-info-container';
            container.appendChild(icon);
            container.appendChild(tooltip);

            // Append to the day cell's content area
            const dayFrame = cellEl.querySelector('.fc-daygrid-day-frame');
            if (dayFrame) {
                dayFrame.appendChild(container);
            }
        },

        renderCalendarEvents() {
            if (!this.calendar) return;

            // Remove all existing events
            this.calendar.removeAllEvents();

            // Add heatmap background events
            if (this.heatmapData) {
                for (const [dateStr, doctors] of Object.entries(this.heatmapData)) {
                    this.calendar.addEvent({
                        start: dateStr,
                        allDay: true,
                        display: 'background',
                        backgroundColor: this.getHeatmapColor(doctors.length),
                        classNames: ['heatmap-bg'],
                        extendedProps: { heatmapDoctors: doctors }
                    });
                }
            }

            // Add submitted dates (green)
            for (const dateStr of this.submittedDates) {
                this.calendar.addEvent({
                    title: 'Vacation',
                    start: dateStr,
                    allDay: true,
                    display: 'block',
                    backgroundColor: '#34a853',
                    borderColor: '#2d9249',
                    classNames: ['event-submitted']
                });
            }

            // Add pending dates (blue)
            for (const dateStr of this.pendingDates) {
                this.calendar.addEvent({
                    title: 'Pending',
                    start: dateStr,
                    allDay: true,
                    display: 'block',
                    backgroundColor: '#4285f4',
                    borderColor: '#3b78e7',
                    classNames: ['event-pending']
                });
            }
        },

        toggleDate(dateStr) {
            // Don't toggle submitted dates here (handled by delete flow)
            if (this.submittedDates.includes(dateStr)) return;

            const idx = this.pendingDates.indexOf(dateStr);
            if (idx >= 0) {
                this.pendingDates.splice(idx, 1);
            } else {
                this.pendingDates.push(dateStr);
                this.pendingDates.sort();
            }
        },

        removePendingDate(dateStr) {
            this.pendingDates = this.pendingDates.filter(d => d !== dateStr);
            this.renderCalendarEvents();
        },

        clearPendingDates() {
            this.pendingDates = [];
            this.renderCalendarEvents();
        },

        async submitDates() {
            if (this.pendingDates.length === 0 || this.submitting) return;

            this.submitting = true;
            this.submitMessage = '';

            try {
                let added = 0;
                let duplicates = 0;

                for (const dateStr of this.pendingDates) {
                    const result = await window.db.addVacation({
                        doctor: this.doctorName,
                        date: dateStr,
                        status: 'Pending'
                    });
                    if (result.added) {
                        added++;
                    } else if (result.duplicate) {
                        duplicates++;
                    }
                }

                // Move pending to submitted
                this.submittedDates = [
                    ...this.submittedDates,
                    ...this.pendingDates
                ].sort();
                this.pendingDates = [];

                // Show success message
                let msg = `${added} vacation day(s) submitted!`;
                if (duplicates > 0) {
                    msg += ` (${duplicates} duplicate(s) skipped)`;
                }
                this.submitMessage = msg;
                this.submitMessageType = 'success';

                this.renderCalendarEvents();

                // Clear message after 5 seconds
                setTimeout(() => { this.submitMessage = ''; }, 5000);
            } catch (e) {
                console.error("[Portal] Submit failed:", e);
                this.submitMessage = 'Failed to submit. Please try again.';
                this.submitMessageType = 'error';
            } finally {
                this.submitting = false;
            }
        },

        // --- Date Management ---
        async deleteSubmittedDate(dateStr) {
            if (!this.isBeforeCutoff()) return;
            if (!confirm(`Remove ${this.formatDate(dateStr)} from your vacation dates?`)) return;

            try {
                await window.db.deleteVacation(this.doctorName, dateStr);
                this.submittedDates = this.submittedDates.filter(d => d !== dateStr);
                this.renderCalendarEvents();
            } catch (e) {
                console.error("[Portal] Failed to delete vacation:", e);
                this.submitMessage = 'Failed to delete. Please try again.';
                this.submitMessageType = 'error';
                setTimeout(() => { this.submitMessage = ''; }, 5000);
            }
        },

        isBeforeCutoff() {
            if (!this.cutoffDate) return true;
            return new Date() < new Date(this.cutoffDate);
        },

        // --- Helpers ---
        formatDate(dateStr) {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        },

        formatDateShort(dateStr) {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        }
    };
}
