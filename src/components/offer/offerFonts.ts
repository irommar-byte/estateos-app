import './offerFonts.css';

/**
 * Kroje ofertówki i wizytówki: `--ofb-sans` (Inter Tight — nagłówki, liczby) i `--ofb-mono` (IBM Plex Mono — etykiety).
 * Pliki leżą w /public/fonts, więc build nie pobiera nic z Google Fonts (to wywracało deploy, gdy Google nie odpowiadał).
 */
export const offerFontVars = 'eos-ofb-fonts';
