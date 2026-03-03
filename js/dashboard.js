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
  const anios = [2025, 2026, 2027, 2028]; // Agregamos años para las cuotas largas
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
  const lista = document.getElementById("listaCategorias");
  [gSelect, iSelect, filtroSel].forEach(select => {
    if (!select) return;
    const valPrevio = select.value;
    select.innerHTML = select === filtroSel ? '<option value="all">Mostrar todas</option>' : '<option value="">Sin categoría</option>';
    categorias.forEach(cat => { const opt = document.createElement("option"); opt.value = cat.id; opt.textContent = cat.nombre; select.appendChild(opt); });
    if(valPrevio) select.value = valPrevio;
  });
}

async function refreshAll() {
  await fetchCategorias(); if(!user) return; 
  const gTodos = await fetchGastos(); const iTodos = await fetchIngresos();
  const selector = document.getElementById("filtroFechaMes");
  const mesSeleccionado = selector ? selector.value : new Date().toISOString().slice(0, 7);
  
  const gFiltrados = gTodos.filter(g => (g.fecha||g.fechaVencimiento||"").startsWith(mesSeleccionado));
  const iFiltrados = iTodos.filter(i => i.fecha.startsWith(mesSeleccionado));
  
  const gFijos = gFiltrados.filter(g => g.esFijo);
  const gVariables = gFiltrados.filter(g => !g.esFijo);
  
  const totalG = gFijos.reduce((s,x)=>s+Number(x.monto),0) + gVariables.reduce((s,x)=>s+Number(x.monto),0);
  const totalI = iFiltrados.reduce((s,x)=>s+Number(x.monto),0);
  
  if(document.getElementById("totalGastado")) document.getElementById("totalGastado").textContent = formatoMoneda(totalG);
  if(document.getElementById("totalFijos")) document.getElementById("totalFijos").textContent = formatoMoneda(gFijos.reduce((s,x)=>s+Number(x.monto),0));
  if(document.getElementById("totalVariables")) document.getElementById("totalVariables").textContent = formatoMoneda(gVariables.reduce((s,x)=>s+Number(x.monto),0));
  
  const elBal = document.getElementById("balanceTotal");
  if(elBal) {
    const bal = totalI - totalG;
    elBal.textContent = formatoMoneda(bal);
    elBal.className = "highlight " + (bal >= 0 ? "positivo" : "negativo");
  }
  
  // Ocultamos las cuotas de la tabla general para que no la ensucien
  const gVariablesParaTabla = gVariables.filter(g => !(g.descripcion && g.descripcion.includes("(Cuota")));

  renderGastosFijos(gFijos); 
  renderGastosVariables(gVariablesParaTabla); 
  renderIngresos(iFiltrados); 
  calcularSaldosPorCuenta(gFiltrados, iFiltrados); 
  generarGrafico(gFiltrados);
  renderTarjetas(gFiltrados); // Llamamos a la nueva tabla de cuotas
}

function renderGastosFijos(lista) {
  const tbody = document.querySelector("#tablaGastosFijos tbody");
  if (!tbody) return; tbody.innerHTML = "";
  lista.forEach(g => {
    const acciones = `<button onclick="eliminarGasto(${g.id})" class="btn-delete">🗑️</button>`;
    const estadoPago = g.pagado ? '<span style="color:#2ac9bb;">SÍ</span>' : '<span style="color:#ff6384;">NO</span>';
    tbody.innerHTML += `<tr><td>${g.descripcion||"-"}</td><td>${formatoMoneda(g.monto)}</td><td>${g.fechaVencimiento||"-"}</td><td>${g.categoriaNombre||"-"}</td><td>${estadoPago}</td><td>${g.medioPago||"EFECTIVO"}</td><td>${acciones}</td></tr>`;
  });
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

// --- NUEVA FUNCIÓN: RENDERIZAR TABLA DE TARJETAS ---
function renderTarjetas(lista) {
    const tbody = document.querySelector("#tablaTarjetas tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
  
    // Filtramos solo los gastos que sean cuotas
    const consumosTarjeta = lista.filter(g => g.descripcion && g.descripcion.includes("(Cuota"));
    let totalMesVisa = 0;
  
    consumosTarjeta.forEach(g => {
      // Sumamos al total de la tarjeta
      totalMesVisa += Number(g.monto);
      const acciones = `<button onclick="eliminarGasto(${g.id})" class="btn-delete" style="padding: 2px 6px;">🗑️</button>`;
  
      // Cortamos el texto para separar el nombre del producto y el número de cuota
      let desc = g.descripcion || "-";
      let badgeCuota = "";
      if (desc.includes("(Cuota")) {
          const partes = desc.split("(Cuota");
          desc = partes[0].trim();
          const cuotaInfo = "Cuota " + partes[1].replace(")", "");
          badgeCuota = `<span style="background: var(--color-primario); color: #000; padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 0.85rem;">${cuotaInfo}</span>`;
      }
  
      tbody.innerHTML += `<tr>
          <td style="color: var(--texto-claro);">${g.fecha}</td>
          <td style="font-weight: 600;">${desc}</td>
          <td>${badgeCuota}</td>
          <td style="display: flex; justify-content: space-between; align-items: center; color: #ff6384; font-weight: 600;">
            ${formatoMoneda(g.monto)} ${acciones}
          </td>
      </tr>`;
    });
  
    // Actualizamos el número gigante
    const elemTotalVisa = document.getElementById("totalVisaMes");
    if (elemTotalVisa) elemTotalVisa.textContent = formatoMoneda(totalMesVisa);
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

document.getElementById("formGasto").onsubmit = async (e) => { 
    e.preventDefault(); 
    const esFijo = document.getElementById("gastoEsFijo").checked;
    const body = {
        descripcion: document.getElementById("gastoDescripcion").value,
        monto: document.getElementById("gastoMonto").value,
        medioPago: document.getElementById("gastoMedio").value,
        fecha: document.getElementById("gastoFecha").value,
        esFijo: esFijo,
        fechaVencimiento: esFijo ? document.getElementById("gastoVencimiento").value : null,
        pagado: esFijo ? document.getElementById("gastoPagado").checked : false,
        usuarioId: user.id,
        categoriaId: document.getElementById("gastoCategoria").value || null
    };
    await fetch(`${API}/gastos`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body)
    });
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
    await fetch(`${API}/ingresos`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body)
    });
    document.getElementById("modalIngreso").style.display = "none"; 
    document.getElementById("formIngreso").reset(); 
    await refreshAll(); 
};

