document.getElementById("btnLogin").addEventListener("click", () => {
  const usuario = document.getElementById("usuario").value;
  const clave = document.getElementById("clave").value;

  fetch("http://localhost:8080/api/usuarios/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, clave }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Error en el login");
      return res.json();
    })
    .then((data) => {
      alert(`Bienvenido, ${data.nombre}!`);
    })
    .catch((err) => alert(err.message));
});



