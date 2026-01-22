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
const btnGoPagos = document.getElementById("btnGoPagos");
const btnLogout = document.getElementById("btnLogout");

const formEgreso = document.getElementById("formEgreso");
const fechaInput = document.getElementById("fecha");
const notaInput = document.getElementById("nota");
const sucursalesCountInput = document.getElementById("sucursalesCount");
const totalGlobalInput = document.getElementById("totalGlobal");
const btnGuardar = document.getElementById("btnGuardar");
const msg = document.getElementById("msg");

const maizKilos = document.getElementById("maizKilos");
const maizPrecio = document.getElementById("maizPrecio");
const maizTotal = document.getElementById("maizTotal");

const harinaKilos = document.getElementById("harinaKilos");
const harinaPrecio = document.getElementById("harinaPrecio");
const harinaTotal = document.getElementById("harinaTotal");

const gasMonto = document.getElementById("gasMonto");
const papelMonto = document.getElementById("papelMonto");
const luzMonto = document.getElementById("luzMonto");
const rentaMonto = document.getElementById("rentaMonto");

const calcTotalTxt = document.getElementById("calcTotal");
const divisionTxt = document.getElementById("divisionTxt");

const tbodyEgresos = document.getElementById("tbodyEgresos");

const modalBackdrop = document.getElementById("modalBackdrop");
const btnModalCancelar = document.getElementById("btnModalCancelar");
const btnModalEliminar = document.getElementById("btnModalEliminar");

let sucursalesActivas = [];
let egresosCache = [];
let deleteId = null;
let deleteRefs = [];
let msgTimer = null;

let lastEditMaiz = "kilos";
let lastEditHarina = "kilos";

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

function parseMoneyInput(str) {
  const clean = String(str || "")
    .replaceAll("$", "")
    .replaceAll(",", "")
    .trim();

  const n = Number(clean);
  return isNaN(n) ? 0 : n;
}

function getTodayKey() {
  return new Date().toLocaleDateString("sv-SE");
}

function actualizarDivision(total) {
  const n = sucursalesActivas.length || 0;
  sucursalesCountInput.value = n ? String(n) : "0";

  const porSucursal = n > 0 ? total / n : 0;
  divisionTxt.textContent = formatMoney(porSucursal);
}

function calc() {
  let mk = Number(maizKilos.value || 0);
  let mp = Number(maizPrecio.value || 0);
  let mt = parseMoneyInput(maizTotal.value);

  if (mp > 0) {
    if (lastEditMaiz === "kilos") {
      mt = mk * mp;
      maizTotal.value = formatMoney(mt);
    } else {
      mk = mt / mp;
      maizKilos.value = mk ? String(Number(mk.toFixed(2))) : "";
    }
  } else {
    maizTotal.value = formatMoney(0);
  }

  let hk = Number(harinaKilos.value || 0);
  let hp = Number(harinaPrecio.value || 0);
  let ht = parseMoneyInput(harinaTotal.value);

  if (hp > 0) {
    if (lastEditHarina === "kilos") {
      ht = hk * hp;
      harinaTotal.value = formatMoney(ht);
    } else {
      hk = ht / hp;
      harinaKilos.value = hk ? String(Number(hk.toFixed(2))) : "";
    }
  } else {
    harinaTotal.value = formatMoney(0);
  }

  const g = Number(gasMonto.value || 0);
  const p = Number(papelMonto.value || 0);
  const l = Number(luzMonto.value || 0);
  const r = Number(rentaMonto.value || 0);

  const total = (mt || 0) + (ht || 0) + g + p + l + r;

  calcTotalTxt.textContent = formatMoney(total);
  totalGlobalInput.value = formatMoney(total);

  actualizarDivision(total);
}

function abrirModalEliminar(egreso) {
  deleteId = egreso.id;
  deleteRefs = Array.isArray(egreso.gastosRefs) ? egreso.gastosRefs : [];
  modalBackdrop.style.display = "flex";
}

function cerrarModalEliminar() {
  deleteId = null;
  deleteRefs = [];
  modalBackdrop.style.display = "none";
}

function renderTabla() {
  tbodyEgresos.innerHTML = "";

  if (!egresosCache.length) {
    tbodyEgresos.innerHTML = `
      <tr>
        <td colspan="6" style="color:#555;font-weight:800;">Sin egresos registrados.</td>
      </tr>
    `;
    return;
  }

  egresosCache.forEach((e) => {
    const fechaTxt = escapeHtml(e.fechaKey || "-");
    const notaTxt = escapeHtml(e.nota || "-");
    const totalTxt = "$" + formatNumber(e.totalGlobal || 0, 2);

    const n = Number(e.sucursalesCount || 0);
    const div = n > 0 ? (Number(e.totalGlobal || 0) / n) : 0;
    const divTxt = "$" + formatNumber(div, 2);

    tbodyEgresos.innerHTML += `
      <tr>
        <td>${fechaTxt}</td>
        <td>${notaTxt}</td>
        <td>${totalTxt}</td>
        <td>${escapeHtml(String(n || 0))}</td>
        <td>${divTxt}</td>
        <td><button class="btn-mini" data-del="${escapeHtml(e.id)}">Eliminar</button></td>
      </tr>
    `;
  });

  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      const egreso = egresosCache.find(x => String(x.id) === String(id));
      if (!egreso) return;
      abrirModalEliminar(egreso);
    });
  });
}

