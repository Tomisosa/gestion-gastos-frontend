// --- CONFIGURACIÓN DE PRODUCCIÓN ---
const API = "https://backend-gastos-definitivo-production.up.railway.app/api";
const messageEl = document.getElementById("message");
const token = localStorage.getItem("token");

// Seguridad: Si no hay token, al login
if (!token) window.location.href = "login.html";

let user = null;
let miGrafico = null; 
let globalGastos = [];
let globalIngresos = [];

function authHeaders() {
  return { 
    "Content-Type": "application/json", 
    "Authorization": `Bearer ${token}` 
  };
}

// --- FUNCIÓN SALVAVIDAS: Manejo de Errores de Sesión ---
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

/* --- GRÁFICOS --- */
function generarGrafico(gastos) {
  const canvas = document.getElementById('gastosChart');
  if (!canvas) return;
  if (miGrafico) { miGrafico.destroy(); miGrafico = null; }
  const ctx = canvas.getContext('2d');
  const datosAgrupados = {};
  gastos.forEach(g => {
    const cat = g.categoriaNombre || "Sin categoría";
    datosAgrupados[cat] = (datosAgrupados[cat] || 0) + Number(g.monto);
  });
  miGrafico = new Chart(ctx, {
    type: 'doughnut', 
    data: {
      labels: Object.keys(datosAgrupados),
      datasets: [{
        data: Object.values(datosAgrupados),
        backgroundColor: ['#2ac9bb', '#ff6384', '#36a2eb', '#ffce56', '#9966ff'],
        borderWidth: 2, borderColor: '#1a1a1a'
      }]
    },
    options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { legend: { position: 'bottom', labels: { color: '#ffffff' } } } 
    }
  });
}

function calcularSaldosPorCuenta(gastos, ingresos) {
  const saldos = { "BNA": 0, "MERCADO_PAGO": 0, "EFECTIVO": 0 };
  ingresos.forEach(i => { const m = i.medioPago || "EFECTIVO"; if (saldos.hasOwnProperty(m)) saldos[m] += Number(i.monto); });
  gastos.forEach(g => { const m = g.medioPago || "EFECTIVO"; if (saldos.hasOwnProperty(m)) saldos[m] -= Number(g.monto); });
  if(document.getElementById("saldoBNA")) document.getElementById("saldoBNA").textContent = formatoMoneda(saldos["BNA"]);
  if(document.getElementById("saldoMP")) document.getElementById("saldoMP").textContent = formatoMoneda(saldos["MERCADO_PAGO"]);
  if(document.getElementById("saldoEfectivo")) document.getElementById("saldoEfectivo").textContent = formatoMoneda(saldos["EFECTIVO"]);
}

function cargarSelectorFechas() {
  const selector = document.getElementById("filtroFechaMes");
  if (!selector) return;
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const anios = [2025, 2026, 2027, 2028]; 
  selector.innerHTML = "";
  anios.forEach(anio => {
    meses.forEach((mes, index) => {
      const option = document.createElement("option");
      const mesNum = (index + 1).toString().padStart(2, '0');
      option.value = `${anio}-${mesNum}`;
      option.textContent = `${mes} ${anio}`;
      selector.appendChild(option);
    });
  });
  const hoy = new Date();
  const mesActual = (hoy.getMonth() + 1).toString().padStart(2, '0');
  selector.value = `${hoy.getFullYear()}-${mesActual}`;
  selector.onchange = () => refreshAll();
}

/* --- LLAMADAS API --- */
async function fetchUserInfo() {
  try {
    const res = await fetch(`${API}/usuarios/me`, { headers: authHeaders() });
    handleAuthError(res);
    user = await res.json();
    if(document.getElementById("userEmail")) document.getElementById("userEmail").textContent = user.email;
  } catch (e) { 
    localStorage.removeItem("token");
    window.location.href = "login.html"; 
  }
}

async function fetchCategorias() { 
    try { 
        const res = await fetch(`${API}/categorias`, { headers: authHeaders() }); 
        handleAuthError(res);
        const data = await res.json(); 
        renderCategorias(data); 
        return data; 
    } catch (e) { return []; } 
}

