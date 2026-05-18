const firebaseConfig = {
    apiKey: "AIzaSyBeVyt2KqI07x-ftAWkohpQ0V0FgkUfjF0",
    authDomain: "explorenusantara-12441.firebaseapp.com",
    projectId: "explorenusantara-12441",
    storageBucket: "explorenusantara-12441.firebasestorage.app",
    messagingSenderId: "496983308541",
    appId: "1:496983308541:web:440e8154a2062457da2694",
    measurementId: "G-2Q3PBX1JCJ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const WEATHER_API_KEY = "142e02684f39b930a542e4b0d3ba1f73"; 

let dataWisata = [];
let editId = null;
let selectedCategories = ["All"]; 

// Variable Global untuk Manajemen Leaflet Map & Layer Marker
let mainMap = null;
let markerLayerGroup = null;

// Jalankan Inisialisasi Peta saat Halaman Siap
window.addEventListener('DOMContentLoaded', () => {
    initLeafletMap();
});

function initLeafletMap() {
    // Inisialisasi peta berpusat di tengah wilayah Indonesia secara default
    mainMap = L.map('map').setView([-2.5489, 118.0149], 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap contributors'
    }).addTo(mainMap);

    markerLayerGroup = L.layerGroup().addTo(mainMap);
}

function formatRupiah(angka) {
    if (!angka && angka !== 0) return 'Rp -';
    return 'Rp ' + parseInt(angka).toLocaleString('id-ID');
}

function kustomAlert(pesan, jenisIcon = "✨") {
    return new Promise((resolve) => {
        document.getElementById('modalIcon').innerText = jenisIcon;
        document.getElementById('modalTitle').innerText = "Informasi Sistem";
        document.getElementById('modalMessage').innerText = pesan;
        document.getElementById('modalActions').innerHTML = `<button class="modal-btn modal-btn-confirm" id="modalOkBtn">Selesai</button>`;
        const overlay = document.getElementById('customModal');
        overlay.classList.add('active');
        document.getElementById('modalOkBtn').onclick = () => { overlay.classList.remove('active'); resolve(true); };
    });
}

function kustomConfirm(pesan, jenisIcon = "⚠️") {
    return new Promise((resolve) => {
        document.getElementById('modalIcon').innerText = jenisIcon;
        document.getElementById('modalTitle').innerText = "Konfirmasi Tindakan";
        document.getElementById('modalMessage').innerText = pesan;
        document.getElementById('modalActions').innerHTML = `
            <button class="modal-btn modal-btn-cancel" id="modalCancelBtn">Batal</button>
            <button class="modal-btn modal-btn-danger" id="modalConfirmBtn">Ya, Hapus</button>
        `;
        const overlay = document.getElementById('customModal');
        overlay.classList.add('active');
        document.getElementById('modalCancelBtn').onclick = () => { overlay.classList.remove('active'); resolve(false); };
        document.getElementById('modalConfirmBtn').onclick = () => { overlay.classList.remove('active'); resolve(true); };
    });
}

