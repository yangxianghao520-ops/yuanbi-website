/* ============================================================
   重庆圆皕齿轮官网 — 全站共享脚本
   ============================================================ */

(function () {
  'use strict';

  // ---------- Security Utilities ----------
  var SECRET_KEY = 'yb-gear-2026-' + location.hostname;

  function simpleHash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  function generateHmac(data, timestamp) {
    var payload = JSON.stringify(data) + '|' + timestamp + '|' + SECRET_KEY;
    return simpleHash(payload);
  }

  function signInquiryData(data) {
    var timestamp = Date.now();
    return { data: data, ts: timestamp, sig: generateHmac(data, timestamp) };
  }

  function verifyInquiryData(entry) {
    if (!entry || !entry.sig || !entry.ts || !entry.data) return null;
    var expected = generateHmac(entry.data, entry.ts);
    if (expected !== entry.sig) { console.warn('Inquiry data integrity check failed'); return null; }
    return entry.data;
  }

  function getSignedInquiries() {
    try {
      var raw = localStorage.getItem('yuanbi_inquiries_v2');
      if (!raw) {
        var v1 = localStorage.getItem('yuanbi_inquiries');
        if (v1) {
          var list = JSON.parse(v1);
          if (Array.isArray(list)) {
            var migrated = list.map(function(item) { return signInquiryData(item); });
            localStorage.setItem('yuanbi_inquiries_v2', JSON.stringify(migrated));
            localStorage.removeItem('yuanbi_inquiries');
            return list;
          }
        }
        return [];
      }
      var entries = JSON.parse(raw);
      if (!Array.isArray(entries)) return [];
      var valid = [];
      var invalid = false;
      entries.forEach(function(entry) {
        var data = verifyInquiryData(entry);
        if (data) valid.push(data); else invalid = true;
      });
      if (invalid) {
        console.warn('Some inquiry records failed integrity verification and were discarded');
        localStorage.setItem('yuanbi_inquiries_v2', JSON.stringify(valid.map(signInquiryData)));
      }
      return valid;
    } catch (e) { console.warn('Failed to read inquiry data:', e); return []; }
  }

  function saveSignedInquiries(list) {
    try {
      var signed = list.map(signInquiryData);
      localStorage.setItem('yuanbi_inquiries_v2', JSON.stringify(signed));
    } catch (e) { console.warn('Failed to save inquiry data:', e); }
  }

  function createAuthToken() {
    var now = Date.now();
    var expiry = now + 24 * 60 * 60 * 1000;
    var payload = now + '|' + expiry + '|' + SECRET_KEY;
    return { token: simpleHash(payload), ts: now, expiry: expiry };
  }

  function verifyAuthToken(stored) {
    if (!stored) return false;
    try {
      var parsed = JSON.parse(stored);
      if (!parsed.token || !parsed.ts || !parsed.expiry) return false;
      if (Date.now() > parsed.expiry) return false;
      var payload = parsed.ts + '|' + parsed.expiry + '|' + SECRET_KEY;
      return simpleHash(payload) === parsed.token;
    } catch (e) { return false; }
  }

  function getLoginAttempts() {
    try {
      var raw = sessionStorage.getItem('yuanbi_login_attempts');
      if (!raw) return { count: 0, lockedUntil: 0 };
      return JSON.parse(raw);
    } catch (e) { return { count: 0, lockedUntil: 0 }; }
  }

  function recordLoginAttempt() {
    var attempts = getLoginAttempts();
    attempts.count = (attempts.count || 0) + 1;
    if (attempts.count >= 5) { attempts.lockedUntil = Date.now() + 5 * 60 * 1000; }
    sessionStorage.setItem('yuanbi_login_attempts', JSON.stringify(attempts));
  }

  function resetLoginAttempts() { sessionStorage.removeItem('yuanbi_login_attempts'); }

  function isLoginLocked() {
    var attempts = getLoginAttempts();
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) return true;
    if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) resetLoginAttempts();
    return false;
  }

  function getLockRemainingMinutes() {
    var attempts = getLoginAttempts();
    if (!attempts.lockedUntil) return 0;
    return Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
  }

  // ---------- Image Assets Map ----------
  window.YB_IMAGES = {
    bannerFactory: 'images/banner_1_workshop.jpg',
    bannerProducts: 'images/banner_2_gear_cert.jpg',
    bannerNewPlant: 'images/banner_3_smart_factory.jpg',
    productGear: 'images/product_1_engine_gears.jpg',
    productSprocket: 'images/product_2_motorcycle_sprocket.jpg',
    productHeat: 'images/product_3_heat_treatment.jpg',
    productForging: 'images/product_4_forging.jpg',
    factoryCNC: 'images/factory_1_cnc_panorama.jpg',
    qualityLab: 'images/factory_2_quality_inspection.jpg'
  };

  // ---------- Navigation / Header ----------
  function initHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var onScroll = function () {
      if (window.scrollY > 20) { header.classList.add('scrolled'); } else { header.classList.remove('scrolled'); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    var menuBtn = document.querySelector('.mobile-menu-btn');
    var mainNav = document.querySelector('.main-nav');
    if (menuBtn && mainNav) {
      menuBtn.addEventListener('click', function () {
        var isOpen = menuBtn.classList.toggle('open');
        mainNav.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
      mainNav.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          menuBtn.classList.remove('open');
          mainNav.classList.remove('open');
          menuBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  // ---------- Back to Top ----------
  function initBackToTop() {
    var btn = document.querySelector('.back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', function () {
      if (window.scrollY > 400) { btn.classList.add('visible'); } else { btn.classList.remove('visible'); }
    }, { passive: true });
    btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  // ---------- Scroll Reveal Animation ----------
  function initScrollReveal() {
    var elements = document.querySelectorAll('.fade-in');
    if (!elements.length || !('IntersectionObserver' in window)) {
      elements.forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    elements.forEach(function (el) { observer.observe(el); });
  }

  // ---------- Count-Up Animation ----------
  function initCountUp() {
    var numbers = document.querySelectorAll('[data-count]');
    if (!numbers.length) return;
    function animateNumber(el, target, duration) {
      var start = 0;
      var startTime = performance.now();
      var suffix = el.dataset.suffix || '';
      var prefix = el.dataset.prefix || '';
      function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
      function update(currentTime) {
        var elapsed = currentTime - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var value = Math.floor(start + (target - start) * easeOutExpo(progress));
        el.textContent = prefix + value.toLocaleString('zh-CN') + suffix;
        if (progress < 1) { requestAnimationFrame(update); }
        else { el.textContent = prefix + target.toLocaleString('zh-CN') + suffix; }
      }
      requestAnimationFrame(update);
    }
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateNumber(entry.target, parseFloat(entry.target.dataset.count), 2000);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });
      numbers.forEach(function (el) { observer.observe(el); });
    } else {
      numbers.forEach(function (el) {
        var target = parseFloat(el.dataset.count);
        el.textContent = (el.dataset.prefix || '') + target.toLocaleString('zh-CN') + (el.dataset.suffix || '');
      });
    }
  }

  // ---------- Hero Carousel ----------
  function initHeroCarousel() {
    var carousel = document.querySelector('.hero-banner');
    if (!carousel) return;
    var slides = carousel.querySelectorAll('.hero-slide');
    var dots = carousel.querySelectorAll('.hero-dot');
    var prevBtn = carousel.querySelector('.hero-prev');
    var nextBtn = carousel.querySelector('.hero-next');
    if (!slides.length) return;
    var currentIndex = 0;
    var autoplayTimer = null;
    var autoplayInterval = 5000;
    function goTo(index) {
      slides[currentIndex].classList.remove('active');
      if (dots[currentIndex]) dots[currentIndex].classList.remove('active');
      currentIndex = (index + slides.length) % slides.length;
      slides[currentIndex].classList.add('active');
      if (dots[currentIndex]) dots[currentIndex].classList.add('active');
    }
    function startAutoplay() { stopAutoplay(); autoplayTimer = setInterval(function () { goTo(currentIndex + 1); }, autoplayInterval); }
    function stopAutoplay() { if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; } }
    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(currentIndex - 1); startAutoplay(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(currentIndex + 1); startAutoplay(); });
    dots.forEach(function (dot, i) { dot.addEventListener('click', function () { goTo(i); startAutoplay(); }); });
    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);
    carousel.setAttribute('tabindex', '0');
    carousel.setAttribute('role', 'region');
    carousel.setAttribute('aria-label', '首页轮播');
    carousel.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(currentIndex - 1); startAutoplay(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentIndex + 1); startAutoplay(); }
    });
    startAutoplay();
  }

  // ---------- Tabs ----------
  function initTabs() {
    document.querySelectorAll('[data-tabs]').forEach(function (tabsContainer) {
      var tabBtns = tabsContainer.querySelectorAll('.tab-btn');
      var panels = tabsContainer.querySelectorAll('.tab-panel');
      if (!tabBtns.length || !panels.length) return;
      tabBtns.forEach(function (btn, index) {
        btn.setAttribute('role', 'tab');
        btn.setAttribute('tabindex', btn.classList.contains('active') ? '0' : '-1');
        btn.setAttribute('aria-selected', btn.classList.contains('active') ? 'true' : 'false');
        var target = btn.dataset.tab;
        if (target) btn.setAttribute('aria-controls', target);
        btn.addEventListener('click', function () {
          var targetId = btn.dataset.tab;
          tabBtns.forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); b.setAttribute('tabindex', '-1'); });
          panels.forEach(function (p) { p.classList.remove('active'); });
          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');
          btn.setAttribute('tabindex', '0');
          btn.focus();
          var targetPanel = tabsContainer.querySelector('#' + targetId);
          if (targetPanel) targetPanel.classList.add('active');
          if (history.replaceState) { history.replaceState(null, '', '#' + targetId); }
        });
        btn.addEventListener('keydown', function (e) {
          var currentIdx = Array.prototype.indexOf.call(tabBtns, btn);
          var nextIdx = currentIdx;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextIdx = (currentIdx + 1) % tabBtns.length; }
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); nextIdx = (currentIdx - 1 + tabBtns.length) % tabBtns.length; }
          else if (e.key === 'Home') { e.preventDefault(); nextIdx = 0; }
          else if (e.key === 'End') { e.preventDefault(); nextIdx = tabBtns.length - 1; }
          if (nextIdx !== currentIdx) { tabBtns[nextIdx].click(); }
        });
      });
      panels.forEach(function (panel) { panel.setAttribute('role', 'tabpanel'); panel.setAttribute('tabindex', '0'); });
      var hash = window.location.hash.replace('#', '');
      if (hash) {
        var matchingBtn = tabsContainer.querySelector('[data-tab="' + hash + '"]');
        if (matchingBtn) matchingBtn.click();
      }
    });
  }

  // ---------- Form Validation & Submission ----------
  function initInquiryForm() {
    var form = document.getElementById('inquiry-form');
    if (!form) return;
    var modal = document.getElementById('success-modal');
    var closeModal = document.getElementById('close-modal');
    var submitBtn = form.querySelector('button[type="submit"]');
    var originalBtnText = submitBtn ? submitBtn.textContent : '提交';
    var rules = {
      company: { required: true, minLength: 2, message: '请输入公司名称' },
      contact: { required: true, minLength: 2, message: '请输入联系人姓名' },
      phone: { required: true, pattern: /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/, message: '请输入有效的手机号码或座机号' },
      email: { required: false, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '请输入有效的电子邮箱' },
      productType: { required: true, message: '请选择需求类型' },
      description: { required: true, minLength: 10, message: '请详细描述您的需求（至少10个字符）' }
    };
    function validateField(name) {
      var field = form.querySelector('[name="' + name + '"]');
      var rule = rules[name];
      if (!field || !rule) return true;
      var value = field.value.trim();
      var errorEl = form.querySelector('[data-error-for="' + name + '"]');
      var isValid = true;
      if (rule.required && !value) { isValid = false; }
      else if (value && rule.minLength && value.length < rule.minLength) { isValid = false; }
      else if (value && rule.pattern && !rule.pattern.test(value)) { isValid = false; }
      if (!isValid) {
        field.classList.add('error');
        if (errorEl) { errorEl.textContent = rule.message; errorEl.classList.add('show'); }
      } else {
        field.classList.remove('error');
        if (errorEl) errorEl.classList.remove('show');
      }
      return isValid;
    }
    Object.keys(rules).forEach(function (name) {
      var field = form.querySelector('[name="' + name + '"]');
      if (field) {
        field.addEventListener('blur', function () { validateField(name); });
        field.addEventListener('input', function () { if (field.classList.contains('error')) validateField(name); });
      }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var allValid = true;
      Object.keys(rules).forEach(function (name) { if (!validateField(name)) allValid = false; });
      if (!allValid) {
        var firstError = form.querySelector('.error');
        if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '提交中...'; }
      var formData = {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        company: form.company.value.trim(),
        contact: form.contact.value.trim(),
        phone: form.phone.value.trim(),
        email: form.email.value.trim(),
        productType: form.productType.value,
        description: form.description.value.trim()
      };
      attemptSubmit(formData, function(success, message) {
        if (success) { if (modal) modal.classList.add('show'); form.reset(); }
        else { alert(message || '提交遇到问题，数据已暂存到本地。请联系管理员处理。'); if (modal) modal.classList.add('show'); form.reset(); }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalBtnText; }
      });
    });
    function attemptSubmit(formData, callback) {
      fetch('/api/inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      .then(function(res) {
        return res.json().then(function(data) {
          if (data.success) { callback(true); }
          else {
            var existing = getSignedInquiries();
            existing.unshift(formData);
            saveSignedInquiries(existing);
            callback(false, data.message || '提交失败，数据已暂存到本地。');
          }
        });
      })
      .catch(function(err) {
        console.warn('Submit failed, fallback to localStorage:', err);
        var existing = getSignedInquiries();
        existing.unshift(formData);
        saveSignedInquiries(existing);
        callback(false, '网络异常，数据已暂存到本地。请确保服务器已启动后重试。');
      });
    }
    if (closeModal && modal) {
      closeModal.addEventListener('click', function () { modal.classList.remove('show'); if (submitBtn) submitBtn.focus(); });
      modal.addEventListener('click', function (e) { if (e.target === modal) { modal.classList.remove('show'); if (submitBtn) submitBtn.focus(); } });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('show')) { modal.classList.remove('show'); if (submitBtn) submitBtn.focus(); } });
    }
  }

  // ---------- Admin Panel ----------
  function initAdmin() {
    var loginSection = document.getElementById('admin-login');
    var adminApp = document.getElementById('admin-app');
    var loginForm = document.getElementById('login-form');
    var logoutBtn = document.getElementById('logout-btn');
    if (!loginSection || !adminApp) return;
    var ADMIN_PASSWORD = window.YB_ADMIN_PASSWORD || '';
    var AUTH_KEY = 'yuanbi_admin_auth';
    function generateCaptcha() {
      var a = Math.floor(Math.random() * 10) + 1;
      var b = Math.floor(Math.random() * 10) + 1;
      return { question: a + ' + ' + b + ' = ?', answer: String(a + b) };
    }
    var captchaData = generateCaptcha();
    function renderCaptcha() {
      var captchaEl = document.getElementById('captcha-question');
      if (captchaEl) captchaEl.textContent = captchaData.question;
      var input = document.getElementById('captcha-input');
      if (input) input.value = '';
    }
    function checkAuth() {
      var stored = sessionStorage.getItem(AUTH_KEY);
      if (verifyAuthToken(stored)) { loginSection.style.display = 'none'; adminApp.style.display = 'block'; renderInquiries(); }
      else { loginSection.style.display = 'flex'; adminApp.style.display = 'none'; sessionStorage.removeItem(AUTH_KEY); }
    }
    if (loginForm) {
      var captchaGroup = document.getElementById('captcha-group');
      if (!captchaGroup) {
        var submitBtn = loginForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          captchaGroup = document.createElement('div');
          captchaGroup.className = 'form-group';
          captchaGroup.id = 'captcha-group';
          captchaGroup.innerHTML =
            '<label class="form-label" for="captcha-input">验证码：<span id="captcha-question" style="font-weight:700;color:var(--color-primary);"></span></label>' +
            '<input type="text" id="captcha-input" class="form-input" placeholder="请输入答案" autocomplete="off">' +
            '<div class="form-error-msg" id="captcha-error"></div>';
          submitBtn.parentNode.insertBefore(captchaGroup, submitBtn);
          renderCaptcha();
        }
      }
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var errorEl = document.getElementById('login-error');
        if (isLoginLocked()) {
          if (errorEl) { errorEl.textContent = '登录次数过多，请 ' + getLockRemainingMinutes() + ' 分钟后再试'; errorEl.classList.add('show'); }
          return;
        }
        var captchaInput = document.getElementById('captcha-input');
        if (captchaInput && captchaInput.value.trim() !== captchaData.answer) {
          var captchaError = document.getElementById('captcha-error');
          if (captchaError) { captchaError.textContent = '验证码错误，请重新计算'; captchaError.classList.add('show'); }
          captchaData = generateCaptcha();
          renderCaptcha();
          recordLoginAttempt();
          return;
        }
        var pwd = loginForm.password.value;
        if (!ADMIN_PASSWORD) {
          if (errorEl) { errorEl.textContent = '系统未配置管理员密码，请联系技术人员'; errorEl.classList.add('show'); }
          recordLoginAttempt();
          return;
        }
        if (pwd === ADMIN_PASSWORD) {
          var token = createAuthToken();
          sessionStorage.setItem(AUTH_KEY, JSON.stringify(token));
          resetLoginAttempts();
          checkAuth();
        } else {
          recordLoginAttempt();
          if (errorEl) {
            var remaining = 5 - getLoginAttempts().count;
            errorEl.textContent = remaining > 0 ? '密码错误，还剩 ' + remaining + ' 次机会' : '登录次数过多，请 5 分钟后再试';
            errorEl.classList.add('show');
          }
          captchaData = generateCaptcha();
          renderCaptcha();
        }
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        sessionStorage.removeItem(AUTH_KEY);
        if (loginForm) loginForm.reset();
        checkAuth();
      });
    }
    function getInquiries() { return getSignedInquiries(); }
    function renderInquiries() {
      var list = getInquiries();
      var totalEl = document.getElementById('stat-total');
      var todayEl = document.getElementById('stat-today');
      var tableBody = document.getElementById('inquiry-tbody');
      var searchInput = document.getElementById('admin-search');
      var exportBtn = document.getElementById('export-btn');
      var exportCsvBtn = document.getElementById('export-csv-btn');
      if (totalEl) totalEl.textContent = list.length;
      if (todayEl) {
        var today = new Date().toDateString();
        todayEl.textContent = list.filter(function (item) { return new Date(item.createdAt).toDateString() === today; }).length;
      }
      function escapeHtml(str) { var div = document.createElement('div'); div.textContent = str || ''; return div.innerHTML; }
      function renderTable(data) {
        if (!tableBody) return;
        if (!data.length) { tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--color-gray-500)">暂无询价记录</td></tr>'; return; }
        tableBody.innerHTML = data.map(function (item) {
          var date = new Date(item.createdAt);
          var dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') + ' ' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
          return '<tr>' +
            '<td>' + dateStr + '</td>' +
            '<td>' + escapeHtml(item.company) + '</td>' +
            '<td>' + escapeHtml(item.contact) + '</td>' +
            '<td>' + escapeHtml(item.phone) + '</td>' +
            '<td>' + escapeHtml(item.productType) + '</td>' +
            '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(item.description) + '">' + escapeHtml(item.description) + '</td>' +
            '<td><button class="btn btn-sm btn-outline-dark view-detail" data-id="' + item.id + '">查看</button></td>' +
            '</tr>';
        }).join('');
        tableBody.querySelectorAll('.view-detail').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = parseInt(btn.dataset.id);
            var item = list.find(function (x) { return x.id === id; });
            if (item) showDetailModal(item);
          });
        });
      }
      function showDetailModal(item) {
        var modal = document.getElementById('detail-modal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'detail-modal';
          modal.className = 'modal-overlay';
          modal.setAttribute('role', 'dialog');
          modal.setAttribute('aria-modal', 'true');
          modal.innerHTML = '<div class="modal-dialog" style="max-width:600px;text-align:left">' +
            '<h3 style="margin-bottom:20px">询价详情</h3>' +
            '<div id="detail-content" style="font-size:0.9375rem;line-height:2;color:var(--color-gray-700)"></div>' +
            '<div style="margin-top:24px;text-align:center"><button id="detail-close" class="btn btn-outline-dark">关闭</button></div></div>';
          document.body.appendChild(modal);
          modal.addEventListener('click', function (e) { if (e.target === modal) { modal.classList.remove('show'); document.body.style.overflow = ''; } });
        }
        var content = document.getElementById('detail-content');
        var date = new Date(item.createdAt);
        var dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') + ' ' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
        content.innerHTML =
          '<p><strong>提交时间：</strong>' + dateStr + '</p>' +
          '<p><strong>公司名称：</strong>' + escapeHtml(item.company) + '</p>' +
          '<p><strong>联系人：</strong>' + escapeHtml(item.contact) + '</p>' +
          '<p><strong>联系电话：</strong>' + escapeHtml(item.phone) + '</p>' +
          '<p><strong>电子邮箱：</strong>' + escapeHtml(item.email || '-') + '</p>' +
          '<p><strong>需求类型：</strong>' + escapeHtml(item.productType) + '</p>' +
          '<p><strong>需求详情：</strong><br>' + escapeHtml(item.description).replace(/\n/g, '<br>') + '</p>';
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        document.getElementById('detail-close').onclick = function () { modal.classList.remove('show'); document.body.style.overflow = ''; };
      }
      renderTable(list);
      if (searchInput) {
        searchInput.addEventListener('input', function () {
          var keyword = searchInput.value.trim().toLowerCase();
          if (!keyword) { renderTable(list); return; }
          renderTable(list.filter(function (item) {
            return item.company.toLowerCase().includes(keyword) || item.contact.toLowerCase().includes(keyword) ||
              item.phone.toLowerCase().includes(keyword) || item.productType.toLowerCase().includes(keyword) ||
              item.description.toLowerCase().includes(keyword);
          }));
        });
      }
      function downloadFile(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      function getDateString() {
        var d = new Date();
        return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '_' +
          String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + String(d.getSeconds()).padStart(2, '0');
      }
      if (exportBtn) {
        exportBtn.addEventListener('click', function () {
          var data = getInquiries();
          if (!data.length) { alert('暂无数据可导出'); return; }
          downloadFile(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'yuanbi_inquiries_' + getDateString() + '.json');
        });
      }
      if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', function () {
          var data = getInquiries();
          if (!data.length) { alert('暂无数据可导出'); return; }
          var headers = ['提交时间', '公司名称', '联系人', '联系电话', '电子邮箱', '需求类型', '需求详情'];
          var rows = data.map(function (item) {
            var date = new Date(item.createdAt);
            return [date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') + ' ' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0'),
              item.company, item.contact, item.phone, item.email || '', item.productType, item.description];
          });
          var csvContent = '\uFEFF' + [headers].concat(rows).map(function (row) {
            return row.map(function (cell) { cell = String(cell).replace(/"/g, '""'); return '"' + cell + '"'; }).join(',');
          }).join('\n');
          downloadFile(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }), 'yuanbi_inquiries_' + getDateString() + '.csv');
        });
      }
    }
    checkAuth();
  }

  // ---------- Initialize on DOM Ready ----------
  function init() {
    initHeader();
    initBackToTop();
    initScrollReveal();
    initCountUp();
    initHeroCarousel();
    initTabs();
    initInquiryForm();
    initAdmin();
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();