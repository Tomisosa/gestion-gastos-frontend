document.getElementById("formRegistro")?.addEventListener("submit", (e) => {
  e.preventDefault();

  const nombre = document.getElementById("nombre").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!nombre || !email || !password) {
    alert("Por favor, completa todos los campos.");
    return;
  }

  // --- CONFIGURACIÓN DE PRODUCCIÓN (Railway) ---
const API = "https://backend-gastos-definitivo-production.up.railway.app/api";

    fetch(`${API}/usuarios/register`, { // <--- Usamos la variable API
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, password }),
    })
    .then(res => {
      if (!res.ok) throw new Error("Error en el registro. El email podría estar duplicado en la base nueva.");
      return res.json();
    })
    .then(() => {
      alert("¡Cuenta creada con éxito! Ahora podés iniciar sesión.");
      window.location.href = "login.html";
    })
    .catch(err => {
      console.error(err);
      alert(err.message);
    });
});