async function getWeather(lat, lng) {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&lang=id&appid=${WEATHER_API_KEY}`);
        if (!response.ok) throw new Error("Gagal mengambil data cuaca");
        const data = await response.json();
        return { temp: Math.round(data.main.temp), desc: data.weather[0].description, icon: data.weather[0].icon, humidity: data.main.humidity };
    } catch (error) { return null; }
}

// --- UBAH JADI SEPERTI INI ---
db.collection('wisata').onSnapshot((snapshot) => {
    dataWisata = [];
    snapshot.forEach((doc) => { dataWisata.push({ id: doc.id, ...doc.data() }); });
    updateDropdownFilterKota();
    
    currentPage = 1; // <--- Tambahkan baris ini
    filterDanRenderRapi();
    plotSemuaMarkerPeta();
});

// Gambar Pin seluruh Wisata yang terfilter ke atas Peta
// GANTI FUNGSI INI DI MASTER INDEX.JS ANDA
function plotSemuaMarkerPeta() {
    if (!markerLayerGroup) return;
    markerLayerGroup.clearLayers();

    dataWisata.forEach(item => {
        if (item.coords && item.coords.length === 2) {
            
            // Pengkondisian Kelas Warna & Emoji Kategori
            let markerClass = 'marker-default';
            let markerEmoji = '📍';

            switch (item.category) {
                case 'Alam': markerClass = 'marker-alam'; markerEmoji = '🌲'; break;
                case 'Taman Bermain': markerClass = 'marker-taman'; markerEmoji = '🎡'; break;
                case 'Budaya/Sejarah': markerClass = 'marker-budaya'; markerEmoji = '🏛️'; break;
                case 'Kuliner': markerClass = 'marker-kuliner'; markerEmoji = '🍳'; break;
                case 'Religi': markerClass = 'marker-religi'; markerEmoji = '🕌'; break;
            }

            const customIcon = L.divIcon({
                className: 'custom-marker-wrapper',
                html: `<div class="marker-pin-glow ${markerClass}"><span class="marker-emoji-inside">${markerEmoji}</span></div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 36],
                popupAnchor: [0, -32]
            });

            // ELEMEN HTML DESKRIPSI & INFO DETAIL UNTUK DIMASUKKAN KE POPUP TITIK MAP
            const popupContent = `
                <div class="map-popup-card">
                    <div class="popup-img-header" style="background-image: url('${item.img || 'https://via.placeholder.com/300x150'}')">
                        <span class="popup-badge">${item.category}</span>
                    </div>
<div class="popup-body">
                        <h4 class="popup-title">${item.name}</h4>
                        
                        <p class="popup-location" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.4;">
                            📍 ${item.address || item.alamat || `${item.city || 'Kota'}, Indonesia`}
                        </p>
                        
                        <p class="popup-desc">${item.desc || 'Tidak ada deskripsi tersedia untuk destinasi wisata ini.'}</p>
                        <div class="popup-info-grid">
                            <div class="p-info-item">
                                <span class="p-label">🎟️ Tiket Satuan</span>
                                <b class="p-val">${formatRupiah(item.priceSingle)}</b>
                            </div>
                            <div class="p-info-item">
                                <span class="p-label">👥 Kapasitas Max</span>
                                <b class="p-val">${item.capacity || 0} Orang</b>
                            </div>
                        </div>

                        ${item.pricePromo ? `
                        <div class="popup-promo-tag">
                            🔥 <b>Promo:</b> ${formatRupiah(item.pricePromo)} <small>(${item.pricePromoPeriod || 'Terbatas'})</small>
                        </div>` : ''}

                        <button class="btn-popup-action" onclick="showPreviewDetail('${item.id}'); document.getElementById('map').classList.remove('map-window-maximize'); if(mainMap){setTimeout(()=>mainMap.invalidateSize(),300);}">
                            🔎 Kelola Detail Master
                        </button>
                    </div>
                </div>
            `;

            const marker = L.marker([item.coords[0], item.coords[1]], { icon: customIcon })
                .bindPopup(popupContent, {
                    maxWidth: 320,
                    minWidth: 280,
                    className: 'custom-leaflet-popup'
                });
            
            markerLayerGroup.addLayer(marker);
        }
    });
}
function toggleCategoryFilter(category) {
    const buttons = document.querySelectorAll('.btn-filter-cat');
    if (category === "All") {
        selectedCategories = ["All"];
        buttons.forEach(btn => btn.getAttribute('data-category') === "All" ? btn.classList.add('active') : btn.classList.remove('active'));
    } else {
        selectedCategories = selectedCategories.filter(c => c !== "All");
        document.querySelector('.btn-filter-cat[data-category="All"]').classList.remove('active');
        const targetedBtn = document.querySelector(`.btn-filter-cat[data-category="${category}"]`);

        if (selectedCategories.includes(category)) {
            selectedCategories = selectedCategories.filter(c => c !== category);
            targetedBtn.classList.remove('active');
        } else {
            selectedCategories.push(category);
            targetedBtn.classList.add('active');
        }
        if (selectedCategories.length === 0) {
            selectedCategories = ["All"];
            document.querySelector('.btn-filter-cat[data-category="All"]').classList.add('active');
        }
    }

    currentPage = 1; // <--- CUKUP TAMBAHKAN BARIS INI SAJA
    filterDanRenderRapi();
}
function updateDropdownFilterKota() {
    const filterCitySelect = document.getElementById('filterCity');
    if (!filterCitySelect) return;
    const kotaUnik = [...new Set(dataWisata.map(item => item.city).filter(Boolean))].sort();
    const pilihanSaatIni = filterCitySelect.value;
    filterCitySelect.innerHTML = '<option value="Semua">🌍 Semua Wilayah</option>';
    kotaUnik.forEach(kota => {
        filterCitySelect.innerHTML += `<option value="${kota}">${kota}</option>`;
    });
    if (kotaUnik.includes(pilihanSaatIni)) filterCitySelect.value = pilihanSaatIni;
}

