// ⭐️⭐️⭐️ IMPORTACIONES DE AUTH AÑADIDAS ⭐️⭐️⭐️
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
// ⭐️⭐️⭐️ FIN DE IMPORTACIONES ⭐️⭐️⭐️

// =======================================================================
// CONFIGURACIÓN DE FIREBASE (Sin cambios)
// =======================================================================
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

// =======================================================================
// INICIALIZACIÓN Y VARIABLES GLOBALES
// =======================================================================

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app); 
const auth = getAuth(app); // ⭐️⭐️⭐️ INICIALIZACIÓN DE AUTH AÑADIDA ⭐️⭐️⭐️

// --- NUEVO: Refs y ID de Evento Globales (se asignarán en DOMContentLoaded) ---
let EVENT_ID;
let questionsRef, rankingsRef, memoryImagesRef, memoryRankingsRef, hangmanWordsRef;

// Variables globales de estado de juegos (sin cambios)
let quizQuestions = []; 
let currentQuestionIndex = 0;
let score = 0;
let timerInterval;
let timeLeft = 10;
let playerName = 'Jugador Anónimo';
let timeBonusTotal = 0; 
let totalTime = 0; 

let memoryGameImages = []; 
let hasFlippedCard = false;
let lockBoard = false;
let firstCard, secondCard;
let matchCount = 0;
let memoryTimer = null;
let secondsElapsed = 0;
let memoryPlayerName = '';

let hangmanWord = '';
let maskedWord = [];
let guessedLetters = [];
let lives = 7;
let hangmanPlayerName = '';


// =======================================================================
// --- LÓGICA DE EVENTO Y CONFIGURACIÓN ---
// (Tu código original, sin cambios)
// =======================================================================

/**
 * Obtiene el ID del evento desde la URL (ej: ?event=boda-ana).
 * Bloquea la app si no se encuentra.
 */
function getEventId() {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('event');
    if (!eventId) {
        document.body.innerHTML = `
            <div style="padding: 40px; text-align: center; font-family: sans-serif; color: #333;">
                <h1>Error: Evento no encontrado</h1>
                <p>Asegúrate de que el enlace (URL) que estás usando sea correcto.</p>
            </div>
        `;
        throw new Error('Event ID no especificado en la URL.');
    }
    return eventId;
}


/**
 * ⭐️ Motor de Temas Dinámico
 * (Tu código original, sin cambios)
 */
function applyDynamicTheme(themeConfig) {
    if (!themeConfig) {
        console.warn("No se encontró tema, usando defaults.");
        return;
    }

    const styleTag = document.createElement('style');
    let cssVariables = ":root {\n";

    // 1. Iterar sobre las claves del tema
    for (const key in themeConfig) {
        if (typeof themeConfig[key] === 'object' && themeConfig[key] !== null) {
            continue;
        }
        const value = themeConfig[key];
        if (!value) {
            continue; 
        }
        const cssVarName = `--${key.replace(/_/g, '-')}`; 
        cssVariables += `    ${cssVarName}: ${value};\n`;
    }
    cssVariables += "}\n";

    // 2. Manejar la fuente
    if (themeConfig.font_family) { 
        cssVariables += `
            body {
                font-family: ${themeConfig.font_family};
            }
        `;
    }

    // 3. Manejar la imagen de fondo
    if (themeConfig.background_image_url) {
         cssVariables += `
            body {
                background-image: url('${themeConfig.background_image_url}') !important;
                background-size: cover;
                background-position: center;
            }
        `;
    }

    // 4. Inyectar en el <head>
    styleTag.innerHTML = cssVariables;
    document.head.appendChild(styleTag);
    
    // 5. Manejar los iconos
    if (themeConfig.icons) {
        const icons = themeConfig.icons;
        const updateIcons = (className, icon) => {
            if (!icon) return; 
            document.querySelectorAll(className).forEach(el => el.textContent = icon);
        };
        updateIcons('.icon-main', icons.icon_main);
        updateIcons('.icon-portal', icons.icon_portal);
        updateIcons('.icon-trivia', icons.icon_trivia);
        updateIcons('.icon-memory', icons.icon_memory);
        updateIcons('.icon-hangman', icons.icon_hangman);
        updateIcons('.icon-ranking', icons.icon_ranking);
        updateIcons('.icon-win', icons.icon_win);
    }
}


/**
 * ⭐️ FUNCIÓN loadEventConfig (MODIFICADA) ⭐️
 * (Tu código original, sin cambios)
 */
