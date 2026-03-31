/* ==========================================================================
   1. CONFIGURACIÓN, SESIÓN Y VARIABLES GLOBALES
   ========================================================================== */

const API = "https://backend-gastos-definitivo-production.up.railway.app/api";

const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
const userName = localStorage.getItem("userName");

// 🚀 MAGIA ANTI-ERRORES: Comprobamos si la sesión es nula o dice "undefined" literalmente
if (!token || !userId || token === "undefined" || userId === "undefined" || token === "null") {
    localStorage.clear(); // Limpiamos cualquier basura guardada
    window.location.replace("login.html");
}

// Crear objeto usuario
let user = {
    id: Number(userId),
    nombre: userName !== "undefined" ? userName : "Usuario"
};

// --- VARIABLES GLOBALES ---
let miGrafico = null; 
let globalGastos = [];
let globalIngresos = [];
let globalTarjetas = []; 
let globalBilleteras = []; 
let gastoEnEdicion = null; 
let saldosOcultos = true; 
let saldosNetoOcultos = true;
let saldosTarjetasOcultos = true;
let saldosAhorrosOcultos = true; 

window.saldosActuales = {};


/* ==========================================================================
   2. FUNCIONES UTILITARIAS (Helpers, Auth, Formateo, Colores)
   ========================================================================== */

function authHeaders() {
  return { 
    "Content-Type": "application/json", 
    "Authorization": `Bearer ${token}` 
  };
}

function handleAuthError(res) {
    if (res.status === 401 || res.status === 403) {
        localStorage.clear(); 
        window.location.replace("login.html"); 
        throw new Error("Sesión expirada");
    }
}

function formatoMoneda(valor) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(valor);
}

function getBgColor(color) {
    const m = {
        naranja: "linear-gradient(135deg, #f97316 0%, #7c2d12 100%)",
        azul: "linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)",
        violeta: "linear-gradient(135deg, #8b5cf6 0%, #4c1d95 100%)",
        celeste: "linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)",
        verde: "linear-gradient(135deg, #22c55e 0%, #166534 100%)",
        bna: "linear-gradient(135deg, #2ac9bb 0%, #0f766e 100%)",
        rojo: "linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)",
        uala: "linear-gradient(135deg, #ef4444 0%, #cbd5e1 100%)",
        amarillo: "linear-gradient(135deg, #f59e0b 0%, #92400e 100%)",
        emerald: "linear-gradient(135deg, #10b981 0%, #065f46 100%)",
        fuchsia: "linear-gradient(135deg, #d946ef 0%, #701a75 100%)",
        indigo: "linear-gradient(135deg, #6366f1 0%, #312e81 100%)",
        sky: "linear-gradient(135deg, #06b6d4 0%, #155e75 100%)",
        rose: "linear-gradient(135deg, #f43f5e 0%, #881337 100%)",
        negro: "linear-gradient(135deg, #262626 0%, #000000 100%)",
        darkly: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
    };
    return m[color] || m['darkly'];
}

function cargarSelectorFechas() {
	const selectMes = document.getElementById("filtroMes");
	const selectAnio = document.getElementById("filtroAnio");
	if (!selectMes || !selectAnio) return;

	const meses = [
        { val: "01", text: "Enero" }, { val: "02", text: "Febrero" }, { val: "03", text: "Marzo" },
        { val: "04", text: "Abril" }, { val: "05", text: "Mayo" }, { val: "06", text: "Junio" },
        { val: "07", text: "Julio" }, { val: "08", text: "Agosto" }, { val: "09", text: "Septiembre" },
        { val: "10", text: "Octubre" }, { val: "11", text: "Noviembre" }, { val: "12", text: "Diciembre" }
	];

	const hoy = new Date();
	const anioActual = hoy.getFullYear();
	const anios = [anioActual - 1, anioActual, anioActual + 1, anioActual + 2, anioActual + 3];

	selectMes.innerHTML = "";
	meses.forEach(m => {
        const option = document.createElement("option");
        option.value = m.val;
        option.textContent = m.text;
        selectMes.appendChild(option);
	});

	selectAnio.innerHTML = "";
	anios.forEach(a => {
        const option = document.createElement("option");
        option.value = a;
        option.textContent = a;
        selectAnio.appendChild(option);
	});

	const mesActualStr = String(hoy.getMonth() + 1).padStart(2, '0');
	selectMes.value = mesActualStr;
	selectAnio.value = anioActual;

	selectMes.onchange = () => refreshAll();
	selectAnio.onchange = () => refreshAll();
}


/* ==========================================================================
   3. LLAMADAS A LA API (Fetch Data)
   ========================================================================== */

async function fetchUserInfo() {
  try {
    const res = await fetch(`${API}/usuarios/me`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Token inválido");
    handleAuthError(res);
    user = await res.json();
    
    const emailDiv = document.getElementById("userEmail");
    if(emailDiv) {
        emailDiv.textContent = "👤 " + (user.email || user.nombre || "Usuario");
        emailDiv.style.color = "#ffce56"; 
        emailDiv.style.fontWeight = "bold";
    }
  } catch (e) { 
    localStorage.clear();
    window.location.replace("login.html"); 
  }
}

async function fetchCategorias() { 
    try { 
        const res = await fetch(`${API}/categorias/usuario/${user.id}`, { headers: authHeaders() }); 
        handleAuthError(res);
        const misCategorias = await res.json();
        renderCategorias(misCategorias); 
        return misCategorias; 
    } catch (e) { return []; } 
}

async function fetchGastos() { 
    const res = await fetch(`${API}/gastos/usuario/${user.id}`, { headers: authHeaders() }); 
    handleAuthError(res);
    globalGastos = await res.json(); 
    return globalGastos; 
}

async function fetchIngresos() { 
    const res = await fetch(`${API}/ingresos/usuario/${user.id}`, { headers: authHeaders() }); 
    handleAuthError(res);
    globalIngresos = await res.json(); 
    return globalIngresos; 
}

async function fetchPrestamos() {
    try {
        const res = await fetch(`${API}/prestamos/usuario/${user.id}`, { headers: authHeaders() });
        if(!res.ok) return [];
        return await res.json();
    } catch(e) { return []; }
}

async function fetchBilleteras() {
    try {
        const res = await fetch(`${API}/billeteras/usuario/${user.id}`, { headers: authHeaders() });
        if(!res.ok) return [];
        return await res.json();
    } catch(e) { return []; }
}

async function fetchYRenderizarMisTarjetas() {
    try {
        const res = await fetch(`${API}/tarjetas/usuario/${user.id}?t=${Date.now()}`, { headers: authHeaders() });
        if (!res.ok) throw new Error("Error trayendo tarjetas");
        
        globalTarjetas = await res.json();
        const contenedor = document.getElementById("contenedorMisTarjetas");
        if (!contenedor) return;
        contenedor.innerHTML = ""; 
        
        if (globalTarjetas.length === 0) {
            contenedor.innerHTML = `<p style="color: #888; text-align: center; width: 100%;">No tenés tarjetas de crédito guardadas.</p>`;
            return;
        }
        
        globalTarjetas.forEach(t => {
            const montoAMostrar = saldosTarjetasOcultos ? "••••••" : "$0,00";
            contenedor.innerHTML += `
            <div class="card" style="background: ${getBgColor(t.color)}; border: none; position: relative; overflow: hidden; padding-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                <div style="position: absolute; right: -20px; top: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.05); border-radius: 50%;"></div>
                <button onclick="eliminarMiTarjeta(${t.id})" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.3); border: none; color: white; padding: 6px 8px; border-radius: 50%; cursor: pointer; font-size: 1rem;" title="Eliminar tarjeta">🗑️</button>
                <h3 style="color: #ffffff; display: flex; justify-content: space-between; align-items: center; border-bottom: none; margin-right: 30px; margin-top: 10px; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px;">${t.nombre}</h3>
                <p style="color: rgba(255,255,255,0.7); margin: 15px 0 0 0; font-size: 0.85rem;">A pagar este mes:</p>
                <h2 id="monto-tarjeta-${t.id}" style="color: #ffffff; margin: 2px 0 0 0; font-size: 1.8rem; font-weight: bold;">${montoAMostrar}</h2>
            </div>`;
        });
    } catch (error) {
        console.error("Error cargando tarjetas", error);
    }
}


/* ==========================================================================
   4. RENDERIZADO DE INTERFAZ (Listas, Gráficos, Tablas)
   ========================================================================== */

function generarGrafico(gastos) {
  const canvas = document.getElementById('gastosChart');
  if (!canvas) return;
  if (miGrafico) { 
      miGrafico.destroy(); 
      miGrafico = null; 
  }
  const ctx = canvas.getContext('2d');
  const datosAgrupados = {};
  
  const nombresBilleteras = ["BNA", "MERCADO PAGO", "EFECTIVO", "MERCADO_PAGO", "PENDIENTE", "MÚLTIPLES"];
  globalBilleteras.forEach(b => nombresBilleteras.push(b.nombre.toUpperCase()));

  gastos.forEach(g => {
    let cat = g.categoriaNombre;
    if (!cat || cat === "" || cat === "Sin categoría") {
        const medio = (g.medioPago || "").toUpperCase();
        const esTarjeta = !nombresBilleteras.includes(medio) && medio !== "";
        if (esTarjeta) {
            const esDolar = g.isUSD || (g.descripcion && g.descripcion.includes("[USD]"));
            cat = esDolar ? "💳 Tarjetas (Dólares)" : "💳 Tarjetas (Pesos)";
        } else {
            cat = "Sin categoría";
        }
    }
    datosAgrupados[cat] = (datosAgrupados[cat] || 0) + (Number(g.monto) || 0);
  });

  const coloresFinancieros = [
      '#1e3a8a', '#0284c7', '#0f766e', '#d97706', 
      '#64748b', '#b91c1c', '#4338ca', '#a16207',
      '#ffce56', '#2ac9bb'
  ];

  miGrafico = new Chart(ctx, {
    type: 'doughnut', 
    data: {
      labels: Object.keys(datosAgrupados),
      datasets: [{
        data: Object.values(datosAgrupados),
        backgroundColor: coloresFinancieros,
        borderWidth: 2, 
        borderColor: '#ffffff', 
        hoverOffset: 8,
        borderRadius: 0 
      }]
    },
    options: { 
        responsive: true, 
        maintainAspectRatio: false,
        layout: { padding: 10 },
        cutout: '75%', 
        plugins: { 
            legend: { 
                position: 'right', 
                labels: { 
                    color: '#334155', padding: 15,
                    usePointStyle: true, pointStyle: 'rect',
                    font: { size: 13, family: "'Segoe UI', Arial, sans-serif", weight: 'bold' }
                } 
            },
            tooltip: {
                backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#f8fafc',
                padding: 12, cornerRadius: 4,
                callbacks: {
                    label: function(context) {
                        let valor = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(context.raw);
                        let total = context.dataset.data.reduce((a, b) => a + b, 0);
                        let porcentaje = ((context.raw / total) * 100).toFixed(1);
                        return ` ${valor} (${porcentaje}%)`;
                    }
                }
            }
        } 
    }
  });
}

function renderCategorias(categorias) {
  categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));
  const contadorEl = document.getElementById("countCategorias");
  if (contadorEl) contadorEl.textContent = categorias.length;

  const gSelect = document.getElementById("gastoCategoria");
  const iSelect = document.getElementById("ingresoCategoria");
  const tSelect = document.getElementById("tarjetaCategoria"); 
  const eSelect = document.getElementById("editCuotaCategoria"); 
  const filtroSel = document.getElementById("filtroCategoriaSelect");
  const listaCat = document.getElementById("listaCategoriasGestion");
  
  [gSelect, iSelect, tSelect, eSelect, filtroSel].forEach(select => {
    if (!select) return;
    const valPrevio = select.value;
    select.innerHTML = select === filtroSel 
      ? '<option value="all">Mostrar todas</option>' 
      : '<option value="">Sin categoría</option>';
    categorias.forEach(cat => { 
        const opt = document.createElement("option"); 
        opt.value = cat.id; opt.textContent = cat.nombre; 
        select.appendChild(opt); 
    });
    if(valPrevio) select.value = valPrevio;
  });

  if (filtroSel) filtroSel.onchange = () => refreshAll();

  if (listaCat) {
      listaCat.innerHTML = "";
      categorias.forEach(cat => {
          listaCat.innerHTML += `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 5px;">
              <span>${cat.nombre}</span>
              <button onclick="eliminarCategoria(${cat.id})" class="btn-delete" style="padding: 2px 6px; background: none; border: none; cursor: pointer; font-size: 1.2rem;">🗑️</button>
          </div>`;
      });
  }
}