// --- GANTI FUNGSI INI SEPENUHNYA ---
function filterDanRenderRapi() {
    const tableBody = document.getElementById('tableBodyWisata');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const kotaTerpilih = document.getElementById('filterCity')?.value || 'Semua';
    const urutanTerpilih = document.getElementById('sortBy')?.value || 'name-asc';

    let filteredData = [...dataWisata];

    if (kotaTerpilih !== 'Semua') filteredData = filteredData.filter(item => item.city === kotaTerpilih);
    if (!selectedCategories.includes("All")) filteredData = filteredData.filter(item => selectedCategories.includes(item.category));

    filteredData.sort((a, b) => {
        if (urutanTerpilih === 'name-asc') return (a.name || "").localeCompare(b.name || "");
        if (urutanTerpilih === 'name-desc') return (b.name || "").localeCompare(a.name || "");
        if (urutanTerpilih === 'price-asc') return (a.priceSingle || 0) - (b.priceSingle || 0);
        if (urutanTerpilih === 'price-desc') return (b.priceSingle || 0) - (a.priceSingle || 0);
        if (urutanTerpilih === 'capacity-desc') return (b.capacity || 0) - (a.capacity || 0);
        return 0;
    });

    // --- LOGIKA UTAMA PAGINATION 10 BARIS ---
    const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedItems = filteredData.slice(startIndex, endIndex);

    if (paginatedItems.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-secondary);">Tidak ada data wisata tersedia.</td></tr>`;
        updatePaginationControls(1, 1);
        hitungStatistikDinamis();
        return;
    }

    paginatedItems.forEach((item, index) => {
        const nomorUrut = startIndex + index + 1; // Nomor urut berlanjut di page 2, 3, dst.
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size: 11px; color: var(--text-secondary); min-width: 18px;">${nomorUrut}.</span>
                    <img src="${item.img || 'https://via.placeholder.com/50'}" style="width:36px; height:36px; border-radius:6px; object-fit:cover;">
                    <div>
                        <span style="font-weight:600; display:block;">${item.name}</span>
                        <span style="font-size:11px; color:var(--text-secondary);">📍 ${item.city || '-'}</span>
                    </div>
                </div>
            </td>
            <td><span class="badge-category">${item.category}</span></td>
            <td>${item.capacity || 0} Orang</td>
            <td><b>${formatRupiah(item.priceSingle)}</b></td>
            <td style="text-align: center; white-space: nowrap;">
                <button class="btn-action-sm btn-view" onclick="showPreviewDetail('${item.id}')">🔎 Detail</button>
                <button class="btn-action-sm btn-edit" onclick="prepareEdit('${item.id}')">⚙️ Edit</button>
                <button class="btn-action-sm btn-delete" onclick="deleteData('${item.id}')">🗑️</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    // Update status tombol next/prev setiap selesai merender tabel
    updatePaginationControls(currentPage, totalPages);
    hitungStatistikDinamis();
}

function hitungStatistikDinamis() {
    const total = dataWisata.length;
    const totalAlam = dataWisata.filter(w => w.category === "Alam").length;
    const totalTaman = dataWisata.filter(w => w.category === "Taman Bermain").length;
    const totalBudaya = dataWisata.filter(w => w.category === "Budaya/Sejarah").length;
    const totalKuliner = dataWisata.filter(w => w.category === "Kuliner").length;
    const totalReligi = dataWisata.filter(w => w.category === "Religi").length;

    if(document.getElementById('countAll')) document.getElementById('countAll').innerText = `(${total})`;
    if(document.getElementById('countAlam')) document.getElementById('countAlam').innerText = `(${totalAlam})`;
    if(document.getElementById('countTaman')) document.getElementById('countTaman').innerText = `(${totalTaman})`;
    if(document.getElementById('countBudaya')) document.getElementById('countBudaya').innerText = `(${totalBudaya})`;
    if(document.getElementById('countKuliner')) document.getElementById('countKuliner').innerText = `(${totalKuliner})`;
    if(document.getElementById('countReligi')) document.getElementById('countReligi').innerText = `(${totalReligi})`;

    if(document.getElementById('statTotal')) document.getElementById('statTotal').innerText = total;
    if(document.getElementById('statAlam')) document.getElementById('statAlam').innerText = totalAlam;
    if(document.getElementById('statTaman')) document.getElementById('statTaman').innerText = totalTaman;
    if(document.getElementById('statBudaya')) document.getElementById('statBudaya').innerText = totalBudaya;
    if(document.getElementById('statKuliner')) document.getElementById('statKuliner').innerText = totalKuliner;
    if(document.getElementById('statReligi')) document.getElementById('statReligi').innerText = totalReligi;
}

async function showPreviewDetail(id) {
    const item = dataWisata.find(w => w.id === id);
    if (!item) return;

    // Sembunyikan tulisan placeholder jika ada
    const placeholderText = document.getElementById('mapPlaceholderText');
    if(placeholderText) placeholderText.style.display = 'none';

    // Bersihkan detail informasi lama di bawah peta jika ada sebelumnya
    const existingDetails = document.getElementById('mapDetailedInfoCard');
    if(existingDetails) existingDetails.remove();

    // Buat wadah muat informasi baru
    const infoCard = document.createElement('div');
    infoCard.id = "mapDetailedInfoCard";
    infoCard.style.padding = "16px";
    infoCard.style.flex = "1";
    infoCard.innerHTML = `<div style="text-align:center; color:var(--text-secondary); font-size:12px;">⏳ Mengambil info cuaca & koordinat...</div>`;
    document.getElementById('detailPreviewBox').appendChild(infoCard);

    // Animasi pergeseran Peta (FlyTo) ke objek wisata terpilih
    if (mainMap && item.coords && item.coords.length === 2) {
        mainMap.flyTo([item.coords[0], item.coords[1]], 13, { animate: true, duration: 1.5 });
    }

    let weatherHTML = '';
    if(item.coords && item.coords.length === 2) {
        const weatherData = await getWeather(item.coords[0], item.coords[1]);
        if (weatherData) {
            weatherHTML = `
                <div style="display:flex; align-items:center; background:var(--preview-inner-bg); padding:10px; border-radius:8px; margin-top:12px; border:1px solid var(--border-color);">
                    <img src="https://openweathermap.org/img/wn/${weatherData.icon}.png" style="width:36px; height:36px;">
                    <div style="text-align:left; margin-left:8px;">
                        <span style="font-size:14px; font-weight:700;">${weatherData.temp}°C</span>
                        <span style="font-size:11px; color:var(--text-secondary); text-transform:capitalize;">• ${weatherData.desc}</span>
                        <div style="font-size:10px; color:var(--text-secondary);">Kelembapan: ${weatherData.humidity}%</div>
                    </div>
                </div>`;
        }
    }

    infoCard.innerHTML = `
        <div style="display:flex; flex-direction:column; background: var(--preview-inner-bg);">
            <img src="${item.img}" style="width:100%; height:140px; object-fit:cover; border-radius:10px; margin-bottom:12px;">
            <div>
                <span class="badge-category" style="margin-bottom:6px; display:inline-block;">${item.category}</span>
                <h3 style="font-size:18px; font-weight:700; margin-bottom:4px;">${item.name}</h3>
                <p style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">📍 ${item.address || 'Alamat belum dipetakan'}</p>
                <p style="font-size:12px; margin-bottom:12px;">👥 Kapasitas: <b>${item.capacity || 0} Orang</b></p>
                <div style="background:var(--price-section-bg); border-radius:8px; padding:10px; font-size:12px; border: 1px solid var(--border-color);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>💵 Tiket Satuan:</span><b>${formatRupiah(item.priceSingle)}</b></div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>📦 Paket Bundling:</span><b>${formatRupiah(item.priceBundling)}</b></div>
                    <div style="display:flex; justify-content:space-between; color:var(--accent-red); margin-bottom:4px;"><span>🔥 Harga Promo:</span><b>${formatRupiah(item.pricePromo)}</b></div>
                    <div style="font-size:10px; color:var(--text-secondary); text-align:right; margin-top:4px; border-top:1px dashed var(--border-color); padding-top:4px;">📅 Periode: ${item.pricePromoPeriod || '-'}</div>
                </div>
                ${weatherHTML}
                <h4 style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--text-secondary); margin-top:14px; margin-bottom:4px;">Deskripsi</h4>
                <p style="font-size:12px; line-height:1.5;">${item.desc || 'Tidak ada deskripsi.'}</p>
            </div>
        </div>`;
}

async function deleteData(id) {
    const item = dataWisata.find(w => w.id === id);
    if (!item) return;
    const yakinHapus = await kustomConfirm(`Apakah Anda yakin ingin menghapus destinasi "${item.name}"?`, "🗑️");
    if (yakinHapus) {
        db.collection('wisata').doc(id).delete().then(async () => {
            await kustomAlert("Data berhasil dihapus!", "✅");
            const existingDetails = document.getElementById('mapDetailedInfoCard');
            if(existingDetails) existingDetails.remove();
            const placeholderText = document.getElementById('mapPlaceholderText');
            if(placeholderText) placeholderText.style.display = 'block';
            if (editId === id) resetForm();
        });
    }
}

async function getAddress(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        return data.display_name || "Alamat tidak ditemukan";
    } catch (error) { return "Gagal memproses alamat"; }
}

