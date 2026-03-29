/**
 * Holiday Seed Script
 *
 * Computes US holiday dates algorithmically for 2026–2045 and writes
 * them to the Firestore `holidays` collection.
 *
 * Holidays:
 *   - New Year's Day    (Jan 1)
 *   - Memorial Day      (Last Monday of May)
 *   - Independence Day  (Jul 4)
 *   - Labor Day         (First Monday of Sep)
 *   - Thanksgiving Day  (Fourth Thursday of Nov)
 *   - Christmas Day     (Dec 25)
 *
 * Firestore Schema:
 *   holidays/{auto-id} {
 *     name: string    — holiday display name
 *     date: string    — ISO date string (e.g. "2026-07-04")
 *   }
 *
 * Usage:
 *   Open seed.html in a browser and click "Seed Holidays".
 */

const START_YEAR = 2026;
const END_YEAR = 2045;

// --- Date helpers ---

/** Returns the last Monday in the given month/year. */
function lastMonday(year, month) {
    // Start from the last day of the month
    const last = new Date(year, month + 1, 0); // day 0 of next month = last day of this month
    const dow = last.getDay(); // 0=Sun, 1=Mon, ...
    const diff = (dow === 0) ? 6 : dow - 1; // days back to Monday
    last.setDate(last.getDate() - diff);
    return last;
}

/** Returns the Nth occurrence of a weekday in the given month/year. */
function nthWeekday(year, month, weekday, n) {
    // weekday: 0=Sun ... 4=Thu
    const first = new Date(year, month, 1);
    let dow = first.getDay();
    let diff = (weekday - dow + 7) % 7;
    const day = 1 + diff + (n - 1) * 7;
    return new Date(year, month, day);
}

function toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// --- Holiday computation ---

function computeHolidays(year) {
    return [
        { name: "New Year's Day",    date: toISO(new Date(year, 0, 1)) },
        { name: "Memorial Day",      date: toISO(lastMonday(year, 4)) },          // Last Mon of May
        { name: "Independence Day",  date: toISO(new Date(year, 6, 4)) },
        { name: "Labor Day",         date: toISO(nthWeekday(year, 8, 1, 1)) },    // 1st Mon of Sep
        { name: "Thanksgiving Day",  date: toISO(nthWeekday(year, 10, 4, 4)) },   // 4th Thu of Nov
        { name: "Christmas Day",     date: toISO(new Date(year, 11, 25)) },
    ];
}

function generateAllHolidays() {
    const all = [];
    for (let y = START_YEAR; y <= END_YEAR; y++) {
        all.push(...computeHolidays(y));
    }
    return all;
}

// --- Firestore seeding ---

async function seedHolidays(db, collection, addDoc, getDocs) {
    const holidays = generateAllHolidays();

    // Check if holidays already exist
    const existing = await getDocs(collection(db, "holidays"));
    if (!existing.empty) {
        const proceed = confirm(
            `The holidays collection already has ${existing.size} documents.\n` +
            `Delete them and re-seed ${holidays.length} holidays?`
        );
        if (!proceed) {
            console.log("Cancelled.");
            return { seeded: 0, skipped: true };
        }
        // Delete existing
        const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js");
        for (const d of existing.docs) {
            await deleteDoc(d.ref);
        }
        console.log(`  Deleted ${existing.size} existing holiday documents.`);
    }

    console.log(`Seeding ${holidays.length} holidays (${START_YEAR}–${END_YEAR})...`);
    let count = 0;
    for (const h of holidays) {
        await addDoc(collection(db, "holidays"), h);
        count++;
        if (count % 20 === 0) {
            console.log(`  ...${count}/${holidays.length}`);
        }
    }
    console.log(`  ✓ ${count} holidays seeded.`);
    return { seeded: count, skipped: false };
}

export { seedHolidays, generateAllHolidays, computeHolidays };
