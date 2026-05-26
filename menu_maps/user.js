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
const WEATHER_API_KEY = "142e02684f39b930a542e4b0d3ba1f73"; 

let dataWisata = [];
let selectedCategories = ["All"]; 
let activeBookingItem = null;
let wishlist = JSON.parse(localStorage.getItem('wisata_wishlist')) || [];

let mainMap = null;
let markerLayerGroup = null;
let currentUserData = null;

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('selected_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    initLeafletMap();
    cekSesiUserAktif();
});

function initLeafletMap() {
    if (mainMap) return;

    mainMap = L.map('map').setView([-2.5489, 118.0149], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap contributors'
    }).addTo(mainMap);
    
    markerLayerGroup = L.layerGroup().addTo(mainMap);

    const legendControl = L.control({ position: 'bottomright' });
    legendControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'map-legend-card');
        div.innerHTML = `
            <div class="legend-header">🎨 Kategori</div>
            <div class="legend-item"><span class="legend-color-dot" style="background: #2ecc71;"></span><span>🌲 Alam</span></div>
            <div class="legend-item"><span class="legend-color-dot" style="background: #e74c3c;"></span><span>🍳 Kuliner</span></div>
            <div class="legend-item"><span class="legend-color-dot" style="background: #f1c40f;"></span><span>🏛️ Budaya</span></div>
            <div class="legend-item"><span class="legend-color-dot" style="background: #9b59b6;"></span><span>🎡 Taman</span></div>
            <div class="legend-item"><span class="legend-color-dot" style="background: #00f2fe;"></span><span>📍 Lainnya</span></div>
        `;
        return div;
    };
    legendControl.addTo(mainMap);
}

function formatRupiah(angka) {
    if (!angka && angka !== 0) return 'Rp 0';
    return 'Rp ' + parseInt(angka).toLocaleString('id-ID');
}

db.collection('wisata').onSnapshot((snapshot) => {
    dataWisata = [];
    snapshot.forEach((doc) => { dataWisata.push({ id: doc.id, ...doc.data() }); });
    updateDropdownFilterKota();
    filterDanRenderUserSide(); 
    hitungStatistikDinamis();
});

function hitungStatistikDinamis() {
    if(document.getElementById('statTotal')) document.getElementById('statTotal').innerText = dataWisata.length;
    if(document.getElementById('statAlam')) document.getElementById('statAlam').innerText = dataWisata.filter(w => w.category === "Alam").length;
    if(document.getElementById('statKuliner')) document.getElementById('statKuliner').innerText = dataWisata.filter(w => w.category === "Kuliner").length;
}

function updateDropdownFilterKota() {
    const filterCitySelect = document.getElementById('filterCity');
    if (!filterCitySelect) return;
    const kotaUnik = [...new Set(dataWisata.map(item => item.city).filter(Boolean))].sort();
    const currentVal = filterCitySelect.value;
    filterCitySelect.innerHTML = '<option value="Semua">🌍 Semua Wilayah</option>';
    kotaUnik.forEach(kota => {
        filterCitySelect.innerHTML += `<option value="${kota}">${kota}</option>`;
    });
    if (kotaUnik.includes(currentVal)) filterCitySelect.value = currentVal;
}

// FIX: Menambahkan implementasi fungsi Pencarian Cepat
function handleSearchSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const resultContainer = document.getElementById('searchResults');
    if (!resultContainer) return;

    if (!query) {
        resultContainer.innerHTML = '';
        filterDanRenderUserSide();
        return;
    }

    const filtered = dataWisata.filter(item => 
        (item.name && item.name.toLowerCase().includes(query)) || 
        (item.city && item.city.toLowerCase().includes(query))
    );

    resultContainer.innerHTML = '';
    if (filtered.length === 0) {
        resultContainer.innerHTML = `<div style="padding:10px; font-size:12px; color:var(--text-secondary);">Tidak ada hasil</div>`;
    } else {
        filtered.forEach(item => {
            const div = document.createElement('div');
            div.style.padding = '8px 12px';
            div.style.cursor = 'pointer';
            div.style.fontSize = '12px';
            div.style.borderBottom = '1px solid var(--border-color)';
            div.innerHTML = `<strong>${item.name}</strong> <small style="color:var(--text-secondary)">(${item.city || 'Indonesia'})</small>`;
            div.onclick = () => {
                showUserDetail(item.id);
                resultContainer.innerHTML = '';
                document.getElementById('searchInput').value = item.name;
            };
            resultContainer.appendChild(div);
        });
    }

    const containerWisata = document.getElementById('sidebarWisataList');
    if (containerWisata) {
        // Tampilkan juga hasil filter pencarian pada list utama sidebar
        renderListCard(filtered, containerWisata);
    }
}