async function loadEventConfig(eventId) {
    const configRef = ref(database, `events/${eventId}/config`);
    let config = {};
    
    try {
        const snapshot = await get(configRef);
        if (snapshot.exists()) {
            config = snapshot.val();
        } else {
            console.warn("No se encontró configuración. Usando valores por defecto.");
            const isHost = window.location.pathname.includes('host.html');
            const isRanking = window.location.pathname.includes('ranking.html');
            
            if (isHost || isRanking) {
                 console.warn("Host/Ranking: Cuidado, no hay config. Se usarán defaults.");
            } else {
                throw new Error("Configuración de evento no encontrada.");
            }
        }
    } catch (error) {
        console.error("Error cargando configuración:", error);
        throw new Error("Error al cargar la configuración del evento.");
    }

    // --- 1. CHEQUEO DE EVENTO ACTIVO ---
    const isHost = window.location.pathname.includes('host.html');
    const isRanking = window.location.pathname.includes('ranking.html');

    if (!isHost && !isRanking && (!config.status || config.status.is_active === false)) {
        document.body.innerHTML = `
            <div style="padding: 40px; text-align: center; font-family: sans-serif; color: #333;">
                <h1>Evento Finalizado</h1>
                <p>Este portal de recuerdos ya no se encuentra disponible.</p>
            </div>
        `;
        throw new Error("El evento está deshabilitado.");
    }

    // --- 2. APLICAR TEMA VISUAL ---
    applyDynamicTheme(config.theme);
    
    // --- 3. APLICAR FUNCIONALIDADES (Juegos) ---
    if (config.features && config.features.games_enabled === false) {
        if (isHost) {
            const triviaAdmin = document.querySelector('.quiz-section'); 
            const triviaRanking = document.querySelector('.ranking-section'); 
            const memoryAdmin = document.getElementById('memory-game-admin');
            const memoryRanking = document.querySelector('.ranking-section[aria-label="Ranking de Memoria"]'); 
            const hangmanAdmin = document.getElementById('hangman-admin');
            const playerLinks = document.querySelector('.mode-selector'); 
            
            if (playerLinks) playerLinks.style.display = 'none';
            if (triviaAdmin) triviaAdmin.style.display = 'none';
            if (triviaRanking) triviaRanking.style.display = 'none';
            if (memoryAdmin) memoryAdmin.style.display = 'none';
            if (memoryRanking) memoryRanking.style.display = 'none';
            if (hangmanAdmin) hangmanAdmin.style.display = 'none';
            
            const headerTitle = document.getElementById('header-title');
            if(headerTitle) headerTitle.innerHTML = `Panel: ${eventId} <br><span style="font-size: 0.6em; color: red;">(Juegos Deshabilitados)</span>`;
        }
        
        if (isRanking) {
             document.querySelectorAll('.ranking-box').forEach(box => box.style.display = 'none');
             document.body.innerHTML = `
                <h1 style="text-align: center;">Módulo de Juegos Deshabilitado</h1>
                <p style="text-align: center;">Este módulo no está activo para este evento.</p>
             `;
        }

        if (!isHost && !isRanking) {
            document.body.innerHTML = `
                <div style="padding: 40px; text-align: center; font-family: sans-serif; color: #333;">
                    <h1>Módulo de Juegos Deshabilitado</h1>
                    <p>Este módulo no está activo para este evento.</p>
                    <a href="index.html?event=${eventId}">Volver al portal</a>
                </div>
            `;
            throw new Error("Módulo de juegos deshabilitado.");
        }
    }
}


// =======================================================================
// FUNCIONES DE UTILIDAD Y ALMACENAMIENTO (TRIVIA)
// (Tu código original, sin cambios)
// =======================================================================

function fixFirebaseArray(data) {
    if (data && data.options && !Array.isArray(data.options) && typeof data.options === 'object') {
        data.options = Object.values(data.options);
    }
    return data;
}

function listenForQuestions(callback) {
    onValue(questionsRef, (snapshot) => {
        const data = snapshot.val();
        quizQuestions = [];
        if (data) {
            Object.keys(data).forEach(key => {
                let questionData = data[key];
                questionData = fixFirebaseArray(questionData);
                quizQuestions.push({
                    id: key,
                    ...questionData
                });
            });
        }
        console.log(`[Firebase] Preguntas cargadas: ${quizQuestions.length}`);
        if (callback) callback();
    });
}

function saveNewQuestion(questionData) {
    return push(questionsRef, questionData); 
}

function deleteQuestion(id) {
    const questionToRemoveRef = ref(database, `events/${EVENT_ID}/data/questions/${id}`);
    return remove(questionToRemoveRef);
}

function saveFinalResult(data) {
    return push(rankingsRef, data); 
}

function listenForRankings(renderCallback) {
    onValue(rankingsRef, (snapshot) => {
        const data = snapshot.val();
        let rankingList = [];
        if (data) {
            Object.keys(data).forEach(key => {
                rankingList.push(data[key]);
            });
        }
        renderCallback(rankingList); 
    });
}

function renderTriviaRanking(results) {
    const container = document.getElementById('ranking-list');
    if (!container) return; 
    results.forEach(r => {
        r.rankingValue = r.score - (r.time / 10); 
    });
    results.sort((a, b) => {
        if (b.rankingValue !== a.rankingValue) return b.rankingValue - a.rankingValue;
        if (b.score !== a.score) return a.time - b.time;
    });
    container.innerHTML = '';
    if (results.length === 0) {
        container.innerHTML = '<li class="p-2 text-gray-500 italic text-center">Aún no hay resultados...</li>';
        return;
    }
    results.forEach((r, index) => {
        const li = document.createElement('li');
        li.className = `question-item ${index === 0 ? 'top-winner-trivia' : ''}`;
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.innerHTML = `
            <div style="font-weight: bold; display: flex; align-items: center;">
                <span style="font-size: 1.2em; width: 30px;">${index + 1}.</span>
                <span>${r.name}</span>
            </div>
            <div style="text-align: right;">
                <span style="font-weight: bold; color: #e69900;">${r.score} pts</span>
                <span style="font-size: 0.9em; color: #666;">(${r.time}s usados)</span>
            </div>
        `;
        container.appendChild(li);
    });
}

// =======================================================================
// --- FUNCIONES DE ALMACENAMIENTO (JUEGO DE MEMORIA) ---
// (Tu código original, sin cambios)
// =======================================================================

async function uploadMemoryImages(files, progressCallback, statusCallback) {
    const uploadPromises = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uniqueName = `${Date.now()}-${file.name}`;
        const sRef = storageRef(storage, `events/${EVENT_ID}/data/memoryImages/${uniqueName}`);
        statusCallback(`Subiendo ${i + 1} de ${files.length}: ${file.name}`);
        const uploadTask = uploadBytesResumable(sRef, file);
        const uploadPromise = new Promise((resolve, reject) => {
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    progressCallback(progress); 
                }, 
                (error) => { reject(error); }, 
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    const imageData = { url: downloadURL, storagePath: sRef.fullPath, name: file.name };
                    await push(memoryImagesRef, imageData);
                    resolve(imageData);
                }
            );
        });
        uploadPromises.push(uploadPromise);
    }
    await Promise.all(uploadPromises);
    statusCallback("¡Todas las imágenes se subieron con éxito!");
}

