// --- CONFIGURACIÓN DE PRODUCCIÓN ---
const API = "https://backend-gastos-definitivo-production.up.railway.app/api";
const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "login.html";
}

let user = null;
let miGrafico = null; 
let globalGastos = [];
let globalIngresos = [];
let globalTarjetas = []; 
let globalBilleteras = []; 
let gastoEnEdicion = null; 
window.saldosActuales = {};

function authHeaders() {
    return { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${token}` 
    };
}

function handleAuthError(res) {
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("token"); 
        window.location.href = "login.html"; 
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
        bna: "#2ac9bb, #0f766e", 
        naranja: "#f97316, #7c2d12", 
        azul: "#1e3a5f, #0f172a", 
        celeste: "#009ee3, #0284c7", 
        violeta: "#8b5cf6, #4c1d95", 
        verde: "#166534, #064e3b", 
        negro: "#262626, #000000" 
    };
    return `linear-gradient(135deg, ${m[color] || "#333333, #111111"})`;
}

/* --- GRÁFICOS --- */
function generarGrafico(gastos) {
    const canvas = document.getElementById('gastosChart');
    if (!canvas) return;
    if (miGrafico) { 
        miGrafico.destroy(); 
        miGrafico = null; 
    }
    const ctx = canvas.getContext('2d');
    const datosAgrupados = {};
  
    gastos.forEach(g => {
        const cat = g.categoriaNombre || "Sin categoría";
        datosAgrupados[cat] = (datosAgrupados[cat] || 0) + (Number(g.monto) || 0);
    });

    miGrafico = new Chart(ctx, {
        type: 'doughnut', 
        data: {
            labels: Object.keys(datosAgrupados),
            datasets: [{ 
                data: Object.values(datosAgrupados), 
                backgroundColor: ['#2ac9bb', '#ff6384', '#36a2eb', '#ffce56', '#9966ff', '#f97316', '#8b5cf6', '#eab308'], 
                borderWidth: 2, 
                borderColor: '#1a1a1a' 
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'bottom', labels: { color: '#ffffff' } } 
            } 
        }
    });
}

/* --- SALDOS Y BILLETERAS --- */
function calcularSaldosPorCuenta(gastos, ingresos) {
    const billeterasNombres = ["BNA", "MERCADO PAGO", "EFECTIVO"];
    
    globalBilleteras.forEach(b => {
        const nom = b.nombre.toUpperCase();
        if (!billeterasNombres.includes(nom)) {
            billeterasNombres.push(nom);
        }
    });

    const saldos = {};
    billeterasNombres.forEach(b => saldos[b] = 0);

    ingresos.forEach(i => { 
        let m = (i.medioPago || "EFECTIVO").toUpperCase(); 
        if (m === "MERCADO_PAGO") m = "MERCADO PAGO";
        if (saldos[m] !== undefined) saldos[m] += (Number(i.monto) || 0); 
    });
    
    gastos.forEach(g => { 
        if (g.pagado === false) return; 
        let m = (g.medioPago || "EFECTIVO").toUpperCase(); 
        if (m === "MERCADO_PAGO") m = "MERCADO PAGO";
        if (saldos[m] !== undefined) saldos[m] -= (Number(g.monto) || 0); 
    });
    
    window.saldosActuales = saldos;

    const contenedor = document.getElementById("contenedorBilleteras");
    if (contenedor) {
        contenedor.innerHTML = "";
        billeterasNombres.forEach(b => {
            let color = "#ffce56"; 
            if(b === "BNA") color = "#2ac9bb";
            if(b === "MERCADO PAGO") color = "#00aae4";
            if(b !== "BNA" && b !== "MERCADO PAGO" && b !== "EFECTIVO") color = "#a855f7"; 

            const customObj = globalBilleteras.find(x => x.nombre.toUpperCase() === b);
            let btnEliminar = '';
            
            if(customObj) {
                btnEliminar = `<button onclick="eliminarBilletera(${customObj.id})" style="position: absolute; top: 5px; right: 5px; background: none; border: none; cursor: pointer; color: #888; font-size: 0.9rem;" title="Eliminar cuenta">✖</button>`;
            }

            contenedor.innerHTML += `
            <div class="card-small" style="min-width: 160px; background: var(--bg-saldos); padding: 15px; border-radius: 12px; border-left: 4px solid ${color}; position: relative;">
                ${btnEliminar}
                <h4 style="color: #94a3b8; font-size: 0.8rem; margin: 0;">🏦 ${b}</h4>
                <p style="font-size: 1.3rem; font-weight: bold; color: ${color}; margin: 5px 0 0 0;">${formatoMoneda(saldos[b])}</p>
            </div>`;
        });
    }
}

function cargarSelectorFechas() {
    const selector = document.getElementById("filtroFechaMes");
    if (!selector) return;
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    selector.innerHTML = "";
    [2025, 2026, 2027, 2028].forEach(anio => {
        meses.forEach((mes, index) => {
            const option = document.createElement("option");
            const mesNum = (index + 1).toString().padStart(2, '0');
            option.value = `${anio}-${mesNum}`; 
            option.textContent = `${mes} ${anio}`;
            selector.appendChild(option);
        });
    });
    const hoy = new Date();
    selector.value = `${hoy.getFullYear()}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}`;
    selector.onchange = () => refreshAll();
}

/* --- API CALLS --- */
async function fetchUserInfo() {
    try {
        const res = await fetch(`${API}/usuarios/me`, { headers: authHeaders() });
        handleAuthError(res);
        user = await res.json();
        const emailDiv = document.getElementById("userEmail");
        if(emailDiv) { 
            emailDiv.textContent = "👤 " + user.email; 
            emailDiv.style.color = "#ffce56"; 
            emailDiv.style.fontWeight = "bold"; 
        }
    } catch (e) { 
        localStorage.removeItem("token"); 
        window.location.href = "login.html"; 
    }
}

function cargarNombresPrestamo() {
    if (!user) return;
    const guardado = localStorage.getItem(`nombres_prestamo_${user.id}`);
    const config = guardado ? JSON.parse(guardado) : { n1: "Persona 1", n2: "Persona 2" };
    ["labelTotal1", "labelTabla1", "labelModal1"].forEach(id => { if(document.getElementById(id)) document.getElementById(id).textContent = config.n1; });
    ["labelTotal2", "labelTabla2", "labelModal2"].forEach(id => { if(document.getElementById(id)) document.getElementById(id).textContent = config.n2; });
}

window.configurarNombresPrestamo = function() {
    const guardado = localStorage.getItem(`nombres_prestamo_${user.id}`);
    const configActual = guardado ? JSON.parse(guardado) : { n1: "Persona 1", n2: "Persona 2" };
    const nombre1 = prompt("Ingresá el nombre de la 1° Persona:", configActual.n1);
    if (nombre1 === null) return; 
    const nombre2 = prompt("Ingresá el nombre de la 2° Persona:", configActual.n2);
    if (nombre2 === null) return;
    if (nombre1.trim() !== "" && nombre2.trim() !== "") {
        localStorage.setItem(`nombres_prestamo_${user.id}`, JSON.stringify({ n1: nombre1.trim(), n2: nombre2.trim() }));
        cargarNombresPrestamo();
        alert("¡Nombres actualizados!");
    }
};

async function fetchCategorias() { 
    try { 
        const res = await fetch(`${API}/categorias`, { headers: authHeaders() }); 
        handleAuthError(res);
        const todas = await res.json(); 
        const misCategorias = todas.filter(cat => String(cat.usuarioId) === String(user.id) || (cat.usuario && String(cat.usuario.id) === String(user.id)));
        renderCategorias(misCategorias); 
        return misCategorias; 
    } catch (e) { return []; } 
}

async function fetchGastos() { 
    const res = await fetch(`${API}/gastos/usuario/${user.id}`, { headers: authHeaders() }); 
    handleAuthError(res);
    const todos = await res.json(); 
    globalGastos = todos.filter(g => String(g.usuarioId) === String(user.id) || (g.usuario && String(g.usuario.id) === String(user.id)));
    return globalGastos; 
}

async function fetchIngresos() { 
    const res = await fetch(`${API}/ingresos/usuario/${user.id}`, { headers: authHeaders() }); 
    handleAuthError(res);
    const todos = await res.json(); 
    globalIngresos = todos.filter(i => String(i.usuarioId) === String(user.id) || (i.usuario && String(i.usuario.id) === String(user.id)));
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
        const res = await fetch(`${API}/tarjetas/usuario/${user.id}`, { headers: authHeaders() });
        if (!res.ok) throw new Error("Error trayendo tarjetas");
        const todas = await res.json();
        globalTarjetas = todas.filter(t => String(t.usuarioId) === String(user.id) || (t.usuario && String(t.usuario.id) === String(user.id)));

        const contenedor = document.getElementById("contenedorMisTarjetas");
        if (!contenedor) return; 
        contenedor.innerHTML = ""; 
        
        if (globalTarjetas.length === 0) {
            contenedor.innerHTML = `<p style="color: #888; text-align: center; width: 100%;">No tenés tarjetas de crédito guardadas.</p>`;
            return;
        }
        
        globalTarjetas.forEach(t => {
            contenedor.innerHTML += `
            <div class="card" style="background: ${getBgColor(t.color)}; border: none; position: relative; overflow: hidden; padding-bottom: 25px;">
                <div style="position: absolute; right: -20px; top: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.05); border-radius: 50%;"></div>
                <button onclick="eliminarMiTarjeta(${t.id})" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.3); border: none; color: white; padding: 6px 8px; border-radius: 50%; cursor: pointer; font-size: 1rem;">🗑️</button>
                <h3 style="color: #ffffff; display: flex; justify-content: space-between; align-items: center; border-bottom: none; margin-right: 30px; margin-top: 15px;">${t.nombre}</h3>
            </div>`;
        });
    } catch (error) {}
}

function actualizarMediosDePagoSelects() {
    const gastoMedio = document.getElementById("gastoMedio");
    const ingresoMedio = document.getElementById("ingresoMedio");
    const tarjetaTipo = document.getElementById("tarjetaTipo"); 
    
    let opcionesBilleteras = `<option value="BNA">🏦 BNA</option><option value="MERCADO PAGO">📱 Mercado Pago</option><option value="EFECTIVO">💵 Efectivo</option>`;
    globalBilleteras.forEach(b => { 
        opcionesBilleteras += `<option value="${b.nombre.toUpperCase()}">🏦 ${b.nombre}</option>`; 
    });

    let opcionesCredito = "";
    if (globalTarjetas.length === 0) { 
        opcionesCredito = '<option value="">No tenés tarjetas de crédito creadas</option>'; 
    } else { 
        globalTarjetas.forEach(t => { 
            opcionesCredito += `<option value="${t.nombre}">💳 ${t.nombre}</option>`; 
        }); 
    }

    if (gastoMedio) gastoMedio.innerHTML = opcionesBilleteras + opcionesCredito;
    if (ingresoMedio) ingresoMedio.innerHTML = opcionesBilleteras;
    if (tarjetaTipo) tarjetaTipo.innerHTML = opcionesCredito;
}

function renderCategorias(categorias) {
    categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const contadorEl = document.getElementById("countCategorias");
    if (contadorEl) contadorEl.textContent = categorias.length;

    const gSelect = document.getElementById("gastoCategoria");
    const iSelect = document.getElementById("ingresoCategoria");
    const filtroSel = document.getElementById("filtroCategoriaSelect");
    const listaCat = document.getElementById("listaCategoriasGestion");
  
    if (gSelect) {
        [gSelect, iSelect, filtroSel].forEach(select => {
            if (!select) return;
            const valPrevio = select.value;
            select.innerHTML = select === filtroSel ? '<option value="all">Mostrar todas</option>' : '<option value="">Sin categoría</option>';
            categorias.forEach(cat => { 
                const opt = document.createElement("option"); 
                opt.value = cat.id; 
                opt.textContent = cat.nombre; 
                select.appendChild(opt); 
            });
            if(valPrevio) select.value = valPrevio;
        });
        if (filtroSel) filtroSel.onchange = () => refreshAll();
    }

    if (listaCat) {
        listaCat.innerHTML = "";
        categorias.forEach(cat => {
            listaCat.innerHTML += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 5px;"><span>${cat.nombre}</span><button onclick="eliminarCategoria(${cat.id})" class="btn-delete" style="padding: 2px 6px; background: none; border: none; cursor: pointer; font-size: 1.2rem;">🗑️</button></div>`;
        });
    }
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
        const billeteras = ["BNA", "MERCADO PAGO", "EFECTIVO"];
        globalBilleteras.forEach(b => { if(!billeteras.includes(b.nombre.toUpperCase())) billeteras.push(b.nombre.toUpperCase()); });
        const saldos = window.saldosActuales || {};
        
        billeteras.forEach(b => {
            contenedorSaldos.innerHTML += `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #444; padding: 5px 0;"><span>🏦 ${b}:</span> <span style="font-weight: bold; color: #00aae4;">${formatoMoneda(saldos[b] || 0)}</span></div>`;
        });
    }
}

