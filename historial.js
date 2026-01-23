const firebaseConfig = {
  apiKey: "AIzaSyCzlWi30F2qXaCg9ddjW5RVVsuI23Xl8vY",
  authDomain: "tortilleria-el-maizal.firebaseapp.com",
  databaseURL: "https://tortilleria-el-maizal-default-rtdb.firebaseio.com",
  projectId: "tortilleria-el-maizal",
  storageBucket: "tortilleria-el-maizal.firebasestorage.app",
  messagingSenderId: "704775522415",
  appId: "1:704775522415:web:96ae90bb0c0d45cbafa59a"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

const loading = document.getElementById("loading");
const app = document.getElementById("app");
const userEmail = document.getElementById("userEmail");

const btnGoPanel = document.getElementById("btnGoPanel");
const btnGoSucursales = document.getElementById("btnGoSucursales");
const btnLogout = document.getElementById("btnLogout");

const filtroModulo = document.getElementById("filtroModulo");
const filtroAccion = document.getElementById("filtroAccion");
const filtroFecha = document.getElementById("filtroFecha");
const btnClearFecha = document.getElementById("btnClearFecha");

const tbodyLogs = document.getElementById("tbodyLogs");
const msg = document.getElementById("msg");

const btnBorrarLogs = document.getElementById("btnBorrarLogs");
const modalBackdrop = document.getElementById("modalBackdrop");
const confirmDeleteText = document.getElementById("confirmDeleteText");
const btnModalCancelar = document.getElementById("btnModalCancelar");
const btnModalEliminar = document.getElementById("btnModalEliminar");

let logsCache = [];
let msgTimer = null;

function setMsg(text = "", isError = true) {
  if (msgTimer) clearTimeout(msgTimer);

  msg.style.color = isError ? "#b00020" : "#1f8a4c";
  msg.textContent = text;

  if (text) {
    msgTimer = setTimeout(() => {
      msg.textContent = "";
    }, 2500);
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatFecha(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? d.toLocaleString("es-MX") : "-";
}

// YYYY-MM-DD (para filtros)
function getFechaKeyFromTimestamp(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return "";
  return d.toLocaleDateString("sv-SE"); // 2026-01-22
}

function abrirModal() {
  confirmDeleteText.value = "";
  modalBackdrop.style.display = "flex";
}

function cerrarModal() {
  modalBackdrop.style.display = "none";
}

function getFiltrados() {
  const mod = filtroModulo.value;
  const acc = filtroAccion.value;
  const fecha = filtroFecha.value;

  let lista = [...logsCache];

  if (mod !== "todos") {
    lista = lista.filter(l => String(l.modulo || "") === String(mod));
  }

  if (acc !== "todas") {
    lista = lista.filter(l => String(l.accion || "") === String(acc));
  }

  if (fecha) {
    lista = lista.filter(l => {
      const fk = String(l.fechaKey || getFechaKeyFromTimestamp(l.createdAt) || "");
      return fk === String(fecha);
    });
  }

  return lista;
}

function renderTabla() {
  const lista = getFiltrados();
  tbodyLogs.innerHTML = "";

  if (!lista.length) {
    tbodyLogs.innerHTML = `
      <tr>
        <td colspan="5" style="padding:12px;color:#555;font-weight:800;">Sin logs</td>
      </tr>
    `;
    return;
  }

  lista.forEach((l) => {
    const fecha = escapeHtml(formatFecha(l.createdAt));
    const modulo = escapeHtml(l.modulo || "-");
    const accion = escapeHtml(l.accion || "-");
    const usuario = escapeHtml(l.userEmail || "-");
    const detalle = escapeHtml(l.detalle || "-");

    tbodyLogs.innerHTML += `
      <tr>
        <td>${fecha}</td>
        <td>${modulo}</td>
        <td>${accion}</td>
        <td>${usuario}</td>
        <td>${detalle}</td>
      </tr>
    `;
  });
}

function renderTodo() {
  renderTabla();
}

async function eliminarTodosLosLogs() {
  let totalDeleted = 0;

  while (true) {
    const snap = await db.collection("logs").limit(450).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    totalDeleted += snap.size;
  }

  return totalDeleted;
}

auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  userEmail.textContent = user.email || "Usuario";
  loading.style.display = "none";
  app.style.display = "block";

  db.collection("logs")
    .orderBy("createdAt", "desc")
    .limit(1500)
    .onSnapshot((snapshot) => {
      logsCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTodo();
    });
});

btnGoPanel.addEventListener("click", () => {
  window.location.href = "panel.html";
});

btnGoSucursales.addEventListener("click", () => {
  window.location.href = "gestion.html";
});

btnLogout.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

filtroModulo.addEventListener("change", renderTodo);
filtroAccion.addEventListener("change", renderTodo);
filtroFecha.addEventListener("change", renderTodo);

btnClearFecha.addEventListener("click", () => {
  filtroFecha.value = "";
  renderTodo();
});

btnBorrarLogs.addEventListener("click", () => {
  abrirModal();
});

btnModalCancelar.addEventListener("click", () => {
  cerrarModal();
});

modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) cerrarModal();
});

btnModalEliminar.addEventListener("click", async () => {
  const text = confirmDeleteText.value.trim().toUpperCase();
  if (text !== "ELIMINAR") {
    setMsg("Escribe ELIMINAR para confirmar.");
    return;
  }

  const ok = confirm("Se eliminará TODO el historial. ¿Continuar?");
  if (!ok) return;

  btnModalEliminar.disabled = true;

  try {
    setMsg("Eliminando historial... espera...", false);
    const eliminados = await eliminarTodosLosLogs();
    cerrarModal();
    setMsg(`Historial eliminado. Registros: ${eliminados}`, false);
  } catch (e) {
    setMsg("No se pudo eliminar el historial.");
  } finally {
    btnModalEliminar.disabled = false;
  }
});