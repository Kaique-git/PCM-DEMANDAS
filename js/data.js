// data.js
// ============================================================
// Configuração do Firebase — PCM Manutenção
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyA_L1rDTx9mUtPrjfqr7O-1mLEjVbCQglw",
  authDomain: "pc-demandas.firebaseapp.com",
  projectId: "pc-demandas",
  storageBucket: "pc-demandas.firebasestorage.app",
  messagingSenderId: "950455669346",
  appId: "1:950455669346:web:1f1c354073fce3b94eb73b",
  measurementId: "G-ZFVJB6T0EW"
};

window.db = null;
window.firebaseAtivo = false;

(function initFirebase() {
  const semCredencial = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("SUA_");
  if (semCredencial) { console.warn("Firebase não configurado — modo local."); return; }
  if (typeof firebase === "undefined") {
    console.error("SDK do Firebase não carregado. Verifique as tags <script> compat no index.html ANTES de data.js.");
    return;
  }
  try {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
    window.firebaseAtivo = true;
  } catch (e) { console.error("Falha ao iniciar o Firebase:", e); }
})();