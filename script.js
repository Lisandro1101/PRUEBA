// =======================================================================
// FIREBASE CONFIGURATION (CORREGIDO)
// =======================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
// --- NUEVO --- Importaciones de Storage para subir y borrar imágenes
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

// =======================================================================
// INICIALIZACIÓN DE FIREBASE Y VARIABLES GLOBALES
// =======================================================================

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app); 

// Referencias de la Trivia
const questionsRef = ref(database, 'questions'); 
const rankingsRef = ref(database, 'rankings'); 

// --- Referencias del Juego de Memoria
const memoryImagesRef = ref(database, 'memoryImages'); // Guarda URLs de imágenes
const memoryRankingsRef = ref(database, 'memoryRankings'); // Guarda tiempos del juego

// --- Referencias del Juego del Ahorcado (NUEVO)
const hangmanWordsRef = ref(database, 'hangmanWords'); 

let quizQuestions = []; 
let currentQuestionIndex = 0;
let score = 0;
let timerInterval;
let timeLeft = 10;
let playerName = 'Jugador Anónimo';
let timeBonusTotal = 0; 
let totalTime = 0; 


// =======================================================================
// FUNCIONES DE UTILIDAD (TRIVIA)
// =======================================================================

function fixFirebaseArray(data) {
    if (data && data.options && !Array.isArray(data.options) && typeof data.options === 'object') {
        data.options = Object.values(data.options);
    }
    return data;
}

// =======================================================================
// FUNCIONES DE ALMACENAMIENTO (TRIVIA)
// =======================================================================

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
    const questionToRemoveRef = ref(database, `questions/${id}`);
    return remove(questionToRemoveRef);
}

function saveFinalResult(data) {
    return push(rankingsRef, data);
}

// =======================================================================
// --- FUNCIONES DE ALMACENAMIENTO (JUEGO DE MEMORIA)
// =======================================================================

async function uploadMemoryImages(files, progressCallback, statusCallback) {
    const uploadPromises = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uniqueName = `${Date.now()}-${file.name}`;
        const sRef = storageRef(storage, `memory_game_images/${uniqueName}`);
        
        statusCallback(`Subiendo ${i + 1} de ${files.length}: ${file.name}`);
        
        const uploadTask = uploadBytesResumable(sRef, file);

        const uploadPromise = new Promise((resolve, reject) => {
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    progressCallback(progress); 
                }, 
                (error) => {
                    console.error("Error de subida:", error);
                    reject(error);
                }, 
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    const imageData = {
                        url: downloadURL,
                        storagePath: sRef.fullPath, 
                        name: file.name
                    };
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
        
        const dbImgRef = ref(database, `memoryImages/${id}`);
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


// =======================================================================
// MODO ANFITRIÓN (host.html)
// =======================================================================

function initializeHost() {
    // --- Lógica de TRIVIA ---
    const form = document.getElementById('question-form');
    const questionsList = document.getElementById('questions-list');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const rankingContainer = document.getElementById('ranking-list');

    listenForQuestions(renderQuestionsList);
    listenForRankings(); 

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

    function renderQuestionsList() {
        questionsList.innerHTML = '';
        if (quizQuestions.length === 0) {
            questionsList.innerHTML = '<li class="text-gray-500 italic p-2">Aún no hay preguntas cargadas...</li>';
            clearAllBtn.classList.add('hidden');
            return;
        }
        clearAllBtn.classList.remove('hidden');
        quizQuestions.forEach((q, index) => {
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

    function listenForRankings() {
        onValue(rankingsRef, (snapshot) => {
            const data = snapshot.val();
            let rankingList = [];
            if (data) {
                Object.keys(data).forEach(key => {
                    rankingList.push(data[key]);
                });
            }
            renderRanking(rankingList);
        });
    }

    function renderRanking(results) {
        results.forEach(r => {
            r.rankingValue = r.score - (r.time / 10); 
        });
        
        results.sort((a, b) => {
            if (b.rankingValue !== a.rankingValue) return b.rankingValue - a.rankingValue;
            if (b.score !== a.score) return b.score - a.score;
            return a.time - b.time;
        });
        
        rankingContainer.innerHTML = '';
        if (results.length === 0) {
            rankingContainer.innerHTML = '<li class="p-2 text-gray-500 italic text-center">Aún no hay resultados...</li>';
            return;
        }
        results.forEach((r, index) => {
            const li = document.createElement('li');
            li.className = `question-item ${index === 0 ? 'top-winner' : ''}`;
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
            rankingContainer.appendChild(li);
        });
    }

    // --------------------------------------------------
    // --- Lógica del JUEGO DE MEMORIA
    // --------------------------------------------------
    const memoryForm = document.getElementById('memory-image-form');
    const memoryFilesInput = document.getElementById('memory-files');
    const memoryImagesList = document.getElementById('memory-images-list');
    const clearMemoryImagesBtn = document.getElementById('clear-memory-images-btn');
    const memoryRankingContainer = document.getElementById('memory-ranking-list');
    
    // Elementos de la barra de progreso
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
            const progressCallback = (progress) => {
                progressBar.style.width = `${progress}%`;
            };
            const statusCallback = (status) => {
                progressStatus.textContent = status;
            };

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

    function renderMemoryRanking(results) {
        results.sort((a, b) => a.time - b.time); 

        memoryRankingContainer.innerHTML = '';
        if (results.length === 0) {
            memoryRankingContainer.innerHTML = '<li class="p-2 text-gray-500 italic text-center">Aún no hay resultados...</li>';
            return;
        }

        results.forEach((r, index) => {
            const li = document.createElement('li');
            li.className = `question-item ${index === 0 ? 'top-winner' : ''}`; 
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
            memoryRankingContainer.appendChild(li);
        });
    }

    // --------------------------------------------------
    // --- Lógica del JUEGO DEL AHORCADO (Hangman) - CORREGIDO
    // --------------------------------------------------
    const hangmanForm = document.getElementById('hangman-word-form');
    const hangmanWordInput = document.getElementById('h-word');
    const hangmanWordsList = document.getElementById('hangman-words-list');
    const clearHangmanWordsBtn = document.getElementById('clear-hangman-words-btn');

    let hangmanWords = [];

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
            hangmanWords = words;
            renderCallback(words);
        });
    }
    
    // Llamar a la escucha al inicializar el host
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
                const wordRef = ref(database, `hangmanWords/${idToDelete}`);
                await remove(wordRef);
            } catch (error) {
                console.error("Error al eliminar la palabra:", error);
            }
        }
    });

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
// =======================================================================

