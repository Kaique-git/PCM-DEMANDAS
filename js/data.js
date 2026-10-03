// ============================================================
// data.js — CONFIGURAÇÃO DO FIREBASE (COLE SUAS CREDENCIAIS AQUI)
// Console do Firebase > Configurações do projeto > Seus apps > Configuração do SDK Web
// ⚠️ Configure as regras de segurança do Firestore no console do Firebase.
// ============================================================
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO_ID",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializa o Firebase se houver credenciais; caso contrário, o app roda em modo local.
window.db = null;
window.firebaseAtivo = false;
if (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("SUA_") && typeof firebase !== "undefined") {
  try {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
    window.firebaseAtivo = true;
  } catch (e) {
    console.error("Falha ao iniciar o Firebase:", e);
  }
}