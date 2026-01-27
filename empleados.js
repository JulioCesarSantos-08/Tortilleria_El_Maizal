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
const sueldoSemanalInput = document.getElementById("sueldoSemanal");
const msg = document.getElementById("msg");
const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");
const btnBorrarTodos = document.getElementById("btnBorrarTodos");

const tablasWrap = document.getElementById("tablasWrap");

const modalBackdrop = document.getElementById("modalBackdrop");
const btnModalCancelar = document.getElementById("btnModalCancelar");
const btnModalEliminar = document.getElementById("btnModalEliminar");

let editId = null;
let deleteId = null;

let empleadosDocs = [];
let sucursalesMap = new Map();
let msgTimer = null;

function setMsg(text = "", isError = true, autoClearMs = 2500) {
  msg.style.color = isError ? "#b00020" : "#1f8a4c";
  msg.textContent = text;
  if (msgTimer) clearTimeout(msgTimer);
  if (!text) return;
  msgTimer = setTimeout(() => msg.textContent = "", autoClearMs);
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
  rolSelect.value = "";
  sucursalSelect.value = "";
  sueldoSemanalInput.value = "";
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

function fillSucursalSelect() {
  sucursalSelect.innerHTML = `<option value="">Selecciona sucursal</option>`;
  Array.from(sucursalesMap.entries())
    .filter(([, d]) => d.activa === true)
    .sort((a, b) => (a[1].nombre || "").localeCompare(b[1].nombre || ""))
    .forEach(([id, data]) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = data.nombre;
      sucursalSelect.appendChild(opt);
    });
}

function escucharSucursales() {
  db.collection("sucursales")
    .orderBy("nombre", "asc")
    .onSnapshot(snap => {
      sucursalesMap.clear();
      snap.forEach(doc => {
        const d = doc.data() || {};
        sucursalesMap.set(doc.id, {
          nombre: d.nombre || "",
          activa: d.activa === true
        });
      });
      fillSucursalSelect();
      renderTablas();
    });
}

function renderRow(doc) {
  const d = doc.data();
  return `
    <tr>
      <td>${escapeHtml(d.nombre)}</td>
      <td>${escapeHtml(d.rol)}</td>
      <td>$${Number(d.sueldoSemanal).toLocaleString("es-MX")}</td>
      <td>
        <button class="btn-mini btn-edit" data-edit="${doc.id}">Editar</button>
        <button class="btn-mini btn-del" data-del="${doc.id}">Eliminar</button>
      </td>
    </tr>
  `;
}

function renderTablas() {
  tablasWrap.innerHTML = "";

  const grupos = new Map();

  empleadosDocs.forEach(doc => {
    const d = doc.data();
    const sid = d.sucursalId;
    if (!grupos.has(sid)) grupos.set(sid, []);
    grupos.get(sid).push(doc);
  });

  Array.from(grupos.entries()).forEach(([sid, lista]) => {
    const suc = sucursalesMap.get(sid);
    const nombre = escapeHtml(suc?.nombre || "Sucursal eliminada");
    let rows = "";
    lista.forEach(d => rows += renderRow(d));

    tablasWrap.innerHTML += `
      <section class="card">
        <h2>${nombre}</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Sueldo semanal</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </section>
    `;
  });

  attachActions();
}

function attachActions() {
  document.querySelectorAll("[data-edit]").forEach(b => {
    b.onclick = async () => {
      const snap = await db.collection("empleados").doc(b.dataset.edit).get();
      if (!snap.exists) return;
      const d = snap.data();
      editId = snap.id;
      nombreInput.value = d.nombre;
      rolSelect.value = d.rol;
      sueldoSemanalInput.value = d.sueldoSemanal;
      sucursalSelect.value = d.sucursalId;
      btnCancelar.style.display = "inline-block";
      btnGuardar.textContent = "Guardar cambios";
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });

  document.querySelectorAll("[data-del]").forEach(b => {
    b.onclick = () => abrirModalEliminar(b.dataset.del);
  });
}

auth.onAuthStateChanged(user => {
  if (!user) return location.href = "index.html";
  userEmail.textContent = user.email;
  loading.style.display = "none";
  app.style.display = "block";

  escucharSucursales();

  db.collection("empleados").orderBy("createdAt", "desc")
    .onSnapshot(s => {
      empleadosDocs = s.docs;
      renderTablas();
    });
});

formEmpleado.addEventListener("submit", async e => {
  e.preventDefault();

  const nombre = nombreInput.value.trim();
  const rol = rolSelect.value;
  const sueldo = Number(sueldoSemanalInput.value);
  const sucursalId = sucursalSelect.value;

  if (!nombre || !rol || !sucursalId || sueldo < 0) {
    setMsg("Completa todos los campos.");
    return;
  }

  const sucursalNombre = sucursalesMap.get(sucursalId)?.nombre || "";

  btnGuardar.disabled = true;

  try {
    const data = {
      nombre,
      rol,
      sueldoSemanal: sueldo,
      sucursalId,
      sucursalNombre
    };

    if (editId) {
      await db.collection("empleados").doc(editId).update(data);
      setMsg("Empleado actualizado.", false);
    } else {
      await db.collection("empleados").add({
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      setMsg("Empleado registrado.", false);
    }

    limpiarForm();
  } catch {
    setMsg("Error al guardar.");
  } finally {
    btnGuardar.disabled = false;
  }
});

btnCancelar.onclick = () => limpiarForm();

btnModalCancelar.onclick = cerrarModalEliminar;

btnModalEliminar.onclick = async () => {
  if (!deleteId) return;
  await db.collection("empleados").doc(deleteId).delete();
  cerrarModalEliminar();
  setMsg("Empleado eliminado.", false);
};

btnBack.onclick = () => location.href = "panel.html";
document.getElementById("btnLogout").onclick = async () => {
  await auth.signOut();
  location.href = "index.html";
};