async function refreshAll() {
    await fetchCategorias(); 
    if(!user) return; 
  
    cargarNombresPrestamo(); 
    globalBilleteras = await fetchBilleteras(); 
    await fetchYRenderizarMisTarjetas(); 
  
    const gTodos = await fetchGastos(); 
    const iTodos = await fetchIngresos();
    const pTodos = await fetchPrestamos(); 
  
    const selector = document.getElementById("filtroFechaMes");
    const mesSeleccionado = selector ? selector.value : new Date().toISOString().slice(0, 7);
  
    const gFiltradosMes = gTodos.filter(g => { 
        const fechaComparar = g.fechaVencimiento ? g.fechaVencimiento : g.fecha; 
        return (fechaComparar||"").startsWith(mesSeleccionado); 
    });
    const iFiltradosMes = iTodos.filter(i => (i.fecha||"").startsWith(mesSeleccionado));

    const catFilter = document.getElementById("filtroCategoriaSelect") ? document.getElementById("filtroCategoriaSelect").value : "all";
    let gParaTablasYGrafico = [...gFiltradosMes]; 
    if (catFilter !== "all" && catFilter !== "") gParaTablasYGrafico = gFiltradosMes.filter(g => String(g.categoriaId) === String(catFilter));

    const inversiones = iTodos.filter(i => i.descripcion && i.descripcion.includes("INV:"));
    const ingresosNormales = iFiltradosMes.filter(i => !i.descripcion.includes("INV:"));

    let totalUSD = 0, totalARS_Inv = 0;
    inversiones.forEach(inv => {
        const monto = Number(inv.monto) || 0;
        if (inv.descripcion.includes("(USD)")) totalUSD += monto; else totalARS_Inv += monto;
    });

    const divUSD = document.querySelector("#ahorros .card:nth-child(1) .highlight");
    const divARS = document.querySelector("#ahorros .card:nth-child(2) .highlight");
    if(divUSD) divUSD.textContent = `USD ${totalUSD.toFixed(2)}`;
    if(divARS) divARS.textContent = formatoMoneda(totalARS_Inv);
  
    const totalG = gFiltradosMes.reduce((s,x) => s + (Number(x.monto) || 0), 0);
    const totalI = ingresosNormales.reduce((s,x) => s + (Number(x.monto) || 0), 0);
    if(document.getElementById("totalGastado")) document.getElementById("totalGastado").textContent = formatoMoneda(totalG);
  
    const elBal = document.getElementById("balanceTotal");
    if(elBal) { 
        const bal = totalI - totalG; 
        elBal.textContent = formatoMoneda(bal); 
        elBal.className = "highlight " + (bal >= 0 ? "positivo" : "negativo"); 
    }
  
    const gVariablesParaTabla = gParaTablasYGrafico.filter(g => !g.esFijo && !(g.descripcion && g.descripcion.includes("(Cuota")));
    const gFijosParaTabla = gParaTablasYGrafico.filter(g => g.esFijo); 
  
    renderGastosVariables(gVariablesParaTabla); 
    renderGastosFijos(gFijosParaTabla); 
    renderIngresos(ingresosNormales); 
    generarGrafico(gParaTablasYGrafico);
    renderConsumosCuotas(gParaTablasYGrafico); 
    renderPrestamos(pTodos); 

    const panelTarjetas = document.getElementById("panelResumenTarjetas");
    if (panelTarjetas) {
        const baseNombres = ["BNA", "MERCADO PAGO", "MERCADO_PAGO", "EFECTIVO"];
        globalBilleteras.forEach(b => baseNombres.push(b.nombre.toUpperCase()));
        const consumosTarjeta = gParaTablasYGrafico.filter(g => !baseNombres.includes((g.medioPago||"").toUpperCase()));
      
        const totalesTarjetas = {}; 
        let sumaTotal = 0;
        consumosTarjeta.forEach(g => {
            const m = g.medioPago || "Tarjeta Desconocida"; 
            const monto = Number(g.monto) || 0;
            totalesTarjetas[m] = (totalesTarjetas[m] || 0) + monto; 
            sumaTotal += monto;
        });

        document.getElementById("totalTarjetasMes").textContent = formatoMoneda(sumaTotal);
        const divDetalle = document.getElementById("detalleTarjetasMes");
        divDetalle.innerHTML = "";
        if (Object.keys(totalesTarjetas).length === 0) { 
            divDetalle.innerHTML = "<p style='color:#888; font-size: 0.9rem;'>No hay gastos de tarjeta programados.</p>"; 
        } else {
            for (const [tarjeta, total] of Object.entries(totalesTarjetas)) {
                divDetalle.innerHTML += `<div style="background: #222; padding: 15px; border-radius: 8px; border-left: 4px solid #00aae4; display: flex; flex-direction: column; gap: 5px;"><strong style="color:#94a3b8; font-size: 0.85rem;">💳 ${tarjeta}</strong><span style="font-size: 1.3rem; color: #fff; font-weight: bold;">${formatoMoneda(total)}</span></div>`;
            }
        }
    }

    const gHistoricos = gTodos.filter(g => (g.fecha||"").slice(0,7) <= mesSeleccionado);
    const iHistoricos = iTodos.filter(i => (i.fecha||"").slice(0,7) <= mesSeleccionado);
    calcularSaldosPorCuenta(gHistoricos, iHistoricos); 
  
    actualizarMediosDePagoSelects();
    renderProyeccion(ingresosNormales, gFijosParaTabla, gVariablesParaTabla, inversiones);
}

