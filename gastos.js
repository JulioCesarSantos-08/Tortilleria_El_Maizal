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
const btnGoVentas = document.getElementById("btnGoVentas");
const btnGoEgresos = document.getElementById("btnGoEgresos");
const btnGoPagos = document.getElementById("btnGoPagos");
const btnLogout = document.getElementById("btnLogout");

const formGasto = document.getElementById("formGasto");
const sucursalSelect = document.getElementById("sucursal");
const categoriaSelect = document.getElementById("categoria");
const descripcionInput = document.getElementById("descripcion");
const montoInput = document.getElementById("monto");
const msg = document.getElementById("msg");
const btnGuardar = document.getElementById("btnGuardar");

// (NUEVO) Select colaborador para categoría Trabajadores
const fieldColaborador = document.getElementById("fieldColaborador");
const colaboradorSelect = document.getElementById("colaborador");

const filtroSucursal = document.getElementById("filtroSucursal");
const filtroCategoria = document.getElementById("filtroCategoria");
const filtroFecha = document.getElementById("filtroFecha");
const btnClearFecha = document.getElementById("btnClearFecha");

const fechaInicio = document.getElementById("fechaInicio");
const fechaFin = document.getElementById("fechaFin");
const btnResetRango = document.getElementById("btnResetRango");

const tbodyGastos = document.getElementById("tbodyGastos");
const resGastos = document.getElementById("resGastos");

const modalBackdrop = document.getElementById("modalBackdrop");
const btnModalCancelar = document.getElementById("btnModalCancelar");
const btnModalEliminar = document.getElementById("btnModalEliminar");

const modalEditBackdrop = document.getElementById("modalEditBackdrop");
const editSucursal = document.getElementById("editSucursal");
const editCategoria = document.getElementById("editCategoria");
const editDescripcion = document.getElementById("editDescripcion");
const editMonto = document.getElementById("editMonto");
const btnEditCancelar = document.getElementById("btnEditCancelar");
const btnEditGuardar = document.getElementById("btnEditGuardar");

// (NUEVO) Edit colaborador
const editFieldColaborador = document.getElementById("editFieldColaborador");
const editColaborador = document.getElementById("editColaborador");

let gastosCache = [];
let deleteId = null;
let editId = null;
let msgTimer = null;

let sucursalesMap = new Map();

function setMsg(text = "", isError = true, autoClear = true) {
  msg.style.color = isError ? "#b00020" : "#1f8a4c";
  msg.textContent = text;

  if (msgTimer) clearTimeout(msgTimer);

  if (autoClear && text) {
    msgTimer = setTimeout(() => {
      msg.textContent = "";
    }, 2500);
  }
}

