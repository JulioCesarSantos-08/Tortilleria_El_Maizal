const firebaseConfig = {
  apiKey: "AIzaSyCzlWi30F2qXaCg9ddjW5RVVsuI23Xl8vY",
  authDomain: "tortilleria-el-maizal.firebaseapp.com",
  databaseURL: "https://tortilleria-el-maizal-default-rtdb.firebaseio.com",
  projectId: "tortilleria-el-maizal",
  storageBucket: "tortilleria-el-maizal.firebasestorage.app",
  messagingSenderId: "704775522415",
  appId: "1:704775522415:web:96ae90bb0c0d45cbafa59a"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();

const loading = document.getElementById("loading");
const app = document.getElementById("app");
const userEmail = document.getElementById("userEmail");

const btnLogout = document.getElementById("btnLogout");

const goEmpleados = document.getElementById("goEmpleados");
const goAdmin = document.getElementById("goAdmin");
const goGanancias = document.getElementById("goGanancias");
const goGestion = document.getElementById("goGestion");

auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  userEmail.textContent = user.email || "Usuario";
  loading.style.display = "none";
  app.style.display = "block";
});

btnLogout.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "index.html";
});

goEmpleados.addEventListener("click", () => {
  window.location.href = "empleados.html";
});

goAdmin.addEventListener("click", () => {
  window.location.href = "empleados2.html";
});

goGanancias.addEventListener("click", () => {
  window.location.href = "ganancias.html";
});

goGestion.addEventListener("click", () => {
  window.location.href = "gestion.html";
});