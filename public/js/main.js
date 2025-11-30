import { initializeGlobalState } from "./core/state.js";

// Importamos todos los controladores
import { initHostPage } from "./controllers/hostController.js";
import { initTriviaGame } from "./controllers/triviaController.js";
import { initMemoryGame } from "./controllers/memoryController.js";
import { initHangmanGame } from "./controllers/hangmanController.js";
import { initRankingPage } from "./controllers/rankingController.js";

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Cargar Configuración Global (Tema, Textos, ID, Auth)
        // Esto desbloquea la app y aplica los estilos.
        const { EVENT_ID } = await initializeGlobalState();
        
        // 2. Enrutador simple: ¿En qué página estamos?
        const path = window.location.pathname;

        if (path.includes('host.html')) {
            initHostPage();
        } 
        else if (path.includes('player.html')) {
            initTriviaGame();
        } 
        else if (path.includes('memory.html')) {
            initMemoryGame();
        } 
        else if (path.includes('hangman.html')) {
            initHangmanGame();
        } 
        else if (path.includes('ranking.html')) {
            initRankingPage();
        }
        else if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
            // El index tiene su propio 'portalScript.js', pero si necesitas
            // lógica compartida extra, iría aquí.
            console.log("Portal de Bienvenida cargado.");
        }

        // Hacer visible el contenedor para evitar parpadeos (FOUC)
        // Buscamos contenedores comunes de tus juegos
        const mainContainers = document.querySelectorAll('.quiz-container, .memory-section-bg, #host-panel-container');
        mainContainers.forEach(el => el.style.opacity = '1');

    } catch (error) {
        console.error("Error crítico inicializando la App:", error);
    }
});