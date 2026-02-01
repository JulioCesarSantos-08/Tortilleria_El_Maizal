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
const btnGoGastos = document.getElementById("btnGoGastos");
const btnGoEgresos = document.getElementById("btnGoEgresos");
const btnGoPagos = document.getElementById("btnGoPagos");

const formVenta = document.getElementById("formVenta");
const sucursalSelect = document.getElementById("sucursal");
const tipoVentaSelect = document.getElementById("tipoVenta");
const fieldEmpleado = document.getElementById("fieldEmpleado");
const empleadoSelect = document.getElementById("empleado");
const kilosInput = document.getElementById("kilos");
const precioKiloInput = document.getElementById("precioKilo");
const totalPesosInput = document.getElementById("totalPesos");
const msg = document.getElementById("msg");
const btnGuardar = document.getElementById("btnGuardar");

const filtroSucursal = document.getElementById("filtroSucursal");
const filtroTipo = document.getElementById("filtroTipo");
const filtroDesde = document.getElementById("filtroDesde");
const filtroHasta = document.getElementById("filtroHasta");
const btnClearFecha = document.getElementById("btnClearFecha");

const tbodyVentas = document.getElementById("tbodyVentas");

const resKilos = document.getElementById("resKilos");
const resVentas = document.getElementById("resVentas");
const resGastos = document.getElementById("resGastos");
const resNeto = document.getElementById("resNeto");

const fechaInicio = document.getElementById("fechaInicio");
const fechaFin = document.getElementById("fechaFin");
const btnResetRango = document.getElementById("btnResetRango");

const modalBackdrop = document.getElementById("modalBackdrop");
const btnModalCancelar = document.getElementById("btnModalCancelar");
const btnModalEliminar = document.getElementById("btnModalEliminar");

let deleteId = null;
let ventasCache = [];
let gastosCache = [];
let msgTimer = null;

let sucursalesMap = new Map();

let lastEditedField = null;

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