function renderGastosFijos(lista) {
  const tbody = document.querySelector("#tablaGastosFijos tbody");
  if (!tbody) return; 
  tbody.innerHTML = "";
  
  let total = 0;
  let pagado = 0;
  let faltaPagar = 0;

  lista.forEach(g => {
    const montoNum = Number(g.monto) || 0;
    total += montoNum;
    
    if (g.pagado) {
        pagado += montoNum;
    } else {
        faltaPagar += montoNum;
    }
    
    let acciones = "";
    let estadoPagado = "";
    let fechaPagoReal = "-";
    let medioPagoReal = "-";

    if (g.esVirtual) {
        acciones = `<span style="font-size: 0.8rem; background: var(--bg-saldos); padding: 4px 8px; border-radius: 5px; color: #888;">Automático</span>`;
        estadoPagado = "-";
        medioPagoReal = g.medioPago || "MÚLTIPLES";
    } else {
        acciones = `
            <button onclick="editarGasto(${g.id})" class="btn-edit" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; margin-right: 5px;" title="Editar">✏️</button>
            <button onclick="eliminarGasto(${g.id})" class="btn-delete" style="background: none; border: none; cursor: pointer; font-size: 1.1rem;" title="Eliminar">🗑️</button>
        `;
        
        if (g.pagado) {
            estadoPagado = `<span style="color: #2ac9bb;">✅ Sí</span>`;
            fechaPagoReal = g.fecha || "-";
            medioPagoReal = g.medioPago || "EFECTIVO";
        } else {
            estadoPagado = `<input type="checkbox" style="width: 18px; height: 18px; cursor: pointer; accent-color: #2ac9bb;" onclick="event.preventDefault(); abrirModalPago(${g.id})" title="Tildar para pagar">`;
            fechaPagoReal = "-";
            medioPagoReal = `<span style="color: #888;">Pendiente</span>`;
        }
    }

    const vto = g.fechaVencimiento ? g.fechaVencimiento : "-";
    let esDolar = g.isUSD || (g.descripcion && g.descripcion.includes("[USD]"));
    let textoMonto = esDolar ? `<span style="color:#059669;">USD ${montoNum.toFixed(2)}</span>` : formatoMoneda(montoNum);

    tbody.innerHTML += `<tr>
        <td>${g.descripcion||"-"}</td>
        <td class="monto-gasto">${textoMonto}</td>
        <td>${vto}</td>
        <td><span style="${g.esVirtual ? 'color: #00aae4; font-weight: bold;' : ''}">${g.categoriaNombre||"-"}</span></td>
        <td>${estadoPagado}</td>
        <td>${fechaPagoReal}</td>
        <td>${medioPagoReal}</td>
        <td>${acciones}</td>
    </tr>`;
  });

  if (document.getElementById("totalFijos")) document.getElementById("totalFijos").textContent = formatoMoneda(total);
  if (document.getElementById("totalFijosPagado")) document.getElementById("totalFijosPagado").textContent = formatoMoneda(pagado);
  if (document.getElementById("totalFijosFalta")) document.getElementById("totalFijosFalta").textContent = formatoMoneda(faltaPagar);
}

function renderGastosVariables(lista) {
  const tbody = document.querySelector("#tablaGastosVariables tbody");
  if (!tbody) return; 
  tbody.innerHTML = "";
  let total = 0;
  
  // MAGIA 1: Ordenar por Fecha (De más antiguo a más nuevo)
  lista.sort((a, b) => {
      let fechaA = new Date(a.fecha || a.fechaVencimiento || 0);
      let fechaB = new Date(b.fecha || b.fechaVencimiento || 0);
      return fechaA - fechaB;
  });
  
  lista.forEach(g => {
    total += (Number(g.monto) || 0);
    const acciones = `
        <button onclick="editarGasto(${g.id})" class="btn-edit" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; margin-right: 5px;" title="Editar">✏️</button>
        <button onclick="eliminarGasto(${g.id})" class="btn-delete" style="background: none; border: none; cursor: pointer; font-size: 1.1rem;" title="Eliminar">🗑️</button>
    `;
    
    // MAGIA 2: Solo tomamos la fecha real de pago y simplificamos
    const fechaPagoReal = g.fecha || g.fechaVencimiento || "-";
    const medioPagoReal = g.medioPago || "EFECTIVO";

    tbody.innerHTML += `<tr>
        <td style="color: #64748b; font-weight: 600;">${fechaPagoReal}</td>
        <td style="font-weight: bold; color: #334155;">${g.descripcion||"-"}</td>
        <td><span style="background: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem;">${g.categoriaNombre||"-"}</span></td>
        <td><span style="color: #00aae4; font-weight: bold; font-size: 0.85rem;">${medioPagoReal}</span></td>
        <td class="monto-gasto">${formatoMoneda(g.monto)}</td>
        <td>${acciones}</td>
    </tr>`;
  });
  
  if (document.getElementById("totalVariables")) {
      document.getElementById("totalVariables").textContent = formatoMoneda(total);
  }
}

function renderIngresos(ingresos) {
  const tbody = document.querySelector('#tablaIngresos tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  ingresos.forEach(i => {
    const acciones = `<button onclick="eliminarIngreso(${i.id})" class="btn-delete" style="background: none; border: none; cursor: pointer; font-size: 1.1rem;" title="Eliminar">🗑️</button>`;
    tbody.innerHTML += `<tr><td>${i.fecha}</td><td>${i.descripcion||'-'}</td><td>${i.medioPago||'EFECTIVO'}</td><td>${i.categoriaNombre||'-'}</td><td class="monto-ingreso">${formatoMoneda(i.monto)}</td><td>${acciones}</td></tr>`;
  });
}

function renderConsumosCuotas(lista) {
    const tbody = document.querySelector("#tablaTarjetas tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const mediosIgnorados = ["BNA", "MERCADO PAGO", "MERCADO_PAGO", "EFECTIVO", "PENDIENTE", "MÚLTIPLES"];
    globalBilleteras.forEach(b => mediosIgnorados.push(b.nombre.toUpperCase()));
    
    const filtroSelect = document.getElementById("filtroTarjetaSelect");
    const tarjetaSeleccionada = filtroSelect ? filtroSelect.value : "all";

    const consumosTarjeta = lista.filter(g => {
        if (!g.medioPago) return false;
        const medio = g.medioPago.toUpperCase();
        if (mediosIgnorados.includes(medio)) return false;
        if (tarjetaSeleccionada !== "all" && medio !== tarjetaSeleccionada) return false;
        return true;
    });
    
    consumosTarjeta.forEach(g => {
      const acciones = `
          <button onclick="editarCuotaTarjeta(${g.id})" class="btn-edit" style="padding: 2px 6px; background: none; border: none; cursor: pointer; font-size: 1.1rem;" title="Editar">✏️</button>
          <button onclick="eliminarGasto(${g.id})" class="btn-delete" style="padding: 2px 6px; margin-left: 10px; background: none; border: none; cursor: pointer; font-size: 1.1rem;" title="Eliminar">🗑️</button>
      `;
      
      let desc = g.descripcion || "-";
      let badgeCuota = "-";
      
      if (desc.includes("(Cuota")) {
          const partes = desc.split("(Cuota");
          desc = partes[0].trim();
          const cuotaInfo = "Cuota " + partes[1].replace(")", "");
          badgeCuota = `<span style="background: var(--color-primario); color: #000; padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 0.85rem;">${cuotaInfo}</span>`;
      }
      
      let tarjetaBadge = `<span style="color: #00aae4; font-weight: bold; font-size: 0.8rem; display: block; margin-top: 4px;">${g.medioPago}</span>`;
      let esDolar = (g.descripcion || "").includes("[USD]");
      let montoAMostrar = esDolar ? `<span style="color:#059669;">USD ${Number(g.monto).toFixed(2)}</span>` : formatoMoneda(g.monto);
      
      tbody.innerHTML += `
      <tr>
          <td>${g.fecha} ${tarjetaBadge}</td>
          <td>${desc}</td>
          <td>${g.categoriaNombre || "-"}</td>
          <td>${badgeCuota}</td>
          <td class="monto-gasto">${montoAMostrar}</td>
          <td>${acciones}</td>
      </tr>`;
    });
}

function renderInversiones(lista) {
  const tbody = document.querySelector('#tablaInversiones tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  lista.forEach(i => {
    const acciones = `<button onclick="eliminarIngreso(${i.id})" class="btn-delete" style="background: none; border: none; cursor: pointer; font-size: 1.1rem;" title="Eliminar">🗑️</button>`;
    
    let detalleLimpio = (i.descripcion || "").replace("INV: ", "");
    let colorMonto = detalleLimpio.includes('(USD)') ? '#86efac' : '#94a3b8';
    let prefijo = detalleLimpio.includes('(USD)') ? 'USD ' : '';

    let montoAMostrar = `${prefijo}${formatoMoneda(i.monto)}`;

    tbody.innerHTML += `<tr>
        <td>${i.fecha}</td>
        <td>${detalleLimpio}</td>
        <td style="font-weight: bold; color: ${colorMonto};">${montoAMostrar}</td>
        <td>${acciones}</td>
    </tr>`;
  });
}

