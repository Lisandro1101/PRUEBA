import { EVENT_ID } from "../core/state.js";
import { subscribeToMemoryImages, saveMemoryScore } from "../services/memoryService.js";

// Estado del juego
let memoryGameImages = []; 
let availableImages = []; // Imágenes cargadas desde Firebase
let hasFlippedCard = false;
let lockBoard = false;
let firstCard, secondCard;
let matchCount = 0;
let memoryTimer = null;
let secondsElapsed = 0;
let memoryPlayerName = '';
let msnry; // Variable para la instancia de Masonry

export function initMemoryGame() {
    console.log("Inicializando Memoria...");
    
    // Botones Volver
    document.querySelectorAll("button[onclick=\"window.location.href='index.html'\"]").forEach(btn => {
        btn.onclick = () => window.location.href = `index.html?event=${EVENT_ID}`;
    });

    // Suscribirse a imágenes (para tenerlas listas antes de jugar)
    subscribeToMemoryImages(EVENT_ID, (images) => {
        availableImages = images.map(img => img.url);
    });

    // Elementos UI
    const startBtn = document.getElementById('start-btn');
    const modal = document.getElementById('modal-memory-game');
    const closeBtn = document.getElementById('close-modal-btn');
    const playAgainBtn = document.getElementById('play-again-modal-btn');
    const startScreen = document.getElementById('start-screen');
    const resultsDiv = document.getElementById('results');

    // Iniciar
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const name = document.getElementById('player-name-input').value.trim();
            if (name.length === 0) return alert("Ingresa tu nombre.");
            
            memoryPlayerName = name;
            document.getElementById('player-name-display').textContent = `Jugador: ${name}`;
            
            startScreen.classList.add('d-none');
            if(resultsDiv) resultsDiv.classList.add('d-none');
            // Bootstrap maneja el modal, pero nos aseguramos que el contenedor del juego esté visible
            document.getElementById('game-mode-container').classList.remove('d-none');
            
            resetGame();
        });
    }

    // Cerrar / Jugar de nuevo
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('d-block'); // Asumiendo que se usa un modal simple
            startScreen.classList.remove('d-none');
            stopTimer();
        });
    }

    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => {
            document.getElementById('game-mode-container').classList.remove('d-none');
            resultsDiv.classList.add('d-none');
            resetGame();
        });
    }
}

function resetGame() {
    matchCount = 0;
    secondsElapsed = 0;
    stopTimer();
    [hasFlippedCard, lockBoard] = [false, false];
    [firstCard, secondCard] = [null, null];
    setupBoard();
}

// En js/controllers/memoryController.js

function setupBoard() {
    const grid = document.getElementById('memory-game-grid');
    if (!grid) return;

    // Limpiamos la instancia anterior de Masonry si existe
    if (msnry) msnry.destroy();

    if (availableImages.length < 2) {
        grid.innerHTML = '<p class="text-center text-danger">Faltan imágenes (mínimo 2).</p>';
        return;
    }

    // Preparar cartas
    const numPairs = Math.min(availableImages.length, 8);
    const selection = availableImages.slice(0, numPairs);
    memoryGameImages = [...selection, ...selection]; 
    memoryGameImages.sort(() => Math.random() - 0.5); 

    // Renderizar
    grid.innerHTML = '';

    memoryGameImages.forEach((url, index) => {
        const card = document.createElement('div');
        // Clases de Bootstrap para la tarjeta y para que Masonry la detecte
        card.className = 'card memory-card-bootstrap col-6 col-sm-4 col-md-3';
        card.dataset.image = url;
        card.dataset.index = index;
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-face card-back d-flex align-items-center justify-content-center">
                    <span style="font-size: 2rem;">🐝</span>
                </div>
                <div class="card-face card-front"><img src="${url}" alt="Card" class="img-fluid"></div>
            </div>
        `;
        card.addEventListener('click', flipCard);
        grid.appendChild(card);
    });

    // Inicializar Masonry después de que las imágenes se hayan cargado
    imagesLoaded(grid, function() {
        msnry = new Masonry(grid, {
            itemSelector: '.memory-card-bootstrap',
            percentPosition: true
        });
    });
}

function flipCard() {
    if (lockBoard) return;
    if (this === firstCard) return;

    // Iniciar timer al primer click
    if (!memoryTimer && matchCount === 0 && secondsElapsed === 0) startTimer();

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
    isMatch ? disableCards() : unflipCards();
}

function disableCards() {
    firstCard.removeEventListener('click', flipCard);
    secondCard.removeEventListener('click', flipCard);
    firstCard.classList.add('matched');
    secondCard.classList.add('matched');
    
    matchCount++;
    [hasFlippedCard, lockBoard] = [false, false];
    [firstCard, secondCard] = [null, null];

    if (matchCount === memoryGameImages.length / 2) {
        setTimeout(endGame, 1000);
    }
}

function unflipCards() {
    lockBoard = true;
    setTimeout(() => {
        firstCard.classList.remove('flipped');
        secondCard.classList.remove('flipped');
        [hasFlippedCard, lockBoard] = [false, false];
        [firstCard, secondCard] = [null, null];
    }, 1000);
}

function startTimer() {
    const display = document.querySelector('#timer span');
    stopTimer();
    memoryTimer = setInterval(() => {
        secondsElapsed++;
        if (display) display.textContent = secondsElapsed;
    }, 1000);
}

function stopTimer() {
    if (memoryTimer) clearInterval(memoryTimer);
    memoryTimer = null;
}

function endGame() {
    stopTimer();
    document.getElementById('game-mode-container').classList.add('d-none');
    document.getElementById('results').classList.remove('d-none');
    
    document.getElementById('final-time').textContent = `¡${memoryPlayerName}, tiempo: ${secondsElapsed}s!`;
    
    saveMemoryScore(EVENT_ID, {
        name: memoryPlayerName,
        time: secondsElapsed,
        timestamp: Date.now()
    });
}