/* --- RENDER TABLAS --- */
function renderPrestamos(prestamos) {
    const tbody = document.querySelector("#tablaPrestamos tbody");
    if(!tbody) return; 
    tbody.innerHTML = "";
    let totalMama = 0, totalBelen = 0;
    prestamos.forEach(p => {
        const aMama = Number(p.aporteMama) || 0, aBelen = Number(p.aporteBelen) || 0, total = aMama + aBelen;
        totalMama += aMama; totalBelen += aBelen;
        tbody.innerHTML += `<tr><td>${p.mesCuota}</td><td>${formatoMoneda(aMama)}</td><td>${formatoMoneda(aBelen)}</td><td style="font-weight: bold; color: #2ac9bb;">${formatoMoneda(total)}</td><td><button onclick="eliminarPrestamo(${p.id})" class="btn-delete" style="background:none;border:none;cursor:pointer;font-size:1.1rem;">🗑️</button></td></tr>`;
    });
    if(document.getElementById("totalAporteMama")) document.getElementById("totalAporteMama").textContent = formatoMoneda(totalMama);
    if(document.getElementById("totalAporteBelen")) document.getElementById("totalAporteBelen").textContent = formatoMoneda(totalBelen);
}

function renderGastosFijos(lista) {
    const tbody = document.querySelector("#tablaGastosFijos tbody");
    if (!tbody) return; 
    tbody.innerHTML = ""; 
    let total = 0;
    lista.forEach(g => {
        total += (Number(g.monto) || 0);
        const acciones = `<button onclick="editarGasto(${g.id})" class="btn-edit" style="background:none;border:none;cursor:pointer;font-size:1.1rem;margin-right:5px;">✏️</button><button onclick="eliminarGasto(${g.id})" class="btn-delete" style="background:none;border:none;cursor:pointer;font-size:1.1rem;">🗑️</button>`;
        const vto = g.fechaVencimiento ? g.fechaVencimiento : "-";
        const estadoPagado = g.pagado ? "✅ Sí" : "❌ No";
        const fechaPagoReal = (g.pagado && g.fecha) ? g.fecha : "-";
        tbody.innerHTML += `<tr><td>${g.descripcion||"-"}</td><td style="font-weight: bold; color: #ffce56;">${formatoMoneda(g.monto)}</td><td>${vto}</td><td>${g.categoriaNombre||"-"}</td><td>${estadoPagado}</td><td>${fechaPagoReal}</td><td>${g.medioPago||"EFECTIVO"}</td><td>${acciones}</td></tr>`;
    });
    if (document.getElementById("totalFijos")) document.getElementById("totalFijos").textContent = formatoMoneda(total);
}

