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
const btnGoGastos = document.getElementById("btnGoGastos");
const btnGoEgresos = document.getElementById("btnGoEgresos");
const btnGoPagos = document.getElementById("btnGoPagos");
const btnLogout = document.getElementById("btnLogout");

const formPago = document.getElementById("formPago");
const sucursalSelect = document.getElementById("sucursal");
const colaboradorSelect = document.getElementById("colaborador");
const fechaPagoInput = document.getElementById("fechaPago");

const diasInput = document.getElementById("dias");
const pagoDiaInput = document.getElementById("pagoDia");
const totalCalculadoInput = document.getElementById("totalCalculado");

const anticipoDetectadoInput = document.getElementById("anticipoDetectado");
const pendientePagarInput = document.getElementById("pendientePagar");

const msg = document.getElementById("msg");
const btnGuardar = document.getElementById("btnGuardar");

const filtroSucursal = document.getElementById("filtroSucursal");
const filtroFecha = document.getElementById("filtroFecha");
const btnClearFecha = document.getElementById("btnClearFecha");

const tbodyPagos = document.getElementById("tbodyPagos");
const resPagado = document.getElementById("resPagado");

const modalBackdrop = document.getElementById("modalBackdrop");
const btnModalCancelar = document.getElementById("btnModalCancelar");
const btnModalEliminar = document.getElementById("btnModalEliminar");

let deleteId = null;
let pagosCache = [];
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

function getFechaKeyHoy() {
  return new Date().toLocaleDateString("sv-SE");
}

