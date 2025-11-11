// REEMPLAZA TUS IMPORTACIONES EN portalScript.js CON ESTO:
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref as dbRef, push, onValue, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { runTransaction } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js"; // ⭐️ NUEVA IMPORTACIÓN
// CONFIGURACIÓN DE FIREBASE (Se mantiene igual)
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

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app); 

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// =======================================================================
// VARIABLES GLOBALES DE ARQUITECTURA (NUEVO)
// =======================================================================
let EVENT_ID;
// ⭐️ CORRECCIÓN: 'dataRef' ya no es necesaria, creamos 'memoriesRef' directamente
let GUEST_NAME = ''; // ⭐️ NUEVO: Variable global para el nombre del invitado
let memoriesRef;

// =======================================================================
// FUNCIONES DE ARQUITECTURA (NUEVO)
// =======================================================================

/**
 * Obtiene el ID del evento desde el parámetro 'event' de la URL.
 * Si no existe, bloquea la aplicación.
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
 * ⭐️ NUEVO: Motor de Temas Dinámico
 * Itera sobre el objeto de tema de Firebase y lo inyecta como
 * variables CSS en el <head>.
 * @param {object} themeConfig - El objeto config.theme de Firebase.
 * @param {object} textsConfig - El objeto config.texts de Firebase.
 */
function applyDynamicTheme(themeConfig, textsConfig) {
    if (!themeConfig && !textsConfig) {
        console.warn("No se encontró tema, usando defaults.");
        return;
    }

    const styleTag = document.createElement('style');
    let cssVariables = ":root {\n";
    
    // 1. Iterar sobre las claves del TEMA (colores, fuentes, etc.)
    for (const key in themeConfig) {
        // Ignorar objetos anidados como 'icons' (los manejamos por separado)
        if (typeof themeConfig[key] === 'object' && themeConfig[key] !== null) {
            continue;
        }

        const value = themeConfig[key];
        
        // Si el valor está vacío o nulo, no lo agregamos
        if (!value) {
            continue; 
        }

        // Convertir 'color_primary' a '--color-primary'
        // Convertir 'portal_bg' a '--portal-bg'
        const cssVarName = `--${key.replace(/_/g, '-')}`; 
        
        // Añadir la variable al string
        // ej:    --color-primary: #FF0000;
        cssVariables += `    ${cssVarName}: ${value};\n`;
    }
    
    // 2. ⭐️ CORREGIDO: Iterar sobre las claves de TEXTOS (color, tamaño de fuente)
    if (textsConfig) {
        for (const key in textsConfig) {
            if (textsConfig[key]) cssVariables += `    --${key.replace(/_/g, '-')}: ${textsConfig[key]};\n`;
        }
    }

    cssVariables += "}\n";

    // 2. Manejar la fuente por separado
    if (themeConfig.font_family) { // Usando la variable global
        cssVariables += `
            body {
                font-family: ${themeConfig.font_family};
            }
        `;
    }

    // 3. Manejar la imagen de fondo por separado
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
    
    // 5. Manejar los iconos (como ya lo hacías)
    if (themeConfig.icons) {
        const icons = themeConfig.icons;
        // Helper function to update icons by class
        const updateIcons = (className, icon) => {
            document.querySelectorAll(className).forEach(el => {
                if (icon && icon.trim() !== '') {
                    el.textContent = icon;
                    el.style.display = ''; // Asegurarse de que sea visible
                } else {
                    el.style.display = 'none'; // Ocultar si no hay icono
                }
            });
        };

        updateIcons('.icon-main', icons.icon_main);
        updateIcons('.icon-portal', icons.icon_portal);
        updateIcons('.icon-trivia', icons.icon_trivia);
        updateIcons('.icon-memory', icons.icon_memory);
        updateIcons('.icon-hangman', icons.icon_hangman);
        updateIcons('.icon-ranking', icons.icon_ranking);
        updateIcons('.icon-win', icons.icon_win);
        updateIcons('.icon-games', icons.icon_games);
        updateIcons('.icon-memories', icons.icon_memories);
        // También para el botón del menú de juegos
        updateIcons('.icon-menu-juegos', icons.icon_games);
    }
}


