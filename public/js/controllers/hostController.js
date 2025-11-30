import { EVENT_ID, eventConfig } from "../core/state.js";
import { loginHost, logoutHost, subscribeToAuth } from "../services/authService.js";
import * as triviaService from "../services/triviaService.js";
import * as memoryService from "../services/memoryService.js";
import * as hangmanService from "../services/hangmanService.js";

// === INICIALIZACIÓN ===
export function initHostPage() {
    console.log("Inicializando Panel de Host...");
    setupAuth();
}

// === AUTENTICACIÓN ===
function setupAuth() {
    const loginContainer = document.getElementById('host-login-container');
    const panelContainer = document.getElementById('host-panel-container');
    const loginForm = document.getElementById('host-login-form');
    const loginError = document.getElementById('host-login-error');

    // 1. Manejar Submit de Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (loginError) loginError.textContent = '';
            
            const btn = loginForm.querySelector('button');
            if(btn) btn.disabled = true;

            const username = eventConfig.auth ? eventConfig.auth.username : null;
            if (!username) {
                if (loginError) loginError.textContent = "Error: Evento no configurado para login.";
                if(btn) btn.disabled = false;
                return;
            }

            const email = `${username}@tufiestadigital.com.ar`;
            const passwordInput = document.getElementById('host-login-password');
            const password = passwordInput ? passwordInput.value : '';

            try {
                await loginHost(email, password);
                // El listener de Auth se encargará del resto
            } catch (error) {
                console.error(error);
                if (loginError) loginError.textContent = "Contraseña incorrecta.";
            } finally {
                if(btn) btn.disabled = false;
            }
        });
    }

    // 2. Escuchar cambios de sesión
    subscribeToAuth((user) => {
        if (user) {
            const expectedUser = eventConfig.auth ? eventConfig.auth.username : '';
            const expectedEmail = `${expectedUser}@tufiestadigital.com.ar`.toLowerCase();
            
            if (user.email && user.email.toLowerCase() === expectedEmail) {
                if (loginContainer) loginContainer.style.display = 'none';
                if (panelContainer) panelContainer.style.display = 'block';
                setupHostPanel(); // Cargar la lógica del panel
                setupLogoutBtn();
            } else {
                if (loginError) loginError.textContent = "No tienes permiso para este evento.";
                logoutHost();
            }
        } else {
            if (loginContainer) loginContainer.style.display = 'block';
            if (panelContainer) panelContainer.style.display = 'none';
        }
    });
}

function setupLogoutBtn() {
    const header = document.querySelector('#host-panel-container header');
    if (header && !document.getElementById('host-logout-btn')) {
        const btn = document.createElement('button');
        btn.id = 'host-logout-btn';
        btn.className = 'delete-btn';
        btn.style.float = 'right';
        btn.style.boxShadow = 'none';
        btn.textContent = 'Salir';
        btn.onclick = () => {
            if(confirm("¿Cerrar sesión?")) logoutHost();
        };
        header.insertBefore(btn, header.firstChild);
    }
}

// === LÓGICA DEL PANEL (Juegos) ===
function setupHostPanel() {
    // 1. Actualizar enlaces para que mantengan el ?event=...
    document.querySelectorAll('a[href="player.html"]').forEach(a => a.href = `player.html?event=${EVENT_ID}`);
    document.querySelectorAll('a[href="memory.html"]').forEach(a => a.href = `memory.html?event=${EVENT_ID}`);
    document.querySelectorAll('a[href="hangman.html"]').forEach(a => a.href = `hangman.html?event=${EVENT_ID}`);

    // ⭐️ CORRECCIÓN IMPORTANTE: Mostrar el ID del evento en el título (igual que el script original)
    const hostTitle = document.getElementById('host-panel-title-text');
    if (hostTitle) {
        let currentText = hostTitle.textContent || 'Panel: {EVENT_ID}';
        if (currentText.includes('{EVENT_ID}')) {
            hostTitle.textContent = currentText.replace('{EVENT_ID}', EVENT_ID);
        }
    }

    setupTriviaAdmin();
    setupMemoryAdmin();
    setupHangmanAdmin();
}

// --- ADMIN TRIVIA ---
function setupTriviaAdmin() {
    const list = document.getElementById('questions-list');
    const form = document.getElementById('question-form');
    const clearBtn = document.getElementById('clear-all-btn');

    // Escuchar preguntas
    triviaService.subscribeToQuestions(EVENT_ID, (questions) => {
        if (!list) return;
        list.innerHTML = '';
        
        if (questions.length === 0) {
            list.innerHTML = '<li class="text-gray-500 italic p-2">Sin preguntas...</li>';
            if (clearBtn) clearBtn.classList.add('hidden');
            return;
        }
        if (clearBtn) clearBtn.classList.remove('hidden');
        
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
            li.querySelector('.delete-btn').addEventListener('click', () => {
                triviaService.deleteQuestion(EVENT_ID, q.id);
            });
            list.appendChild(li);
        });
    });

    // Agregar pregunta
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const qText = document.getElementById('q-text').value.trim();
            const optsText = document.getElementById('q-options').value.trim();
            const ansText = document.getElementById('q-answer').value.trim();
            
            const options = optsText.split(',').map(o => o.trim()).filter(o => o.length > 0);

            if (options.length < 2) return alert('Mínimo 2 opciones.');
            if (!options.includes(ansText)) return alert('La respuesta debe estar en las opciones.');

            try {
                await triviaService.addQuestion(EVENT_ID, { question: qText, options, answer: ansText });
                form.reset();
            } catch (err) {
                alert("Error al guardar: " + err.message);
            }
        });
    }

    // Borrar todo
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if(confirm("¿Borrar TODAS las preguntas?")) triviaService.clearAllQuestions(EVENT_ID);
        });
    }
}