function listenForMemoryImages(renderCallback) {
    onValue(memoryImagesRef, (snapshot) => {
        const images = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                images.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
        }
        renderCallback(images);
    });
}

async function clearAllMemoryImages() {
    const snapshot = await get(memoryImagesRef);
    if (!snapshot.exists()) {
        alert("No hay imágenes para borrar.");
        return;
    }
    const deletePromises = [];
    snapshot.forEach((childSnapshot) => {
        const imgData = childSnapshot.val();
        if (imgData.storagePath) {
            const sRef = storageRef(storage, imgData.storagePath);
            deletePromises.push(deleteObject(sRef));
        }
    });
    try {
        await Promise.all(deletePromises);
        await remove(memoryImagesRef); 
        alert("Se eliminaron todas las imágenes correctamente.");
    } catch (error) {
        console.error("Error al borrar imágenes:", error);
        alert("Error al borrar imágenes. Revisa la consola.");
    }
}

async function deleteSingleMemoryImage(id, storagePath) {
    try {
        const sRef = storageRef(storage, storagePath);
        await deleteObject(sRef);
        const dbImgRef = ref(database, `events/${EVENT_ID}/data/memoryImages/${id}`);
        await remove(dbImgRef);
    } catch (error) {
        console.error("Error al borrar imagen:", error);
        alert("Error al borrar la imagen.");
    }
}

function listenForMemoryRankings(renderCallback) {
    onValue(memoryRankingsRef, (snapshot) => {
        const results = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                results.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
        }
        renderCallback(results);
    });
}

function renderMemoryRanking(results) {
    const container = document.getElementById('memory-ranking-list');
    if (!container) return; 

    results.sort((a, b) => a.time - b.time); 
    container.innerHTML = '';
    if (results.length === 0) {
        container.innerHTML = '<li class="p-2 text-gray-500 italic text-center">Aún no hay resultados...</li>';
        return;
    }
    results.forEach((r, index) => {
        const li = document.createElement('li');
        li.className = `question-item ${index === 0 ? 'top-winner-memory' : ''}`; 
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.innerHTML = `
            <div style="font-weight: bold; display: flex; align-items: center;">
                <span style="font-size: 1.2em; width: 30px;">${index + 1}.</span>
                <span>${r.name}</span>
            </div>
            <div style="text-align: right;">
                <span style="font-weight: bold; color: #007bff;">${r.time.toFixed(2)} s</span>
            </div>
        `;
        container.appendChild(li);
    });
}


// =======================================================================
// MODO ANFITRIÓN (host.html)
// (Tu código original, sin cambios)
// =======================================================================

