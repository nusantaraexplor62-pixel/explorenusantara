// Konfigurasi Firebase Anda
const firebaseConfig = {
    apiKey: "AIzaSyBeVyt2KqI07x-ftAWkohpQ0V0FgkUfjF0",
    authDomain: "explorenusantara-12441.firebaseapp.com",
    projectId: "explorenusantara-12441",
    storageBucket: "explorenusantara-12441.firebasestorage.app",
    messagingSenderId: "496983308541",
    appId: "1:496983308541:web:440e8154a2062457da2694",
    measurementId: "G-2Q3PBX1JCJ"
};

// Inisialisasi Firebase & Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Setup Peta
const map = L.map('map', { zoomControl: false }).setView([-2.5, 118.0], 5);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

let dataWisata = [];
let markers = {};

// Ambil Data dari Firestore secara Realtime
db.collection('wisata').onSnapshot((snapshot) => {
    Object.values(markers).forEach(m => map.removeLayer(m));
    dataWisata = [];

    snapshot.forEach((doc) => {
        const item = doc.data();
        const id = doc.id;
        dataWisata.push({ id, ...item });

        const marker = L.marker(item.coords).addTo(map);
        marker.bindPopup(`
            <div style="min-width:200px">
                <img src="${item.img}" style="width:100%; height:120px; object-fit:cover; border-radius:10px 10px 0 0; display:block">
                <div style="padding:10px">
                    <span style="font-size:10px; background:#eee; padding:2px 6px; border-radius:5px">${item.category}</span>
                    <b style="font-size:16px; display:block; margin-top:5px">${item.name}</b>
                    <p style="font-size:11px; color:#666; margin:5px 0">📍 ${item.address}</p>
                    <p style="font-size:11px; color:#333;">👥 Kapasitas: <b>${item.capacity} orang</b></p>
                    <hr>
                    <p style="font-size:12px; color:#666;">${item.desc}</p>
                </div>
            </div>
        `, { padding: [0, 0] });
        markers[id] = marker;
    });


}, (error) => {
    console.error("Firestore Error:", error);
});

// Fitur Pencarian
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', function() {
    const val = this.value.toLowerCase();
    searchResults.innerHTML = '';
    if (val.length < 1) { searchResults.style.display = 'none'; return; }

    const filtered = dataWisata.filter(w => w.name.toLowerCase().includes(val));
    if (filtered.length > 0) {
        searchResults.style.display = 'block';
        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = 'result-item';
            div.innerHTML = `<img src="${item.img}"> <span>${item.name}</span>`;
            div.onclick = () => {
                map.flyTo(item.coords, 12, { duration: 1.5 });
                setTimeout(() => markers[item.id].openPopup(), 1600);
                searchResults.style.display = 'none';
                searchInput.value = item.name;
            };
            searchResults.appendChild(div);
        });
    }
});
// 1. Fungsi Geocoding (Harus di atas agar bisa dipanggil)
async function getAddress(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        // Mengambil alamat ringkas (misal: Nama Jalan, Kota)
        return data.display_name || "Alamat tidak ditemukan";
    } catch (error) {
        console.error("Geocoding Error:", error);
        return "Gagal memuat alamat";
    }
}

// 2. Fungsi Simpan Data
async function saveData() {
    const name = document.getElementById('name').value;
    const latlngStr = document.getElementById('latlng').value;
    const category = document.getElementById('category').value;
    const capacity = document.getElementById('capacity').value;
    const img = document.getElementById('imgUrl').value;
    const desc = document.getElementById('desc').value;

    if (!name || !latlngStr || !img) return alert("Wajib isi Nama, Koordinat, dan Gambar!");

    // Menampilkan loading sederhana di console
    console.log("Sedang mengambil alamat...");

    const coords = latlngStr.split(',').map(n => parseFloat(n.trim()));
    
    try {
        // Memanggil fungsi getAddress dengan keyword 'await'
        const address = await getAddress(coords[0], coords[1]);

        await db.collection('wisata').add({
            name: name,
            coords: coords,
            category: category,
            capacity: capacity || "Tidak dibatasi",
            address: address, 
            img: img,
            desc: desc,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Berhasil disimpan dengan alamat: " + address);
        
        // Reset form
        document.querySelectorAll('#adminPanel input, #adminPanel textarea').forEach(i => i.value = '');
        toggleAdmin();

    } catch (error) {
        console.error("Gagal simpan:", error);
        alert("Terjadi kesalahan: " + error.message);
    }
}

// 3. Fungsi Toggle Admin
function toggleAdmin() {
    const panel = document.getElementById('adminPanel');
    if (panel) {
        panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
    }
}