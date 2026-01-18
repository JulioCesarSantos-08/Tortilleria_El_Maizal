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

const btnBack = document.getElementById("btnBack");
const btnLogout = document.getElementById("btnLogout");

const btnCrearDefault = document.getElementById("btnCrearDefault");
const tbodySucursales = document.getElementById("tbodySucursales");
const msg = document.getElementById("msg");

const modalBackdrop = document.getElementById("modalBackdrop");
const btnModalCancelar = document.getElementById("btnModalCancelar");
const btnModalGuardar = document.getElementById("btnModalGuardar");
const editNombre = document.getElementById("editNombre");
const editActiva = document.getElementById("editActiva");

let editId = null;
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

function abrirModal(id, data) {
  editId = id;
  editNombre.value = data.nombre || "";
  editActiva.value = String(!!data.activa);
  modalBackdrop.style.display = "flex";
}

function cerrarModal() {
  editId = null;
  modalBackdrop.style.display = "none";
}

function renderTabla(docs) {
  tbodySucursales.innerHTML = "";

  if (!docs.length) {
    tbodySucursales.innerHTML = `
      <tr>
        <td colspan="4" style="color:#555;font-weight:800;">No hay sucursales creadas.</td>
      </tr>
    `;
    return;
  }

  docs.forEach((doc) => {
    const data = doc.data();
    const id = doc.id;

    const nombre = escapeHtml(data.nombre || `Sucursal ${id}`);
    const activa = !!data.activa;

    tbodySucursales.innerHTML += `
      <tr>
        <td>${escapeHtml(id)}</td>
        <td>${nombre}</td>
        <td>
          <span class="badge ${activa ? "" : "off"}">${activa ? "Activa" : "Inactiva"}</span>
        </td>
        <td>
          <button class="btn-mini" data-edit="${escapeHtml(id)}">Editar</button>
        </td>
      </tr>
    `;
  });

  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      const snap = await db.collection("sucursales").doc(id).get();
      if (!snap.exists) return;
      abrirModal(id, snap.data());
    });
  });
}

async function crearDefault() {
  btnCrearDefault.disabled = true;

  try {
    const batch = db.batch();

    ["1", "2", "3"].forEach((id) => {
      const ref = db.collection("sucursales").doc(id);
      batch.set(ref, {
        nombre: `Sucursal ${id}`,
        activa: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    await batch.commit();
    setMsg("Sucursales creadas/actualizadas.", false);
  } catch (e) {
    setMsg("No se pudieron crear las sucursales.");
  } finally {
    btnCrearDefault.disabled = false;
  }
}

auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  userEmail.textContent = user.email || "Usuario";
  loading.style.display = "none";
  app.style.display = "block";

  db.collection("sucursales")
    .orderBy(firebase.firestore.FieldPath.documentId())
    .onSnapshot((snapshot) => {
      renderTabla(snapshot.docs);
    });
});

btnBack.addEventListener("click", () => {
  window.location.href = "panel.html";
});

btnLogout.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

btnCrearDefault.addEventListener("click", crearDefault);

btnModalCancelar.addEventListener("click", cerrarModal);

modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) cerrarModal();
});

btnModalGuardar.addEventListener("click", async () => {
  if (!editId) return;

  const nombre = editNombre.value.trim();
  const activa = editActiva.value === "true";

  if (!nombre) {
    setMsg("Pon un nombre válido.");
    return;
  }

  btnModalGuardar.disabled = true;

  try {
    await db.collection("sucursales").doc(editId).set({
      nombre,
      activa,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    cerrarModal();
    setMsg("Sucursal actualizada.", false);
  } catch (e) {
    setMsg("No se pudo guardar.");
  } finally {
    btnModalGuardar.disabled = false;
  }
});