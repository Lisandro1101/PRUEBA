import { EVENT_ID } from "../core/state.js";
import { subscribeToQuestions, saveTriviaScore } from "../services/triviaService.js";

// === ESTADO DEL JUEGO ===
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timerInterval;
let timeLeft = 10;
let timeBonusTotal = 0; // ⭐️ Restaurado para cálculo exacto de tiempo final
let triviaPlayerName = "";

/**
 * Inicializa la lógica de la página de Trivia (player.html)
 */
export function initTriviaGame() {
    console.log("Inicializando Controlador de Trivia...");
    
    // 1. Configurar botones de "Volver"
    const backBtns = document.querySelectorAll("button[onclick=\"window.location.href='index.html'\"]");
    backBtns.forEach(btn => btn.onclick = () => window.location.href = `index.html?event=${EVENT_ID}`);

    const startForm = document.getElementById('start-form');
    const nextBtn = document.getElementById('next-btn');

    // 2. Escuchar preguntas desde Firebase
    subscribeToQuestions(EVENT_ID, (data) => {
        questions = data;
        const noQMsg = document.getElementById('player-no-questions-msg');
        const startBtn = document.getElementById('start-game-btn');
        
        // Mostrar/Ocultar mensaje de "No hay preguntas"
        if (questions.length > 0) {
            if (noQMsg) noQMsg.classList.add('hidden');
            if (startBtn) startBtn.disabled = false;
        } else {
            if (noQMsg) noQMsg.classList.remove('hidden');
            if (startBtn) startBtn.disabled = true;
        }
    });

    // 3. Manejar Inicio del Juego
    if (startForm) {
        startForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('player-name-input');
            const name = nameInput.value.trim();
            if (!name) return alert("Por favor ingresa un nombre.");
            
            triviaPlayerName = name.substring(0, 20);
            if (questions.length > 0) {
                startGame();
            } else {
                alert("El anfitrión aún no cargó preguntas.");
            }
        });
    }

    // 4. Manejar Botón Siguiente
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentQuestionIndex++;
            loadQuestion();
        });
    }
}

function startGame() {
    // Cambiar pantallas
    const startScreen = document.getElementById('start-screen');
    const gameMode = document.getElementById('game-mode');
    const nameDisplay = document.getElementById('player-name-display');

    if (startScreen) startScreen.classList.add('hidden');
    if (gameMode) gameMode.classList.remove('hidden');
    if (nameDisplay) nameDisplay.textContent = `Jugador: ${triviaPlayerName}`;
    
    // Resetear variables
    currentQuestionIndex = 0;
    score = 0;
    timeBonusTotal = 0;
    
    // Mezclar preguntas aleatoriamente
    questions.sort(() => Math.random() - 0.5);
    
    updateScoreUI();
    loadQuestion();
}

function loadQuestion() {
    // Verificar si terminamos
    if (currentQuestionIndex >= questions.length) {
        endGame();
        return;
    }

    const q = questions[currentQuestionIndex];
    
    // Validación de seguridad: Si la pregunta está rota, saltarla
    if (!q || !q.options || q.options.length === 0) {
        currentQuestionIndex++;
        loadQuestion();
        return;
    }

    // --- MANEJO INTELIGENTE DE UI (Evita el error de classList null) ---
    // Intentamos buscar el contenedor. Si no existe, usamos el botón directo.
    const nextBtnContainer = document.getElementById('next-button-fixed-container');
    const nextBtn = document.getElementById('next-btn');

    if (nextBtnContainer) {
        nextBtnContainer.classList.add('hidden');
    } else if (nextBtn) {
        nextBtn.classList.add('hidden'); // Fallback si no hay contenedor
    }

    const optionsContainer = document.getElementById('options-container');
    if (optionsContainer) optionsContainer.innerHTML = '';

    const questionEl = document.getElementById('question');
    if (questionEl) questionEl.textContent = `${currentQuestionIndex + 1}. ${q.question}`;
    
    if (nextBtn) {
        nextBtn.textContent = (currentQuestionIndex < questions.length - 1) ? "Siguiente Pregunta" : "Ver Resultados";
    }

    // Renderizar Opciones
    const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
    shuffledOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.textContent = opt;
        btn.className = 'option-btn';
        // Usamos una función anónima para pasar los argumentos
        btn.onclick = () => handleAnswer(opt, btn);
        if (optionsContainer) optionsContainer.appendChild(btn);
    });

    startTimer();
}

function startTimer() {
    timeLeft = 10;
    const timerSpan = document.querySelector('#timer span');
    if (timerSpan) timerSpan.textContent = timeLeft;
    
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        timeLeft--;
        if (timerSpan) timerSpan.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleAnswer(null, null); // Tiempo agotado
        }
    }, 1000);
}

function handleAnswer(selectedOpt, btnElement) {
    clearInterval(timerInterval);
    const q = questions[currentQuestionIndex];
    
    // Determinar si acertó (si selectedOpt es null es porque se acabó el tiempo)
    const isCorrect = selectedOpt === q.answer;

    // Deshabilitar botones y mostrar colores
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === q.answer) {
            btn.classList.add('correct');
        } else if (btn === btnElement) {
            btn.classList.add('incorrect');
        }
    });

    if (isCorrect) {
        // ⭐️ FÓRMULA ORIGINAL: Puntos base (5) + Tiempo restante
        score += timeLeft + 5; 
        timeBonusTotal += timeLeft; // Acumulamos para el cálculo final de tiempo
        updateScoreUI();
    }

    // Mostrar botón siguiente tras breve pausa
    setTimeout(() => {
        const nextBtnContainer = document.getElementById('next-button-fixed-container');
        const nextBtn = document.getElementById('next-btn');
        
        if (nextBtnContainer) {
            nextBtnContainer.classList.remove('hidden');
        } else if (nextBtn) {
            nextBtn.classList.remove('hidden');
        }
    }, 500);
}

function updateScoreUI() {
    const scoreSpan = document.querySelector('#score span');
    if (scoreSpan) scoreSpan.textContent = score;
}

function endGame() {
    const gameMode = document.getElementById('game-mode');
    const resultsDiv = document.getElementById('results');
    
    // Ocultar juego y botón siguiente (buscando ambos por seguridad)
    if (gameMode) gameMode.classList.add('hidden');
    
    const nextBtnContainer = document.getElementById('next-button-fixed-container');
    const nextBtn = document.getElementById('next-btn');
    if (nextBtnContainer) nextBtnContainer.classList.add('hidden');
    else if (nextBtn) nextBtn.classList.add('hidden');

    if (resultsDiv) resultsDiv.classList.remove('hidden');

    const finalScoreText = document.getElementById('final-score');
    
    // ⭐️ CÁLCULO DE TIEMPO ORIGINAL
    // Tiempo total posible (preguntas * 10) - Tiempo ahorrado (bonus)
    const totalPossibleTime = questions.length * 10;
    let totalTimeUsed = totalPossibleTime - timeBonusTotal;
    if (totalTimeUsed < 0) totalTimeUsed = 0;

    if (finalScoreText) {
        finalScoreText.textContent = `¡${triviaPlayerName}, tu puntuación final es de: ${score} puntos! Tiempo total: ${totalTimeUsed}s.`;
    }

    // Guardar en Firebase
    saveTriviaScore(EVENT_ID, {
        name: triviaPlayerName,
        score: score,
        time: totalTimeUsed, 
        timestamp: Date.now()
    });
}