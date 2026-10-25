// NCERT books for 2026-27, by class and subject, as listed in the Questboard PRD.
// New NCF books for Classes 6–9; Class 10 keeps its current books until 2027-28.
export const NCERT_BOOKS: Record<number, Record<string, string[]>> = {
  6: { Maths: ["Ganita Prakash"], Science: ["Curiosity"], Social: ["Exploring Society: India and Beyond"], English: ["Poorvi"], Hindi: ["Malhar"] },
  7: { Maths: ["Ganita Prakash"], Science: ["Curiosity"], Social: ["Exploring Society: India and Beyond"], English: ["Poorvi"], Hindi: ["Malhar"] },
  8: { Maths: ["Ganita Prakash"], Science: ["Curiosity"], Social: ["Exploring Society: India and Beyond"], English: ["Poorvi"], Hindi: ["Malhar"] },
  9: { Maths: ["Ganita Manjari"], Science: ["Exploration"], Social: ["Understanding Society"], English: ["Kaveri"], Hindi: ["Ganga"] },
  10: {
    Maths: ["Mathematics"], Science: ["Science"],
    Social: ["India and the Contemporary World II", "Contemporary India II", "Democratic Politics II", "Understanding Economic Development"],
    English: ["First Flight", "Footprints without Feet"], Hindi: ["Kshitij", "Kritika", "Sparsh", "Sanchayan"],
  },
};
export const OTHER_BOOKS = ["RS Aggarwal", "RD Sharma", "Worksheet"];

export function gradeOf(batchName: string) {
  const n = Number(batchName.match(/\d+/)?.[0]);
  return n >= 6 && n <= 10 ? n : null;
}

export function booksFor(batchName: string, subject: string) {
  const g = gradeOf(batchName);
  const ncert = g ? NCERT_BOOKS[g]?.[subject] ?? [] : [];
  return [...ncert.map((b) => `NCERT ${b}`), ...OTHER_BOOKS];
}