async function fetchGastos() { 
    const res = await fetch(`${API}/gastos/usuario/${user.id}`, { headers: authHeaders() }); 
    handleAuthError(res);
    const data = await res.json(); 
    globalGastos = data; 
    return data; 
}

async function fetchIngresos() { 
    const res = await fetch(`${API}/ingresos/usuario/${user.id}`, { headers: authHeaders() }); 
    handleAuthError(res);
    const data = await res.json(); 
    globalIngresos = data; 
    return data; 
}

function renderCategorias(categorias) {
  const gSelect = document.getElementById("gastoCategoria");
  const iSelect = document.getElementById("ingresoCategoria");
  const filtroSel = document.getElementById("filtroCategoriaSelect");
  if (!gSelect) return;
  [gSelect, iSelect, filtroSel].forEach(select => {
    if (!select) return;
    const valPrevio = select.value;
    select.innerHTML = select === filtroSel ? '<option value="all">Mostrar todas</option>' : '<option value="">Sin categoría</option>';
    categorias.forEach(cat => { const opt = document.createElement("option"); opt.value = cat.id; opt.textContent = cat.nombre; select.appendChild(opt); });
    if(valPrevio) select.value = valPrevio;
  });
}

// --- ACTUALIZACIÓN DE DATOS (REFRESH) ---
async function refreshAll() {
  await fetchCategorias(); if(!user) return; 
  const gTodos = await fetchGastos(); const iTodos = await fetchIngresos();
  const selector = document.getElementById("filtroFechaMes");
  const mesSeleccionado = selector ? selector.value : new Date().toISOString().slice(0, 7);
  
  const gFiltrados = gTodos.filter(g => (g.fecha||g.fechaVencimiento||"").startsWith(mesSeleccionado));
  const iFiltrados = iTodos.filter(i => i.fecha.startsWith(mesSeleccionado));

  // --- LÓGICA DE AHORROS / INVERSIONES ---
  const inversiones = iTodos.filter(i => i.descripcion && i.descripcion.includes("INV:"));
  const ingresosNormales = iFiltrados.filter(i => !i.descripcion.includes("INV:"));

  let totalUSD = 0;
  let totalARS_Inv = 0;

  inversiones.forEach(inv => {
      const monto = Number(inv.monto);
      if (inv.descripcion.includes("(USD)")) totalUSD += monto;
      else totalARS_Inv += monto;
  });

  const divUSD = document.querySelector("#ahorros .card:nth-child(1) .highlight");
  const divARS = document.querySelector("#ahorros .card:nth-child(2) .highlight");
  if(divUSD) divUSD.textContent = `USD ${totalUSD.toFixed(2)}`;
  if(divARS) divARS.textContent = formatoMoneda(totalARS_Inv);
  // ----------------------------------------
  
  const totalG = gFiltrados.reduce((s,x)=>s+Number(x.monto),0);
  const totalI = ingresosNormales.reduce((s,x)=>s+Number(x.monto),0);
  
  if(document.getElementById("totalGastado")) document.getElementById("totalGastado").textContent = formatoMoneda(totalG);
  
  const elBal = document.getElementById("balanceTotal");
  if(elBal) {
    const bal = totalI - totalG;
    elBal.textContent = formatoMoneda(bal);
    elBal.className = "highlight " + (bal >= 0 ? "positivo" : "negativo");
  }
  
  const gVariablesParaTabla = gFiltrados.filter(g => !g.esFijo && !(g.descripcion && g.descripcion.includes("(Cuota")));

  renderGastosVariables(gVariablesParaTabla); 
  renderIngresos(ingresosNormales); 
  calcularSaldosPorCuenta(gFiltrados, ingresosNormales); 
  generarGrafico(gFiltrados);
  renderTarjetas(gFiltrados); 
}

