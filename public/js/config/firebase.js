// js/config/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, get, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDRsS6YQ481KQadSk8gf9QtxVt_asnrDlc",
  authDomain: "juegos-cumple.firebaseapp.com",
  databaseURL: "https://juegos-cumple-default-rtdb.firebaseio.com", 
  projectId: "juegos-cumple",
  storageBucket: "juegos-cumple.firebasestorage.app",
  messagingSenderId: "595312538655",
  appId: "1:595312538655:web:93220a84570ff7461fd12a",
  measurementId: "G-V1YXNZXVQR"
};

// Inicializamos la App
const app = initializeApp(firebaseConfig);

// Exportamos las instancias listas para usar
export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Exportamos funciones útiles de Firebase para no tener que importar URLs en todos lados
export { 
    ref, get, set, push, onValue, remove, update, // Base de datos
    setPersistence, browserLocalPersistence, signInWithEmailAndPassword, signOut, onAuthStateChanged, // Auth
    storageRef, uploadBytesResumable, getDownloadURL, deleteObject // Storage
};