// إخفاء شاشة التحميل عند تحميل التطبيق
window.addEventListener('load', () => {
  setTimeout(() => {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContent = document.getElementById('mainContent');
    
    if (loadingScreen && mainContent) {
      loadingScreen.style.animation = 'fadeOut 0.5s ease-out forwards';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
        mainContent.classList.remove('hidden');
        mainContent.style.animation = 'fadeIn 0.5s ease-out';
      }, 500);
    }
  }, 1500); // عرض شاشة التحميل لمدة 1.5 ثانية
});

// DOM Elements
const scanBtn = document.getElementById('scanBtn');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const barcodeListEl = document.getElementById('barcodeList');
const scannerModal = document.getElementById('scannerModal');
const readerDiv = document.getElementById('reader');
const videoEl = document.getElementById('video');
const flashBtn = document.getElementById('flashBtn');
const closeScannerBtn = document.getElementById('closeScanner');
const manualInput = document.getElementById('manualInput');
const addManualBtn = document.getElementById('addManualBtn');
const toast = document.getElementById('toast');
const scanSound = document.getElementById('scanSound');
const searchInput = document.getElementById('searchInput');
const emptyState = document.getElementById('emptyState');
// عناصر مودال التأكيد
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');
const closeConfirm = document.getElementById('closeConfirm');

// عناصر الإحصائيات
const totalCountEl = document.getElementById('totalCount');
const availableCountEl = document.getElementById('availableCount');
const unavailableCountEl = document.getElementById('unavailableCount');

// State
let barcodes = JSON.parse(localStorage.getItem('barcodes') || '[]');
let filteredBarcodes = [...barcodes];
let scanning = false;
let useBarcodeDetector = ('BarcodeDetector' in window);
let detector = null;
let stream = null;
let track = null;
let torchOn = false;
let html5QrCode = null;
let currentAction = null; // لتخزين الإجراء الحالي (حذف/تصدير)
let currentBarcodeIndex = null; // لتخزين فهرس الباركود الحالي

// Helpers
function save() {
  localStorage.setItem('barcodes', JSON.stringify(barcodes));
  updateStats();
}

function updateStats() {
  const total = barcodes.length;
  const available = barcodes.filter(b => b.available).length;
  const unavailable = total - available;
  
  if (totalCountEl) totalCountEl.textContent = total;
  if (availableCountEl) availableCountEl.textContent = available;
  if (unavailableCountEl) unavailableCountEl.textContent = unavailable;
}

function showToast(msg, time = 2600) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), time);
}