/**
 * ⭐️ FUNCIÓN loadEventConfig (MODIFICADA) ⭐️
 * Carga la configuración (tema, features, status) desde Firebase
 * y la aplica a la página.
 * @param {string} eventId - El ID del evento actual.
 */
async function loadEventConfig(eventId) {
    const configRef = dbRef(database, `events/${eventId}/config`);
    let config = {};
    
    try {
        const snapshot = await get(configRef);
        if (snapshot.exists()) {
            config = snapshot.val();
        } else {
            console.warn("No se encontró configuración de 'super-admin'. Usando valores por defecto.");
        }
    } catch (error) {
        console.error("Error cargando configuración:", error);
        throw new Error("Error al cargar la configuración del evento.");
    }

    // --- 1. CHEQUEO DE EVENTO ACTIVO (¡IMPORTANTE!) ---
    if (!config.status || config.status.is_active === false) {
        document.body.innerHTML = `
            <div style="padding: 40px; text-align: center; font-family: sans-serif; color: #333;">
                <h1>Evento Finalizado</h1>
                <p>Este portal de recuerdos ya no se encuentra disponible.</p>
            </div>
        `;
        throw new Error("El evento está deshabilitado.");
    }

    // --- 2. APLICAR TEMA VISUAL (REEMPLAZADO) ---
    // ⭐️ CORREGIDO: Pasamos ambos objetos, theme y texts, a la función.
    applyDynamicTheme(config.theme, config.texts);
    
    // --- NUEVO: Aplicar Textos Dinámicos ---
    if (config.texts) {
        const portalGreeting = document.getElementById('portal-greeting-text');
        if (portalGreeting && config.texts.portal_greeting) {
            portalGreeting.innerHTML = config.texts.portal_greeting;
        }
        const portalTitle = document.getElementById('portal-title-text');
        if (portalTitle && config.texts.portal_title) {
            portalTitle.innerHTML = config.texts.portal_title; // Usar innerHTML para que renderice emojis
        }
        const portalSubtitle = document.getElementById('portal-subtitle-text');
        if (portalSubtitle && config.texts.portal_subtitle) {
            portalSubtitle.innerHTML = config.texts.portal_subtitle;
        }
        const memoriesSectionTitleText = document.getElementById('memories-section-title-text');
        if (memoriesSectionTitleText && config.texts.memories_section_title) {
            memoriesSectionTitleText.textContent = config.texts.memories_section_title;
        }
        const memoriesListTitleText = document.getElementById('memories-list-title-text');
        if (memoriesListTitleText && config.texts.memories_list_title) {
            memoriesListTitleText.textContent = config.texts.memories_list_title;
        }



        // ⭐️ NUEVO: Aplicar textos de botones de juegos
        const triviaBtnText = document.getElementById('juegos-menu-trivia-text');
        if (triviaBtnText && config.texts.juegos_menu_trivia) {
            triviaBtnText.textContent = config.texts.juegos_menu_trivia;
        }
        const memoryBtnText = document.getElementById('juegos-menu-memory-text');
        if (memoryBtnText && config.texts.juegos_menu_memory) {
            memoryBtnText.textContent = config.texts.juegos_menu_memory;
        }
        const hangmanBtnText = document.getElementById('juegos-menu-hangman-text');
        if (hangmanBtnText && config.texts.juegos_menu_hangman) {
            hangmanBtnText.textContent = config.texts.juegos_menu_hangman;
        }
    }

    // --- 3. APLICAR FUNCIONALIDADES (Juegos) ---
    if (config.features && config.features.games_enabled === false) {
        // Si los juegos están deshabilitados, oculta el botón del menú de juegos
        const gamesMenuToggle = document.getElementById('menu-juegos-toggle');
        if (gamesMenuToggle) {
            // Oculta el botón y el div relativo que lo contiene
            const parentDiv = gamesMenuToggle.parentElement;
            if (parentDiv) parentDiv.style.display = 'none';
        }
    }
}