function formatMoney(n) {
  return "$" + Number(n || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatNumber(n, decimals = 2) {
  return Number(n || 0).toLocaleString("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSucursalNombreById(id) {
  if (!id) return "-";
  const s = sucursalesMap.get(String(id));
  return s?.nombre || "-";
}

// ============================
// COLABORADORES (EMPLEADOS) POR SUCURSAL
// ============================

async function cargarColaboradoresEnSelect(selectEl, sucursalId, selectedId = "") {
  if (!selectEl) return;

  selectEl.innerHTML = `<option value="">Selecciona colaborador</option>`;

  if (!sucursalId) return;

  try {
    const snap = await db
      .collection("empleados")
      .where("sucursalId", "==", String(sucursalId))
      .get();

    snap.forEach((doc) => {
      const data = doc.data() || {};
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.textContent = data.nombre || "Sin nombre";
      selectEl.appendChild(opt);
    });

    if (selectedId) {
      selectEl.value = String(selectedId);
    }
  } catch (e) {
    // si falla no rompemos la página
  }
}

function toggleColaboradorField() {
  const cat = categoriaSelect.value;
  if (!fieldColaborador) return;

  if (cat === "Trabajadores") {
    fieldColaborador.style.display = "block";
  } else {
    fieldColaborador.style.display = "none";
    if (colaboradorSelect) colaboradorSelect.value = "";
  }
}

function toggleEditColaboradorField() {
  const cat = editCategoria.value;
  if (!editFieldColaborador) return;

  if (cat === "Trabajadores") {
    editFieldColaborador.style.display = "block";
  } else {
    editFieldColaborador.style.display = "none";
    if (editColaborador) editColaborador.value = "";
  }
}

// ============================
// SUCURSALES DINAMICAS
// ============================

function fillSucursalSelects() {
  sucursalSelect.innerHTML = `<option value="">Selecciona sucursal</option>`;
  filtroSucursal.innerHTML = `<option value="todas">Todas</option>`;
  editSucursal.innerHTML = `<option value="">Selecciona sucursal</option>`;

  const sucursalesActivas = Array.from(sucursalesMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .filter(s => s.activa === true)
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  sucursalesActivas.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.nombre || "Sin nombre";
    sucursalSelect.appendChild(opt);

    const opt2 = document.createElement("option");
    opt2.value = s.id;
    opt2.textContent = s.nombre || "Sin nombre";
    editSucursal.appendChild(opt2);
  });

  const sucursalesTodas = Array.from(sucursalesMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  sucursalesTodas.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.nombre || "Sin nombre"}${s.activa ? "" : " (Inactiva)"}`;
    filtroSucursal.appendChild(opt);
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

      fillSucursalSelects();

      const selId = sucursalSelect.value;
      if (selId) {
        const s = sucursalesMap.get(String(selId));
        if (!s || s.activa !== true) {
          sucursalSelect.value = "";
        }
      }

      renderTodo();
    });
}

// ============================
// MODALES
// ============================

function abrirModalEliminar(id) {
  deleteId = id;
  modalBackdrop.style.display = "flex";
}

function cerrarModalEliminar() {
  deleteId = null;
  modalBackdrop.style.display = "none";
}

async function abrirModalEditar(g) {
  editId = g.id;

  editSucursal.value = String(g.sucursalId || "");
  editCategoria.value = String(g.categoria || "");
  editDescripcion.value = String(g.descripcion || "");
  editMonto.value = String(g.totalPesos || "");

  toggleEditColaboradorField();

  // si es trabajadores, cargar colaboradores de esa sucursal
  if (String(g.categoria) === "Trabajadores") {
    await cargarColaboradoresEnSelect(editColaborador, editSucursal.value, g.colaboradorId || "");
  } else {
    if (editColaborador) editColaborador.value = "";
  }

  modalEditBackdrop.style.display = "flex";
}

function cerrarModalEditar() {
  editId = null;
  modalEditBackdrop.style.display = "none";
}

// ============================
// FILTROS
// ============================

function getGastosFiltrados() {
  const suc = filtroSucursal.value;
  const cat = filtroCategoria.value;
  const fecha = filtroFecha.value;

  let lista = [...gastosCache];

  if (suc !== "todas") {
    lista = lista.filter(g => String(g.sucursalId || "") === String(suc));
  }

  if (cat !== "todas") {
    lista = lista.filter(g => String(g.categoria) === String(cat));
  }

  if (fecha) {
    lista = lista.filter(g => String(g.fechaKey || "") === String(fecha));
  }

  return lista;
}

function renderResumen() {
  const lista = getGastosFiltrados();
  const total = lista.reduce((acc, g) => acc + Number(g.totalPesos || 0), 0);
  resGastos.textContent = formatMoney(total);
}

function renderTabla() {
  const lista = getGastosFiltrados();

  tbodyGastos.innerHTML = "";

  lista.forEach((g) => {
    const fecha = g.createdAt?.toDate ? g.createdAt.toDate() : null;
    const fechaTxt = fecha ? fecha.toLocaleString("es-MX") : "-";

    const sucNombre = g.sucursalNombre || getSucursalNombreById(g.sucursalId);
    const sucTxt = escapeHtml(sucNombre || "-");

    const catTxt = escapeHtml(g.categoria || "-");

    // si es Trabajadores, mostramos el colaborador en la descripción para que se vea claro
    let descFinal = g.descripcion || "-";
    if (String(g.categoria) === "Trabajadores" && (g.colaboradorNombre || g.colaboradorId)) {
      descFinal = `${descFinal} (Colaborador: ${g.colaboradorNombre || "Sin nombre"})`;
    }

    const descTxt = escapeHtml(descFinal);
    const total = formatNumber(g.totalPesos || 0, 2);

    tbodyGastos.innerHTML += `
      <tr>
        <td>${escapeHtml(fechaTxt)}</td>
        <td>${sucTxt}</td>
        <td>${catTxt}</td>
        <td>${descTxt}</td>
        <td>$${total}</td>
        <td>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn-mini" data-edit="${g.id}" style="background:rgba(31,138,76,.12);color:#1f8a4c;">Editar</button>
            <button class="btn-mini" data-del="${g.id}">Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  });

  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      abrirModalEliminar(id);
    });
  });

  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      const snap = await db.collection("gastos").doc(id).get();
      if (!snap.exists) return;
      abrirModalEditar({ id: snap.id, ...snap.data() });
    });
  });
}

