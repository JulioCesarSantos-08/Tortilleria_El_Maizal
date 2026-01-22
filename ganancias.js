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

const filtroSucursal = document.getElementById("filtroSucursal");
const filtroFecha = document.getElementById("filtroFecha");
const btnClearFecha = document.getElementById("btnClearFecha");

const resVentas = document.getElementById("resVentas");
const resGastos = document.getElementById("resGastos");
const resNeto = document.getElementById("resNeto");
const msg = document.getElementById("msg");

const contenedorFechas = document.getElementById("contenedorFechas");
const btnExcel = document.getElementById("btnExcel");

let ventasCache = [];
let gastosCache = [];
let egresosCache = [];
let pagosCache = [];

// Cache sucursales
let sucursalesMap = new Map(); // id -> {nombre, activa}

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

function setMsg(text = "", isError = true) {
  msg.style.color = isError ? "#b00020" : "#1f8a4c";
  msg.textContent = text;
}

// ============================
// SUCURSALES DINAMICAS
// ============================

function getSucursalNombreById(id) {
  if (!id) return "-";
  const s = sucursalesMap.get(String(id));
  return s?.nombre || "-";
}

function getSucursalesActivasIds() {
  return Array.from(sucursalesMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .filter(s => s.activa === true)
    .map(s => String(s.id));
}

function fillFiltroSucursal() {
  filtroSucursal.innerHTML = `<option value="todas">Todas</option>`;

  // Mostrar todas (activas e inactivas) para consultar historial
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

      fillFiltroSucursal();
      renderTodo();
    });
}

// ============================
// UTIL: ventas pagadas
// ============================

function isVentaPagada(v) {
  // soporte por si guardaste como "pagado" o "isPaid"
  if (typeof v.pagado === "boolean") return v.pagado === true;
  if (typeof v.isPaid === "boolean") return v.isPaid === true;

  // si no existe el campo, asumimos pagado para no romper reportes viejos
  return true;
}

// ============================
// FILTROS (por sucursalId)
// ============================

function getFiltrados() {
  const suc = filtroSucursal.value; // sucursalId
  const fecha = filtroFecha.value;

  // 1) Ventas: SOLO pagadas
  let ventas = [...ventasCache].filter(isVentaPagada);

  // 2) Gastos normales
  let gastos = [...gastosCache];

  // 3) Pagos (gasto por sucursal)
  let pagos = [...pagosCache];

  // 4) Egresos globales (se reparten)
  let egresos = [...egresosCache];

  if (suc !== "todas") {
    ventas = ventas.filter(v => String(v.sucursalId || "") === String(suc));
    gastos = gastos.filter(g => String(g.sucursalId || "") === String(suc));
    pagos = pagos.filter(p => String(p.sucursalId || "") === String(suc));
    // egresos se filtra por fecha, pero reparto se hace después
  }

  if (fecha) {
    ventas = ventas.filter(v => String(v.fechaKey || "") === String(fecha));
    gastos = gastos.filter(g => String(g.fechaKey || "") === String(fecha));
    pagos = pagos.filter(p => String(p.fechaKey || "") === String(fecha));
    egresos = egresos.filter(e => String(e.fechaKey || "") === String(fecha));
  }

  // Egresos: convertirlos en "gastos" repartidos
  const egresosComoGastos = repartirEgresos(egresos, suc);

  // Pagos: convertirlos en "gastos"
  const pagosComoGastos = pagos.map((p) => ({
    id: p.id,
    fechaKey: p.fechaKey || (p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString("sv-SE") : ""),
    sucursalId: String(p.sucursalId || ""),
    sucursalNombre: p.sucursalNombre || getSucursalNombreById(p.sucursalId),
    categoria: "Trabajadores",
    descripcion: p.descripcion || p.colaboradorNombre || "Pago colaborador",
    totalPesos: Number(p.totalPagar ?? p.totalPesos ?? p.monto ?? 0),
    createdAt: p.createdAt || null,
    _tipoExtra: "pago"
  }));

  // Gastos final = gastos normales + egresos + pagos
  const gastosFinal = [...gastos, ...egresosComoGastos, ...pagosComoGastos];

  return { ventas, gastos: gastosFinal };
}