// --- ADMIN MEMORIA ---
function setupMemoryAdmin() {
    const list = document.getElementById('memory-images-list');
    const form = document.getElementById('memory-image-form');
    const clearBtn = document.getElementById('clear-memory-images-btn');
    const progressDiv = document.getElementById('memory-upload-progress-bar-container');
    const progressBar = document.getElementById('memory-upload-progress');
    const statusText = document.getElementById('memory-upload-status');
    const saveBtn = document.getElementById('save-memory-images-btn');

    // Escuchar imágenes
    memoryService.subscribeToMemoryImages(EVENT_ID, (images) => {
        if (!list) return;
        list.innerHTML = '';
        
        if (images.length === 0) {
            list.innerHTML = '<li class="p-2 text-gray-500 italic text-center">Sin imágenes...</li>';
            if (clearBtn) clearBtn.classList.add('hidden');
            return;
        }
        if (clearBtn) clearBtn.classList.remove('hidden');
        
        images.forEach(img => {
            const li = document.createElement('li');
            li.className = 'question-item image-preview-item';
            li.innerHTML = `
                <img src="${img.url}" alt="${img.name}">
                <span class="q-display text-sm truncate">${img.name}</span>
                <button class="delete-btn">Eliminar</button>
            `;
            li.querySelector('.delete-btn').addEventListener('click', async () => {
                if(confirm(`¿Borrar ${img.name}?`)) {
                    await memoryService.deleteMemoryImage(EVENT_ID, img.id, img.storagePath);
                }
            });
            list.appendChild(li);
        });
    });

    // Subir imagen
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('memory-files');
            if (input.files.length === 0) return alert("Selecciona una imagen.");

            if (saveBtn) saveBtn.disabled = true;
            if (progressDiv) progressDiv.classList.remove('hidden');

            try {
                const files = Array.from(input.files);
                for (let i = 0; i < files.length; i++) {
                    if (statusText) statusText.textContent = `Subiendo ${i + 1}/${files.length}: ${files[i].name}`;
                    await memoryService.uploadMemoryImage(EVENT_ID, files[i], (progress) => {
                        if (progressBar) progressBar.style.width = `${progress}%`;
                    });
                }
                if (statusText) statusText.textContent = "¡Listo!";
                setTimeout(() => {
                    if (progressDiv) progressDiv.classList.add('hidden');
                    if (progressBar) progressBar.style.width = '0%';
                    form.reset();
                }, 1500);
            } catch (err) {
                console.error(err);
                alert("Error subiendo imagen.");
            } finally {
                if (saveBtn) saveBtn.disabled = false;
            }
        });
    }

    // Borrar todo
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if(confirm("¿Borrar TODAS las imágenes? Irrecuperable.")) memoryService.clearAllMemoryImages(EVENT_ID);
        });
    }
}

// --- ADMIN AHORCADO ---
function setupHangmanAdmin() {
    const list = document.getElementById('hangman-words-list');
    const form = document.getElementById('hangman-word-form');
    const clearBtn = document.getElementById('clear-hangman-words-btn');

    hangmanService.subscribeToHangmanWords(EVENT_ID, (words) => {
        if (!list) return;
        list.innerHTML = '';
        
        if (words.length === 0) {
            list.innerHTML = '<li class="p-2 text-gray-500 italic text-center">Sin palabras...</li>';
            if (clearBtn) clearBtn.classList.add('hidden');
            return;
        }
        if (clearBtn) clearBtn.classList.remove('hidden');
        
        words.forEach(w => {
            const li = document.createElement('li');
            li.className = 'question-item';
            li.innerHTML = `
                <div class="q-display"><strong class="text-gray-700">${w.word}</strong></div>
                <button class="delete-btn">Eliminar</button>
            `;
            li.querySelector('.delete-btn').addEventListener('click', () => {
                hangmanService.deleteHangmanWord(EVENT_ID, w.id);
            });
            list.appendChild(li);
        });
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const wordInput = document.getElementById('h-word');
            const word = wordInput ? wordInput.value.trim() : '';
            if (word.length < 3) return alert("Mínimo 3 letras.");
            await hangmanService.addHangmanWord(EVENT_ID, word);
            form.reset();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if(confirm("¿Borrar TODAS las palabras?")) hangmanService.clearAllHangmanWords(EVENT_ID);
        });
    }
}