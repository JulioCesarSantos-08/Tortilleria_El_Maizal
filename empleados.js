const firebaseConfig = {
  apiKey: "AIzaSyCzlWi30F2qXaCg9ddjW5RVVsuI23Xl8vY",
  authDomain: "tortilleria-el-maizal.firebaseapp.com",
  databaseURL: "https://tortilleria-el-maizal-default-rtdb.firebaseio.com",
  projectId: "tortilleria-el-maizal",
  storageBucket: "tortilleria-el-maizal.firebasestorage.app",
  messagingSenderId: "704775522415",
  appId: "1:704775522415:web:96ae90bb0c0d45cbafa59a"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

const loading = document.getElementById("loading");
const app = document.getElementById("app");
const userEmail = document.getElementById("userEmail");

const btnBack = document.getElementById("btnBack");

const formEmpleado = document.getElementById("formEmpleado");
const nombreInput = document.getElementById("nombre");
const sucursalSelect = document.getElementById("sucursal");
const rolSelect = document.getElementById("rol");
const msg = document.getElementById("msg");
const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");
const btnBorrarTodos = document.getElementById("btnBorrarTodos");

// 🔥 ahora ya NO usaremos tbody1/tbody2/tbody3 fijos
// vamos a generar tablas dinámicas en un contenedor:
const tablasWrap = document.getElementById("tablasWrap");

const modalBackdrop = document.getElementById("modalBackdrop");
const btnModalCancelar = document.getElementById("btnModalCancelar");
const btnModalEliminar = document.getElementById("btnModalEliminar");

let editId = null;
let deleteId = null;

// Cache
let empleadosDocs = [];
let sucursalesMap = new Map(); // id -> {nombre, activa}

// mensajes
let msgTimer = null;

function setMsg(text = "", isError = true, autoClearMs = 2500) {
  msg.style.color = isError ? "#b00020" : "#1f8a4c";
  msg.textContent = text;

  if (msgTimer) clearTimeout(msgTimer);

  if (!text) return;

  msgTimer = setTimeout(() => {
    msg.textContent = "";
  }, autoClearMs);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function limpiarForm() {
  editId = null;
  nombreInput.value = "";
  sucursalSelect.value = "";
  rolSelect.value = "";
  btnCancelar.style.display = "none";
  btnGuardar.textContent = "Guardar";
}

function abrirModalEliminar(id) {
  deleteId = id;
  modalBackdrop.style.display = "flex";
}

function cerrarModalEliminar() {
  deleteId = null;
  modalBackdrop.style.display = "none";
}

// ============================
// SUCURSALES DINAMICAS
// ============================

function getSucursalNombreById(id) {
  if (!id) return "Sin sucursal";
  const s = sucursalesMap.get(String(id));
  return s?.nombre || "Sucursal eliminada";
}

function fillSucursalSelect() {
  // Solo activas para registrar
  sucursalSelect.innerHTML = `<option value="">Selecciona sucursal</option>`;

  const sucursalesActivas = Array.from(sucursalesMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .filter(s => s.activa === true)
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  sucursalesActivas.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.nombre || "Sin nombre";
    sucursalSelect.appendChild(opt);
  });
}

function escucharSucursales() {
  db.collection("sucursales")
    .orderBy("nombre", "asc")
    .onSnapshot((snapshot) => {
      sucursalesMap = new Map();

      snapshot.forEach((doc) => {
        const data = doc.data() || {};
        sucursalesMap.set(doc.id, {
          nombre: data.nombre || "Sin nombre",
          activa: data.activa === true
        });
      });

      fillSucursalSelect();
      renderTablasDinamicas();
    });
}

// ============================
// RENDER DINAMICO
// ============================

function renderRow(doc) {
  const data = doc.data();
  const nombre = escapeHtml(data.nombre || "");
  const rol = escapeHtml(data.rol || "");
  const id = doc.id;

  return `
    <tr>
      <td>${nombre}</td>
      <td>${rol}</td>
      <td>
        <div class="row-actions">
          <button class="btn-mini btn-edit" data-edit="${id}">Editar</button>
          <button class="btn-mini btn-del" data-del="${id}">Eliminar</button>
        </div>
      </td>
    </tr>
  `;
}

function renderTablasDinamicas() {
  if (!tablasWrap) return;

  // Agrupar empleados por sucursalId
  const grupos = new Map(); // sucursalId -> [docs]

  empleadosDocs.forEach((doc) => {
    const data = doc.data() || {};
    const sucId = String(data.sucursalId || "");

    if (!grupos.has(sucId)) grupos.set(sucId, []);
    grupos.get(sucId).push(doc);
  });

  // Orden de sucursales: primero las que existen en sucursalesMap por nombre
  const sucursalesOrdenadas = Array.from(sucursalesMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  // También incluir sucursales "fantasma" (eliminadas) si hay empleados ahí
  const idsEnEmpleados = Array.from(grupos.keys()).filter(id => id && !sucursalesMap.has(id));
  const sucursalesEliminadas = idsEnEmpleados.map(id => ({
    id,
    nombre: "Sucursal eliminada",
    activa: false
  }));

  const todas = [...sucursalesOrdenadas, ...sucursalesEliminadas];

  // Render
  tablasWrap.innerHTML = "";

  if (todas.length === 0) {
    tablasWrap.innerHTML = `<p style="margin-top:10px;font-weight:800;color:#555;">No hay sucursales registradas.</p>`;
    return;
  }

  todas.forEach((suc) => {
    const lista = grupos.get(String(suc.id)) || [];
    const titulo = escapeHtml(suc.nombre || "Sin nombre");
    const badge = suc.activa ? "" : ` <span style="font-size:.85rem;color:#b00020;font-weight:900;">(Inactiva)</span>`;

    let rows = "";
    lista.forEach((doc) => {
      rows += renderRow(doc);
    });

    const tablaHtml = `
      <section class="card">
        <h2>Empleados - ${titulo}${badge}</h2>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="3" style="padding:12px;color:#555;font-weight:800;">Sin empleados</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;

    tablasWrap.innerHTML += tablaHtml;
  });

  attachActions();
}

function attachActions() {
  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      const snap = await db.collection("empleados").doc(id).get();
      if (!snap.exists) return;

      const data = snap.data() || {};
      editId = id;

      nombreInput.value = data.nombre || "";
      rolSelect.value = data.rol || "";

      // Seleccionar sucursal (solo si está activa en el select)
      const sucId = String(data.sucursalId || "");
      const existsOption = Array.from(sucursalSelect.options).some(o => String(o.value) === sucId);

      if (existsOption) {
        sucursalSelect.value = sucId;
      } else {
        // si la sucursal está inactiva o eliminada, lo dejamos vacío
        sucursalSelect.value = "";
      }

      btnCancelar.style.display = "inline-block";
      btnGuardar.textContent = "Guardar cambios";
      setMsg("");
      window.scrollTo({ top: 0, behavior: "smooth" });
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
// AUTH + LISTENERS
// ============================

auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  userEmail.textContent = user.email || "Usuario";
  loading.style.display = "none";
  app.style.display = "block";

  escucharSucursales();

  db.collection("empleados")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      empleadosDocs = snapshot.docs;
      renderTablasDinamicas();
    });
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

btnBack.addEventListener("click", () => {
  window.location.href = "panel.html";
});

btnCancelar.addEventListener("click", () => {
  limpiarForm();
  setMsg("");
});

formEmpleado.addEventListener("submit", async (e) => {
  e.preventDefault();

  setMsg("");

  const nombre = nombreInput.value.trim();
  const sucursalId = sucursalSelect.value;
  const rol = rolSelect.value;

  if (!nombre || !sucursalId || !rol) {
    setMsg("Completa todos los campos.");
    return;
  }

  // Evitar registrar en sucursal inactiva
  const sucObj = sucursalesMap.get(String(sucursalId));
  if (!sucObj || sucObj.activa !== true) {
    setMsg("Esa sucursal está inactiva. Selecciona otra.");
    return;
  }

  const sucursalNombre = sucObj.nombre || "";

  btnGuardar.disabled = true;

  try {
    if (editId) {
      await db.collection("empleados").doc(editId).update({
        nombre,
        rol,
        sucursalId: String(sucursalId),
        sucursalNombre: String(sucursalNombre)
      });

      setMsg("Empleado actualizado.", false);
      limpiarForm();
    } else {
      await db.collection("empleados").add({
        nombre,
        rol,
        sucursalId: String(sucursalId),
        sucursalNombre: String(sucursalNombre),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      setMsg("Empleado registrado.", false);
      limpiarForm();
    }
  } catch (error) {
    setMsg("Ocurrió un error, intenta de nuevo.");
  } finally {
    btnGuardar.disabled = false;
  }
});

btnBorrarTodos.addEventListener("click", async () => {
  const ok = confirm("¿Seguro que deseas eliminar TODOS los empleados? Esta acción no se puede deshacer.");
  if (!ok) return;

  btnBorrarTodos.disabled = true;

  try {
    const snap = await db.collection("empleados").get();
    if (snap.empty) {
      setMsg("No hay empleados para eliminar.");
      return;
    }

    // OJO: batch máximo 500, pero aquí normalmente son pocos.
    // Si quieres lo hacemos por chunks luego.
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    limpiarForm();
    setMsg("Todos los empleados fueron eliminados.", false);
  } catch (e) {
    setMsg("No se pudieron eliminar todos los empleados.");
  } finally {
    btnBorrarTodos.disabled = false;
  }
});

btnModalCancelar.addEventListener("click", () => {
  cerrarModalEliminar();
});

modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) cerrarModalEliminar();
});

btnModalEliminar.addEventListener("click", async () => {
  if (!deleteId) return;

  btnModalEliminar.disabled = true;

  try {
    await db.collection("empleados").doc(deleteId).delete();
    cerrarModalEliminar();
    setMsg("Empleado eliminado.", false);
  } catch (error) {
    setMsg("No se pudo eliminar. Intenta de nuevo.");
  } finally {
    btnModalEliminar.disabled = false;
  }
});