function prepareEdit(id) {
    const item = dataWisata.find(w => w.id === id);
    if (!item) return;
    document.getElementById('name').value = item.name || '';
    document.getElementById('latlng').value = item.coords ? item.coords.join(', ') : '';
    document.getElementById('city').value = item.city || '';
    document.getElementById('category').value = item.category || 'Alam';
    document.getElementById('capacity').value = item.capacity || '';
    document.getElementById('imgUrl').value = item.img || '';
    document.getElementById('desc').value = item.desc || '';
    document.getElementById('priceSingle').value = item.priceSingle || '';
    document.getElementById('priceBundling').value = item.priceBundling || '';
    document.getElementById('pricePromo').value = item.pricePromo || '';
    document.getElementById('pricePromoPeriod').value = item.pricePromoPeriod || '';
    editId = id;
    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('formTitle').innerText = "⚙️ Mode Modifikasi Wisata";
    document.getElementById('btnSubmit').innerText = "Simpan Perubahan";
    document.getElementById('btnSubmit').style.background = "var(--accent-green)";
    document.getElementById('btnReset').style.display = 'block';
}

async function saveData() {
    const name = document.getElementById('name').value;
    const latlngStr = document.getElementById('latlng').value;
    const city = document.getElementById('city').value;
    const category = document.getElementById('category').value;
    const capacity = document.getElementById('capacity').value;
    const img = document.getElementById('imgUrl').value;
    const desc = document.getElementById('desc').value;
    const priceSingle = document.getElementById('priceSingle').value ? parseFloat(document.getElementById('priceSingle').value) : 0;
    const priceBundling = document.getElementById('priceBundling').value ? parseFloat(document.getElementById('priceBundling').value) : 0;
    const pricePromo = document.getElementById('pricePromo').value ? parseFloat(document.getElementById('pricePromo').value) : 0;
    const pricePromoPeriod = document.getElementById('pricePromoPeriod').value;

    if (!name || !latlngStr || !img) return kustomAlert("Mohon lengkapi isian wajib!", "⚠️");

    const coords = latlngStr.split(',').map(n => parseFloat(n.trim()));
    const address = await getAddress(coords[0], coords[1]);

    const finalData = { name, coords, city, category, capacity, address, img, desc, priceSingle, priceBundling, pricePromo, pricePromoPeriod, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };

    if (editId) {
        db.collection('wisata').doc(editId).update(finalData).then(async () => {
            await kustomAlert("Berhasil memperbarui data!", "🎉");
            resetForm(); showPreviewDetail(editId);
        });
    } else {
        db.collection('wisata').add({ ...finalData, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(async () => {
            await kustomAlert("Sukses menambahkan data baru!", "🚀");
            resetForm();
        });
    }
}

document.getElementById('searchInput').addEventListener('input', function() {
    const val = this.value.toLowerCase();
    const resBox = document.getElementById('searchResults');
    resBox.innerHTML = '';
    if (val.length < 1) { resBox.style.display = 'none'; return; }
    const filtered = dataWisata.filter(w => w.name.toLowerCase().includes(val));
    if (filtered.length > 0) {
        resBox.style.display = 'block';
        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = 'result-item';
            div.innerHTML = `<span>${item.name}</span>`;
            div.onclick = () => { showPreviewDetail(item.id); resBox.style.display = 'none'; document.getElementById('searchInput').value = item.name; };
            resBox.appendChild(div);
        });
    }
});