function filterDanRenderUserSide() {
    const container = document.getElementById('sidebarWisataList');
    if (!container) return;

    const kotaTerpilih = document.getElementById('filterCity')?.value || 'Semua';
    const urutanTerpilih = document.getElementById('sortBy')?.value || 'name-asc';

    let filtered = [...dataWisata];
    if (kotaTerpilih !== 'Semua') {
        filtered = filtered.filter(item => item.city === kotaTerpilih);
    }
    if (!selectedCategories.includes("All")) {
        filtered = filtered.filter(item => selectedCategories.includes(item.category));
    }

    filtered.sort((a, b) => {
        if (urutanTerpilih === 'name-asc') return (a.name || "").localeCompare(b.name || "");
        if (urutanTerpilih === 'price-asc') return (a.priceSingle || 0) - (b.priceSingle || 0);
        if (urutanTerpilih === 'price-desc') return (b.priceSingle || 0) - (a.priceSingle || 0);
        return 0;
    });

    renderListCard(filtered, container);
}

// Membantu perulangan list agar kode lebih efisien dan modular
function renderListCard(dataArray, container) {
    container.innerHTML = '';
    dataArray.forEach(item => {
        const isFav = wishlist.includes(item.id);
        const div = document.createElement('div');
        div.className = 'wisata-user-card';
        div.onclick = (e) => {
            if (e.target.closest('.btn-fav-inside')) return;
            showUserDetail(item.id);
        };
        div.innerHTML = `
            <img src="${item.img || 'https://via.placeholder.com/120'}" class="card-thumb">
            <div class="card-info">
                <h4>${item.name}</h4>
                <div class="card-meta-line"><i class="fa-solid fa-location-dot"></i> ${item.city || 'Indonesia'}</div>
                <div class="card-bottom-row">
                    <div class="card-price-tag">${formatRupiah(item.priceSingle)}</div>
                    <button class="btn-fav-inside ${isFav ? 'active' : ''}" onclick="requireAuthentication(() => toggleWishlist('${item.id}'))">
                        <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
    plotMarkerPetaSesuaiFilter(dataArray);
}

function toggleCategoryFilter(category) {
    const buttons = document.querySelectorAll('.tag-btn');
    if (category === "All") {
        selectedCategories = ["All"];
        buttons.forEach(btn => btn.getAttribute('data-category') === "All" ? btn.classList.add('active') : btn.classList.remove('active'));
    } else {
        selectedCategories = selectedCategories.filter(c => c !== "All");
        const allBtn = document.querySelector('.tag-btn[data-category="All"]');
        if(allBtn) allBtn.classList.remove('active');
        
        const targetedBtn = document.querySelector(`.tag-btn[data-category="${category}"]`);
        if (selectedCategories.includes(category)) {
            selectedCategories = selectedCategories.filter(c => c !== category);
            if(targetedBtn) targetedBtn.classList.remove('active');
        } else {
            selectedCategories.push(category);
            if(targetedBtn) targetedBtn.classList.add('active');
        }
        if (selectedCategories.length === 0) {
            selectedCategories = ["All"];
            if(allBtn) allBtn.classList.add('active');
        }
    }
    filterDanRenderUserSide();
}

function plotMarkerPetaSesuaiFilter(dataTerfilter) {
    if (!markerLayerGroup) return;
    markerLayerGroup.clearLayers();

    dataTerfilter.forEach(item => {
        if (item.coords && item.coords.length === 2) {
            let markerColor = '#00f2fe'; 
            let markerEmoji = '📍';

            switch (item.category) {
                case 'Alam': markerColor = '#2ecc71'; markerEmoji = '🌲'; break;
                case 'Kuliner': markerColor = '#e74c3c'; markerEmoji = '🍳'; break;
                case 'Budaya/Sejarah': markerColor = '#f1c40f'; markerEmoji = '🏛️'; break;
                case 'Taman Bermain': markerColor = '#9b59b6'; markerEmoji = '🎡'; break;
            }

            const customIcon = L.divIcon({
                className: 'custom-marker-wrapper',
                html: `
                    <div class="marker-pin-glow" style="border-color: ${markerColor}; box-shadow: 0 0 15px ${markerColor}; background: ${markerColor}33;">
                        <span class="marker-emoji-inside">${markerEmoji}</span>
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const marker = L.marker([item.coords[0], item.coords[1]], { icon: customIcon });
            marker.on('click', () => showUserDetail(item.id));
            markerLayerGroup.addLayer(marker);
        }
    });
}