function renderProyeccion(ingresos, gastosFijos, gastosVariables, ahorros) {
    const tbody = document.getElementById("tablaProyeccionBody");
    if (!tbody) return;

    const totalIngreso = ingresos.reduce((s, x) => s + (Number(x.monto) || 0), 0);
    const realFijos = gastosFijos.reduce((s, x) => s + (Number(x.monto) || 0), 0);
    const realVariables = gastosVariables.reduce((s, x) => s + (Number(x.monto) || 0), 0);
    const realAhorro = ahorros.reduce((s, x) => s + (Number(x.monto) || 0), 0);

    const topeFijos = totalIngreso * 0.50;
    const topeVariables = totalIngreso * 0.30;
    const topeAhorro = totalIngreso * 0.20;

    tbody.innerHTML = `
        <tr><td>Gastos Fijos</td><td>50%</td><td style="color: #94a3b8;">${formatoMoneda(topeFijos)}</td><td style="font-weight:bold; color: ${realFijos > topeFijos ? '#ff6384' : '#2ac9bb'}">${formatoMoneda(realFijos)}</td><td>${realFijos > topeFijos ? '🔴 Excedido' : '🟢 Al día'}</td></tr>
        <tr><td>Gastos Variables</td><td>30%</td><td style="color: #94a3b8;">${formatoMoneda(topeVariables)}</td><td style="font-weight:bold; color: ${realVariables > topeVariables ? '#ff6384' : '#2ac9bb'}">${formatoMoneda(realVariables)}</td><td>${realVariables > topeVariables ? '🔴 Excedido' : '🟢 Al día'}</td></tr>
        <tr><td>Ahorros / Inv.</td><td>20%</td><td style="color: #94a3b8;">${formatoMoneda(topeAhorro)}</td><td style="font-weight:bold; color: ${realAhorro < topeAhorro ? '#ffce56' : '#2ac9bb'}">${formatoMoneda(realAhorro)}</td><td>${realAhorro >= topeAhorro && topeAhorro > 0 ? '🟢 Meta lograda' : (topeAhorro === 0 ? '⚪ Sin ingresos' : '🟡 Falta ahorro')}</td></tr>
    `;

    const contenedorSaldos = document.getElementById("resumenCuentasProyeccion");
    if(contenedorSaldos) {
        contenedorSaldos.innerHTML = `<h4 style="margin-bottom: 10px;">💳 Dinero Disponible (Débito)</h4>`;
        const nombres = ["BNA", "MERCADO PAGO", "EFECTIVO"];
        globalBilleteras.forEach(b => { if(!nombres.includes(b.nombre.toUpperCase())) nombres.push(b.nombre.toUpperCase()); });
        const saldos = window.saldosActuales || {};
        
        nombres.forEach(b => {
            contenedorSaldos.innerHTML += `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #444; padding: 5px 0;">
                <span>🏦 ${b}:</span> 
                <span style="font-weight: bold; color: #00aae4;">${saldosOcultos ? "••••••" : formatoMoneda(saldos[b] || 0)}</span>
            </div>`;
        });
    }
}

function renderPrestamos(prestamos) {
      const contenedor = document.getElementById("contenedorTablasPrestamos");
      if(!contenedor) return;
      contenedor.innerHTML = "";

      let minombre = user.nombre ? user.nombre.split(" ")[0] : "Vos";
      minombre = minombre.charAt(0).toUpperCase() + minombre.slice(1).toLowerCase();

      document.querySelectorAll('.nombreDinamico').forEach(el => el.textContent = minombre);

	  const selectMes = document.getElementById("filtroMes");
	  const selectAnio = document.getElementById("filtroAnio");
	  const mesSeleccionado = (selectMes && selectAnio) ? `${selectAnio.value}-${selectMes.value}` : new Date().toISOString().slice(0, 7);

      const prestamosDelMes = prestamos.filter(p => p.mesCuota && p.mesCuota.startsWith(mesSeleccionado));
      
      const grupos = { "Mamá": [], "Papá": [], "Ambos": [] };
      let sumaTotalMia = 0;

      prestamosDelMes.forEach(p => {
          const pertenece = p.perteneceA || "Desconocido";
          const aBelen = Number(p.aporteBelen) || 0;
          const aOtro = Number(p.aporteOtro) || 0;
          const totalCuotaDinero = Number(p.montoTotal) || 0;

          sumaTotalMia += aBelen;

          if(grupos[pertenece]) {
              grupos[pertenece].push({
                  id: p.id, 
                  nombre: p.nombre || "Sin Nombre", 
                  cuotaActual: p.cuotaActual || 1, 
                  cuotaTotal: p.cuotaTotal || 1, 
                  aBelen, aOtro, totalCuotaDinero
              });
          }
      });

      const cardBelen = document.getElementById("totalBelenPrestamos");
      if(cardBelen) cardBelen.textContent = formatoMoneda(sumaTotalMia);

      ["Mamá", "Papá", "Ambos"].forEach(grupo => {
          if(grupos[grupo].length === 0) return;

          let filas = "";
          grupos[grupo].forEach(g => {
              filas += `<tr>
                  <td><strong>${g.nombre}</strong></td>
                  <td><span style="background:var(--color-primario); color:#000; padding:2px 6px; border-radius:10px; font-size:0.8rem; font-weight:bold;">${g.cuotaActual}/${g.cuotaTotal}</span></td>
                  <td>${formatoMoneda(g.totalCuotaDinero)}</td>
                  <td style="color:#ffce56; font-weight:bold;">${formatoMoneda(g.aBelen)}</td>
                  <td style="color:#94a3b8;">${formatoMoneda(g.aOtro)}</td>
                  <td>
                      <button onclick="abrirEditarPrestamo(${g.id}, ${g.totalCuotaDinero}, ${g.aBelen})" class="btn-edit" style="background:none;border:none;cursor:pointer;font-size:1.1rem;">✏️</button>
                      <button onclick="eliminarPrestamo(${g.id})" class="btn-delete" style="background:none;border:none;cursor:pointer;font-size:1.1rem;">🗑️</button>
                  </td>
              </tr>`;
          });

          contenedor.innerHTML += `
          <div style="background: #1a1a1a; padding: 15px; border-radius: 8px; border: 1px solid #333; margin-bottom: 20px;">
              <h3 style="margin-top: 0; color: #00aae4; border-bottom: 1px solid #333; padding-bottom: 5px;">Pertenece a: ${grupo}</h3>
              <div class="table-wrapper tabla-con-scroll">
                  <table class="table">
                      <thead><tr><th>Préstamo</th><th>Cuota</th><th>Total Cuota</th><th style="color:#ffce56;">${minombre}</th><th>Aportado (Otro)</th><th>Acciones</th></tr></thead>
                      <tbody>${filas}</tbody>
                  </table>
              </div>
          </div>`;
      });
}

function generarSparkline(gastos, mes) {
    const canvas = document.getElementById('sparklineCanvas');
    if (!canvas) return;
    if (miSparkline) { miSparkline.destroy(); miSparkline = null; }

    const [yyyy, mm] = mes.split('-');
    const numDays = new Date(yyyy, mm, 0).getDate();
    const dias = {};
    for(let i=1; i<=numDays; i++) dias[i] = 0;

    gastos.forEach(g => {
        const f = g.fecha || g.fechaVencimiento;
        if(!f) return;
        const d = parseInt(f.split('-')[2]);
        if(dias[d] !== undefined) dias[d] += (Number(g.monto) || 0);
    });

    let acumulado = 0;
    const data = Object.keys(dias).map(d => {
        acumulado += dias[d];
        return acumulado;
    });

    const ctx = canvas.getContext('2d');
    let gradient = ctx.createLinearGradient(0, 0, 0, 45);
    gradient.addColorStop(0, 'rgba(190, 18, 60, 0.25)'); 
    gradient.addColorStop(1, 'rgba(190, 18, 60, 0)');

    miSparkline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(dias),
            datasets: [{
                data: data,
                borderColor: '#be123c',
                backgroundColor: gradient,
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false, min: 0 } },
            layout: { padding: 0 },
            animation: { duration: 1000, easing: 'easeOutQuart' }
        }
    });
}


/* ==========================================================================
   5. CÁLCULOS LOGÍSTICOS Y PROCESSING
   ========================================================================== */

function calcularSaldosPorCuenta(gastos, ingresos) {
    const contenedor = document.getElementById("contenedorBilleteras");
    if (!contenedor) return;

    const nombres = [];
    globalBilleteras.forEach(b => {
        const nom = b.nombre.toUpperCase();
        if (!nombres.includes(nom)) nombres.push(nom);
    });

    ingresos.forEach(i => { let m = (i.medioPago || "EFECTIVO").toUpperCase(); if (m === "MERCADO_PAGO") m = "MERCADO PAGO"; if (!nombres.includes(m)) nombres.push(m); });
    gastos.forEach(g => { if (g.pagado === false) return; let m = (g.medioPago || "EFECTIVO").toUpperCase(); if (m === "MERCADO_PAGO") m = "MERCADO PAGO"; if (!nombres.includes(m)) nombres.push(m); });

    const saldos = {};
    nombres.forEach(n => saldos[n] = 0);

    ingresos.forEach(i => { let m = (i.medioPago || "EFECTIVO").toUpperCase(); if (m === "MERCADO_PAGO") m = "MERCADO PAGO"; if (saldos[m] !== undefined) saldos[m] += (Number(i.monto) || 0); });
    gastos.forEach(g => { if (g.pagado === false) return; let m = (g.medioPago || "EFECTIVO").toUpperCase(); if (m === "MERCADO_PAGO") m = "MERCADO PAGO"; if (saldos[m] !== undefined) saldos[m] -= (Number(g.monto) || 0); });
    
    window.saldosActuales = saldos;

	    contenedor.style.cssText = "display: flex; flex-direction: row; flex-wrap: nowrap; gap: 16px; overflow-x: auto; max-width: 100%; padding: 10px 5px 20px 5px; -webkit-overflow-scrolling: touch;";
	    contenedor.innerHTML = "";

	    if (nombres.length === 0) {
	         contenedor.innerHTML = `<div style="width: 100%; text-align: center; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 12px; color: #888;">No tenés cuentas de débito creadas. Usá el botón "🏦 + Nueva Cuenta" para empezar.</div>`;
	        return;
	    }

		globalBilleteras.forEach(billetera => {
			        const b = billetera.nombre.toUpperCase();
			        
			        let btnAcciones = `
			        <div style="position: absolute; top: 12px; right: 12px; display: flex; gap: 10px; z-index: 10;">
			            <button onclick="abrirEditarBilletera(${billetera.id}, '${billetera.nombre}', '${billetera.color || 'default'}')" style="background: transparent; border: none; cursor: pointer; color: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; padding: 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));" title="Configurar">⚙️</button>
			            <button onclick="eliminarBilletera(${billetera.id})" style="background: transparent; border: none; cursor: pointer; color: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; padding: 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));" title="Eliminar">🗑️</button>
			        </div>
			        `;

		            const montoRealTarjeta = formatoMoneda(saldos[b] || 0);
			        const montoAMostrar = saldosOcultos ? "••••••" : montoRealTarjeta;
			        const bgColor = getBgColor(billetera.color || 'default'); 

			        contenedor.innerHTML += `
			        <div class="tarjeta-billetera" style="background: ${bgColor};">
			            <div style="position: absolute; bottom: -20px; right: -20px; width: 90px; height: 90px; background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%); border-radius: 50%; z-index: 1; pointer-events: none;"></div>
			            
			            ${btnAcciones}
			            
			            <div style="position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
			                <div style="display: flex; align-items: center; gap: 4px;">
			                    <span style="font-size: 0.8rem; color: rgba(255,255,255,0.9);">🏦</span>
			                    <h4>${b}</h4>
			                </div>
							<div style="margin-top: auto;">
							                    <p onmouseover="if(${saldosOcultos}) this.textContent = '${montoRealTarjeta}'" 
							                       onmouseout="if(${saldosOcultos}) this.textContent = '••••••'"
							                       ontouchstart="if(${saldosOcultos}) this.textContent = '${montoRealTarjeta}'"
							                       ontouchend="if(${saldosOcultos}) this.textContent = '••••••'"
							                       title="${saldosOcultos ? 'Pasá el mouse o mantené apretado para ver' : ''}" 
							                       style="${saldosOcultos ? 'cursor: pointer;' : ''} -webkit-tap-highlight-color: transparent;">
							                       ${montoAMostrar}
							                    </p>
							                </div>
			            </div>
			        </div>`;
			    });
}