function initializeHost() {
    // --- NUEVO: Actualizar enlaces del host ---
    document.querySelectorAll('a[href="player.html"]').forEach(a => a.href = `player.html?event=${EVENT_ID}`);
    document.querySelectorAll('a[href="memory.html"]').forEach(a => a.href = `memory.html?event=${EVENT_ID}`);
    document.querySelectorAll('a[href="hangman.html"]').forEach(a => a.href = `hangman.html?event=${EVENT_ID}`);
    // Actualiza el título del header
    const headerTitle = document.getElementById('header-title');
    if (headerTitle) headerTitle.textContent = `Panel: ${EVENT_ID}`;


    // --- Lógica de TRIVIA ---
    const form = document.getElementById('question-form');
    const questionsList = document.getElementById('questions-list');
    const clearAllBtn = document.getElementById('clear-all-btn');

    listenForQuestions(renderQuestionsList);
    listenForRankings(renderTriviaRanking); 

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const questionText = document.getElementById('q-text').value.trim();
        const optionsText = document.getElementById('q-options').value.trim();
        const answerText = document.getElementById('q-answer').value.trim();
        const options = optionsText.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
        if (options.length < 2) {
            alert('Debes ingresar al menos dos opciones para la pregunta.');
            return;
        }
        if (!options.includes(answerText)) {
            alert('La respuesta correcta debe coincidir exactamente con una de las opciones.');
            return;
        }
        const newQuestionData = { question: questionText, options: options, answer: answerText };
        try {
            await saveNewQuestion(newQuestionData);
            form.reset();
        } catch (error) {
            console.error("Error al guardar la pregunta:", error);
            alert(`Error al guardar la pregunta en Firebase: ${error.message}`);
        }
    });

    clearAllBtn.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que quieres ELIMINAR TODAS las preguntas de la TRIVIA?')) {
            try {
                await set(questionsRef, null); 
            } catch (error) {
                console.error("Error al eliminar todas las preguntas:", error);
            }
        }
    });

    questionsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const idToDelete = e.target.dataset.id;
            try {
                await deleteQuestion(idToDelete);
            } catch (error) {
                console.error("Error al eliminar la pregunta:", error);
            }
        }
    });

    function renderQuestionsList(questions) { 
        questionsList.innerHTML = '';
        if (questions.length === 0) {
            questionsList.innerHTML = '<li class="text-gray-500 italic p-2">Aún no hay preguntas cargadas...</li>';
            clearAllBtn.classList.add('hidden');
            return;
        }
        clearAllBtn.classList.remove('hidden');
        questions.forEach((q, index) => {
            const li = document.createElement('li');
            li.className = 'question-item'; 
            li.innerHTML = `
                <div class="q-display">
                    <strong>P${index + 1}:</strong> ${q.question}
                    <p class="text-xs text-green-700">Rta: ${q.answer}</p>
                </div>
                <button class="delete-btn" data-id="${q.id}">Eliminar</button>
            `;
            questionsList.appendChild(li);
        });
    }

    // --- Lógica del JUEGO DE MEMORIA ---
    const memoryForm = document.getElementById('memory-image-form');
    const memoryFilesInput = document.getElementById('memory-files');
    const memoryImagesList = document.getElementById('memory-images-list');
    const clearMemoryImagesBtn = document.getElementById('clear-memory-images-btn');
    const progressContainer = document.getElementById('memory-upload-progress-bar-container');
    const progressBar = document.getElementById('memory-upload-progress');
    const progressStatus = document.getElementById('memory-upload-status');
    const saveMemoryBtn = document.getElementById('save-memory-images-btn');

    listenForMemoryImages(renderMemoryImagesList);
    listenForMemoryRankings(renderMemoryRanking);

    memoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const files = memoryFilesInput.files;
        if (!files || files.length === 0) {
            alert("Por favor, selecciona al menos una imagen.");
            return;
        }
        saveMemoryBtn.disabled = true;
        progressContainer.classList.remove('hidden');

        try {
            const progressCallback = (progress) => { progressBar.style.width = `${progress}%`; };
            const statusCallback = (status) => { progressStatus.textContent = status; };
            await uploadMemoryImages(files, progressCallback, statusCallback);
            setTimeout(() => {
                progressContainer.classList.add('hidden');
                progressStatus.textContent = "Subiendo...";
                progressBar.style.width = "0%";
                memoryForm.reset();
            }, 2000);
        } catch (error) {
            console.error("Error en la subida:", error);
            alert("Hubo un error al subir las imágenes.");
            progressStatus.textContent = "Error en la subida.";
        } finally {
            saveMemoryBtn.disabled = false;
        }
    });

    clearMemoryImagesBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres ELIMINAR TODAS las imágenes del juego de memoria? Esta acción no se puede deshacer.')) {
            clearAllMemoryImages(); 
        }
    });

    memoryImagesList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            const path = e.target.dataset.path;
            if (confirm(`¿Seguro que quieres borrar la imagen ${e.target.dataset.name}?`)) {
                await deleteSingleMemoryImage(id, path);
            }
        }
    });

    function renderMemoryImagesList(images) {
        memoryImagesList.innerHTML = '';
        if (images.length === 0) {
            memoryImagesList.innerHTML = '<li class="p-2 text-gray-500 italic text-center">Aún no hay imágenes...</li>';
            clearMemoryImagesBtn.classList.add('hidden');
            return;
        }
        clearMemoryImagesBtn.classList.remove('hidden');
        images.forEach(img => {
            const li = document.createElement('li');
            li.className = 'question-item image-preview-item'; 
            li.innerHTML = `
                <img src="${img.url}" alt="${img.name}">
                <span class="q-display text-sm truncate">${img.name}</span>
                <button class="delete-btn" 
                        data-id="${img.id}" 
                        data-path="${img.storagePath}" 
                        data-name="${img.name}">
                    Eliminar
                </button>
            `;
            memoryImagesList.appendChild(li);
        });
    }

    // --- Lógica del JUEGO DEL AHORCADO ---
    const hangmanForm = document.getElementById('hangman-word-form');
    const hangmanWordInput = document.getElementById('h-word');
    const hangmanWordsList = document.getElementById('hangman-words-list');
    const clearHangmanWordsBtn = document.getElementById('clear-hangman-words-btn');
    
    listenForHangmanWords(renderHangmanWordsList); 

    hangmanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const word = hangmanWordInput.value.trim().toUpperCase();
        if (word.length < 3) {
            alert("La palabra debe tener al menos 3 caracteres.");
            return;
        }
        try {
            await push(hangmanWordsRef, { word: word });
            hangmanForm.reset();
        } catch (error) {
            console.error("Error al guardar la palabra:", error);
            alert("Error al guardar la palabra.");
        }
    });

    clearHangmanWordsBtn.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que quieres ELIMINAR TODAS las palabras del Ahorcado?')) {
            try {
                await set(hangmanWordsRef, null); 
            } catch (error) {
                console.error("Error al eliminar las palabras:", error);
            }
        }
    });

    hangmanWordsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const idToDelete = e.target.dataset.id;
            try {
                const wordRef = ref(database, `events/${EVENT_ID}/data/hangmanWords/${idToDelete}`);
                await remove(wordRef);
            } catch (error) {
                console.error("Error al eliminar la palabra:", error);
            }
        }
    });
    
    function listenForHangmanWords(renderCallback) {
        onValue(hangmanWordsRef, (snapshot) => {
            const words = [];
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    words.push({
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
            }
            renderCallback(words);
        });
    }

    function renderHangmanWordsList(words) {
        hangmanWordsList.innerHTML = '';
        if (words.length === 0) {
            hangmanWordsList.innerHTML = '<li class="p-2 text-gray-500 italic text-center">Aún no hay palabras...</li>';
            clearHangmanWordsBtn.classList.add('hidden');
            return;
        }
        clearHangmanWordsBtn.classList.remove('hidden');
        words.forEach((w) => {
            const li = document.createElement('li');
            li.className = 'question-item'; 
            li.innerHTML = `
                <div class="q-display">
                    <strong class="text-gray-700">${w.word}</strong>
                </div>
                <button class="delete-btn" data-id="${w.id}">Eliminar</button>
            `;
            hangmanWordsList.appendChild(li);
        });
    }
}


// =======================================================================
// MODO JUGADOR (player.html) - LÓGICA DE TRIVIA
// (Tu código original, sin cambios)
// =======================================================================

