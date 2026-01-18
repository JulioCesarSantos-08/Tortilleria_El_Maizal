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
const btnLogout = document.getElementById("btnLogout");

const formGasto = document.getElementById("formGasto");
const sucursalSelect = document.getElementById("sucursal");
const categoriaSelect = document.getElementById("categoria");
const descripcionInput = document.getElementById("descripcion");
const montoInput = document.getElementById("monto");
const msg = document.getElementById("msg");
const btnGuardar = document.getElementById("btnGuardar");

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

let gastosCache = [];
let deleteId = null;
let msgTimer = null;

// Cache de sucursales: { id -> {nombre, activa} }
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

// ============================
// SUCURSALES DINAMICAS
// ============================

function getSucursalNombreById(id) {
  if (!id) return "-";
  const s = sucursalesMap.get(String(id));
  return s?.nombre || "-";
}

function fillSucursalSelects() {
  // Select de registrar gasto
  sucursalSelect.innerHTML = `<option value="">Selecciona sucursal</option>`;

  // Select de filtro
  filtroSucursal.innerHTML = `<option value="todas">Todas</option>`;

  // Solo activas para registrar
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

  // En filtros: mostramos todas (activas e inactivas) para consultar historial
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

      // Si la sucursal seleccionada para registrar ya no existe o está inactiva -> limpiar
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

function abrirModalEliminar(id) {
  deleteId = id;
  modalBackdrop.style.display = "flex";
}

function cerrarModalEliminar() {
  deleteId = null;
  modalBackdrop.style.display = "none";
}

// ============================
// FILTROS (por sucursalId)
// ============================

function getGastosFiltrados() {
  const suc = filtroSucursal.value; // ahora es sucursalId
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
    const descTxt = escapeHtml(g.descripcion || "-");
    const total = formatNumber(g.totalPesos || 0, 2);

    tbodyGastos.innerHTML += `
      <tr>
        <td>${escapeHtml(fechaTxt)}</td>
        <td>${sucTxt}</td>
        <td>${catTxt}</td>
        <td>${descTxt}</td>
        <td>$${total}</td>
        <td><button class="btn-mini" data-del="${g.id}">Eliminar</button></td>
      </tr>
    `;
  });

  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      abrirModalEliminar(id);
    });
  });
}

function renderTodo() {
  renderTabla();
  renderResumen();
}

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

auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  userEmail.textContent = user.email || "Usuario";
  loading.style.display = "none";
  app.style.display = "block";

  // Escuchar sucursales dinámicas
  escucharSucursales();

  db.collection("gastos")
    .orderBy("createdAt", "desc")
    .limit(1000)
    .onSnapshot((snapshot) => {
      gastosCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTodo();
    });
});

btnBack.addEventListener("click", () => {
  window.location.href = "panel.html";
});

btnGoVentas.addEventListener("click", () => {
  window.location.href = "empleados2.html";
});

btnLogout.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

filtroSucursal.addEventListener("change", renderTodo);
filtroCategoria.addEventListener("change", renderTodo);
filtroFecha.addEventListener("change", renderTodo);

btnClearFecha.addEventListener("click", () => {
  filtroFecha.value = "";
  renderTodo();
});

descripcionInput.addEventListener("input", () => setMsg(""));
montoInput.addEventListener("input", () => setMsg(""));
sucursalSelect.addEventListener("change", () => setMsg(""));
categoriaSelect.addEventListener("change", () => setMsg(""));

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

  // Evitar registrar en sucursal inactiva
  const sucObj = sucursalesMap.get(String(sucursalId));
  if (!sucObj || sucObj.activa !== true) {
    setMsg("Esa sucursal está inactiva. Selecciona otra.");
    return;
  }

  btnGuardar.disabled = true;

  try {
    await db.collection("gastos").add({
      sucursalId: String(sucursalId),
      sucursalNombre: String(sucursalNombre || ""),
      categoria,
      descripcion,
      totalPesos: monto,
      fechaKey: new Date().toLocaleDateString("sv-SE"),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    setMsg("Gasto registrado.", false);

    descripcionInput.value = "";
    montoInput.value = "";
  } catch (error) {
    setMsg("No se pudo guardar. Intenta de nuevo.");
  } finally {
    btnGuardar.disabled = false;
  }
});

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