// ============================
// EGRESOS repartidos
// ============================

function repartirEgresos(egresos, sucFiltro) {
  const sucursalesActivas = getSucursalesActivasIds();
  const totalSucursales = sucursalesActivas.length || 1;

  const lista = [];

  egresos.forEach((e) => {
    const total = Number(e.totalPesos ?? e.monto ?? 0);
    if (total <= 0) return;

    const fechaKey = e.fechaKey || (e.createdAt?.toDate ? e.createdAt.toDate().toLocaleDateString("sv-SE") : "");

    // si filtras por una sucursal, solo se agrega su parte
    if (sucFiltro !== "todas") {
      lista.push({
        id: e.id,
        fechaKey,
        sucursalId: String(sucFiltro),
        sucursalNombre: getSucursalNombreById(sucFiltro),
        categoria: "EGRESO GLOBAL",
        descripcion: e.descripcion || e.concepto || "Egreso global",
        totalPesos: total / totalSucursales,
        createdAt: e.createdAt || null,
        _tipoExtra: "egreso"
      });
      return;
    }

    // si es todas, se reparte a cada sucursal activa
    sucursalesActivas.forEach((sid) => {
      lista.push({
        id: e.id,
        fechaKey,
        sucursalId: String(sid),
        sucursalNombre: getSucursalNombreById(sid),
        categoria: "EGRESO GLOBAL",
        descripcion: e.descripcion || e.concepto || "Egreso global",
        totalPesos: total / totalSucursales,
        createdAt: e.createdAt || null,
        _tipoExtra: "egreso"
      });
    });
  });

  return lista;
}

// ============================
// AGRUPADORES
// ============================

