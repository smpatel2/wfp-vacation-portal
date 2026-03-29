/**
 * Firebase initialization with mock fallback.
 *
 * If firebase-config.js is missing or Firebase fails to load,
 * falls back to a mock Firestore interface using localStorage.
 * This allows UI development without a live Firebase project.
 */

const MOCK_DOCTORS = [
    "Ali", "Bednarz", "Browne", "Giese", "Isoniemi",
    "Kemp", "Mackey", "Mathew", "Patel", "Rikert"
];

/**
 * Compute holidays algorithmically for mock mode.
 * Mirrors the logic in scripts/seed-holidays.js.
 */
function computeMockHolidays(year) {
    function toISO(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    function lastMonday(yr, month) {
        const last = new Date(yr, month + 1, 0);
        const dow = last.getDay();
        last.setDate(last.getDate() - (dow === 0 ? 6 : dow - 1));
        return last;
    }
    function nthWeekday(yr, month, weekday, n) {
        const first = new Date(yr, month, 1);
        const diff = (weekday - first.getDay() + 7) % 7;
        return new Date(yr, month, 1 + diff + (n - 1) * 7);
    }
    return [
        { name: "New Year's Day",    date: toISO(new Date(year, 0, 1)) },
        { name: "Memorial Day",      date: toISO(lastMonday(year, 4)) },
        { name: "Independence Day",  date: toISO(new Date(year, 6, 4)) },
        { name: "Labor Day",         date: toISO(nthWeekday(year, 8, 1, 1)) },
        { name: "Thanksgiving Day",  date: toISO(nthWeekday(year, 10, 4, 4)) },
        { name: "Christmas Day",     date: toISO(new Date(year, 11, 25)) },
    ];
}

const MOCK_CONFIG = {
    password: "test",
    cutoffDate: "2026-12-31"
};

function createMockDb() {
    console.warn("[Portal] Firebase not configured — running in mock mode with localStorage");

    function getStoredVacations() {
        return JSON.parse(localStorage.getItem('mock_vacations') || '[]');
    }

    function setStoredVacations(vacations) {
        localStorage.setItem('mock_vacations', JSON.stringify(vacations));
    }

    return {
        _mock: true,

        async getConfig() {
            return MOCK_CONFIG;
        },

        async getDoctors() {
            return MOCK_DOCTORS.map((name, i) => ({ name, order: i }));
        },

        async getHolidays() {
            // Generate holidays for a wide range in mock mode
            const holidays = [];
            for (let y = 2026; y <= 2045; y++) {
                holidays.push(...computeMockHolidays(y));
            }
            return holidays;
        },

        async getVacations(doctor) {
            const all = getStoredVacations();
            return doctor ? all.filter(v => v.doctor === doctor) : all;
        },

        async addVacation(vacation) {
            const all = getStoredVacations();
            const exists = all.some(v => v.doctor === vacation.doctor && v.date === vacation.date);
            if (exists) return { added: false, duplicate: true };
            all.push({ ...vacation, id: Date.now().toString() + Math.random().toString(36).slice(2) });
            setStoredVacations(all);
            return { added: true, duplicate: false };
        },

        async deleteVacation(doctor, date) {
            const all = getStoredVacations();
            const filtered = all.filter(v => !(v.doctor === doctor && v.date === date));
            setStoredVacations(filtered);
            return filtered.length < all.length;
        }
    };
}

function createFirestoreDb(db) {
    // Dynamic import of Firestore functions — loaded when first called
    let _firestoreMod = null;
    async function fs() {
        if (!_firestoreMod) {
            _firestoreMod = await import("https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js");
        }
        return _firestoreMod;
    }

    return {
        _mock: false,

        async getConfig() {
            const { doc, getDoc } = await fs();
            const snap = await getDoc(doc(db, "config", "settings"));
            return snap.exists() ? snap.data() : {};
        },

        async getDoctors() {
            const { collection, getDocs, orderBy, query } = await fs();
            const q = query(collection(db, "doctors"), orderBy("order"));
            const snap = await getDocs(q);
            return snap.docs.map(d => d.data());
        },

        async getHolidays() {
            const { collection, getDocs, query } = await fs();
            const q = query(collection(db, "holidays"));
            const snap = await getDocs(q);
            return snap.docs.map(d => d.data());
        },

        async getVacations(doctor) {
            const { collection, getDocs, query, where } = await fs();
            let q;
            if (doctor) {
                q = query(collection(db, "vacations"), where("doctor", "==", doctor));
            } else {
                q = query(collection(db, "vacations"));
            }
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        },

        async addVacation(vacation) {
            const { collection, addDoc, getDocs, query, where } = await fs();
            // Check for duplicate
            const q = query(
                collection(db, "vacations"),
                where("doctor", "==", vacation.doctor),
                where("date", "==", vacation.date)
            );
            const existing = await getDocs(q);
            if (!existing.empty) return { added: false, duplicate: true };

            await addDoc(collection(db, "vacations"), {
                ...vacation,
                createdAt: new Date().toISOString()
            });
            return { added: true, duplicate: false };
        },

        async deleteVacation(doctor, date) {
            const { collection, getDocs, query, where, deleteDoc } = await fs();
            const q = query(
                collection(db, "vacations"),
                where("doctor", "==", doctor),
                where("date", "==", date)
            );
            const snap = await getDocs(q);
            for (const d of snap.docs) {
                await deleteDoc(d.ref);
            }
            return !snap.empty;
        }
    };
}

async function initDb() {
    try {
        const configModule = await import("../firebase-config.js");
        const firebaseConfig = configModule.default;

        if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
            return createMockDb();
        }

        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js");
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js");

        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        console.log("[Portal] Connected to Firebase");
        return createFirestoreDb(db);
    } catch (e) {
        return createMockDb();
    }
}

export { initDb };
