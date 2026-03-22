/**
 * Firestore Seed Script
 *
 * Run this once after creating your Firebase project to populate
 * the initial config and doctors collections.
 *
 * Usage:
 *   1. Create firebase-config.js from firebase-config.example.js
 *   2. Open seed.html in a browser (or run this via the browser console)
 *
 * Firestore Schema:
 *
 *   config/settings {
 *     password: string        — shared practice password
 *     cutoffDate: string      — ISO date after which deletions are locked (e.g. "2026-04-01")
 *   }
 *
 *   doctors/{auto-id} {
 *     name: string            — doctor's display name
 *     order: number           — display order in dropdown
 *   }
 *
 *   vacations/{auto-id} {
 *     doctor: string          — doctor name (matches doctors.name)
 *     date: string            — ISO date string (e.g. "2026-07-04")
 *     status: string          — "Pending" | "Approved"
 *     createdAt: timestamp    — when the request was submitted
 *   }
 */

// Doctor roster — update these names to match your practice
const DOCTORS = [
    "Ali",
    "Bednarz",
    "Browne",
    "Giese",
    "Isoniemi",
    "Kemp",
    "Mackey",
    "Mathew",
    "Patel",
    "Rikert"
];

const CONFIG = {
    password: "wheaton2026",
    cutoffDate: "2026-12-31"
};

async function seedFirestore(db, collection, doc, setDoc, addDoc) {
    console.log("Seeding config...");
    await setDoc(doc(db, "config", "settings"), CONFIG);
    console.log("  ✓ config/settings created");

    console.log("Seeding doctors...");
    for (let i = 0; i < DOCTORS.length; i++) {
        await addDoc(collection(db, "doctors"), {
            name: DOCTORS[i],
            order: i
        });
        console.log(`  ✓ ${DOCTORS[i]} added`);
    }

    console.log("\nDone! Firestore is seeded.");
}

export { seedFirestore, DOCTORS, CONFIG };