function renderList(barcodesToRender = filteredBarcodes) {
  if (!barcodeListEl) return;
  
  barcodeListEl.innerHTML = '';
  
  // إظهار/إخفاء حالة القائمة الفارغة
  if (emptyState) {
    emptyState.style.display = barcodesToRender.length === 0 ? 'block' : 'none';
  }
  
  barcodesToRender.forEach((b, originalIndex) => {
    // العثور على الفهرس الأصلي في المصفوفة الرئيسية
    const realIndex = barcodes.findIndex(item => item.value === b.value);
    
    const li = document.createElement('li');
    li.className = `barcode-item ${!b.available ? 'unavailable' : ''}`;
    li.innerHTML = `
      <div class="code">${escapeHtml(b.value.length > 16 ? b.value.substring(0, 16) + '...' : b.value)}</div>
      <div class="controls-inline">
        <div class="status ${b.available ? '' : 'unavailable'}">
          ${b.available ? 'متوفر' : 'غير متوفر'}
        </div>
        <button class="item-menu" data-action="toggle" data-i="${realIndex}" title="تبديل الحالة">
          <i class="fa-solid fa-toggle-${b.available ? 'on' : 'off'}"></i>
        </button>
        <button class="item-menu" data-action="delete" data-i="${realIndex}" title="حذف">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;
    barcodeListEl.appendChild(li);
  });
}

function escapeHtml(s) {
  return (s + '').replace(/[&<>"]/g, c => ({'&': '&', '<': '<', '>': '>', '"': '"'}[c]));
}

function filterBarcodes(searchTerm = '') {
  if (!searchTerm.trim()) {
    filteredBarcodes = [...barcodes];
  } else {
    filteredBarcodes = barcodes.filter(b => 
      b.value.includes(searchTerm.trim())
    );
  }
  renderList();
}

// البحث
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    filterBarcodes(e.target.value);
  });
}

// تحديث العرض الأولي
updateStats();
renderList();

// List delegation
if (barcodeListEl) {
  barcodeListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const i = Number(btn.dataset.i);

    if (action === 'delete') {
      // حفظ معلومات الحذف الحالية
      currentAction = 'delete';
      currentBarcodeIndex = i;
      // عرض مودال التأكيد
      showConfirmModal('⚠️ هل أنت متأكد أنك تريد حذف هذا الباركود؟');
      return;
    }

    if (action === 'toggle') {
      barcodes[i].available = !barcodes[i].available;
      save();
      filterBarcodes(searchInput ? searchInput.value : '');
      showToast('🔄 تم تغيير الحالة');
      return;
    }
  });
}

// معالجة نتيجة التأكيد
function handleConfirm(confirmed) {
  closeConfirmModal(); // إغلاق المودال

  if (confirmed) {
    if (currentAction === 'delete') {
      // تنفيذ الحذف
      barcodes.splice(currentBarcodeIndex, 1);
      save();
      filterBarcodes(searchInput ? searchInput.value : '');
      showToast('🗑️ تم حذف الباركود');
    } else if (currentAction === 'clearAll') {
      // تحقق مما إذا كانت هناك أكواد قبل الحذف
      if (barcodes.length > 0) {
        barcodes = [];
        filteredBarcodes = [];
        save();
        renderList();
        if (searchInput) searchInput.value = '';
        showToast('🗑️ تم حذف جميع الأكواد');
      } else {
        showToast('لا توجد أكواد لمسحها'); // عرض رسالة مختلفة
      }
    } else if (currentAction === 'export') {
      // تنفيذ التصدير
      exportCSV();
    }
  }

  // إعادة تعيين الإجراء الحالي
  currentAction = null;
  currentBarcodeIndex = null;
}

// دالة عرض مودال التأكيد
function showConfirmModal(message) {
  confirmMessage.textContent = message;
  confirmModal.classList.remove('hidden');
}

// دالة إغلاق مودال التأكيد
function closeConfirmModal() {
  confirmModal.classList.add('hidden');
}

// إضافة مستمعي الأحداث لأزرار التأكيد والإلغاء
confirmYes.addEventListener('click', () => handleConfirm(true));
confirmNo.addEventListener('click', () => handleConfirm(false));
closeConfirm.addEventListener('click', () => handleConfirm(false));

// Add Barcode
function addBarcode(value) {
  value = (value + '').trim();
  if (!/^[0-9]+$/.test(value)) {
    showToast('❌ الأرقام فقط مسموحة');
    return false;
  }
  // التحقق من طول الباركود (أقصى 16 رقم)
  if (value.length > 16) {
    showToast('❌ الباركود لا يجب أن يزيد عن 16 رقم');
    return false;
  }
  if (barcodes.some(b => b.value === value)) {
    showToast('⚠️ الباركود مكرر');
    return false;
  }
  barcodes.unshift({ value, available: true });
  save();
  filterBarcodes(searchInput ? searchInput.value : '');
  showToast('✅ تم إضافة الباركود بنجاح');
  return true;
}

// Tabs
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    
    // إعادة تشغيل الكاميرا عند العودة إلى تبويب الكاميرا
    if (btn.dataset.tab === 'cameraTab') {
      startScanning(); // استدعاء دالة بدء المسح
    } else {
      stopScanning(); // إيقاف المسح عند الانتقال إلى تبويب آخر
    }
  });
});

// Handle Scanned Result
function handleScanned(raw) {
  if (!raw) return;
  const s = (raw + '').trim();
  if (!/^[0-9]+$/.test(s)) {
    showToast('⚠️ المسح يحتوي على رموز غير رقمية أو QR — مسموح أرقام فقط');
    return;
  }

  // Play scan sound
  if (scanSound) {
    scanSound.play().catch(error => console.error("Sound play error:", error));
  }

  if (addBarcode(s)) {
    // إزالة أو تعليق هذا السطر لمنع إغلاق المودال
    // setTimeout(() => {
    //   if (scannerModal) {
    //     scannerModal.classList.add('hidden');
    //     stopScanning();
    //   }
    // }, 1000);
  }
}

// Start Camera and Scanning
if (scanBtn) {
  scanBtn.addEventListener('click', async () => {
    startScanning();
  });
}

async function startScanning() {
  if (!scannerModal || scanning) return;
  
  scannerModal.classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('.tab[data-tab="cameraTab"]').classList.add('active');
  document.getElementById('cameraTab').classList.add('active');

  try {
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: { ideal: 'environment' } }, 
      audio: false 
    });
    
    if (readerDiv) readerDiv.style.display = 'none';
    if (videoEl) {
      videoEl.style.display = '';
      videoEl.srcObject = stream;
      await videoEl.play();
    }
    
    track = stream.getVideoTracks()[0];

    if (useBarcodeDetector) {
      try {
        detector = new BarcodeDetector({ 
          formats: ['ean_13', 'ean_8', 'code_128', 'upc_e', 'upc_a'] 
        });
        scanning = true;
        scanLoop();
      } catch (err) {
        console.warn('BarcodeDetector init failed, fallback:', err);
        startHtml5QrFallback();
      }
    } else {
      startHtml5QrFallback();
    }
  } catch (err) {
    console.error('getUserMedia failed:', err);
    showToast('❌ الكاميرا غير مدعومة أو لم يتم السماح');
  }
}

// Stop Scanning
async function stopScanning() {
  scanning = false;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    track = null;
  }
  if (html5QrCode) {
    try {
      await html5QrCode.stop();
    } catch (e) {
      /* ignore */
    }
    html5QrCode = null;
    if (readerDiv) readerDiv.innerHTML = '';
  }
  if (videoEl) {
    videoEl.pause();
    videoEl.srcObject = null;
  }
}

// Close Modal
if (closeScannerBtn) {
  closeScannerBtn.addEventListener('click', () => {
    if (scannerModal) scannerModal.classList.add('hidden');
    stopScanning();
  });
}

// Flash Toggle
if (flashBtn) {
  flashBtn.addEventListener('click', async () => {
    if (!track) {
      showToast('⚠️ الفلاش غير متاح');
      return;
    }
    const caps = track.getCapabilities();
    if (!caps.torch) {
      showToast('⚠️ الفلاش غير مدعوم');
      return;
    }
    torchOn = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: torchOn }] });
      showToast(torchOn ? '🔦 تم تشغيل الفلاش' : '🔦 تم إيقاف الفلاش');
    } catch (e) {
      console.error('torch error', e);
      showToast('⚠️ فشل تغيير الفلاش');
    }
  });
}

// Add Barcode Manually — Button + Enter
function handleAddManual() {
  if (!manualInput) return;
  const v = (manualInput.value || '').trim();
  if (!v) {
    showToast('أدخل رقم الباركود');
    return;
  }
  if (addBarcode(v)) {
    manualInput.value = '';
    manualInput.focus();
  }
}

if (addManualBtn) {
  addManualBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleAddManual();
  });
}

if (manualInput) {
  manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddManual();
    }
  });
}

// Export CSV
function exportCSV() {
  if (!barcodes.length) {
    showToast('لا توجد بيانات للتصدير');
    return;
  }

  // تنسيق البيانات مع معالجة عمود الباركود كنص
  const csv = 'الباركود,الحالة\n' + barcodes.map(b => 
    `"${b.value}",${b.available ? 'متوفر' : 'غير متوفر'}`
  ).join('\n');
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // إنشاء رابط وهمي
  const a = document.createElement('a');
  a.style.display = 'none'; // إخفاء الرابط
  a.href = url;
  a.download = `barcodes_${new Date().toISOString().slice(0, 10)}_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.csv`;

  // إضافة الرابط إلى الصفحة
  document.body.appendChild(a);

  // النقر على الرابط برمجياً
  a.click();

  // إزالة الرابط بعد التنزيل
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);

  showToast('📤 تم تصدير الملف بنجاح');
}

if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    currentAction = 'export';
    showConfirmModal('هل أنت متأكد أنك تريد تصدير البيانات؟');
  });
}

// Clear All
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
     // حفظ الإجراء الحالي
    currentAction = 'clearAll';
    // عرض مودال التأكيد
    showConfirmModal('⚠️ هل تريد حذف جميع الأكواد؟\nهذا الإجراء لا يمكن التراجع عنه.');
  });
}

// إغلاق المودال عند النقر خارجها
if (scannerModal) {
  scannerModal.addEventListener('click', (e) => {
    if (e.target === scannerModal) {
      scannerModal.classList.add('hidden');
      stopScanning();
    }
  });
}

async function scanLoop() {
  if (!scanning || !detector || !videoEl) return;
  try {
    const results = await detector.detect(videoEl);
    if (results && results.length) {
      for (const r of results) {
        const fmt = (r.format || '').toString().toLowerCase();
        if (fmt.includes('qr')) {
          showToast('⚠️ QR غير مسموح');
          continue;
        }
        if (r.rawValue) handleScanned(r.rawValue);
      }
    }
  } catch (err) {
    console.error('detect error', err);
  }
  if (scanning) setTimeout(scanLoop, 500);
}

async function startHtml5QrFallback() {
  try {
    if (readerDiv) readerDiv.style.display = '';
    if (videoEl) videoEl.style.display = 'none';
    
    const devices = await Html5Qrcode.getCameras();
    if (!devices || devices.length === 0) throw new Error('لا توجد كاميرات');
    const cam = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[0];

    html5QrCode = new Html5Qrcode('reader');
    await html5QrCode.start(cam.id, { fps: 10, qrbox: 250 }, (decodedText, result) => {
      let fmt = '';
      try {
        fmt = (result && result.result && result.result.format && result.result.formatName) || '';
      } catch (e) {
        fmt = '';
      }
      if (fmt.toLowerCase().includes('qr') || /qr/i.test(fmt)) {
        showToast('⚠️ QR غير مسموح');
        return;
      }
      handleScanned(decodedText);
    }, (err) => {
      // per-frame errors ignored
    });
  } catch (err) {
    console.error('html5-qrcode failed', err);
    showToast('❌ فشل تشغيل الماسح');
  }
}