function toggleAdmin() {
    const panel = document.getElementById('adminPanel');
    panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
}

function resetForm() {
    editId = null;
    document.querySelectorAll('#adminPanel input, #adminPanel textarea').forEach(i => i.value = '');
    document.getElementById('category').value = "Alam";
    document.getElementById('formTitle').innerText = "✨ Tambah Wisata Baru";
    document.getElementById('btnSubmit').innerText = "Simpan ke Firestore";
    document.getElementById('btnSubmit').style.background = "var(--accent-blue)";
    document.getElementById('btnReset').style.display = 'none';
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', (savedTheme === 'dark' || (!savedTheme && prefersDark)) ? 'dark' : 'light');
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
}

initTheme();

// FUNGSI UNTUK TOGGLE MODE FULL SCREEN PADA MAP
// FUNGSI TOGGLE FULL MAP MAKSIMAL DI DALAM JENDELA BROWSER (TANPA FULLSCREEN LAYAR LENGKAP)
// --- FUNGSI TOGGLE TRUE FULLSCREEN MAP (LAYAR PENUH RESMI) ---
function toggleFullscreenMap() {
    const mapElement = document.getElementById('map');
    const btnFull = document.getElementById('btnFullMap');
    
    // Jika tidak ada elemen yang sedang fullscreen, masuk ke mode Fullscreen
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
        if (mapElement.requestFullscreen) {
            mapElement.requestFullscreen();
        } else if (mapElement.webkitRequestFullscreen) { /* Safari */
            mapElement.webkitRequestFullscreen();
        } else if (mapElement.msRequestFullscreen) { /* IE11 */
            mapElement.msRequestFullscreen();
        }
    } else {
        // Jika sedang fullscreen, maka keluar
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

// Event Listener Otomatis: Mendeteksi perubahan status Fullscreen (Termasuk jika user menekan tombol ESC)
const handleFullscreenChange = () => {
    const btnFull = document.getElementById('btnFullMap');
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    
    if (isFullscreen) {
        if(btnFull) btnFull.innerHTML = `🗗 Close Full Map`;
    } else {
        if(btnFull) btnFull.innerHTML = `<span class="icon-expand">🔲</span> Full Map`;
    }

    // Paksa Leaflet menghitung ulang ukuran kontainer peta setelah transisi fullscreen selesai
    setTimeout(() => {
        if (mainMap) {
            mainMap.invalidateSize({ animate: true });
        }
    }, 300);
};

// Daftarkan event listener ke browser
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);





