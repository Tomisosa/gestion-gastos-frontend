document.getElementById("btnLogin")?.addEventListener("click", () => {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Por favor, completá ambos campos.");
    return;
  }

  const API = "https://backend-gastos-definitivo-production.up.railway.app/api";

  console.log("Intentando entrar con:", email);

  fetch(`${API}/usuarios/login`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  })

  .then(async response => {

    if (!response.ok) {
      const errorReal = await response.text();
      console.error("Error del servidor:", response.status, errorReal);
      throw new Error("Email o contraseña incorrectos");
    }

    return response.json();
  })

  .then(data => {

    console.log("Login exitoso:", data);

    // Guardamos sesión
    localStorage.setItem("token", data.token);
    localStorage.setItem("userId", data.id);
    localStorage.setItem("userName", data.nombre);

    console.log("Token guardado:", localStorage.getItem("token"));

    // Ir al dashboard
    window.location.href = "dashboard.html";

  })

  .catch(error => {
    console.error("Error login:", error);
    alert(error.message);
  });

});