async function addLog({ accion, detalle }) {
  try {
    const user = auth.currentUser;
    await db.collection("logs").add({
      modulo: "pagos",
      accion: String(accion || ""),
      detalle: String(detalle || ""),
      userEmail: String(user?.email || ""),
      fechaKey: getFechaKeyHoy(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {}
}

function getSucursalNombreById(id) {
  if (!id) return "-";
  const s = sucursalesMap.get(String(id));
  return s?.nombre || "-";
}

function fillSucursalSelects() {
  sucursalSelect.innerHTML = `<option value="">Selecciona sucursal</option>`;
  filtroSucursal.innerHTML = `<option value="todas">Todas</option>`;

  const sucActivas = Array.from(sucursalesMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .filter(s => s.activa === true)
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  sucActivas.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.nombre || "Sin nombre";
    sucursalSelect.appendChild(opt);
  });

  const sucTodas = Array.from(sucursalesMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  sucTodas.forEach((s) => {
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
      renderTodo();
    });
}

async function cargarColaboradoresPorSucursalId(sucursalId) {
  colaboradorSelect.innerHTML = `<option value="">Selecciona colaborador</option>`;
  if (!sucursalId) return;

  const snap = await db
    .collection("empleados")
    .where("sucursalId", "==", String(sucursalId))
    .get();

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = `${data.nombre || "Sin nombre"} (${data.rol || "Sin rol"})`;
    colaboradorSelect.appendChild(option);
  });
}

let lastEdited = "dias";

function getTotalCalculado() {
  const dias = Number(diasInput.value || 0);
  const pagoDia = Number(pagoDiaInput.value || 0);
  return dias * pagoDia;
}

function getDiasFromTotal(total) {
  const pagoDia = Number(pagoDiaInput.value || 0);
  if (pagoDia <= 0) return 0;
  return total / pagoDia;
}

function recalcularTotalYExtras() {
  const total = getTotalCalculado();
  totalCalculadoInput.value = total > 0 ? String(total.toFixed(2)) : "";
  recalcularAnticipoYPendiente();
}

function recalcularDiasDesdeTotal() {
  const total = Number(totalCalculadoInput.value || 0);
  const dias = getDiasFromTotal(total);
  diasInput.value = dias > 0 ? String(dias.toFixed(2)) : "";
  recalcularAnticipoYPendiente();
}

async function getAnticiposDetectados({ sucursalId, colaboradorId, fechaKey }) {
  if (!sucursalId || !colaboradorId || !fechaKey) return 0;

  const snap = await db.collection("gastos")
    .where("sucursalId", "==", String(sucursalId))
    .where("categoria", "==", "Trabajadores")
    .where("colaboradorId", "==", String(colaboradorId))
    .where("fechaKey", "==", String(fechaKey))
    .where("esAnticipo", "==", true)
    .get();

  if (snap.empty) return 0;

  let total = 0;
  snap.forEach((doc) => {
    const data = doc.data() || {};
    total += Number(data.totalPesos || 0);
  });

  return total;
}

async function recalcularAnticipoYPendiente() {
  const sucursalId = sucursalSelect.value;
  const colaboradorId = colaboradorSelect.value;
  const fechaKey = fechaPagoInput.value;

  const totalCalc = Number(totalCalculadoInput.value || 0);

  anticipoDetectadoInput.value = "Cargando...";
  pendientePagarInput.value = "Cargando...";

  try {
    const anticipo = await getAnticiposDetectados({ sucursalId, colaboradorId, fechaKey });
    const pendiente = Math.max(totalCalc - anticipo, 0);

    anticipoDetectadoInput.value = formatMoney(anticipo);
    pendientePagarInput.value = formatMoney(pendiente);
  } catch (e) {
    anticipoDetectadoInput.value = formatMoney(0);
    pendientePagarInput.value = formatMoney(totalCalc);
  }
}

function getPagosFiltrados() {
  const suc = filtroSucursal.value;
  const fecha = filtroFecha.value;

  let lista = [...pagosCache];

  if (suc !== "todas") {
    lista = lista.filter(p => String(p.sucursalId || "") === String(suc));
  }

  if (fecha) {
    lista = lista.filter(p => String(p.fechaKey || "") === String(fecha));
  }

  return lista;
}

function renderResumen() {
  const lista = getPagosFiltrados();
  const total = lista.reduce((acc, p) => acc + Number(p.pendiente || 0), 0);
  resPagado.textContent = formatMoney(total);
}

function abrirModalEliminar(id) {
  deleteId = id;
  modalBackdrop.style.display = "flex";
}

function cerrarModalEliminar() {
  deleteId = null;
  modalBackdrop.style.display = "none";
}

function renderTabla() {
  const lista = getPagosFiltrados();
  tbodyPagos.innerHTML = "";

  lista.forEach((p) => {
    const fecha = p.createdAt?.toDate ? p.createdAt.toDate() : null;
    const fechaTxt = fecha ? fecha.toLocaleString("es-MX") : "-";

    const sucNombre = p.sucursalNombre || getSucursalNombreById(p.sucursalId);
    const sucTxt = escapeHtml(sucNombre || "-");

    const colTxt = escapeHtml(p.colaboradorNombre || "-");

    const dias = formatNumber(p.dias || 0, 2);
    const pagoDia = formatNumber(p.pagoDia || 0, 2);
    const totalCalc = formatNumber(p.totalCalculado || 0, 2);
    const anticipo = formatNumber(p.anticipo || 0, 2);
    const pendiente = formatNumber(p.pendiente || 0, 2);

    tbodyPagos.innerHTML += `
      <tr>
        <td>${escapeHtml(fechaTxt)}</td>
        <td>${sucTxt}</td>
        <td>${colTxt}</td>
        <td>${dias}</td>
        <td>$${pagoDia}</td>
        <td>$${totalCalc}</td>
        <td>$${anticipo}</td>
        <td><strong>$${pendiente}</strong></td>
        <td><button class="btn-mini" data-del="${p.id}">Eliminar</button></td>
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

auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  userEmail.textContent = user.email || "Usuario";
  loading.style.display = "none";
  app.style.display = "block";

  escucharSucursales();

  db.collection("pagos")
    .orderBy("createdAt", "desc")
    .limit(1000)
    .onSnapshot((snapshot) => {
      pagosCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTodo();
    });

  const hoy = new Date().toLocaleDateString("sv-SE");
  fechaPagoInput.value = hoy;
});

btnBack.addEventListener("click", () => {
  window.location.href = "panel.html";
});

if (btnGoVentas) btnGoVentas.addEventListener("click", () => {
  window.location.href = "empleados2.html";
});

btnGoGastos.addEventListener("click", () => {
  window.location.href = "gastos.html";
});

if (btnGoEgresos) btnGoEgresos.addEventListener("click", () => {
  window.location.href = "egresos.html";
});

btnLogout.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

sucursalSelect.addEventListener("change", async () => {
  setMsg("");
  await cargarColaboradoresPorSucursalId(sucursalSelect.value);
  recalcularAnticipoYPendiente();
});

colaboradorSelect.addEventListener("change", () => {
  setMsg("");
  recalcularAnticipoYPendiente();
});

fechaPagoInput.addEventListener("change", () => {
  setMsg("");
  recalcularAnticipoYPendiente();
});

diasInput.addEventListener("input", () => {
  setMsg("");
  lastEdited = "dias";
  recalcularTotalYExtras();
});

pagoDiaInput.addEventListener("input", () => {
  setMsg("");
  if (lastEdited === "total") {
    recalcularDiasDesdeTotal();
  } else {
    recalcularTotalYExtras();
  }
});

totalCalculadoInput.addEventListener("input", () => {
  setMsg("");
  lastEdited = "total";
  recalcularDiasDesdeTotal();
});

filtroSucursal.addEventListener("change", renderTodo);
filtroFecha.addEventListener("change", renderTodo);

btnClearFecha.addEventListener("click", () => {
  filtroFecha.value = "";
  renderTodo();
});

formPago.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const sucursalId = sucursalSelect.value;
  const sucursalNombre = getSucursalNombreById(sucursalId);

  const colaboradorId = colaboradorSelect.value;
  const colaboradorNombre = colaboradorSelect.options[colaboradorSelect.selectedIndex]?.textContent || "";

  const fechaKey = fechaPagoInput.value;

  const dias = Number(diasInput.value || 0);
  const pagoDia = Number(pagoDiaInput.value || 0);
  const totalCalculado = Number(totalCalculadoInput.value || 0);

  if (!sucursalId || !colaboradorId || !fechaKey) {
    setMsg("Completa sucursal, colaborador y fecha.");
    return;
  }

  const sucObj = sucursalesMap.get(String(sucursalId));
  if (!sucObj || sucObj.activa !== true) {
    setMsg("Esa sucursal está inactiva. Selecciona otra.");
    return;
  }

  if (pagoDia <= 0 || totalCalculado <= 0) {
    setMsg("Pago por día y total deben ser mayor a 0.");
    return;
  }

  btnGuardar.disabled = true;

  try {
    const anticipo = await getAnticiposDetectados({ sucursalId, colaboradorId, fechaKey });
    const pendiente = Math.max(totalCalculado - anticipo, 0);

    await db.collection("pagos").add({
      sucursalId: String(sucursalId),
      sucursalNombre: String(sucursalNombre || ""),
      colaboradorId: String(colaboradorId),
      colaboradorNombre: String(colaboradorNombre || ""),
      fechaKey: String(fechaKey),

      dias,
      pagoDia,
      totalCalculado,
      anticipo,
      pendiente,

      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await addLog({
      accion: "crear",
      detalle: `Registró pago | Sucursal: ${sucursalNombre || sucursalId} | Colaborador: ${colaboradorNombre || colaboradorId} | Fecha: ${fechaKey} | Días: ${Number(dias).toFixed(2)} | Pago/día: $${Number(pagoDia).toFixed(2)} | Total: $${Number(totalCalculado).toFixed(2)} | Anticipo: $${Number(anticipo).toFixed(2)} | Pendiente: $${Number(pendiente).toFixed(2)}`
    });

    setMsg("Pago registrado.", false);

    diasInput.value = "";
    pagoDiaInput.value = "";
    totalCalculadoInput.value = "";
    anticipoDetectadoInput.value = formatMoney(0);
    pendientePagarInput.value = formatMoney(0);
  } catch (error) {
    setMsg("No se pudo guardar. Intenta de nuevo.");
  } finally {
    btnGuardar.disabled = false;
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
    const pagoSnap = await db.collection("pagos").doc(String(deleteId)).get();
    const before = pagoSnap.exists ? (pagoSnap.data() || {}) : null;

    await db.collection("pagos").doc(deleteId).delete();
    cerrarModalEliminar();

    if (before) {
      const sucursalNombre = before.sucursalNombre || before.sucursalId || "-";
      const colaboradorNombre = before.colaboradorNombre || before.colaboradorId || "-";
      const fechaKey = before.fechaKey || "-";

      await addLog({
        accion: "eliminar",
        detalle: `Eliminó pago | Sucursal: ${sucursalNombre} | Colaborador: ${colaboradorNombre} | Fecha: ${fechaKey} | Total: $${Number(before.totalCalculado || 0).toFixed(2)} | Anticipo: $${Number(before.anticipo || 0).toFixed(2)} | Pendiente: $${Number(before.pendiente || 0).toFixed(2)}`
      });
    } else {
      await addLog({
        accion: "eliminar",
        detalle: `Eliminó un pago (ID: ${deleteId}).`
      });
    }

    setMsg("Pago eliminado.", false);
  } catch (error) {
    setMsg("No se pudo eliminar. Intenta de nuevo.");
  } finally {
    btnModalEliminar.disabled = false;
  }
});

anticipoDetectadoInput.value = formatMoney(0);
pendientePagarInput.value = formatMoney(0);