function renderGastosVariables(lista) {
    const tbody = document.querySelector("#tablaGastosVariables tbody");
    if (!tbody) return; 
    tbody.innerHTML = ""; 
    let total = 0;
    lista.forEach(g => {
        total += (Number(g.monto) || 0);
        const acciones = `<button onclick="editarGasto(${g.id})" class="btn-edit" style="background:none;border:none;cursor:pointer;font-size:1.1rem;margin-right:5px;">✏️</button><button onclick="eliminarGasto(${g.id})" class="btn-delete" style="background:none;border:none;cursor:pointer;font-size:1.1rem;">🗑️</button>`;
        const vto = g.fechaVencimiento ? g.fechaVencimiento : "-";
        const estadoPagado = g.pagado ? "✅ Sí" : "❌ No";
        const fechaPagoReal = (g.pagado && g.fecha) ? g.fecha : "-";
        tbody.innerHTML += `<tr><td>${g.descripcion||"-"}</td><td style="font-weight: bold; color: #2ac9bb;">${formatoMoneda(g.monto)}</td><td>${vto}</td><td>${g.categoriaNombre||"-"}</td><td>${estadoPagado}</td><td>${fechaPagoReal}</td><td>${g.medioPago||"EFECTIVO"}</td><td>${acciones}</td></tr>`;
    });
    if (document.getElementById("totalVariables")) document.getElementById("totalVariables").textContent = formatoMoneda(total);
}

