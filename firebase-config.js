/**
 * CONFIGURACIÓN DE FIREBASE — Sincronización en vivo del Estado de Recupero
 * ==========================================================================
 * Este archivo NO tiene credenciales reales todavía. Sin completarlo, la
 * app funciona exactamente igual que antes, solo que sin sincronizar entre
 * dispositivos (vas a ver "⚪ Sync no configurada" en la topbar).
 *
 * PASO A PASO PARA ACTIVARLA (2GB gratis, sin tarjeta):
 *
 * 1. Entrá a https://console.firebase.google.com con tu cuenta de Google.
 * 2. "Agregar proyecto" → ponele un nombre (ej. "recupero-th") → crealo.
 *    (Podés desactivar Google Analytics, no hace falta para esto).
 * 3. Adentro del proyecto: ícono "</>" (Web) para agregar una app web.
 *    Ponele un apodo (ej. "recupero-th-web") → "Registrar app".
 *    Te va a mostrar un bloque de código con un objeto `firebaseConfig`:
 *    copiá esos valores y pegalos abajo, reemplazando los "TU_..._AQUI".
 * 4. En el menú lateral: "Compilación" → "Realtime Database" → "Crear
 *    base de datos". Elegí la ubicación más cercana (ej. us-central1).
 *    Cuando te pregunte el modo de seguridad, elegí "Modo de prueba"
 *    para arrancar rápido (podemos ajustar las reglas después).
 * 5. Ya en la base de datos creada, copiá la URL que aparece arriba de
 *    todo (algo como "https://recupero-th-default-rtdb.firebaseio.com")
 *    y pegala en `databaseURL` abajo si no vino ya incluida en el paso 3.
 * 6. Guardá este archivo, subilo al repo de GitHub junto con el resto,
 *    y listo — al abrir el GitHub Page vas a ver "🟢 Sincronizado".
 *
 * IMPORTANTE - SEGURIDAD:
 * Como el sitio es público (GitHub Pages), estos valores van a quedar
 * visibles para cualquiera que abra el código fuente de la página. Eso
 * es normal y esperado en Firebase (no son contraseñas secretas), pero
 * significa que CUALQUIERA que encuentre esta URL de base de datos podría
 * escribir en ella si dejás las reglas en "Modo de prueba" para siempre
 * (ese modo caduca solo a los 30 días y despues bloquea todo). Como acá
 * solo guardamos "Nº de Orden + estado de recupero" (nunca nombres, DNI
 * ni datos de pacientes), el riesgo es bajo, pero para uso prolongado te
 * recomiendo reemplazar las reglas de la Realtime Database por algo como:
 *
 *   {
 *     "rules": {
 *       "estadosRecupero": {
 *         ".read": true,
 *         ".write": true,
 *         "$ordenId": {
 *           ".validate": "newData.hasChildren(['estado','ts'])"
 *         }
 *       }
 *     }
 *   }
 *
 * Esto no pide login (para no complicarte con usuarios/contraseñas entre
 * los 3), pero al menos exige que cada escritura tenga la forma esperada.
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDmoZB8MnF-vlC9Hhl_Jgup3CeV_jgTJUI",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  authDomain: "logistica-recupero-th.firebaseapp.com",
  databaseURL: "https://logistica-recupero-th-default-rtdb.firebaseio.com",
  projectId: "logistica-recupero-th",
};