async function getWeather(lat, lng) {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&lang=id&appid=${WEATHER_API_KEY}`);
        if (!response.ok) return null;
        return await response.json();
    } catch { return null; }
}

async function showUserDetail(id) {
    const item = dataWisata.find(w => w.id === id);
    if (!item) return;

    const previewBox = document.getElementById('detailPreviewBox');
    if (!previewBox) return;
    
    previewBox.classList.add('active');
    previewBox.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> Menghubungkan Satelit Cuaca...</div>`;

    if (mainMap && item.coords) {
        mainMap.flyTo([item.coords[0], item.coords[1]], 12, { animate: true, duration: 1.2 });
    }

    let weatherHTML = `<div class="minimal-weather-box"><p style="font-size:11px; color:var(--text-secondary);"><i class="fa-solid fa-cloud-sun"></i> Info cuaca gagal dimuat</p></div>`;
    if (item.coords) {
        const wData = await getWeather(item.coords[0], item.coords[1]);
        if (wData) {
            weatherHTML = `
                <div class="minimal-weather-box">
                    <img src="https://openweathermap.org/img/wn/${wData.weather[0].icon}@2x.png">
                    <div>
                        <h4>${Math.round(wData.main.temp)}°C</h4>
                        <p style="text-transform:capitalize;">${wData.weather[0].description}<br>Kelembapan: ${wData.main.humidity}%</p>
                    </div>
                </div>
            `;
        }
    }

    let promoHTML = '';
    if (item.pricePromo) {
        promoHTML = `
            <div class="detail-promo-strip">
                <span>🔥 ${formatRupiah(item.pricePromo)}</span>
                <small>Periode: ${item.pricePromoPeriod || 'Promo Terbatas'}</small>
            </div>
        `;
    }
previewBox.innerHTML = `
        <div class="detail-img-banner" style="background-image: url('${item.img || 'https://via.placeholder.com/400x200'}')">
            <button class="detail-close-btn" onclick="const container = document.querySelector('.floating-detail-card-container'); if(container) { container.classList.remove('active'); container.style.display = 'none'; }">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <span class="category-badge-user">${item.category}</span>
        </div>
        <div class="detail-body-content">
            <h3>${item.name}</h3>
            <div class="detail-location-pill"><i class="fa-solid fa-location-dot"></i> ${item.city || 'Indonesia'}</div>
            <p class="detail-desc-text">${item.desc || 'Belum ada deskripsi lengkap dari admin.'}</p>
            <div class="detail-capacity-badge">Kuota Destinasi: 255</div>
            <div class="detail-pricing-toggle-grid">
                <div class="price-toggle-box"><span>Satuan</span><strong>${formatRupiah(item.priceSingle)}</strong></div>
                <div class="price-toggle-box"><span>Bundling</span><strong>${formatRupiah(item.priceBundling || item.priceSingle * 4)}</strong></div>
            </div>
            ${promoHTML}
            ${weatherHTML}
            <button class="btn-book-floating-action" onclick="requireAuthentication(() => openBookingModal('${item.id}'))"><i class="fa-solid fa-ticket"></i> Pesan E-Tiket Sekarang</button>
        </div>
    `;
}

function openBookingModal(id) {
    const item = dataWisata.find(w => w.id === id);
    if (!item) return;
    activeBookingItem = item;

    document.getElementById('bookTitle').innerText = `🎟️ Booking: ${item.name}`;
    const optPromo = document.getElementById('optPromo');
    if(optPromo) {
        optPromo.style.display = item.pricePromo ? 'block' : 'none';
        if(item.pricePromo) {
            optPromo.innerText = `🔥 Promo: ${item.pricePromoPeriod || 'Diskon'} (${formatRupiah(item.pricePromo)})`;
        }
    }

    if(document.getElementById('bookCustomerName')) document.getElementById('bookCustomerName').value = currentUserData ? currentUserData.name : '';
    document.getElementById('bookQuantity').value = 1;
    document.getElementById('bookDate').value = new Date().toISOString().split('T')[0];

    hitungTotalBayar();
    document.getElementById('bookingModal').classList.add('active');
}

function closeBookingModal() {
    document.getElementById('bookingModal').classList.remove('active');
}

function hitungTotalBayar() {
    if (!activeBookingItem) return;
    const type = document.getElementById('bookTicketType').value;
    const qty = parseInt(document.getElementById('bookQuantity').value) || 1;
    
    let hargaSatuan = activeBookingItem.priceSingle;
    if (type === 'bundling') hargaSatuan = activeBookingItem.priceBundling || (activeBookingItem.priceSingle * 0.8);
    if (type === 'promo') hargaSatuan = activeBookingItem.pricePromo || activeBookingItem.priceSingle;

    document.getElementById('lblBasePrice').innerText = formatRupiah(hargaSatuan);
    document.getElementById('lblTotalPrice').innerText = formatRupiah(hargaSatuan * qty);
}

function prosesCheckoutTiket() {
    if (!currentUserData) {
        closeBookingModal();
        openAuthGatekeeper();
        return;
    }

    const type = document.getElementById('bookTicketType').value;
    const qty = parseInt(document.getElementById('bookQuantity').value) || 1;
    const tanggalPilihan = document.getElementById('bookDate').value;
    const metodeBayar = document.getElementById('bookPaymentMethod').value;
    
    let hargaSatuan = activeBookingItem.priceSingle;
    if (type === 'bundling') hargaSatuan = activeBookingItem.priceBundling || (activeBookingItem.priceSingle * 0.8);
    if (type === 'promo') hargaSatuan = activeBookingItem.pricePromo || activeBookingItem.priceSingle;

    const totalBayar = hargaSatuan * qty;
    const customOrderId = 'INV-' + Date.now();
    
    const dataOrderBaru = {
        orderId: customOrderId,
        wisataId: activeBookingItem.id,
        namaWisata: activeBookingItem.name,
        kategoriWisata: activeBookingItem.category,
        tipeTiket: type,
        jumlahTiket: qty,
        hargaSatuan: hargaSatuan,
        totalPembayaran: totalBayar,
        tanggalWisata: tanggalPilihan,
        metodePembayaran: metodeBayar,
        statusPembayaran: metodeBayar === 'qris' ? 'Pending' : 'Unpaid',
        tanggalTransaksi: firebase.firestore.FieldValue.serverTimestamp()
    };

    closeBookingModal();

    if (metodeBayar === 'qris') {
        bukaPopupQRIS(dataOrderBaru);
    } else {
        simpanOrderKeFirebase(dataOrderBaru);
    }
}