function actualizarMediosDePagoSelects() {
    const gastoMedio = document.getElementById("gastoMedio");
    const ingresoMedio = document.getElementById("ingresoMedio");
    const tarjetaTipo = document.getElementById("tarjetaTipo"); 
    const pagoGastoMedio = document.getElementById("pagoGastoMedio"); 
    const filtroTarjeta = document.getElementById("filtroTarjetaSelect"); 
    
    let opcionesBilleteras = "";
    globalBilleteras.forEach(b => {
        opcionesBilleteras += `<option value="${b.nombre.toUpperCase()}">🏦 ${b.nombre}</option>`;
    });
    
    if (globalBilleteras.length === 0) {
        opcionesBilleteras = `<option value="EFECTIVO">💵 Efectivo (Creá tus cuentas en Inicio)</option>`;
    }
    
    if (gastoMedio) gastoMedio.innerHTML = opcionesBilleteras;
    if (ingresoMedio) ingresoMedio.innerHTML = opcionesBilleteras;
    if (pagoGastoMedio) pagoGastoMedio.innerHTML = opcionesBilleteras;
    
    if (tarjetaTipo) tarjetaTipo.innerHTML = "";
    if (globalTarjetas.length === 0 && tarjetaTipo) {
        tarjetaTipo.innerHTML = '<option value="">No tenés tarjetas de crédito creadas</option>';
    }

    if (filtroTarjeta) {
        const valPrevio = filtroTarjeta.value;
        filtroTarjeta.innerHTML = '<option value="all">💳 TODAS</option>';
        globalTarjetas.forEach(t => {
            filtroTarjeta.innerHTML += `<option value="${t.nombre.toUpperCase()}">💳 ${t.nombre.toUpperCase()}</option>`;
        });
        if (valPrevio) filtroTarjeta.value = valPrevio; 
    }

    globalTarjetas.forEach(t => {
        const opt = `<option value="${t.nombre}">💳 ${t.nombre}</option>`;
        if (gastoMedio) gastoMedio.innerHTML += opt;
        if (tarjetaTipo) tarjetaTipo.innerHTML += opt;
        if (pagoGastoMedio) pagoGastoMedio.innerHTML += opt;
    });
}


/* ==========================================================================
   6. EVENTOS DE FORMULARIOS (SUBMITS, MODALES)
   ========================================================================== */

const formBilletera = document.getElementById("formBilletera");
if (formBilletera) {
    formBilletera.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = document.querySelector("#formBilletera button[type='submit']");
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Guardando..."; 

        try {
            const body = { 
                nombre: document.getElementById("billeteraNombre").value.trim(), 
                usuario: { id: user.id } 
            };
            
            const res = await fetch(`${API}/billeteras`, { 
                method: "POST", headers: authHeaders(), body: JSON.stringify(body) 
            });
            handleAuthError(res);
            if(!res.ok) {
                const errText = await res.text();
                throw new Error(`El servidor bloqueó la cuenta. Código: ${res.status}. Detalle: ${errText}`);
            }

            document.getElementById("modalBilletera").style.display = "none";
            formBilletera.reset();
            await refreshAll();
            
        } catch(err) { 
            alert("Error técnico al guardar: " + err.message); 
            console.error(err);
        } finally { 
            btnSubmit.disabled = false; 
            btnSubmit.textContent = "Crear Cuenta"; 
        }
    };
}

const formEditarBilletera = document.getElementById("formEditarBilletera");
if (formEditarBilletera) {
    formEditarBilletera.onsubmit = async (e) => {
        e.preventDefault();
        try {
            const id = document.getElementById("editBilleteraId").value;
            const body = {
                nombre: document.getElementById("editBilleteraNombre").value.trim(),
                color: document.getElementById("editBilleteraColor").value
            };
            await fetch(`${API}/billeteras/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
            
            document.getElementById("modalEditarBilletera").style.display = "none";
            await refreshAll();
        } catch(err) { alert("Error al actualizar la cuenta."); }
    };
}

const formNuevaTarjeta = document.getElementById("formNuevaTarjeta");
if (formNuevaTarjeta) {
    formNuevaTarjeta.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = document.querySelector("#formNuevaTarjeta button[type='submit']");
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Guardando...";

        try {
            const body = {
                nombre: document.getElementById("nuevaTarjetaNombre").value.trim(),
                diaCierre: 1, 
                diaVencimiento: 1, 
                color: document.getElementById("nuevaTarjetaColor").value,
                usuario: { id: user.id }
            };

            const res = await fetch(`${API}/tarjetas`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });

            if (!res.ok) {
                 const errorText = await res.text();
                 throw new Error(errorText || "Error al guardar la tarjeta");
            }

            document.getElementById("modalNuevaTarjeta").style.display = "none";
            formNuevaTarjeta.reset();
            alert("¡Tarjeta guardada con éxito!");
            await refreshAll();

        } catch (error) {
            alert(`Hubo un error al guardar: ${error.message}`);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Guardar Crédito";
        }
    };
}

const formPrestamo = document.getElementById("formPrestamo");
if (formPrestamo) {
    formPrestamo.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = document.querySelector("#formPrestamo button[type='submit']");
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Generando...";
        try {
            const nombre = document.getElementById("prestamoNombre").value.trim();
            const pertenece = document.getElementById("prestamoPertenece").value;
            const totalCuotas = parseInt(document.getElementById("prestamoTotalCuotas").value);
            const mesInicio = document.getElementById("prestamoMesInicio").value;

            const [year, month] = mesInicio.split('-');
            let fechaActual = new Date(year, month - 1, 1);

			for (let i = 1; i <= totalCuotas; i++) {
			                const yyyy = fechaActual.getFullYear();
			                const mm = String(fechaActual.getMonth() + 1).padStart(2, '0');
			                
			                // Le agregamos el "-01" para que Java lo entienda como Fecha (LocalDate)
			                const fechaPerfecta = `${yyyy}-${mm}-01`;

			                const body = {
			                    mesCuota: fechaPerfecta,
			                    nombre: nombre,
			                    perteneceA: pertenece,
			                    cuotaActual: i,
			                    cuotaTotal: totalCuotas,
			                    montoTotal: 0.0,  // Agregamos .0 para que Java lo entienda como Double
			                    aporteBelen: 0.0,
			                    aporteOtro: 0.0,
			                    usuario: { id: user.id } // Única forma correcta de pasar la relación
			                };
			                
			                const res = await fetch(`${API}/prestamos`, { 
			                    method: "POST", 
			                    headers: authHeaders(), 
			                    body: JSON.stringify(body) 
			                });
			                
			                // Atrapamos el error si Java lo rechaza para saber exactamente por qué
			                if (!res.ok) {
			                    const errText = await res.text();
			                    throw new Error(`Java rechazó los datos: ${errText}`);
			                }
			                
			                fechaActual.setMonth(fechaActual.getMonth() + 1);
			            }
            document.getElementById("modalPrestamo").style.display = "none";
            formPrestamo.reset();
            await refreshAll();
            
            // Aviso inteligente para que tu hermana sepa que tiene que buscar el mes
            alert(`¡Se generaron ${totalCuotas} cuotas con éxito!\n\n(Revisá el selector de meses arriba para verlas si elegiste un mes futuro)`);
            
        } catch(err) {
            alert("Error al conectar con la base de datos: " + err.message);
            console.error(err);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Generar Cuotas";
        }
    };
}

const formGasto = document.getElementById("formGasto");
if (formGasto) {
formGasto.onsubmit = async (e) => { 
e.preventDefault(); 
const btnSubmit = document.querySelector("#formGasto button[type='submit']");
btnSubmit.disabled = true;
btnSubmit.textContent = "Guardando...";

try {
const idAEditar = document.getElementById("gastoId").value ? parseInt(document.getElementById("gastoId").value) : null;
const descripcion = document.getElementById("gastoDescripcion").value;
const montoRaw = document.getElementById("gastoMonto").value;
const monto = parseFloat(montoRaw.replace(',', '.'));

const pagado = document.getElementById("gastoPagado").checked;
const medioPago = pagado ? document.getElementById("gastoMedio").value : "PENDIENTE";

const esFijo = document.getElementById("gastoEsFijo").checked;
const repeticion = parseInt(document.getElementById("gastoRepeticion").value || 0);
const categoriaId = document.getElementById("gastoCategoria").value || null;
let fechaVto = document.getElementById("gastoVencimiento").value;
const fechaReal = document.getElementById("gastoFecha").value;
const mesImpacto = document.getElementById("gastoMesImpacto").value;

if (!fechaVto) {
    fechaVto = fechaReal ? fechaReal : new Date().toISOString().split('T')[0];
}

let fechaBase = pagado ? fechaReal : fechaVto;

if (idAEditar) {
    const body = {
    descripcion, monto, medioPago, fecha: pagado ? fechaReal : fechaVto,
    esFijo, usuarioId: user.id, categoriaId: categoriaId,
    fechaVencimiento: fechaVto || null, pagado, mesImpacto: mesImpacto ? mesImpacto + "-01" : null
    };

    const res = await fetch(`${API}/gastos/${idAEditar}`, {
    method: "PUT", headers: authHeaders(), body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("Error al guardar el gasto");
    alert("¡Gasto actualizado!");

} else {
	if (esFijo && repeticion > 0) {
	        const [year, month, day] = fechaVto.split('-');
	        let saltoMes = 1;
	        const tipoRepeticion = document.getElementById("tipoRepeticion").value;

	        if(tipoRepeticion === "mensual") saltoMes = 1;
	        if(tipoRepeticion === "3meses") saltoMes = 3;
	        if(tipoRepeticion === "6meses") saltoMes = 6;

	        for (let i = 0; i < repeticion; i++) {
	            let m = parseInt(month) + (i * saltoMes);
	            let y = parseInt(year);
	            while (m > 12) { m -= 12; y += 1; }
	            let safeDay = parseInt(day) > 28 ? "28" : day;
	            let nuevoVto = `${y}-${String(m).padStart(2,'0')}-${safeDay}`;
	            let isPagado = (i === 0) ? pagado : false;
	            let pFecha = (i === 0 && pagado) ? fechaReal : nuevoVto;
	            
	            let mPago = isPagado ? medioPago : "PENDIENTE";

	            let nuevoMesImpacto = null;
	            if (mesImpacto) {
	                let [mY, mM] = mesImpacto.split('-');
	                let impM = parseInt(mM) + (i * saltoMes);
	                let impY = parseInt(mY);
	                while (impM > 12) { impM -= 12; impY += 1; }
	                nuevoMesImpacto = `${impY}-${String(impM).padStart(2,'0')}-01`;
	            }

	            const bodyFijo = {
	            descripcion, monto, medioPago: mPago, fecha: pFecha,
	            esFijo: true, usuarioId: user.id, categoriaId: categoriaId,
	            fechaVencimiento: nuevoVto, pagado: isPagado, mesImpacto: nuevoMesImpacto
	            };
	            await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(bodyFijo) });
	        }
	    }else {
        const body = {
        descripcion, monto, medioPago, fecha: fechaBase,
        esFijo, usuarioId: user.id, categoriaId: categoriaId,
        fechaVencimiento: fechaVto, pagado, mesImpacto: mesImpacto ? mesImpacto + "-01" : null
        };
        await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    }
}

document.getElementById("modalGasto").style.display = "none";
formGasto.reset();
document.getElementById('gastoId').value = "";
gastoEnEdicion = null;
const divCamposFijos = document.getElementById('camposFijos');
if (divCamposFijos) divCamposFijos.style.display = 'none';
await refreshAll();

} catch (error) {
alert("❌ Error al guardar el gasto");
} finally {
btnSubmit.disabled = false;
btnSubmit.textContent = "Guardar";
}
};
}

const formIngreso = document.getElementById("formIngreso");
if (formIngreso) {
    formIngreso.onsubmit = async (e) => { 
        e.preventDefault(); 
        const btnSubmit = document.querySelector("#formIngreso button[type='submit']");
        btnSubmit.disabled = true;
        try {
            const mesImpacto = document.getElementById("ingresoMesImpacto").value;

            const body = {
                descripcion: document.getElementById("ingresoDescripcion").value || "Ingreso",
                monto: document.getElementById("ingresoMonto").value,
                medioPago: document.getElementById("ingresoMedio").value,
                fecha: document.getElementById("ingresoFecha").value,
                usuarioId: user.id,
                categoriaId: document.getElementById("ingresoCategoria").value || null,
                mesImpacto: mesImpacto ? mesImpacto + "-01" : null 
            };
            
            const res = await fetch(`${API}/ingresos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
            
            if (!res.ok) {
                const err = await res.text();
                alert("La base de datos rechazó el ingreso. Error: " + err);
                return;
            }

            document.getElementById("modalIngreso").style.display = "none"; 
            formIngreso.reset(); 
            await refreshAll(); 
            
        } catch(error) {
            alert("Error de conexión. Revisá tu internet y volvé a intentar.");
        } finally {
            btnSubmit.disabled = false;
        }
    };
}

const formTarjeta = document.getElementById("formTarjeta");
if (formTarjeta) {
    formTarjeta.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = document.querySelector("#formTarjeta button[type='submit']");
        btnSubmit.disabled = true;
        try {
            const descripcionBase = document.getElementById("tarjetaDescripcion").value;
            const moneda = document.getElementById("tarjetaMoneda").value;
            const montoTotal = parseFloat(document.getElementById("tarjetaMontoTotal").value);
            const cuotas = parseInt(document.getElementById("tarjetaCuotas").value);
            const primeraCuota = document.getElementById("tarjetaPrimeraCuota").value;
            const fechaExacta = document.getElementById("tarjetaFechaExacta").value; 
            const tarjetaTipo = document.getElementById("tarjetaTipo").value; 
            const categoriaId = document.getElementById("tarjetaCategoria").value || null; 

            const descFinal = moneda === "USD" ? `[USD] ${descripcionBase}` : descripcionBase;
            const montoPorCuota = Number((montoTotal / cuotas).toFixed(2));
            
            const [year, month] = primeraCuota.split('-');
            const diaCompraOriginal = parseInt(fechaExacta.split('-')[2]); 
            
            let fechaActualCalculo = new Date(year, month - 1, diaCompraOriginal);

            for (let i = 1; i <= cuotas; i++) {
                const yyyy = fechaActualCalculo.getFullYear();
                const mm = String(fechaActualCalculo.getMonth() + 1).padStart(2, '0');
                const dd = String(fechaActualCalculo.getDate()).padStart(2, '0');

                const body = {
                    descripcion: `${descFinal} (Cuota ${i}/${cuotas})`,
                    monto: montoPorCuota,
                    medioPago: tarjetaTipo,
                    fecha: `${yyyy}-${mm}-${dd}`,
                    esFijo: false,
                    usuarioId: user.id,
                    pagado: false,
                    categoriaId: categoriaId 
                };

                await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                fechaActualCalculo.setMonth(fechaActualCalculo.getMonth() + 1);
            }

            document.getElementById("modalTarjeta").style.display = "none";
            formTarjeta.reset();
            await refreshAll();
            alert("Compra cargada con éxito.");
        } catch (error) { 
            alert("Error al guardar la compra."); 
        } finally { btnSubmit.disabled = false; }
    };
}

