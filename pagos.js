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
const btnLogout = document.getElementById("btnLogout");

const msg = document.getElementById("msg");

const filtroSucursalNomina = document.getElementById("filtroSucursalNomina");
const filtroRolNomina = document.getElementById("filtroRolNomina");
const semanaLunesInput = document.getElementById("semanaLunes");
const btnCrearSemana = document.getElementById("btnCrearSemana");
const btnSemanaActual = document.getElementById("btnSemanaActual");
const btnSyncSueldos = document.getElementById("btnSyncSueldos");
const btnEliminarSemana = document.getElementById("btnEliminarSemana");

const resNominaTotal = document.getElementById("resNominaTotal");
const resNominaEntre3 = document.getElementById("resNominaEntre3");
const resPendienteTotal = document.getElementById("resPendienteTotal");

const tbodyNomina = document.getElementById("tbodyNomina");

const histDesde = document.getElementById("histDesde");
const histHasta = document.getElementById("histHasta");
const btnClearHist = document.getElementById("btnClearHist");
const wrapSemanas = document.getElementById("wrapSemanas");

let msgTimer = null;

let sucursalesMap = new Map();
let empleadosCache = [];
let semanasCache = [];

let semanaActivaKey = null;
let semanaActiva = null;

const DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
const DIAS_LABEL = { lun: "Lun", mar: "Mar", mie: "Mié", jue: "Jue", vie: "Vie", sab: "Sáb", dom: "Dom" };

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