function simpanOrderKeFirebase(dataOrder) {
    db.collection('users').doc(currentUserData.name).collection('orders').doc(dataOrder.orderId).set(dataOrder)
    .then(() => {
        let kontenSukses = `
            <div class="invoice-success-box">
                <p><b>ID Invoice:</b> ${dataOrder.orderId}</p>
                <p><b>Destinasi:</b> ${dataOrder.namaWisata}</p>
                <p><b>Jumlah:</b> ${dataOrder.jumlahTiket} Tiket</p>
                <p><b>Total Bayar:</b> ${formatRupiah(dataOrder.totalPembayaran)}</p>
            </div>
            <p style="margin-top:10px; color:var(--accent-glow); text-align:center;">Pesanan berhasil dibuat! Silakan lakukan transfer manual.</p>
        `;
        kustomAlert(kontenSukses, "🎉");
    })
    .catch((error) => {
        console.error("Gagal write sub-collection orders:", error);
        kustomAlert("Gagal menyimpan data tiket ke cloud user.", "❌");
    });
}

function bukaPopupQRIS(dataOrder) {
    const msgEl = document.getElementById('modalMessage');
    const iconEl = document.getElementById('modalIcon');
    const titleEl = document.getElementById('modalTitle');
    const actionsEl = document.getElementById('modalActions');
    const modalEl = document.getElementById('customModal');

    if(iconEl) iconEl.innerText = "📱";
    if(titleEl) titleEl.innerText = "Pembayaran QRIS Interaktif";

    let qrisContent = `
        <div class="qris-container">
            <div class="qris-header-logo">
                <span class="qris-brand">QRIS</span>
                <span class="qris-gpn">GPN</span>
            </div>
            <p class="qris-merchant">EKSPLORASI NUSANTARA PREMIUM</p>
            <p class="qris-nmID">NMID : ID1020304050607</p>
            <div class="qris-image-wrapper">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://karyafa.com/checkout/${dataOrder.orderId}&color=0b0c10" alt="QRIS Code">
            </div>
            <div class="qris-countdown-box">
                <span>Sisa Waktu Pembayaran</span>
                <strong id="qrisTimer">05:00</strong>
            </div>
            <div class="invoice-success-box" style="background: rgba(255,255,255,0.02); border-color: var(--border-color); width: 100%;">
                <div class="bill-row"><span>Total Tagihan:</span><b style="color:var(--accent-orange); font-size:14px;">${formatRupiah(dataOrder.totalPembayaran)}</b></div>
                <div class="bill-row" style="font-size:10px; margin-top:4px;"><span>ID Transaksi:</span><span>${dataOrder.orderId}</span></div>
            </div>
        </div>
    `;

    if(msgEl) msgEl.innerHTML = qrisContent;

    if(actionsEl) {
        actionsEl.innerHTML = `
            <button class="modal-btn modal-btn-cancel" onclick="clearInterval(window.qrisInterval); document.getElementById('customModal').classList.remove('active')">ga sido order su</button>
            <button class="modal-btn modal-btn-confirm" id="btnCheckQRIS" style="background:var(--accent-glow); color:#0b0c10;">
                <i class="fa-solid fa-rotate"></i> Cek Status Pembayaran
            </button>
        `;
    }

    if(modalEl) modalEl.classList.add('active');

    let waktuSisa = 300; 
    clearInterval(window.qrisInterval);
    window.qrisInterval = setInterval(() => {
        waktuSisa--;
        let menit = Math.floor(waktuSisa / 60);
        let detik = waktuSisa % 60;
        const timerBox = document.getElementById('qrisTimer');
        if(timerBox) timerBox.innerText = `${menit.toString().padStart(2, '0')}:${detik.toString().padStart(2, '0')}`;
        
        if (waktuSisa <= 0) {
            clearInterval(window.qrisInterval);
            kustomAlert("Waktu pembayaran QRIS telah habis. Silakan pesan kembali.", "⏰");
        }
    }, 1000);

    document.getElementById('btnCheckQRIS').onclick = () => {
        const btn = document.getElementById('btnCheckQRIS');
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memverifikasi Bank...`;
        btn.disabled = true;

        setTimeout(() => {
            clearInterval(window.qrisInterval);
            dataOrder.statusPembayaran = 'Paid';
            
            db.collection('users').doc(currentUserData.name).collection('orders').doc(dataOrder.orderId).set(dataOrder)
            .then(() => {
                let suksesHTML = `
                    <div style="text-align:center; padding: 10px 0;">
                        <div class="success-checkmark-glow">🎉</div>
                        <h4 style="color:var(--accent-glow); font-size:16px; margin-bottom:10px;">Pembayaran Berhasil Diverifikasi!</h4>
                        <p style="font-size:12px; color:var(--text-secondary); line-height:1.5;">
                            E-Tiket untuk destinasi <b>${dataOrder.namaWisata}</b> telah aktif dan dikirimkan ke sub-collection akun Anda. Selamat berlibur!
                        </p>
                    </div>
                `;
                kustomAlert(suksesHTML, "✅");
            });
        }, 2000);
    };
}

// FIX: Mengamankan fungsi kustomAlert tunggal agar support text & innerHTML objek
function kustomAlert(pesan, icon = "✨") {
    const iconEl = document.getElementById('modalIcon');
    const msgEl = document.getElementById('modalMessage');
    const actionsEl = document.getElementById('modalActions');
    const modalEl = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');

    if(iconEl) iconEl.innerText = icon;
    if(titleEl) titleEl.innerText = "Notifikasi Sistem";
    if(msgEl) msgEl.innerHTML = pesan; 
    if(actionsEl) actionsEl.innerHTML = `<button class="modal-btn" style="background:var(--accent-blue); color:white;" onclick="document.getElementById('customModal').classList.remove('active')">Mengerti</button>`;
    if(modalEl) modalEl.classList.add('active');
}

function toggleWishlist(idWisata) {
    if (!currentUserData) {
        openAuthGatekeeper();
        return;
    }

    const subWishlistDocRef = db.collection('users').doc(currentUserData.name).collection('wishlist').doc(idWisata);
    const sudahAda = wishlist.includes(idWisata);

    if (!sudahAda) {
        subWishlistDocRef.set({
            wisataId: idWisata,
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            kustomAlert("Destinasi ditambahkan ke favorit kamu! ❤️", "❤️");
        })
        .catch((error) => {
            console.error("Gagal insert sub-collection wishlist:", error);
        });
    } else {
        subWishlistDocRef.delete()
        .then(() => {
            kustomAlert("Destinasi dihapus dari favorit kamu.", "🗑️");
        })
        .catch((error) => {
            console.error("Gagal delete sub-collection wishlist:", error);
        });
    }
}

function updateWishlistBadge() {
    const badge = document.getElementById('wishlistCount');
    if (badge) {
        badge.innerText = wishlist.length;
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('selected_theme', newTheme);
}

function cekSesiUserAktif() {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
        currentUserData = JSON.parse(sessionData);
        updateUserInterfaceAuthenticated(currentUserData);
        
        db.collection('users').doc(currentUserData.name).collection('wishlist')
        .onSnapshot((snapshot) => {
            wishlist = [];
            snapshot.forEach((doc) => {
                wishlist.push(doc.id);
            });
            localStorage.setItem('wisata_wishlist', JSON.stringify(wishlist));
            updateWishlistBadge();
            filterDanRenderUserSide(); 
        }, (error) => {
            console.error("Gagal sync sub-collection wishlist:", error);
        });
    } else {
        currentUserData = null;
        wishlist = JSON.parse(localStorage.getItem('wisata_wishlist')) || [];
        updateUserInterfaceGuest();
        updateWishlistBadge();
        filterDanRenderUserSide();
    }
}

// 1. MODIFIKASI: Mengubah perilaku tombol profile saat diklik setelah login
function updateUserInterfaceAuthenticated(user) {
    const profileBtn = document.getElementById('profileNavBtn'); 
    if (profileBtn) {
        profileBtn.innerHTML = `<i class="fa-solid fa-user"></i> ${user.name}`;
        // Mengubah target onclick untuk memicu kemunculan modal info profil
        profileBtn.setAttribute('onclick', 'showProfileModal()');
    }
}

// 2. TAMBAHAN: Fungsi baru untuk merender Informasi Akun & Tombol Logout di dalam Custom Modal
function showProfileModal() {
    if (!currentUserData) return;

    const msgEl = document.getElementById('modalMessage');
    const iconEl = document.getElementById('modalIcon');
    const titleEl = document.getElementById('modalTitle');
    const actionsEl = document.getElementById('modalActions');
    const modalEl = document.getElementById('customModal');

    if (iconEl) iconEl.innerText = "👤";
    if (titleEl) titleEl.innerText = "Informasi Profil Pengguna";

    // Menyusun struktur layout informasi data akun yang sleek dan clean
    let profileContent = `
        <div style="padding: 10px 0; text-align: left;">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="width: 70px; height: 70px; background: rgba(0, 242, 254, 0.1); border: 2px solid var(--accent-glow); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px auto; box-shadow: 0 0 15px rgba(0, 242, 254, 0.2);">
                    <i class="fa-solid fa-user-shield" style="font-size: 32px; color: var(--accent-glow);"></i>
                </div>
                <h4 style="font-size: 16px; color: var(--text-primary); margin: 0;">${currentUserData.name}</h4>
                <p style="font-size: 11px; color: var(--accent-blue); margin-top: 2px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">User Explorer</p>
            </div>
            
            <div class="invoice-success-box" style="background: rgba(255,255,255,0.02); border-color: var(--border-color); width: 100%; display: flex; flex-direction: column; gap: 8px;">
                <div class="bill-row" style="margin: 0;">
                    <span><i class="fa-solid fa-heart" style="color: #ff3b30;"></i> Total Favorit:</span>
                    <b style="color: var(--text-primary);">${wishlist.length} Destinasi</b>
                </div>
                <div class="bill-row" style="margin: 0; padding-top: 6px; border-top: 1px solid var(--border-color);">
                    <span><i class="fa-solid fa-fingerprint"></i> Status Sesi:</span>
                    <b style="color: #2ecc71;">Aktif Login</b>
                </div>
            </div>
        </div>
    `;

    if (msgEl) msgEl.innerHTML = profileContent;

    // Menyediakan opsi aksi: Tutup Modal atau Logout Akun
    if (actionsEl) {
        actionsEl.innerHTML = `
            <button class="modal-btn modal-btn-cancel" onclick="document.getElementById('customModal').classList.remove('active')">Tutup</button>
            <button class="modal-btn" style="background: #ff3b30; color: white;" onclick="handleLogoutFromModal()">
                <i class="fa-solid fa-right-from-bracket"></i> Keluar Akun
            </button>
        `;
    }

    if (modalEl) modalEl.classList.add('active');
}

// 3. TAMBAHAN: Handler interaksi tombol jembatan menuju prosesLogoutUser
function handleLogoutFromModal() {
    // Tutup custom modal terlebih dahulu
    document.getElementById('customModal').classList.remove('active');
    // Jalankan fungsi logout bawaan sistem
    prosesLogoutUser();
}
function updateUserInterfaceGuest() {
    console.log("Mengakses sebagai Guest (Tanpa Login).");
}

function requireAuthentication(actionCallback) {
    if (currentUserData) {
        actionCallback();
    } else {
        openAuthGatekeeper();
    }
}

function openAuthGatekeeper() {
    const modal = document.getElementById('authGatekeeperModal');
    if (!modal) return;
    const card = modal.querySelector('.glass-card');
    
    modal.classList.remove('opacity-0', 'pointer-events-none');
    if(card) {
        card.classList.remove('scale-90');
        card.classList.add('scale-100');
    }
}

function closeAuthGatekeeper() {
    const modal = document.getElementById('authGatekeeperModal');
    if (!modal) return;
    const card = modal.querySelector('.glass-card');
    
    modal.classList.add('opacity-0', 'pointer-events-none');
    if(card) {
        card.classList.remove('scale-100');
        card.classList.add('scale-90');
    }
}

function redirectToAuth(mode) {
    localStorage.setItem('auth_redirect_mode', mode);
    window.location.href = 'login.html';
}

function prosesLogoutUser() {
    // 1. Hapus sesi login user
    localStorage.removeItem('user_session');
    
    // 2. HAPUS JUGA data wishlist lokal agar tidak tersisa di browser
    localStorage.removeItem('wisata_wishlist');
    wishlist = []; // Kosongkan array global di memori

    // 3. Reset total badge menjadi 0 langsung
    const badge = document.getElementById('wishlistCount');
    if (badge) badge.innerText = '0';

    // 4. Perbarui status UI ke mode Tamu (Guest)
    if (typeof updateUserInterfaceGuest === 'function') {
        updateUserInterfaceGuest();
    }

    // 5. Kembalikan paksa user ke halaman Home utama yang estetik
    if (typeof switchMenu === 'function') {
        switchMenu('home');
    } else {
        window.location.reload(); // Cadangan jika switchMenu bermasalah
    }
}


// TAMBAHAN: Fungsi untuk menampilkan daftar destinasi favorit di dalam custom modal
function openWishlistModal() {
    // 1. Validasi: Pastikan pengguna sudah login terlebih dahulu
    if (!currentUserData) {
        openAuthGatekeeper();
        return;
    }

    const msgEl = document.getElementById('modalMessage');
    const iconEl = document.getElementById('modalIcon');
    const titleEl = document.getElementById('modalTitle');
    const actionsEl = document.getElementById('modalActions');
    const modalEl = document.getElementById('customModal');

    if (iconEl) iconEl.innerText = "❤️";
    if (titleEl) titleEl.innerText = "Destinasi Favorit Kamu";

    // 2. Filter data wisata global berdasarkan ID yang tersimpan di array wishlist
    const dataFavorit = dataWisata.filter(item => wishlist.includes(item.id));

    // Jika belum ada destinasi yang difavoritkan
    if (dataFavorit.length === 0) {
        if (msgEl) {
            msgEl.innerHTML = `
                <div style="text-align:center; padding: 20px 0; color: var(--text-secondary);">
                    <i class="fa-regular fa-heart" style="font-size: 40px; margin-bottom: 10px; opacity: 0.3;"></i>
                    <p style="font-size: 13px; margin: 0;">Belum ada destinasi impian yang disimpan.</p>
                    <small style="font-size: 11px; color: var(--text-secondary);">Klik ikon hati pada daftar wisata untuk menambahkannya.</small>
                </div>
            `;
        }
        if (actionsEl) {
            actionsEl.innerHTML = `<button class="modal-btn" style="background: var(--accent-blue); color: white;" onclick="document.getElementById('customModal').classList.remove('active')">Cari Destinasi</button>`;
        }
        if (modalEl) modalEl.classList.add('active');
        return;
    }

    // 3. Render list item destinasi favorit ke dalam struktur HTML modal
    let listContentHTML = `<div class="wishlist-modal-list" style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 5px;">`;
    
    dataFavorit.forEach(item => {
        listContentHTML += `
            <div class="wishlist-popup-card" onclick="handleWishlistCardClick('${item.id}')" style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 8px; border-radius: 12px; cursor: pointer; transition: all 0.2s;">
                <img src="${item.img || 'https://via.placeholder.com/60'}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">
                <div style="flex: 1; text-align: left;">
                    <h5 style="margin: 0; font-size: 13px; color: var(--text-primary);">${item.name}</h5>
                    <small style="color: var(--text-secondary); font-size: 11px;"><i class="fa-solid fa-location-dot"></i> ${item.city || 'Indonesia'}</small>
                </div>
                <button onclick="event.stopPropagation(); toggleWishlistFromModal('${item.id}')" style="background: none; border: none; color: #ff3b30; cursor: pointer; padding: 8px; font-size: 14px;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
    });
    
    listContentHTML += `</div>`;

    if (msgEl) msgEl.innerHTML = listContentHTML;

    if (actionsEl) {
        actionsEl.innerHTML = `<button class="modal-btn" style="background: var(--border-color); color: var(--text-primary);" onclick="document.getElementById('customModal').classList.remove('active')">Tutup</button>`;
    }

    if (modalEl) modalEl.classList.add('active');
}

// TAMBAHAN: Handler saat kartu favorit di dalam modal diklik (Menutup modal & langsung memfokuskan lokasi map)
function handleWishlistCardClick(id) {
    document.getElementById('customModal').classList.remove('active');
    showUserDetail(id);
}

// TAMBAHAN: Handler khusus menghapus wishlist langsung dari baris modal agar UI langsung ter-refresh otomatis
function toggleWishlistFromModal(idWisata) {
    // Jalankan fungsi hapus data utama bawaan sistem kamu
    toggleWishlist(idWisata);
    // Buka kembali modal wishlist untuk merefresh tampilan list terbaru
    setTimeout(() => {
        openWishlistModal();
    }, 200);
}




// Fungsi utama saat tombol Home/House diklik
function goHome() {
    // 1. Reset input pencarian di UI jika ada
    const searchInput = document.getElementById('txtSearch');
    if (searchInput) searchInput.value = '';
    
    // Reset kategori ke "All"
    selectedCategories = ["All"];
    document.querySelectorAll('.tag-btn').forEach(btn => {
        if (btn.innerText.trim() === 'All') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 2. Kembalikan peta ke posisi default Indonesia
    if (mainMap) {
        mainMap.flyTo([-2.548926, 118.0148634], 5, {
            animate: true,
            duration: 1.2
        });
    }

    // 3. Render HTML Welcome Page baru ke dalam list kiri
    renderWelcomePageHTML();
}



// ================= INTERACTIVE HOMEPAGE NAVIGATION & BACKGROUND CAROUSEL =================
let homepageBackgroundInterval = null;

function switchMenu(menuName) {
    const homePage = document.getElementById('homePageWorkspace');
    const mapsSidebar = document.getElementById('mapsSidebarWorkspace');
    const mapsView = document.getElementById('mapsViewWorkspace');
    const btnHome = document.getElementById('btnNavHome');
    const btnMaps = document.getElementById('btnNavMaps');

    if (menuName === 'home') {
        // Tampilkan halaman Utama
        if (homePage) homePage.style.display = 'flex';
        // Sembunyikan Workspace Peta dan Destinasi
        if (mapsSidebar) mapsSidebar.style.display = 'none';
        if (mapsView) mapsView.style.display = 'none';

        // Atur status aktif tombol navigasi
        if (btnHome) btnHome.classList.add('active');
        if (btnMaps) btnMaps.classList.remove('active');
        
        // Mulai interval slideshow jika masuk halaman home
        startHomepageSlideshow();
    } 
    else if (menuName === 'maps') {
        // Sembunyikan halaman Utama
        if (homePage) homePage.style.display = 'none';
        // Tampilkan Workspace Peta dan Destinasi
        if (mapsSidebar) mapsSidebar.style.display = 'flex';
        if (mapsView) mapsView.style.display = 'block';

        // Atur status aktif tombol navigasi
        if (btnHome) btnHome.classList.remove('active');
        if (btnMaps) btnMaps.classList.add('active');

        // Hentikan interval slideshow untuk menghemat memori perangkat saat di halaman peta
        if (homepageBackgroundInterval) {
            clearInterval(homepageBackgroundInterval);
            homepageBackgroundInterval = null;
        }

        // Segarkan layout Leaflet agar peta tidak macet/abu-abu saat dirender pertama kali
        if (mainMap) {
            setTimeout(() => {
                mainMap.invalidateSize();
            }, 150);
        }
    }
}

function startHomepageSlideshow() {
    if (homepageBackgroundInterval) clearInterval(homepageBackgroundInterval);
    
    const slides = document.querySelectorAll('.homepage-slideshow .slide');
    if (slides.length === 0) return;
    
    let currentSlideIndex = 0;
    
    homepageBackgroundInterval = setInterval(() => {
        slides[currentSlideIndex].classList.remove('active');
        currentSlideIndex = (currentSlideIndex + 1) % slides.length;
        slides[currentSlideIndex].classList.add('active');
    }, 5000); // Berganti otomatis setiap 5 detik
}

// Ubah fungsi DOMContentLoaded bawaan Anda atau tambahkan baris penguncian halaman awal seperti ini:
window.addEventListener('DOMContentLoaded', () => {
    // ... baris kode tema & inisialisasi maps bawaan Anda ...
    
    // Kunci langsung mengarah ke halaman Home utama saat web pertama kali dimuat
    switchMenu('home');
});

// Fungsi penjaga: Memastikan user harus login sebelum membuka fitur krusial
function jalankanProteksiFitur(actionFunction) {
    const sessionData = localStorage.getItem('user_session');
    
    if (!sessionData) {
        // Jika tidak ada sesi login (Mode Tamu), panggil modal gatekeeper bawaan Anda
        const gatekeeperModal = document.getElementById('authGatekeeperModal');
        if (gatekeeperModal) {
            // Hilangkan class pembatas bawaan Anda agar modalnya muncul mentereng
            gatekeeperModal.classList.remove('opacity-0', 'pointer-events-none');
            gatekeeperModal.classList.add('active'); // atau sesuaikan dengan class aktif Anda
        } else {
            alert("🔑 Akses Terbatas: Silakan masuk akun terlebih dahulu untuk menikmati fitur ini.");
        }
    } else {
        // Jika sudah login, izinkan fungsi utama berjalan (misal: openWishlistModal)
        actionFunction();
    }
}


// Fungsi membuka modal orderan dan memuat data tiket
function bukaModalOrderan() {
    const modal = document.getElementById('modalOrderan');
    if (modal) {
        modal.classList.add('active');
        muatDataETiket();
    }
}

// Fungsi menutup modal orderan
function tutupModalOrderan() {
    const modal = document.getElementById('modalOrderan');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Fungsi mengambil data tiket dan merendernya ke HTML
function muatDataETiket() {
    const container = document.getElementById('listTiketContainer');
    if (!container) return;

    // Ambil data sesi user saat ini (untuk memfilter tiket milik user tersebut)
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 13px;">
                🔒 Silakan login terlebih dahulu untuk melihat riwayat E-Tiket Anda.
            </div>
        `;
        return;
    }

    const userData = JSON.parse(sessionData);
    const userEmail = userData.email;

    // Mengambil riwayat checkout langsung dari Firestore Firebase
    db.collection("transaksi")
      .where("email", "==", userEmail)
      .orderBy("waktu_transaksi", "desc")
      .get()
      .then((querySnapshot) => {
          container.innerHTML = ""; // Bersihkan loading state

          if (querySnapshot.empty) {
              container.innerHTML = `
                  <div style="text-align: center; padding: 30px 10px; color: var(--text-secondary); font-size: 13px;">
                      <p style="font-size: 24px; margin-bottom: 5px;">🎫</p>
                      Belum ada pemesanan tiket. Yuk, jelajahi destinasi impianmu sekarang!
                  </div>
              `;
              return;
          }

          querySnapshot.forEach((doc) => {
              const data = doc.data();
              
              // Membuat format tanggal lokal yang rapi
              let tanggalFormat = "Bukan Tanggal Valid";
              if(data.waktu_transaksi) {
                  const tgl = data.waktu_transaksi.toDate();
                  tanggalFormat = tgl.toLocaleDateString('id-ID', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute:'2-digit'
                  });
              }

              // Hitung jumlah pax / tiket dari total pembayaran (misal harga tiket konstan atau tersimpan)
              // Di sini kita tampilkan informasi utama yang dibeli user
              const tiketCardHTML = `
                  <div class="tiket-card">
                      <div class="tiket-header">
                          <span class="tiket-title">🗺️ ${data.nama_wisata || 'Destinasi Nusantara'}</span>
                          <span class="tiket-status">LUNAS</span>
                      </div>
                      <div class="tiket-info-row">
                          <span>ID Pemesanan:</span>
                          <strong>#${doc.id.substring(0, 8).toUpperCase()}</strong>
                      </div>
                      <div class="tiket-info-row">
                          <span>Nama Pemesan:</span>
                          <strong>${data.nama_pemesan || userData.nama || 'Pengunjung'}</strong>
                      </div>
                      <div class="tiket-info-row">
                          <span>Waktu Pembelian:</span>
                          <strong>${tanggalFormat} WIB</strong>
                      </div>
                      <div class="tiket-info-row" style="margin-top: 4px; border-top: 1px dotted var(--border-color); padding-top: 6px;">
                          <span style="color: var(--accent-glow);">Total Bayar:</span>
                          <strong style="color: var(--accent-glow); font-size: 14px;">${data.total_harga || 'Rp 0'}</strong>
                      </div>
                  </div>
              `;
              container.innerHTML += tiketCardHTML;
          });
      })
      .catch((error) => {
          console.error("Gagal mengambil e-tiket: ", error);
          container.innerHTML = `
              <div style="text-align: center; padding: 20px; color: #ff9500; font-size: 13px;">
                  ⚠️ Gagal memuat data e-tiket. Pastikan koneksi internet stabil.
              </div>
          `;
      });
}