const formInversion = document.getElementById("formInversion");
if (formInversion) {
    formInversion.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = document.querySelector("#formInversion button[type='submit']");
        btnSubmit.disabled = true;
        try {
            const lugar = document.getElementById("invLugar").value;
            const instrumento = document.getElementById("invInstrumento").value;
            const moneda = document.getElementById("invMoneda").value;
            const monto = document.getElementById("invMonto").value;
            const fechaHoy = new Date().toISOString().split('T')[0];

            const body = {
                descripcion: `INV: ${lugar} - ${instrumento} (${moneda})`,
                monto: monto,
                medioPago: "EFECTIVO", 
                fecha: fechaHoy,
                usuarioId: user.id,
                categoriaId: null 
            };

            await fetch(`${API}/ingresos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });

            document.getElementById("modalInversion").style.display = "none";
            formInversion.reset();
            await refreshAll();
            alert("Inversión registrada con éxito.");
        } catch (error) {
            alert("Hubo un error al registrar la inversión.");
        } finally {
            btnSubmit.disabled = false;
        }
    };
}

const formPagarGasto = document.getElementById("formPagarGasto");
if (formPagarGasto) {
    formPagarGasto.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = document.querySelector("#formPagarGasto button[type='submit']");
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Procesando...";

        try {
            const id = document.getElementById("pagoGastoId").value;
            const gastoOriginal = globalGastos.find(g => g.id == id);
            if(!gastoOriginal) throw new Error("Gasto no encontrado");

            const catId = gastoOriginal.categoriaId || (gastoOriginal.categoria ? gastoOriginal.categoria.id : null);

            const body = {
                descripcion: gastoOriginal.descripcion,
                monto: gastoOriginal.monto,
                medioPago: document.getElementById("pagoGastoMedio").value,
                fecha: document.getElementById("pagoGastoFecha").value,
                esFijo: gastoOriginal.esFijo,
                usuarioId: user.id,
                categoriaId: catId,
                fechaVencimiento: gastoOriginal.fechaVencimiento,
                pagado: true,
                mesImpacto: gastoOriginal.mesImpacto
            };

            const res = await fetch(`${API}/gastos/${id}`, {
                method: "PUT",
                headers: authHeaders(),
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error("Error al registrar el pago");

            document.getElementById("modalPagarGasto").style.display = "none";
            await refreshAll();
        } catch(err) {
            alert("Error al pagar: " + err.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Registrar Pago";
        }
    };
}

const formEditarCuota = document.getElementById("formEditarCuota");
if (formEditarCuota) {
    formEditarCuota.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = document.querySelector("#formEditarCuota button[type='submit']");
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Guardando...";

        try {
            const id = document.getElementById("editCuotaId").value;
            const descBase = document.getElementById("editCuotaDescripcion").value.trim();
            const cuotaInfo = document.getElementById("editCuotaInfo").value.trim();
            const descripcionFinal = cuotaInfo ? `${descBase} (Cuota ${cuotaInfo})` : descBase;

            const body = {
                descripcion: descripcionFinal,
                monto: parseFloat(document.getElementById("editCuotaMonto").value),
                medioPago: document.getElementById("editCuotaMedio").value,
                fecha: document.getElementById("editCuotaFecha").value,
                categoriaId: document.getElementById("editCuotaCategoria").value || null,
                usuarioId: user.id,
                esFijo: false
            };

            const originalGasto = globalGastos.find(g => g.id == id);
            if (originalGasto) {
                body.pagado = originalGasto.pagado;
                body.fechaVencimiento = originalGasto.fechaVencimiento;
                body.mesImpacto = originalGasto.mesImpacto;
            }

            const res = await fetch(`${API}/gastos/${id}`, {
                method: "PUT",
                headers: authHeaders(),
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error("Error al actualizar la cuota");

            document.getElementById("modalEditarCuota").style.display = "none";
            await refreshAll();
        } catch (error) {
            alert("Error al guardar cambios");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Guardar Cambios";
        }
    };
}

const formEditarPrestamo = document.getElementById("formEditarPrestamo");
if (formEditarPrestamo) {
    formEditarPrestamo.onsubmit = async (e) => {
        e.preventDefault();
        try {
            const id = document.getElementById("editPrestamoId").value;
            const total = parseFloat(document.getElementById("editPrestamoTotal").value) || 0;
            const belen = parseFloat(document.getElementById("editPrestamoBelen").value) || 0;
            const aportado = total - belen; 

            const body = {
                montoTotal: total,
                aporteBelen: belen,
                aporteOtro: aportado
            };
            
            await fetch(`${API}/prestamos/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
            
            document.getElementById("modalEditarPrestamo").style.display = "none";
            await refreshAll();
        } catch(err) {
            alert("Error al actualizar la cuota.");
        }
    };
}


/* ==========================================================================
   7. INTERACCIONES Y ELIMINACIONES (Clicks, Toggles, Borrados)
   ========================================================================== */

window.abrirEditarBilletera = function(id, nombre, color) {
    document.getElementById("editBilleteraId").value = id;
    document.getElementById("editBilleteraNombre").value = nombre;
    const selectColor = document.getElementById("editBilleteraColor");
    if(selectColor) selectColor.value = color !== 'undefined' ? color : 'azul';
    document.getElementById("modalEditarBilletera").style.display = "flex";
};

window.eliminarBilletera = async function(id) {
    if(confirm("¿Seguro que querés eliminar esta cuenta? No se borrarán los movimientos pasados.")) {
        await fetch(`${API}/billeteras/${id}`, { method: "DELETE", headers: authHeaders() });
        await refreshAll();
    }
};

window.abrirEditarPrestamo = function(id, total, belen) {
    document.getElementById("editPrestamoId").value = id;
    document.getElementById("editPrestamoTotal").value = total > 0 ? total : "";
    document.getElementById("editPrestamoBelen").value = belen > 0 ? belen : "";
    
    const inTotal = document.getElementById("editPrestamoTotal");
    const inBelen = document.getElementById("editPrestamoBelen");
    const outCalc = document.getElementById("calculoAportado");
    
    const recalcular = () => {
        const t = Number(inTotal.value) || 0;
        const b = Number(inBelen.value) || 0;
        outCalc.textContent = formatoMoneda(t - b);
    };
    inTotal.onkeyup = recalcular;
    inBelen.onkeyup = recalcular;
    recalcular();

    document.getElementById("modalEditarPrestamo").style.display = "flex";
};

