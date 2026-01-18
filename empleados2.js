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
const filtroFecha = document.getElementById("filtroFecha");
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

function calcTotal() {
  const kilos = Number(kilosInput.value || 0);
  const precio = Number(precioKiloInput.value || 0);
  totalPesosInput.value = formatMoney(kilos * precio);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function cargarEmpleadosPorSucursal(sucursal) {
  empleadoSelect.innerHTML = `<option value="">Selecciona empleado</option>`;
  if (!sucursal) return;

  const snap = await db.collection("empleados").where("sucursal", "==", String(sucursal)).get();

  snap.forEach((doc) => {
    const data = doc.data();
    const option = document.createElement("option");
    option.value = doc.id;
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

function getVentasFiltradas() {
  const suc = filtroSucursal.value;
  const tipo = filtroTipo.value;
  const fecha = filtroFecha.value;

  let lista = [...ventasCache];

  if (suc !== "todas") {
    lista = lista.filter(v => String(v.sucursal) === String(suc));
  }

  if (tipo !== "todos") {
    lista = lista.filter(v => String(v.tipoVenta) === String(tipo));
  }

  if (fecha) {
    lista = lista.filter(v => String(v.fechaKey || "") === String(fecha));
  }

  return lista;
}

function getGastosFiltrados() {
  const suc = filtroSucursal.value;
  const fecha = filtroFecha.value;

  let lista = [...gastosCache];

  if (suc !== "todas") {
    lista = lista.filter(g => String(g.sucursal) === String(suc));
  }

  if (fecha) {
    lista = lista.filter(g => String(g.fechaKey || "") === String(fecha));
  }

  return lista;
}

function renderResumen() {
  const ventasFiltradas = getVentasFiltradas();
  const gastosFiltrados = getGastosFiltrados();

  const totalKilos = ventasFiltradas.reduce((acc, v) => acc + Number(v.kilos || 0), 0);
  const totalVentas = ventasFiltradas.reduce((acc, v) => acc + Number(v.totalPesos || 0), 0);
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

    const sucTxt = escapeHtml(v.sucursal || "-");
    const tipoTxt = escapeHtml(v.tipoVenta || "-");
    const empTxt = escapeHtml(v.empleadoNombre || "Local");

    const kilos = formatNumber(v.kilos || 0, 1);
    const precio = formatNumber(v.precioKilo || 0, 2);
    const total = formatNumber(v.totalPesos || 0, 2);

    tbodyVentas.innerHTML += `
      <tr>
        <td>${escapeHtml(fechaTxt)}</td>
        <td>${sucTxt}</td>
        <td>${tipoTxt}</td>
        <td>${empTxt}</td>
        <td>${kilos}</td>
        <td>$${precio}</td>
        <td>$${total}</td>
        <td><button class="btn-mini" data-del="${v.id}">Eliminar</button></td>
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

btnLogout.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

sucursalSelect.addEventListener("change", async () => {
  setMsg("");
  await cargarEmpleadosPorSucursal(sucursalSelect.value);
});

tipoVentaSelect.addEventListener("change", async () => {
  setMsg("");
  const tipo = tipoVentaSelect.value;

  if (tipo === "repartidor") {
    fieldEmpleado.style.display = "block";
    empleadoSelect.required = true;
    await cargarEmpleadosPorSucursal(sucursalSelect.value);
  } else {
    fieldEmpleado.style.display = "none";
    empleadoSelect.required = false;
    empleadoSelect.value = "";
  }
});

kilosInput.addEventListener("input", () => {
  setMsg("");
  calcTotal();
});

precioKiloInput.addEventListener("input", () => {
  setMsg("");
  calcTotal();
});

empleadoSelect.addEventListener("change", () => setMsg(""));

filtroSucursal.addEventListener("change", renderTodo);
filtroTipo.addEventListener("change", renderTodo);
filtroFecha.addEventListener("change", renderTodo);

btnClearFecha.addEventListener("click", () => {
  filtroFecha.value = "";
  renderTodo();
});

formVenta.addEventListener("submit", async (e) => {
  e.preventDefault();

  setMsg("");

  const sucursal = sucursalSelect.value;
  const tipoVenta = tipoVentaSelect.value;
  const kilos = Number(kilosInput.value || 0);
  const precioKilo = Number(precioKiloInput.value || 0);
  const totalPesos = kilos * precioKilo;

  if (!sucursal || !tipoVenta) {
    setMsg("Completa todos los campos.");
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

    empleadoNombre = snap.data().nombre || "Empleado";
  }

  btnGuardar.disabled = true;

  try {
    await db.collection("ventas").add({
      sucursal: String(sucursal),
      tipoVenta,
      empleadoId,
      empleadoNombre,
      kilos,
      precioKilo,
      totalPesos,
      fechaKey: new Date().toLocaleDateString("sv-SE"),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    setMsg("Venta registrada.", false);

    kilosInput.value = "";
    calcTotal();
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
    await db.collection("ventas").doc(deleteId).delete();
    cerrarModalEliminar();
    setMsg("Venta eliminada.", false);
  } catch (error) {
    setMsg("No se pudo eliminar. Intenta de nuevo.");
  } finally {
    btnModalEliminar.disabled = false;
  }
});

calcTotal();