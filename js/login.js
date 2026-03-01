document.getElementById("btnLogin")?.addEventListener("click", () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Por favor, completá ambos campos.");
    return;
  }

  // URL unificada a tu servidor local
  // --- CONFIGURACIÓN DE PRODUCCIÓN (Railway) ---
  const API = "https://gestion-gastos-backend-production.up.railway.app/api";

    fetch(`${API}/usuarios/login`, { // <--- Usamos la variable API
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    })
    .then(response => {
      if (!response.ok) throw new Error("Credenciales inválidas en el nuevo servidor.");
      return response.json();
    })
    .then(data => {
      // Guardamos los datos de sesión
      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.id);
      localStorage.setItem("userName", data.nombre);
      
      // Redirección limpia al dashboard
      window.location.replace("dashboard.html");
    })
    .catch(error => {
      console.error(error);
      alert("Error: " + error.message);
    });
});