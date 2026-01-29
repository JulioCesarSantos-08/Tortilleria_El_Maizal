document.addEventListener("DOMContentLoaded", () => {

const firebaseConfig = {
  apiKey: "AIzaSyCzlWi30F2qXaCg9ddjW5RVVsuI23Xl8vY",
  authDomain: "tortilleria-el-maizal.firebaseapp.com",
  projectId: "tortilleria-el-maizal"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
let db = null;

const loading = document.getElementById("loading");
const app = document.getElementById("app");
const userEmail = document.getElementById("userEmail");

const btnLogout = document.getElementById("btnLogout");
const goEmpleados = document.getElementById("goEmpleados");
const goAdmin = document.getElementById("goAdmin");
const goGanancias = document.getElementById("goGanancias");
const goGestion = document.getElementById("goGestion");

const modal = document.getElementById("modalGanancias");
const inputPass = document.getElementById("inputPasswordGanancias");
const msgGanancias = document.getElementById("msgGanancias");
const btnAcceder = document.getElementById("btnAccederGanancias");
const btnCancelar = document.getElementById("btnCancelarGanancias");
const btnForgot = document.getElementById("btnForgotGanancias");

auth.onAuthStateChanged(user => {
  if (!user) {
    location.href = "index.html";
    return;
  }
  userEmail.textContent = user.email || "Usuario";
  loading.style.display = "none";
  app.style.display = "block";
});

btnLogout.onclick = async () => {
  await auth.signOut();
  location.href = "index.html";
};

goEmpleados.onclick = () => location.href = "empleados.html";
goAdmin.onclick = () => location.href = "empleados2.html";
goGestion.onclick = () => location.href = "gestion.html";

goGanancias.onclick = () => {
  msgGanancias.textContent = "";
  inputPass.value = "";
  modal.style.display = "flex";
  inputPass.focus();
};

btnCancelar.onclick = () => {
  modal.style.display = "none";
};

btnAcceder.onclick = validarAccesoGanancias;

btnForgot.onclick = async () => {
  try {
    await auth.sendPasswordResetEmail("roelgopar@gmail.com");
    msgGanancias.style.color = "#1f8a4c";
    msgGanancias.textContent = "Se envió un correo para restablecer la contraseña.";
  } catch {
    msgGanancias.textContent = "No se pudo enviar el correo.";
  }
};

async function validarAccesoGanancias() {
  const pass = inputPass.value.trim();
  if (!pass) {
    msgGanancias.textContent = "Ingresa la contraseña.";
    return;
  }

  btnAcceder.disabled = true;
  msgGanancias.textContent = "Verificando...";

  try {
    if (!db) db = firebase.firestore();

    const hash = await sha256(pass);
    const ref = db.collection("configuracionSeguridad").doc("ganancias");
    const snap = await ref.get();

    if (!snap.exists) {
      msgGanancias.textContent = "Configuración no encontrada.";
      btnAcceder.disabled = false;
      return;
    }

    const data = snap.data();

    if (data.passwordHash === "PENDIENTE") {
      await ref.update({
        passwordHash: hash,
        estado: "activo",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      location.href = "ganancias.html";
      return;
    }

    if (data.passwordHash !== hash) {
      msgGanancias.textContent = "Contraseña incorrecta.";
      btnAcceder.disabled = false;
      return;
    }

    location.href = "ganancias.html";

  } catch {
    msgGanancias.textContent = "Error de validación.";
    btnAcceder.disabled = false;
  }
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

});
