// js/core/theme.js

/**
 * Aplica los colores, fuentes y configuraciones visuales desde la base de datos.
 * Lógica extraída del script original.
 */
export function applyDynamicTheme(themeConfig, textsConfig) {
    if (!themeConfig) {
        console.warn("No se encontró tema, usando defaults.");
        return;
    }

    const styleTag = document.createElement('style');
    let cssVariables = ":root {\n";

    // 1. Variables CSS del Tema
    for (const key in themeConfig) {
        if (typeof themeConfig[key] === 'object' && themeConfig[key] !== null) continue;
        const value = themeConfig[key];
        if (!value) continue; 
        const cssVarName = `--${key.replace(/_/g, '-')}`; 
        cssVariables += `    ${cssVarName}: ${value};\n`;
    }

    // 2. Variables CSS de Textos
    if (textsConfig) {
        for (const key in textsConfig) {
            if (textsConfig[key]) cssVariables += `    --${key.replace(/_/g, '-')}: ${textsConfig[key]};\n`;
        }
    }
    cssVariables += "}\n";

    // 3. Fuente Global
    if (themeConfig.font_family) { 
        cssVariables += `body { font-family: ${themeConfig.font_family}; }`;
    }

    // 4. Fondo de Pantalla
    if (themeConfig.background_image_url) {
         cssVariables += `
            body {
                background-image: url('${themeConfig.background_image_url}') !important;
                background-size: ${themeConfig.background_image_size || 'cover'};
                background-position: ${themeConfig.background_image_position || 'center'};
            }
        `;
    }

    // 5. Contorno de Texto
    if (themeConfig.text_stroke_width && themeConfig.text_stroke_color) {
        cssVariables += `
            h1, h2, h3, p, span, button, a, div {
                -webkit-text-stroke-width: ${themeConfig.text_stroke_width};
                -webkit-text-stroke-color: ${themeConfig.text_stroke_color};
            }
        `;
    }

    styleTag.innerHTML = cssVariables;
    document.head.appendChild(styleTag);

    // 6. Stickers Decorativos
    if (themeConfig.juegos_stickers && Array.isArray(themeConfig.juegos_stickers)) {
        themeConfig.juegos_stickers.forEach(sticker => {
            if (!sticker || !sticker.url) return;
            const stickerImg = document.createElement('img');
            stickerImg.src = sticker.url;
            stickerImg.alt = "Sticker Decorativo";
            stickerImg.style.position = 'fixed';
            stickerImg.style.zIndex = '1000';
            stickerImg.style.pointerEvents = 'none';
            if (sticker.width) stickerImg.style.width = sticker.width;
            if (sticker.transform) stickerImg.style.transform = sticker.transform;
            if (sticker.top) stickerImg.style.top = sticker.top;
            if (sticker.bottom) stickerImg.style.bottom = sticker.bottom;
            if (sticker.left) stickerImg.style.left = sticker.left;
            if (sticker.right) stickerImg.style.right = sticker.right;
            document.body.appendChild(stickerImg);
        });
    }

    // 7. Iconos
    if (themeConfig.icons) {
        const icons = themeConfig.icons;
        const updateIcons = (className, icon) => {
            document.querySelectorAll(className).forEach(el => {
                if (icon && icon.trim() !== '') {
                    el.textContent = icon;
                    el.style.display = '';
                } else {
                    el.style.display = 'none';
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
    }
}