import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "../config/firebase.js";

/**
 * Inicia sesión con persistencia local para evitar desconexiones.
 */
export async function loginHost(email, password) {
    await setPersistence(auth, browserLocalPersistence);
    return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Cierra la sesión actual.
 */
export async function logoutHost() {
    return signOut(auth);
}

/**
 * Escucha cambios en la autenticación (Login/Logout).
 * @param {Function} callback - Función que recibe (user | null)
 */
export function subscribeToAuth(callback) {
    return onAuthStateChanged(auth, callback);
}