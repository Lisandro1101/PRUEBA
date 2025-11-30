// js/core/state.js
import { db, ref, get } from "../config/firebase.js";
import { applyDynamicTheme } from "./theme.js";

// Variables exportadas (Estado Global)
export let EVENT_ID = null;
export let eventConfig = {};

/**
 * Obtiene el ID del evento de la URL.
 */
function getEventIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('event');
    if (!id) {
        document.body.innerHTML = `
            <div style="padding: 40px; text-align: center; font-family: sans-serif; color: #333;">
                <h1>Error: Evento no encontrado</h1>
                <p>Asegúrate de que el enlace (URL) que estás usando sea correcto.</p>
            </div>
        `;
        throw new Error('Event ID no especificado en la URL.');
    }
    return id.trim().toLowerCase();
}

/**
 * Inicializa la aplicación: Carga ID, Configuración y aplica Tema.
 * Esta función será llamada por main.js al inicio.
 */
export async function initializeGlobalState() {
    EVENT_ID = getEventIdFromUrl();
    const configRef = ref(db, `events/${EVENT_ID}/config`);
    
    try {
        const snapshot = await get(configRef);
        if (snapshot.exists()) {
            eventConfig = snapshot.val();
        } else {
            console.warn("No se encontró configuración. Usando valores por defecto.");
            const isHost = window.location.pathname.includes('host.html');
            const isRanking = window.location.pathname.includes('ranking.html');
            if (!isHost && !isRanking) {
                throw new Error("Configuración de evento no encontrada.");
            }
        }
    } catch (error) {
        console.error("Error cargando configuración:", error);
        throw new Error("Error al cargar la configuración del evento.");
    }

    // Exponer config globalmente por si algún script viejo lo necesita (retrocompatibilidad)
    window.eventConfig = eventConfig;

    // Validar si el evento está activo
    const isHost = window.location.pathname.includes('host.html');
    const isRanking = window.location.pathname.includes('ranking.html');

    if (!isHost && !isRanking && (!eventConfig.status || eventConfig.status.is_active === false)) {
        document.body.innerHTML = `
            <div style="padding: 40px; text-align: center; font-family: sans-serif; color: #333;">
                <h1>Evento Finalizado</h1>
                <p>Este portal de recuerdos ya no se encuentra disponible.</p>
            </div>
        `;
        throw new Error("El evento está deshabilitado.");
    }

    // Aplicar Tema Visual
    applyDynamicTheme(eventConfig.theme || {}, eventConfig.texts || {});
    
    // Aplicar Textos Específicos (Títulos dinámicos)
    applyDynamicTexts(eventConfig.texts || {});

    console.log(`[Core] Estado inicializado para evento: ${EVENT_ID}`);
    return { EVENT_ID, eventConfig };
}

/**
 * Aplica textos dinámicos específicos a elementos del DOM si existen.
 * Lógica extraída y separada para mayor limpieza.
 */
function applyDynamicTexts(texts) {
    const applyStyle = (id, textKey, stylePrefix) => {
        const el = document.getElementById(id);
        if (!el) return;
        
        if (texts[textKey]) el.innerHTML = texts[textKey];
        
        // Estilos opcionales
        if (texts[`${textKey}_font_family`]) el.style.fontFamily = texts[`${textKey}_font_family`];
        if (texts[`${textKey}_letter_spacing`]) el.style.letterSpacing = texts[`${textKey}_letter_spacing`];
        if (texts[`${textKey}_font_size`]) el.style.fontSize = texts[`${textKey}_font_size`];
        if (texts[`${textKey}_color`]) el.style.color = texts[`${textKey}_color`];
        
        if (texts[`${textKey}_stroke_width`] && texts[`${textKey}_stroke_color`]) {
            el.style.webkitTextStroke = `${texts[`${textKey}_stroke_width`]} ${texts[`${textKey}_stroke_color`]}`;
        }
    };

    applyStyle('trivia-title-text', 'trivia_title');
    applyStyle('trivia-welcome-text', 'trivia_welcome');
    applyStyle('trivia-subtitle-text', 'trivia_subtitle');
    applyStyle('memory-title-text', 'memory_title');
    applyStyle('hangman-title-text', 'hangman_title');
    applyStyle('hangman-subtitle-text', 'hangman_subtitle');
    applyStyle('ranking-title-text', 'ranking_title');
    
    // Títulos de Host
    const hostLoginTitle = document.getElementById('host-login-title-text');
    if (hostLoginTitle && texts.host_login_title) hostLoginTitle.innerHTML = texts.host_login_title;
    
    const hostPanelTitle = document.getElementById('host-panel-title-text');
    if (hostPanelTitle && texts.host_panel_title) hostPanelTitle.innerHTML = texts.host_panel_title;

    // Título del documento
    const isHostPage = window.location.pathname.includes('host.html');
    if (isHostPage && texts.host_document_title) document.title = texts.host_document_title;
}