function initializePlayer() {
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
// =======================================================================

let memoryGameImages = []; 
let hasFlippedCard = false;
let lockBoard = false;
let firstCard, secondCard;
let matchCount = 0;
let memoryTimer = null;
let secondsElapsed = 0;
let memoryPlayerName = '';

// 1. Carga las URLs de Firebase y prepara el tablero
async function setupMemoryGame() {
    const gridContainer = document.getElementById('memory-game-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = 'Cargando imágenes...';
    
    // Una vez que la cuadrícula se carga, aseguramos que se muestre (si la ocultamos con CSS)
    gridContainer.style.display = 'grid'; 
    gridContainer.style.opacity = '1';

    try {
        // 🚨 Es vital que estas herramientas de Firebase (get) estén importadas en script.js
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

        // Determinar el número de pares y ajustar la cuadrícula
        const numPairs = Math.min(imageUrls.length, 8); // Máximo 8 pares (16 cartas)
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
            
            // 🚨 CORRECCIÓN CLAVE: Estructura HTML para el giro 3D:
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

// 2. Lógica para voltear una carta
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

// 3. Verificar si hay pareja
function checkForMatch() {
    const isMatch = firstCard.dataset.image === secondCard.dataset.image;

    if (isMatch) {
        disableCards();
    } else {
        unflipCards();
    }
}

// 4. Bloquear las cartas si hay pareja
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

// 5. Voltear las cartas si no hay pareja
function unflipCards() {
    lockBoard = true;

    setTimeout(() => {
        firstCard.classList.remove('flipped');
        secondCard.classList.remove('flipped');
        resetBoard();
    }, 1000);
}

// 6. Reiniciar las variables de control
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
    
    const finalData = {
        name: memoryPlayerName,
        time: secondsElapsed, 
        timestamp: Date.now()
    };
    push(memoryRankingsRef, finalData)
        .then(() => console.log("Resultado de Memoria guardado con éxito."))
        .catch(error => console.error("Error al guardar el resultado de Memoria:", error));
}


// 9. FUNCIÓN DE INICIALIZACIÓN GLOBAL para memory.html
function initializeMemoryGame() {
    const startScreen = document.getElementById('start-screen');
    const modalGameContainer = document.getElementById('modal-memory-game'); // 🚨 NUEVO: El contenedor flotante
    const startButton = document.getElementById('start-btn');
    const nameInput = document.getElementById('player-name-input');
    const nameDisplay = document.getElementById('player-name-display');
    const closeModalBtn = document.getElementById('close-modal-btn'); // 🚨 NUEVO: Botón para cerrar el modal

    if (!startButton || !modalGameContainer) return; // Salir si los elementos necesarios no están presentes

    // --- LÓGICA PARA INICIAR EL JUEGO (ABRIR MODAL) ---
    startButton.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name.length > 0) {
            memoryPlayerName = name;
            if(nameDisplay) nameDisplay.textContent = `Jugador: ${memoryPlayerName}`;
            
            if (startScreen) startScreen.classList.add('hidden');
            // 🚨 MODIFICACIÓN: Mostramos el contenedor MODAL en lugar del contenedor interno
            if (modalGameContainer) modalGameContainer.classList.remove('hidden'); 
            
            matchCount = 0;
            secondsElapsed = 0;
            stopMemoryTimer(); 
            resetBoard(); 
            setupMemoryGame();

        } else {
            alert('Por favor, ingresa tu nombre para comenzar.');
        }
    });
    
    // --- LÓGICA PARA CERRAR EL MODAL Y VOLVER (BOTÓN 'X') ---
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            // Oculta el modal de juego
            if (modalGameContainer) modalGameContainer.classList.add('hidden');
            // Muestra la pantalla de inicio (formulario de nombre)
            if (startScreen) startScreen.classList.remove('hidden');
            // Detiene el temporizador si estaba corriendo
            stopMemoryTimer();
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
// LÓGICA DEL JUEGO DEL AHORCADO (hangman.html) - CORREGIDO
// =======================================================================

let hangmanWord = '';
let maskedWord = [];
let guessedLetters = [];
let lives = 7; // El número de errores
let hangmanPlayerName = '';

// En script.js (alrededor de la línea 744 en el código proporcionado)
async function startHangmanGame() {
    // 1. Obtener la lista de palabras
    const snapshot = await get(hangmanWordsRef);
    const wordsObject = snapshot.val();
    const wordList = wordsObject ? Object.values(wordsObject).map(item => item.word) : [];

    if (wordList.length === 0) {
        // 🚨 CORREGIDO: Ya no se usa HANGMAN_ASCII ni #hangman-art.
        document.getElementById('game-status').textContent = "❌ ERROR: El anfitrión no ha cargado palabras para jugar.";
        // Ocultamos todas las partes para que solo se vea la horca vacía
        document.querySelectorAll('.hangman-part').forEach(part => part.classList.add('hidden')); 
        return false;
    }

    // 2. Reiniciar el estado del juego
    const wordToUse = wordList[Math.floor(Math.random() * wordList.length)];
    // Limpia espacios y caracteres no alfabéticos para enmascarar
    const cleanWord = wordToUse.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ\s]/g, '');
    hangmanWord = cleanWord; 
    
    maskedWord = Array.from(hangmanWord).map(char => {
        if (char === ' ') return ' ';
        return '_';
    });
    
    guessedLetters = [];
    lives = 7; 
    
    // 3. Renderizar la interfaz inicial
    updateHangmanDisplay();
    enableKeyboard();
    document.getElementById('game-status').textContent = 'Adivina la palabra. Tienes 7 intentos.';
    
    // Ocultar botón de jugar de nuevo
    const playAgainBtn = document.getElementById('play-again-hangman-btn');
    if (playAgainBtn) playAgainBtn.classList.add('hidden');
    
    return true;
}
// En script.js, busca la función updateHangmanDisplay() y reemplázala:
function updateHangmanDisplay() {
    const wordDisplay = document.getElementById('word-display');
    const lettersDisplay = document.getElementById('guessed-letters');
    const livesDisplay = document.getElementById('lives-display');
    
    // 🚨 NUEVO: Lista de selectores CSS para las 7 partes del cuerpo
    const HANGMAN_PARTS_IDS = [
        '#hg-head', '#hg-body', '#hg-arm-l', '#hg-arm-r', '#hg-leg-l', '#hg-leg-r', '#hg-face'
    ];
    
    wordDisplay.textContent = maskedWord.join(' ');
    lettersDisplay.textContent = 'Letras usadas: ' + guessedLetters.join(', ');
    livesDisplay.textContent = `Vidas restantes: ${lives}`;

    // Obtener el número de errores cometidos (0 a 7)
    const errors = 7 - lives;

    // --- LÓGICA DE DIBUJO CSS ---
    HANGMAN_PARTS_IDS.forEach((selector, index) => {
        const part = document.querySelector(selector);
        if (part) {
            // El índice (0 a 6) representa la cantidad de errores necesarios para mostrar la parte.
            if (index < errors) {
                // Si el número de errores actual es suficiente, muestra la parte
                part.classList.remove('hidden');
            } else {
                // De lo contrario, oculta la parte
                part.classList.add('hidden');
            }
        }
    });

    // NOTA: La lógica de la barra de arte ASCII (hangmanArt) se elimina con este nuevo método.
}

