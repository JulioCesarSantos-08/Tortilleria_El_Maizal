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

function getSucursalNombreById(id) {
  if (!id) return "-";
  const s = sucursalesMap.get(String(id));
  return s?.nombre || "-";
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
  const dias = {};
  DIAS.forEach((k) => {
    dias[k] = { trabajó: true, pago: 0 };
  });

  return {
    empleadoId: String(emp.id),
    nombre: String(emp.nombre || "Sin nombre"),
    rol: String(emp.rol || ""),
    sucursalId: String(emp.sucursalId || ""),
    sucursalNombre: String(emp.sucursalNombre || ""),
    sueldoSemanal: Number(emp.sueldoSemanal || 0),
    bonos: 0,
    dias
  };
}

function getEmpleadosFiltradosParaNomina() {
  const suc = filtroSucursalNomina.value;
  const rol = filtroRolNomina.value;

  let lista = empleadosCache.map(e => ({ ...e }));

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

async function crearOAbrirSemana(lunesKey) {
  if (!lunesKey) return;

  const key = getSemanaKeyByMondayKey(lunesKey);
  semanaActivaKey = key;

  const ref = db.collection("pagosSemanas").doc(key);
  const snap = await ref.get();

  if (snap.exists) {
    semanaActiva = { id: snap.id, ...(snap.data() || {}) };
    return;
  }

  const empleados = getEmpleadosFiltradosParaNomina().map(buildDefaultEmpleadoSemana);

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

function calcEmpleadoSemana(empSemana) {
  const sueldoSemanal = Number(empSemana.sueldoSemanal || 0);
  const bonos = Number(empSemana.bonos || 0);

  let diasTrabajados = 0;
  DIAS.forEach((k) => {
    if (empSemana.dias?.[k]?.trabajó === true) diasTrabajados++;
  });

  const pagoPorDiaBase = sueldoSemanal > 0 ? (sueldoSemanal / 7) : 0;

  let totalPagado = 0;
  DIAS.forEach((k) => {
    const d = empSemana.dias?.[k] || {};
    const trabajó = d.trabajó === true;
    const pago = Number(d.pago || 0);
    if (trabajó) totalPagado += pago;
  });

  const totalEsperado = (pagoPorDiaBase * diasTrabajados) + bonos;
  const pendiente = Math.max(totalEsperado - totalPagado, 0);

  return { totalPagado, totalEsperado, pendiente, diasTrabajados, pagoPorDiaBase };
}

async function guardarSemanaActiva() {
  if (!semanaActivaKey || !semanaActiva) return;

  const ref = db.collection("pagosSemanas").doc(semanaActivaKey);

  const empleados = (semanaActiva.empleados || []).map(e => ({ ...e }));
  let totalNomina = 0;
  let totalPendiente = 0;

  empleados.forEach((e) => {
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

function renderResumenSemana() {
  if (!semanaActiva) {
    resNominaTotal.textContent = formatMoney(0);
    resNominaEntre3.textContent = formatMoney(0);
    resPendienteTotal.textContent = formatMoney(0);
    return;
  }

  const empleados = semanaActiva.empleados || [];

  let totalNomina = 0;
  let totalPendiente = 0;

  empleados.forEach((e) => {
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
    tbodyNomina.innerHTML = `<tr><td colspan="13" style="padding:12px;font-weight:900;color:#555;">Crea o abre una semana para comenzar.</td></tr>`;
    renderResumenSemana();
    return;
  }

  const empleados = semanaActiva.empleados || [];
  if (!empleados.length) {
    tbodyNomina.innerHTML = `<tr><td colspan="13" style="padding:12px;font-weight:900;color:#555;">Sin colaboradores en esta semana.</td></tr>`;
    renderResumenSemana();
    return;
  }

  empleados.sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

  empleados.forEach((e, idx) => {
    const nombre = escapeHtml(e.nombre || "");
    const rol = escapeHtml(e.rol || "");
    const sueldo = Number(e.sueldoSemanal || 0);

    const c = calcEmpleadoSemana(e);

    let diasHtml = "";
    DIAS.forEach((k) => {
      const d = e.dias?.[k] || { trabajó: true, pago: 0 };
      const checked = d.trabajó === true ? "checked" : "";
      const val = Number(d.pago || 0);

      diasHtml += `
        <td>
          <div style="display:flex;flex-direction:column;gap:6px;min-width:86px;">
            <label style="display:flex;align-items:center;gap:6px;font-weight:800;font-size:.82rem;color:#333;">
              <input type="checkbox" data-work="${idx}|${k}" ${checked} />
              ${DIAS_LABEL[k]}
            </label>
            <input type="number" min="0" step="0.01" data-pay="${idx}|${k}" value="${val ? String(val) : ""}" placeholder="$0" style="padding:8px;border-radius:10px;border:1px solid #ddd;font-weight:800;" />
          </div>
        </td>
      `;
    });

    tbodyNomina.innerHTML += `
      <tr>
        <td style="font-weight:900;">${nombre}</td>
        <td>${rol}</td>
        <td>${formatMoney(sueldo)}</td>
        ${diasHtml}
        <td>
          <input type="number" min="0" step="0.01" data-bono="${idx}" value="${Number(e.bonos || 0) ? String(Number(e.bonos || 0)) : ""}" placeholder="$0" style="padding:8px;border-radius:10px;border:1px solid #ddd;font-weight:800;min-width:90px;" />
        </td>
        <td style="font-weight:900;">${formatMoney(c.totalPagado)}</td>
        <td style="font-weight:900;color:${c.pendiente > 0 ? "#b00020" : "#1f8a4c"};">${formatMoney(c.pendiente)}</td>
      </tr>
    `;
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

filtroSucursalNomina.addEventListener("change", async () => {
  setMsg("");
  if (!semanaActiva) return;
  renderNomina();
});

filtroRolNomina.addEventListener("change", async () => {
  setMsg("");
  if (!semanaActiva) return;
  renderNomina();
});

histDesde.addEventListener("change", renderHistorial);
histHasta.addEventListener("change", renderHistorial);

btnClearHist.addEventListener("click", () => {
  histDesde.value = "";
  histHasta.value = "";
  renderHistorial();
});
