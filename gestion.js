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

// ✅ NUEVO: botón para ir al historial
const btnGoHistorial = document.getElementById("btnGoHistorial");

const btnNuevaSucursal = document.getElementById("btnNuevaSucursal");
const tbodySucursales = document.getElementById("tbodySucursales");
const msg = document.getElementById("msg");

const modalBackdrop = document.getElementById("modalBackdrop");
const btnModalCancelar = document.getElementById("btnModalCancelar");
const btnModalGuardar = document.getElementById("btnModalGuardar");
const modalTitle = document.getElementById("modalTitle");
const editNombre = document.getElementById("editNombre");
const editActiva = document.getElementById("editActiva");

const modalDeleteBackdrop = document.getElementById("modalDeleteBackdrop");
const confirmDeleteText = document.getElementById("confirmDeleteText");
const chkEliminarEmpleados = document.getElementById("chkEliminarEmpleados");
const btnDeleteCancelar = document.getElementById("btnDeleteCancelar");
const btnDeleteConfirmar = document.getElementById("btnDeleteConfirmar");

let editId = null;
let deleteId = null;
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

// ============================
// LOGS
// ============================

function getFechaKeyHoy() {
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
}

async function addLog({ accion, detalle }) {
  try {
    const user = auth.currentUser;
    await db.collection("logs").add({
      modulo: "sucursales",
      accion: String(accion || ""),
      detalle: String(detalle || ""),
      userEmail: String(user?.email || ""),
      fechaKey: getFechaKeyHoy(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    // No bloqueamos la app si falla el log
    console.warn("No se pudo guardar log:", e);
  }
}

// ============================
// MODALES
// ============================

function abrirModalEditar(id, data) {
  editId = id;
  modalTitle.textContent = id ? "Editar sucursal" : "Nueva sucursal";
  editNombre.value = data?.nombre || "";
  editActiva.value = String(!!data?.activa);
  modalBackdrop.style.display = "flex";
}

function cerrarModalEditar() {
  editId = null;
  modalBackdrop.style.display = "none";
}

function abrirModalEliminar(id) {
  deleteId = id;
  confirmDeleteText.value = "";
  chkEliminarEmpleados.checked = false;
  modalDeleteBackdrop.style.display = "flex";
}

function cerrarModalEliminar() {
  deleteId = null;
  modalDeleteBackdrop.style.display = "none";
}

// ============================
// HELPERS
// ============================

function isNumericId(str) {
  return /^\d+$/.test(String(str));
}

async function getNextSucursalId() {
  const snap = await db.collection("sucursales")
    .orderBy(firebase.firestore.FieldPath.documentId())
    .get();

  const ids = snap.docs.map(d => d.id).filter(isNumericId).map(n => Number(n));
  const maxId = ids.length ? Math.max(...ids) : 0;
  return String(maxId + 1);
}

async function deleteBySucursalId(collectionName, sucursalId) {
  let totalDeleted = 0;

  while (true) {
    const snap = await db
      .collection(collectionName)
      .where("sucursalId", "==", String(sucursalId))
      .limit(450)
      .get();

    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    totalDeleted += snap.size;
  }

  return totalDeleted;
}

async function deleteBySucursalLegacy(collectionName, sucursalLegacy) {
  let totalDeleted = 0;

  while (true) {
    const snap = await db
      .collection(collectionName)
      .where("sucursal", "==", String(sucursalLegacy))
      .limit(450)
      .get();

    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    totalDeleted += snap.size;
  }

  return totalDeleted;
}

// ============================
// RENDER
// ============================

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
          <div class="row-actions">
            <button class="btn-mini btn-edit" data-edit="${escapeHtml(id)}">Editar</button>
            <button class="btn-mini btn-disable" data-toggle="${escapeHtml(id)}">
              ${activa ? "Desactivar" : "Activar"}
            </button>
            <button class="btn-mini btn-del" data-del="${escapeHtml(id)}">Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  });

  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      const snap = await db.collection("sucursales").doc(id).get();
      if (!snap.exists) return;
      abrirModalEditar(id, snap.data());
    });
  });

  document.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-toggle");
      const snap = await db.collection("sucursales").doc(id).get();
      if (!snap.exists) return;

      const data = snap.data() || {};
      const activa = !!data.activa;
      const nombre = data.nombre || `Sucursal ${id}`;

      try {
        await db.collection("sucursales").doc(id).set({
          activa: !activa,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        setMsg(`Sucursal ${!activa ? "activada" : "desactivada"}.`, false);

        await addLog({
          accion: !activa ? "activar" : "desactivar",
          detalle: `${!activa ? "Activó" : "Desactivó"} la sucursal ${id} (${nombre}).`
        });
      } catch (e) {
        setMsg("No se pudo actualizar.");
      }
    });
  });

  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      abrirModalEliminar(id);
    });
  });
}

// ============================
// AUTH
// ============================

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

// ============================
// NAV
// ============================

btnBack.addEventListener("click", () => {
  window.location.href = "panel.html";
});

// ✅ NUEVO: ir a historial
if (btnGoHistorial) {
  btnGoHistorial.addEventListener("click", () => {
    window.location.href = "historial.html";
  });
}

btnLogout.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