function guessLetter(letter) {
    letter = letter.toUpperCase();

    // Bloquear si el juego ya terminó
    if (lives === 0 || !maskedWord.includes('_')) return;
    
    // Desactivar el botón de la letra
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
        if (button) button.style.backgroundColor = '#F44336'; // Rojo para incorrecto
    } else {
        if (button) button.style.backgroundColor = 'var(--spring-green)'; // Verde para correcto
    }

    updateHangmanDisplay();
    checkGameStatus();
}

function checkGameStatus() {
    const gameStatus = document.getElementById('game-status');
    const wordDisplay = document.getElementById('word-display');
    const playAgainBtn = document.getElementById('play-again-hangman-btn');

    if (!maskedWord.includes('_')) {
        // ¡Ganó!
        gameStatus.textContent = `🎉 ¡FELICIDADES, ${hangmanPlayerName}! Adivinaste la palabra.`;
        wordDisplay.textContent = hangmanWord.split('').join(' ');
        disableKeyboard();
        playAgainBtn.classList.remove('hidden');
    } else if (lives === 0) {
        // ¡Perdió!
        gameStatus.textContent = `💀 ¡TE AHORCASTE! La palabra era: ${hangmanWord}.`;
        wordDisplay.textContent = hangmanWord.split('').join(' ');
        disableKeyboard();
        playAgainBtn.classList.remove('hidden');
    } else {
        gameStatus.textContent = `Te quedan ${lives} intentos. ¡Sigue adivinando!`;
    }
}