function renderIngresos(ingresos) {
    const tbody = document.querySelector('#tablaIngresos tbody');
    if (!tbody) return; 
    tbody.innerHTML = '';
    ingresos.forEach(i => {
        const acciones = `<button onclick="eliminarIngreso(${i.id})" class="btn-delete" style="background:none;border:none;cursor:pointer;font-size:1.1rem;">🗑️</button>`;
        tbody.innerHTML += `<tr><td>${i.fecha}</td><td>${i.descripcion||'-'}</td><td>${i.medioPago||'EFECTIVO'}</td><td>${i.categoriaNombre||'-'}</td><td>${formatoMoneda(i.monto)}</td><td>${acciones}</td></tr>`;
    });
}

function renderConsumosCuotas(lista) {
    const tbody = document.querySelector("#tablaTarjetas tbody");
    if (!tbody) return; 
    tbody.innerHTML = "";
    const consumosTarjeta = lista.filter(g => g.descripcion && g.descripcion.includes("(Cuota"));
    consumosTarjeta.forEach(g => {
        const acciones = `<button onclick="eliminarGasto(${g.id})" class="btn-delete" style="padding: 2px 6px; margin-left: 10px; background: none; border: none; cursor: pointer; font-size: 1.1rem;">🗑️</button>`;
        let desc = g.descripcion || "-", badgeCuota = "";
        if (desc.includes("(Cuota")) {
            const partes = desc.split("(Cuota"); 
            desc = partes[0].trim();
            badgeCuota = `<span style="background: var(--color-primario); color: #000; padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 0.85rem;">Cuota ${partes[1].replace(")", "")}</span>`;
        }
        let tarjetaBadge = `<span style="color: #00aae4; font-weight: bold; font-size: 0.8rem; display: block; margin-top: 4px;">${g.medioPago}</span>`;
        tbody.innerHTML += `<tr><td>${g.fecha} ${tarjetaBadge}</td><td>${desc}</td><td>${badgeCuota}</td><td><div style="display:flex; justify-content:space-between; align-items:center;"><span>${formatoMoneda(g.monto)}</span><span>${acciones}</span></div></td></tr>`;
    });
}