window.eliminarPrestamo = async function(id) {
    if(confirm("¿Seguro que querés eliminar esta cuota del préstamo?")) {
        await fetch(`${API}/prestamos/${id}`, { method: "DELETE", headers: authHeaders() });
        await refreshAll();
    }
};

window.eliminarGasto = async function(id) { 
    const gasto = globalGastos.find(g => g.id === id);
    if (!gasto) return;

    if (!confirm(`¿Seguro que querés eliminar el gasto "${gasto.descripcion}"?`)) return;

    if (gasto.esFijo) {
        const borrarFuturos = confirm("Al ser un gasto fijo... ¿Querés eliminarlo también de TODOS los meses SIGUIENTES?\n\n👉 ACEPTAR: Borra este y todos los futuros.\n👉 CANCELAR: Borra SOLO este mes.");

        if (borrarFuturos) {
            const res = await fetch(`${API}/gastos/usuario/${user.id}`, { headers: authHeaders() });
            const todosLosGastos = await res.json();
            
            const gastosABorrar = todosLosGastos.filter(g => 
                (String(g.usuarioId) === String(user.id) || (g.usuario && String(g.usuario.id) === String(user.id))) &&
                g.esFijo === true && 
                g.descripcion === gasto.descripcion && 
                g.fecha >= gasto.fecha
            );

            for (const g of gastosABorrar) {
                await fetch(`${API}/gastos/${g.id}`, { method: "DELETE", headers: authHeaders() });
            }
            alert("¡Se eliminó este gasto y todas sus repeticiones futuras!");
        } else {
            await fetch(`${API}/gastos/${id}`, { method: "DELETE", headers: authHeaders() });
        }
    } else {
        await fetch(`${API}/gastos/${id}`, { method: "DELETE", headers: authHeaders() });
    }
    
    await refreshAll(); 
};

window.editarGasto = async function(id) {
    await fetchCategorias();
    gastoEnEdicion = globalGastos.find(g => g.id === id);
    if (!gastoEnEdicion) return;

    document.getElementById("gastoId").value = gastoEnEdicion.id;
    document.getElementById("gastoDescripcion").value = gastoEnEdicion.descripcion;
    document.getElementById("gastoMonto").value = gastoEnEdicion.monto;
    document.getElementById("gastoMedio").value = gastoEnEdicion.medioPago || "EFECTIVO";
    
    const catId = gastoEnEdicion.categoriaId ?? gastoEnEdicion.categoria?.id ?? "";

    setTimeout(() => {
        const selectCat = document.getElementById("gastoCategoria");
        if (selectCat) selectCat.value = catId;
    }, 0);
    
    document.getElementById("gastoVencimiento").value = gastoEnEdicion.fechaVencimiento || gastoEnEdicion.fecha || "";

    if(gastoEnEdicion.mesImpacto){
        document.getElementById("gastoMesImpacto").value = gastoEnEdicion.mesImpacto.slice(0,7);
    }else{
        document.getElementById("gastoMesImpacto").value = "";
    }

    const isPagado = gastoEnEdicion.pagado || false;
    document.getElementById("gastoPagado").checked = isPagado;

    const divFechaPago = document.getElementById("divFechaPagoReal");
    if (isPagado) {
        divFechaPago.style.display = "block";
        document.getElementById("gastoFecha").value = gastoEnEdicion.fecha || "";
    } else {
        divFechaPago.style.display = "none";
        document.getElementById("gastoFecha").value = "";
    }

	const chkFijo = document.getElementById("gastoEsFijo");
	    if (chkFijo) {
	        chkFijo.checked = gastoEnEdicion.esFijo;
	        const camposFijos = document.getElementById('camposFijos');
	        if (camposFijos) camposFijos.style.display = gastoEnEdicion.esFijo ? 'block' : 'none';
	    }

	    document.getElementById("modalGasto").style.display = "flex";
};

window.abrirModalPago = function(id) {
    const gasto = globalGastos.find(g => g.id === id);
    if (!gasto) return;

    document.getElementById("pagoGastoId").value = gasto.id;
    document.getElementById("pagoGastoDesc").textContent = gasto.descripcion;
    document.getElementById("pagoGastoFecha").value = new Date().toISOString().split('T')[0];
    
    document.getElementById("modalPagarGasto").style.display = "flex";
};

window.eliminarIngreso = async function(id) { 
    if(confirm("¿Eliminar ingreso?")) { 
        await fetch(`${API}/ingresos/${id}`, { method: "DELETE", headers: authHeaders() }); 
        await refreshAll(); 
    } 
};

window.crearCategoria = async function() {
    const inputCat = document.getElementById("nuevaCategoriaInput");

    if(!inputCat || !inputCat.value.trim()) { 
        alert("El nombre no puede estar vacío."); 
        return; 
    }

    try {

        const body = { 
            nombre: inputCat.value.trim(),
            usuarioId: user.id
        };

        const res = await fetch(`${API}/categorias`, { 
            method: "POST", headers: authHeaders(), body: JSON.stringify(body) 
        });

        if (!res.ok) throw new Error("Error del servidor");

        inputCat.value = ""; 
        await refreshAll();

    } catch (error) { alert("Error al crear la categoría."); }
};

window.eliminarCategoria = async function(id) { 
    if(confirm("¿Seguro que querés eliminar esta categoría?")) { 
        try {
            await fetch(`${API}/categorias/${id}`, { method: "DELETE", headers: authHeaders() }); 
            await refreshAll(); 
        } catch(e) { alert("Error al eliminar la categoría."); }
    } 
};

window.eliminarMiTarjeta = async function(id) {
    if(confirm("¿Seguro que querés eliminar esta tarjeta de crédito de tu cuenta?")) {
        try {
            await fetch(`${API}/tarjetas/${id}`, { method: "DELETE", headers: authHeaders() });
            await refreshAll(); 
        } catch(e) { alert("Error al intentar eliminar la tarjeta."); }
    }
};

window.editarCuotaTarjeta = async function(id) {
    await fetchCategorias(); 

    const gasto = globalGastos.find(g => g.id === id);
    if (!gasto) return;

    document.getElementById("editCuotaId").value = gasto.id;
    document.getElementById("editCuotaMedio").value = gasto.medioPago; 
    document.getElementById("editCuotaFecha").value = gasto.fecha || "";
    document.getElementById("editCuotaMonto").value = gasto.monto;

    let desc = gasto.descripcion || "";
    let cuotaStr = "";
    if (desc.includes("(Cuota")) {
        const partes = desc.split("(Cuota");
        desc = partes[0].trim();
        cuotaStr = partes[1].replace(")", "").trim(); 
    }
    document.getElementById("editCuotaDescripcion").value = desc;
    document.getElementById("editCuotaInfo").value = cuotaStr;

    const eSelect = document.getElementById("editCuotaCategoria");
    const catId = gasto.categoria ? gasto.categoria.id : (gasto.categoriaId || "");
    if(eSelect) eSelect.value = catId;

    document.getElementById("modalEditarCuota").style.display = "flex";
};