// --------------------------------------------------
// Lógica de Teclado (botones)
// --------------------------------------------------

function enableKeyboard() {
    const keyboardContainer = document.getElementById('keyboard-container');
    if (!keyboardContainer) return;
    
    keyboardContainer.innerHTML = '';
    
    const alphabet = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
    const letters = Array.from(alphabet);
    
    letters.forEach(letter => {
        const button = document.createElement('button');
        button.textContent = letter;
        button.className = 'key-btn'; // Clase CSS nueva para los botones de teclado
        button.dataset.letter = letter;
        button.addEventListener('click', (e) => {
            const btn = e.target;
            // Solo procesar si no está deshabilitado por haber sido presionado antes
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


// --------------------------------------------------
// FUNCIÓN DE INICIALIZACIÓN GLOBAL para hangman.html
// --------------------------------------------------

function initializeHangmanGame() {
    const startScreen = document.getElementById('start-screen-hangman');
    const gameModeContainer = document.getElementById('game-mode-hangman');
    // 🚨 CORREGIDO: Usar el ID del botón en hangman.html
    const startButton = document.getElementById('start-btn-hangman'); 
    const nameInput = document.getElementById('player-name-input-hangman');
    const nameDisplay = document.getElementById('player-name-display-hangman');
    const playAgainBtn = document.getElementById('play-again-hangman-btn');

    if (!startButton) return; 

    // Ocultar botón "Jugar de Nuevo" al iniciar
    if (playAgainBtn) playAgainBtn.classList.add('hidden');

    // Manejador para iniciar o jugar de nuevo
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
                 // Si falla la carga de palabras, vuelve a mostrar la pantalla de inicio por si acaso
                if (startScreen) startScreen.classList.remove('hidden');
                if (gameModeContainer) gameModeContainer.classList.add('hidden');
            }
        } else {
            alert('Por favor, ingresa tu nombre para comenzar.');
        }
    }

    startButton.addEventListener('click', handleStartGame);
    
    // El botón "Jugar de Nuevo" solo necesita re-ejecutar el inicio del juego
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => {
             // Oculta el botón inmediatamente
            playAgainBtn.classList.add('hidden');
            handleStartGame();
        });
    }

}

// =======================================================================
// INICIALIZACIÓN PRINCIPAL: DETECCIÓN DE PÁGINA (ESTO SE MANTIENE IGUAL)
// =======================================================================

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // Detecta la página y llama a la única función de inicialización necesaria
    if (path.includes('host.html')) {
        initializeHost();
    } else if (path.includes('player.html')) {
        initializePlayer();
    } else if (path.includes('memory.html')) {
        // Llama a la lógica de inicialización del juego de memoria
        initializeMemoryGame();
    } else if (path.includes('hangman.html')) {
        // 🚨 NUEVA INICIALIZACIÓN CORRECTA
        initializeHangmanGame();
    }
});