// =======================================================================
// FUNCIONES DE RECUPERACIÓN Y RENDERIZACIÓN DE RECUERDOS (MODIFICADA)
// =======================================================================

/**
 * ⭐️ NUEVO: Incrementa el contador de 'likes' para un recuerdo específico.
 * @param {string} memoryId - El ID del recuerdo al que se le da like.
 */
function handleLike(memoryId) {
    const memoryLikeRef = dbRef(database, `events/${EVENT_ID}/data/memories/${memoryId}/likeCount`);
    
    // Usamos una transacción para evitar problemas de concurrencia
    runTransaction(memoryLikeRef, (currentLikes) => {
        // Si currentLikes es null (nunca se ha dado like), lo inicializamos en 1.
        // De lo contrario, lo incrementamos.
        return (currentLikes || 0) + 1;
    }).catch(error => {
        console.error("Error en la transacción del like:", error);
    });
}


function renderMemories(memories) {
    const memoriesList = document.getElementById('memories-list');
    if (!memoriesList) return;
    memoriesList.innerHTML = ''; 

    if (memories.length === 0) {
        memoriesList.innerHTML = `<p class="text-sm text-gray-500 italic p-2 text-center">¡Sé el primero en dejar un recuerdo!</p>`;
        return;
    }

    memories.forEach(memory => {
        const memoryItem = document.createElement('div');
        memoryItem.className = 'memory-item p-3 mb-3 border-b border-yellow-200 last:border-b-0'; 
        
        let mediaContent = '';
        const fileUrl = memory.fileUrl || memory.mediaUrl;
        const fileType = memory.fileType || memory.mediaType;

        if (fileUrl) {
            const isVideo = fileType && fileType.startsWith('video');
            if (isVideo) {
                mediaContent = `<video controls src="${fileUrl}" class="w-full h-auto max-h-48 object-cover rounded-lg shadow-md mt-2" preload="none" style="max-width: 100%;"></video>`;
            } else {
                mediaContent = `<img src="${fileUrl}" alt="Recuerdo de ${memory.name}" class="w-full h-auto max-h-48 object-cover rounded-lg shadow-md mt-2" loading="lazy" style="max-width: 100%;">`;
            }
        }
        
        const date = memory.timestamp ? new Date(memory.timestamp) : new Date();
        const formattedDate = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        // ⭐️ NUEVO: Generar HTML para comentarios
        let commentsHtml = '<div class="comments-section mt-2 space-y-2">';
        if (memory.comments) {
            Object.values(memory.comments).forEach(comment => {
                commentsHtml += `
                    <div class="comment-item text-xs bg-gray-100 p-2 rounded-md">
                        <p class="font-bold text-gray-700">${comment.name}:</p>
                        <p class="text-gray-600">${comment.comment}</p>
                    </div>
                `;
            });
        }
        commentsHtml += '</div>';

        // ⭐️ NUEVO: HTML para la sección de interacción (Likes y formulario de comentario)
        const likeCount = memory.likeCount || 0;
        const interactionSection = `
            <div class="interaction-section mt-3 flex items-center justify-between">
                <button data-memory-id="${memory.id}" class="like-btn flex items-center space-x-1 text-gray-500 hover:text-red-500 transition-colors">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path></svg>
                    <span class="like-count font-semibold text-sm">${likeCount}</span>
                </button>
                <button data-memory-id="${memory.id}" class="comment-bubble-btn">
                    Comentar
                </button>
            </div>
            <form class="comment-form mt-2 hidden">
                <input type="hidden" name="memoryId" value="${memory.id}">
                <div class="flex gap-2">
                    <input type="text" name="commenterName" required placeholder="Tu Nombre" class="comment-input flex-grow-0" value="${GUEST_NAME}" readonly>
                    <input type="text" name="commentText" required placeholder="Escribe un comentario..." class="comment-input flex-grow">
                    <button type="submit" class="comment-submit-btn">Enviar</button>
                </div>
            </form>
        `;

        memoryItem.innerHTML = `
            <div class="flex items-start justify-between">
                <p class="font-bold text-gray-800 text-sm"><span class="icon-portal">💬</span> ${memory.name}</p>
                <p class="text-xs text-gray-500">${formattedDate}</p>
            </div>
            ${memory.message && memory.message.trim() ? `<p class="text-gray-600 mt-1 mb-2 text-sm">${memory.message}</p>` : ''}
            ${mediaContent}
            ${interactionSection}
            ${commentsHtml}
        `;
        memoriesList.appendChild(memoryItem);
    });
}