function formatNumber(n, decimals = 1) {
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

function getFechaKeyHoy() {
  return new Date().toLocaleDateString("sv-SE");
}

async function addLog({ accion, detalle }) {
  try {
    const user = auth.currentUser;
    await db.collection("logs").add({
      modulo: "ventas",
      accion: String(accion || ""),
      detalle: String(detalle || ""),
      userEmail: String(user?.email || ""),
      fechaKey: getFechaKeyHoy(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {}
}

function calcFromKilos() {
  const kilos = Number(kilosInput.value || 0);
  const precio = Number(precioKiloInput.value || 0);

  if (!kilos || !precio) {
    totalPesosInput.value = "";
    return;
  }

  const total = kilos * precio;
  totalPesosInput.value = Number(total.toFixed(2));
}

function calcFromTotal() {
  const total = Number(totalPesosInput.value || 0);
  const precio = Number(precioKiloInput.value || 0);

  if (!total || !precio) {
    kilosInput.value = "";
    return;
  }

  const kilos = total / precio;
  kilosInput.value = Number(kilos.toFixed(1));
}

function syncCalc() {
  if (lastEditedField === "total") {
    calcFromTotal();
  } else {
    calcFromKilos();
  }
}

function getSucursalNombreById(id) {
  if (!id) return "-";
  const s = sucursalesMap.get(String(id));
  return s?.nombre || "-";
}

function fillSucursalSelects() {
  sucursalSelect.innerHTML = `<option value="">Selecciona sucursal</option>`;
  filtroSucursal.innerHTML = `<option value="todas">Todas</option>`;

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
          empleadoSelect.innerHTML = `<option value="">Selecciona empleado</option>`;
        }
      }

      renderTodo();
    });
}

async function cargarEmpleadosPorSucursalId(sucursalId) {
  empleadoSelect.innerHTML = `<option value="">Selecciona empleado</option>`;
  if (!sucursalId) return;

  const snap = await db
    .collection("empleados")
    .where("sucursalId", "==", String(sucursalId))
    .get();

  const lista = snap.docs
    .map(d => ({ id: d.id, ...(d.data() || {}) }))
    .filter(e => String(e.rol || "") === "Repartidor")
    .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

  lista.forEach((data) => {
    const option = document.createElement("option");
    option.value = data.id;
    option.textContent = `${data.nombre || "Sin nombre"} (${data.rol || "Sin rol"})`;
    empleadoSelect.appendChild(option);
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

function isFechaEnRango(fechaKey, desde, hasta) {
  if (!fechaKey) return false;
  const f = String(fechaKey || "");
  const d = String(desde || "");
  const h = String(hasta || "");

  if (d && f < d) return false;
  if (h && f > h) return false;
  return true;
}

function getVentasFiltradas() {
  const suc = filtroSucursal.value;
  const tipo = filtroTipo.value;
  const desde = filtroDesde.value;
  const hasta = filtroHasta.value;

  let lista = [...ventasCache];

  if (suc !== "todas") {
    lista = lista.filter(v => String(v.sucursalId || "") === String(suc));
  }

  if (tipo !== "todos") {
    lista = lista.filter(v => String(v.tipoVenta) === String(tipo));
  }

  if (desde || hasta) {
    lista = lista.filter(v => isFechaEnRango(v.fechaKey, desde, hasta));
  }

  return lista;
}

function getGastosFiltrados() {
  const suc = filtroSucursal.value;
  const desde = filtroDesde.value;
  const hasta = filtroHasta.value;

  let lista = [...gastosCache];

  if (suc !== "todas") {
    lista = lista.filter(g => String(g.sucursalId || "") === String(suc));
  }

  if (desde || hasta) {
    lista = lista.filter(g => isFechaEnRango(g.fechaKey, desde, hasta));
  }

  return lista;
}

function renderResumen() {
  const ventasFiltradas = getVentasFiltradas();
  const gastosFiltrados = getGastosFiltrados();

  const ventasPagadas = ventasFiltradas.filter(v => v.pagado === true);

  const totalKilos = ventasPagadas.reduce((acc, v) => acc + Number(v.kilos || 0), 0);
  const totalVentas = ventasPagadas.reduce((acc, v) => acc + Number(v.totalPesos || 0), 0);
  const totalGastos = gastosFiltrados.reduce((acc, g) => acc + Number(g.totalPesos || 0), 0);
  const neto = totalVentas - totalGastos;

  resKilos.textContent = formatNumber(totalKilos, 1);
  resVentas.textContent = formatMoney(totalVentas);
  resGastos.textContent = formatMoney(totalGastos);
  resNeto.textContent = formatMoney(neto);

  resNeto.style.color = neto >= 0 ? "#1f8a4c" : "#b00020";
}

function renderTabla() {
  const lista = getVentasFiltradas();

  tbodyVentas.innerHTML = "";

  lista.forEach((v) => {
    const fecha = v.createdAt?.toDate ? v.createdAt.toDate() : null;
    const fechaTxt = fecha ? fecha.toLocaleString("es-MX") : "-";

    const sucNombre = v.sucursalNombre || getSucursalNombreById(v.sucursalId);
    const sucTxt = escapeHtml(sucNombre || "-");

    const tipoTxt = escapeHtml(v.tipoVenta || "-");
    const empTxt = escapeHtml(v.empleadoNombre || "Local");

    const kilos = formatNumber(v.kilos || 0, 1);
    const precio = formatNumber(v.precioKilo || 0, 2);
    const total = formatNumber(v.totalPesos || 0, 2);

    const pagado = v.pagado === true;

    tbodyVentas.innerHTML += `
      <tr>
        <td>${escapeHtml(fechaTxt)}</td>
        <td>${sucTxt}</td>
        <td>${tipoTxt}</td>
        <td>${empTxt}</td>
        <td>${kilos}</td>
        <td>$${precio}</td>
        <td>$${total}</td>
        <td>
          <button class="btn-mini ${pagado ? "btn-paid" : "btn-unpaid"}" data-pay="${v.id}">
            ${pagado ? "Pagado" : "No pagado"}
          </button>
        </td>
        <td>
          <button class="btn-mini" data-del="${v.id}">Eliminar</button>
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

  document.querySelectorAll("[data-pay]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-pay");
      const venta = ventasCache.find(x => x.id === id);
      if (!venta) return;

      const nuevoEstado = !(venta.pagado === true);

      try {
        await db.collection("ventas").doc(id).update({
          pagado: nuevoEstado,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const suc = venta.sucursalNombre || getSucursalNombreById(venta.sucursalId);
        const emp = venta.empleadoNombre || "Local";
        const total = Number(venta.totalPesos || 0);

        await addLog({
          accion: "editar",
          detalle: `Marcó venta como ${nuevoEstado ? "Pagado" : "No pagado"} | Sucursal: ${suc || "-"} | Tipo: ${venta.tipoVenta || "-"} | Empleado: ${emp} | Total: $${total.toFixed(2)}`
        });
      } catch (e) {
        setMsg("No se pudo actualizar el pago.");
      }
    });
  });
}

function renderTodo() {
  renderTabla();
  renderResumen();
}

async function eliminarColeccionPorRango(nombreColeccion, ini, fin) {
  const snap = await db
    .collection(nombreColeccion)
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

  escucharSucursales();

  db.collection("ventas")
    .orderBy("createdAt", "desc")
    .limit(1000)
    .onSnapshot((snapshot) => {
      ventasCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTodo();
    });

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

btnGoGastos.addEventListener("click", () => {
  window.location.href = "gastos.html";
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

sucursalSelect.addEventListener("change", async () => {
  setMsg("");
  await cargarEmpleadosPorSucursalId(sucursalSelect.value);
});

tipoVentaSelect.addEventListener("change", async () => {
  setMsg("");
  const tipo = tipoVentaSelect.value;

  if (tipo === "repartidor") {
    fieldEmpleado.style.display = "block";
    empleadoSelect.required = true;
    await cargarEmpleadosPorSucursalId(sucursalSelect.value);
  } else {
    fieldEmpleado.style.display = "none";
    empleadoSelect.required = false;
    empleadoSelect.value = "";
  }
});

kilosInput.addEventListener("input", () => {
  setMsg("");
  lastEditedField = "kilos";
  syncCalc();
});

precioKiloInput.addEventListener("input", () => {
  setMsg("");
  syncCalc();
});

totalPesosInput.addEventListener("input", () => {
  setMsg("");
  lastEditedField = "total";
  syncCalc();
});

empleadoSelect.addEventListener("change", () => setMsg(""));

filtroSucursal.addEventListener("change", renderTodo);
filtroTipo.addEventListener("change", renderTodo);
filtroDesde.addEventListener("change", renderTodo);
filtroHasta.addEventListener("change", renderTodo);

btnClearFecha.addEventListener("click", () => {
  filtroDesde.value = "";
  filtroHasta.value = "";
  renderTodo();
});

formVenta.addEventListener("submit", async (e) => {
  e.preventDefault();

  setMsg("");

  const sucursalId = sucursalSelect.value;
  const sucursalNombre = getSucursalNombreById(sucursalId);

  const tipoVenta = tipoVentaSelect.value;

  const kilos = Number(kilosInput.value || 0);
  const precioKilo = Number(precioKiloInput.value || 0);
  const totalPesos = Number((kilos * precioKilo).toFixed(2));

  if (!sucursalId || !tipoVenta) {
    setMsg("Completa todos los campos.");
    return;
  }

  const sucObj = sucursalesMap.get(String(sucursalId));
  if (!sucObj || sucObj.activa !== true) {
    setMsg("Esa sucursal está inactiva. Selecciona otra.");
    return;
  }

  if (kilos <= 0 || precioKilo <= 0) {
    setMsg("Kilos y precio deben ser mayor a 0.");
    return;
  }

  let empleadoId = null;
  let empleadoNombre = null;

  if (tipoVenta === "repartidor") {
    empleadoId = empleadoSelect.value;

    if (!empleadoId) {
      setMsg("Selecciona un empleado.");
      return;
    }

    const snap = await db.collection("empleados").doc(empleadoId).get();

    if (!snap.exists) {
      setMsg("El empleado no existe.");
      return;
    }

    const data = snap.data() || {};
    const rol = String(data.rol || "");

    if (rol !== "Repartidor") {
      setMsg("Ese usuario no está permitido para este tipo de venta.");
      return;
    }

    empleadoNombre = data.nombre || "Empleado";
  }

  btnGuardar.disabled = true;

  try {
    const payload = {
      sucursalId: String(sucursalId),
      sucursalNombre: String(sucursalNombre || ""),
      tipoVenta,
      empleadoId,
      empleadoNombre,
      kilos,
      precioKilo,
      totalPesos,
      pagado: false,
      fechaKey: getFechaKeyHoy(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("ventas").add(payload);

    const suc = sucursalNombre || "-";
    const emp = empleadoNombre || "Local";

    await addLog({
      accion: "crear",
      detalle: `Registró venta | Sucursal: ${suc} | Tipo: ${tipoVenta} | Empleado: ${emp} | Kilos: ${kilos} | Precio: $${precioKilo.toFixed(2)} | Total: $${totalPesos.toFixed(2)} | Estado: No pagado`
    });

    setMsg("Venta registrada (No pagado).", false);

    kilosInput.value = "";
    totalPesosInput.value = "";
    lastEditedField = null;
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

  const ok = confirm(`Se eliminarán TODOS los registros (ventas y gastos) del ${ini} al ${fin}. ¿Continuar?`);
  if (!ok) return;

  btnResetRango.disabled = true;

  try {
    const eliminadasVentas = await eliminarColeccionPorRango("ventas", ini, fin);
    const eliminadosGastos = await eliminarColeccionPorRango("gastos", ini, fin);

    await addLog({
      accion: "eliminar",
      detalle: `Eliminó registros por rango | ${ini} a ${fin} | Ventas: ${eliminadasVentas} | Gastos: ${eliminadosGastos}`
    });

    alert(`Listo. Eliminados:\nVentas: ${eliminadasVentas}\nGastos: ${eliminadosGastos}`);

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
    const snap = await db.collection("ventas").doc(deleteId).get();
    const before = snap.exists ? (snap.data() || {}) : null;

    await db.collection("ventas").doc(deleteId).delete();
    cerrarModalEliminar();

    if (before) {
      const suc = before.sucursalNombre || getSucursalNombreById(before.sucursalId);
      const emp = before.empleadoNombre || "Local";
      const total = Number(before.totalPesos || 0);

      await addLog({
        accion: "eliminar",
        detalle: `Eliminó venta | Sucursal: ${suc || "-"} | Tipo: ${before.tipoVenta || "-"} | Empleado: ${emp} | Total: $${total.toFixed(2)}`
      });
    } else {
      await addLog({
        accion: "eliminar",
        detalle: `Eliminó una venta (ID: ${deleteId}).`
      });
    }

    setMsg("Venta eliminada.", false);
  } catch (error) {
    setMsg("No se pudo eliminar. Intenta de nuevo.");
  } finally {
    btnModalEliminar.disabled = false;
  }
});

lastEditedField = "kilos";
syncCalc();
