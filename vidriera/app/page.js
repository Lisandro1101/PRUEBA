// Este es tu nuevo "index": vidriera/app/page.js
// Usamos "use client" para poder usar animaciones y el estado del formulario
"use client";

import { initializeApp } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";
import { motion } from "framer-motion";
import { useState } from 'react';

// --- ⭐️ NUEVO: CONFIGURACIÓN DE FIREBASE ⭐️ ---
const firebaseConfig = {
  apiKey: "AIzaSyDRsS6YQ481KQadSk8gf9QtxVt_asnrDlc",
  authDomain: "juegos-cumple.firebaseapp.com",
  databaseURL: "https://juegos-cumple-default-rtdb.firebaseio.com",
  projectId: "juegos-cumple",
};
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Pequeños componentes para los íconos (mejora la legibilidad)
const IconTrivia = () => <span className="text-3xl">✍️</span>;
const IconMemoria = () => <span className="text-3xl">🧠</span>;
const IconRecuerdos = () => <span className="text-3xl">🖼️</span>;

// ⭐️ NUEVO: Componente que usa la imagen SVG desde la carpeta /public
const WhatsAppIcon = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/whatsapp.svg" alt="WhatsApp" className="w-8 h-8" />
);

export default function LandingPage() {
  
  // Estado para el formulario de contacto (opcional, para futuro)
  const [email, setEmail] = useState('');
  // ⭐️ NUEVO: Estado para manejar la carga y los errores
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ⭐️ CORREGIDO: Ahora la función devuelve el estado del evento
  const getEventStatus = async (eventId) => {
    setLoading(true);
    setError('');
    try {
      const eventRef = ref(database, `events/${eventId}`);
      const snapshot = await get(eventRef);
      if (snapshot.exists()) {
        const eventData = snapshot.val();
        // El interruptor controla config.features.games_enabled. Por defecto es true.
        const gamesEnabled = eventData.config?.features?.games_enabled !== false;
        return { exists: true, gamesEnabled: gamesEnabled };
      }
      return { exists: false, gamesEnabled: false };
    } catch (err) {
      console.error("Error verificando el evento:", err);
      setError("Error de conexión. Inténtalo de nuevo.");
      return { exists: false, gamesEnabled: false };
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-gray-200">
      
      {/* --- ⭐️ BOTÓN DE WHATSAPP FLOTANTE ⭐️ --- */}
      <a
        href="https://wa.me/5491135844624"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-green-500 w-16 h-16 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-transform hover:scale-110"
        aria-label="Contactar por WhatsApp"
      >
        <WhatsAppIcon />
      </a>
      {/* --- FIN BOTÓN DE WHATSAPP --- */}

      
      {/* --- NAVEGACIÓN (BOTÓN ELIMINADO) --- */}
      <nav className="sticky top-0 z-50 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400"
          >
            🐝 TuFiestaDigital
          </motion.div>
          
          {/* ⭐️ BOTÓN ELIMINADO ⭐️ 
              Ahora el layout 'justify-between' solo dejará el logo a la izquierda.
              Si prefieres el logo centrado, cambia 'justify-between' por 'justify-center'.
          */}
          
        </div>
      </nav>

      {/* --- SECCIÓN HERO --- */}
      <main className="flex-grow">
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center py-24 md:py-32 px-6"
        >
          <h1 className="text-5xl md:text-7xl font-black mb-6">
            La <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">App</span> Definitiva
            <br />
            para tu Evento
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Involucra a tus invitados con trivias personalizadas, juegos de memoria
            y un álbum de recuerdos digital en tiempo real.
          </p>
          <motion.a
            href="#caracteristicas" 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 font-bold text-lg text-black bg-yellow-400 rounded-lg shadow-xl"
          >
            Conoce Más
          </motion.a>
        </motion.section>


        {/* --- SECCIÓN DE ACCESO (PARA INVITADOS Y ANFITRIONES) --- */}
        <section id="acceso" className="pb-24 pt-12 text-center bg-black bg-opacity-20">
          <div className="container mx-auto px-6">
            <h2 className="text-4xl font-black mb-16">
              ¿Listo para ingresar?
            </h2>
            
            <div className="grid md:grid-cols-2 gap-10 max-w-4xl mx-auto">

              {/* --- Formulario de INVITADO --- */}
              <div className="bg-zinc-900 p-8 rounded-2xl border border-white/10">
                <h3 className="text-2xl font-bold mb-4 text-yellow-400">Soy Invitado</h3>
                <p className="text-gray-400 mb-6">Ingresa el ID del evento para unirte a la fiesta.</p>
                <form 
                  className="flex"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    // @ts-ignore
                    const eventId = e.target.elements.guestEventId.value.trim().toLowerCase();
                    if (eventId) {
                      const status = await getEventStatus(eventId);
                      if (status.exists) {
                        if (status.gamesEnabled) {
                        window.location.href = `https://app.tufiestadigital.com.ar/index.html?event=${eventId}`;
                      } else {
                          setError(`El módulo de juegos para "${eventId}" está deshabilitado por el anfitrión.`);
                        }
                      } else {
                        setError(`El evento "${eventId}" no fue encontrado. Verifica el ID.`);
                      }
                    } else {
                      alert("Por favor, escribe un ID de evento.");
                    }
                    setLoading(false);
                  }}
                >
                  <input 
                    type="text"
                    name="guestEventId"
                    placeholder="Ej: boda-ana-y-pablo"
                    required
                    className="px-6 py-4 w-full rounded-l-lg border-0 bg-zinc-800 text-white placeholder-gray-500 focus:ring-2 focus:ring-yellow-400"
                  />
                  <button 
                    type="submit"
                    disabled={loading}
                    className="px-6 py-4 font-bold text-black bg-yellow-400 rounded-r-lg disabled:bg-yellow-600"
                  >
                    {loading ? '...' : 'Entrar'}
                  </button>
                </form>
              </div>

              {/* --- Formulario de ANFITRIÓN --- */}
              <div className="bg-zinc-900 p-8 rounded-2xl border border-white/10">
                <h3 className="text-2xl font-bold mb-4 text-yellow-400">Soy Anfitrión</h3>
                <p className="text-gray-400 mb-6">Ingresa el ID de tu evento para administrarlo.</p>
                <form 
                  className="flex"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    // @ts-ignore
                    const eventId = e.target.elements.hostEventId.value.trim().toLowerCase();
                    if (eventId) {
                      const status = await getEventStatus(eventId);
                      if (status.exists) {
                        if (status.gamesEnabled) {
                        window.location.href = `https://app.tufiestadigital.com.ar/host.html?event=${eventId}`;
                      } else {
                          setError(`El módulo de juegos para "${eventId}" está deshabilitado. Actívalo desde el panel de super-admin.`);
                        }
                      } else {
                        setError(`El evento "${eventId}" no fue encontrado. Verifica el ID.`);
                      }
                    } else {
                      alert("Por favor, escribe el ID de tu evento.");
                    }
                    setLoading(false);
                  }}
                >
                  <input 
                    type="text"
                    name="hostEventId"
                    placeholder="Escribe el ID de tu evento"
                    required
                    className="px-6 py-4 w-full rounded-l-lg border-0 bg-zinc-800 text-white placeholder-gray-500 focus:ring-2 focus:ring-yellow-400"
                  />
                  <button 
                    type="submit"
                    disabled={loading}
                    className="px-6 py-4 font-bold text-black bg-yellow-400 rounded-r-lg disabled:bg-yellow-600"
                  >
                    {loading ? '...' : 'Administrar'}
                  </button>
                </form>
              </div>

            </div>
            {/* ⭐️ NUEVO: Contenedor para mostrar el mensaje de error */}
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 text-red-400 font-semibold">
                {error}
              </motion.div>
            )}
          </div>
        </section>


        {/* --- SECCIÓN DE CARACTERÍSTICAS --- */}
        <section id="caracteristicas" className="py-24">
          <div className="container mx-auto px-6">
            <h2 className="text-4xl font-black text-center mb-16">
              Una Experiencia Interactiva
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              
              {/* Tarjeta 1 */}
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                viewport={{ once: true }}
                className="p-8 bg-zinc-900 rounded-2xl border border-white/10 shadow-xl"
              >
                <IconTrivia />
                <h3 className="text-2xl font-bold my-4">Trivia Personalizada</h3>
                <p className="text-gray-400">
                  Carga tus propias preguntas y respuestas desde un panel de anfitrión 
                  fácil de usar.
                </p>
              </motion.div>

              {/* Tarjeta 2 */}
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                viewport={{ once: true }}
                className="p-8 bg-zinc-900 rounded-2xl border border-white/10 shadow-xl"
              >
                <IconMemoria />
                <h3 className="text-2xl font-bold my-4">Juego de Memoria</h3>
                <p className="text-gray-400">
                  Sube tus propias fotos para crear un "memotest" único y 
                  revivir momentos especiales.
                </p>
              </motion.div>

              {/* Tarjeta 3 */}
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                viewport={{ once: true }}
                className="p-8 bg-zinc-900 rounded-2xl border border-white/10 shadow-xl"
              >
                <IconRecuerdos />
                <h3 className="text-2xl font-bold my-4">Galería de Recuerdos</h3>
                <p className="text-gray-400">
                  Tus invitados suben fotos y videos del evento en tiempo real. 
                  Todos los recuerdos en un solo lugar.
                </p>
              </motion.div>

            </div>
          </div>
        </section>

        {/* --- SECCIÓN DE PRECIOS/CONTACTO --- */}
        <section id="precios" className="py-20 bg-black bg-opacity-20">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-4xl font-black mb-16">Planes Simples</h2>
            <div className="max-w-md mx-auto bg-zinc-900 rounded-2xl border border-white/10 shadow-xl p-8">
                <h3 className="text-2xl font-bold mb-4">Plan Evento Único</h3>
                <p className="text-5xl font-black text-yellow-400 mb-4">$XX.XXX</p>
                <p className="text-gray-400 mb-6">Un solo pago para un evento inolvidable. Incluye todas las características sin límites.</p>
                <form 
                  className="flex justify-center max-w-lg mx-auto"
                  onSubmit={(e) => {
                      e.preventDefault();
                      alert("¡Gracias por tu interés! Pronto nos contactaremos.");
                      setEmail('');
                  }}
                >
                  <input 
                    type="email"
                    placeholder="Tu email de contacto"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="px-6 py-4 w-full rounded-l-lg border-0 bg-zinc-800 text-white placeholder-gray-500 focus:ring-2 focus:ring-yellow-400"
                  />
                  <button 
                    type="submit"
                    className="px-6 py-4 font-bold text-black bg-yellow-400 rounded-r-lg"
                  >
                    Cotizar
                  </button>
                </form>
            </div>
          </div>
        </section>

      </main>

      {/* --- FOOTER --- */}
      <footer className="py-12 border-t border-white/10">
        <div className="container mx-auto px-6 text-center">
          <p className="text-gray-500 mt-4">
            &copy; 2025 Tu Fiesta Digital. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}