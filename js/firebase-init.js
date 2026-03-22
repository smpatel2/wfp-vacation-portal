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