function renderTodo() {
  renderTabla();
  renderResumen();
}

// ============================
// BORRAR POR RANGO
// ============================

async function eliminarGastosPorRango(ini, fin) {
  const snap = await db
    .collection("gastos")
    .where("fechaKey", ">=", ini)
    .where("fechaKey", "<=", fin)
    .get();

  if (snap.empty) return 0;

  let count = 0;
  let batch = db.batch();
  let ops = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    ops++;
    count++;

    if (ops === 450) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();

  return count;
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

  escucharSucursales();

  db.collection("gastos")
    .orderBy("createdAt", "desc")
    .limit(1000)
    .onSnapshot((snapshot) => {
      gastosCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTodo();
    });
});

// ============================
// NAV
// ============================

btnBack.addEventListener("click", () => {
  window.location.href = "panel.html";
});

btnGoVentas.addEventListener("click", () => {
  window.location.href = "empleados2.html";
});

if (btnGoEgresos) btnGoEgresos.addEventListener("click", () => {
  window.location.href = "egresos.html";
});

if (btnGoPagos) btnGoPagos.addEventListener("click", () => {
  window.location.href = "pagos.html";
});

btnLogout.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

// ============================
// EVENTOS FILTROS
// ============================

filtroSucursal.addEventListener("change", renderTodo);
filtroCategoria.addEventListener("change", renderTodo);
filtroFecha.addEventListener("change", renderTodo);

btnClearFecha.addEventListener("click", () => {
  filtroFecha.value = "";
  renderTodo();
});

// ============================
// EVENTOS FORM
// ============================

descripcionInput.addEventListener("input", () => setMsg(""));
montoInput.addEventListener("input", () => setMsg(""));

sucursalSelect.addEventListener("change", async () => {
  setMsg("");

  // recargar colaboradores por sucursal si está en Trabajadores
  if (categoriaSelect.value === "Trabajadores") {
    await cargarColaboradoresEnSelect(colaboradorSelect, sucursalSelect.value);
  }
});

categoriaSelect.addEventListener("change", async () => {
  setMsg("");
  toggleColaboradorField();

  if (categoriaSelect.value === "Trabajadores") {
    await cargarColaboradoresEnSelect(colaboradorSelect, sucursalSelect.value);
  }
});

if (editSucursal) {
  editSucursal.addEventListener("change", async () => {
    toggleEditColaboradorField();
    if (editCategoria.value === "Trabajadores") {
      await cargarColaboradoresEnSelect(editColaborador, editSucursal.value);
    }
  });
}

if (editCategoria) {
  editCategoria.addEventListener("change", async () => {
    toggleEditColaboradorField();
    if (editCategoria.value === "Trabajadores") {
      await cargarColaboradoresEnSelect(editColaborador, editSucursal.value);
    }
  });
}

// ============================
// GUARDAR GASTO
// ============================

formGasto.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const sucursalId = sucursalSelect.value;
  const sucursalNombre = getSucursalNombreById(sucursalId);

  const categoria = categoriaSelect.value;
  const descripcion = descripcionInput.value.trim();
  const monto = Number(montoInput.value || 0);

  if (!sucursalId || !categoria || !descripcion || monto <= 0) {
    setMsg("Completa todos los campos correctamente.");
    return;
  }

  const sucObj = sucursalesMap.get(String(sucursalId));
  if (!sucObj || sucObj.activa !== true) {
    setMsg("Esa sucursal está inactiva. Selecciona otra.");
    return;
  }

  // Si es trabajadores -> colaborador obligatorio
  let colaboradorId = "";
  let colaboradorNombre = "";

  if (categoria === "Trabajadores") {
    colaboradorId = colaboradorSelect?.value || "";
    colaboradorNombre =
      colaboradorSelect?.options[colaboradorSelect.selectedIndex]?.textContent || "";

    if (!colaboradorId) {
      setMsg("Selecciona un colaborador.");
      return;
    }
  }

  btnGuardar.disabled = true;

  try {
    const payload = {
      sucursalId: String(sucursalId),
      sucursalNombre: String(sucursalNombre || ""),
      categoria,
      descripcion,
      totalPesos: monto,
      fechaKey: new Date().toLocaleDateString("sv-SE"),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Guardar anticipo para pagos.html
    if (categoria === "Trabajadores") {
      payload.colaboradorId = String(colaboradorId);
      payload.colaboradorNombre = String(colaboradorNombre || "");
      payload.esAnticipo = true; // <- clave
    }

    await db.collection("gastos").add(payload);

    setMsg("Gasto registrado.", false);

    descripcionInput.value = "";
    montoInput.value = "";
    if (colaboradorSelect) colaboradorSelect.value = "";
  } catch (error) {
    setMsg("No se pudo guardar. Intenta de nuevo.");
  } finally {
    btnGuardar.disabled = false;
  }
});

