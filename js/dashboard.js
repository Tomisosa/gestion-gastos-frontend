// --- CONFIGURACIÓN DE PRODUCCIÓN (Railway) ---
const API = "https://backend-gastos-definitivo-production.up.railway.app/api";
const token = localStorage.getItem("token");

// Seguridad básica
if (!token) {
  console.warn("No hay token en localStorage");
}

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

function formatoMoneda(valor) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(valor);
}

/* =========================
   FETCH USER (ARREGLADO)
========================= */

async function fetchUserInfo() {
  try {
    const res = await fetch(`${API}/usuarios/me`, { 
      headers: authHeaders() 
    });

    console.log("STATUS /usuarios/me:", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error("Error respuesta:", text);
      throw new Error("Error auth");
    }

    user = await res.json();
    console.log("USER:", user);

    const emailEl = document.getElementById("userEmail");
    if (emailEl) emailEl.textContent = user.email;

  } catch (e) {
    console.error("Error en fetchUserInfo:", e);
    // 🚫 SACAMOS el redirect automático para evitar loop infinito
    // window.location.href = "login.html";
  }
}

/* =========================
   FETCH DATOS
========================= */

async function fetchCategorias() { 
  try { 
    const res = await fetch(`${API}/categorias`, { headers: authHeaders() }); 
    const data = await res.json(); 
    renderCategorias(data); 
    return data; 
  } catch (e) { 
    console.error("Error categorias", e);
    return []; 
  } 
}

async function fetchGastos() { 
  if (!user) return [];
  const res = await fetch(`${API}/gastos/usuario/${user.id}`, { headers: authHeaders() }); 
  const data = await res.json(); 
  globalGastos = data; 
  return data; 
}

async function fetchIngresos() { 
  if (!user) return [];
  const res = await fetch(`${API}/ingresos/usuario/${user.id}`, { headers: authHeaders() }); 
  const data = await res.json(); 
  console.log("INGRESOS BACK:", data);
  globalIngresos = data; 
  return data; 
}

/* =========================
   REFRESH GENERAL
========================= */

async function refreshAll() {
  await fetchCategorias(); 
  if(!user) return; 

  const gTodos = await fetchGastos(); 
  const iTodos = await fetchIngresos();

  const mesSeleccionado = new Date().toISOString().slice(0, 7);

  const gFiltrados = gTodos.filter(g => 
    (g.fecha || g.fechaVencimiento || "").startsWith(mesSeleccionado)
  );

  const iFiltrados = iTodos.filter(i => 
    (i.fecha || "").startsWith(mesSeleccionado)
  );

  const totalG = gFiltrados.reduce((s,x)=>s+Number(x.monto),0);
  const totalI = iFiltrados.reduce((s,x)=>s+Number(x.monto),0);

  const elBal = document.getElementById("balanceTotal");
  if(elBal) {
    const bal = totalI - totalG;
    elBal.textContent = formatoMoneda(bal);
  }

  renderIngresos(iFiltrados);
}

/* =========================
   RENDER INGRESOS
========================= */

function renderIngresos(ingresos) {
  const tbody = document.querySelector('#tablaIngresos tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  ingresos.forEach(i => {
    tbody.innerHTML += `
      <tr>
        <td>${i.fecha || "-"}</td>
        <td>${i.descripcion || '-'}</td>
        <td>${i.medioPago || 'EFECTIVO'}</td>
        <td>${i.categoriaNombre || '-'}</td>
        <td>${formatoMoneda(i.monto)}</td>
      </tr>
    `;
  });
}

/* =========================
   FORM INGRESO
========================= */

document.getElementById("formIngreso")?.addEventListener("submit", async (e) => { 
  e.preventDefault(); 

  if (!user) {
    console.error("User null al crear ingreso");
    return;
  }

  const body = {
    descripcion: document.getElementById("ingresoDescripcion").value,
    monto: document.getElementById("ingresoMonto").value,
    medioPago: document.getElementById("ingresoMedio").value,
    fecha: document.getElementById("ingresoFecha").value,
    usuarioId: user.id,
    categoriaId: document.getElementById("ingresoCategoria").value || null
  };

  const res = await fetch(`${API}/ingresos`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body)
  });

  console.log("POST ingreso status:", res.status);

  await refreshAll(); 
});

/* =========================
   LOGOUT
========================= */

document.getElementById("logoutBtn")?.addEventListener("click", () => { 
  localStorage.clear(); 
  window.location.replace("index.html"); 
});

/* =========================
   INIT
========================= */

(async function init() { 
  await fetchUserInfo(); 
  await refreshAll(); 
})();