window.guardarFechasTarjetas = async function() {
    const selectMes = document.getElementById("filtroMes");
    const selectAnio = document.getElementById("filtroAnio");
    const mesSeleccionado = (selectMes && selectAnio) ? `${selectAnio.value}-${selectMes.value}` : new Date().toISOString().slice(0, 7);
    
    const cierre = document.getElementById("fechaCierreMes") ? document.getElementById("fechaCierreMes").value : "";
    const vto = document.getElementById("fechaVtoMes") ? document.getElementById("fechaVtoMes").value : "";
    
    const descString = `[CONFIG_TC] ${mesSeleccionado} | C:${cierre} | V:${vto}`;

    try {
        const iTodos = await fetchIngresos();
        const existentes = iTodos.filter(i => (i.descripcion || "").includes(`[CONFIG_TC] ${mesSeleccionado}`));
        for (let i of existentes) {
            await fetch(`${API}/ingresos/${i.id}`, { method: "DELETE", headers: authHeaders() });
        }

        const body = {
            descripcion: descString,
            monto: 0,
            medioPago: "EFECTIVO",
            fecha: `${mesSeleccionado}-01`,
            usuarioId: user.id
        };
        await fetch(`${API}/ingresos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
        
        alert("¡Fechas guardadas!");
        await refreshAll();
    } catch(err) {
        alert("Error al guardar en la base de datos.");
    }
};

window.configurarNombresPrestamo = function() {
    const guardado = localStorage.getItem(`nombres_prestamo_${user.id}`);
    const configActual = guardado ? JSON.parse(guardado) : { n1: "Persona 1", n2: "Persona 2" };
    
    const nombre1 = prompt("Ingresá el nombre de la 1° Persona (Ej: Mamá, Juan):", configActual.n1);
    if (nombre1 === null) return; 
    
    const nombre2 = prompt("Ingresá el nombre de la 2° Persona (Ej: Belén, Pedro):", configActual.n2);
    if (nombre2 === null) return;

    if (nombre1.trim() !== "" && nombre2.trim() !== "") {
        localStorage.setItem(`nombres_prestamo_${user.id}`, JSON.stringify({ n1: nombre1.trim(), n2: nombre2.trim() }));
        cargarNombresPrestamo();
        alert("¡Nombres actualizados con éxito!");
    }
};

function cargarNombresPrestamo() {
    if (!user) return;
    const guardado = localStorage.getItem(`nombres_prestamo_${user.id}`);
    const config = guardado ? JSON.parse(guardado) : { n1: "Persona 1", n2: "Persona 2" };

    const labels1 = ["labelTotal1", "labelTabla1", "labelModal1"];
    const labels2 = ["labelTotal2", "labelTabla2", "labelModal2"];

    labels1.forEach(id => { if(document.getElementById(id)) document.getElementById(id).textContent = config.n1; });
    labels2.forEach(id => { if(document.getElementById(id)) document.getElementById(id).textContent = config.n2; });
}

window.toggleSaldos = function() {
    saldosOcultos = !saldosOcultos; 
    const icono = document.getElementById("iconoSaldos");
    if(icono) icono.textContent = saldosOcultos ? "visibility_off" : "visibility";
    refreshAll();
};

window.toggleSaldosTarjetas = function() {
    saldosTarjetasOcultos = !saldosTarjetasOcultos; 
    const icono = document.getElementById("iconoSaldosTarjetas");
    if(icono) icono.textContent = saldosTarjetasOcultos ? "visibility_off" : "visibility";
    refreshAll();
};

window.toggleSaldosAhorros = function() {
    saldosAhorrosOcultos = !saldosAhorrosOcultos; 
    const icono = document.getElementById("iconoSaldosAhorros");
    if(icono) icono.textContent = saldosAhorrosOcultos ? "visibility_off" : "visibility";
    refreshAll();
};

window.toggleSaldosNeto = function() {
    saldosNetoOcultos = !saldosNetoOcultos; 
    refreshAll();
};


/* ==========================================================================
   8. CORAZÓN DE LA APLICACIÓN (refreshAll, DOMContentLoaded e Init)
   ========================================================================== */

async function refreshAll() {
    if(!user) return; 
    cargarNombresPrestamo(); 

    const [categorias, billeteras, tarjetas, gTodos, iTodos, pTodos] = await Promise.all([
        fetchCategorias(),
        fetchBilleteras(),
        fetchYRenderizarMisTarjetas(),
        fetchGastos(),
        fetchIngresos(),
        fetchPrestamos()
    ]);

    globalBilleteras = billeteras || [];
  
	const selectMes = document.getElementById("filtroMes");
	const selectAnio = document.getElementById("filtroAnio");
	const mesSeleccionado = (selectMes && selectAnio) ? `${selectAnio.value}-${selectMes.value}` : new Date().toISOString().slice(0, 7);

    let textoVencimientoTarjetas = "Según tarjeta";
    const configMensual = iTodos.find(i => (i.descripcion || "").includes(`[CONFIG_TC] ${mesSeleccionado}`));
    
    if (configMensual) {
        const partes = configMensual.descripcion.split("|");
        const cCierre = partes[1] ? partes[1].split(":")[1].trim() : "";
        const cVto = partes[2] ? partes[2].split(":")[1].trim() : "";
        
        const fc = document.getElementById("fechaCierreMes");
        const fv = document.getElementById("fechaVtoMes");
        if(fc) fc.value = cCierre !== "undefined" ? cCierre : "";
        if(fv) fv.value = cVto !== "undefined" ? cVto : "";
        
        if (cVto && cVto !== "undefined" && cVto !== "") {
            textoVencimientoTarjetas = cVto; 
        }
    } else {
        const fc = document.getElementById("fechaCierreMes");
        const fv = document.getElementById("fechaVtoMes");
        if(fc) fc.value = "";
        if(fv) fv.value = "";
    }
    
    const gFiltradosMes = gTodos.filter(g => {
        const fechaComparar = g.mesImpacto ? g.mesImpacto : (g.fechaVencimiento ? g.fechaVencimiento : g.fecha);
        return (fechaComparar || "").startsWith(mesSeleccionado);
    });

    const prestamosDelMes = pTodos.filter(p => (p.mesCuota || "").startsWith(mesSeleccionado));
    let sumaTotalMiaPrestamos = 0;
    prestamosDelMes.forEach(p => {
        sumaTotalMiaPrestamos += (Number(p.aporteBelen) || 0); 
    });

    if (sumaTotalMiaPrestamos > 0) {
        let nombreVirtual = user.nombre ? user.nombre.split(" ")[0].charAt(0).toUpperCase() + user.nombre.split(" ")[0].slice(1).toLowerCase() : 'vos';
        
        gFiltradosMes.push({
            id: 'virtual_prestamo',
            descripcion: `Resumen Préstamos (Pagado por ${nombreVirtual})`,
            monto: sumaTotalMiaPrestamos,
            fechaVencimiento: "Automático",
            categoriaNombre: "🤝 Préstamos",
            pagado: false,
            medioPago: "MÚLTIPLES",
            esFijo: true,
            esVirtual: true
        });
    }
  
    const iFiltradosMes = iTodos.filter(i => {
        const fechaComparar = i.mesImpacto ? i.mesImpacto : i.fecha;
        return (fechaComparar || "").startsWith(mesSeleccionado);
    });

    const catFilter = document.getElementById("filtroCategoriaSelect") ? document.getElementById("filtroCategoriaSelect").value : "all";
    let gParaTablasYGrafico = [...gFiltradosMes]; 
    
    if (catFilter !== "all" && catFilter !== "") {
        gParaTablasYGrafico = gFiltradosMes.filter(g => String(g.categoriaId) === String(catFilter) || g.categoriaNombre === "🤝 Préstamos");
    }

    const inversiones = iTodos.filter(i => (i.descripcion || "").includes("INV:"));
    const ingresosNormales = iFiltradosMes.filter(i => !(i.descripcion || "").includes("INV:") && !(i.descripcion || "").includes("[CONFIG_TC]"));

    let totalUSD = 0;
    let totalARS_Inv = 0;
    inversiones.forEach(inv => {
        const monto = Number(inv.monto) || 0;
        if (inv.descripcion.includes("(USD)")) totalUSD += monto;
        else totalARS_Inv += monto;
    });

	const divUSD = document.querySelector("#ahorros .card:nth-child(1) .highlight");
	const divARS = document.querySelector("#ahorros .card:nth-child(2) .highlight");
	  
	const textoRealUSD = `USD ${totalUSD.toFixed(2)}`;
	const textoRealARS = formatoMoneda(totalARS_Inv);

	const aplicarMagia = (elemento, textoReal, estaOculto) => {
	      if (!elemento) return;
	      if (estaOculto) {
	          elemento.innerHTML = "••••••";
	          elemento.onmouseover = () => elemento.innerHTML = textoReal;
	          elemento.onmouseout = () => elemento.innerHTML = "••••••";
	          elemento.ontouchstart = () => elemento.innerHTML = textoReal;
	          elemento.ontouchend = () => elemento.innerHTML = "••••••";
	          elemento.ontouchcancel = () => elemento.innerHTML = "••••••";
	          elemento.style.cursor = "pointer";
	          elemento.style.webkitTapHighlightColor = "transparent";
	          elemento.title = "Pasá el mouse o mantené apretado para ver";
	      } else {
	          elemento.innerHTML = textoReal;
	          elemento.onmouseover = null; elemento.onmouseout = null; 
	          elemento.ontouchstart = null; elemento.ontouchend = null; elemento.ontouchcancel = null;
	          elemento.style.cursor = "default";
	          elemento.title = "";
	      }
	};

	aplicarMagia(divUSD, textoRealUSD, saldosAhorrosOcultos);
	aplicarMagia(divARS, textoRealARS, saldosAhorrosOcultos);
  
	const totalG = gFiltradosMes.reduce((s, x) => {
	      const monto = Number(x.monto) || 0;
	      const esVariablePuro = !x.esFijo && !(x.descripcion && x.descripcion.includes("(Cuota"));
	      const esFijoPagado = x.esFijo && x.pagado;

	      if (esVariablePuro || esFijoPagado) return s + monto;
	      return s;
	}, 0);

    const totalI = ingresosNormales.reduce((s,x) => s + (Number(x.monto) || 0), 0);
    
	const balanceNeto = totalI - totalG;
	const porcentajeGastado = totalI > 0 ? Math.min((totalG / totalI) * 100, 100) : (totalG > 0 ? 100 : 0);
	    
	let colorTermometro = '#10b981'; 
	if (porcentajeGastado > 75) colorTermometro = '#f59e0b'; 
	if (porcentajeGastado > 90) colorTermometro = '#ef4444'; 

    const gastosPorCategoria = {};
    gFiltradosMes.forEach(g => {
        if(!g.esVirtual && g.categoriaNombre !== "🤝 Préstamos") {
            let nombreCat = g.categoriaNombre;
            if (!nombreCat || String(nombreCat).toLowerCase() === 'null' || String(nombreCat) === 'undefined') {
                nombreCat = "💳 Consumos de Tarjeta"; 
            }
            gastosPorCategoria[nombreCat] = (gastosPorCategoria[nombreCat] || 0) + Number(g.monto);
        }
    });
		    
    const topCats = Object.entries(gastosPorCategoria)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 3);

    let htmlTopCats = '<div style="margin-top: 25px; border-top: 1px solid #f1f5f9; padding-top: 15px;"><div style="font-size: 0.75rem; color: #64748b; font-weight: 700; margin-bottom: 15px; text-transform: uppercase;">🔥 Top Categorías del Mes</div>';
    
    topCats.forEach(cat => {
        const nombreCat = cat[0];
        const montoCat = cat[1];
        const pctCat = totalG > 0 ? (montoCat / totalG) * 100 : 0;
        
        htmlTopCats += `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                    <span style="color: #334155; font-weight: 600;">${nombreCat}</span>
                    <span style="color: #64748b; font-weight: bold;">${formatoMoneda(montoCat)} <span style="font-size: 0.7rem; font-weight: normal;">(${pctCat.toFixed(1)}%)</span></span>
                </div>
                <div style="width: 100%; background: #f1f5f9; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${pctCat}%; background: #3b82f6; height: 100%; border-radius: 4px; transition: width 1s ease;"></div>
                </div>
            </div>
        `;
    });
    
    if(topCats.length === 0) htmlTopCats += '<p style="font-size: 0.85rem; color: #94a3b8;">Aún no hay gastos categorizados este mes.</p>';
    htmlTopCats += '</div>';

    let containerGasto = document.getElementById("totalGastoWidget");
    if(!containerGasto) {
        const oldP = document.getElementById("totalGastado");
        if(oldP) {
            const parent = oldP.closest('.card');
            if(parent) {
                parent.id = "totalGastoWidget";
                parent.style.cssText = "background: #ffffff; border-radius: 20px; box-shadow: 0 8px 30px rgba(0,0,0,0.04); padding: 24px; border: 1px solid #f1f5f9; margin-top: 15px; width: 100%; box-sizing: border-box; overflow: hidden;";
            }
        }
    }
    
    containerGasto = document.getElementById("totalGastoWidget");
    if(containerGasto) {
        const montoRealNeto = formatoMoneda(balanceNeto);
        const montoRealGasto = formatoMoneda(totalG);
        const montoRealIngreso = formatoMoneda(totalI);
        
        const colorSaldoNeto = balanceNeto >= 0 ? '#2ac9bb' : '#B80B0B'; 

        let pctBarraGastos = 0;
        if (totalI > 0) {
            pctBarraGastos = (totalG / totalI) * 100;
            if (pctBarraGastos > 100) pctBarraGastos = 100; 
        } else if (totalG > 0) {
            pctBarraGastos = 100;
        }

        const textoNetoMostrar = saldosNetoOcultos ? "••••••" : montoRealNeto;
        const textoGastoMostrar = saldosNetoOcultos ? "••••••" : montoRealGasto;
        const textoIngresoMostrar = saldosNetoOcultos ? "••••••" : montoRealIngreso;

        const hoverLogic = saldosNetoOcultos 
            ? `onmouseover="this.textContent = '${montoRealNeto}'" onmouseout="this.textContent = '••••••'" ontouchstart="this.textContent = '${montoRealNeto}'" ontouchend="this.textContent = '••••••'" ontouchcancel="this.textContent = '••••••'"` 
            : "";
        const cursorLogic = saldosNetoOcultos ? "cursor: pointer;" : "cursor: default;";
        const iconoOjo = saldosNetoOcultos ? "visibility_off" : "visibility";

        containerGasto.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">SALDO NETO</div>
                <button onclick="toggleSaldosNeto()" style="background: none; border: none; color: #94a3b8; cursor: pointer; display: flex; align-items: center; padding: 0;" title="Ocultar/Mostrar saldos">
                    <span class="material-icons" style="font-size: 18px; transition: color 0.2s;">${iconoOjo}</span>
                </button>
            </div>
            
            <div id="saldoNetoProtagonista" 
                 ${hoverLogic}
                 title="${saldosNetoOcultos ? 'Mantené apretado para ver' : ''}"
                 style="font-size: clamp(1.8rem, 6vw, 2.8rem); font-weight: 800; color: ${colorSaldoNeto}; letter-spacing: -1px; line-height: 1.1; ${cursorLogic} -webkit-tap-highlight-color: transparent; margin-bottom: 25px; word-break: break-word; text-align: left;">${textoNetoMostrar}</div>
            
                 <div class="info-barra">
                     <div id="caja-gastos-finty">Gastos: ${textoGastoMostrar}</div>
                     <div id="caja-ingresos-finty">Ingresos: ${textoIngresoMostrar}</div>
                 </div>
            
            <div style="width: 100%; background: #2ac9bb; height: 12px; border-radius: 6px; overflow: hidden; margin-bottom: 8px; position: relative;">
                <div style="width: ${pctBarraGastos}%; background: #FF5454; height: 100%; border-radius: 6px; transition: width 1s ease; position: absolute; left: 0; top: 0;"></div>
            </div>
            
            <div style="text-align: right; font-size: 0.75rem; font-weight: 700; color: #FF5454; margin-bottom: 20px;">
                ${totalI > 0 ? (totalG / totalI * 100).toFixed(1) : (totalG > 0 ? '100+' : '0')}% consumido
            </div>

            ${htmlTopCats}
        `;
    }

    const elBal = document.getElementById("balanceTotal");
    if(elBal) {
        const bal = totalI - totalG;
        elBal.textContent = formatoMoneda(bal);
        elBal.className = "highlight " + (bal >= 0 ? "positivo" : "negativo");
    }
  
    const gVariablesParaTabla = gParaTablasYGrafico.filter(g => !g.esFijo && !(g.descripcion && g.descripcion.includes("(Cuota")));
    const gFijosParaTabla = gParaTablasYGrafico.filter(g => g.esFijo); 

    const baseMediosTC = ["BNA", "MERCADO PAGO", "EFECTIVO", "MERCADO_PAGO", "PENDIENTE", "MÚLTIPLES"];
    globalBilleteras.forEach(b => baseMediosTC.push(b.nombre.toUpperCase()));

    const consumosTarjeta = gParaTablasYGrafico.filter(g => !baseMediosTC.includes((g.medioPago||"").toUpperCase()));
  
    const totalesTarjetasARS = {};
    const totalesTarjetasUSD = {};
    let sumaTotalTarjetasARS = 0;
    let sumaTotalTarjetasUSD = 0;

    consumosTarjeta.forEach(g => {
        const m = g.medioPago || "Tarjeta Desconocida";
        const monto = Number(g.monto) || 0;
        if ((g.descripcion || "").includes("[USD]")) {
            totalesTarjetasUSD[m] = (totalesTarjetasUSD[m] || 0) + monto;
            sumaTotalTarjetasUSD += monto;
        } else {
            totalesTarjetasARS[m] = (totalesTarjetasARS[m] || 0) + monto;
            sumaTotalTarjetasARS += monto;
        }
    });

	globalTarjetas.forEach(t => {
	      const idMonto = "monto-tarjeta-" + t.id;
	      const totalARS = totalesTarjetasARS[t.nombre] || 0;
	      const totalUSD = totalesTarjetasUSD[t.nombre] || 0;
	      const el = document.getElementById(idMonto);
	      
	      if (el) {
	          let textoRealHTML = formatoMoneda(totalARS);
	          if (totalUSD > 0) {
	              textoRealHTML += `<br><span style="font-size: 1.1rem; color: #86efac;">USD ${totalUSD.toFixed(2)}</span>`;
	          }
	          
	          if (saldosTarjetasOcultos) {
	              el.innerHTML = "••••••";
	              el.onmouseover = () => el.innerHTML = textoRealHTML;
	              el.onmouseout = () => el.innerHTML = "••••••";
	              el.ontouchstart = () => el.innerHTML = textoRealHTML;
	              el.ontouchend = () => el.innerHTML = "••••••";
	              el.ontouchcancel = () => el.innerHTML = "••••••";
	              el.style.cursor = "pointer";
	              el.style.webkitTapHighlightColor = "transparent";
	              el.title = "Pasá el mouse o mantené apretado para ver";
	          } else {
	              el.innerHTML = textoRealHTML;
	              el.onmouseover = null; el.onmouseout = null; 
	              el.ontouchstart = null; el.ontouchend = null; el.ontouchcancel = null;
	              el.style.cursor = "default";
	              el.title = "";
	          }
	      }
	});

    if (sumaTotalTarjetasARS > 0) {
        gFijosParaTabla.push({
            id: 'virtual_tarjeta_ars', 
            descripcion: `Resumen Tarjetas (Pesos)`,
            monto: sumaTotalTarjetasARS,
            fechaVencimiento: textoVencimientoTarjetas, 
            categoriaNombre: "💳 Tarjetas", 
            pagado: false,
            medioPago: "MÚLTIPLES",
            esVirtual: true 
        });
    }

    if (sumaTotalTarjetasUSD > 0) {
        gFijosParaTabla.push({
            id: 'virtual_tarjeta_usd', 
            descripcion: `Resumen Tarjetas (Dólares)`,
            monto: sumaTotalTarjetasUSD,
            fechaVencimiento: textoVencimientoTarjetas, 
            categoriaNombre: "💳 Tarjetas", 
            pagado: false,
            medioPago: "MÚLTIPLES",
            esVirtual: true,
            isUSD: true 
        });
    }

    renderGastosVariables(gVariablesParaTabla); 
    renderGastosFijos(gFijosParaTabla); 
    renderIngresos(ingresosNormales);
    renderInversiones(inversiones);
    generarGrafico(gParaTablasYGrafico);
    renderConsumosCuotas(gParaTablasYGrafico); 
    renderPrestamos(pTodos); 

    const gHistoricos = gTodos.filter(g => (g.fecha || "").startsWith(mesSeleccionado));
    const iHistoricos = iTodos.filter(i => (i.fecha || "").startsWith(mesSeleccionado));

    const ingresosParaSaldos = iHistoricos.filter(i => !(i.descripcion || "").includes("INV:") && !(i.descripcion || "").includes("[CONFIG_TC]"));

    calcularSaldosPorCuenta(gHistoricos, ingresosParaSaldos);
    actualizarMediosDePagoSelects();
    renderProyeccion(ingresosNormales, gFijosParaTabla, gVariablesParaTabla, inversiones);
}

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (menuToggle && sidebar && overlay) {
        menuToggle.onclick = () => { sidebar.classList.add('active'); overlay.classList.add('active'); };
        overlay.onclick = () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); };
    }
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = () => {
            if (item.id === "logoutBtn") {
                localStorage.clear();
                window.location.href = "login.html";
                return;
            }

            if (sidebar && overlay) {
                sidebar.classList.remove('active'); 
                overlay.classList.remove('active');
            }

            const sectionId = item.getAttribute('data-section');
            if(!sectionId) return;

            if (sectionId === "proyeccion") {
                document.getElementById('modalProyeccion').style.display = 'flex';
                return;
            }

            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.page').forEach(page => page.classList.remove('visible'));
            document.getElementById(sectionId).classList.add('visible');

			const btnIngreso = document.getElementById('btnFabIngreso');
			            const btnGasto = document.getElementById('btnFabGasto');
			            const fabContainer = document.querySelector('.fab-container'); 

			            if (btnIngreso && btnGasto && fabContainer) {
			                if (sectionId === 'ahorros' || sectionId === 'perfil' || sectionId === 'prestamos') {
			                    fabContainer.style.display = 'none';
			                } else {
			                    fabContainer.style.display = 'flex';
			                    btnIngreso.style.display = 'flex';
			                    btnGasto.style.display = 'flex';
			      }
			  }
        };
    });

    const fabMain = document.getElementById('fabMain');
    const fabOptions = document.getElementById('fabOptions');
    
    if (fabMain && fabOptions) {
        fabMain.onclick = (e) => { 
            e.stopPropagation(); 
            fabOptions.classList.toggle('show'); 
        };
    }
    
    document.addEventListener('click', () => {
        if(fabOptions) fabOptions.classList.remove('show');
    });

    const chkPagado = document.getElementById('gastoPagado');
    const divFechaPagoReal = document.getElementById('divFechaPagoReal');
    
    if (chkPagado && divFechaPagoReal) {
        chkPagado.onchange = (e) => {
            divFechaPagoReal.style.display = e.target.checked ? 'block' : 'none';
            if (e.target.checked && !document.getElementById('gastoFecha').value) {
                document.getElementById('gastoFecha').value = new Date().toISOString().split('T')[0];
            }
        };
    }

	const btnFabGasto = document.getElementById('btnFabGasto');
	    if (btnFabGasto) btnFabGasto.onclick = () => { 
	        document.getElementById('formGasto').reset(); 
	        document.getElementById('gastoId').value = ""; 
	        gastoEnEdicion = null; 
	        
	        const hoy = new Date().toISOString().split('T')[0];
	        document.getElementById('gastoVencimiento').value = hoy;
	        
	        if(chkPagado) chkPagado.checked = false;
	        if(divFechaPagoReal) divFechaPagoReal.style.display = 'none';

	        document.getElementById('modalGasto').style.display = 'flex';
	    };
    
	const btnFabIngreso = document.getElementById('btnFabIngreso');
	    if (btnFabIngreso) btnFabIngreso.onclick = () => { 
	        document.getElementById('formIngreso').reset();
	        document.getElementById('ingresoId').value = "";
	        
	        const hoy = new Date().toISOString().split('T')[0];
	        document.getElementById('ingresoFecha').value = hoy;
	        
	        const mesImpactoInput = document.getElementById('ingresoMesImpacto');
	        if (mesImpactoInput) mesImpactoInput.value = "";

	        document.getElementById('modalIngreso').style.display = 'flex'; 
	    };
    
    const btnFabTarjeta = document.getElementById('btnFabTarjeta');
    if (btnFabTarjeta) btnFabTarjeta.onclick = () => { 
        document.getElementById('formTarjeta').reset();
        document.getElementById('modalTarjeta').style.display = 'flex'; 
    };

    const btnGestionarCategorias = document.getElementById('btnGestionarCategorias');
    if (btnGestionarCategorias) btnGestionarCategorias.onclick = () => { document.getElementById('modalCategorias').style.display = 'flex'; };

    document.querySelectorAll('.close').forEach(btn => {
        btn.onclick = () => { btn.closest('.modal').style.display = 'none'; };
    });

	const chkFijo = document.getElementById('gastoEsFijo');
	    const camposFijos = document.getElementById('camposFijos');
	    const labelText = document.getElementById('labelTextGasto');

	    if (chkFijo && camposFijos) {
	        chkFijo.onchange = (e) => {
	            camposFijos.style.display = e.target.checked ? 'block' : 'none';
	            if (labelText) {
	                labelText.textContent = e.target.checked ? "📅 Fecha de Vencimiento" : "📅 Fecha del Gasto (Dejalo vacío si ya lo pagaste)";
	            }
	        };
	    }
});

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.onclick = () => { 
        localStorage.clear(); 
        window.location.href="login.html"; 
    };
}

(async function init() { 
    await fetchUserInfo(); 
    cargarSelectorFechas(); 
    await refreshAll(); 
})();