/* --- FORM SUBMITS (CORREGIDOS) --- */
const formBilletera = document.getElementById("formBilletera");
if (formBilletera) {
    formBilletera.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = document.querySelector("#formBilletera button[type='submit']");
        btnSubmit.disabled = true;
        try {
            const body = { nombre: document.getElementById("billeteraNombre").value.trim(), usuario: { id: user.id } };
            const response = await fetch(`${API}/billeteras`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
            if(!response.ok) throw new Error("403");
            document.getElementById("modalBilletera").style.display = "none";
            formBilletera.reset();
            await refreshAll();
        } catch(err) { alert("El servidor rechazó la cuenta. Asegurate de que Railway terminó de cargar."); } 
        finally { btnSubmit.disabled = false; }
    };
}

const formNuevaTarjeta = document.getElementById("formNuevaTarjeta");
if (formNuevaTarjeta) {
    formNuevaTarjeta.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = document.querySelector("#formNuevaTarjeta button[type='submit']");
        btnSubmit.disabled = true;
        try {
            // CORREGIDO: Enviamos usuario como objeto
            const body = { 
                nombre: document.getElementById("nuevaTarjetaNombre").value.trim(), 
                diaCierre: 1, diaVencimiento: 1, 
                color: document.getElementById("nuevaTarjetaColor").value,
                usuario: { id: user.id } 
            };
            const response = await fetch(`${API}/tarjetas`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
            if(!response.ok) throw new Error("403");
            document.getElementById("modalNuevaTarjeta").style.display = "none";
            formNuevaTarjeta.reset();
            await refreshAll();
        } catch (error) { alert("El servidor rechazó la tarjeta. Revisá los permisos en Java."); } 
        finally { btnSubmit.disabled = false; }
    };
}

