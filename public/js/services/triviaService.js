import { db, ref, push, remove, onValue, set } from "../config/firebase.js";

// --- PREGUNTAS ---
export function subscribeToQuestions(eventId, callback) {
    const qRef = ref(db, `events/${eventId}/data/questions`);
    return onValue(qRef, (snapshot) => {
        const data = snapshot.val();
        let questions = [];
        if (data) {
            Object.keys(data).forEach(key => {
                let qData = data[key];
                // Fix para arrays guardados como objetos en Firebase
                if (qData.options && typeof qData.options === 'object' && !Array.isArray(qData.options)) {
                    qData.options = Object.values(qData.options);
                }
                questions.push({ id: key, ...qData });
            });
        }
        callback(questions);
    });
}

export function addQuestion(eventId, questionData) {
    const qRef = ref(db, `events/${eventId}/data/questions`);
    return push(qRef, questionData);
}

export function deleteQuestion(eventId, questionId) {
    const qRef = ref(db, `events/${eventId}/data/questions/${questionId}`);
    return remove(qRef);
}

export function clearAllQuestions(eventId) {
    const qRef = ref(db, `events/${eventId}/data/questions`);
    return set(qRef, null);
}

// --- RANKING ---
export function saveTriviaScore(eventId, playerData) {
    const rankRef = ref(db, `events/${eventId}/data/rankings`);
    return push(rankRef, playerData);
}

export function subscribeToTriviaRanking(eventId, callback) {
    const rankRef = ref(db, `events/${eventId}/data/rankings`);
    return onValue(rankRef, (snapshot) => {
        const data = snapshot.val();
        const list = data ? Object.values(data) : [];
        callback(list);
    });
}