function initializePlayer() {
    // --- NUEVO: Actualizar enlaces "Volver" ---
    document.querySelectorAll("button[onclick=\"window.location.href='index.html'\"]").forEach(btn => {
        btn.onclick = () => window.location.href = `index.html?event=${EVENT_ID}`;
    });

    // --- Lógica de TRIVIA (Sin cambios internos) ---
    const startForm = document.getElementById('start-form');
    const nameInput = document.getElementById('player-name-input');
    const nameDisplay = document.getElementById('player-name-display'); 
    const startButton = document.getElementById('start-game-btn');
    const noQuestionsMsg = document.getElementById('player-no-questions-msg');
    const scoreElement = document.getElementById('score'); 
    const scoreSpan = scoreElement ? scoreElement.querySelector('span') : null; 
    const timerElement = document.getElementById('timer'); 
    const timerSpan = timerElement ? timerElement.querySelector('span') : null; 
    const questionElement = document.getElementById('question');
    const optionsContainer = document.getElementById('options-container');
    const nextButtonContainer = document.getElementById('next-button-fixed-container'); 
    const nextButton = document.getElementById('next-btn'); 
    const gameModeContainer = document.getElementById('game-mode');
    const startScreenContainer = document.getElementById('start-screen');
    const resultsContainer = document.getElementById('results');
    const finalScoreElement = document.getElementById('final-score');
    
    if (startForm) {
        listenForQuestions(initializePlayerScreen);
        if (nextButtonContainer) nextButtonContainer.classList.add('hidden'); 

        startForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            if (name) {
                playerName = name.substring(0, 20);
                if (quizQuestions.length > 0) {
                    startGame();
                } else {
                    if (noQuestionsMsg) noQuestionsMsg.classList.remove('hidden');
                    alert('El anfitrión aún no ha cargado preguntas.');
                }
            }
        });
        
        if (nextButton) nextButton.addEventListener('click', () => {
            currentQuestionIndex++;
            loadQuestion();
        });
    }

    function initializePlayerScreen() {
        if (quizQuestions.length > 0) {
            if (noQuestionsMsg) noQuestionsMsg.classList.add('hidden');
            if (startButton) startButton.disabled = false;
        } else {
            if (noQuestionsMsg) noQuestionsMsg.classList.remove('hidden');
            if (startButton) startButton.disabled = true;
        }
    }

    function startGame() {
        if (nameDisplay) nameDisplay.textContent = `Jugador: ${playerName}`;
        if (startScreenContainer) startScreenContainer.classList.add('hidden');
        if (gameModeContainer) gameModeContainer.classList.remove('hidden');
        currentQuestionIndex = 0;
        score = 0;
        timeBonusTotal = 0; 
        totalTime = 0; 
        if (timerSpan) timerSpan.textContent = timeLeft; 
        if (scoreSpan) scoreSpan.textContent = score; 
        quizQuestions.sort(() => Math.random() - 0.5);
        loadQuestion();
    }

    function startTimer() {
        timeLeft = 10;
        if (timerSpan) timerSpan.textContent = timeLeft; 
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeLeft--;
            if (timerSpan) timerSpan.textContent = timeLeft; 
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                handleAnswer(null); 
            }
        }, 1000);
    }

    function loadQuestion() {
        if (currentQuestionIndex >= quizQuestions.length) {
            showResults();
            return;
        }
        const currentQuestion = quizQuestions[currentQuestionIndex];
        if (!currentQuestion || !currentQuestion.options || currentQuestion.options.length === 0) {
            currentQuestionIndex++; 
            loadQuestion();
            return;
        }
        if (optionsContainer) optionsContainer.innerHTML = '';
        if (nextButtonContainer) nextButtonContainer.classList.add('hidden'); 
        if (questionElement) questionElement.textContent = `${currentQuestionIndex + 1}. ${currentQuestion.question}`;
        const shuffledOptions = [...currentQuestion.options].sort(() => Math.random() - 0.5);
        shuffledOptions.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option;
            button.className = 'option-btn'; 
            button.addEventListener('click', () => handleAnswer(option, button));
            if (optionsContainer) optionsContainer.appendChild(button);
        });
        if (nextButton) {
            nextButton.textContent = (currentQuestionIndex < quizQuestions.length - 1) ? "Siguiente Pregunta" : "Ver Resultados";
        }
        startTimer();
    }

    function handleAnswer(selectedOption, button) {
        clearInterval(timerInterval); 
        const currentQuestion = quizQuestions[currentQuestionIndex];
        const isCorrect = selectedOption === currentQuestion.answer;
        const allButtons = optionsContainer.querySelectorAll('.option-btn'); 
        allButtons.forEach(btn => {
            btn.disabled = true;
            if (btn.textContent === currentQuestion.answer) {
                btn.classList.add('correct'); 
            } else if (btn === button) { 
                btn.classList.add('incorrect'); 
            }
        });
        if (isCorrect) {
            score += timeLeft + 5; 
            timeBonusTotal += timeLeft; 
            if (scoreSpan) scoreSpan.textContent = score; 
        }
        setTimeout(() => {
            if (nextButtonContainer) nextButtonContainer.classList.remove('hidden'); 
        }, 1000); 
    }

    function showResults() {
        if (gameModeContainer) gameModeContainer.classList.add('hidden');
        if (nextButtonContainer) nextButtonContainer.classList.add('hidden');
        if (resultsContainer) resultsContainer.classList.remove('hidden');
        const numQuestions = quizQuestions.length;
        const totalPossibleTime = numQuestions * 10;
        totalTime = totalPossibleTime - timeBonusTotal; 
        if (totalTime < 0) totalTime = 0; 
        if (finalScoreElement) finalScoreElement.textContent = `¡${playerName}, tu puntuación final es de: ${score} puntos! Tiempo total: ${totalTime}s. ¡Gracias por jugar!`;
        const finalData = {
            name: playerName,
            score: score,
            time: totalTime, 
            timestamp: Date.now()
        };
        saveFinalResult(finalData); 
    }
}


// =======================================================================
// LÓGICA DEL JUEGO DE MEMORIA (memory.html)
// (Tu código original, sin cambios)
// =======================================================================