function fillSucursalSelects() {
  filtroSucursalNomina.innerHTML = `<option value="todas">Todas</option>`;

  const sucTodas = Array.from(sucursalesMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  sucTodas.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.nombre || "Sin nombre"}${s.activa ? "" : " (Inactiva)"}`;
    filtroSucursalNomina.appendChild(opt);
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

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toFechaKey(date) {
  return new Date(date).toLocaleDateString("sv-SE");
}

function getSemanaKeyByMondayKey(lunesKey) {
  return `semana_${String(lunesKey || "")}`;
}

function getSemanaLabel(lunesKey) {
  if (!lunesKey) return "-";
  const lunes = new Date(lunesKey + "T00:00:00");
  const domingo = new Date(lunes);
  domingo.setDate(domingo.getDate() + 6);

  const l = lunes.toLocaleDateString("es-MX");
  const d = domingo.toLocaleDateString("es-MX");
  return `${l} - ${d}`;
}

function buildDefaultEmpleadoSemana(emp) {
  const sueldoSemanal = Number(emp.sueldoSemanal || 0);

  const dias = {};
  DIAS.forEach((k) => {
    dias[k] = { trabajó: true, pago: 0 };
  });

  dias.dom.trabajó = false;

  return {
    empleadoId: String(emp.id),
    nombre: String(emp.nombre || "Sin nombre"),
    rol: String(emp.rol || ""),
    sucursalId: String(emp.sucursalId || ""),
    sucursalNombre: String(emp.sucursalNombre || ""),
    sueldoSemanal,
    bonos: 0,
    dias,
    semanaPagada: false
  };
}

function getEmpleadosFiltradosParaVista(empleadosSemana) {
  const suc = filtroSucursalNomina.value;
  const rol = filtroRolNomina.value;

  let lista = (empleadosSemana || []).map(e => ({ ...e }));

  if (rol !== "todos") {
    lista = lista.filter(e => String(e.rol || "") === String(rol));
  }

  if (suc !== "todas") {
    lista = lista.filter(e => {
      const r = String(e.rol || "");
      if (r === "Repartidor") return String(e.sucursalId || "") === String(suc);
      if (r === "Encargado") return String(e.sucursalId || "") === String(suc);
      return true;
    });
  }

  lista.sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));
  return lista;
}

function getDiasTrabajados(empSemana) {
  let count = 0;
  DIAS.forEach((k) => {
    if (empSemana.dias?.[k]?.trabajó === true) count++;
  });
  return count;
}

function getTotalAnticiposLunSab(empSemana) {
  let total = 0;
  ["lun", "mar", "mie", "jue", "vie", "sab"].forEach((k) => {
    total += Number(empSemana.dias?.[k]?.pago || 0);
  });
  return total;
}

function calcEmpleadoSemana(empSemana) {
  const sueldoSemanal = Number(empSemana.sueldoSemanal || 0);
  const bonos = Number(empSemana.bonos || 0);

  const diasTrabajados = getDiasTrabajados(empSemana);

  let totalPagado = 0;
  DIAS.forEach((k) => {
    const d = empSemana.dias?.[k] || {};
    const pago = Number(d.pago || 0);
    totalPagado += pago;
  });

  const totalEsperado = sueldoSemanal + bonos;
  const pendiente = Math.max(totalEsperado - totalPagado, 0);

  return { totalPagado, totalEsperado, pendiente, diasTrabajados };
}

async function guardarSemanaActiva() {
  if (!semanaActivaKey || !semanaActiva) return;

  const ref = db.collection("pagosSemanas").doc(semanaActivaKey);

  let totalNomina = 0;
  let totalPendiente = 0;

  (semanaActiva.empleados || []).forEach((e) => {
    const c = calcEmpleadoSemana(e);
    totalNomina += c.totalEsperado;
    totalPendiente += c.pendiente;
  });

  semanaActiva.totalNomina = Number(totalNomina.toFixed(2));
  semanaActiva.totalPendiente = Number(totalPendiente.toFixed(2));

  await ref.update({
    empleados: semanaActiva.empleados || [],
    totalNomina: semanaActiva.totalNomina,
    totalPendiente: semanaActiva.totalPendiente,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function crearOAbrirSemana(lunesKey) {
  if (!lunesKey) return;

  const key = getSemanaKeyByMondayKey(lunesKey);
  semanaActivaKey = key;

  const ref = db.collection("pagosSemanas").doc(key);
  const snap = await ref.get();

  if (snap.exists) {
    semanaActiva = { id: snap.id, ...(snap.data() || {}) };

    (semanaActiva.empleados || []).forEach((e) => {
      if (typeof e.semanaPagada !== "boolean") e.semanaPagada = false;

      if (!e.dias) e.dias = {};
      if (!e.dias.dom) e.dias.dom = { trabajó: false, pago: 0 };
      if (typeof e.dias.dom.trabajó !== "boolean") e.dias.dom.trabajó = false;
    });

    await guardarSemanaActiva();
    return;
  }

  const empleados = empleadosCache.map(buildDefaultEmpleadoSemana);

  const payload = {
    lunesKey: String(lunesKey),
    label: String(getSemanaLabel(lunesKey)),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    empleados,
    totalNomina: 0,
    totalPendiente: 0
  };

  await ref.set(payload);

  await addLog({
    accion: "crear",
    detalle: `Creó semana de nómina: ${payload.label}`
  });

  const nuevoSnap = await ref.get();
  semanaActiva = { id: nuevoSnap.id, ...(nuevoSnap.data() || {}) };
}

async function actualizarSueldosDesdeEmpleados() {
  if (!semanaActiva || !semanaActivaKey) return;

  const map = new Map();
  empleadosCache.forEach((e) => {
    map.set(String(e.id), e);
  });

  let cambios = 0;

  (semanaActiva.empleados || []).forEach((e) => {
    const real = map.get(String(e.empleadoId));
    if (!real) return;

    const nuevoSueldo = Number(real.sueldoSemanal || 0);

    if (Number(e.sueldoSemanal || 0) !== nuevoSueldo) {
      e.sueldoSemanal = nuevoSueldo;
      cambios++;
    }

    if (String(e.nombre || "") !== String(real.nombre || "")) e.nombre = String(real.nombre || "");
    if (String(e.rol || "") !== String(real.rol || "")) e.rol = String(real.rol || "");
    if (String(e.sucursalId || "") !== String(real.sucursalId || "")) e.sucursalId = String(real.sucursalId || "");
    if (String(e.sucursalNombre || "") !== String(real.sucursalNombre || "")) e.sucursalNombre = String(real.sucursalNombre || "");
  });

  await guardarSemanaActiva();

  await addLog({
    accion: "editar",
    detalle: `Actualizó sueldos desde empleados en semana: ${semanaActiva.label || semanaActivaKey} | Cambios: ${cambios}`
  });

  setMsg(`Sueldos actualizados (${cambios} cambios).`, false);
  renderNomina();
}

async function eliminarSemanaActiva() {
  if (!semanaActivaKey || !semanaActiva) return;

  const label = semanaActiva.label || semanaActivaKey;
  const ok = confirm(`¿Eliminar la semana "${label}"? Esta acción no se puede deshacer.`);
  if (!ok) return;

  await db.collection("pagosSemanas").doc(semanaActivaKey).delete();

  await addLog({
    accion: "eliminar",
    detalle: `Eliminó semana de nómina: ${label}`
  });

  semanaActivaKey = null;
  semanaActiva = null;

  setMsg("Semana eliminada.", false);
  tbodyNomina.innerHTML = `<tr><td colspan="14" style="padding:12px;font-weight:900;color:#555;">Semana eliminada. Crea o abre otra.</td></tr>`;
  renderResumenSemana();
}

function renderResumenSemana() {
  if (!semanaActiva) {
    resNominaTotal.textContent = formatMoney(0);
    resNominaEntre3.textContent = formatMoney(0);
    resPendienteTotal.textContent = formatMoney(0);
    return;
  }

  let totalNomina = 0;
  let totalPendiente = 0;

  (semanaActiva.empleados || []).forEach((e) => {
    const c = calcEmpleadoSemana(e);
    totalNomina += c.totalEsperado;
    totalPendiente += c.pendiente;
  });

  resNominaTotal.textContent = formatMoney(totalNomina);
  resNominaEntre3.textContent = formatMoney(totalNomina / 3);
  resPendienteTotal.textContent = formatMoney(totalPendiente);
}

function renderNomina() {
  tbodyNomina.innerHTML = "";

  if (!semanaActiva) {
    tbodyNomina.innerHTML = `<tr><td colspan="14" style="padding:12px;font-weight:900;color:#555;">Crea o abre una semana para comenzar.</td></tr>`;
    renderResumenSemana();
    return;
  }

  const empleadosVista = getEmpleadosFiltradosParaVista(semanaActiva.empleados || []);

  if (!empleadosVista.length) {
    tbodyNomina.innerHTML = `<tr><td colspan="14" style="padding:12px;font-weight:900;color:#555;">Sin colaboradores para estos filtros.</td></tr>`;
    renderResumenSemana();
    return;
  }

  empleadosVista.forEach((e) => {
    const realIdx = (semanaActiva.empleados || []).findIndex(x => String(x.empleadoId) === String(e.empleadoId));
    if (realIdx === -1) return;

    const nombre = escapeHtml(e.nombre || "");
    const rol = escapeHtml(e.rol || "");
    const sueldo = Number(e.sueldoSemanal || 0);

    const c = calcEmpleadoSemana(e);
    const diasTxt = `${c.diasTrabajados}/7`;

    let diasHtml = "";
    DIAS.forEach((k) => {
      const d = e.dias?.[k] || { trabajó: true, pago: 0 };

      const isDom = k === "dom";

      const checked = d.trabajó === true ? "checked" : "";
      const val = Number(d.pago || 0);

      const disableWork = "";
      const disablePay = (isDom && e.semanaPagada !== true) ? "disabled" : "";

      diasHtml += `
        <td>
          <div style="display:flex;flex-direction:column;gap:6px;min-width:86px;">
            <label style="display:flex;align-items:center;gap:6px;font-weight:800;font-size:.82rem;color:#333;">
              <input type="checkbox" data-work="${realIdx}|${k}" ${checked} ${disableWork} />
              ${DIAS_LABEL[k]}
            </label>
            <input type="number" min="0" step="0.01" data-pay="${realIdx}|${k}" value="${val ? String(val) : ""}" placeholder="$0" ${disablePay} style="padding:8px;border-radius:10px;border:1px solid #ddd;font-weight:800;" />
            ${isDom ? `
              <label style="display:flex;align-items:center;gap:6px;font-weight:1000;font-size:.78rem;color:${e.semanaPagada === true ? "#1f8a4c" : "#b00020"};">
                <input type="checkbox" data-semana="${realIdx}" ${e.semanaPagada === true ? "checked" : ""} />
                ${e.semanaPagada === true ? "Semana pagada" : "Pagar semana"}
              </label>
            ` : ""}
          </div>
        </td>
      `;
    });

    tbodyNomina.innerHTML += `
      <tr>
        <td style="font-weight:900;">${nombre}</td>
        <td>${rol}</td>
        <td>${formatMoney(sueldo)}</td>
        <td style="font-weight:900;">${diasTxt}</td>
        ${diasHtml}
        <td>
          <input type="number" min="0" step="0.01" data-bono="${realIdx}" value="${Number(e.bonos || 0) ? String(Number(e.bonos || 0)) : ""}" placeholder="$0" style="padding:8px;border-radius:10px;border:1px solid #ddd;font-weight:800;min-width:90px;" />
        </td>
        <td style="font-weight:900;">${formatMoney(c.totalPagado)}</td>
        <td style="font-weight:900;color:${c.pendiente > 0 ? "#b00020" : "#1f8a4c"};">${formatMoney(c.pendiente)}</td>
      </tr>
    `;
  });

  document.querySelectorAll("[data-semana]").forEach((el) => {
    el.addEventListener("change", async () => {
      const idx = Number(el.getAttribute("data-semana") || "0");
      const emp = semanaActiva.empleados?.[idx];
      if (!emp) return;

      const activar = el.checked === true;

      if (typeof emp.semanaPagada !== "boolean") emp.semanaPagada = false;
      emp.semanaPagada = activar;

      if (!emp.dias) emp.dias = {};
      if (!emp.dias.dom) emp.dias.dom = { trabajó: false, pago: 0 };

      if (!activar) {
        emp.dias.dom.trabajó = false;
        emp.dias.dom.pago = 0;
      } else {
        emp.dias.dom.trabajó = true;

        const anticipos = getTotalAnticiposLunSab(emp);
        const bonos = Number(emp.bonos || 0);
        const sueldoSemanal = Number(emp.sueldoSemanal || 0);

        const sugerido = Math.max((sueldoSemanal + bonos) - anticipos, 0);
        emp.dias.dom.pago = Number(sugerido.toFixed(2));
      }

      await guardarSemanaActiva();
      renderNomina();
    });
  });

  document.querySelectorAll("[data-work]").forEach((el) => {
    el.addEventListener("change", async () => {
      const raw = el.getAttribute("data-work") || "";
      const [idxStr, dia] = raw.split("|");
      const idx = Number(idxStr);

      const emp = semanaActiva.empleados?.[idx];
      if (!emp) return;

      const trabajó = el.checked === true;

      if (!emp.dias) emp.dias = {};
      if (!emp.dias[dia]) emp.dias[dia] = { trabajó: true, pago: 0 };

      emp.dias[dia].trabajó = trabajó;

      if (!trabajó) {
        emp.dias[dia].pago = 0;
        const inputPago = document.querySelector(`[data-pay="${idx}|${dia}"]`);
        if (inputPago) inputPago.value = "";
      }

      await guardarSemanaActiva();
      renderNomina();
    });
  });

  document.querySelectorAll("[data-pay]").forEach((el) => {
    el.addEventListener("input", async () => {
      const raw = el.getAttribute("data-pay") || "";
      const [idxStr, dia] = raw.split("|");
      const idx = Number(idxStr);

      const emp = semanaActiva.empleados?.[idx];
      if (!emp) return;

      if (dia === "dom") {
        if (emp.semanaPagada !== true) return;
      }

      const val = Number(el.value || 0);

      if (!emp.dias) emp.dias = {};
      if (!emp.dias[dia]) emp.dias[dia] = { trabajó: true, pago: 0 };

      emp.dias[dia].pago = val;

      await guardarSemanaActiva();
      renderNomina();
    });
  });

  document.querySelectorAll("[data-bono]").forEach((el) => {
    el.addEventListener("input", async () => {
      const idx = Number(el.getAttribute("data-bono") || "0");
      const emp = semanaActiva.empleados?.[idx];
      if (!emp) return;

      emp.bonos = Number(el.value || 0);

      if (emp.semanaPagada === true) {
        const anticipos = getTotalAnticiposLunSab(emp);
        const sueldoSemanal = Number(emp.sueldoSemanal || 0);
        const bonos = Number(emp.bonos || 0);
        const sugerido = Math.max((sueldoSemanal + bonos) - anticipos, 0);

        if (!emp.dias) emp.dias = {};
        if (!emp.dias.dom) emp.dias.dom = { trabajó: true, pago: 0 };
        emp.dias.dom.trabajó = true;
        emp.dias.dom.pago = Number(sugerido.toFixed(2));
      }

      await guardarSemanaActiva();
      renderNomina();
    });
  });

  renderResumenSemana();
}

function isSemanaEnRango(lunesKey, desde, hasta) {
  const f = String(lunesKey || "");
  const d = String(desde || "");
  const h = String(hasta || "");

  if (d && f < d) return false;
  if (h && f > h) return false;
  return true;
}

function renderHistorial() {
  wrapSemanas.innerHTML = "";

  const desde = histDesde.value;
  const hasta = histHasta.value;

  let lista = [...semanasCache];

  if (desde || hasta) {
    lista = lista.filter(s => isSemanaEnRango(s.lunesKey, desde, hasta));
  }

  if (!lista.length) {
    wrapSemanas.innerHTML = `<p style="margin-top:10px;font-weight:900;color:#555;">Sin semanas registradas.</p>`;
    return;
  }

  lista.sort((a, b) => String(b.lunesKey || "").localeCompare(String(a.lunesKey || "")));

  lista.forEach((s) => {
    const label = escapeHtml(s.label || getSemanaLabel(s.lunesKey));
    const total = formatMoney(Number(s.totalNomina || 0));
    const pendiente = formatMoney(Number(s.totalPendiente || 0));

    wrapSemanas.innerHTML += `
      <section class="card" style="margin-top:14px;">
        <h3 style="margin-bottom:10px;">Semana: ${label}</h3>
        <div class="actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
          <button class="btn-secondary" data-open="${escapeHtml(String(s.lunesKey || ""))}" type="button">Abrir semana</button>
        </div>
        <div class="resumen" style="margin-top:10px;">
          <div class="res-card">
            <span>Total nómina</span>
            <strong>${total}</strong>
          </div>
          <div class="res-card neto">
            <span>Pendiente total</span>
            <strong>${pendiente}</strong>
          </div>
        </div>
      </section>
    `;
  });

  document.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const lunesKey = btn.getAttribute("data-open");
      if (!lunesKey) return;
      semanaLunesInput.value = lunesKey;
      await crearOAbrirSemana(lunesKey);
      setMsg(`Semana activa: ${getSemanaLabel(lunesKey)}`, false);
      renderNomina();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function renderTodo() {
  renderNomina();
  renderHistorial();
}

async function abrirSemanaActual() {
  const hoy = new Date();
  const lunes = getMondayOfWeek(hoy);
  const lunesKey = toFechaKey(lunes);
  semanaLunesInput.value = lunesKey;
  await crearOAbrirSemana(lunesKey);
  setMsg(`Semana activa: ${getSemanaLabel(lunesKey)}`, false);
  renderNomina();
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

  db.collection("empleados")
    .orderBy("nombre", "asc")
    .onSnapshot((snapshot) => {
      empleadosCache = snapshot.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      if (!semanaActiva) renderNomina();
    });

  db.collection("pagosSemanas")
    .orderBy("lunesKey", "desc")
    .limit(200)
    .onSnapshot((snapshot) => {
      semanasCache = snapshot.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      renderHistorial();
    });

  abrirSemanaActual();
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

btnSemanaActual.addEventListener("click", async () => {
  setMsg("");
  await abrirSemanaActual();
});

btnCrearSemana.addEventListener("click", async () => {
  setMsg("");

  const lunesKey = semanaLunesInput.value;
  if (!lunesKey) {
    setMsg("Selecciona el lunes de la semana.");
    return;
  }

  await crearOAbrirSemana(lunesKey);
  setMsg(`Semana activa: ${getSemanaLabel(lunesKey)}`, false);
  renderNomina();
});

btnSyncSueldos.addEventListener("click", async () => {
  setMsg("");
  await actualizarSueldosDesdeEmpleados();
});

btnEliminarSemana.addEventListener("click", async () => {
  setMsg("");
  await eliminarSemanaActiva();
});

filtroSucursalNomina.addEventListener("change", () => {
  setMsg("");
  renderNomina();
});

filtroRolNomina.addEventListener("change", () => {
  setMsg("");
  renderNomina();
});

histDesde.addEventListener("change", renderHistorial);
histHasta.addEventListener("change", renderHistorial);

btnClearHist.addEventListener("click", () => {
  histDesde.value = "";
  histHasta.value = "";
  renderHistorial();
});
