import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
// ⭐️⭐️⭐️ NUEVAS IMPORTACIONES DE AUTH ⭐️⭐️⭐️
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
// ⭐️⭐️⭐️ FIN NUEVAS IMPORTACIONES ⭐️⭐️⭐️
import { setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-functions.js";
import { getDatabase, ref, set, onValue, remove, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// =======================================================================
// CONFIGURACIÓN DE FIREBASE
// =======================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDRsS6YQ481KQadSk8gf9QtxVt_asnrDlc", // Reemplaza con tus datos
  authDomain: "juegos-cumple.firebaseapp.com", // Reemplaza con tus datos
  databaseURL: "https://juegos-cumple-default-rtdb.firebaseio.com", // Reemplaza con tus datos
  projectId: "juegos-cumple", // Reemplaza con tus datos
  storageBucket: "juegos-cumple.firebasestorage.app", // Reemplaza con tus datos
  messagingSenderId: "595312538655", // Reemplaza con tus datos
  appId: "1:595312538655:web:93220a84570ff7461fd12a", // Reemplaza con tus datos
  measurementId: "G-V1YXNZXVQR" // Reemplaza con tus datos
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);
const functions = getFunctions(app); // ⭐️ NUEVO: Inicializar Firebase Functions

// ⭐️⭐️⭐️ INICIO: NUEVA LÓGICA DE AUTENTICACIÓN ⭐️⭐️⭐️
const auth = getAuth(app);

// ❗️❗️❗️ CAMBIA ESTO por tu email de super-administrador
const SUPER_ADMIN_EMAIL = "lisandrodileva@gmail.com"; 

// --- Referencias a los contenedores del HTML ---
const loginContainer = document.getElementById('login-container');
const panelAdmin = document.getElementById('panel-admin');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

// ⭐️ NUEVO: Variable de control para asegurar una única inicialización
let isPanelInitialized = false;

/**
 * 1. Escuchar cambios de estado de Auth
 * Esto decide si mostrar el Login o el Panel de Admin
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuario está logueado
        if (user.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
            // Usuario logueado Y es el Super Admin
            loginContainer.style.display = 'none';
            panelAdmin.style.display = 'block';
            
            // Añadimos un botón de "Salir" si no existe
            if (!document.getElementById('logout-btn')) {
                panelAdmin.insertAdjacentHTML('afterbegin', '<button id="logout-btn" style="background: #ef4444; color: white; padding: 5px 10px; border-radius: 5px; float: right; cursor: pointer;">Salir</button>');
                document.getElementById('logout-btn').addEventListener('click', () => {
                    if (confirm("¿Seguro que quieres salir?")) {
                        signOut(auth);
                    }
                });
            }
            // ⭐️ CORREGIDO: Llamar a la inicialización solo una vez
            if (!isPanelInitialized) {
                initializeSuperAdminPanel();
                isPanelInitialized = true;
            }
        } else {
            // Usuario logueado, pero NO es el Super Admin (o user.email es nulo/indefinido)
            if (user.email) { // Solo desloguear si tenemos un email para comparar
                console.warn("Usuario logueado no es el Super Admin. Deslogueando:", user.email);
                signOut(auth);
            }
            loginContainer.style.display = 'block';
            panelAdmin.style.display = 'none';
        }
    } else {
        // No hay usuario logueado
        loginContainer.style.display = 'block';
        panelAdmin.style.display = 'none';
        isPanelInitialized = false; // Resetear el estado si el usuario se desloguea
    }
});

/**
 * 2. Manejador del formulario de login
 */
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Ingresando...';

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        // ⭐️ SOLUCIÓN DEFINITIVA: Forzar la persistencia LOCAL.
        // Esto evita que la sesión se cierre automáticamente después de un tiempo.
        // Debe llamarse ANTES de signInWithEmailAndPassword.
        await setPersistence(auth, browserLocalPersistence);
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged se encargará de mostrar el panel o dar error de permiso
    } catch (error) {
        console.error("Error de login:", error.message);
        loginError.textContent = "Error: Email o contraseña incorrectos."; // Esto solo se muestra si el login falla
    } finally {
        // ⭐️ CORRECCIÓN: Este bloque se ejecuta SIEMPRE, asegurando que el botón se reactive.
        // Esto soluciona el problema del botón atascado en "Ingresando...".
        submitButton.disabled = false;
        submitButton.textContent = 'Ingresar';
    }
});
// ⭐️⭐️⭐️ FIN: NUEVA LÓGICA DE AUTENTICACIÓN ⭐️⭐️⭐️

// ⭐️⭐️⭐️ INICIO: VARIABLES GLOBALES DEL PANEL ⭐️⭐️⭐️
// Se mueven aquí para que estén definidas antes de cualquier llamada.
let loadedThemeTemplates = {}; // Almacén para datos de plantillas
const themeTemplatesRef = ref(database, 'themeTemplates'); // Referencia a las plantillas de temas
// ⭐️⭐️⭐️ FIN: VARIABLES GLOBALES DEL PANEL ⭐️⭐️⭐️

// ⭐️⭐️⭐️ INICIO: FUNCIONES DE PLANTILLAS DE TEMAS (MOVIDAS FUERA) ⭐️⭐️⭐️
/**
 * Carga las plantillas de temas desde Firebase y las añade al selector.
 */
