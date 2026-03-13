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
let gastoEnEdicion = null; 

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
        plugins: { legend: { position: 'bottom', labels: { color: '#ffffff' } } } 
    }
  });
}

function calcularSaldosPorCuenta(gastos, ingresos) {
  const saldos = { "BNA": 0, "MERCADO_PAGO": 0, "EFECTIVO": 0 };
  
  ingresos.forEach(i => { 
      const m = i.medioPago || "EFECTIVO"; 
      if (saldos[m] !== undefined) saldos[m] += (Number(i.monto) || 0); 
  });
  
  gastos.forEach(g => { 
      const m = g.medioPago || "EFECTIVO"; 
      if (saldos[m] !== undefined) saldos[m] -= (Number(g.monto) || 0); 
  });
  
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

/* --- LLAMADAS API CON ESCUDOS --- */
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
        emailDiv.style.fontSize = "0.9rem";
    }
  } catch (e) { 
    localStorage.removeItem("token");
    window.location.href = "login.html"; 
  }
}

async function fetchCategorias() { 
    try { 
        const res = await fetch(`${API}/categorias`, { headers: authHeaders() }); 
        handleAuthError(res);
        const todasLasCategorias = await res.json(); 
        
        const misCategorias = todasLasCategorias.filter(cat => 
            String(cat.usuarioId) === String(user.id) || 
            (cat.usuario && String(cat.usuario.id) === String(user.id))
        );

        renderCategorias(misCategorias); 
        return misCategorias; 
    } catch (e) { 
        return []; 
    } 
}

async function fetchGastos() { 
    const res = await fetch(`${API}/gastos/usuario/${user.id}`, { headers: authHeaders() }); 
    handleAuthError(res);
    const todosLosGastos = await res.json(); 
    
    const misGastos = todosLosGastos.filter(g => 
        String(g.usuarioId) === String(user.id) || 
        (g.usuario && String(g.usuario.id) === String(user.id))
    );

    globalGastos = misGastos; 
    return misGastos; 
}

async function fetchIngresos() { 
    const res = await fetch(`${API}/ingresos/usuario/${user.id}`, { headers: authHeaders() }); 
    handleAuthError(res);
    const todosLosIngresos = await res.json(); 
    
    const misIngresos = todosLosIngresos.filter(i => 
        String(i.usuarioId) === String(user.id) || 
        (i.usuario && String(i.usuario.id) === String(user.id))
    );

    globalIngresos = misIngresos; 
    return misIngresos; 
}

async function fetchYRenderizarMisTarjetas() {
    try {
        const res = await fetch(`${API}/tarjetas/usuario/${user.id}`, { headers: authHeaders() });
        if (!res.ok) throw new Error("Error trayendo tarjetas");
        const todasLasTarjetas = await res.json();
        
        globalTarjetas = todasLasTarjetas.filter(t => 
            String(t.usuarioId) === String(user.id) || 
            (t.usuario && String(t.usuario.id) === String(user.id))
        );

        const contenedor = document.getElementById("contenedorMisTarjetas");
        if (!contenedor) return;
        
        contenedor.innerHTML = ""; 
        
        if (globalTarjetas.length === 0) {
            contenedor.innerHTML = `<p style="color: #888; text-align: center; width: 100%;">No tenés tarjetas guardadas. ¡Agregá una nueva para empezar!</p>`;
            return;
        }
        
        globalTarjetas.forEach(t => {
            let bgGradient = "linear-gradient(135deg, #333333 0%, #111111 100%)"; 
            if (t.color === "bna") bgGradient = "linear-gradient(135deg, #2ac9bb 0%, #0f766e 100%)"; 
            if (t.color === "naranja") bgGradient = "linear-gradient(135deg, #f97316 0%, #7c2d12 100%)";
            if (t.color === "azul") bgGradient = "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)";
            if (t.color === "celeste") bgGradient = "linear-gradient(135deg, #009ee3 0%, #0284c7 100%)";
            if (t.color === "violeta") bgGradient = "linear-gradient(135deg, #8b5cf6 0%, #4c1d95 100%)";
            if (t.color === "verde") bgGradient = "linear-gradient(135deg, #166534 0%, #064e3b 100%)";
            if (t.color === "negro") bgGradient = "linear-gradient(135deg, #262626 0%, #000000 100%)";

            contenedor.innerHTML += `
            <div class="card" style="background: ${bgGradient}; border: none; position: relative; overflow: hidden; padding-bottom: 25px;">
                <div style="position: absolute; right: -20px; top: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.05); border-radius: 50%;"></div>
                <button onclick="eliminarMiTarjeta(${t.id})" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.3); border: none; color: white; padding: 6px 8px; border-radius: 50%; cursor: pointer; font-size: 1rem;" title="Eliminar tarjeta">🗑️</button>
                <h3 style="color: #ffffff; display: flex; justify-content: space-between; align-items: center; border-bottom: none; margin-right: 30px; margin-top: 15px;">${t.nombre}</h3>
            </div>`;
        });
    } catch (error) {
        console.error("Error cargando tarjetas", error);
    }
}

