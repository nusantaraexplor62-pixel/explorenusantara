// =========================================================================
// 1. ISI KONFIGURASI DATABASE FIREBASE UTAMA (JELAJAH NUSANTARA)
// =========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBeVyt2KqI07x-ftAWkohpQ0V0FgkUfjF0",
    authDomain: "explorenusantara-12441.firebaseapp.com",
    projectId: "explorenusantara-12441",
    storageBucket: "explorenusantara-12441.firebasestorage.app",
    messagingSenderId: "496983308541",
    appId: "1:496983308541:web:440e8154a2062457da2694",
    measurementId: "G-2Q3PBX1JCJ"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Variabel penanda mode auth aktif global
let currentAuthMode = "register"; 

// Jalankan pengaturan tema saat halaman login dimuat
document.addEventListener("DOMContentLoaded", () => {
    initDefaultTheme();
});

// =========================================================================
// 2. MANAGEMENT INTERFACE SYSTEM (DARK / LIGHT THEME CONTROL)
// =========================================================================
function initDefaultTheme() {
    const savedTheme = localStorage.getItem('app-theme') || 'theme-dark';
    document.body.className = `min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-x-hidden ${savedTheme}`;
    updateThemeToggleButton(savedTheme);
}

function toggleThemeInterface() {
    const isDark = document.body.classList.contains('theme-dark');
    const targetTheme = isDark ? 'theme-light' : 'theme-dark';
    document.body.className = `min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-x-hidden ${targetTheme}`;
    localStorage.setItem('app-theme', targetTheme);
    updateThemeToggleButton(targetTheme);
}

function updateThemeToggleButton(theme) {
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    if (theme === 'theme-light') {
        document.body.style.backgroundColor = "#f4f6f9";
        icon.className = "fas fa-moon text-lg text-indigo-600";
    } else {
        document.body.style.backgroundColor = "#0b0c10";
        icon.className = "fas fa-sun text-lg text-amber-400";
    }
}

// =========================================================================
// 3. SWITCHER AUTH MODE INTERFACE (PROSES REGISTER vs LOGIN INTERFACE)
// =========================================================================
function switchAuthMode(mode) {
    currentAuthMode = mode;
    const tabReg = document.getElementById('tabRegister');
    const tabLog = document.getElementById('tabLogin');
    const subtitle = document.getElementById('authSubtitle');
    const btnText = document.getElementById('btnSubmitText');

    const gName = document.getElementById('groupName');
    const gPhone = document.getElementById('groupPhone');
    const gTerms = document.getElementById('groupTerms');

    const iName = document.getElementById('authName');
    const iPhone = document.getElementById('authPhone');
    const iTerms = document.getElementById('authTerms');

    if (mode === "login") {
        if(tabReg) tabReg.className = "flex-1 py-2.5 text-center text-xs font-bold rounded-xl transition-all duration-300 text-slate-400 hover:text-white";
        if(tabLog) tabLog.className = "flex-1 py-2.5 text-center text-xs font-bold rounded-xl transition-all duration-300 bg-blue-600 text-white shadow-md";
        if(subtitle) subtitle.innerText = "Silakan masuk dengan akun terdaftar untuk melanjutkan checkout";
        if(btnText) btnText.innerText = "Masuk Aplikasi";

        if(gName) gName.style.display = "none";
        if(gPhone) gPhone.style.display = "none";
        if(gTerms) gTerms.style.display = "none";

        if(iName) iName.removeAttribute('required');
        if(iPhone) iPhone.removeAttribute('required');
        if(iTerms) iTerms.removeAttribute('required');
    } else {
        if(tabReg) tabReg.className = "flex-1 py-2.5 text-center text-xs font-bold rounded-xl transition-all duration-300 bg-blue-600 text-white shadow-md";
        if(tabLog) tabLog.className = "flex-1 py-2.5 text-center text-xs font-bold rounded-xl transition-all duration-300 text-slate-400 hover:text-white";
        if(subtitle) subtitle.innerText = "Silakan daftarkan akun baru untuk pemesanan tiket wisata";
        if(btnText) btnText.innerText = "Buat Akun Baru";

        if(gName) gName.style.display = "flex";
        if(gPhone) gPhone.style.display = "flex";
        if(gTerms) gTerms.style.display = "block";

        if(iName) iName.setAttribute('required', '');
        if(iPhone) iPhone.setAttribute('required', '');
        if(iTerms) iTerms.setAttribute('required', '');
    }
}