async function loadThemeTemplates() {
    const themeTemplateSelector = document.getElementById('theme-template-selector');
    if (!themeTemplateSelector) return; // Salir si el elemento no existe

    try {
        const snapshot = await get(themeTemplatesRef);
        if (snapshot.exists()) {
            loadedThemeTemplates = snapshot.val();
            themeTemplateSelector.innerHTML = '<option value="">-- Seleccionar Plantilla --</option>';
            snapshot.forEach(childSnapshot => {
                const templateId = childSnapshot.key;
                const option = document.createElement('option');
                option.value = templateId;
                option.textContent = templateId.replace(/-/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                themeTemplateSelector.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error cargando plantillas de temas:", error);
    }
}

/**
 * Muestra una previsualización de la plantilla de tema seleccionada.
 */
function showThemePreview() {
    const previewContainer = document.getElementById('theme-preview-container');
    const themeTemplateSelector = document.getElementById('theme-template-selector');
    const selectedTemplateId = themeTemplateSelector.value;

    if (!selectedTemplateId || !loadedThemeTemplates[selectedTemplateId]) {
        previewContainer.style.display = 'none';
        return;
    }

    const template = loadedThemeTemplates[selectedTemplateId];
    const theme = template.theme || {};

    document.getElementById('preview-color-primary').style.backgroundColor = theme.color_primary || '#FFFFFF';
    document.getElementById('preview-color-secondary').style.backgroundColor = theme.color_secondary || '#FFFFFF';
    document.getElementById('preview-color-text').style.backgroundColor = theme.color_text || '#000000';
    document.getElementById('preview-font').style.fontFamily = theme.font_family || 'sans-serif';
    document.getElementById('preview-button').style.backgroundColor = theme.btn_portal_bg || '#FACC15';
    document.getElementById('preview-button').style.color = theme.btn_portal_text_color || '#1F2937';

    previewContainer.style.display = 'block';
}

// ⭐️⭐️⭐️ FIN: FUNCIONES DE PLANTILLAS DE TEMAS ⭐️⭐️⭐️


// ⭐️⭐️⭐️ INICIO: CÓDIGO ORIGINAL ENVUELTO ⭐️⭐️⭐️
// Todo tu código original de super-admin.js va ahora
// dentro de esta función.
function initializeSuperAdminPanel() {

    // =======================================================================
    // ⭐️ FUNCIONES DE AYUDA PARA RGBA ⭐️ (Tu código original)
    // =======================================================================

    /**
     * Convierte un color Hex (ej: #FF0000) y una opacidad (ej: 0.8) a un string rgba().
     * @param {string} hex - El color en formato hexadecimal.
     * @param {number | string} opacity - La opacidad (0.1 a 1.0).
     * @returns {string} - El color en formato rgba().
     */
    function hexToRgba(hex, opacity = 1) {
        if (!hex || hex === '') return null; // No convertir si no hay color
        
        // Expandir formato corto (ej. "03F") a formato completo (ej. "0033FF")
        let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

        let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) {
            console.warn("Formato hex inválido:", hex);
            return hex; // Devolver el valor original si no es un hex válido
        }
        
        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);
        
        // Si la opacidad es 1, devolver el hex original (más limpio)
        if (parseFloat(opacity) === 1) {
            return hex;
        }
        
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    /**
     * Convierte un string rgba() (ej: rgba(255, 0, 0, 0.8)) a un objeto { hex, opacity }.
     * @param {string} rgba - El string de color.
     * @returns {{hex: string, opacity: string}} - El color hex y la opacidad.
     */
    function rgbaToHexAndOpacity(rgba) {
        if (!rgba || rgba === '') return { hex: '#FFFFFF', opacity: '1.0' };

        // Caso 1: Ya es un color Hex (opacidad 1)
        if (rgba.startsWith('#')) {
            return { hex: rgba, opacity: '1.0' };
        }
        
        // Caso 2: Es un string rgba()
        let match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) {
            console.warn("Formato rgba inválido, usando defaults:", rgba);
            return { hex: '#FFFFFF', opacity: '1.0' }; // Valor por defecto
        }

        // Convertir R, G, B a Hex
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        const hex = `#${r}${g}${b}`;
        
        // Obtener opacidad (si no existe, es 1.0)
        const opacity = match[4] !== undefined ? match[4] : '1.0';

        return { hex, opacity };
    }

    /**
     * ⭐️ NUEVO: Rellena los <select> de emojis
     */
    function populateEmojiSelectors() {
        // ⭐️ LISTA DE EMOJIS AMPLIADA Y CATEGORIZADA ⭐️
        const emojiList = [
            // Caritas y Emociones
            '😊', '🥳', '❤️', '👍', '😂', '😮', '😢', '😡', '🥰', '😍', '🤔', '😎', '🎉', '🤩', '🤯', '😉', '😘', '😜', '😇', '😂', '🤣', '🥺', '🙏',
            // Personas y Fantasía
            '🐝', '🧜‍♀️', '👑', '🦸', '🧑‍🚀', '👨‍👩‍👧‍👦', '👰', '🤵', '💍', '🤴', '👸', '👨‍🎤', '👩‍🎤', '💃', '🕺', '👶', '👧', '👦', '👨', '👩', '👻', '👽', '🤖', '🤠',
            // Comida y Bebida
            '🎂', '🍰', '🍾', '🥂', '🍕', '🍔', '🍿', '🍩', '🍭', '🍓', '🍉', '🍹', '🍺', '🍷', '🍇', '🍈', '🍊', '🍋', '🍌', '🍍', '🍎', '🍏', '🍐', '🍑', '🍒', '🥝', '🥑',
            // Animales y Naturaleza
            '🐙', '🐠', '🐚', '🌸', '🌻', '🌳', '⭐️', '⚡️', '🌈', '☀️', '🌙', '🔥', '🌊', '🐶', '🐱', '🦄', '🦋', '🐞', '🐢', '🐍', '🐳', '🐬', '🦖', '🦕', '🦁', '🐯', '🐻', '🐼', '🐵',
            // Eventos y Celebración
            '🎁', '🎈', '🎊', '🎀', '🎶', '🎵', '🎤', '📢', '✉️', '💌', '🎄', '🎃', '🎇', '🎆', '✨',
            // Juegos y Actividades
            '🎲', '🕹️', '✍️', '🧠', '💀', '🏆', '❓', '🎯', '🧩', '🎮', '🚀', '🚗', '⚡', '⚽', '🏀', '🏈', '⚾', '🎾', '🎳', '🎱',
            // Objetos y Símbolos
            '💎', '📸', '🎥', '💬', '💖', '🍯', '🛠️', '🤫', '🔑', '💰', '✔️', '❌', '➕', '➖', '💯', '💡', '💣', '📖', '✏️', '📎', '📌', '🔔', '📣',
            // Viajes y Lugares
            '✈️', '🏝️', '🗺️', '🌍', '🏔️', '🏠', '🏰', '🗼', '🗽', '🎡', '🎢',
            // Banderas Populares
            '🇦🇷', '🇪🇸', '🇲🇽', '🇺🇸', '🇧🇷', '🇮🇹', '🇨🇱', '🇨🇴', '🇵🇪', '🇺🇾'
        ];

        // Eliminar duplicados (si los hubiera) y ordenar
        const uniqueSortedEmojis = [...new Set(emojiList)].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));

        const selectors = document.querySelectorAll('select[id^="icon-"]');
        
        selectors.forEach(selector => {
            selector.innerHTML = ''; // Limpiar opciones previas

            // ⭐️ AÑADIDO: Opción para no tener emoji
            const noEmojiOption = document.createElement('option');
            noEmojiOption.value = '';
            noEmojiOption.textContent = 'Vacío';
            selector.appendChild(noEmojiOption);

            uniqueSortedEmojis.forEach(emoji => {
                const option = document.createElement('option');
                option.value = emoji;
                option.textContent = emoji;
                selector.appendChild(option);
            });
        });
    }

    /**
     * ⭐️ NUEVO: Rellena el <datalist> para el input de fuentes.
     * Esto proporciona sugerencias de fuentes al hacer clic en el campo.
     */
    function populateFontDatalist() {
        const fontDatalist = document.getElementById('font-family-list');
        if (!fontDatalist) return;

        // Lista de fuentes populares de Google Fonts
        const fontList = [
            // Fuente estilo Pokémon / Retro
            "'Lasirenita, cursive",
            "'Pokemon Solid', sans-serif", // ⭐️ ¡NUEVA FUENTE PERSONALIZADA! ⭐️
            "'Press Start 2P', cursive",

            // Fuentes de Series Animadas / Caricaturas
            "'Luckiest Guy', cursive",
            "'Bangers', cursive",
            "'Creepster', cursive", // Estilo terror

            // Fuentes Sans-Serif (Modernas, limpias)
            "'Inter', sans-serif",
            "'Roboto', sans-serif",
            "'Lato', sans-serif",
            "'Montserrat', sans-serif",
            "'Open Sans', sans-serif",
            "'Poppins', sans-serif",
            "'Nunito', sans-serif",
            "'Oswald', sans-serif",
            "'Anton', sans-serif",
            "'Righteous', cursive", // Art-deco style

            // Fuentes Serif (Clásicas, con remates)
            "'Merriweather', serif",
            "'Playfair Display', serif",
            "'Lora', serif",
            "'PT Serif', serif",
            "'EB Garamond', serif"

            // Fuentes Display (Decorativas, para títulos)
            // "'Lobster', cursive", // Ya está en la lista con 'cursive'
            // "'Pacifico', cursive", // Ya está en la lista con 'cursive'
            // "'Caveat', cursive", // Ya está en la lista con 'cursive'

            // Fuentes Monospace (Estilo código)
            // "'Roboto Mono', monospace" // Ya está en la lista con 'monospace'
        ];

        fontDatalist.innerHTML = ''; // Limpiar opciones previas
        fontList.forEach(font => fontDatalist.innerHTML += `<option value="${font}"></option>`);
    }

    // =======================================================================
    // LÓGICA PRINCIPAL DEL SUPER-ADMIN (Tu código original)
    // ⭐️ MODIFICACIÓN: Quité el 'DOMContentLoaded' que envolvía esto.
    //    Ahora se ejecuta cuando 'initializeSuperAdminPanel' es llamada.
    // =======================================================================

    // 1. DEFINIR VARIABLES DEL FORMULARIO
    const form = document.getElementById('event-form');
    const saveBtn = document.getElementById('save-event-btn');
    const statusMsg = document.getElementById('status-message');
    const eventIdInput = document.getElementById('event-id');
    const loadEventBtn = document.getElementById('load-event-btn'); // ⭐️ NUEVO: Botón para cargar

    // 2. VARIABLES PARA LA LISTA DE EVENTOS
    const eventsListElement = document.getElementById('existing-events-list');
// ⭐️ NUEVO: Lógica para plantillas de temas (MOVIDO ARRIBA)
const themeTemplateSelector = document.getElementById('theme-template-selector');
const applyTemplateBtn = document.getElementById('apply-template-btn');

    // 3. ASIGNAR EVENTOS
    loadEventBtn.addEventListener('click', loadEventSettings); // ⭐️ NUEVO: Evento para el botón
    form.addEventListener('submit', handleFormSubmit);
    onValue(ref(database, 'events'), renderEventsList); // ⭐️ CORREGIDO: Usar la referencia directamente
    eventsListElement.addEventListener('click', handleListClick); 
    populateEmojiSelectors(); // ⭐️ NUEVO: Llenar los selectores de emojis al iniciar
    populateFontDatalist(); // ⭐️ NUEVO: Llenar el datalist de fuentes
    themeTemplateSelector.addEventListener('change', showThemePreview); // ⭐️ NUEVO: Evento para previsualizar
    loadThemeTemplates(); // Cargar plantillas al iniciar el panel
    applyTemplateBtn.addEventListener('click', applyThemeTemplate);


    /**
     * Carga los settings de un Evento
     */
    async function loadEventSettings(eventIdToLoad) {
        let eventId;
        // Si la función recibe un ID directamente (desde la lista), lo usa.
        // Si no (desde el botón 'Buscar/Cargar'), toma el valor del input.
        if (typeof eventIdToLoad === 'string') {
            eventId = eventIdToLoad;
        } else {
            eventId = eventIdInput.value.trim().toLowerCase();
        }

        if (!eventId) return;

        statusMsg.textContent = `Buscando configuración para "${eventId}"...`;
        const configRef = ref(database, `events/${eventId}/config`);

        try {
            const snapshot = await get(configRef);
            if (snapshot.exists()) {
                const config = snapshot.val();
                populateForm(config); 
                statusMsg.textContent = `Configuración de "${eventId}" cargada. Lista para modificar.`;
            } else {
                statusMsg.textContent = `Evento "${eventId}" no encontrado. Se creará uno nuevo con esta configuración.`;
                resetFormToDefaults(); 
            }
        } catch (error) {
            console.error("Error cargando configuración:", error);
            statusMsg.textContent = `Error al buscar la configuración: ${error.message}`;
        }
    }

    // Esta función depende de `populateForm`, por lo que debe permanecer o definirse aquí.
    async function applyThemeTemplate() {
        const themeTemplateSelector = document.getElementById('theme-template-selector');
        const selectedTemplateId = themeTemplateSelector.value;
        if (!selectedTemplateId) return;

        const templateRef = ref(database, `themeTemplates/${selectedTemplateId}`);
        const snapshot = await get(templateRef);
        if (snapshot.exists()) {
            populateForm(snapshot.val()); // Aplicar la plantilla COMPLETA
            statusMsg.textContent = `Plantilla "${selectedTemplateId}" aplicada al formulario.`;
        }
    }

    /**
     * Rellena el formulario con datos de Firebase
     */
    function populateForm(config) {
        // Extraer secciones con valores por defecto
        const theme = config.theme || {};
        const features = config.features || {};
        const status = config.status || {};
        const texts = config.texts || {};
        const icons = theme.icons || {};
        // ⭐️ NUEVO: Extraer la configuración de autenticación
        const authConfig = config.auth || {};

        // Rellenar Funcionalidades y Estado
        document.getElementById('games-enabled').checked = features.games_enabled !== false;
        document.getElementById('event-active').checked = status.is_active !== false;


        // Rellenar Tema Global
        // ⭐️ NUEVO: Rellenar campos de autenticación
        document.getElementById('auth-event-username').value = authConfig.username || '';
        document.getElementById('auth-event-password').value = authConfig.password || '';

        document.getElementById('color-primary').value = theme.color_primary || '#FACC15';
        document.getElementById('color-secondary').value = theme.color_secondary || '#F59E0B';
        document.getElementById('color-text').value = theme.color_text || '#1F2937';
        document.getElementById('color-success').value = theme.color_success || '#4CAF50';
        document.getElementById('color-danger').value = theme.color_danger || '#E53935';
        document.getElementById('color-text-light').value = theme.color_text_light || '#FFFFFF';
        document.getElementById('font-family').value = theme.font_family || "'Inter', sans-serif";
        document.getElementById('btn-shadow').value = theme.btn_shadow || '0 5px';

        // ⭐️ NUEVO: Rellenar contorno de texto
        document.getElementById('text-stroke-width').value = theme.text_stroke_width || '';
        document.getElementById('text-stroke-color').value = theme.text_stroke_color || '#000000';

        // Rellenar Textos
        document.getElementById('text-portal-greeting').value = texts.portal_greeting || '¡Bienvenido a la Colmena!';
        document.getElementById('text-portal-greeting-color').value = texts.portal_greeting_color || '#6B7280';
        document.getElementById('text-portal-greeting-font-size').value = texts.portal_greeting_font_size || '';
        document.getElementById('text-portal-greeting-font-family').value = texts.portal_greeting_font_family || '';
        document.getElementById('text-portal-greeting-letter-spacing').value = texts.portal_greeting_letter_spacing || '';

        document.getElementById('text-portal-title').value = texts.portal_title || 'Portal de Recuerdos 🍯';
        document.getElementById('text-portal-title-font-family').value = texts.portal_title_font_family || '';
        document.getElementById('text-portal-title-letter-spacing').value = texts.portal_title_letter_spacing || '';

        document.getElementById('text-portal-subtitle').value = texts.portal_subtitle || 'Deja un mensaje, una foto o video capturado.';
        document.getElementById('text-portal-subtitle-color').value = texts.portal_subtitle_color || '#4B5563';
        document.getElementById('text-portal-subtitle-font-family').value = texts.portal_subtitle_font_family || '';
        document.getElementById('text-portal-subtitle-letter-spacing').value = texts.portal_subtitle_letter_spacing || '';

        document.getElementById('text-memories-section-title').value = texts.memories_section_title || 'Deja tu Recuerdo';
        document.getElementById('text-memories-section-title-color').value = texts.memories_section_title_color || '#1F2937';
        document.getElementById('text-memories-section-title-font-family').value = texts.memories_section_title_font_family || '';
        document.getElementById('text-memories-section-title-letter-spacing').value = texts.memories_section_title_letter_spacing || '';
        document.getElementById('text-portal-subtitle-font-size').value = texts.portal_subtitle_font_size || '';

        document.getElementById('text-memories-list-title').value = texts.memories_list_title || 'Recuerdos de la Colmena';
        document.getElementById('text-memories-list-title-color').value = texts.memories_list_title_color || '#4B5563';
        // ⭐️ NUEVO: Rellenar campos de fuente y espaciado para la lista de recuerdos
        document.getElementById('text-memories-list-title-font-family').value = texts.memories_list_title_font_family || '';
        document.getElementById('text-memories-list-title-letter-spacing').value = texts.memories_list_title_letter_spacing || '';


        // ⭐️ NUEVO: Rellenar textos de botones de juegos
        document.getElementById('text-juegos-menu-trivia').value = texts.juegos_menu_trivia || '¿Cuanto conoces a Amo?';
        document.getElementById('text-juegos-menu-memory').value = texts.juegos_menu_memory || 'Memoria con Amo';
        document.getElementById('text-juegos-menu-hangman').value = texts.juegos_menu_hangman || 'Ahorcado';


        // Rellenar Iconos
        document.getElementById('icon-main').value = icons.icon_main || '🐝'; // Valor por defecto si no existe
        document.getElementById('icon-portal').value = icons.icon_portal || '💬'; // Valor por defecto si no existe
        document.getElementById('icon-trivia').value = icons.icon_trivia || '✍️'; // Valor por defecto si no existe
        document.getElementById('icon-memory').value = icons.icon_memory || '🧠'; // Valor por defecto si no existe
        document.getElementById('icon-hangman').value = icons.icon_hangman || '💀'; // Valor por defecto si no existe
        document.getElementById('icon-ranking').value = icons.icon_ranking || '🏆'; // Valor por defecto si no existe
        document.getElementById('icon-win').value = icons.icon_win || '🎉'; // Valor por defecto si no existe
        document.getElementById('icon-games').value = icons.icon_games || '🕹️';
        document.getElementById('icon-like').value = icons.icon_like || '❤️';
        document.getElementById('icon-memories').value = icons.icon_memories || '💖';


        // Rellenar Personalización del Portal
        // ⭐️ MODIFICADO: Usar la función de conversión para 'portal_bg'
        const portalBg = rgbaToHexAndOpacity(theme.portal_bg);
        document.getElementById('portal-bg').value = portalBg.hex;
        document.getElementById('portal-bg-opacity').value = portalBg.opacity;
        
        document.getElementById('portal-border-radius').value = theme.portal_border_radius || '';
        document.getElementById('portal-title-color').value = theme.portal_title_color || '#1F2937';
        document.getElementById('portal-title-font-size').value = theme.portal_title_font_size || '';
        document.getElementById('btn-portal-bg').value = theme.btn_portal_bg || '#FACC15';
        document.getElementById('btn-portal-text-color').value = theme.btn_portal_text_color || '#1F2937';
        document.getElementById('btn-portal-border-radius').value = theme.btn_portal_border_radius || '';
        document.getElementById('btn-portal-shadow-color').value = theme.btn_portal_shadow_color || '#F59E0B';
        document.getElementById('btn-portal-shadow-color-hover').value = theme.btn_portal_shadow_color_hover || '#dd6b20';

        // ⭐️ NUEVO: Rellenar Personalización de Botones del Menú de Juegos
        document.getElementById('btn-juegos-menu-bg').value = theme.btn_juegos_menu_bg || '#66BB6A';
        document.getElementById('btn-juegos-menu-text-color').value = theme.btn_juegos_menu_text_color || '#FFFFFF';
        document.getElementById('btn-juegos-menu-border-color').value = theme.btn_juegos_menu_border_color || '#388E3C';
        document.getElementById('btn-juegos-menu-shadow-color').value = theme.btn_juegos_menu_shadow_color || '#388E3C';
        document.getElementById('btn-juegos-menu-border-radius').value = theme.btn_juegos_menu_border_radius || '';

        // ⭐️ NUEVO: Rellenar Personalización de Trivia (Contenedor y Textos)
        const triviaContainerBg = rgbaToHexAndOpacity(theme.trivia_container_bg);
        document.getElementById('trivia-container-bg').value = triviaContainerBg.hex;
        document.getElementById('trivia-container-bg-opacity').value = triviaContainerBg.opacity;
        document.getElementById('trivia-container-border-radius').value = theme.trivia_container_border_radius || '';
        document.getElementById('text-trivia-title').value = texts.trivia_title || 'Trivia del Evento 🐝';
        document.getElementById('text-trivia-welcome').value = texts.trivia_welcome || '¡Bienvenido a la Colmena!';
        document.getElementById('text-trivia-subtitle').value = texts.trivia_subtitle || '¿Cuanto sabes de Amo?';
        document.getElementById('text-trivia-title-font-family').value = texts.trivia_title_font_family || '';
        document.getElementById('text-trivia-title-letter-spacing').value = texts.trivia_title_letter_spacing || '';
        document.getElementById('text-trivia-welcome-font-family').value = texts.trivia_welcome_font_family || '';
        document.getElementById('text-trivia-welcome-letter-spacing').value = texts.trivia_welcome_letter_spacing || '';

        // Rellenar Personalización de Trivia
        document.getElementById('btn-trivia-bg').value = theme.btn_trivia_bg || '#ffb300';
        document.getElementById('btn-trivia-bg-hover').value = theme.btn_trivia_bg_hover || '#ff9900';
        document.getElementById('btn-trivia-text-color').value = theme.btn_trivia_text_color || '#FFFFFF';
        document.getElementById('btn-trivia-border-color').value = theme.btn_trivia_border_color || '#e69900';
        document.getElementById('btn-trivia-shadow-color').value = theme.btn_trivia_shadow_color || '#e69900';
        document.getElementById('btn-trivia-border-radius').value = theme.btn_trivia_border_radius || '';
        document.getElementById('btn-trivia-font-size').value = theme.btn_trivia_font_size || '';
        document.getElementById('btn-trivia-padding').value = theme.btn_trivia_padding || '';

        // Rellenar Personalización de Memoria
        const memoryContainerBg = rgbaToHexAndOpacity(theme.memory_container_bg);
        document.getElementById('memory-container-bg').value = memoryContainerBg.hex;
        document.getElementById('memory-container-bg-opacity').value = memoryContainerBg.opacity;
        document.getElementById('memory-container-border-radius').value = theme.memory_container_border_radius || '';
        document.getElementById('text-memory-title').value = texts.memory_title || 'Juego de Memoria 🧠';
        document.getElementById('text-memory-title-font-family').value = texts.memory_title_font_family || '';
        document.getElementById('text-memory-title-letter-spacing').value = texts.memory_title_letter_spacing || '';

        // Rellenar Personalización de Memoria (Cartas)
        document.getElementById('mem-card-back-bg').value = theme.mem_card_back_bg || '#F59E0B';
        document.getElementById('mem-card-back-border-color').value = theme.mem_card_back_border_color || '#1F2937';
        document.getElementById('mem-card-height').value = theme.mem_card_height || '';
        document.getElementById('mem-card-border-radius').value = theme.mem_card_border_radius || '';

        // ⭐️ NUEVO: Rellenar Personalización de Ahorcado
        const hangmanContainerBg = rgbaToHexAndOpacity(theme.hangman_container_bg);
        document.getElementById('hangman-container-bg').value = hangmanContainerBg.hex;
        document.getElementById('hangman-container-bg-opacity').value = hangmanContainerBg.opacity;
        document.getElementById('hangman-container-border-radius').value = theme.hangman_container_border_radius || '';
        document.getElementById('text-hangman-title').value = texts.hangman_title || 'El Ahorcado 💀';
        document.getElementById('text-hangman-subtitle').value = texts.hangman_subtitle || 'Adivina la palabra secreta...';
        document.getElementById('text-hangman-title-font-family').value = texts.hangman_title_font_family || '';
        document.getElementById('text-hangman-title-letter-spacing').value = texts.hangman_title_letter_spacing || '';
        document.getElementById('text-hangman-subtitle-font-family').value = texts.hangman_subtitle_font_family || '';
        document.getElementById('text-hangman-subtitle-letter-spacing').value = texts.hangman_subtitle_letter_spacing || '';

        document.getElementById('btn-hangman-bg').value = theme.btn_hangman_bg || '#FACC15';
        document.getElementById('btn-hangman-text-color').value = theme.btn_hangman_text_color || '#1F2937';
        document.getElementById('btn-hangman-border-color').value = theme.btn_hangman_border_color || '#F59E0B';
        document.getElementById('btn-hangman-shadow-color').value = theme.btn_hangman_shadow_color || '#F59E0B';

        // Rellenar Personalización de Rankings
        const rankingContainerBg = rgbaToHexAndOpacity(theme.ranking_container_bg);
        document.getElementById('ranking-container-bg').value = rankingContainerBg.hex;
        document.getElementById('ranking-container-bg-opacity').value = rankingContainerBg.opacity;
        document.getElementById('ranking-container-border-radius').value = theme.ranking_container_border_radius || '';
        document.getElementById('text-ranking-title').value = texts.ranking_title || 'Rankings de la Colmena 🏆';
        document.getElementById('text-ranking-title-font-family').value = texts.ranking_title_font_family || '';
        document.getElementById('text-ranking-title-letter-spacing').value = texts.ranking_title_letter_spacing || '';
        // ⭐️ NUEVO: Rellenar el campo de tamaño de fuente del ranking
        document.getElementById('text-ranking-title-font-size').value = texts.ranking_title_font_size || '';
        // ⭐️ NUEVO: Rellenar el campo de color del título del ranking
        document.getElementById('text-ranking-title-color').value = texts.ranking_title_color || '#1F2937';

        // Rellenar Personalización de Rankings (Ganadores)
        document.getElementById('ranking-trivia-winner-bg').value = theme.ranking_trivia_winner_bg || '#FFCC00';
        document.getElementById('ranking-trivia-winner-text').value = theme.ranking_trivia_winner_text || '#1F2937';
        document.getElementById('ranking-trivia-winner-border').value = theme.ranking_trivia_winner_border || '#F59E0B';
        document.getElementById('ranking-memory-winner-bg').value = theme.ranking_memory_winner_bg || '#cceeff';
        document.getElementById('ranking-memory-winner-text').value = theme.ranking_memory_winner_text || '#0056b3';
        document.getElementById('ranking-memory-winner-border').value = theme.ranking_memory_winner_border || '#007bff';

        // ⭐️ NUEVO: Rellenar Personalización de Anfitrión
        document.getElementById('host-container-bg').value = theme.host_container_bg || '#FFFFFF';
        document.getElementById('host-container-border-radius').value = theme.host_container_border_radius || '';
        document.getElementById('text-host-login-title').value = texts.host_login_title || 'Acceso de Anfitrión';
        document.getElementById('text-host-panel-title').value = texts.host_panel_title || 'Panel de Control';
        document.getElementById('text-host-document-title').value = texts.host_document_title || 'Panel de Anfitrión';
        document.getElementById('btn-host-bg').value = theme.btn_host_bg || '#1F2937';
        document.getElementById('btn-host-text-color').value = theme.btn_host_text_color || '#FACC15';
        document.getElementById('btn-host-border-color').value = theme.btn_host_border_color || '#FACC15';

        // Rellenar previsualización de imagen
        const preview = document.getElementById('bg-image-preview');
        if (theme.background_image_url) {
            preview.innerHTML = `
                <p class="text-xs text-gray-600">Fondo actual:</p>
                <img src="${theme.background_image_url}" class="w-full h-24 object-cover rounded-lg border border-gray-300">
            `;
        } else {
            preview.innerHTML = '';
        }

        // ⭐️ NUEVO: Rellenar ajuste y posición de fondo
        document.getElementById('background-image-size').value = theme.background_image_size || 'cover';
        document.getElementById('background-image-position').value = theme.background_image_position || 'center';

        // ⭐️ NUEVO: Rellenar campos de stickers (lógica mejorada)
        const populateStickerFields = (type, index, stickerData) => {
            const s = stickerData || {};
            document.getElementById(`sticker_${type}_${index}_file`).value = '';
            document.getElementById(`sticker_${type}_${index}_width`).value = s.width || '';
            document.getElementById(`sticker_${type}_${index}_transform`).value = s.transform || '';
            document.getElementById(`sticker_${type}_${index}_top`).value = s.top || '';
            document.getElementById(`sticker_${type}_${index}_bottom`).value = s.bottom || '';
            document.getElementById(`sticker_${type}_${index}_left`).value = s.left || '';
            document.getElementById(`sticker_${type}_${index}_right`).value = s.right || '';

            const preview = document.getElementById(`sticker_${type}_${index}_preview`);
            if (s.url) {
                preview.innerHTML = `<p class="text-xs text-gray-600">Sticker Actual:</p><img src="${s.url}" class="h-20 object-contain rounded-lg border border-gray-300 p-1">`;
            } else {
                preview.innerHTML = '';
            }
        };

        populateStickerFields('portal', 1, theme.portal_stickers?.[0]);
        populateStickerFields('portal', 2, theme.portal_stickers?.[1]);
        populateStickerFields('juegos', 1, theme.juegos_stickers?.[0]);
        populateStickerFields('juegos', 2, theme.juegos_stickers?.[1]);

        document.getElementById('bg-image').value = '';
    }

    /**
     * Limpia el formulario a sus valores por defecto
     */
    function resetFormToDefaults() {
        form.reset(); 
        document.getElementById('games-enabled').checked = true;
        document.getElementById('event-active').checked = true;
        const preview = document.getElementById('bg-image-preview');
        if (preview) preview.innerHTML = '';
        // ⭐️ NUEVO: Limpiar todas las previsualizaciones de stickers
        ['portal_1', 'portal_2', 'juegos_1', 'juegos_2'].forEach(id => {
            const stickerPreview = document.getElementById(`sticker_${id}_preview`);
            if (stickerPreview) stickerPreview.innerHTML = '';
        });
        // ⭐️ Resetear el slider de opacidad
        document.getElementById('portal-bg-opacity').value = '1.0';
    }


    /**
     * Maneja el envío del formulario para crear/actualizar un evento
     */
    async function handleFormSubmit(e) {
        e.preventDefault();
        saveBtn.disabled = true;
        statusMsg.textContent = 'Guardando...';

        const eventId = document.getElementById('event-id').value.trim().toLowerCase();
        if (!eventId) {
            alert('El ID del Evento es obligatorio.');
            statusMsg.textContent = 'Error: Falta ID del Evento.';
            saveBtn.disabled = false;
            return;
        }
        
        // ⭐️ MODIFICADO: Combinar 'portal_bg' y 'portal_bg_opacity'
        const portalBgColor = document.getElementById('portal-bg').value;
        const portalBgOpacity = document.getElementById('portal-bg-opacity').value;
        const portalBgRgba = hexToRgba(portalBgColor, portalBgOpacity);
        // ⭐️ NUEVO: Obtener la opacidad de la sección de recuerdos
        const memoriesSectionBgOpacity = document.getElementById('memories-section-bg-opacity').value;


        const themeConfig = {
            // Tema Global
            color_primary: document.getElementById('color-primary').value,
            color_secondary: document.getElementById('color-secondary').value,
            color_text: document.getElementById('color-text').value,
            color_success: document.getElementById('color-success').value,
            color_danger: document.getElementById('color-danger').value,
            color_text_light: document.getElementById('color-text-light').value,
            font_family: document.getElementById('font-family').value,
            btn_shadow: document.getElementById('btn-shadow').value.trim() || null,
            
            // ⭐️ NUEVO: Guardar contorno de texto
            text_stroke_width: document.getElementById('text-stroke-width').value.trim() || null,
            text_stroke_color: document.getElementById('text-stroke-color').value,

            // ⭐️ NUEVO: Guardar ajuste y posición de fondo
            background_image_size: document.getElementById('background-image-size').value,
            background_image_position: document.getElementById('background-image-position').value,

            icons: {
                icon_main: document.getElementById('icon-main').value || '🐝',
                icon_portal: document.getElementById('icon-portal').value || '🎁',
                icon_trivia: document.getElementById('icon-trivia').value || '✍️',
                icon_memory: document.getElementById('icon-memory').value || '🧠',
                icon_hangman: document.getElementById('icon-hangman').value || '💀',
                icon_ranking: document.getElementById('icon-ranking').value || '🏆',
                icon_win: document.getElementById('icon-win').value || '🎉',
                icon_games: document.getElementById('icon-games').value || '🕹️',
                icon_memories: document.getElementById('icon-memories').value || '💖',
                icon_like: document.getElementById('icon-like').value || '❤️'
            },
            
            // Personalización del Portal
            portal_bg: portalBgRgba, // ⭐️ Guardar el valor combinado
            // ⭐️ NUEVO: Guardar la opacidad de la sección de recuerdos
            memories_section_bg_opacity: memoriesSectionBgOpacity,
            portal_border_radius: document.getElementById('portal-border-radius').value.trim() || null,
            portal_title_color: document.getElementById('portal-title-color').value,
            portal_title_font_size: document.getElementById('portal-title-font-size').value.trim() || null,
            btn_portal_bg: document.getElementById('btn-portal-bg').value,
            btn_portal_text_color: document.getElementById('btn-portal-text-color').value,
            btn_portal_border_radius: document.getElementById('btn-portal-border-radius').value.trim() || null,
            btn_portal_shadow_color: document.getElementById('btn-portal-shadow-color').value,
            btn_portal_shadow_color_hover: document.getElementById('btn-portal-shadow-color-hover').value,

            // ⭐️ NUEVO: Personalización de Botones del Menú de Juegos
            btn_juegos_menu_bg: document.getElementById('btn-juegos-menu-bg').value.trim() || null,
            btn_juegos_menu_text_color: document.getElementById('btn-juegos-menu-text-color').value.trim() || null,
            btn_juegos_menu_border_color: document.getElementById('btn-juegos-menu-border-color').value.trim() || null,
            btn_juegos_menu_shadow_color: document.getElementById('btn-juegos-menu-shadow-color').value.trim() || null,
            btn_juegos_menu_border_radius: document.getElementById('btn-juegos-menu-border-radius').value.trim() || null,

            // ⭐️ NUEVO: Personalización de Trivia (Contenedor)
            trivia_container_bg: hexToRgba(document.getElementById('trivia-container-bg').value, document.getElementById('trivia-container-bg-opacity').value),
            trivia_container_border_radius: document.getElementById('trivia-container-border-radius').value.trim() || null,


            // Personalización de Trivia
            btn_trivia_bg: document.getElementById('btn-trivia-bg').value.trim() || null,
            btn_trivia_bg_hover: document.getElementById('btn-trivia-bg-hover').value.trim() || null,
            btn_trivia_text_color: document.getElementById('btn-trivia-text-color').value.trim() || null,
            btn_trivia_border_color: document.getElementById('btn-trivia-border-color').value.trim() || null,
            btn_trivia_shadow_color: document.getElementById('btn-trivia-shadow-color').value.trim() || null,
            btn_trivia_border_radius: document.getElementById('btn-trivia-border-radius').value.trim() || null,
            btn_trivia_font_size: document.getElementById('btn-trivia-font-size').value.trim() || null,
            btn_trivia_padding: document.getElementById('btn-trivia-padding').value.trim() || null,

            // Personalización de Memoria
            memory_container_bg: hexToRgba(document.getElementById('memory-container-bg').value, document.getElementById('memory-container-bg-opacity').value),
            memory_container_border_radius: document.getElementById('memory-container-border-radius').value.trim() || null,


            // Personalización de Memoria (Cartas)
            mem_card_back_bg: document.getElementById('mem-card-back-bg').value.trim() || null,
            mem_card_back_border_color: document.getElementById('mem-card-back-border-color').value.trim() || null,
            mem_card_height: document.getElementById('mem-card-height').value.trim() || null,
            mem_card_border_radius: document.getElementById('mem-card-border-radius').value.trim() || null,

            // ⭐️ NUEVO: Personalización de Ahorcado
            hangman_container_bg: hexToRgba(document.getElementById('hangman-container-bg').value, document.getElementById('hangman-container-bg-opacity').value),
            hangman_container_border_radius: document.getElementById('hangman-container-border-radius').value.trim() || null,
            btn_hangman_bg: document.getElementById('btn-hangman-bg').value.trim() || null,
            btn_hangman_text_color: document.getElementById('btn-hangman-text-color').value.trim() || null,
            btn_hangman_border_color: document.getElementById('btn-hangman-border-color').value.trim() || null,
            btn_hangman_shadow_color: document.getElementById('btn-hangman-shadow-color').value.trim() || null,


            // Personalización de Rankings
            ranking_container_bg: hexToRgba(document.getElementById('ranking-container-bg').value, document.getElementById('ranking-container-bg-opacity').value),
            ranking_container_border_radius: document.getElementById('ranking-container-border-radius').value.trim() || null,


            // Personalización de Rankings (Ganadores)
            ranking_trivia_winner_bg: document.getElementById('ranking-trivia-winner-bg').value.trim() || null,
            ranking_trivia_winner_text: document.getElementById('ranking-trivia-winner-text').value.trim() || null,
            ranking_trivia_winner_border: document.getElementById('ranking-trivia-winner-border').value.trim() || null,
            ranking_memory_winner_bg: document.getElementById('ranking-memory-winner-bg').value.trim() || null,
            ranking_memory_winner_text: document.getElementById('ranking-memory-winner-text').value.trim() || null,
            ranking_memory_winner_border: document.getElementById('ranking-memory-winner-border').value.trim() || null,

            // ⭐️ NUEVO: Personalización de Anfitrión
            host_container_bg: document.getElementById('host-container-bg').value.trim() || null,
            host_container_border_radius: document.getElementById('host-container-border-radius').value.trim() || null,
            btn_host_bg: document.getElementById('btn-host-bg').value.trim() || null,
            btn_host_text_color: document.getElementById('btn-host-text-color').value.trim() || null,
            btn_host_border_color: document.getElementById('btn-host-border-color').value.trim() || null,

        };

        const textsConfig = {
            portal_greeting: document.getElementById('text-portal-greeting').value.trim() || null,
            portal_greeting_color: document.getElementById('text-portal-greeting-color').value.trim() || null,
            portal_greeting_font_size: document.getElementById('text-portal-greeting-font-size').value.trim() || null,
            portal_greeting_font_family: document.getElementById('text-portal-greeting-font-family').value.trim() || null,
            portal_greeting_letter_spacing: document.getElementById('text-portal-greeting-letter-spacing').value.trim() || null,

            portal_title: document.getElementById('text-portal-title').value.trim() || null,
            portal_title_font_family: document.getElementById('text-portal-title-font-family').value.trim() || null,
            portal_title_letter_spacing: document.getElementById('text-portal-title-letter-spacing').value.trim() || null,

            portal_subtitle: document.getElementById('text-portal-subtitle').value.trim() || null,
            portal_subtitle_color: document.getElementById('text-portal-subtitle-color').value.trim() || null,
            portal_subtitle_font_size: document.getElementById('text-portal-subtitle-font-size').value.trim() || null,
            portal_subtitle_font_family: document.getElementById('text-portal-subtitle-font-family').value.trim() || null,
            portal_subtitle_letter_spacing: document.getElementById('text-portal-subtitle-letter-spacing').value.trim() || null,

            memories_section_title: document.getElementById('text-memories-section-title').value.trim() || null,
            memories_section_title_color: document.getElementById('text-memories-section-title-color').value.trim() || null,
            memories_section_title_font_family: document.getElementById('text-memories-section-title-font-family').value.trim() || null,
            memories_section_title_letter_spacing: document.getElementById('text-memories-section-title-letter-spacing').value.trim() || null,

            memories_list_title: document.getElementById('text-memories-list-title').value.trim() || null,
            memories_list_title_color: document.getElementById('text-memories-list-title-color').value.trim() || null,
            // ⭐️ NUEVO: Guardar campos de fuente y espaciado
            memories_list_title_font_family: document.getElementById('text-memories-list-title-font-family').value.trim() || null,
            memories_list_title_letter_spacing: document.getElementById('text-memories-list-title-letter-spacing').value.trim() || null,

            
            // ⭐️ NUEVO: Textos de botones de juegos
            juegos_menu_trivia: document.getElementById('text-juegos-menu-trivia').value.trim() || null,
            juegos_menu_memory: document.getElementById('text-juegos-menu-memory').value.trim() || null,
            juegos_menu_hangman: document.getElementById('text-juegos-menu-hangman').value.trim() || null,

            // ⭐️ NUEVO: Textos de Trivia
            trivia_title: document.getElementById('text-trivia-title').value.trim() || null,
            trivia_title_font_family: document.getElementById('text-trivia-title-font-family').value.trim() || null,
            trivia_title_letter_spacing: document.getElementById('text-trivia-title-letter-spacing').value.trim() || null,
            trivia_welcome: document.getElementById('text-trivia-welcome').value.trim() || null,
            trivia_welcome_font_family: document.getElementById('text-trivia-welcome-font-family').value.trim() || null,
            trivia_welcome_letter_spacing: document.getElementById('text-trivia-welcome-letter-spacing').value.trim() || null,
            trivia_subtitle: document.getElementById('text-trivia-subtitle').value.trim() || null,

            // ⭐️ NUEVO: Textos de Memoria
            memory_title: document.getElementById('text-memory-title').value.trim() || null,
            memory_title_font_family: document.getElementById('text-memory-title-font-family').value.trim() || null,
            memory_title_letter_spacing: document.getElementById('text-memory-title-letter-spacing').value.trim() || null,

            // ⭐️ NUEVO: Textos de Ahorcado
            hangman_title: document.getElementById('text-hangman-title').value.trim() || null,
            hangman_title_font_family: document.getElementById('text-hangman-title-font-family').value.trim() || null,
            hangman_title_letter_spacing: document.getElementById('text-hangman-title-letter-spacing').value.trim() || null,
            hangman_subtitle: document.getElementById('text-hangman-subtitle').value.trim() || null,
            hangman_subtitle_font_family: document.getElementById('text-hangman-subtitle-font-family').value.trim() || null,
            hangman_subtitle_letter_spacing: document.getElementById('text-hangman-subtitle-letter-spacing').value.trim() || null,

            // ⭐️ NUEVO: Textos de Ranking
            ranking_title: document.getElementById('text-ranking-title').value.trim() || null,
            ranking_title_font_family: document.getElementById('text-ranking-title-font-family').value.trim() || null,
            ranking_title_letter_spacing: document.getElementById('text-ranking-title-letter-spacing').value.trim() || null,
            // ⭐️ NUEVO: Guardar el tamaño de fuente del ranking
            ranking_title_font_size: document.getElementById('text-ranking-title-font-size').value.trim() || null,
            // ⭐️ NUEVO: Guardar el color del título del ranking
            ranking_title_color: document.getElementById('text-ranking-title-color').value.trim() || null,

            // ⭐️ NUEVO: Textos de Anfitrión
            host_login_title: document.getElementById('text-host-login-title').value.trim() || null,
            host_panel_title: document.getElementById('text-host-panel-title').value.trim() || null,
            host_document_title: document.getElementById('text-host-document-title').value.trim() || null,
        };
        
        const fullConfig = {
            theme: themeConfig,
            texts: textsConfig,
            features: { games_enabled: document.getElementById('games-enabled').checked, },
            status: { is_active: document.getElementById('event-active').checked, },
            // ⭐️ NUEVO: Guardar la configuración de autenticación
            auth: {
                username: document.getElementById('auth-event-username').value.trim() || null,
                password: document.getElementById('auth-event-password').value.trim() || null,
            }
        };

        // ⭐️ INICIO: NUEVA LÓGICA PARA CREAR/ACTUALIZAR USUARIO ANFITRIÓN ⭐️
        const hostUsername = document.getElementById('auth-event-username').value.trim();
        const hostPassword = document.getElementById('auth-event-password').value.trim();

        if (hostUsername && hostPassword) {
            try {
                statusMsg.textContent = 'Creando/actualizando usuario anfitrión...';
                const createOrUpdateHostUser = httpsCallable(functions, 'createOrUpdateHostUser');
                const result = await createOrUpdateHostUser({
                    username: hostUsername,
                    password: hostPassword
                });
                console.log(result.data.message); // Log del éxito desde la función
            } catch (error) {
                console.error("Error al crear/actualizar el usuario anfitrión:", error);
                statusMsg.textContent = `Error con el usuario anfitrión: ${error.message}`;
                // No detenemos el guardado, pero mostramos el error.
            }
        }
        // ⭐️ FIN: NUEVA LÓGICA ⭐️

        try {
            const imageFile = document.getElementById('bg-image').files[0];
            if (imageFile) {
                // Si hay un archivo nuevo, lo subimos y actualizamos la URL en la configuración.
                statusMsg.textContent = 'Subiendo nueva imagen de fondo...';
                const imagePath = `events/${eventId}/theme/background.${imageFile.name.split('.').pop()}`;
                const sRef = storageRef(storage, imagePath);
                
                const uploadTask = await uploadBytesResumable(sRef, imageFile); 
                const downloadURL = await getDownloadURL(uploadTask.ref);
                
                fullConfig.theme.background_image_url = downloadURL; 
                statusMsg.textContent = 'Imagen subida. Guardando config...';
            } else {
                // Si NO hay archivo nuevo, nos aseguramos de mantener la URL existente.
                const previewImg = document.getElementById('bg-image-preview').querySelector('img');
                if (previewImg && previewImg.src) {
                    fullConfig.theme.background_image_url = previewImg.src;
                } else {
                    fullConfig.theme.background_image_url = null; // Si no hay ni preview, la eliminamos.
                }
                statusMsg.textContent = 'Guardando configuración...';
            }
            
            // ⭐️ NUEVO: Función auxiliar para procesar y subir cada sticker
            const processStickerData = async (type, index) => {
                const file = document.getElementById(`sticker_${type}_${index}_file`).files[0];
                const stickerData = {
                    width: document.getElementById(`sticker_${type}_${index}_width`).value.trim() || null,
                    transform: document.getElementById(`sticker_${type}_${index}_transform`).value.trim() || null,
                    top: document.getElementById(`sticker_${type}_${index}_top`).value.trim() || null,
                    bottom: document.getElementById(`sticker_${type}_${index}_bottom`).value.trim() || null,
                    left: document.getElementById(`sticker_${type}_${index}_left`).value.trim() || null,
                    right: document.getElementById(`sticker_${type}_${index}_right`).value.trim() || null,
                    url: null
                };

                if (file) {
                    statusMsg.textContent = `Subiendo sticker ${type} ${index}...`;
                    const stickerPath = `events/${eventId}/theme/sticker_${type}_${index}.${file.name.split('.').pop()}`;
                    const sRef = storageRef(storage, stickerPath);
                    const uploadTask = await uploadBytesResumable(sRef, file);
                    stickerData.url = await getDownloadURL(uploadTask.ref);
                } else {
                    const previewImg = document.getElementById(`sticker_${type}_${index}_preview`).querySelector('img');
                    stickerData.url = previewImg ? previewImg.src : null;
                }

                // Solo devolvemos el objeto si tiene una URL
                return stickerData.url ? stickerData : null;
            };

            // Procesar todos los stickers y filtrar los que no tienen URL
            const portalStickers = (await Promise.all([
                processStickerData('portal', 1),
                processStickerData('portal', 2)
            ])).filter(Boolean); // filter(Boolean) elimina los nulos

            const juegosStickers = (await Promise.all([
                processStickerData('juegos', 1),
                processStickerData('juegos', 2)
            ])).filter(Boolean);

            fullConfig.theme.portal_stickers = portalStickers.length > 0 ? portalStickers : null;
            fullConfig.theme.juegos_stickers = juegosStickers.length > 0 ? juegosStickers : null;

            const dbConfigRef = ref(database, `events/${eventId}/config`);
            await set(dbConfigRef, fullConfig);

            statusMsg.textContent = `¡Éxito! Evento "${eventId}" guardado/actualizado.`;
            
        } catch (error) {
            console.error("Error al guardar:", error);
            statusMsg.textContent = `Error: ${error.message}`;
        } finally {
            saveBtn.disabled = false;
        }
    }

    /**
     * Renderiza la lista de eventos existentes
     */
    function renderEventsList(snapshot) {
        eventsListElement.innerHTML = ''; 
        if (!snapshot.exists()) {
            eventsListElement.innerHTML = '<li class="p-2 text-gray-500 italic text-center">No hay eventos creados.</li>';
            return;
        }

        snapshot.forEach((childSnapshot) => {
            const eventId = childSnapshot.key;
            const li = document.createElement('li');
            li.className = 'question-item'; 
            
            li.innerHTML = `
                <div class="q-display">
                    <strong class="text-gray-700">${eventId}</strong>
                </div>
                <div> 
                    <button type="button" class="load-btn" data-id="${eventId}">Cargar</button>
                    <button type="button" class="delete-btn" data-id="${eventId}">Eliminar</button>
                </div>
            `;
            eventsListElement.appendChild(li);
        });
    }

    /**
     * Maneja los clics en la lista de eventos (Cargar o Eliminar)
     */
    async function handleListClick(e) {
        const target = e.target; 

        // --- Clic en 'Cargar' ---
        if (target.classList.contains('load-btn')) {
            const eventIdToLoad = target.dataset.id;
            eventIdInput.value = eventIdToLoad;
            await loadEventSettings(eventIdToLoad); // ⭐️ CORREGIDO: Pasar el ID a la función
        }

        // --- Clic en 'Eliminar' ---
        if (target.classList.contains('delete-btn')) {
            const eventIdToDelete = target.dataset.id;
            
            const confirmation = prompt(`🚨 ACCIÓN DESTRUCTIVA 🚨\nEsto eliminará el evento "${eventIdToDelete}" y TODOS sus datos.\n\nPara confirmar, escribe el ID del evento ("${eventIdToDelete}"):`);
            
            if (confirmation !== eventIdToDelete) {
                alert('Confirmación cancelada o incorrecta. No se eliminó nada.');
                return;
            }

            try {
                const eventRefToDelete = ref(database, `events/${eventIdToDelete}`);
                await remove(eventRefToDelete);
                alert(`¡Evento "${eventIdToDelete}" eliminado con éxito!`);
                if (eventIdInput.value === eventIdToDelete) {
                    eventIdInput.value = '';
                    resetFormToDefaults();
                    statusMsg.textContent = `Evento "${eventIdToDelete}" eliminado.`;
                }
            } catch (error) {
                console.error("Error al eliminar el evento:", error);
                alert(`Error al eliminar: ${error.message}`);
            }
        }
    }

} // ⭐️⭐️⭐️ FIN: CÓDIGO ORIGINAL ENVUELTO ⭐️⭐️⭐️