function actualizarMediosDePagoSelects() {
    const gastoMedio = document.getElementById("gastoMedio");
    const ingresoMedio = document.getElementById("ingresoMedio");
    const tarjetaTipo = document.getElementById("tarjetaTipo"); 
    
    const opcionesBase = `
        <option value="BNA">🏦 BNA</option>
        <option value="MERCADO_PAGO">📱 Mercado Pago</option>
        <option value="EFECTIVO">💵 Efectivo</option>
        <option value="CF">💳 CF</option>
    `;
    
    if (gastoMedio) gastoMedio.innerHTML = opcionesBase;
    if (ingresoMedio) ingresoMedio.innerHTML = opcionesBase;
    if (tarjetaTipo) tarjetaTipo.innerHTML = "";
    
    if (globalTarjetas.length === 0 && tarjetaTipo) {
        tarjetaTipo.innerHTML = '<option value="">No tenés tarjetas creadas</option>';
    }

    globalTarjetas.forEach(t => {
        const opt = `<option value="${t.nombre}">💳 ${t.nombre}</option>`;
        if (gastoMedio) gastoMedio.innerHTML += opt;
        if (ingresoMedio) ingresoMedio.innerHTML += opt;
        if (tarjetaTipo) tarjetaTipo.innerHTML += opt;
    });
}

function renderCategorias(categorias) {
  categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));

  const contadorEl = document.getElementById("countCategorias");
  if (contadorEl) {
      contadorEl.textContent = categorias.length;
  }

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
    
    if (filtroSel) {
        filtroSel.onchange = () => refreshAll();
    }
  }

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