// 1. Tambahkan state global baru di bagian atas file index.js (dekat let dataWisata = [])
// --- TAMBAHKAN INI UNTUK PAGINATION ---
let currentPage = 1;
const rowsPerPage = 10;

// 2. Perbarui atau ganti fungsi renderTable Anda dengan logika Pagination ini:
function renderTable(filteredData = null) {
    const tableBody = document.getElementById('tableBody Wisata') || document.querySelector('table tbody'); 
    // *Catatan: Sesuaikan ID atau selector di atas dengan ID tbody asli di HTML Anda
    
    if (!tableBody) return;
    tableBody.innerHTML = '';

    // Gunakan data terfilter (jika ada pencarian/kategori) atau gunakan seluruh dataWisata
    const displayData = filteredData !== null ? filteredData : dataWisata;

    // Hitung total halaman berdasarkan jumlah data
    const totalPages = Math.ceil(displayData.length / rowsPerPage) || 1;
    
    // Validasi agar currentPage tidak kelebihan jika data menyusut (misal setelah dihapus atau difilter)
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    if (currentPage < 1) {
        currentPage = 1;
    }

    // Tentukan indeks data awal dan akhir yang akan dipotong (.slice) untuk halaman aktif
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedItems = displayData.slice(startIndex, endIndex);

    // Jika data kosong, tampilkan baris pemberitahuan
    if (paginatedItems.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-secondary);">Tidak ada data wisata tersedia.</td></tr>`;
        updatePaginationControls(1, 1);
        return;
    }

    // Render baris data yang sudah dipotong (maksimal 10 baris)
    paginatedItems.forEach((wisata, index) => {
        // Hitung nomor urut asli agar tetap berlanjut di page 2, page 3, dst
        const nomorUrut = startIndex + index + 1; 
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${nomorUrut}</td>
            <td><b>${wisata.nama}</b></td>
            <td><span class="badge-category">${wisata.kategori}</span></td>
            <td>${wisata.kabupaten || wisata.lokasi || '-'}</td>
            <td>Rp ${(Number(wisata.harga) || 0).toLocaleString('id-ID')}</td>
            <td>⭐ ${wisata.rating || '0'}</td>
            <td>
                <div style="display:flex; gap:6px;">
                    <button class="btn-action btn-edit" onclick="editWisata('${wisata.id}')">✏️</button>
                    <button class="btn-action btn-delete" onclick="deleteWisata('${wisata.id}')">🗑️</button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Perbarui status tampilan tombol Next & Previous
    updatePaginationControls(currentPage, totalPages);
}

// 3. Fungsi pembantu untuk mengatur status tombol (Disabled / Enabled) dan teks info halaman
function updatePaginationControls(current, total) {
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');
    const pageInfo = document.getElementById('pageInfo');

    if (pageInfo) pageInfo.innerText = `Page ${current} of ${total}`;
    
    if (btnPrev) btnPrev.disabled = (current === 1);
    if (btnNext) btnNext.disabled = (current === total);
}

// 4. Fungsi event handler saat tombol Previous (-1) atau Next (+1) diklik
// --- TAMBAHKAN DUA FUNGSI BARU INI DI PALING BAWAH FILE ---

// ==========================================
// TAMBAHKAN INI DI BAGIAN PALING BAWAH JS
// ==========================================

function changePage(direction) {
    currentPage += direction;
    filterDanRenderRapi();
    
    // Otomatis scroll halus ke area tabel agar perubahan terlihat jelas
    const tableElement = document.querySelector('.table-container');
    if (tableElement) {
        tableElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function updatePaginationControls(current, total) {
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');
    const pageInfo = document.getElementById('pageInfo');

    if (pageInfo) pageInfo.innerText = `Halaman ${current} dari ${total}`;
    if (btnPrev) btnPrev.disabled = (current === 1);
    if (btnNext) btnNext.disabled = (current === total);
}