// 1. Carga las URLs de Firebase y prepara el tablero
async function setupMemoryGame() {
    const gridContainer = document.getElementById('memory-game-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = 'Cargando imágenes...';
    gridContainer.style.display = 'grid'; 
    gridContainer.style.opacity = '1';

    try {
        const snapshot = await get(memoryImagesRef);
        if (!snapshot.exists()) {
            gridContainer.innerHTML = '<p class="text-center text-red-500">Error: No se han cargado imágenes en el portal del anfitrión.</p>';
            return;
        }
        const imagesObject = snapshot.val();
        const imageUrls = Object.values(imagesObject).map(item => item.url);
        if (imageUrls.length < 2) {
            gridContainer.innerHTML = '<p class="text-center text-red-500">Se necesitan al menos 2 imágenes diferentes para jugar (mínimo 4 cartas).</p>';
            return;
        }
        const numPairs = Math.min(imageUrls.length, 8); 
        const totalCards = numPairs * 2;
        const columns = Math.ceil(Math.sqrt(totalCards));
        gridContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        const pairImages = imageUrls.slice(0, numPairs); 
        memoryGameImages = [...pairImages, ...pairImages];
        shuffle(memoryGameImages);
        gridContainer.innerHTML = ''; 
        memoryGameImages.forEach((url, index) => {
            const card = document.createElement('div');
            card.classList.add('card');
            card.setAttribute('data-image', url);
            card.dataset.index = index;
            card.innerHTML = `
                <div class="card-inner">
                    <div class="card-face card-back">🐝</div>
                    <div class="card-face card-front"><img src="${url}" alt="Memoria ${index}"></div>
                </div>
            `;
            card.addEventListener('click', flipCard);
            gridContainer.appendChild(card);
        });
    } catch (error) {
        console.error("Error al cargar imágenes para el juego de memoria:", error);
        gridContainer.innerHTML = '<p class="text-center text-red-500">Error al cargar el juego. Revisa la consola.</p>';
    }
}

// 2-6. Lógica de juego (flip, check, disable, unflip, reset)
function flipCard() {
    if (lockBoard) return;
    if (this === firstCard) return;
    if (!memoryTimer && matchCount === 0) {
        startMemoryTimer();
    }
    this.classList.add('flipped');
    if (!hasFlippedCard) {
        hasFlippedCard = true;
        firstCard = this;
        return;
    }
    secondCard = this;
    checkForMatch();
}
function checkForMatch() {
    const isMatch = firstCard.dataset.image === secondCard.dataset.image;
    if (isMatch) { disableCards(); } else { unflipCards(); }
}
function disableCards() {
    firstCard.removeEventListener('click', flipCard);
    secondCard.removeEventListener('click', flipCard);
    firstCard.classList.add('matched');
    secondCard.classList.add('matched');
    matchCount++;
    resetBoard();
    if (matchCount === memoryGameImages.length / 2) {
        setTimeout(showMemoryResults, 1000);
    }
}
function unflipCards() {
    lockBoard = true;
    setTimeout(() => {
        firstCard.classList.remove('flipped');
        secondCard.classList.remove('flipped');
        resetBoard();
    }, 1000);
}
function resetBoard() {
    [hasFlippedCard, lockBoard] = [false, false];
    [firstCard, secondCard] = [null, null];
}

// 7. Manejo del temporizador
function startMemoryTimer() {
    const timerDisplay = document.querySelector('#timer span');
    secondsElapsed = 0;
    if (timerDisplay) timerDisplay.textContent = secondsElapsed;
    memoryTimer = setInterval(() => {
        secondsElapsed++;
        if (timerDisplay) timerDisplay.textContent = secondsElapsed;
    }, 1000);
}
function stopMemoryTimer() {
    clearInterval(memoryTimer);
    memoryTimer = null;
}

// 8. Mostrar Resultados y Guardar en Firebase
function showMemoryResults() {
    stopMemoryTimer();
    const gameContainer = document.getElementById('game-mode-container');
    const resultsContainer = document.getElementById('results');
    const finalTimeElement = document.getElementById('final-time');
    if (gameContainer) gameContainer.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.remove('hidden');
    if (finalTimeElement) finalTimeElement.textContent = `¡${memoryPlayerName}, completaste el juego en: ${secondsElapsed} segundos!`;
    const finalData = { name: memoryPlayerName, time: secondsElapsed, timestamp: Date.now() };
    push(memoryRankingsRef, finalData)
        .then(() => console.log("Resultado de Memoria guardado con éxito."))
        .catch(error => console.error("Error al guardar el resultado de Memoria:", error));
}


// 9. FUNCIÓN DE INICIALIZACIÓN GLOBAL para memory.html
function initializeMemoryGame() {
    // --- NUEVO: Actualizar enlaces "Volver" ---
    document.querySelectorAll("button[onclick=\"window.location.href='index.html'\"]").forEach(btn => {
        btn.onclick = () => window.location.href = `index.html?event=${EVENT_ID}`;
    });

    // --- Lógica de MEMORIA ---
    const startScreen = document.getElementById('start-screen');
    const modalGameContainer = document.getElementById('modal-memory-game');
    const startButton = document.getElementById('start-btn');
    const nameInput = document.getElementById('player-name-input');
    const nameDisplay = document.getElementById('player-name-display');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const playAgainBtn = document.getElementById('play-again-modal-btn'); 

    if (!startButton || !modalGameContainer) return; 

    function startMemory() {
        const name = nameInput.value.trim();
        if (name.length > 0) {
            memoryPlayerName = name;
            if(nameDisplay) nameDisplay.textContent = `Jugador: ${memoryPlayerName}`;
            if (startScreen) startScreen.classList.add('hidden');
            if (modalGameContainer) modalGameContainer.classList.remove('hidden'); 
            const resultsContainer = document.getElementById('results');
            if (resultsContainer) resultsContainer.classList.add('hidden');
            matchCount = 0;
            secondsElapsed = 0;
            stopMemoryTimer(); 
            resetBoard(); 
            setupMemoryGame(); 
        } else {
            alert('Por favor, ingresa tu nombre para comenzar.');
        }
    }

    startButton.addEventListener('click', startMemory);
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (modalGameContainer) modalGameContainer.classList.add('hidden');
            if (startScreen) startScreen.classList.remove('hidden');
            stopMemoryTimer();
        });
    }
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => {
            const gameContainer = document.getElementById('game-mode-container');
            const resultsContainer = document.getElementById('results');
            if (resultsContainer) resultsContainer.classList.add('hidden');
            if (gameContainer) gameContainer.classList.remove('hidden'); 
            matchCount = 0;
            secondsElapsed = 0;
            stopMemoryTimer(); 
            resetBoard(); 
            setupMemoryGame();
        });
    }
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