// ============================
// ELIMINAR POR RANGO
// ============================

btnResetRango.addEventListener("click", async () => {
  const ini = fechaInicio.value;
  const fin = fechaFin.value;

  if (!ini || !fin) {
    alert("Selecciona fecha inicio y fecha fin");
    return;
  }

  if (ini > fin) {
    alert("La fecha inicio no puede ser mayor a la final");
    return;
  }

  const ok = confirm(`Se eliminarán los gastos del ${ini} al ${fin}. ¿Continuar?`);
  if (!ok) return;

  btnResetRango.disabled = true;

  try {
    const eliminados = await eliminarGastosPorRango(ini, fin);

    if (!eliminados) {
      alert("No hay registros en ese rango");
      return;
    }

    alert(`Listo. Gastos eliminados: ${eliminados}`);

    fechaInicio.value = "";
    fechaFin.value = "";
  } catch (e) {
    alert("Error al eliminar registros");
  } finally {
    btnResetRango.disabled = false;
  }
});

// ============================
// MODAL ELIMINAR
// ============================

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
    await db.collection("gastos").doc(deleteId).delete();
    cerrarModalEliminar();
    setMsg("Gasto eliminado.", false);
  } catch (error) {
    setMsg("No se pudo eliminar. Intenta de nuevo.");
  } finally {
    btnModalEliminar.disabled = false;
  }
});

// ============================
// MODAL EDITAR
// ============================

btnEditCancelar.addEventListener("click", () => {
  cerrarModalEditar();
});

modalEditBackdrop.addEventListener("click", (e) => {
  if (e.target === modalEditBackdrop) cerrarModalEditar();
});

btnEditGuardar.addEventListener("click", async () => {
  if (!editId) return;

  const sucursalId = editSucursal.value;
  const categoria = editCategoria.value;
  const descripcion = editDescripcion.value.trim();
  const monto = Number(editMonto.value || 0);

  if (!sucursalId || !categoria || !descripcion || monto <= 0) {
    setMsg("Completa los campos del gasto.");
    return;
  }

  const sucObj = sucursalesMap.get(String(sucursalId));
  if (!sucObj || sucObj.activa !== true) {
    setMsg("Esa sucursal está inactiva. Selecciona otra.");
    return;
  }

  // si es trabajadores -> colaborador obligatorio
  let colaboradorId = "";
  let colaboradorNombre = "";

  if (categoria === "Trabajadores") {
    colaboradorId = editColaborador?.value || "";
    colaboradorNombre =
      editColaborador?.options[editColaborador.selectedIndex]?.textContent || "";

    if (!colaboradorId) {
      setMsg("Selecciona un colaborador.");
      return;
    }
  }

  btnEditGuardar.disabled = true;

  try {
    const updatePayload = {
      sucursalId: String(sucursalId),
      sucursalNombre: String(getSucursalNombreById(sucursalId) || ""),
      categoria,
      descripcion,
      totalPesos: monto,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (categoria === "Trabajadores") {
      updatePayload.colaboradorId = String(colaboradorId);
      updatePayload.colaboradorNombre = String(colaboradorNombre || "");
      updatePayload.esAnticipo = true;
    } else {
      // si cambió a otra categoría, limpiamos campos de colaborador
      updatePayload.colaboradorId = firebase.firestore.FieldValue.delete();
      updatePayload.colaboradorNombre = firebase.firestore.FieldValue.delete();
      updatePayload.esAnticipo = firebase.firestore.FieldValue.delete();
    }

    await db.collection("gastos").doc(editId).update(updatePayload);

    cerrarModalEditar();
    setMsg("Gasto actualizado.", false);
  } catch (e) {
    setMsg("No se pudo actualizar el gasto.");
  } finally {
    btnEditGuardar.disabled = false;
  }
});

// init visual
toggleColaboradorField();