const formPrestamo = document.getElementById("formPrestamo");
if (formPrestamo) {
    formPrestamo.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = document.querySelector("#formPrestamo button[type='submit']");
        btnSubmit.disabled = true;
        try {
            const body = { mesCuota: document.getElementById("prestamoMes").value, aporteMama: parseFloat(document.getElementById("prestamoMama").value), aporteBelen: parseFloat(document.getElementById("prestamoBelen").value), usuario: { id: user.id } };
            const response = await fetch(`${API}/prestamos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
            if(!response.ok) throw new Error("403");
            document.getElementById("modalPrestamo").style.display = "none"; formPrestamo.reset(); await refreshAll();
        } catch(err) { alert("Error al crear préstamo."); } 
        finally { btnSubmit.disabled = false; }
    };
}

/* --- ELIMINAR --- */
window.eliminarBilletera = async function(id) {
    if(confirm("¿Seguro que querés eliminar esta cuenta?")) {
        await fetch(`${API}/billeteras/${id}`, { method: "DELETE", headers: authHeaders() });
        await refreshAll();
    }
};

window.eliminarMiTarjeta = async function(id) {
    if(confirm("¿Seguro que querés eliminar esta tarjeta de crédito?")) {
        await fetch(`${API}/tarjetas/${id}`, { method: "DELETE", headers: authHeaders() });
        await refreshAll(); 
    }
};

window.eliminarPrestamo = async function(id) {
    if(confirm("¿Eliminar cuota?")) { await fetch(`${API}/prestamos/${id}`, { method: "DELETE", headers: authHeaders() }); await refreshAll(); }
};

window.eliminarGasto = async function(id) { 
    const gasto = globalGastos.find(g => g.id === id);
    if (!gasto) return;
    if (!confirm(`¿Eliminar gasto "${gasto.descripcion}"?`)) return;

    if (gasto.esFijo) {
        if (confirm("Al ser un gasto fijo... ¿Querés eliminarlo también de TODOS los meses SIGUIENTES?")) {
            const res = await fetch(`${API}/gastos/usuario/${user.id}`, { headers: authHeaders() });
            const todos = await res.json();
            const gastosABorrar = todos.filter(g => (String(g.usuarioId) === String(user.id) || (g.usuario && String(g.usuario.id) === String(user.id))) && g.esFijo === true && g.descripcion === gasto.descripcion && g.fecha >= gasto.fecha);
            for (const g of gastosABorrar) await fetch(`${API}/gastos/${g.id}`, { method: "DELETE", headers: authHeaders() });
            alert("¡Se eliminó este gasto y todas sus repeticiones futuras!");
        } else { await fetch(`${API}/gastos/${id}`, { method: "DELETE", headers: authHeaders() }); }
    } else { await fetch(`${API}/gastos/${id}`, { method: "DELETE", headers: authHeaders() }); }
    await refreshAll(); 
};

/* --- OTROS FORMS --- */
const formGasto = document.getElementById("formGasto");
if (formGasto) {
    formGasto.onsubmit = async (e) => { 
        e.preventDefault(); 
        const btnSubmit = document.querySelector("#formGasto button[type='submit']");
        btnSubmit.disabled = true; btnSubmit.textContent = "Guardando...";

        try {
            const idAEditar = document.getElementById("gastoId").value, descripcion = document.getElementById("gastoDescripcion").value, monto = document.getElementById("gastoMonto").value, medioPago = document.getElementById("gastoMedio").value, esFijo = document.getElementById("gastoEsFijo").checked, categoriaId = document.getElementById("gastoCategoria").value || null;
            const fechaVto = document.getElementById("gastoVencimiento").value, pagado = document.getElementById("gastoPagado").checked, fechaReal = document.getElementById("gastoFecha").value;
            let fechaBase = pagado ? (fechaReal || fechaVto) : fechaVto;

            if (idAEditar) {
                if (esFijo && gastoEnEdicion && gastoEnEdicion.esFijo) {
                    if (confirm("Al ser un gasto fijo... ¿Querés guardar este cambio en TODOS los meses SIGUIENTES también?")) {
                        const res = await fetch(`${API}/gastos/usuario/${user.id}`, { headers: authHeaders() }); const todos = await res.json();
                        const futuros = todos.filter(g => (String(g.usuarioId) === String(user.id) || (g.usuario && String(g.usuario.id) === String(user.id))) && g.esFijo === true && g.descripcion === gastoEnEdicion.descripcion && g.fecha >= gastoEnEdicion.fecha);

                        for (const g of futuros) {
                            await fetch(`${API}/gastos/${g.id}`, { method: "DELETE", headers: authHeaders() });
                            let vtoFuturo = null;
                            if (fechaVto) {
                                const yDiff = parseInt(g.fecha.split('-')[0]) - parseInt(fechaVto.split('-')[0]), mDiff = parseInt(g.fecha.split('-')[1]) - parseInt(fechaVto.split('-')[1]);
                                const totalMesesAdelante = (yDiff * 12) + mDiff;
                                const [vYear, vMonth, vDay] = fechaVto.split('-');
                                let nm = parseInt(vMonth) + totalMesesAdelante, ny = parseInt(vYear);
                                while (nm > 12) { nm -= 12; ny += 1; }
                                vtoFuturo = `${ny}-${String(nm).padStart(2, '0')}-${vDay}`;
                            }
                            let isPagado = (g.id === parseInt(idAEditar)) ? pagado : false; let pFecha = (isPagado) ? fechaBase : vtoFuturo;
                            const body = { descripcion, monto, medioPago, fecha: pFecha, esFijo: true, usuarioId: user.id, categoriaId, fechaVencimiento: vtoFuturo, pagado: isPagado };
                            await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                        }
                        alert("¡Actualizado!");
                    } else {
                        await fetch(`${API}/gastos/${idAEditar}`, { method: "DELETE", headers: authHeaders() });
                        const body = { descripcion, monto, medioPago, fecha: fechaBase, esFijo, usuarioId: user.id, categoriaId, fechaVencimiento: fechaVto, pagado };
                        await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                    }
                } else {
                    await fetch(`${API}/gastos/${idAEditar}`, { method: "DELETE", headers: authHeaders() });
                    const body = { descripcion, monto, medioPago, fecha: fechaBase, esFijo, usuarioId: user.id, categoriaId, fechaVencimiento: fechaVto, pagado };
                    await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                }
            } else {
                if (esFijo) {
                    if (confirm("¿Programar para los próximos meses?")) {
                        const [year, month, day] = fechaVto.split('-');
                        for (let i = 0; i < 12; i++) {
                            let m = parseInt(month) + i, y = parseInt(year);
                            while (m > 12) { m -= 12; y += 1; }
                            let safeDay = parseInt(day) > 28 ? "28" : day; let nuevoVto = `${y}-${String(m).padStart(2, '0')}-${safeDay}`;
                            let isPagado = (i === 0) ? pagado : false; let pFecha = (i === 0 && pagado) ? fechaReal : nuevoVto;
                            const body = { descripcion, monto, medioPago, fecha: pFecha, esFijo: true, usuarioId: user.id, categoriaId, fechaVencimiento: nuevoVto, pagado: isPagado };
                            await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                        }
                        alert("¡Gasto fijo programado!");
                    } else {
                        const body = { descripcion, monto, medioPago, fecha: fechaBase, esFijo: true, usuarioId: user.id, categoriaId, fechaVencimiento: fechaVto, pagado };
                        await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                    }
                } else {
                    const body = { descripcion, monto, medioPago, fecha: fechaBase, esFijo: false, usuarioId: user.id, categoriaId, fechaVencimiento: fechaVto, pagado };
                    await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                }
            }
            document.getElementById("modalGasto").style.display = "none"; formGasto.reset(); await refreshAll(); 
        } catch (error) { alert("Error al guardar."); } finally { btnSubmit.disabled = false; btnSubmit.textContent = "Guardar"; }
    };
}

const formIngreso = document.getElementById("formIngreso");
if (formIngreso) {
    formIngreso.onsubmit = async (e) => { 
        e.preventDefault(); 
        try {
            const body = { descripcion: document.getElementById("ingresoDescripcion").value, monto: document.getElementById("ingresoMonto").value, medioPago: document.getElementById("ingresoMedio").value, fecha: document.getElementById("ingresoFecha").value, usuarioId: user.id, categoriaId: document.getElementById("ingresoCategoria").value || null };
            await fetch(`${API}/ingresos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
            document.getElementById("modalIngreso").style.display = "none"; formIngreso.reset(); await refreshAll(); 
        } catch(error) { alert("Error."); }
    };
}

