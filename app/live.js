/* Macropad Studio: punto d'ingresso della vista live.
   Caricato da live.html (come modulo) dopo protocol.js, che espone il globale MP; la logica è in modules/ (main.js cabla gli eventi). */
if (typeof MP === 'undefined') {
  // senza protocol.js la pagina non può funzionare: messaggio chiaro invece di un errore opaco
  document.body.textContent = 'Il modulo di protocollo (protocol.js) non è stato caricato: apri la pagina da http://localhost:5173/live.html.';
} else {
  import('./modules/main.js').catch((err) => {
    console.error(err);
    document.body.textContent = 'Errore di avvio dell\'applicazione: ' + err.message;
  });
}
