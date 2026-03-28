// --- CONFIGURACIÓN API ---
const API = "https://backend-gastos-definitivo-production.up.railway.app/api";

// --- DATOS DE SESIÓN ---
const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
const userName = localStorage.getItem("userName");

// Si no hay sesión → volver al login
if (!token || !userId) {
    window.location.href = "login.html";
}

// Crear objeto usuario
let user = {
    id: Number(userId),
    nombre: userName
};

// --- VARIABLES GLOBALES ---
let miGrafico = null; 
let globalGastos = [];
let globalIngresos = [];
let globalTarjetas = []; 
let globalBilleteras = []; 
let gastoEnEdicion = null; 
let saldosOcultos = true; // Por defecto arrancan tapados (DÉBITO)
let saldosTarjetasOcultos = true; // Por defecto arrancan tapados (CRÉDITO)
let saldosAhorrosOcultos = true; // Por defecto arrancan tapados (AHORROS)

window.saldosActuales = {};

// --- HEADERS PARA API ---
function authHeaders() {
  return { 
    "Content-Type": "application/json", 
    "Authorization": `Bearer ${token}` 
  };
}

// --- CONTROL DE SESIÓN EXPIRADA ---
function handleAuthError(res) {
    // Si la llave está vencida (401), cerramos sesión.
    if (res.status === 401) {
        localStorage.removeItem("token"); 
        localStorage.removeItem("userId"); 
        localStorage.removeItem("userName"); 
        window.location.href = "login.html"; 
        throw new Error("Sesión expirada");
    }
}

// --- FORMATO MONEDA ---
function formatoMoneda(valor) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(valor);
}