async function escucharSucursalesActivas() {
  db.collection("sucursales")
    .where("activa", "==", true)
    .onSnapshot((snapshot) => {
      sucursalesActivas = snapshot.docs.map(d => ({
        id: d.id,
        nombre: (d.data() || {}).nombre || "Sin nombre"
      }));
      calc();
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

  fechaInput.value = getTodayKey();

  escucharSucursalesActivas();

  db.collection("egresos")
    .orderBy("createdAt", "desc")
    .limit(30)
    .onSnapshot((snapshot) => {
      egresosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTabla();
    });

  calc();
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

if (btnGoPagos) btnGoPagos.addEventListener("click", () => {
  window.location.href = "pagos.html";
});

btnLogout.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

maizKilos.addEventListener("input", () => lastEditMaiz = "kilos");
maizTotal.addEventListener("input", () => lastEditMaiz = "total");

harinaKilos.addEventListener("input", () => lastEditHarina = "kilos");
harinaTotal.addEventListener("input", () => lastEditHarina = "total");

[
  maizKilos, maizPrecio, maizTotal,
  harinaKilos, harinaPrecio, harinaTotal,
  gasMonto, papelMonto, luzMonto, rentaMonto
].forEach((el) => {
  el.addEventListener("input", () => {
    setMsg("");
    calc();
  });
});

formEgreso.addEventListener("submit", async (e) => {
  e.preventDefault();

  setMsg("");

  const fechaKey = fechaInput.value;
  const nota = notaInput.value.trim();

  const totalGlobal = parseMoneyInput(totalGlobalInput.value);

  if (!fechaKey || !nota) {
    setMsg("Completa fecha y nota.");
    return;
  }

  if (totalGlobal <= 0) {
    setMsg("El total debe ser mayor a 0.");
    return;
  }

  if (!sucursalesActivas.length) {
    setMsg("No hay sucursales activas para dividir.");
    return;
  }

  const porSucursal = totalGlobal / sucursalesActivas.length;

  btnGuardar.disabled = true;

  try {
    const batch = db.batch();
    const gastosRefs = [];

    sucursalesActivas.forEach((s) => {
      const ref = db.collection("gastos").doc();
      gastosRefs.push(ref.id);

      batch.set(ref, {
        sucursalId: String(s.id),
        sucursalNombre: String(s.nombre || ""),
        categoria: "Otros",
        descripcion: `Egreso global dividido: ${nota}`,
        totalPesos: Number(porSucursal.toFixed(2)),
        fechaKey: String(fechaKey),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        egresoGlobal: true
      });
    });

    const egresoRef = db.collection("egresos").doc();

    batch.set(egresoRef, {
      fechaKey: String(fechaKey),
      nota: String(nota),
      totalGlobal: Number(totalGlobal.toFixed(2)),
      sucursalesCount: sucursalesActivas.length,
      division: Number(porSucursal.toFixed(2)),
      detalles: {
        maizKilos: Number(maizKilos.value || 0),
        maizPrecio: Number(maizPrecio.value || 0),
        maizTotal: parseMoneyInput(maizTotal.value),

        harinaKilos: Number(harinaKilos.value || 0),
        harinaPrecio: Number(harinaPrecio.value || 0),
        harinaTotal: parseMoneyInput(harinaTotal.value),

        gas: Number(gasMonto.value || 0),
        papel: Number(papelMonto.value || 0),
        luz: Number(luzMonto.value || 0),
        renta: Number(rentaMonto.value || 0)
      },
      gastosRefs,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    setMsg("Egreso guardado y dividido entre sucursales.", false);

    notaInput.value = "";
    maizKilos.value = "";
    maizTotal.value = "";
    harinaKilos.value = "";
    harinaTotal.value = "";
    gasMonto.value = "";
    papelMonto.value = "";
    luzMonto.value = "";
    rentaMonto.value = "";

    fechaInput.value = getTodayKey();
    lastEditMaiz = "kilos";
    lastEditHarina = "kilos";
    calc();
  } catch (err) {
    setMsg("No se pudo guardar el egreso. Intenta de nuevo.");
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

  const ok = confirm("Se eliminará el egreso y los gastos divididos. ¿Continuar?");
  if (!ok) return;

  btnModalEliminar.disabled = true;

  try {
    const batch = db.batch();

    deleteRefs.forEach((gid) => {
      const ref = db.collection("gastos").doc(String(gid));
      batch.delete(ref);
    });

    batch.delete(db.collection("egresos").doc(String(deleteId)));

    await batch.commit();

    cerrarModalEliminar();
    setMsg("Egreso eliminado.", false);
  } catch (e) {
    setMsg("No se pudo eliminar.");
  } finally {
    btnModalEliminar.disabled = false;
  }
});