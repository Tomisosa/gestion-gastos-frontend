document.getElementById("btnLogin")?.addEventListener("click", () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Por favor, completá ambos campos.");
    return;
  }

  // --- CONFIGURACIÓN DE PRODUCCIÓN (Railway) ---
  const API = "https://backend-gastos-definitivo-production.up.railway.app/api";

  console.log("Intentando entrar con:", email); // Para ver si el mail está bien escrito

  fetch(`${API}/usuarios/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  })
  .then(async response => {
    if (!response.ok) {
        // Acá obligamos a Java a que nos diga POR QUÉ no nos deja entrar
        const errorReal = await response.text();
        console.error("El servidor respondió con error:", response.status, errorReal);
        throw new Error(`Java dice que no: Error ${response.status}. Mirá la consola (F12).`);
    }
    return response.json();
  })
  .then(data => {
    console.log("¡Éxito! Java nos dejó entrar", data);
    // Guardamos los datos de sesión
    localStorage.setItem("token", data.token);
    localStorage.setItem("userId", data.id);
    localStorage.setItem("userName", data.nombre);
    
    // Redirección limpia al dashboard
    window.location.replace("dashboard.html");
  })
  .catch(error => {
    console.error("Error capturado:", error);
    alert(error.message);
  });
});