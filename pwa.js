// pwa.js - إدارة تثبيت التطبيق التدريجي
let deferredPrompt = null;
const installBtn = document.getElementById('installBtn');

// تسجيل Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log('✅ Service Worker Registered'))
    .catch((err) => console.warn('❌ Service Worker Failed', err));
}

// فحص حالة التثبيت عند تحميل الصفحة
window.addEventListener('load', () => {
  checkInstallStatus();
});

// فحص حالة التثبيت
function checkInstallStatus() {
  // فحص إذا كان التطبيق يعمل في وضع standalone (مثبت)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // فحص إذا كان المستخدم قد ثبت التطبيق مسبقاً (localStorage)
  const wasInstalled = localStorage.getItem('appInstalled') === 'true';
  
  // فحص إذا كان يعمل في Safari على iOS (وضع standalone)
  const isIOSStandalone = window.navigator.standalone === true;
  
  if (isStandalone || wasInstalled || isIOSStandalone) {
    hideInstallButton();
  }
}

// إخفاء زر التثبيت نهائياً
function hideInstallButton() {
  if (installBtn) {
    installBtn.style.display = 'none';
    installBtn.classList.add('hidden');
  }
}

// عرض زر التثبيت
function showInstallButton() {
  if (installBtn && !isAppInstalled()) {
    // فحص إذا كان الجهاز iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // في iOS، عرض تعليمات التثبيت اليدوي
      installBtn.innerHTML = '📱 إضافة للشاشة الرئيسية';
      installBtn.style.display = 'block';
      
      installBtn.onclick = () => {
        alert('لتثبيت التطبيق:\n1. اضغط على زر المشاركة في المتصفح\n2. اختر "إضافة إلى الشاشة الرئيسية"');
      };
    } else {
      // للأجهزة الأخرى، عرض زر التثبيت العادي
      installBtn.innerHTML = '📲 تثبيت التطبيق';
      installBtn.style.display = 'block';
    }
  }
}

// فحص إذا كان التطبيق مثبت
function isAppInstalled() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const wasInstalled = localStorage.getItem('appInstalled') === 'true';
  const isIOSStandalone = window.navigator.standalone === true;
  
  return isStandalone || wasInstalled || isIOSStandalone;
}

// مراقبة حدث beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
  // منع عرض النافذة التلقائية
  e.preventDefault();
  deferredPrompt = e;
  
  // عرض زر التثبيت فقط إذا لم يكن التطبيق مثبت
  if (!isAppInstalled()) {
    showInstallButton();
  }
});

// معالجة الضغط على زر التثبيت
if (installBtn) {
  installBtn.addEventListener('click', async () => {
    // فحص إذا كان الجهاز iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // في iOS، عرض تعليمات التثبيت
      alert('لتثبيت التطبيق:\n1. اضغط على زر المشاركة ⎗ في شريط المتصفح\n2. اختر "إضافة إلى الشاشة الرئيسية"\n3. اضغط "إضافة"');
      return;
    }
    
    if (!deferredPrompt) return;
    
    // عرض نافذة التثبيت
    deferredPrompt.prompt();
    
    // انتظار اختيار المستخدم
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('✅ تم قبول تثبيت التطبيق');
      
      // إخفاء زر التثبيت وحفظ الحالة
      hideInstallButton();
      localStorage.setItem('appInstalled', 'true');
      
      // عرض رسالة نجاح
      if (typeof showToast === 'function') {
        showToast('✅ تم تثبيت التطبيق بنجاح!');
      }
    } else {
      console.log('❌ تم رفض تثبيت التطبيق');
    }
    
    // إعادة تعيين deferredPrompt
    deferredPrompt = null;
  });
}

// مراقبة تغيير وضع العرض
window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
  if (e.matches) {
    // التطبيق يعمل في وضع standalone
    hideInstallButton();
    localStorage.setItem('appInstalled', 'true');
  }
});

// مراقبة حدث appinstalled
window.addEventListener('appinstalled', () => {
  console.log('✅ تم تثبيت التطبيق بنجاح');
  hideInstallButton();
  localStorage.setItem('appInstalled', 'true');
  
  if (typeof showToast === 'function') {
    showToast('✅ تم تثبيت التطبيق بنجاح!');
  }
});

// إضافة دالة لإعادة تعيين حالة التثبيت (للاختبار فقط)
function resetInstallStatus() {
  localStorage.removeItem('appInstalled');
  if (installBtn) {
    installBtn.style.display = 'none';
  }
  console.log('🔄 تم إعادة تعيين حالة التثبيت');
}

// جعل الدالة متاحة عالمياً للاختبار
window.resetInstallStatus = resetInstallStatus;