// --- NUEVA LÓGICA: DIVIDIR COMPRA EN CUOTAS ---
document.getElementById("formTarjeta").onsubmit = async (e) => {
    e.preventDefault();
    
    // Cambiamos el texto del botón para que sepa que está pensando
    const btnSubmit = document.querySelector("#formTarjeta button[type='submit']");
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Calculando cuotas...";

    try {
        const descripcion = document.getElementById("tarjetaDescripcion").value;
        const montoTotal = parseFloat(document.getElementById("tarjetaMontoTotal").value);
        const cuotas = parseInt(document.getElementById("tarjetaCuotas").value);
        const primeraCuota = document.getElementById("tarjetaPrimeraCuota").value; // Formato YYYY-MM
        const tarjetaTipo = document.getElementById("tarjetaTipo").value;

        // Mapeamos a las opciones que acepta tu backend
        const medioPagoBackend = tarjetaTipo === "VISA_BNA" ? "BNA" : "MERCADO_PAGO";
        
        // Hacemos la matemática
        const montoPorCuota = (montoTotal / cuotas).toFixed(2);

        // Configuramos la fecha inicial
        const [year, month] = primeraCuota.split('-');
        let fechaActual = new Date(year, month - 1, 10); // Día 10 del mes seleccionado

        for (let i = 1; i <= cuotas; i++) {
            const yyyy = fechaActual.getFullYear();
            const mm = String(fechaActual.getMonth() + 1).padStart(2, '0');
            const fechaGasto = `${yyyy}-${mm}-10`; // Le asignamos el 10 del mes de vencimiento

            const body = {
                descripcion: `${descripcion} (Cuota ${i}/${cuotas})`,
                monto: montoPorCuota,
                medioPago: medioPagoBackend,
                fecha: fechaGasto,
                esFijo: false, 
                fechaVencimiento: null,
                pagado: false,
                usuarioId: user.id,
                categoriaId: null // Opcional, queda en "Sin categoría"
            };

            // Disparamos la creación al backend
            await fetch(`${API}/gastos`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(body)
            });

            // Le sumamos 1 mes mágico a la fecha para el próximo ciclo
            fechaActual.setMonth(fechaActual.getMonth() + 1);
        }

        // Limpiamos y refrescamos todo
        document.getElementById("modalTarjeta").style.display = "none";
        document.getElementById("formTarjeta").reset();
        await refreshAll();
        alert(`¡Éxito! Se generaron ${cuotas} cuotas de $${montoPorCuota} para ${descripcion}.`);

    } catch (error) {
        console.error(error);
        alert("Hubo un error de conexión al guardar las cuotas.");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Calcular y Guardar Cuotas";
    }
};

// --- LÓGICA DE NAVEGACIÓN Y EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.getAttribute('data-section');
            if(!sectionId || sectionId === "logout") return;

            if (sectionId === "proyeccion") {
                document.getElementById('modalProyeccion').style.display = 'flex';
                return;
            }

            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.page').forEach(page => page.classList.remove('visible'));
            const targetPage = document.getElementById(sectionId);
            if(targetPage) targetPage.classList.add('visible');
        });
    });

    const fabMain = document.getElementById('fabMain');
    const fabOptions = document.getElementById('fabOptions');
    if (fabMain) {
        fabMain.addEventListener('click', (e) => {
            e.stopPropagation();
            fabOptions.classList.toggle('show'); 
        });
    }

    document.getElementById('btnFabGasto').addEventListener('click', () => {
        document.getElementById('modalGasto').style.display = 'flex';
        fabOptions.classList.remove('show');
    });

    document.getElementById('btnFabIngreso').addEventListener('click', () => {
        document.getElementById('modalIngreso').style.display = 'flex';
        fabOptions.classList.remove('show');
    });

    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
        });
    });

    document.addEventListener('click', () => {
        if(fabOptions) fabOptions.classList.remove('show');
    });

    document.getElementById('gastoEsFijo').addEventListener('change', (e) => {
        document.getElementById('camposFijos').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('btnGestionarCategorias').addEventListener('click', () => {
        document.getElementById('modalCategorias').style.display = 'flex';
    });
});

// --- INICIALIZACIÓN DE DATOS ---
document.getElementById("logoutBtn").onclick = () => { localStorage.clear(); window.location.href="login.html"; };
(async function init() { await fetchUserInfo(); cargarSelectorFechas(); await refreshAll(); })();