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
const resTotalPagado = document.getElementById("resTotalPagado");
const resPagadoEntre7 = document.getElementById("resPagadoEntre7");

const tbodyNomina = document.getElementById("tbodyNomina");

const histDesde = document.getElementById("histDesde");
const histHasta = document.getElementById("histHasta");
const btnClearHist = document.getElementById("btnClearHist");
const wrapSemanas = document.getElementById("wrapSemanas");

let empleadosCache = [];
let semanasCache = [];
let semanaActivaKey = null;
let semanaActiva = null;

function formatMoney(n) {
  return "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function round2(n) {
  return Number(Number(n || 0).toFixed(2));
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

function getSemanaKey(lunesKey) {
  return "semana_" + lunesKey;
}

function getSemanaLabel(lunesKey) {
  const l = new Date(lunesKey + "T00:00:00");
  const d = new Date(l);
  d.setDate(d.getDate() + 6);
  return l.toLocaleDateString("es-MX") + " - " + d.toLocaleDateString("es-MX");
}

function buildEmpleadoSemana(emp) {
  return {
    empleadoId: emp.id,
    nombre: emp.nombre || "",
    rol: emp.rol || "",
    sucursalId: emp.sucursalId || "",
    sueldoSemanal: Number(emp.sueldoSemanal || 0),
    diasTrabajados: 7,
    bonos: 0,
    semanaPagada: false
  };
}

function calcEmpleado(emp) {
  const base = (emp.sueldoSemanal / 7) * emp.diasTrabajados;
  const total = round2(base + emp.bonos);
  return {
    totalPagado: emp.semanaPagada ? total : 0,
    pendiente: emp.semanaPagada ? 0 : total,
    total
  };
}

function calcTotales() {
  let totalNomina = 0;
  let totalPendiente = 0;
  let totalPagado = 0;

  semanaActiva.empleados.forEach(e => {
    const c = calcEmpleado(e);
    totalNomina += c.total;
    totalPendiente += c.pendiente;
    totalPagado += c.totalPagado;
  });

  return {
    totalNomina: round2(totalNomina),
    totalPendiente: round2(totalPendiente),
    totalPagado: round2(totalPagado),
    pagadoEntre7: round2(totalPagado / 7)
  };
}

async function guardarSemana() {
  const t = calcTotales();
  semanaActiva.totalNomina = t.totalNomina;
  semanaActiva.totalPendiente = t.totalPendiente;

  await db.collection("pagosSemanas").doc(semanaActivaKey).update({
    empleados: semanaActiva.empleados,
    totalNomina: t.totalNomina,
    totalPendiente: t.totalPendiente,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function crearOAbrirSemana(lunesKey) {
  const key = getSemanaKey(lunesKey);
  semanaActivaKey = key;

  const ref = db.collection("pagosSemanas").doc(key);
  const snap = await ref.get();

  if (snap.exists) {
    semanaActiva = snap.data();
    return;
  }

  const empleados = empleadosCache
    .filter(e => e.rol === "Colaborador" || e.rol === "Encargado")
    .map(buildEmpleadoSemana);

  semanaActiva = {
    lunesKey,
    label: getSemanaLabel(lunesKey),
    empleados,
    totalNomina: 0,
    totalPendiente: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  await ref.set(semanaActiva);
}

function renderNomina() {
  tbodyNomina.innerHTML = "";
  if (!semanaActiva) return;

  const empleadosVista = semanaActiva.empleados.filter(e => {
    if (filtroRolNomina.value !== "todos" && e.rol !== filtroRolNomina.value) return false;
    if (filtroSucursalNomina.value !== "todas" && e.sucursalId !== filtroSucursalNomina.value) return false;
    return true;
  });

  if (!empleadosVista.length) {
    tbodyNomina.innerHTML = `<tr><td colspan="9">Sin colaboradores para estos filtros.</td></tr>`;
    return;
  }

  empleadosVista.forEach((e, idx) => {
    const c = calcEmpleado(e);

    tbodyNomina.innerHTML += `
      <tr>
        <td><strong>${e.nombre}</strong></td>
        <td>${e.rol}</td>
        <td>${formatMoney(e.sueldoSemanal)}</td>
        <td><input type="number" step="0.1" min="0" max="7" value="${e.diasTrabajados}" data-dias="${idx}"></td>
        <td><input type="number" step="0.01" value="${e.bonos}" data-bono="${idx}"></td>
        <td>${formatMoney(c.totalPagado)}</td>
        <td style="color:${c.pendiente > 0 ? "#b00020" : "#1f8a4c"}">${formatMoney(c.pendiente)}</td>
        <td>
          <button data-pagada="${idx}" style="background:${e.semanaPagada ? "#1f8a4c" : "#b00020"};color:#fff;border:none;padding:6px 10px;border-radius:10px;">
            ${e.semanaPagada ? "Semana pagada" : "Semana no pagada"}
          </button>
        </td>
      </tr>
    `;
  });

  document.querySelectorAll("[data-dias]").forEach(el => {
    el.oninput = async () => {
      semanaActiva.empleados[el.dataset.dias].diasTrabajados = Number(el.value || 0);
      await guardarSemana();
      renderNomina();
    };
  });

  document.querySelectorAll("[data-bono]").forEach(el => {
    el.oninput = async () => {
      semanaActiva.empleados[el.dataset.bono].bonos = Number(el.value || 0);
      await guardarSemana();
      renderNomina();
    };
  });

  document.querySelectorAll("[data-pagada]").forEach(btn => {
    btn.onclick = async () => {
      const i = btn.dataset.pagada;
      semanaActiva.empleados[i].semanaPagada = !semanaActiva.empleados[i].semanaPagada;
      await guardarSemana();
      renderNomina();
    };
  });

  const t = calcTotales();
  resNominaTotal.textContent = formatMoney(t.totalNomina);
  resNominaEntre3.textContent = formatMoney(t.totalNomina / 3);
  resPendienteTotal.textContent = formatMoney(t.totalPendiente);
  resTotalPagado.textContent = formatMoney(t.totalPagado);
  resPagadoEntre7.textContent = formatMoney(t.pagadoEntre7);
}

function renderHistorial() {
  wrapSemanas.innerHTML = "";

  semanasCache.forEach(s => {
    wrapSemanas.innerHTML += `
      <section class="card">
        <h3>Semana: ${s.label}</h3>
        <button data-open="${s.lunesKey}">Abrir semana</button>
      </section>
    `;
  });

  document.querySelectorAll("[data-open]").forEach(b => {
    b.onclick = async () => {
      semanaLunesInput.value = b.dataset.open;
      await crearOAbrirSemana(b.dataset.open);
      renderNomina();
    };
  });
}

auth.onAuthStateChanged(async user => {
  if (!user) return location.href = "index.html";

  userEmail.textContent = user.email;
  loading.style.display = "none";
  app.style.display = "block";

  db.collection("empleados").onSnapshot(async s => {
    empleadosCache = s.docs.map(d => ({ id: d.id, ...d.data() }));
    const lunes = toFechaKey(getMondayOfWeek(new Date()));
    semanaLunesInput.value = lunes;
    await crearOAbrirSemana(lunes);
    renderNomina();
  });

  db.collection("pagosSemanas").orderBy("lunesKey", "desc").onSnapshot(s => {
    semanasCache = s.docs.map(d => d.data());
    renderHistorial();
  });
});

btnBack.onclick = () => location.href = "panel.html";
btnGoVentas.onclick = () => location.href = "empleados2.html";
btnGoGastos.onclick = () => location.href = "gastos.html";
btnGoEgresos.onclick = () => location.href = "egresos.html";
btnLogout.onclick = async () => { await auth.signOut(); location.href = "index.html"; };

btnSemanaActual.onclick = async () => {
  const lunes = toFechaKey(getMondayOfWeek(new Date()));
  semanaLunesInput.value = lunes;
  await crearOAbrirSemana(lunes);
  renderNomina();
};

btnCrearSemana.onclick = async () => {
  if (!semanaLunesInput.value) return;
  await crearOAbrirSemana(semanaLunesInput.value);
  renderNomina();
};

btnEliminarSemana.onclick = async () => {
  if (!semanaActivaKey) return;
  await db.collection("pagosSemanas").doc(semanaActivaKey).delete();
  semanaActiva = null;
  tbodyNomina.innerHTML = "";
};

filtroSucursalNomina.onchange = renderNomina;
filtroRolNomina.onchange = renderNomina;