// --- NUEVOS COLORES Y DISEÑO MODERNO ---
function getBgColor(color) {
    // Nuevos degradados más vibrantes y modernos
    const m = {
        naranja: "linear-gradient(135deg, #f97316 0%, #7c2d12 100%)",
        azul: "linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)",
        violeta: "linear-gradient(135deg, #8b5cf6 0%, #4c1d95 100%)",
        celeste: "linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)",
        verde: "linear-gradient(135deg, #22c55e 0%, #166534 100%)",
        bna: "linear-gradient(135deg, #2ac9bb 0%, #0f766e 100%)", // Mantenemos el BNA clásico
        rojo: "linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)",
        uala: "linear-gradient(135deg, #ef4444 0%, #cbd5e1 100%)", // Ualá clásico
        amarillo: "linear-gradient(135deg, #f59e0b 0%, #92400e 100%)", // NUEVO
        emerald: "linear-gradient(135deg, #10b981 0%, #065f46 100%)", // NUEVO
        fuchsia: "linear-gradient(135deg, #d946ef 0%, #701a75 100%)", // NUEVO
        indigo: "linear-gradient(135deg, #6366f1 0%, #312e81 100%)", // NUEVO
        sky: "linear-gradient(135deg, #06b6d4 0%, #155e75 100%)", // NUEVO
        rose: "linear-gradient(135deg, #f43f5e 0%, #881337 100%)", // NUEVO
        negro: "linear-gradient(135deg, #262626 0%, #000000 100%)",
        darkly: "linear-gradient(135deg, #1f2937 0%, #111827 100%)", // NUEVO (Gris muy oscuro)
    };

    return m[color] || m['darkly']; // Si no encuentra el color, usa el darkly
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
  
  // Armamos la lista de billeteras para saber si se pagó con tarjeta
  const nombresBilleteras = ["BNA", "MERCADO PAGO", "EFECTIVO", "MERCADO_PAGO", "PENDIENTE", "MÚLTIPLES"];
  globalBilleteras.forEach(b => nombresBilleteras.push(b.nombre.toUpperCase()));

  gastos.forEach(g => {
    let cat = g.categoriaNombre;

    // MAGIA: Si el gasto no tiene categoría, la aplicación adivina de dónde viene
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

  // Agregué un par de colores más para que no se repitan
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
// --- CORRECCIÓN DE TARJETAS (DISEÑO LIMPIO Y CARRUSEL NATIVO) ---
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

	// Contenedor general limpio
	    contenedor.style.cssText = "display: flex; flex-direction: row; flex-wrap: nowrap; gap: 16px; overflow-x: auto; max-width: 100%; padding: 10px 5px 20px 5px; -webkit-overflow-scrolling: touch;";
	    contenedor.innerHTML = "";

	    if (nombres.length === 0) {
	         contenedor.innerHTML = `<div style="width: 100%; text-align: center; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 12px; color: #888;">No tenés cuentas de débito creadas. Usá el botón "🏦 + Nueva Cuenta" para empezar.</div>`;
	        return;
	    }

		const totalG = gFiltradosMes.reduce((s,x) => s + (Number(x.monto) || 0), 0);
		    const totalI = ingresosNormales.reduce((s,x) => s + (Number(x.monto) || 0), 0);
		    
		    // --- INYECCIÓN DEL NUEVO WIDGET DE GASTO TOTAL ---
		    let containerGasto = document.getElementById("totalGastoWidget");
		    if(!containerGasto) {
		        const oldP = document.getElementById("totalGastado");
		        if(oldP) {
		            const parent = oldP.closest('.card');
		            if(parent) {
		                parent.id = "totalGastoWidget";
		                parent.style.cssText = "background: #ffffff; border-radius: 20px; box-shadow: 0 8px 30px rgba(0,0,0,0.04); padding: 24px; border: 1px solid #f1f5f9; margin-top: 15px;";
		            }
		        }
		    }
		    
		    containerGasto = document.getElementById("totalGastoWidget");
		    if(containerGasto) {
		        const montoRealTotal = formatoMoneda(totalG);
		        const montoVisibleTotal = saldosOcultos ? "••••••" : montoRealTotal;

		        containerGasto.innerHTML = `
		            <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 8px;">TOTAL GASTADO EN EL MES</div>
		            
		            <div id="totalGastado" 
		                 onmouseover="if(window.saldosOcultos) this.textContent = '${montoRealTotal}'" 
		                 onmouseout="if(window.saldosOcultos) this.textContent = '••••••'"
		                 ontouchstart="if(window.saldosOcultos) this.textContent = '${montoRealTotal}'"
		                 ontouchend="if(window.saldosOcultos) this.textContent = '••••••'"
		                 title="Pasá el mouse o mantené apretado para ver el monto"
		                 style="font-size: 2.8rem; font-weight: 800; color: #be123c; letter-spacing: -1.5px; line-height: 1; cursor: pointer; transition: opacity 0.2s ease; -webkit-tap-highlight-color: transparent;">
		                 ${montoVisibleTotal}
		            </div>
		            
		            <div style="height: 45px; margin-top: 15px; width: 100%; position: relative;"><canvas id="sparklineCanvas"></canvas></div>
		        `;
		        setTimeout(() => generarSparkline(gParaTablasYGrafico, mesSeleccionado), 50);
		    }
		    // --------------------------------------------------
		    
		    // ¡OJO ACÁ! BORRAMOS LA LÍNEA VIEJA QUE PISABA EL TEXTO. 
		    // Ahora saltamos directo a calcular el balance.

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
            if (saldosTarjetasOcultos) {
                el.innerHTML = "••••••";
            } else {
                let textoHTML = formatoMoneda(totalARS);
                if (totalUSD > 0) {
                    textoHTML += `<br><span style="font-size: 1.1rem; color: #86efac;">USD ${totalUSD.toFixed(2)}</span>`;
                }
                el.innerHTML = textoHTML;
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

	  // ¡MAGIA ACÁ! Filtramos las inversiones para que no se sumen como plata disponible
	const ingresosParaSaldos = iHistoricos.filter(i => !(i.descripcion || "").includes("INV:") && !(i.descripcion || "").includes("[CONFIG_TC]"));

	  calcularSaldosPorCuenta(gHistoricos, ingresosParaSaldos);
    
    actualizarMediosDePagoSelects();
    renderProyeccion(ingresosNormales, gFijosParaTabla, gVariablesParaTabla, inversiones);
  }

  function renderPrestamos(prestamos) {
      const contenedor = document.getElementById("contenedorTablasPrestamos");
      if(!contenedor) return;
      contenedor.innerHTML = "";

      // MAGIA: Obtenemos tu nombre de usuario y lo ponemos prolijo (Ej: "tomas" -> "Tomas")
      let minombre = user.nombre ? user.nombre.split(" ")[0] : "Vos";
      minombre = minombre.charAt(0).toUpperCase() + minombre.slice(1).toLowerCase();

      // Inyectamos el nombre en las tarjetas del HTML
      document.querySelectorAll('.nombreDinamico').forEach(el => el.textContent = minombre);

      const selector = document.getElementById("filtroFechaMes");
      const mesSeleccionado = selector ? selector.value : new Date().toISOString().slice(0, 7);

      // Filtramos solo los de este mes
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

      // Dibujamos una tabla por cada persona
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

          // ACÁ INYECTAMOS TU NOMBRE EN LA CABECERA DE LA TABLA (<th>${minombre}</th>)
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

// --- TABLA FIJOS (CON BOTÓN DE PAGO RÁPIDO) ---
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
    
    // Matemática mágica para los 3 cuadritos
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
    let textoMonto = esDolar ? `<span style="color:#86efac;">USD ${montoNum.toFixed(2)}</span>` : formatoMoneda(montoNum);

    tbody.innerHTML += `<tr>
        <td>${g.descripcion||"-"}</td>
        <td style="font-weight: bold; color: #ffce56;">${textoMonto}</td>
        <td>${vto}</td>
        <td><span style="${g.esVirtual ? 'color: #00aae4; font-weight: bold;' : ''}">${g.categoriaNombre||"-"}</span></td>
        <td>${estadoPagado}</td>
        <td>${fechaPagoReal}</td>
        <td>${medioPagoReal}</td>
        <td>${acciones}</td>
    </tr>`;
  });

  // Actualizamos el HTML con los cálculos
  if (document.getElementById("totalFijos")) document.getElementById("totalFijos").textContent = formatoMoneda(total);
  if (document.getElementById("totalFijosPagado")) document.getElementById("totalFijosPagado").textContent = formatoMoneda(pagado);
  if (document.getElementById("totalFijosFalta")) document.getElementById("totalFijosFalta").textContent = formatoMoneda(faltaPagar);
}

// --- TABLA VARIABLES (CON BOTÓN DE PAGO RÁPIDO) ---
function renderGastosVariables(lista) {
  const tbody = document.querySelector("#tablaGastosVariables tbody");
  if (!tbody) return; 
  tbody.innerHTML = "";
  let total = 0;
  
  lista.forEach(g => {
    total += (Number(g.monto) || 0);
    const acciones = `
        <button onclick="editarGasto(${g.id})" class="btn-edit" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; margin-right: 5px;" title="Editar">✏️</button>
        <button onclick="eliminarGasto(${g.id})" class="btn-delete" style="background: none; border: none; cursor: pointer; font-size: 1.1rem;" title="Eliminar">🗑️</button>
    `;
    
    let estadoPagado = "";
    let fechaPagoReal = "-";
    let medioPagoReal = "-";

    if (g.pagado) {
        estadoPagado = `<span style="color: #2ac9bb;">✅ Sí</span>`;
        fechaPagoReal = g.fecha || "-";
        medioPagoReal = g.medioPago || "EFECTIVO";
    } else {
        estadoPagado = `<input type="checkbox" style="width: 18px; height: 18px; cursor: pointer; accent-color: #2ac9bb;" onclick="event.preventDefault(); abrirModalPago(${g.id})" title="Tildar para pagar">`;
        fechaPagoReal = "-";
        medioPagoReal = `<span style="color: #888;">Pendiente</span>`;
    }
    
    const vto = g.fechaVencimiento ? g.fechaVencimiento : "-";

    tbody.innerHTML += `<tr>
        <td>${g.descripcion||"-"}</td>
        <td style="font-weight: bold; color: #2ac9bb;">${formatoMoneda(g.monto)}</td>
        <td>${vto}</td>
        <td>${g.categoriaNombre||"-"}</td>
        <td>${estadoPagado}</td>
        <td>${fechaPagoReal}</td>
        <td>${medioPagoReal}</td>
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
    tbody.innerHTML += `<tr><td>${i.fecha}</td><td>${i.descripcion||'-'}</td><td>${i.medioPago||'EFECTIVO'}</td><td>${i.categoriaNombre||'-'}</td><td>${formatoMoneda(i.monto)}</td><td>${acciones}</td></tr>`;
  });
}

function renderConsumosCuotas(lista) {
    const tbody = document.querySelector("#tablaTarjetas tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const mediosIgnorados = ["BNA", "MERCADO PAGO", "MERCADO_PAGO", "EFECTIVO", "PENDIENTE", "MÚLTIPLES"];
    globalBilleteras.forEach(b => mediosIgnorados.push(b.nombre.toUpperCase()));
    
    // ¡ACÁ LEEMOS QUÉ TARJETA ELIGIÓ TU HERMANA!
    const filtroSelect = document.getElementById("filtroTarjetaSelect");
    const tarjetaSeleccionada = filtroSelect ? filtroSelect.value : "all";

    const consumosTarjeta = lista.filter(g => {
        if (!g.medioPago) return false;
        const medio = g.medioPago.toUpperCase();
        
        // 1. Descartar si no es tarjeta (billeteras, efectivo, etc)
        if (mediosIgnorados.includes(medio)) return false;

        // 2. Si eligió una tarjeta específica en el filtro, descartamos las demás
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
      let montoAMostrar = esDolar ? `<span style="color:#86efac;">USD ${Number(g.monto).toFixed(2)}</span>` : formatoMoneda(g.monto);
      
      tbody.innerHTML += `
      <tr>
          <td>${g.fecha} ${tarjetaBadge}</td>
          <td>${desc}</td>
          <td>${g.categoriaNombre || "-"}</td>
          <td>${badgeCuota}</td>
          <td style="font-weight: bold;">${montoAMostrar}</td>
          <td>${acciones}</td>
      </tr>`;
    });
}

// --- CREAR BILLETERA ---
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
                
                // MAGIA: COMENTAMOS EL COLOR UN SEGUNDO PARA PROBAR
                // color: document.getElementById("billeteraColor").value,
                
                usuario: { id: user.id } 
            };
            
            const res = await fetch(`${API}/billeteras`, { 
                method: "POST", 
                headers: authHeaders(), 
                body: JSON.stringify(body) 
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

// --- ABRIR EDITAR BILLETERA ---
window.abrirEditarBilletera = function(id, nombre, color) {
    document.getElementById("editBilleteraId").value = id;
    document.getElementById("editBilleteraNombre").value = nombre;
    
    const selectColor = document.getElementById("editBilleteraColor");
    if(selectColor) selectColor.value = color !== 'undefined' ? color : 'azul';

    document.getElementById("modalEditarBilletera").style.display = "flex";
};

// --- GUARDAR EDICIÓN BILLETERA ---
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

            const res = await fetch(`${API}/tarjetas`, { 
                method: "POST", 
                headers: authHeaders(), 
                body: JSON.stringify(body) 
            });

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

                const body = {
                    mesCuota: `${yyyy}-${mm}`, // Ahora solo guarda la fecha acá
                    nombre: nombre,
                    perteneceA: pertenece,
                    cuotaActual: i,
                    cuotaTotal: totalCuotas,
                    montoTotal: 0,
                    aporteBelen: 0,
                    aporteOtro: 0,
                    usuario: { id: user.id }
                };
                await fetch(`${API}/prestamos`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
                fechaActual.setMonth(fechaActual.getMonth() + 1);
            }
            document.getElementById("modalPrestamo").style.display = "none";
            formPrestamo.reset();
            await refreshAll();
            alert(`¡Se generaron ${totalCuotas} cuotas con éxito!`);
        } catch(err) {
            alert("Error al generar préstamo.");
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

// MAGIA NUEVA: Si no está pagado, guardamos "PENDIENTE" y no nos importa el select
const pagado = document.getElementById("gastoPagado").checked;
const medioPago = pagado ? document.getElementById("gastoMedio").value : "PENDIENTE";

const esFijo = document.getElementById("gastoEsFijo").checked;
const repeticion = parseInt(document.getElementById("gastoRepeticion").value || 0);
const categoriaId = document.getElementById("gastoCategoria").value || null;
let fechaVto = document.getElementById("gastoVencimiento").value;
const fechaReal = document.getElementById("gastoFecha").value;
const mesImpacto = document.getElementById("gastoMesImpacto").value;

// MAGIA: Si dejó vacío el vencimiento, usamos la fecha en la que lo pagó (o la de hoy)
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

	            // ¡MAGIA ACÁ! Hacemos que el "Mes de Impacto" también avance correctamente
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
            const fechaExacta = document.getElementById("tarjetaFechaExacta").value; // ¡Acá tomamos la fecha del calendario!
            const tarjetaTipo = document.getElementById("tarjetaTipo").value; 
            const categoriaId = document.getElementById("tarjetaCategoria").value || null; 

            // Si es USD, le agregamos la etiqueta a la descripción para reconocerlo visualmente
            const descFinal = moneda === "USD" ? `[USD] ${descripcionBase}` : descripcionBase;
            const montoPorCuota = Number((montoTotal / cuotas).toFixed(2));
            
            // Usamos el mes de la "1° cuota" para calcular hacia adelante
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

// --- FUNCIÓN DEL NUEVO BOTÓN DE PAGO RÁPIDO ---
window.abrirModalPago = function(id) {
    const gasto = globalGastos.find(g => g.id === id);
    if (!gasto) return;

    document.getElementById("pagoGastoId").value = gasto.id;
    document.getElementById("pagoGastoDesc").textContent = gasto.descripcion;
    document.getElementById("pagoGastoFecha").value = new Date().toISOString().split('T')[0];
    
    document.getElementById("modalPagarGasto").style.display = "flex";
};

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
                pagado: true, // ¡ACÁ SE MARCA COMO PAGADO!
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
// ----------------------------------------------

/* --- ELIMINACIONES E INTERACCIONES --- */
window.eliminarBilletera = async function(id) {
    if(confirm("¿Seguro que querés eliminar esta cuenta? No se borrarán los movimientos pasados.")) {
        await fetch(`${API}/billeteras/${id}`, { method: "DELETE", headers: authHeaders() });
        await refreshAll();
    }
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

/* --- INICIO Y DOMContentLoaded --- */
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
            const btnTarjeta = document.getElementById('btnFabTarjeta'); 
            const fabContainer = document.querySelector('.fab-container'); 

            if (btnIngreso && btnGasto && btnTarjeta && fabContainer) {
                if (sectionId === 'ahorros' || sectionId === 'perfil' || sectionId === 'prestamos') {
                    fabContainer.style.display = 'none';
                } else {
                    fabContainer.style.display = 'flex';
                    btnIngreso.style.display = 'flex';
                    btnGasto.style.display = 'flex';
                    btnTarjeta.style.display = 'flex'; 
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

// ARRANQUE DE LA APP
(async function init() { 
    await fetchUserInfo(); 
    cargarSelectorFechas(); 
    await refreshAll(); 
})();

//EDITAR CUOTA
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

function renderInversiones(lista) {
  const tbody = document.querySelector('#tablaInversiones tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  lista.forEach(i => {
    const acciones = `<button onclick="eliminarIngreso(${i.id})" class="btn-delete" style="background: none; border: none; cursor: pointer; font-size: 1.1rem;" title="Eliminar">🗑️</button>`;
    
    let detalleLimpio = (i.descripcion || "").replace("INV: ", "");
    let colorMonto = detalleLimpio.includes('(USD)') ? '#86efac' : '#94a3b8';
    let prefijo = detalleLimpio.includes('(USD)') ? 'USD ' : '';

    // Le devolvemos el número visible siempre:
    let montoAMostrar = `${prefijo}${formatoMoneda(i.monto)}`;

    tbody.innerHTML += `<tr>
        <td>${i.fecha}</td>
        <td>${detalleLimpio}</td>
        <td style="font-weight: bold; color: ${colorMonto};">${montoAMostrar}</td>
        <td>${acciones}</td>
    </tr>`;
  });
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

// --- GUARDAR FECHAS DE TARJETAS EN LA BASE DE DATOS (FANTASMA) ---
window.guardarFechasTarjetas = async function() {
    const selector = document.getElementById("filtroFechaMes");
    const mesSeleccionado = selector ? selector.value : new Date().toISOString().slice(0, 7);
    const cierre = document.getElementById("fechaCierreMes") ? document.getElementById("fechaCierreMes").value : "";
    const vto = document.getElementById("fechaVtoMes") ? document.getElementById("fechaVtoMes").value : "";
    
    // Armamos el texto secreto que va a ir a la base de datos
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

// NUEVA FUNCIÓN: Abrir modal de edición matemática
window.abrirEditarPrestamo = function(id, total, belen) {
    document.getElementById("editPrestamoId").value = id;
    document.getElementById("editPrestamoTotal").value = total > 0 ? total : "";
    document.getElementById("editPrestamoBelen").value = belen > 0 ? belen : "";
    
    // Calculadora en vivo
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

// NUEVA FUNCIÓN: Guardar edición del préstamo (usando el PUT de Java)
const formEditarPrestamo = document.getElementById("formEditarPrestamo");
if (formEditarPrestamo) {
    formEditarPrestamo.onsubmit = async (e) => {
        e.preventDefault();
        try {
            const id = document.getElementById("editPrestamoId").value;
            const total = parseFloat(document.getElementById("editPrestamoTotal").value) || 0;
            const belen = parseFloat(document.getElementById("editPrestamoBelen").value) || 0;
            const aportado = total - belen; // Calcula lo del otro automáticamente

            const body = {
                montoTotal: total,
                aporteBelen: belen,
                aporteOtro: aportado
            };
            
            // Llama al nuevo método PUT que creamos en Java
            await fetch(`${API}/prestamos/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
            
            document.getElementById("modalEditarPrestamo").style.display = "none";
            await refreshAll();
        } catch(err) {
            alert("Error al actualizar la cuota.");
        }
    };
}

// --- NUEVO: MICRO-VISUALIZACIÓN (SPARKLINE) ---
let miSparkline = null;
window.generarSparkline = function(gastos, mes) {
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
    
    // Gradiente sutil para la curva
    let gradient = ctx.createLinearGradient(0, 0, 0, 45);
    gradient.addColorStop(0, 'rgba(190, 18, 60, 0.25)'); // Carmesí suave
    gradient.addColorStop(1, 'rgba(190, 18, 60, 0)');

    miSparkline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(dias),
            datasets: [{
                data: data,
                borderColor: '#be123c', // Carmesí vibrante
                backgroundColor: gradient,
                borderWidth: 2,
                tension: 0.4, // Curva suave
                fill: true,
                pointRadius: 0, // Esconde los puntitos para que sea limpio
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
};