// ============================
// NUEVA SUCURSAL
// ============================

btnNuevaSucursal.addEventListener("click", async () => {
  try {
    const nextId = await getNextSucursalId();
    abrirModalEditar(null, { nombre: `Sucursal ${nextId}`, activa: true });
  } catch (e) {
    setMsg("No se pudo preparar nueva sucursal.");
  }
});

btnModalCancelar.addEventListener("click", cerrarModalEditar);

modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) cerrarModalEditar();
});

btnModalGuardar.addEventListener("click", async () => {
  const nombre = editNombre.value.trim();
  const activa = editActiva.value === "true";

  if (!nombre) {
    setMsg("Pon un nombre válido.");
    return;
  }

  btnModalGuardar.disabled = true;

  try {
    if (!editId) {
      const newId = await getNextSucursalId();

      await db.collection("sucursales").doc(newId).set({
        nombre,
        activa,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      cerrarModalEditar();
      setMsg("Sucursal agregada.", false);

      await addLog({
        accion: "crear",
        detalle: `Creó sucursal ${newId} (${nombre}) - Estado: ${activa ? "Activa" : "Inactiva"}.`
      });

      return;
    }

    // EDITAR
    const beforeSnap = await db.collection("sucursales").doc(editId).get();
    const before = beforeSnap.exists ? (beforeSnap.data() || {}) : {};
    const beforeNombre = before.nombre || `Sucursal ${editId}`;
    const beforeActiva = !!before.activa;

    await db.collection("sucursales").doc(editId).set({
      nombre,
      activa,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    cerrarModalEditar();
    setMsg("Sucursal actualizada.", false);

    const cambios = [];
    if (String(beforeNombre) !== String(nombre)) cambios.push(`Nombre: "${beforeNombre}" → "${nombre}"`);
    if (beforeActiva !== activa) cambios.push(`Estado: ${beforeActiva ? "Activa" : "Inactiva"} → ${activa ? "Activa" : "Inactiva"}`);

    await addLog({
      accion: "editar",
      detalle: `Editó sucursal ${editId}. ${cambios.length ? "Cambios: " + cambios.join(" | ") : "Sin cambios detectados."}`
    });

  } catch (e) {
    setMsg("No se pudo guardar.");
  } finally {
    btnModalGuardar.disabled = false;
  }
});

// ============================
// ELIMINAR SUCURSAL
// ============================

btnDeleteCancelar.addEventListener("click", cerrarModalEliminar);

modalDeleteBackdrop.addEventListener("click", (e) => {
  if (e.target === modalDeleteBackdrop) cerrarModalEliminar();
});

btnDeleteConfirmar.addEventListener("click", async () => {
  if (!deleteId) return;

  const text = confirmDeleteText.value.trim().toUpperCase();
  if (text !== "ELIMINAR") {
    setMsg("Escribe ELIMINAR para confirmar.");
    return;
  }

  // obtenemos nombre antes de borrar
  let sucNombre = `Sucursal ${deleteId}`;
  try {
    const snap = await db.collection("sucursales").doc(deleteId).get();
    if (snap.exists) sucNombre = snap.data()?.nombre || sucNombre;
  } catch (e) {}

  const ok = confirm(
    `Se borrará la sucursal ${deleteId} y TODOS sus registros.\n\n¿Seguro que deseas continuar?`
  );
  if (!ok) return;

  btnDeleteConfirmar.disabled = true;

  try {
    setMsg("Eliminando registros... espera...", false);

    const deletedVentasNew = await deleteBySucursalId("ventas", deleteId);
    const deletedGastosNew = await deleteBySucursalId("gastos", deleteId);

    const deletedVentasOld = await deleteBySucursalLegacy("ventas", deleteId);
    const deletedGastosOld = await deleteBySucursalLegacy("gastos", deleteId);

    let deletedEmpleadosNew = 0;
    let deletedEmpleadosOld = 0;

    if (chkEliminarEmpleados.checked) {
      deletedEmpleadosNew = await deleteBySucursalId("empleados", deleteId);
      deletedEmpleadosOld = await deleteBySucursalLegacy("empleados", deleteId);
    }

    await db.collection("sucursales").doc(deleteId).delete();

    cerrarModalEliminar();

    const totalVentas = deletedVentasNew + deletedVentasOld;
    const totalGastos = deletedGastosNew + deletedGastosOld;
    const totalEmpleados = deletedEmpleadosNew + deletedEmpleadosOld;

    setMsg(
      `Sucursal eliminada. Ventas: ${totalVentas}, Gastos: ${totalGastos}, Empleados: ${totalEmpleados}.`,
      false
    );

    await addLog({
      accion: "eliminar",
      detalle:
        `Eliminó sucursal ${deleteId} (${sucNombre}). ` +
        `Ventas borradas: ${totalVentas}. Gastos borrados: ${totalGastos}. ` +
        `Empleados borrados: ${totalEmpleados}. (Eliminar empleados: ${chkEliminarEmpleados.checked ? "Sí" : "No"})`
    });

  } catch (e) {
    setMsg("No se pudo eliminar todo. Intenta de nuevo.");
  } finally {
    btnDeleteConfirmar.disabled = false;
  }
});