function listenForMemories() {
    const memoriesList = document.getElementById('memories-list');
    if (!memoriesList || !memoriesRef) return; // Asegura que las referencias existan
    
    onValue(memoriesRef, (snapshot) => {
        const data = snapshot.val();
        const memories = [];
        if (data) {
            for (let key in data) {
                memories.push({ id: key, ...data[key] });
            }
            memories.sort((a, b) => b.timestamp - a.timestamp);
        }
        renderMemories(memories);
    }, (error) => {
        console.error("Error al escuchar los recuerdos:", error);
        memoriesList.innerHTML = '<p class="text-sm text-red-500 italic">Error al cargar los recuerdos.</p>';
    });
}

// ⭐️ NUEVO: Delegación de eventos para los nuevos elementos
document.addEventListener('click', function(e) {
    // Manejador para el botón de "Me Gusta"
    if (e.target.closest('.like-btn')) {
        e.preventDefault();
        const likeButton = e.target.closest('.like-btn');
        const memoryId = likeButton.dataset.memoryId;
        if (memoryId) {
            handleLike(memoryId);
        }
    }

    // Manejador para el botón de "Comentar"
    if (e.target.classList.contains('comment-bubble-btn')) {
        e.preventDefault();
        const memoryItemDiv = e.target.closest('.memory-item');
        if (memoryItemDiv) {
            const commentForm = memoryItemDiv.querySelector('.comment-form');
            if (commentForm) {
                commentForm.classList.remove('hidden');
                commentForm.querySelector('input[name="commentText"]').focus();
            }
        }
    }
});

document.addEventListener('submit', async function(e) {
    // Manejador para el formulario de comentarios
    if (e.target.classList.contains('comment-form')) {
        e.preventDefault();
        const form = e.target;
        const memoryId = form.elements.memoryId.value;
        const commenterName = GUEST_NAME; // ⭐️ CORREGIDO: Usar el nombre global guardado
        const commentText = form.elements.commentText.value.trim();

        if (!memoryId || !commenterName || !commentText) return;

        const commentsRef = dbRef(database, `events/${EVENT_ID}/data/memories/${memoryId}/comments`);
        await push(commentsRef, { name: commenterName, comment: commentText, timestamp: Date.now() });
        
        // ⭐️ CORREGIDO: Solo limpiar el campo del comentario, no el del nombre
        form.elements.commentText.value = '';

        // Ocultar el formulario de nuevo después de enviar
        form.classList.add('hidden');
    }
});

/**
 * ⭐️ NUEVO: Maneja la lógica para pedir y guardar el nombre del invitado.
 */
function handleGuestName() {
    const modal = document.getElementById('guest-name-modal');
    const form = document.getElementById('guest-name-form');
    const input = document.getElementById('modal-guest-name-input');
    const memoryNameInput = document.getElementById('guest-name');

    if (!modal || !form || !input || !memoryNameInput) return;

    // Usamos sessionStorage para que el nombre se guarde solo durante la sesión actual.
    const storageKey = `guestName_${EVENT_ID}`;
    const storedName = sessionStorage.getItem(storageKey);

    if (storedName) {
        GUEST_NAME = storedName;
        memoryNameInput.value = GUEST_NAME;
        memoryNameInput.readOnly = true; // Hacemos que el campo no se pueda editar.
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex'; // Mostramos el modal si no hay nombre.
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (name) {
            GUEST_NAME = name;
            sessionStorage.setItem(storageKey, GUEST_NAME);
            memoryNameInput.value = GUEST_NAME;
            memoryNameInput.readOnly = true;
            modal.style.display = 'none';
        }
    });
}


