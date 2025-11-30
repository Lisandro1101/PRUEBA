import { EVENT_ID } from "../core/state.js";
import { getHangmanWordsOnce } from "../services/hangmanService.js";

// Estado local
let hangmanWord = '';
let maskedWord = [];
let guessedLetters = [];
let lives = 7;
let hangmanPlayerName = '';

export function initHangmanGame() {
    console.log("Inicializando Ahorcado...");

    // Botones Volver
    document.querySelectorAll("button[onclick=\"window.location.href='index.html'\"]").forEach(btn => {
        btn.onclick = () => window.location.href = `index.html?event=${EVENT_ID}`;
    });

    const startBtn = document.getElementById('start-btn-hangman');
    const playAgainBtn = document.getElementById('play-again-hangman-btn');

    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            const name = document.getElementById('player-name-input-hangman').value.trim();
            if (name.length === 0) return alert("Ingresa tu nombre.");
            
            hangmanPlayerName = name;
            document.getElementById('player-name-display-hangman').textContent = `Jugador: ${name}`;
            
            const success = await startGame();
            if (success) {
                document.getElementById('start-screen-hangman').classList.add('hidden');
                document.getElementById('game-mode-hangman').classList.remove('hidden');
                if(playAgainBtn) playAgainBtn.classList.add('hidden');
            }
        });
    }

    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', async () => {
            playAgainBtn.classList.add('hidden');
            await startGame();
        });
    }

    // Limpiar visualmente al cargar
    updateDisplay(); 
}

async function startGame() {
    const words = await getHangmanWordsOnce(EVENT_ID);
    if (words.length === 0) {
        document.getElementById('game-status').textContent = "❌ El anfitrión no cargó palabras.";
        return false;
    }

    // Elegir palabra al azar
    const rawWord = words[Math.floor(Math.random() * words.length)];
    hangmanWord = rawWord.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ\s]/g, ''); // Limpiar caracteres raros
    
    maskedWord = Array.from(hangmanWord).map(c => c === ' ' ? ' ' : '_');
    guessedLetters = [];
    lives = 7;

    createKeyboard();
    updateDisplay();
    document.getElementById('game-status').textContent = 'Adivina la palabra. 7 intentos.';
    
    return true;
}

function updateDisplay() {
    const wordDisplay = document.getElementById('word-display');
    const lettersDisplay = document.getElementById('guessed-letters');
    const livesDisplay = document.getElementById('lives-display');

    // Actualizar textos
    if(wordDisplay) wordDisplay.textContent = maskedWord.join(' ');
    if(lettersDisplay) lettersDisplay.textContent = 'Usadas: ' + guessedLetters.join(', ');
    if(livesDisplay) livesDisplay.textContent = `Vidas: ${lives}`;

    // Actualizar Dibujo
    const PARTS = ['hg-head', 'hg-body', 'hg-arm-l', 'hg-arm-r', 'hg-leg-l', 'hg-leg-r', 'hg-face'];
    document.querySelectorAll('.hangman-part').forEach(p => p.style.display = 'none');
    
    const errors = 7 - lives;
    for (let i = 0; i < errors; i++) {
        if (i < PARTS.length) {
            const part = document.getElementById(PARTS[i]);
            if (part) {
                part.classList.remove('hidden');
                part.style.display = 'block';
            }
        }
    }
}

function createKeyboard() {
    const container = document.getElementById('keyboard-container');
    if (!container) return;
    container.innerHTML = '';

    const letters = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split('');
    letters.forEach(char => {
        const btn = document.createElement('button');
        btn.textContent = char;
        btn.className = 'key-btn';
        btn.dataset.letter = char;
        btn.onclick = (e) => guessLetter(char, e.target);
        container.appendChild(btn);
    });
}

function guessLetter(char, btn) {
    if (lives === 0 || !maskedWord.includes('_')) return; // Juego terminado

    btn.disabled = true;
    if (guessedLetters.includes(char)) return;
    guessedLetters.push(char);

    let found = false;
    for (let i = 0; i < hangmanWord.length; i++) {
        if (hangmanWord[i] === char) {
            maskedWord[i] = char;
            found = true;
        }
    }

    if (found) {
        btn.style.backgroundColor = 'var(--spring-green)';
    } else {
        lives--;
        btn.style.backgroundColor = '#F44336';
    }

    updateDisplay();
    checkWinCondition();
}

function checkWinCondition() {
    const status = document.getElementById('game-status');
    const playAgainBtn = document.getElementById('play-again-hangman-btn');
    const wordDisplay = document.getElementById('word-display');

    if (!maskedWord.includes('_')) {
        status.textContent = `🎉 ¡Ganaste, ${hangmanPlayerName}!`;
        wordDisplay.textContent = hangmanWord;
        disableKeyboard();
        playAgainBtn.classList.remove('hidden');
    } else if (lives === 0) {
        status.textContent = `💀 Perdiste. Era: ${hangmanWord}`;
        wordDisplay.textContent = hangmanWord.split('').join(' '); // Mostrar completa
        disableKeyboard();
        playAgainBtn.classList.remove('hidden');
    }
}

function disableKeyboard() {
    document.querySelectorAll('.key-btn').forEach(b => b.disabled = true);
}