// =======================================================================
// LÓGICA DEL JUEGO DEL AHORCADO (hangman.html)
// (Tu código original, sin cambios)
// =======================================================================

async function startHangmanGame() {
    const snapshot = await get(hangmanWordsRef);
    const wordsObject = snapshot.val();
    const wordList = wordsObject ? Object.values(wordsObject).map(item => item.word) : [];

    if (wordList.length === 0) {
        document.getElementById('game-status').textContent = "❌ ERROR: El anfitrión no ha cargado palabras para jugar.";
        document.querySelectorAll('.hangman-part').forEach(part => part.classList.add('hidden')); 
        return false;
    }
    const wordToUse = wordList[Math.floor(Math.random() * wordList.length)];
    const cleanWord = wordToUse.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ\s]/g, '');
    hangmanWord = cleanWord; 
    maskedWord = Array.from(hangmanWord).map(char => (char === ' ') ? ' ' : '_');
    guessedLetters = [];
    lives = 7; 
    updateHangmanDisplay();
    enableKeyboard();
    document.getElementById('game-status').textContent = 'Adivina la palabra. Tienes 7 intentos.';
    const playAgainBtn = document.getElementById('play-again-hangman-btn');
    if (playAgainBtn) playAgainBtn.classList.add('hidden');
    return true;
}

function updateHangmanDisplay() {
    const wordDisplay = document.getElementById('word-display');
    const lettersDisplay = document.getElementById('guessed-letters');
    const livesDisplay = document.getElementById('lives-display');
    const HANGMAN_PARTS_IDS = [
        '#hg-head', '#hg-body', '#hg-arm-l', '#hg-arm-r', '#hg-leg-l', '#hg-leg-r', '#hg-face'
    ];
    wordDisplay.textContent = maskedWord.join(' ');
    lettersDisplay.textContent = 'Letras usadas: ' + guessedLetters.join(', ');
    livesDisplay.textContent = `Vidas restantes: ${lives}`;
    const errors = 7 - lives;
    HANGMAN_PARTS_IDS.forEach((selector, index) => {
        const part = document.querySelector(selector);
        if (part) {
            if (index < errors) {
                part.classList.remove('hidden');
            } else {
                part.classList.add('hidden');
            }
        }
    });
}

function guessLetter(letter) {
    letter = letter.toUpperCase();
    if (lives === 0 || !maskedWord.includes('_')) return;
    const button = document.querySelector(`.key-btn[data-letter="${letter}"]`);
    if (button) button.disabled = true;
    if (guessedLetters.includes(letter)) return; 
    guessedLetters.push(letter);
    let found = false;
    for (let i = 0; i < hangmanWord.length; i++) {
        if (hangmanWord[i] === letter) {
            maskedWord[i] = letter;
            found = true;
        }
    }
    if (!found) {
        lives--;
        if (button) button.style.backgroundColor = '#F44336';
    } else {
        if (button) button.style.backgroundColor = 'var(--spring-green)';
    }
    updateHangmanDisplay();
    checkGameStatus();
}

function checkGameStatus() {
    const gameStatus = document.getElementById('game-status');
    const wordDisplay = document.getElementById('word-display');
    const playAgainBtn = document.getElementById('play-again-hangman-btn');
    if (!maskedWord.includes('_')) {
        gameStatus.textContent = `🎉 ¡FELICIDADES, ${hangmanPlayerName}! Adivinaste la palabra.`;
        wordDisplay.textContent = hangmanWord.split('').join(' ');
        disableKeyboard();
        playAgainBtn.classList.remove('hidden');
    } else if (lives === 0) {
        gameStatus.textContent = `💀 ¡TE AHORCASTE! La palabra era: ${hangmanWord}.`;
        wordDisplay.textContent = hangmanWord.split('').join(' ');
        disableKeyboard();
        playAgainBtn.classList.remove('hidden');
    } else {
        gameStatus.textContent = `Te quedan ${lives} intentos. ¡Sigue adivinando!`;
    }
}

// Lógica de Teclado (botones)
function enableKeyboard() {
    const keyboardContainer = document.getElementById('keyboard-container');
    if (!keyboardContainer) return;
    keyboardContainer.innerHTML = '';
    const alphabet = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
    const letters = Array.from(alphabet);
    letters.forEach(letter => {
        const button = document.createElement('button');
        button.textContent = letter;
        button.className = 'key-btn';
        button.dataset.letter = letter;
        button.addEventListener('click', (e) => {
            const btn = e.target;
            if (!btn.disabled) { 
                guessLetter(btn.dataset.letter);
            }
        });
        keyboardContainer.appendChild(button);
    });
}
function disableKeyboard() {
    const buttons = document.querySelectorAll('.key-btn');
    buttons.forEach(btn => btn.disabled = true);
}


// FUNCIÓN DE INICIALIZACIÓN GLOBAL para hangman.html
function initializeHangmanGame() {
    // --- NUEVO: Actualizar enlaces "Volver" ---
    document.querySelectorAll("button[onclick=\"window.location.href='index.html'\"]").forEach(btn => {
        btn.onclick = () => window.location.href = `index.html?event=${EVENT_ID}`;
    });

    // --- Lógica de AHORCADO ---
    const startScreen = document.getElementById('start-screen-hangman');
    const gameModeContainer = document.getElementById('game-mode-hangman');
    const startButton = document.getElementById('start-btn-hangman'); 
    const nameInput = document.getElementById('player-name-input-hangman');
    const nameDisplay = document.getElementById('player-name-display-hangman');
    const playAgainBtn = document.getElementById('play-again-hangman-btn');

    if (!startButton) return; 
    if (playAgainBtn) playAgainBtn.classList.add('hidden');

    async function handleStartGame() {
        const name = nameInput.value.trim();
        if (name.length > 0) {
            hangmanPlayerName = name.substring(0, 20);
            if(nameDisplay) nameDisplay.textContent = `Jugador: ${hangmanPlayerName}`;
            
            const success = await startHangmanGame(); 
            if (success) {
                if (startScreen) startScreen.classList.add('hidden');
                if (gameModeContainer) gameModeContainer.classList.remove('hidden');
                if (playAgainBtn) playAgainBtn.classList.add('hidden');
            } else {
                if (startScreen) startScreen.classList.remove('hidden');
                if (gameModeContainer) gameModeContainer.classList.add('hidden');
            }
        } else {
            alert('Por favor, ingresa tu nombre para comenzar.');
        }
    }
    startButton.addEventListener('click', handleStartGame);
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => {
            playAgainBtn.classList.add('hidden');
            handleStartGame();
        });
    }
}