function agruparPorFecha(lista) {
  const map = {};
  lista.forEach((item) => {
    const key = item.fechaKey || "Sin fecha";
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return map;
}

function ordenarFechasAsc(keys) {
  return keys.sort((a, b) => (a > b ? 1 : -1));
}

// ============================
// RENDER
// ============================

function renderResumen(ventas, gastos) {
  const totalVentas = ventas.reduce((acc, v) => acc + Number(v.totalPesos || 0), 0);
  const totalGastos = gastos.reduce((acc, g) => acc + Number(g.totalPesos || 0), 0);
  const neto = totalVentas - totalGastos;

  resVentas.textContent = formatMoney(totalVentas);
  resGastos.textContent = formatMoney(totalGastos);
  resNeto.textContent = formatMoney(neto);
  resNeto.style.color = neto >= 0 ? "#1f8a4c" : "#b00020";
}

function renderTablasPorFecha(ventas, gastos) {
  contenedorFechas.innerHTML = "";

  const ventasPorFecha = agruparPorFecha(ventas);
  const gastosPorFecha = agruparPorFecha(gastos);

  const keys = new Set([...Object.keys(ventasPorFecha), ...Object.keys(gastosPorFecha)]);
  const fechasOrdenadas = ordenarFechasAsc([...keys]);

  if (fechasOrdenadas.length === 0) {
    contenedorFechas.innerHTML = `
      <div class="fecha-card">
        <div class="fecha-title">
          <h2>Sin registros</h2>
        </div>
        <p style="color:#555;font-weight:700;">No hay información para mostrar con estos filtros.</p>
      </div>
    `;
    return;
  }

  fechasOrdenadas.forEach((fechaKey) => {
    const vList = ventasPorFecha[fechaKey] || [];
    const gList = gastosPorFecha[fechaKey] || [];

    const totalKilos = vList.reduce((acc, x) => acc + Number(x.kilos || 0), 0);
    const totalV = vList.reduce((acc, x) => acc + Number(x.totalPesos || 0), 0);
    const totalG = gList.reduce((acc, x) => acc + Number(x.totalPesos || 0), 0);
    const neto = totalV - totalG;

    const ventasRows = vList.map((v) => {
      const tipo = escapeHtml(v.tipoVenta || "-");
      const emp = escapeHtml(v.empleadoNombre || "Local");
      const kilos = formatNumber(v.kilos || 0, 1);
      const precio = formatNumber(v.precioKilo || 0, 2);
      const total = formatNumber(v.totalPesos || 0, 2);

      const sucNombre = v.sucursalNombre || getSucursalNombreById(v.sucursalId);
      const suc = escapeHtml(sucNombre || "-");

      return `
        <tr>
          <td>${suc}</td>
          <td>${tipo}</td>
          <td>${emp}</td>
          <td>${kilos}</td>
          <td>$${precio}</td>
          <td>$${total}</td>
        </tr>
      `;
    }).join("");

    const gastosRows = gList.map((g) => {
      const sucNombre = g.sucursalNombre || getSucursalNombreById(g.sucursalId);
      const suc = escapeHtml(sucNombre || "-");

      const cat = escapeHtml(g.categoria || "-");
      const desc = escapeHtml(g.descripcion || "-");
      const total = formatNumber(g.totalPesos || 0, 2);

      return `
        <tr>
          <td>${suc}</td>
          <td>${cat}</td>
          <td>${desc}</td>
          <td>$${total}</td>
        </tr>
      `;
    }).join("");

    contenedorFechas.innerHTML += `
      <div class="fecha-card">
        <div class="fecha-title">
          <h2>${escapeHtml(fechaKey)}</h2>
          <div class="badges">
            <div class="badge">Kilos: ${formatNumber(totalKilos, 1)}</div>
            <div class="badge">Ventas: ${formatMoney(totalV)}</div>
            <div class="badge">Gastos: ${formatMoney(totalG)}</div>
            <div class="badge">Neto: ${formatMoney(neto)}</div>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th colspan="6">Ventas (solo pagadas)</th>
              </tr>
              <tr>
                <th>Sucursal</th>
                <th>Tipo</th>
                <th>Empleado</th>
                <th>Kilos</th>
                <th>$ / Kilo</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${ventasRows || `<tr><td colspan="6">Sin ventas</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th colspan="4">Gastos (incluye egresos + pagos)</th>
              </tr>
              <tr>
                <th>Sucursal</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${gastosRows || `<tr><td colspan="4">Sin gastos</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });
}

function renderTodo() {
  const { ventas, gastos } = getFiltrados();
  renderResumen(ventas, gastos);
  renderTablasPorFecha(ventas, gastos);
}

// ============================
// EXCEL PRO
// ============================

function autoFitColumns(ws, rows) {
  // calcula ancho por contenido
  const colWidths = [];
  rows.forEach((r) => {
    r.forEach((cell, i) => {
      const val = cell == null ? "" : String(cell);
      const len = val.length;
      colWidths[i] = Math.max(colWidths[i] || 10, Math.min(40, len + 2));
    });
  });
  ws["!cols"] = colWidths.map(w => ({ wch: w }));
}

function descargarExcelXLSX(ventas, gastos) {
  const map = {};

  ventas.forEach((v) => {
    const key = v.fechaKey || "Sin fecha";
    if (!map[key]) map[key] = { ventas: [], gastos: [] };
    map[key].ventas.push(v);
  });

  gastos.forEach((g) => {
    const key = g.fechaKey || "Sin fecha";
    if (!map[key]) map[key] = { ventas: [], gastos: [] };
    map[key].gastos.push(g);
  });

  const fechas = ordenarFechasAsc(Object.keys(map));
  const wb = XLSX.utils.book_new();

  // Hoja RESUMEN general
  const resumenRows = [];
  resumenRows.push(["REPORTE EL MAIZAL"]);
  resumenRows.push(["Generado", new Date().toLocaleString("es-MX")]);
  resumenRows.push([]);
  resumenRows.push(["Fecha", "Kilos", "Ventas", "Gastos", "Neto"]);

  fechas.forEach((fechaKey) => {
    const vList = map[fechaKey].ventas || [];
    const gList = map[fechaKey].gastos || [];

    const totalKilos = vList.reduce((acc, x) => acc + Number(x.kilos || 0), 0);
    const totalV = vList.reduce((acc, x) => acc + Number(x.totalPesos || 0), 0);
    const totalG = gList.reduce((acc, x) => acc + Number(x.totalPesos || 0), 0);
    const neto = totalV - totalG;

    resumenRows.push([
      fechaKey,
      totalKilos,
      totalV,
      totalG,
      neto
    ]);
  });

  resumenRows.push([]);
  const totalVentasAll = ventas.reduce((acc, x) => acc + Number(x.totalPesos || 0), 0);
  const totalGastosAll = gastos.reduce((acc, x) => acc + Number(x.totalPesos || 0), 0);
  const totalKilosAll = ventas.reduce((acc, x) => acc + Number(x.kilos || 0), 0);
  resumenRows.push(["TOTALES", totalKilosAll, totalVentasAll, totalGastosAll, totalVentasAll - totalGastosAll]);

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  autoFitColumns(wsResumen, resumenRows);
  XLSX.utils.book_append_sheet(wb, wsResumen, "RESUMEN");

  // Hojas por fecha
  fechas.forEach((fechaKey) => {
    const vList = map[fechaKey].ventas || [];
    const gList = map[fechaKey].gastos || [];

    const totalKilos = vList.reduce((acc, x) => acc + Number(x.kilos || 0), 0);
    const totalV = vList.reduce((acc, x) => acc + Number(x.totalPesos || 0), 0);
    const totalG = gList.reduce((acc, x) => acc + Number(x.totalPesos || 0), 0);
    const neto = totalV - totalG;

    const rows = [];

    rows.push(["FECHA", fechaKey]);
    rows.push(["(Ventas solo pagadas)"]);
    rows.push([]);

    rows.push(["VENTAS"]);
    rows.push(["Sucursal", "Tipo", "Empleado", "Kilos", "Precio/Kilo", "Total"]);

    vList.forEach((v) => {
      const sucNombre = v.sucursalNombre || getSucursalNombreById(v.sucursalId);

      rows.push([
        sucNombre || "",
        v.tipoVenta || "",
        v.empleadoNombre || "Local",
        Number(v.kilos || 0),
        Number(v.precioKilo || 0),
        Number(v.totalPesos || 0)
      ]);
    });

    rows.push([]);
    rows.push(["GASTOS (incluye egresos + pagos)"]);
    rows.push(["Sucursal", "Categoria", "Descripcion", "Total"]);

    gList.forEach((g) => {
      const sucNombre = g.sucursalNombre || getSucursalNombreById(g.sucursalId);

      rows.push([
        sucNombre || "",
        g.categoria || "",
        g.descripcion || "",
        Number(g.totalPesos || 0)
      ]);
    });

    rows.push([]);
    rows.push(["RESUMEN"]);
    rows.push(["Total Kilos", totalKilos]);
    rows.push(["Total Ventas", totalV]);
    rows.push(["Total Gastos", totalG]);
    rows.push(["Neto", neto]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    autoFitColumns(ws, rows);

    let sheetName = String(fechaKey);
    sheetName = sheetName.substring(0, 31);

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const fileName = `reporte_maizal_${new Date().toLocaleDateString("sv-SE")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ============================
// AUTH + LISTENERS
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

  db.collection("ventas")
    .orderBy("createdAt", "desc")
    .limit(1500)
    .onSnapshot((snapshot) => {
      ventasCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTodo();
    });

  db.collection("gastos")
    .orderBy("createdAt", "desc")
    .limit(1500)
    .onSnapshot((snapshot) => {
      gastosCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTodo();
    });

  // NUEVO: egresos globales
  db.collection("egresos")
    .orderBy("createdAt", "desc")
    .limit(1500)
    .onSnapshot((snapshot) => {
      egresosCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTodo();
    });

  // NUEVO: pagos colaboradores
  db.collection("pagos")
    .orderBy("createdAt", "desc")
    .limit(1500)
    .onSnapshot((snapshot) => {
      pagosCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTodo();
    });
});

btnBack.addEventListener("click", () => {
  window.location.href = "panel.html";
});

btnLogout.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

filtroSucursal.addEventListener("change", renderTodo);
filtroFecha.addEventListener("change", renderTodo);

btnClearFecha.addEventListener("click", () => {
  filtroFecha.value = "";
  renderTodo();
});

btnExcel.addEventListener("click", () => {
  const { ventas, gastos } = getFiltrados();
  descargarExcelXLSX(ventas, gastos);
  setMsg("Reporte exportado.", false);
});
