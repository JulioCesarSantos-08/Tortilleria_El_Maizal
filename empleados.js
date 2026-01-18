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
// ❌ ya NO existen en empleados.html, por eso los quitamos:
// const btnGoVentas = document.getElementById("btnGoVentas");
// const btnGoGastos = document.getElementById("btnGoGastos");

const formEmpleado = document.getElementById("formEmpleado");
const nombreInput = document.getElementById("nombre");
const sucursalSelect = document.getElementById("sucursal");
const rolSelect = document.getElementById("rol");
const msg = document.getElementById("msg");
const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");
const btnBorrarTodos = document.getElementById("btnBorrarTodos");

const tbody1 = document.getElementById("tbody1");
const tbody2 = document.getElementById("tbody2");
const tbody3 = document.getElementById("tbody3");

const modalBackdrop = document.getElementById("modalBackdrop");
const btnModalCancelar = document.getElementById("btnModalCancelar");
const btnModalEliminar = document.getElementById("btnModalEliminar");

let editId = null;
let deleteId = null;

// ✅ para que los mensajes no se queden pegados
let msgTimer = null;

function setMsg(text = "", isError = true, autoClearMs = 2500) {
  msg.style.color = isError ? "#b00020" : "#1f8a4c";
  msg.textContent = text;

  if (msgTimer) clearTimeout(msgTimer);

  // si mandas vacío, no programamos limpieza
  if (!text) return;

  msgTimer = setTimeout(() => {
    msg.textContent = "";
  }, autoClearMs);
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

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

function renderTablas(docs) {
  tbody1.innerHTML = "";
  tbody2.innerHTML = "";
  tbody3.innerHTML = "";

  docs.forEach((doc) => {
    const data = doc.data();
    const suc = String(data.sucursal || "");
    const row = renderRow(doc);

    if (suc === "1") tbody1.innerHTML += row;
    else if (suc === "2") tbody2.innerHTML += row;
    else if (suc === "3") tbody3.innerHTML += row;
  });
}

function attachActions() {
  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      const snap = await db.collection("empleados").doc(id).get();
      if (!snap.exists) return;

      const data = snap.data();
      editId = id;

      nombreInput.value = data.nombre || "";
      sucursalSelect.value = String(data.sucursal || "");
      rolSelect.value = data.rol || "";

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

auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  userEmail.textContent = user.email || "Usuario";
  loading.style.display = "none";
  app.style.display = "block";

  db.collection("empleados")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      renderTablas(snapshot.docs);
      attachActions();
    });
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

btnBack.addEventListener("click", () => {
  window.location.href = "panel.html";
});

// ❌ eliminamos estos eventos porque ya quitaste esos botones del HTML
// btnGoVentas.addEventListener("click", () => {
//   window.location.href = "empleados2.html";
// });

// btnGoGastos.addEventListener("click", () => {
//   window.location.href = "gastos.html";
// });

btnCancelar.addEventListener("click", () => {
  limpiarForm();
  setMsg("");
});

formEmpleado.addEventListener("submit", async (e) => {
  e.preventDefault();

  // 👇 cada vez que guardas, limpiamos el mensaje anterior
  setMsg("");

  const nombre = nombreInput.value.trim();
  const sucursal = sucursalSelect.value;
  const rol = rolSelect.value;

  if (!nombre || !sucursal || !rol) {
    setMsg("Completa todos los campos.");
    return;
  }

  btnGuardar.disabled = true;

  try {
    if (editId) {
      await db.collection("empleados").doc(editId).update({
        nombre,
        sucursal,
        rol
      });

      setMsg("Empleado actualizado.", false);
      limpiarForm();
    } else {
      await db.collection("empleados").add({
        nombre,
        sucursal,
        rol,
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