// =======================================================================
// --- LÓGICA PARA LA PÁGINA DE RANKING (ranking.html) ---
// (Tu código original, sin cambios)
// =======================================================================
function initializeRankingPage() {
    listenForRankings(renderTriviaRanking);
    listenForMemoryRankings(renderMemoryRanking);
}


// =======================================================================
// ⭐️⭐️⭐️ INICIALIZACIÓN PRINCIPAL: REESTRUCTURADA CON AUTH ⭐️⭐️⭐️
// =======================================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Obtener el ID del evento (bloquea si no existe)
        EVENT_ID = getEventId();
        
        // 2. Cargar la configuración (bloquea si está inactivo o juegos off)
        await loadEventConfig(EVENT_ID);

        // 3. Asignar las referencias principales de la base de datos
        const basePath = `events/${EVENT_ID}/data`;
        questionsRef = ref(database, `${basePath}/questions`);
        rankingsRef = ref(database, `${basePath}/rankings`);
        memoryImagesRef = ref(database, `${basePath}/memoryImages`);
        memoryRankingsRef = ref(database, `${basePath}/memoryRankings`);
        hangmanWordsRef = ref(database, `${basePath}/hangmanWords`);

        // 4. NUEVO: Enrutador de Autenticación
        // Decide si la página es pública o protegida
        const path = window.location.pathname;

        if (path.includes('host.html')) {
            // Esta es una página protegida, necesita login de cliente
            handleHostAuth();
        } else {
            // Esta es una página pública (player, memory, hangman, ranking)
            // Simplemente la inicializamos
            initializeAppPage(path);
        }

    } catch (error) {
        // Si getEventId o loadEventConfig fallan, la app se detiene.
        console.error("Error al inicializar la aplicación:", error.message);
    }
});

/**
 * ⭐️ NUEVA FUNCIÓN: Maneja la autenticación de la página HOST
 * Verifica si el usuario logueado tiene permisos para ESTE evento.
 */
function handleHostAuth() {
    const loginContainer = document.getElementById('host-login-container');
    const panelContainer = document.getElementById('host-panel-container');
    const loginForm = document.getElementById('host-login-form');
    const loginError = document.getElementById('host-login-error');

    // Mostramos el login por defecto
    loginContainer.style.display = 'block';

    // Manejador del formulario de login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        const email = document.getElementById('host-login-email').value;
        const password = document.getElementById('host-login-password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Si el login es exitoso, el 'onAuthStateChanged' se encargará del resto
        } catch (error) {
            console.error("Error de login:", error.message);
            loginError.textContent = "Error: Email o contraseña incorrecta.";
        }
    });

    // Escuchamos los cambios de Auth
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // --- Verificación de Permiso ---
            // ¿Este usuario (user.uid) tiene permiso para ESTE evento (EVENT_ID)?
            // ⭐️ CORRECCIÓN: Apuntar a la ruta correcta según tu JSON
            // Se busca el 'admin_uid' directamente dentro del evento.
            const adminRef = ref(database, `events/${EVENT_ID}/admin_uid`);
            let snapshot;
            try {
                snapshot = await get(adminRef);
            } catch (dbError) {
                // Esto probablemente ocurra si las reglas de la DB no están puestas
                console.error("Error al leer permisos de la DB:", dbError.message);
                loginError.textContent = "Error de permisos. Contacta al administrador.";
                signOut(auth);
                return;
            }

            if (snapshot.exists() && snapshot.val() === user.uid) {
                // ¡PERMISO CONCEDIDO!
                loginContainer.style.display = 'none';
                panelContainer.style.display = 'block';

                // Añadimos botón de "Salir"
                const header = panelContainer.querySelector('header');
                if (header && !document.getElementById('host-logout-btn')) {
                    header.insertAdjacentHTML('afterbegin', '<button id="host-logout-btn" style="background: #ef4444; color: white; padding: 5px 10px; border-radius: 5px; float: right; cursor: pointer;">Salir</button>');
                    document.getElementById('host-logout-btn').addEventListener('click', () => {
                        if(confirm("¿Seguro que quieres salir del panel?")) {
                            signOut(auth);
                        }
                    });
                }
                
                // Ahora sí, inicializamos el panel de Host
                initializeHost();
            } else {
                // Logueado pero SIN permiso para este evento
                signOut(auth);
                loginError.textContent = "No tienes permiso para ver este evento.";
                loginContainer.style.display = 'block';
                panelContainer.style.display = 'none';
            }
        } else {
            // Usuario no logueado
            loginContainer.style.display = 'block';
            panelContainer.style.display = 'none';
        }
    });
}

/**
 * ⭐️ NUEVA FUNCIÓN: Inicializa la página pública solicitada
 * (Esto es el 'else' de tu 'DOMContentLoaded' original)
 */
function initializeAppPage(path) {
    if (path.includes('player.html')) {
        initializePlayer();
    } else if (path.includes('memory.html')) {
        initializeMemoryGame();
    } else if (path.includes('hangman.html')) {
        initializeHangmanGame();
    } else if (path.includes('ranking.html')) {
        initializeRankingPage();
    }
}