const formTarjeta = document.getElementById("formTarjeta");
if (formTarjeta) {
    formTarjeta.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = document.querySelector("#formTarjeta button[type='submit']");
        btnSubmit.disabled = true;
        try {
            const descripcion = document.getElementById("tarjetaDescripcion").value, montoTotal = parseFloat(document.getElementById("tarjetaMontoTotal").value), cuotas = parseInt(document.getElementById("tarjetaCuotas").value), primeraCuota = document.getElementById("tarjetaPrimeraCuota").value, tarjetaTipo = document.getElementById("tarjetaTipo").value; 
            const montoPorCuota = (montoTotal / cuotas).toFixed(2);
            const [year, month] = primeraCuota.split('-');
            let fechaActual = new Date(year, month - 1, 10); 

            for (let i = 1; i <= cuotas; i++) {
                const yyyy = fechaActual.getFullYear(), mm = String(fechaActual.getMonth() + 1).padStart(2, '0');
                const textoDesc = cuotas === 1 ? descripcion : `${descripcion} (Cuota ${i}/${cuotas})`;
                const body = { descripcion: textoDesc, monto: montoPorCuota, medioPago: tarjetaTipo, fecha: `${yyyy}-${mm}-10`, esFijo: false, usuarioId: user.id, pagado: false };
                await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                fechaActual.setMonth(fechaActual.getMonth() + 1);
            }
            document.getElementById("modalTarjeta").style.display = "none"; formTarjeta.reset(); await refreshAll();
        } catch (error) { alert("Error."); } finally { btnSubmit.disabled = false; }
    };
}

/* --- DOMContentLoaded --- */
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle'), sidebar = document.getElementById('sidebar'), overlay = document.getElementById('sidebarOverlay');
    if (menuToggle && sidebar && overlay) {
        menuToggle.onclick = () => { sidebar.classList.add('active'); overlay.classList.add('active'); };
        overlay.onclick = () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); };
    }
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = () => {
            if (item.id === "logoutBtn") { localStorage.clear(); window.location.href = "login.html"; return; }
            if (sidebar && overlay) { sidebar.classList.remove('active'); overlay.classList.remove('active'); }
            const sectionId = item.getAttribute('data-section');
            if(!sectionId) return;
            if (sectionId === "proyeccion") { document.getElementById('modalProyeccion').style.display = 'flex'; return; }

            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.page').forEach(page => page.classList.remove('visible'));
            document.getElementById(sectionId).classList.add('visible');

            const fabContainer = document.querySelector('.fab-container'); 
            if (fabContainer) {
                if (['ahorros', 'perfil', 'prestamos'].includes(sectionId)) { fabContainer.style.display = 'none'; } 
                else { fabContainer.style.display = 'flex'; }
            }
        };
    });

    const fabMain = document.getElementById('fabMain'), fabOptions = document.getElementById('fabOptions');
    if (fabMain && fabOptions) { fabMain.onclick = (e) => { e.stopPropagation(); fabOptions.classList.toggle('show'); }; }
    document.addEventListener('click', () => { if(fabOptions) fabOptions.classList.remove('show'); });

    const chkPagado = document.getElementById('gastoPagado'), divFechaPagoReal = document.getElementById('divFechaPagoReal');
    if (chkPagado && divFechaPagoReal) {
        chkPagado.onchange = (e) => {
            divFechaPagoReal.style.display = e.target.checked ? 'block' : 'none';
            if (e.target.checked && !document.getElementById('gastoFecha').value) document.getElementById('gastoFecha').value = new Date().toISOString().split('T')[0];
        };
    }

    const btnFabGasto = document.getElementById('btnFabGasto');
    if (btnFabGasto) btnFabGasto.onclick = () => { document.getElementById('formGasto').reset(); document.getElementById('gastoId').value = ""; gastoEnEdicion = null; document.getElementById('modalGasto').style.display = 'flex'; };
    const btnFabIngreso = document.getElementById('btnFabIngreso');
    if (btnFabIngreso) btnFabIngreso.onclick = () => { document.getElementById('formIngreso').reset(); document.getElementById('modalIngreso').style.display = 'flex'; };
    const btnFabTarjeta = document.getElementById('btnFabTarjeta');
    if (btnFabTarjeta) btnFabTarjeta.onclick = () => { document.getElementById('formTarjeta').reset(); document.getElementById('modalTarjeta').style.display = 'flex'; };

    const btnGestionarCategorias = document.getElementById('btnGestionarCategorias');
    if (btnGestionarCategorias) btnGestionarCategorias.onclick = () => { document.getElementById('modalCategorias').style.display = 'flex'; };

    document.querySelectorAll('.close').forEach(btn => { btn.onclick = () => { btn.closest('.modal').style.display = 'none'; }; });
});

(async function init() { await fetchUserInfo(); cargarSelectorFechas(); await refreshAll(); })();