// =======================================================================
// --- NUEVO: FUNCIÓN DE INICIALIZACIÓN DEL PORTAL ---
// (Sin cambios internos)
// =======================================================================
function initializePortal() {
    // DECLARACIONES DEL DOM
    const form = document.getElementById('memory-form');
    const nameInput = document.getElementById('guest-name');
    const messageInput = document.getElementById('guest-message');
    const fileInputPhoto = document.getElementById('guest-file-photo'); 
    const fileInputVideo = document.getElementById('guest-file-video'); 
    const submitButton = document.getElementById('submit-memory-btn');
    const progressBarContainer = document.getElementById('upload-progress-bar-container');
    const progressBar = document.getElementById('upload-progress');
    const uploadStatus = document.getElementById('upload-status');
    const fileNameDisplay = document.getElementById('file-name-display');
    const menuToggleBtn = document.getElementById('menu-juegos-toggle');
    const juegosDropdown = document.getElementById('juegos-dropdown');
    const cerrarMenuBtn = document.getElementById('cerrar-menu');
    
    // ⭐️ NUEVO: Iniciar el manejador del nombre del invitado
    handleGuestName();

    // --- ¡¡¡BUG CORREGIDO!!! ---
    // Actualiza los enlaces de los juegos para incluir el event_id
    document.querySelectorAll('a[href="player.html"]').forEach(a => a.href = `player.html?event=${EVENT_ID}`);
    document.querySelectorAll('a[href="memory.html"]').forEach(a => a.href = `memory.html?event=${EVENT_ID}`);
    document.querySelectorAll('a[href="hangman.html"]').forEach(a => a.href = `hangman.html?event=${EVENT_ID}`);
    // Actualiza también el enlace del trofeo (si existe)
    const rankingTrophy = document.getElementById('ranking-trophy-btn');
    if (rankingTrophy) {
        rankingTrophy.href = `ranking.html?event=${EVENT_ID}`;
    }

    // LÓGICA DEL MENÚ FLOTANTE
    if (juegosDropdown && juegosDropdown.style.display !== 'none') {
        juegosDropdown.classList.add('hidden-dropdown'); 
    }
    function toggleJuegosMenu() {
        if (juegosDropdown) {
            juegosDropdown.classList.toggle('hidden-dropdown');
        }
    }
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            toggleJuegosMenu();
        });
    }
    if (cerrarMenuBtn) {
        cerrarMenuBtn.addEventListener('click', toggleJuegosMenu);
    }
    document.addEventListener('click', (event) => {
        if (!juegosDropdown || juegosDropdown.classList.contains('hidden-dropdown')) return;
        const isClickInsideMenu = juegosDropdown.contains(event.target);
        const isClickOnToggle = menuToggleBtn && menuToggleBtn.contains(event.target);
        if (!isClickInsideMenu && !isClickOnToggle) {
            juegosDropdown.classList.add('hidden-dropdown');
        }
    });

    // LÓGICA DE ENVÍO DE MENSAJES
    if (fileInputPhoto) {
        fileInputPhoto.addEventListener('change', () => {
            fileNameDisplay.textContent = fileInputPhoto.files.length > 0 ? `Foto: ${fileInputPhoto.files[0].name}` : '';
            if (fileInputVideo) fileInputVideo.value = ''; 
        });
    }
    if (fileInputVideo) {
        fileInputVideo.addEventListener('change', () => {
            fileNameDisplay.textContent = fileInputVideo.files.length > 0 ? `Video: ${fileInputVideo.files[0].name}` : '';
            if (fileInputPhoto) fileInputPhoto.value = ''; 
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); // ¡Este es el "freno" que ahora funcionará!
            
            const name = GUEST_NAME; // ⭐️ CORREGIDO: Usar el nombre global guardado
            const message = messageInput.value.trim();
            let file = (fileInputPhoto && fileInputPhoto.files.length > 0) ? fileInputPhoto.files[0] : ((fileInputVideo && fileInputVideo.files.length > 0) ? fileInputVideo.files[0] : null);
            
            if (!name || (!message && !file)) {
                alert('Por favor, ingresa tu nombre y un mensaje o un archivo.');
                return;
            }
            if (file && file.size > MAX_FILE_SIZE) {
                alert('El archivo es demasiado grande. Límite: 10MB.');
                return;
            }

            submitButton.disabled = true;

            try {
                let fileUrl = null; 
                let fileType = null; 

                if (file) {
                    progressBarContainer.classList.remove('hidden');
                    uploadStatus.textContent = 'Iniciando subida...';

                    const fileName = `${Date.now()}-${file.name}`;
                    // --- RUTA DE STORAGE ACTUALIZADA ---
                    const sRef = storageRef(storage, `events/${EVENT_ID}/memories/${fileName}`);
                    const uploadTask = uploadBytesResumable(sRef, file);

                    await new Promise((resolve, reject) => {
                        uploadTask.on('state_changed', 
                            (snapshot) => {
                                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                                progressBar.style.width = progress + '%';
                                uploadStatus.textContent = `Subiendo: ${Math.round(progress)}%`;
                            }, 
                            (error) => reject(error), 
                            async () => {
                                fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
                                fileType = file.type;
                                resolve();
                            }
                        );
                    });
                }

                const newMemory = {
                    name: name,
                    message: message,
                    fileUrl: fileUrl, // Mantener consistencia con el resto de la app
                    fileType: fileType, // Mantener consistencia
                    timestamp: Date.now()
                };

                await push(memoriesRef, newMemory);
                
                // ⭐️ MOSTRAR TOAST PERSONALIZADO
                const toast = document.getElementById('custom-toast-message');
                if (toast) {
                    toast.classList.add('show');
                    setTimeout(() => {
                        toast.classList.remove('show');
                    }, 4000); // Ocultar después de 4 segundos
                } else {
                    alert('¡Recuerdo enviado con éxito!');
                }
                
            } catch (error) {
                console.error("Error al enviar el recuerdo:", error);
                // ⭐️ CORREGIDO: No se resetea el nombre, solo el mensaje y archivo.
                messageInput.value = '';
                fileNameDisplay.textContent = '';
            } finally {
                form.reset();
                fileNameDisplay.textContent = '';
                progressBarContainer.classList.add('hidden');
                progressBar.style.width = '0%';
                submitButton.disabled = false;
                if (fileInputPhoto) fileInputPhoto.value = '';
                if (fileInputVideo) fileInputVideo.value = '';
            }
        });
    }

    // Iniciar la escucha de mensajes (AHORA que 'memoriesRef' está definido)
    listenForMemories();
}

// =======================================================================
// LÓGICA PRINCIPAL (REESTRUCTURADA)
// =======================================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // --- 1. OBTENER ID Y CARGAR CONFIGURACIÓN ---
        EVENT_ID = getEventId();
        await loadEventConfig(EVENT_ID); // Espera a que la config se cargue
        
        // --- 2. INICIALIZAR REFERENCIAS DE FIREBASE (⭐️ CORREGIDO) ---
        // Se construye la ruta completa directamente
        memoriesRef = dbRef(database, `events/${EVENT_ID}/data/memories`);
        
        // --- 3. INICIALIZAR EL PORTAL ---
        // Esta función ahora contiene todos los addEventListener
        initializePortal();

    } catch (error) {
        // Esto atrapará el error de 'getEventId' o 'loadEventConfig'
        console.error("Error al inicializar la aplicación:", error.message);
        // La app se detendrá aquí si el evento no existe o está inactivo
    }
});