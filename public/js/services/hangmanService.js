import { db, ref, push, remove, onValue, set, get } from "../config/firebase.js";

export function addHangmanWord(eventId, word) {
    const wRef = ref(db, `events/${eventId}/data/hangmanWords`);
    return push(wRef, { word: word.toUpperCase() });
}

export function subscribeToHangmanWords(eventId, callback) {
    const wRef = ref(db, `events/${eventId}/data/hangmanWords`);
    return onValue(wRef, (snapshot) => {
        const data = snapshot.val();
        let words = [];
        if (data) {
            Object.keys(data).forEach(key => {
                words.push({ id: key, ...data[key] });
            });
        }
        callback(words);
    });
}

export async function getHangmanWordsOnce(eventId) {
    const wRef = ref(db, `events/${eventId}/data/hangmanWords`);
    const snapshot = await get(wRef);
    const data = snapshot.val();
    return data ? Object.values(data).map(item => item.word) : [];
}

export function deleteHangmanWord(eventId, wordId) {
    const wRef = ref(db, `events/${eventId}/data/hangmanWords/${wordId}`);
    return remove(wRef);
}

export function clearAllHangmanWords(eventId) {
    const wRef = ref(db, `events/${eventId}/data/hangmanWords`);
    return set(wRef, null);
}