function renderGastosVariables(lista) {
  const tbody = document.querySelector("#tablaGastosVariables tbody");
  if (!tbody) return; tbody.innerHTML = "";
  lista.forEach(g => {
    const acciones = `<button onclick="eliminarGasto(${g.id})" class="btn-delete">🗑️</button>`;
    tbody.innerHTML += `<tr><td>${g.fecha}</td><td>${g.descripcion||"-"}</td><td>${g.categoriaNombre||"-"}</td><td>${g.medioPago||"EFECTIVO"}</td><td>${formatoMoneda(g.monto)}</td><td>${acciones}</td></tr>`;
  });
}

function renderIngresos(ingresos) {
  const tbody = document.querySelector('#tablaIngresos tbody');
  if (tbody) tbody.innerHTML = '';
  ingresos.forEach(i => {
    const acciones = `<button onclick="eliminarIngreso(${i.id})" class="btn-delete">🗑️</button>`;
    tbody.innerHTML += `<tr><td>${i.fecha}</td><td>${i.descripcion||'-'}</td><td>${i.medioPago||'EFECTIVO'}</td><td>${i.categoriaNombre||'-'}</td><td>${formatoMoneda(i.monto)}</td><td>${acciones}</td></tr>`;
  });
}

// --- RENDERIZAR TABLA DE TARJETAS ---
function renderTarjetas(lista) {
    const tbody = document.querySelector("#tablaTarjetas tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
  
    const consumosTarjeta = lista.filter(g => g.descripcion && g.descripcion.includes("(Cuota"));
    
    let totalMesVisa = 0;
    let totalMesMP = 0;
  
    consumosTarjeta.forEach(g => {
      if (g.medioPago === "BNA") {
          totalMesVisa += Number(g.monto);
      } else if (g.medioPago === "MERCADO_PAGO") {
          totalMesMP += Number(g.monto);
      }

      const acciones = `<button onclick="eliminarGasto(${g.id})" class="btn-delete" style="padding: 2px 6px;">🗑️</button>`;
  
      let desc = g.descripcion || "-";
      let badgeCuota = "";
      if (desc.includes("(Cuota")) {
          const partes = desc.split("(Cuota");
          desc = partes[0].trim();
          const cuotaInfo = "Cuota " + partes[1].replace(")", "");
          badgeCuota = `<span style="background: var(--color-primario); color: #000; padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 0.85rem;">${cuotaInfo}</span>`;
      }

      let tarjetaBadge = g.medioPago === "BNA" 
        ? `<span style="color: #00aae4; font-weight: bold; font-size: 0.8rem;">VISA</span>` 
        : `<span style="color: #009ee3; font-weight: bold; font-size: 0.8rem;">M. PAGO</span>`;
  
      tbody.innerHTML += `<tr>
          <td style="color: var(--texto-claro);">${g.fecha} <br> ${tarjetaBadge}</td>
          <td style="font-weight: 600;">${desc}</td>
          <td>${badgeCuota}</td>
          <td style="display: flex; justify-content: space-between; align-items: center; color: #ff6384; font-weight: 600;">
            ${formatoMoneda(g.monto)} ${acciones}
          </td>
      </tr>`;
    });
  
    if (document.getElementById("totalVisaMes")) document.getElementById("totalVisaMes").textContent = formatoMoneda(totalMesVisa);
    if (document.getElementById("totalMPMes")) document.getElementById("totalMPMes").textContent = formatoMoneda(totalMesMP);
}

// --- OPERACIONES CRUD ---
window.eliminarGasto = async function(id) { 
    if(confirm("¿Eliminar este registro?")) { 
        await fetch(`${API}/gastos/${id}`, {method:"DELETE", headers:authHeaders()}); 
        await refreshAll(); 
    }
};

window.eliminarIngreso = async function(id) { 
    if(confirm("¿Eliminar ingreso?")) { 
        await fetch(`${API}/ingresos/${id}`, {method:"DELETE", headers:authHeaders()}); 
        await refreshAll(); 
    }
};

// --- GUARDAR INVERSIÓN (NUEVO) ---
document.getElementById("formInversion").onsubmit = async (e) => {
    e.preventDefault();
    const btnSubmit = document.querySelector("#formInversion button[type='submit']");
    btnSubmit.disabled = true;

    try {
        const lugar = document.getElementById("invLugar").value;
        const instrumento = document.getElementById("invInstrumento").value;
        const moneda = document.getElementById("invMoneda").value;
        const monto = document.getElementById("invMonto").value;
        const fechaHoy = new Date().toISOString().split('T')[0];

        // Guardamos la inversión como un ingreso, pero le ponemos un prefijo secreto
        const body = {
            descripcion: `INV: ${lugar} - ${instrumento} (${moneda})`,
            monto: monto,
            medioPago: "EFECTIVO", // No afecta saldos BNA ni MP
            fecha: fechaHoy,
            usuarioId: user.id,
            categoriaId: null // Podrías crear una categoría de inversión en el futuro
        };

        await fetch(`${API}/ingresos`, { 
            method: "POST", 
            headers: authHeaders(), 
            body: JSON.stringify(body) 
        });

        document.getElementById("modalInversion").style.display = "none";
        document.getElementById("formInversion").reset();
        await refreshAll();
        alert("Inversión registrada con éxito.");
    } catch (error) {
        alert("Hubo un error al registrar la inversión.");
    } finally {
        btnSubmit.disabled = false;
    }
};

document.getElementById("formGasto").onsubmit = async (e) => { 
    e.preventDefault(); 
    const body = {
        descripcion: document.getElementById("gastoDescripcion").value,
        monto: document.getElementById("gastoMonto").value,
        medioPago: document.getElementById("gastoMedio").value,
        fecha: document.getElementById("gastoFecha").value,
        esFijo: document.getElementById("gastoEsFijo").checked,
        usuarioId: user.id,
        categoriaId: document.getElementById("gastoCategoria").value || null
    };
    await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    document.getElementById("modalGasto").style.display = "none"; 
    document.getElementById("formGasto").reset(); 
    await refreshAll(); 
};

document.getElementById("formIngreso").onsubmit = async (e) => { 
    e.preventDefault(); 
    const body = {
        descripcion: document.getElementById("ingresoDescripcion").value,
        monto: document.getElementById("ingresoMonto").value,
        medioPago: document.getElementById("ingresoMedio").value,
        fecha: document.getElementById("ingresoFecha").value,
        usuarioId: user.id,
        categoriaId: document.getElementById("ingresoCategoria").value || null
    };
    await fetch(`${API}/ingresos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    document.getElementById("modalIngreso").style.display = "none"; 
    document.getElementById("formIngreso").reset(); 
    await refreshAll(); 
};

document.getElementById("formTarjeta").onsubmit = async (e) => {
    e.preventDefault();
    const btnSubmit = document.querySelector("#formTarjeta button[type='submit']");
    btnSubmit.disabled = true;
    try {
        const descripcion = document.getElementById("tarjetaDescripcion").value;
        const montoTotal = parseFloat(document.getElementById("tarjetaMontoTotal").value);
        const cuotas = parseInt(document.getElementById("tarjetaCuotas").value);
        const primeraCuota = document.getElementById("tarjetaPrimeraCuota").value; 
        const tarjetaTipo = document.getElementById("tarjetaTipo").value;
        const medioPagoBackend = tarjetaTipo === "VISA_BNA" ? "BNA" : "MERCADO_PAGO";
        const montoPorCuota = (montoTotal / cuotas).toFixed(2);
        const [year, month] = primeraCuota.split('-');
        let fechaActual = new Date(year, month - 1, 10); 

        for (let i = 1; i <= cuotas; i++) {
            const yyyy = fechaActual.getFullYear();
            const mm = String(fechaActual.getMonth() + 1).padStart(2, '0');
            await fetch(`${API}/gastos`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    descripcion: `${descripcion} (Cuota ${i}/${cuotas})`,
                    monto: montoPorCuota,
                    medioPago: medioPagoBackend,
                    fecha: `${yyyy}-${mm}-10`,
                    esFijo: false, 
                    usuarioId: user.id
                })
            });
            fechaActual.setMonth(fechaActual.getMonth() + 1);
        }
        document.getElementById("modalTarjeta").style.display = "none";
        document.getElementById("formTarjeta").reset();
        await refreshAll();
        alert("Cuotas generadas con éxito.");
    } catch (error) { alert("Error al guardar cuotas."); }
    finally { btnSubmit.disabled = false; }
};

// --- LÓGICA DE NAVEGACIÓN, MENÚ HAMBURGUESA Y BOTÓN INTELIGENTE ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Configuración Menú Hamburguesa
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if(menuToggle && sidebar && overlay) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        });
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
    
    // Navegación entre pestañas
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.getAttribute('data-section');
            if(!sectionId || sectionId === "logout") return;

            if (sectionId === "proyeccion") {
                document.getElementById('modalProyeccion').style.display = 'flex';
                return;
            }

            // Cambiar pestaña activa visualmente
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Mostrar página correspondiente
            document.querySelectorAll('.page').forEach(page => page.classList.remove('visible'));
            const targetPage = document.getElementById(sectionId);
            if(targetPage) targetPage.classList.add('visible');
            
            // Cierra el menú hamburguesa automáticamente al tocar un botón
            if (window.innerWidth <= 768 && sidebar && overlay) {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            }

			// --- MAGIA DEL BOTÓN CONTEXTUAL ---
            const btnIngreso = document.getElementById('btnFabIngreso');
            const btnGasto = document.getElementById('btnFabGasto');
            const btnTarjeta = document.getElementById('btnFabTarjeta');
            const fabContainer = document.querySelector('.fab-container'); 

            if (btnIngreso && btnGasto && btnTarjeta && fabContainer) {
                
                // Si estamos en Ahorros, ocultamos TODO el botón flotante
                if (sectionId === 'ahorros') {
                    fabContainer.style.display = 'none';
                } 
                else {
                    fabContainer.style.display = 'flex';
                    
                    if (sectionId === 'tarjetas') {
                        // En Tarjetas mostramos el de Agregar Tarjeta
                        btnIngreso.style.display = 'none';
                        btnGasto.style.display = 'none';
                        btnTarjeta.style.display = 'flex';
                    } else {
                        // En Inicio/Gastos/Ingresos mostramos los clásicos
                        btnIngreso.style.display = 'flex';
                        btnGasto.style.display = 'flex';
                        btnTarjeta.style.display = 'none';
                    }
                }
            }
        });
    });

    // Control del Botón Flotante (+)
    const fabMain = document.getElementById('fabMain');
    const fabOptions = document.getElementById('fabOptions');
    if (fabMain) {
        fabMain.addEventListener('click', (e) => {
            e.stopPropagation();
            fabOptions.classList.toggle('show'); 
        });
    }

    // Abrir Modales desde el FAB
    document.getElementById('btnFabGasto').onclick = () => {
        document.getElementById('modalGasto').style.display = 'flex';
        fabOptions.classList.remove('show');
    };
    document.getElementById('btnFabIngreso').onclick = () => {
        document.getElementById('modalIngreso').style.display = 'flex';
        fabOptions.classList.remove('show');
    };
    document.getElementById('btnFabTarjeta').onclick = () => {
        document.getElementById('modalNuevaTarjeta').style.display = 'flex';
        fabOptions.classList.remove('show');
    };

    // Cerrar Modales
    document.querySelectorAll('.close').forEach(btn => {
        btn.onclick = () => btn.closest('.modal').style.display = 'none';
    });

    document.addEventListener('click', () => {
        if(fabOptions) fabOptions.classList.remove('show');
    });

    // Mostrar campos adicionales si es gasto fijo
    const chkFijo = document.getElementById('gastoEsFijo');
    if(chkFijo) {
        chkFijo.onchange = (e) => {
            document.getElementById('camposFijos').style.display = e.target.checked ? 'block' : 'none';
        };
    }

    document.getElementById('btnGestionarCategorias').onclick = () => {
        document.getElementById('modalCategorias').style.display = 'flex';
    };
});

// --- INICIALIZACIÓN ---
document.getElementById("logoutBtn").onclick = () => { localStorage.clear(); window.location.href="login.html"; };
(async function init() { 
    await fetchUserInfo(); 
    cargarSelectorFechas(); 
    await refreshAll(); 
})();