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
let GUEST_NAME = ''; // Global variable for the guest's name
let GUEST_UNIQUE_ID = ''; // Global variable for a unique guest ID
let memoriesRef;

// ⭐️ NUEVO: Emojis de reacción disponibles
const REACTION_EMOJIS = {
    'like': '👍',
    'love': '❤️',
    'haha': '😂',
    'wow': '😮',
    'sad': '😢',
    'angry': '😡'
};

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
        // ⭐️ SOLUCIÓN FINAL: Usar una regla global con !important para máxima compatibilidad.
        // La regla @property no es totalmente compatible con todos los navegadores móviles.
        cssVariables += `
            * { font-family: ${themeConfig.font_family} !important; }
        `;
    }

    // 3. Manejar la imagen de fondo por separado
    if (themeConfig.background_image_url) {
         cssVariables += `
            body {
                background-image: url('${themeConfig.background_image_url}') !important;
                background-size: ${themeConfig.background_image_size || 'cover'};
                background-position: ${themeConfig.background_image_position || 'center'};
            }
        `;
    }

    // ⭐️ NUEVO: Manejar el contorno de texto
    if (themeConfig.text_stroke_width && themeConfig.text_stroke_color) {
        cssVariables += `
            h1, h2, h3, p, span, button, a {
                -webkit-text-stroke-width: ${themeConfig.text_stroke_width};
                -webkit-text-stroke-color: ${themeConfig.text_stroke_color};
            }
        `;
    }

    // ⭐️ NUEVO: Manejar el sticker del portal
    // ⭐️ CORRECCIÓN: La ruta correcta es themeConfig.stickers.portal
    // ⭐️ CORRECCIÓN FINAL: La ruta correcta es directamente themeConfig.portal_stickers
    // ⭐️ CORRECCIÓN FINAL (DE NUEVO): La ruta correcta es directamente themeConfig.portal_stickers
    if (themeConfig.portal_stickers && Array.isArray(themeConfig.portal_stickers)) {
        themeConfig.portal_stickers.forEach(sticker => {
            if (!sticker || !sticker.url) return;

            const stickerImg = document.createElement('img');
            stickerImg.src = sticker.url;
            stickerImg.alt = "Sticker Decorativo";
            stickerImg.style.position = 'fixed';
            stickerImg.style.zIndex = '1000';
            stickerImg.style.pointerEvents = 'none';

            // Aplicar estilos dinámicos
            if (sticker.width) stickerImg.style.width = sticker.width;
            if (sticker.transform) stickerImg.style.transform = sticker.transform;
            if (sticker.top) stickerImg.style.top = sticker.top;
            if (sticker.bottom) stickerImg.style.bottom = sticker.bottom;
            if (sticker.left) stickerImg.style.left = sticker.left;
            if (sticker.right) stickerImg.style.right = sticker.right;

            document.body.appendChild(stickerImg);
        });
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
    applyDynamicTheme(config.theme || {}, config.texts || {});
    
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
 * ⭐️ NUEVO: Maneja la reacción de un usuario a un recuerdo.
 * Permite al usuario reaccionar, cambiar su reacción o quitarla.
 * @param {string} memoryId - El ID del recuerdo.
 * @param {string} reactionType - El tipo de reacción (ej. 'love', 'like', 'haha').
 */
function handleReaction(memoryId, reactionType) {
    if (!GUEST_UNIQUE_ID) {
        console.error("GUEST_UNIQUE_ID no está definido. No se puede registrar la reacción.");
        return;
    }

    const userReactionPath = `events/${EVENT_ID}/data/memories/${memoryId}/userReactions/${GUEST_UNIQUE_ID}`;
    const memoryRef = dbRef(database, `events/${EVENT_ID}/data/memories/${memoryId}`);

    runTransaction(dbRef(database, userReactionPath), (currentReaction) => {
        let oldReactionType = null;
        if (currentReaction) {
            oldReactionType = currentReaction.type;
        }

        if (oldReactionType === reactionType) {
            // User is un-reacting (clicked the same reaction again)
            return null; // Remove the reaction
        } else {
            // User is reacting or changing reaction
            return { type: reactionType, timestamp: Date.now() };
        }
    }).then(() => {
        // After user reaction is updated, re-calculate the summary
        get(memoryRef).then(snapshot => {
            if (snapshot.exists()) {
                const memoryData = snapshot.val();
                const allUserReactions = memoryData.userReactions || {};
                const newSummary = {};
                let totalReactions = 0;

                for (const userId in allUserReactions) {
                    const type = allUserReactions[userId].type;
                    newSummary[type] = (newSummary[type] || 0) + 1;
                    totalReactions++;
                }
                
                // Find the most popular reaction
                let mostPopularReaction = null;
                let maxCount = 0;
                for (const type in newSummary) {
                    if (newSummary[type] > maxCount) {
                        maxCount = newSummary[type];
                        mostPopularReaction = type;
                    }
                }

                // Update the memory with the new summary and total count
                push(dbRef(database, `events/${EVENT_ID}/data/memories/${memoryId}/reactionSummary`), newSummary);
                push(dbRef(database, `events/${EVENT_ID}/data/memories/${memoryId}/totalReactions`), totalReactions);
                push(dbRef(database, `events/${EVENT_ID}/data/memories/${memoryId}/mostPopularReaction`), mostPopularReaction);
            }
        });
    }).catch(error => {
        console.error("Error al registrar la reacción:", error);
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

        // ⭐️ NUEVO: Contar el número de comentarios
        const commentCount = memory.comments ? Object.keys(memory.comments).length : 0;

        // ⭐️ NUEVO: Lógica para mostrar reacciones
        const totalReactions = memory.totalReactions || 0;
        const mostPopularReactionType = memory.mostPopularReaction;
        const userReaction = memory.userReactions && memory.userReactions[GUEST_UNIQUE_ID] ? memory.userReactions[GUEST_UNIQUE_ID].type : null;

        let reactionDisplay = '';
        let userReactionEmoji = '';
        let defaultLikeEmoji = ''; // Fallback eliminado

        if (window.eventConfig && window.eventConfig.theme && window.eventConfig.theme.icons && window.eventConfig.theme.icons.icon_like) {
            defaultLikeEmoji = window.eventConfig.theme.icons.icon_like;
        }

        if (userReaction && REACTION_EMOJIS[userReaction]) {
            userReactionEmoji = REACTION_EMOJIS[userReaction];
        }

        if (totalReactions > 0) {
            const displayEmoji = REACTION_EMOJIS[mostPopularReactionType] || defaultLikeEmoji;
            reactionDisplay = `<span class="text-xl">${displayEmoji}</span> <span class="font-semibold text-sm">${totalReactions}</span>`;
        } else {
            reactionDisplay = `<span class="font-semibold text-sm">Reaccionar</span>`;
        }

        // Generate reaction picker HTML
        let reactionPickerHtml = '<div class="reaction-picker hidden absolute bottom-full left-0 mb-2 bg-white p-2 rounded-full shadow-lg flex space-x-2">';
        for (const type in REACTION_EMOJIS) {
            reactionPickerHtml += `<span class="reaction-emoji text-2xl cursor-pointer hover:scale-125 transition-transform" data-reaction-type="${type}">${REACTION_EMOJIS[type]}</span>`;
        }
        reactionPickerHtml += '</div>';

        // ⭐️ NUEVO: HTML para la sección de interacción (Reacciones y formulario de comentario)
        const interactionSection = `
            <div class="interaction-section mt-3 flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <button data-memory-id="${memory.id}" class="reaction-btn-container flex items-center space-x-1 text-gray-500 hover:text-red-500 transition-colors relative">
                        ${userReactionEmoji ? `<span class="text-xl user-reaction-emoji">${userReactionEmoji}</span>` : ''}
                        <span class="current-reaction-display">${reactionDisplay}</span>
                        ${reactionPickerHtml}
                    </button>
                </div>
                <button data-memory-id="${memory.id}" class="comment-bubble-btn flex items-center space-x-1 text-gray-500 hover:text-blue-500 transition-colors">
                    <span class="text-xl">💬</span>
                    <span class="font-semibold text-sm">${commentCount}</span>
                </button>
            </div>
            <form class="comment-form mt-2 hidden">
                <input type="hidden" name="memoryId" value="${memory.id}">
                <div class="flex gap-2">
                    <input type="text" name="commentText" required placeholder="Deja un comentario como ${GUEST_NAME}..." class="comment-input flex-grow">
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
    // Manejador para el botón de Reacción
    const reactionBtnContainer = e.target.closest('.reaction-btn-container');
    if (reactionBtnContainer) {
        e.preventDefault();
        const memoryId = reactionBtnContainer.dataset.memoryId;
        const reactionPicker = reactionBtnContainer.querySelector('.reaction-picker');

        // Toggle visibility of the reaction picker
        if (reactionPicker) {
            reactionPicker.classList.toggle('hidden');
        }

        // If a specific reaction emoji was clicked within the picker
        const reactionEmoji = e.target.closest('.reaction-emoji');
        if (reactionEmoji) {
            const reactionType = reactionEmoji.dataset.reactionType;
            if (memoryId && reactionType) {
                handleReaction(memoryId, reactionType);
            }
            // Hide picker after selection
            if (reactionPicker) reactionPicker.classList.add('hidden');
        }
    } else {
        // Si se hace clic fuera de cualquier botón de reacción, oculta todos los selectores
        document.querySelectorAll('.reaction-picker').forEach(picker => {
            picker.classList.add('hidden');
        });
    }

    // Manejador para el botón de "Comentar"
    const commentButton = e.target.closest('.comment-bubble-btn');
    if (commentButton) {
        e.preventDefault();
        const memoryItemDiv = commentButton.closest('.memory-item');
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
    const messageTextarea = document.getElementById('guest-message');

    if (!modal || !form || !input || !messageTextarea) return;

    // Usamos sessionStorage para que el nombre se guarde solo durante la sesión actual.
    const storageKey = `guestName_${EVENT_ID}`;
    const storedName = sessionStorage.getItem(storageKey);
    const guestUniqueIdKey = `guestUniqueId_${EVENT_ID}`; // Key for unique ID
    let storedUniqueId = sessionStorage.getItem(guestUniqueIdKey);

    if (!storedUniqueId) {
        storedUniqueId = crypto.randomUUID(); // Generate a UUID
        sessionStorage.setItem(guestUniqueIdKey, storedUniqueId);
    }
    GUEST_UNIQUE_ID = storedUniqueId;

    const updateUIWithName = (name) => {
        GUEST_NAME = name;
        messageTextarea.placeholder = `Deja un comentario como ${name} (opcional)`;
    };

    if (storedName) {
        updateUIWithName(storedName);
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex'; // Mostramos el modal si no hay nombre.
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (name) {
            sessionStorage.setItem(storageKey, name);
            updateUIWithName(name);
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