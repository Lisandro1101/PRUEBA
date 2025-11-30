import { EVENT_ID } from "../core/state.js";
import { subscribeToTriviaRanking } from "../services/triviaService.js";
import { subscribeToMemoryRanking } from "../services/memoryService.js";

export function initRankingPage() {
    console.log("Inicializando Rankings...");

    // 1. Ranking de Trivia
    subscribeToTriviaRanking(EVENT_ID, (results) => {
        renderTriviaList(results);
    });

    // 2. Ranking de Memoria
    subscribeToMemoryRanking(EVENT_ID, (results) => {
        renderMemoryList(results);
    });
}

function renderTriviaList(results) {
    const container = document.getElementById('ranking-list');
    if (!container) return;

    // Lógica de cálculo de puntaje (Puntos - tiempo/10)
    results.forEach(r => {
        r.rankingValue = r.score - (r.time / 10);
    });
    // Ordenar: Mayor puntaje primero
    results.sort((a, b) => {
        if (b.rankingValue !== a.rankingValue) return b.rankingValue - a.rankingValue;
        return a.time - b.time;
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
                <span style="font-size: 0.9em; color: #666;">(${Math.round(r.time)}s)</span>
            </div>
        `;
        container.appendChild(li);
    });
}

function renderMemoryList(results) {
    const container = document.getElementById('memory-ranking-list');
    if (!container) return;

    // Ordenar: Menor tiempo es mejor
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