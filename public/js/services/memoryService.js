import { db, storage, ref, push, remove, onValue, set, get, storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "../config/firebase.js";

// --- IMÁGENES ---
export async function uploadMemoryImage(eventId, file, onProgress) {
    const uniqueName = `${Date.now()}-${file.name}`;
    const sRef = storageRef(storage, `events/${eventId}/data/memoryImages/${uniqueName}`);
    
    const uploadTask = uploadBytesResumable(sRef, file);

    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (onProgress) onProgress(progress);
            },
            (error) => reject(error),
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const imageData = { url: downloadURL, storagePath: sRef.fullPath, name: file.name };
                const dbRef = ref(db, `events/${eventId}/data/memoryImages`);
                await push(dbRef, imageData);
                resolve(imageData);
            }
        );
    });
}

export function subscribeToMemoryImages(eventId, callback) {
    const imgRef = ref(db, `events/${eventId}/data/memoryImages`);
    return onValue(imgRef, (snapshot) => {
        const data = snapshot.val();
        let images = [];
        if (data) {
            Object.keys(data).forEach(key => {
                images.push({ id: key, ...data[key] });
            });
        }
        callback(images);
    });
}

export async function deleteMemoryImage(eventId, imageId, storagePath) {
    // 1. Borrar de Storage
    const sRef = storageRef(storage, storagePath);
    await deleteObject(sRef);
    // 2. Borrar de DB
    const dbRef = ref(db, `events/${eventId}/data/memoryImages/${imageId}`);
    return remove(dbRef);
}

export async function clearAllMemoryImages(eventId) {
    const imgRef = ref(db, `events/${eventId}/data/memoryImages`);
    const snapshot = await get(imgRef);
    
    if (!snapshot.exists()) return;

    const deletePromises = [];
    snapshot.forEach(child => {
        const val = child.val();
        if (val.storagePath) {
            const sRef = storageRef(storage, val.storagePath);
            deletePromises.push(deleteObject(sRef).catch(e => console.warn("Error borrando archivo:", e)));
        }
    });

    await Promise.all(deletePromises);
    return remove(imgRef);
}

// --- RANKING ---
export function saveMemoryScore(eventId, playerData) {
    const rankRef = ref(db, `events/${eventId}/data/memoryRankings`);
    return push(rankRef, playerData);
}

export function subscribeToMemoryRanking(eventId, callback) {
    const rankRef = ref(db, `events/${eventId}/data/memoryRankings`);
    return onValue(rankRef, (snapshot) => {
        const data = snapshot.val();
        const list = data ? Object.values(data) : [];
        callback(list);
    });
}