function toggleViewPassword() {
    const pwd = document.getElementById('authPassword');
    const eye = document.getElementById('eyeIcon');
    if (!pwd || !eye) return;
    
    if (pwd.type === "password") {
        pwd.type = "text";
        eye.className = "fa-regular fa-eye-slash";
    } else {
        pwd.type = "password";
        eye.className = "fa-regular fa-eye";
    }
}

// =========================================================================
// 4. PENYIMPANAN CLOUD FIRESTORE & VERIFIKASI AUTENTIKASI
// =========================================================================
function handleAuthFormSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const pass = document.getElementById('authPassword').value;

    if (currentAuthMode === "register") {
        const nama = document.getElementById('authName').value.trim();
        const telp = document.getElementById('authPhone').value.trim();
        const checkTerms = document.getElementById('authTerms').checked;

        if (!checkTerms) {
            openAlertModalWindow("Validasi Gagal", "Anda wajib mencentang persetujuan regulasi sistem.", "❌");
            return;
        }

        // Cek apakah email sudah terdaftar sebelumnya
        db.collection('users').where("email", "==", email).get()
        .then((querySnapshot) => {
            if (!querySnapshot.empty) {
                openAlertModalWindow("Email Sudah Terdaftar", "Alamat email ini sudah memiliki akun. Mengalihkan ke menu masuk...", "⚠️");
                
                setTimeout(() => {
                    closeAlertModalWindow();
                    switchAuthMode('login');
                    document.getElementById('authEmail').value = email;
                    document.getElementById('authPassword').value = "";
                    document.getElementById('authPassword').focus();
                }, 2500);
                
            } else {
                // Buat Custom ID Model Unik unik dengan format U_EN_(6 angka acak)
                const customIdModel = 'U_EN_' + Math.floor(100000 + Math.random() * 900000);
                
                // Set data agar tersimpan memakai ID Dokumen berupa NAMA USER (Sinkron dengan user.js)
                const dataUserBaru = {
                    userId: customIdModel,
                    name: nama,
                    email: email,
                    phone: telp,
                    password: pass,
                    registeredAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                db.collection('users').doc(nama).set(dataUserBaru)
                .then(() => {
                    localStorage.setItem('user_session', JSON.stringify({
                        name: nama,
                        email: email,
                        phone: telp
                    }));
                    openAlertModalWindow("Registrasi Sukses", `Selamat bergabung ${nama}! Akun dengan ID ${customIdModel} berhasil diamankan ke cloud database.`, "🎉");
                    setTimeout(() => { window.location.href = "user.html"; }, 2500);
                })
                .catch((error) => {
                    console.error("Firebase write crash:", error);
                    openAlertModalWindow("Firebase Error", "Gagal melakukan kontak inject data ke cloud.", "❌");
                });
            }
        })
        .catch((error) => {
            console.error("Gagal melakukan pengecekan email duplikat:", error);
            openAlertModalWindow("Error Sistem", "Gagal melakukan verifikasi ketersediaan email.", "❌");
        });

    } else {
        // Alur autentikasi pencocokan akun masuk (Login System)
        db.collection('users').where("email", "==", email).where("password", "==", pass).get()
        .then((querySnapshot) => {
            if (!querySnapshot.empty) {
                let userData = null;
                querySnapshot.forEach((doc) => { userData = doc.data(); });

                localStorage.setItem('user_session', JSON.stringify({
                    name: userData.name,
                    email: userData.email,
                    phone: userData.phone
                }));

                openAlertModalWindow("Berhasil Masuk", `Selamat datang kembali, ${userData.name}! Membuka peta wisata...`, "🚀");
                setTimeout(() => { window.location.href = "user.html"; }, 2000);
            } else {
                openAlertModalWindow("Gagal Masuk", "Kombinasi surel email atau kata sandi tidak cocok.", "🔒");
            }
        })
        .catch((error) => {
            console.error("Login verification check failed:", error);
            openAlertModalWindow("Koneksi Gagal", "Terjadi gangguan transmisi modul Firestore Auth.", "❌");
        });
    }
}

// =========================================================================
// 5. POPUP WINDOW MANAGEMENT CONTROL NOTIFIKASI
// =========================================================================
function openAlertModalWindow(title, message, icon) {
    document.getElementById('alertIcon').innerText = icon;
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerText = message;
    
    const modal = document.getElementById('customAlertModal');
    const card = document.getElementById('alertCard');
    
    if(modal && card) {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        card.classList.remove('scale-90');
        card.classList.add('scale-100');
    }
}

function closeAlertModalWindow() {
    const modal = document.getElementById('customAlertModal');
    const card = document.getElementById('alertCard');
    
    if(modal && card) {
        modal.classList.add('opacity-0', 'pointer-events-none');
        card.classList.remove('scale-100');
        card.classList.add('scale-90');
    }
}