async function refreshAll() {
  await fetchCategorias(); 
  if(!user) return; 
  
  await fetchYRenderizarMisTarjetas();
  actualizarMediosDePagoSelects(); 
  
  const gTodos = await fetchGastos(); 
  const iTodos = await fetchIngresos();
  
  const selector = document.getElementById("filtroFechaMes");
  const mesSeleccionado = selector ? selector.value : new Date().toISOString().slice(0, 7);
  
  const gFiltradosMes = gTodos.filter(g => (g.fecha||g.fechaVencimiento||"").startsWith(mesSeleccionado));
  const iFiltradosMes = iTodos.filter(i => (i.fecha||"").startsWith(mesSeleccionado));

  const catFilter = document.getElementById("filtroCategoriaSelect") ? document.getElementById("filtroCategoriaSelect").value : "all";
  let gParaTablasYGrafico = [...gFiltradosMes]; 
  
  if (catFilter !== "all" && catFilter !== "") {
      gParaTablasYGrafico = gFiltradosMes.filter(g => String(g.categoriaId) === String(catFilter));
  }

  const inversiones = iTodos.filter(i => i.descripcion && i.descripcion.includes("INV:"));
  const ingresosNormales = iFiltradosMes.filter(i => !i.descripcion.includes("INV:"));

  let totalUSD = 0;
  let totalARS_Inv = 0;
  inversiones.forEach(inv => {
      const monto = Number(inv.monto) || 0;
      if (inv.descripcion.includes("(USD)")) totalUSD += monto;
      else totalARS_Inv += monto;
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

  const gHistoricos = gTodos.filter(g => (g.fecha||"").slice(0,7) <= mesSeleccionado);
  const iHistoricos = iTodos.filter(i => (i.fecha||"").slice(0,7) <= mesSeleccionado);
  calcularSaldosPorCuenta(gHistoricos, iHistoricos); 
}

// --- TABLA DE FIJOS CON VENCIMIENTO Y ESTADO REAL ---
function renderGastosFijos(lista) {
  const tbody = document.querySelector("#tablaGastosFijos tbody");
  if (!tbody) return; 
  tbody.innerHTML = "";
  let total = 0;

  lista.forEach(g => {
    total += (Number(g.monto) || 0);
    const acciones = `
        <button onclick="editarGasto(${g.id})" class="btn-edit" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; margin-right: 5px;" title="Editar">✏️</button>
        <button onclick="eliminarGasto(${g.id})" class="btn-delete" style="background: none; border: none; cursor: pointer; font-size: 1.1rem;" title="Eliminar">🗑️</button>
    `;

    // Si tiene fecha de vencimiento guardada la mostramos, sino guión
    const vto = g.fechaVencimiento ? g.fechaVencimiento : "-";
    // Chequeamos si está pagado o no (Si es falso o null, no está pagado)
    const estadoPagado = g.pagado ? "✅ Sí" : "❌ No";

    tbody.innerHTML += `<tr>
        <td>${g.descripcion||"-"}</td>
        <td style="font-weight: bold; color: #ffce56;">${formatoMoneda(g.monto)}</td>
        <td>${vto}</td>
        <td>${g.categoriaNombre||"-"}</td>
        <td>${estadoPagado}</td>
        <td>${g.fecha}</td>
        <td>${g.medioPago||"EFECTIVO"}</td>
        <td>${acciones}</td>
    </tr>`;
  });

  if (document.getElementById("totalFijos")) {
      document.getElementById("totalFijos").textContent = formatoMoneda(total);
  }
}

function renderGastosVariables(lista) {
  const tbody = document.querySelector("#tablaGastosVariables tbody");
  if (!tbody) return; 
  tbody.innerHTML = "";
  lista.forEach(g => {
    const acciones = `
        <button onclick="editarGasto(${g.id})" class="btn-edit" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; margin-right: 5px;" title="Editar">✏️</button>
        <button onclick="eliminarGasto(${g.id})" class="btn-delete" style="background: none; border: none; cursor: pointer; font-size: 1.1rem;" title="Eliminar">🗑️</button>
    `;
    tbody.innerHTML += `<tr><td>${g.fecha}</td><td>${g.descripcion||"-"}</td><td>${g.categoriaNombre||"-"}</td><td>${g.medioPago||"EFECTIVO"}</td><td>${formatoMoneda(g.monto)}</td><td>${acciones}</td></tr>`;
  });
}

function renderIngresos(ingresos) {
  const tbody = document.querySelector('#tablaIngresos tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  ingresos.forEach(i => {
    const acciones = `<button onclick="eliminarIngreso(${i.id})" class="btn-delete">🗑️</button>`;
    tbody.innerHTML += `<tr><td>${i.fecha}</td><td>${i.descripcion||'-'}</td><td>${i.medioPago||'EFECTIVO'}</td><td>${i.categoriaNombre||'-'}</td><td>${formatoMoneda(i.monto)}</td><td>${acciones}</td></tr>`;
  });
}

function renderConsumosCuotas(lista) {
    const tbody = document.querySelector("#tablaTarjetas tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const consumosTarjeta = lista.filter(g => g.descripcion && g.descripcion.includes("(Cuota"));
    
    consumosTarjeta.forEach(g => {
      const acciones = `<button onclick="eliminarGasto(${g.id})" class="btn-delete" style="padding: 2px 6px;">🗑️</button>`;
      let desc = g.descripcion || "-";
      let badgeCuota = "";
      if (desc.includes("(Cuota")) {
          const partes = desc.split("(Cuota");
          desc = partes[0].trim();
          const cuotaInfo = "Cuota " + partes[1].replace(")", "");
          badgeCuota = `<span style="background: var(--color-primario); color: #000; padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 0.85rem;">${cuotaInfo}</span>`;
      }
      
      let tarjetaBadge = `<span style="color: #00aae4; font-weight: bold; font-size: 0.8rem;">${g.medioPago}</span>`;
      tbody.innerHTML += `<tr><td>${g.fecha} <br> ${tarjetaBadge}</td><td>${desc}</td><td>${badgeCuota}</td><td style="display: flex; justify-content: space-between; align-items: center;">${formatoMoneda(g.monto)} ${acciones}</td></tr>`;
    });
}

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

window.editarGasto = function(id) {
    gastoEnEdicion = globalGastos.find(g => g.id === id);
    if (!gastoEnEdicion) return;

    document.getElementById("gastoId").value = gastoEnEdicion.id; 
    document.getElementById("gastoDescripcion").value = gastoEnEdicion.descripcion;
    document.getElementById("gastoMonto").value = gastoEnEdicion.monto;
    document.getElementById("gastoFecha").value = gastoEnEdicion.fecha;
    document.getElementById("gastoMedio").value = gastoEnEdicion.medioPago;
    document.getElementById("gastoCategoria").value = gastoEnEdicion.categoriaId || "";
    
    // Carga los campos nuevos
    if (document.getElementById("gastoVencimiento")) {
        document.getElementById("gastoVencimiento").value = gastoEnEdicion.fechaVencimiento || "";
    }
    if (document.getElementById("gastoPagado")) {
        document.getElementById("gastoPagado").checked = gastoEnEdicion.pagado || false;
    }

    const chkFijo = document.getElementById("gastoEsFijo");
    if (chkFijo) {
        chkFijo.checked = gastoEnEdicion.esFijo;
        const camposFijos = document.getElementById('camposFijos');
        if (camposFijos) camposFijos.style.display = gastoEnEdicion.esFijo ? 'block' : 'none';
    }

    document.getElementById("modalGasto").style.display = "flex";
};

window.eliminarIngreso = async function(id) { 
    if(confirm("¿Eliminar ingreso?")) { 
        await fetch(`${API}/ingresos/${id}`, { method: "DELETE", headers: authHeaders() }); 
        await refreshAll(); 
    } 
};

window.eliminarCategoria = async function(id) { 
    if(confirm("¿Seguro que querés eliminar esta categoría?")) { 
        try {
            await fetch(`${API}/categorias/${id}`, { method: "DELETE", headers: authHeaders() }); 
            await refreshAll(); 
        } catch(e) {
            alert("Error al eliminar la categoría.");
        }
    } 
};

window.eliminarMiTarjeta = async function(id) {
    if(confirm("¿Seguro que querés eliminar esta tarjeta de crédito de tu cuenta?")) {
        try {
            await fetch(`${API}/tarjetas/${id}`, { method: "DELETE", headers: authHeaders() });
            await refreshAll(); 
        } catch(e) {
            alert("Error al intentar eliminar la tarjeta.");
        }
    }
};

window.crearCategoria = async function() {
    const inputCat = document.getElementById("nuevaCategoriaInput");
    if(!inputCat || !inputCat.value.trim()) {
        alert("El nombre no puede estar vacío.");
        return;
    }
    try {
        const body = { nombre: inputCat.value.trim(), usuarioId: user.id };
        const res = await fetch(`${API}/categorias`, { 
            method: "POST", 
            headers: authHeaders(), 
            body: JSON.stringify(body) 
        });
        if (!res.ok) throw new Error("Error del servidor");
        inputCat.value = "";
        await refreshAll();
    } catch (error) { 
        alert("Error al crear la categoría."); 
    }
};

const formGasto = document.getElementById("formGasto");
if (formGasto) {
    formGasto.onsubmit = async (e) => { 
        e.preventDefault(); 
        const btnSubmit = document.querySelector("#formGasto button[type='submit']");
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Guardando... paciencia";

        try {
            const idAEditar = document.getElementById("gastoId").value;
            const descripcion = document.getElementById("gastoDescripcion").value;
            const monto = document.getElementById("gastoMonto").value;
            const medioPago = document.getElementById("gastoMedio").value;
            const fechaBase = document.getElementById("gastoFecha").value;
            const esFijo = document.getElementById("gastoEsFijo").checked;
            const categoriaId = document.getElementById("gastoCategoria").value || null;
            
            // Levantamos los valores de Vencimiento y Pagado
            const fechaVencimiento = document.getElementById("gastoVencimiento").value || null;
            const pagado = document.getElementById("gastoPagado").checked;

            if (idAEditar) {
                if (esFijo && gastoEnEdicion && gastoEnEdicion.esFijo) {
                    const aplicarFuturo = confirm("Al ser un gasto fijo... ¿Querés guardar este cambio en TODOS los meses SIGUIENTES también?");
                    
                    if (aplicarFuturo) {
                        const res = await fetch(`${API}/gastos/usuario/${user.id}`, { headers: authHeaders() });
                        const todos = await res.json();
                        
                        const futuros = todos.filter(g => 
                            (String(g.usuarioId) === String(user.id) || (g.usuario && String(g.usuario.id) === String(user.id))) &&
                            g.esFijo === true && 
                            g.descripcion === gastoEnEdicion.descripcion && 
                            g.fecha >= gastoEnEdicion.fecha
                        );

                        for (const g of futuros) {
                            await fetch(`${API}/gastos/${g.id}`, { method: "DELETE", headers: authHeaders() });
                            
                            // Re-calculamos el vencimiento futuro si es que lo hay
                            let vtoFuturo = null;
                            if (fechaVencimiento) {
                                const yDiff = parseInt(g.fecha.split('-')[0]) - parseInt(fechaBase.split('-')[0]);
                                const mDiff = parseInt(g.fecha.split('-')[1]) - parseInt(fechaBase.split('-')[1]);
                                const totalMesesAdelante = (yDiff * 12) + mDiff;
                                
                                const [vYear, vMonth, vDay] = fechaVencimiento.split('-');
                                let nm = parseInt(vMonth) + totalMesesAdelante;
                                let ny = parseInt(vYear);
                                while (nm > 12) { nm -= 12; ny += 1; }
                                vtoFuturo = `${ny}-${String(nm).padStart(2, '0')}-${vDay}`;
                            }
                            
                            const body = { descripcion, monto, medioPago, fecha: g.fecha, esFijo: true, usuarioId: user.id, categoriaId, fechaVencimiento: vtoFuturo, pagado: g.fecha === fechaBase ? pagado : false };
                            await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                        }
                        alert("¡Gasto actualizado para este mes y todos los siguientes!");
                    } else {
                        await fetch(`${API}/gastos/${idAEditar}`, { method: "DELETE", headers: authHeaders() });
                        const body = { descripcion, monto, medioPago, fecha: fechaBase, esFijo, usuarioId: user.id, categoriaId, fechaVencimiento, pagado };
                        await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                        alert("¡Gasto actualizado SOLO para este mes!");
                    }
                } else {
                    await fetch(`${API}/gastos/${idAEditar}`, { method: "DELETE", headers: authHeaders() });
                    const body = { descripcion, monto, medioPago, fecha: fechaBase, esFijo, usuarioId: user.id, categoriaId, fechaVencimiento, pagado };
                    await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                }
            } else {
                if (esFijo) {
                    const programarFuturos = confirm("¿Desea programar este gasto para los próximos meses?\n\n👉 ACEPTAR: Se guarda en este mes y se clona para los próximos 11 meses.\n👉 CANCELAR: Se guarda SOLO en este mes como gasto fijo.");

                    if (programarFuturos) {
                        const [year, month, day] = fechaBase.split('-');
                        let currentYear = parseInt(year);
                        let currentMonth = parseInt(month);
                        let safeDay = parseInt(day) > 28 ? "28" : day;

                        for (let i = 0; i < 12; i++) {
                            let m = currentMonth + i;
                            let y = currentYear;
                            if (m > 12) { m -= 12; y += 1; }
                            const fechaCuota = `${y}-${String(m).padStart(2, '0')}-${safeDay}`;
                            
                            // Calcula el vencimiento de cada mes (Magia de fechas)
                            let nuevoVto = null;
                            if (fechaVencimiento) {
                                const [vYear, vMonth, vDay] = fechaVencimiento.split('-');
                                let nm = parseInt(vMonth) + i;
                                let ny = parseInt(vYear);
                                while (nm > 12) { nm -= 12; ny += 1; }
                                nuevoVto = `${ny}-${String(nm).padStart(2, '0')}-${vDay}`;
                            }
                            
                            // Solo el primer mes guarda lo que pusiste, los meses futuros se ponen como "NO PAGADO"
                            const cuotaPagada = (i === 0) ? pagado : false;

                            const body = { descripcion, monto, medioPago, fecha: fechaCuota, esFijo: true, usuarioId: user.id, categoriaId, fechaVencimiento: nuevoVto, pagado: cuotaPagada };
                            await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                        }
                        alert("¡Gasto Fijo programado automáticamente para los próximos 12 meses!");
                    } else {
                        const body = { descripcion, monto, medioPago, fecha: fechaBase, esFijo: true, usuarioId: user.id, categoriaId, fechaVencimiento, pagado };
                        await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                    }
                } else {
                    const body = { descripcion, monto, medioPago, fecha: fechaBase, esFijo: false, usuarioId: user.id, categoriaId, fechaVencimiento: null, pagado: true };
                    await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                }
            }

            document.getElementById("modalGasto").style.display = "none"; 
            formGasto.reset(); 
            document.getElementById('gastoId').value = ""; 
            gastoEnEdicion = null;
            document.getElementById('camposFijos').style.display = 'none'; 
            await refreshAll(); 
        } catch (error) {
            alert("Hubo un error de conexión al guardar el gasto.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Guardar";
        }
    };
}

// --- DETECTOR DE ERRORES AL GUARDAR INGRESO ---
const formIngreso = document.getElementById("formIngreso");
if (formIngreso) {
    formIngreso.onsubmit = async (e) => { 
        e.preventDefault(); 
        
        try {
            const body = { 
                descripcion: document.getElementById("ingresoDescripcion").value, 
                monto: document.getElementById("ingresoMonto").value, 
                medioPago: document.getElementById("ingresoMedio").value, 
                fecha: document.getElementById("ingresoFecha").value, 
                usuarioId: user.id, 
                categoriaId: document.getElementById("ingresoCategoria").value || null 
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
            const descripcion = document.getElementById("tarjetaDescripcion").value;
            const montoTotal = parseFloat(document.getElementById("tarjetaMontoTotal").value);
            const cuotas = parseInt(document.getElementById("tarjetaCuotas").value);
            const primeraCuota = document.getElementById("tarjetaPrimeraCuota").value; 
            const tarjetaTipo = document.getElementById("tarjetaTipo").value; 
            
            const montoPorCuota = (montoTotal / cuotas).toFixed(2);
            const [year, month] = primeraCuota.split('-');
            let fechaActual = new Date(year, month - 1, 10); 

            for (let i = 1; i <= cuotas; i++) {
                const yyyy = fechaActual.getFullYear();
                const mm = String(fechaActual.getMonth() + 1).padStart(2, '0');
                
                const body = {
                    descripcion: `${descripcion} (Cuota ${i}/${cuotas})`,
                    monto: montoPorCuota,
                    medioPago: tarjetaTipo, 
                    fecha: `${yyyy}-${mm}-10`,
                    esFijo: false, 
                    usuarioId: user.id
                };
                await fetch(`${API}/gastos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                fechaActual.setMonth(fechaActual.getMonth() + 1);
            }

            document.getElementById("modalTarjeta").style.display = "none";
            formTarjeta.reset();
            await refreshAll();
            alert("Cuotas generadas con éxito.");
        } catch (error) { 
            alert("Error al guardar cuotas."); 
        } finally { 
            btnSubmit.disabled = false; 
        }
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

const formCambiarPass = document.getElementById("formCambiarPass");
if (formCambiarPass) {
    formCambiarPass.onsubmit = async (e) => {
        e.preventDefault();
        const oldPass = document.getElementById("currentPassword").value;
        const newPass = document.getElementById("newPassword").value;
        const confirmPass = document.getElementById("confirmPassword").value;

        if (newPass !== confirmPass) { 
            alert("Las nuevas contraseñas no coinciden"); 
            return; 
        }

        try {
            const res = await fetch(`${API}/usuarios/change-password`, {
                method: "PUT",
                headers: authHeaders(),
                body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
            });
            if (res.ok) { 
                alert("Contraseña actualizada con éxito"); 
                formCambiarPass.reset(); 
            } else { 
                const txt = await res.text(); 
                alert("Error: " + txt); 
            }
        } catch (e) { 
            alert("Error de conexión al intentar cambiar la contraseña."); 
        }
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
                usuarioId: user.id
            };

            const res = await fetch(`${API}/tarjetas`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });

            if (!res.ok) throw new Error("Error al guardar la tarjeta");

            document.getElementById("modalNuevaTarjeta").style.display = "none";
            formNuevaTarjeta.reset();
            alert("¡Billetera/Tarjeta guardada con éxito!");
            await refreshAll();

        } catch (error) {
            console.error(error);
            alert("Hubo un error al guardar. Revisá la conexión.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Guardar";
        }
    };
}

// --- NAVEGACIÓN Y BOTONES FLOTANTES ---
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
            
            if (sidebar && overlay) {
                sidebar.classList.remove('active'); 
                overlay.classList.remove('active');
            }

            const btnIngreso = document.getElementById('btnFabIngreso');
            const btnGasto = document.getElementById('btnFabGasto');
            const btnTarjeta = document.getElementById('btnFabTarjeta');
            const fabContainer = document.querySelector('.fab-container'); 

            if (btnIngreso && btnGasto && btnTarjeta && fabContainer) {
                if (sectionId === 'ahorros' || sectionId === 'perfil') {
                    fabContainer.style.display = 'none';
                } else {
                    fabContainer.style.display = 'flex';
                    if (sectionId === 'tarjetas') {
                        btnIngreso.style.display = 'none';
                        btnGasto.style.display = 'none';
                        btnTarjeta.style.display = 'flex';
                    } else {
                        btnIngreso.style.display = 'flex';
                        btnGasto.style.display = 'flex';
                        btnTarjeta.style.display = 'flex'; 
                    }
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

    // MAGIA DE FECHAS: Cuando abrís el modal, se llena solo con la fecha de hoy
    const btnFabGasto = document.getElementById('btnFabGasto');
    if (btnFabGasto) btnFabGasto.onclick = () => { 
        document.getElementById('formGasto').reset(); 
        document.getElementById('gastoId').value = ""; 
        gastoEnEdicion = null; 
        
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('gastoFecha').value = hoy;
        if(document.getElementById('gastoVencimiento')) document.getElementById('gastoVencimiento').value = hoy;

        document.getElementById('modalGasto').style.display = 'flex'; 
    };
    
    const btnFabIngreso = document.getElementById('btnFabIngreso');
    if (btnFabIngreso) btnFabIngreso.onclick = () => { 
        document.getElementById('formIngreso').reset();
        document.getElementById('ingresoId').value = "";
        
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('ingresoFecha').value = hoy;

        document.getElementById('modalIngreso').style.display = 'flex'; 
    };
    
    const btnFabTarjeta = document.getElementById('btnFabTarjeta');
    if (btnFabTarjeta) btnFabTarjeta.onclick = () => { document.getElementById('modalNuevaTarjeta').style.display = 'flex'; };

    const btnGestionarCategorias = document.getElementById('btnGestionarCategorias');
    if (btnGestionarCategorias) btnGestionarCategorias.onclick = () => { document.getElementById('modalCategorias').style.display = 'flex'; };

    document.querySelectorAll('.close').forEach(btn => {
        btn.onclick = () => { btn.closest('.modal').style.display = 'none'; };
    });

    const chkFijo = document.getElementById('gastoEsFijo');
    const camposFijos = document.getElementById('camposFijos');
    if (chkFijo && camposFijos) {
        chkFijo.onchange = (e) => {
            camposFijos.style.display = e.target.checked ? 'block' : 'none';
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