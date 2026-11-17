/**
 * GudangLingling AI — 3-Menu Architecture & Draggable Floating Chatbot
 * Pengembang: Liana Sry Astuti (NIM: 2422031) - Teknik Komputer ITEBA
 * Dosen Pengampu: Bapak Deosa Putra Caniago, M.Kom
 */

const state = {
  sessionId: null,
  isAuthenticated: false,
  operatorName: 'lingling',
  displayName: 'Kak Ling',
  items: [],
  reminders: [],
  emailLogs: [],
  selectedItem: null,
  activeCategory: 'ALL',
  activeKeyword: '',
  borrowerName: "Peminjam",
  borrowerPhone: "",
  days: 1,
  currentPhotoUrl: "",
  collectedFacts: {},
  lastResult: null,
  activeRecordToReturn: null,
  returnPhotoUrl: ""
};

// DOM Elements
const floatingBubble    = document.getElementById('floating-bubble');
const chatDrawer        = document.getElementById('chat-drawer');
const chatDrawerBody    = document.getElementById('chat-drawer-body');
const btnMinimizeChat   = document.getElementById('btn-minimize-chat');
const btnRestartChat    = document.getElementById('btn-restart-chat');
const modalReturnCheck  = document.getElementById('modal-return-check');

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupNavigation();
  setupDraggableBubble();
  setupChatDrawer();

  const savedSession = sessionStorage.getItem('gl_auth_session');
  const savedOperator = sessionStorage.getItem('gl_operator_name') || 'lingling';
  const savedDisplay = sessionStorage.getItem('gl_display_name') || 'Kak Ling';
  if (savedSession) {
    state.sessionId = savedSession;
    state.isAuthenticated = true;
    enterOperationalSession(savedOperator, savedDisplay);
  } else {
    checkDefaultPasswordNote();
    const userInput = document.getElementById('login-operator-input');
    if (userInput) userInput.focus();
  }

  // Close profile dropdown on outside click
  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('profile-menu-wrap');
    const dd = document.getElementById('profile-dropdown');
    if (dd && wrap && !wrap.contains(e.target)) {
      dd.classList.remove('open');
    }
  });
});

async function checkDefaultPasswordNote() {
  const noteEl = document.getElementById('login-default-note');
  if (!noteEl) return;
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    noteEl.style.display = data.is_default_password ? 'block' : 'none';
  } catch (err) {
    noteEl.style.display = 'none';
  }
}

// ============================================================
// 0. THEME CONTROLLER & LANDING LOGIN GATE
// ============================================================
function initTheme() {
  const saved = localStorage.getItem('gl_theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('gl_theme', theme);
  const iconEl = document.getElementById('theme-toggle-icon');
  const labelEl = document.getElementById('theme-toggle-label');
  const loginIconEl = document.getElementById('login-theme-icon');
  const loginLabelEl = document.getElementById('login-theme-label');
  if (theme === 'light') {
    if (iconEl) iconEl.innerHTML = '&#9790;';
    if (labelEl) labelEl.textContent = 'Dark';
    if (loginIconEl) loginIconEl.innerHTML = '&#9790;';
    if (loginLabelEl) loginLabelEl.textContent = 'Dark';
  } else {
    if (iconEl) iconEl.innerHTML = '&#9788;';
    if (labelEl) labelEl.textContent = 'Light';
    if (loginIconEl) loginIconEl.innerHTML = '&#9788;';
    if (loginLabelEl) loginLabelEl.textContent = 'Light';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'light' ? 'dark' : 'light');
}

let loginLockoutInterval = null;
let pendingAuthSession = null;

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  if (btn) {
    btn.title = isHidden ? 'Sembunyikan Password' : 'Tampilkan Password';
    btn.innerHTML = isHidden
      ? `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
      : `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  }
}

function updateLoginSecurityNote(mode, attemptsLeft = 3) {
  const noteEl = document.getElementById('login-security-note');
  if (!noteEl) return;
  noteEl.className = 'login-security-note';
  if (mode === 'warn') {
    noteEl.classList.add('warn');
    noteEl.textContent = `⚠️ Peringatan Keamanan: Sisa ${attemptsLeft} kali percobaan sebelum terkunci sementara.`;
  } else if (mode === 'danger') {
    noteEl.classList.add('danger');
    noteEl.textContent = `🚨 Peringatan Kritis: Sisa ${attemptsLeft} kali percobaan lagi sebelum dikunci!`;
  } else if (mode === 'locked') {
    noteEl.classList.add('danger');
    noteEl.textContent = '🔒 Akses dikunci sementara karena 3 kali percobaan gagal.';
  } else {
    noteEl.textContent = 'Dilindungi proteksi anti-brute force (maks. 3 kali percobaan salah).';
  }
}

async function handleLandingLogin(e) {
  e.preventDefault();
  const operatorInput = document.getElementById('login-operator-input');
  const pwInput = document.getElementById('login-pin-input');
  const errBox = document.getElementById('login-error-box');
  const submitBtn = document.getElementById('btn-login-submit');

  const username = (operatorInput ? operatorInput.value : '').trim();
  const password = (pwInput ? pwInput.value : '');
  if (!username || !password) return;

  if (errBox) errBox.style.display = 'none';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Memverifikasi...';
  }

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      updateLoginSecurityNote('default');
      if (pwInput) pwInput.value = '';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Masuk ke Gudang';
      }

      if (data.must_change_password) {
        pendingAuthSession = {
          sessionId: data.session_id,
          operatorName: data.operator_name || username,
          displayName: data.display_name || 'Kak Ling'
        };
        openChangePasswordModal();
        return;
      }

      const dName = data.display_name || data.operator_name || 'Kak Ling';
      state.sessionId = data.session_id;
      state.isAuthenticated = true;
      sessionStorage.setItem('gl_auth_session', data.session_id);
      sessionStorage.setItem('gl_operator_name', data.operator_name || username);
      sessionStorage.setItem('gl_display_name', dName);
      enterOperationalSession(data.operator_name || username, dName);
      showToast(`Halo ${dName}, selamat datang kembali!`, 'success');
      return;
    }

    if (errBox) {
      errBox.textContent = data.error || 'Username atau password salah.';
      errBox.style.display = 'block';
    }
    if (pwInput) {
      pwInput.value = '';
      pwInput.focus();
    }

    if (res.status === 429 || data.locked) {
      updateLoginSecurityNote('locked');
      startLoginLockoutTimer(data.retry_after || 120);
    } else {
      if (typeof data.attempts_left === 'number') {
        updateLoginSecurityNote(data.attempts_left <= 1 ? 'danger' : 'warn', data.attempts_left);
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Masuk ke Gudang';
      }
    }
  } catch (err) {
    if (errBox) {
      errBox.textContent = 'Gagal menghubungi server. Periksa koneksi Anda.';
      errBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Masuk ke Gudang';
    }
  }
}

function openChangePasswordModal() {
  const modal = document.getElementById('modal-change-password');
  const errBox = document.getElementById('change-pw-error');
  const newPw = document.getElementById('new-password-input');
  const confPw = document.getElementById('confirm-password-input');
  if (errBox) errBox.style.display = 'none';
  if (newPw) newPw.value = '';
  if (confPw) confPw.value = '';
  if (modal) modal.classList.add('open');
  if (newPw) setTimeout(() => newPw.focus(), 100);
}

async function handleChangeDefaultPassword(e) {
  e.preventDefault();
  const newPw = (document.getElementById('new-password-input').value || '').trim();
  const confPw = (document.getElementById('confirm-password-input').value || '').trim();
  const errBox = document.getElementById('change-pw-error');
  const submitBtn = document.getElementById('btn-change-pw-submit');

  const showErr = (msg) => {
    if (errBox) {
      errBox.textContent = msg;
      errBox.style.display = 'block';
    }
  };

  if (errBox) errBox.style.display = 'none';
  if (newPw.length < 6) {
    showErr('Password baru minimal 6 karakter.');
    return;
  }
  if (newPw.toLowerCase() === 'ling123') {
    showErr('Password baru tidak boleh sama dengan password default (ling123).');
    return;
  }
  if (newPw !== confPw) {
    showErr('Konfirmasi password tidak cocok.');
    return;
  }

  const username = (pendingAuthSession && pendingAuthSession.operatorName) || 'lingling';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';
  }

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, new_password: newPw })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showErr(data.error || 'Gagal menyimpan password baru.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan Password Baru & Masuk';
      }
      return;
    }

    // Hide default password note permanently
    const noteEl = document.getElementById('login-default-note');
    if (noteEl) noteEl.style.display = 'none';

    const modal = document.getElementById('modal-change-password');
    if (modal) modal.classList.remove('open');

    const sessId = (pendingAuthSession && pendingAuthSession.sessionId) || '';
    const dName = (pendingAuthSession && pendingAuthSession.displayName) || 'Kak Ling';
    state.sessionId = sessId;
    state.isAuthenticated = true;
    sessionStorage.setItem('gl_auth_session', sessId);
    sessionStorage.setItem('gl_operator_name', username);
    sessionStorage.setItem('gl_display_name', dName);
    pendingAuthSession = null;

    enterOperationalSession(username, dName);
    showToast('Password baru disimpan! Selamat datang di GudangLingling.', 'success', 4000);
  } catch (err) {
    showErr('Gagal menghubungi server.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Simpan Password Baru & Masuk';
    }
  }
}

function startLoginLockoutTimer(seconds) {
  clearInterval(loginLockoutInterval);
  const submitBtn = document.getElementById('btn-login-submit');
  const errBox = document.getElementById('login-error-box');
  let remaining = Math.max(1, parseInt(seconds, 10));

  const tick = () => {
    if (remaining <= 0) {
      clearInterval(loginLockoutInterval);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Masuk ke Gudang';
      }
      if (errBox) {
        errBox.textContent = 'Masa kunci selesai. Silakan masukkan PIN dengan benar.';
      }
      return;
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = `Terkunci (${remaining} detik)`;
    }
    remaining -= 1;
  };

  tick();
  loginLockoutInterval = setInterval(tick, 1000);
}

function enterOperationalSession(operatorName, displayName) {
  state.operatorName = operatorName || 'lingling';
  state.displayName = displayName || sessionStorage.getItem('gl_display_name') || 'Kak Ling';
  const gate = document.getElementById('login-gate');
  const shell = document.getElementById('app-shell');
  const bubble = document.getElementById('floating-bubble');

  if (gate) gate.style.display = 'none';
  if (shell) shell.style.display = 'flex';
  if (bubble) bubble.style.display = 'flex';

  syncProfileHeaderUI();
  updateDynamicGreeting();
  updateHeaderStatus();
  loadAllData();
  if (chatDrawerBody && chatDrawerBody.children.length === 0) {
    startChatSession();
  }
}

function syncProfileHeaderUI() {
  const nameEl = document.getElementById('header-profile-name');
  const initEl = document.getElementById('header-profile-initial');
  const dName = state.displayName || 'Kak Ling';
  if (nameEl) nameEl.textContent = dName;
  if (initEl) initEl.textContent = dName.trim().charAt(0).toUpperCase() || 'K';
}

function toggleProfileDropdown(e) {
  if (e) e.stopPropagation();
  const dd = document.getElementById('profile-dropdown');
  if (dd) dd.classList.toggle('open');
}

function openProfileModal() {
  const dd = document.getElementById('profile-dropdown');
  if (dd) dd.classList.remove('open');

  const modal = document.getElementById('modal-profile-settings');
  const nameInput = document.getElementById('profile-display-name');
  const pwInput = document.getElementById('profile-new-password');
  const errBox = document.getElementById('profile-save-error');

  if (nameInput) nameInput.value = state.displayName || 'Kak Ling';
  if (pwInput) {
    pwInput.value = '';
    pwInput.type = 'password';
  }
  if (errBox) errBox.style.display = 'none';
  if (modal) modal.classList.add('open');
  if (nameInput) setTimeout(() => nameInput.focus(), 80);
}

function closeProfileModal() {
  const modal = document.getElementById('modal-profile-settings');
  if (modal) modal.classList.remove('open');
}

async function handleSaveProfile(e) {
  e.preventDefault();
  const nameInput = document.getElementById('profile-display-name');
  const pwInput = document.getElementById('profile-new-password');
  const errBox = document.getElementById('profile-save-error');
  const saveBtn = document.getElementById('btn-save-profile');

  const displayName = (nameInput ? nameInput.value : '').trim();
  const newPassword = (pwInput ? pwInput.value : '').trim();

  const showErr = (msg) => {
    if (errBox) {
      errBox.textContent = msg;
      errBox.style.display = 'block';
    }
  };
  if (errBox) errBox.style.display = 'none';

  if (!displayName) {
    showErr('Nama sapaan tidak boleh kosong.');
    return;
  }
  if (newPassword && newPassword.length < 6) {
    showErr('Password baru minimal 6 karakter.');
    return;
  }
  if (newPassword && newPassword.toLowerCase() === 'ling123') {
    showErr('Password baru tidak boleh sama dengan password default (ling123).');
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan...';
  }

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: state.operatorName || 'lingling',
        display_name: displayName,
        new_password: newPassword
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showErr(data.error || 'Gagal menyimpan profil.');
      return;
    }

    state.displayName = data.display_name || displayName;
    sessionStorage.setItem('gl_display_name', state.displayName);
    syncProfileHeaderUI();
    updateDynamicGreeting();
    closeProfileModal();
    showToast(
      data.password_changed ? 'Nama sapaan & password berhasil diperbarui!' : 'Nama sapaan berhasil diperbarui!',
      'success'
    );
  } catch (err) {
    showErr('Gagal menghubungi server.');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Simpan Perubahan';
    }
  }
}

function handleLogout() {
  const dd = document.getElementById('profile-dropdown');
  if (dd) dd.classList.remove('open');
  sessionStorage.removeItem('gl_auth_session');
  sessionStorage.removeItem('gl_operator_name');
  sessionStorage.removeItem('gl_display_name');
  state.sessionId = null;
  state.isAuthenticated = false;
  closeChatDrawer();

  const gate = document.getElementById('login-gate');
  const shell = document.getElementById('app-shell');
  const bubble = document.getElementById('floating-bubble');
  const errBox = document.getElementById('login-error-box');
  const pinInput = document.getElementById('login-pin-input');

  if (shell) shell.style.display = 'none';
  if (bubble) bubble.style.display = 'none';
  if (gate) gate.style.display = 'flex';
  if (errBox) errBox.style.display = 'none';
  if (pinInput) {
    pinInput.value = '';
    pinInput.type = 'password';
  }
  updateLoginSecurityNote('default');
  checkDefaultPasswordNote();
  const userInput = document.getElementById('login-operator-input');
  if (userInput) setTimeout(() => userInput.focus(), 50);
  showToast('Sesi dikunci. Silakan login kembali.', 'info');
}

// ============================================================
// 1. NAVIGATION & DYNAMIC GREETING
// ============================================================
function updateDynamicGreeting() {
  const hour = new Date().getHours();
  const dName = state.displayName || state.operatorName || 'Kak Ling';
  let timeTag = 'Gudang Utama RT';
  const title = `Halo ${dName}, selamat datang kembali!`;
  let sub = 'Pantau kesiapan alat, catat peminjaman warga, dan pastikan kondisi fisik tetap terawat.';

  if (hour >= 11 && hour < 15) {
    timeTag = 'Shift Siang • Operasional';
    sub = 'Shift siang aktif. Pantau perkakas yang sedang digunakan di lapangan dan cek kelayakan fisik.';
  } else if (hour >= 15 && hour < 18) {
    timeTag = 'Shift Sore • Pengembalian';
    sub = 'Waktu pengecekan pengembalian alat warga. Pastikan kabel rapi dan perkakas kembali bersih.';
  } else if (hour >= 18 || hour < 4) {
    timeTag = 'Standby Malam • Inventaris Terkunci';
    sub = 'Peralatan tersimpan rapi di rak inventaris. Log peminjaman dan rekam triase risiko aktif.';
  } else {
    timeTag = 'Shift Pagi • Kesiapan Alat';
    sub = 'Gudang siap melayani peminjaman alat pertukangan dan kebersihan lingkungan warga.';
  }

  const timeTagEl = document.getElementById('greeting-time-tag');
  const titleEl = document.getElementById('greeting-text');
  const subEl = document.getElementById('greeting-sub');

  if (timeTagEl) timeTagEl.textContent = timeTag;
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;
}

function updateHeaderStatus() {
  const dotEl = document.getElementById('header-ticker-dot');
  const textEl = document.getElementById('header-ticker-text');
  if (!dotEl || !textEl) return;

  const total = (state.items || []).length;
  let availableCount = 0;
  let borrowedCount = 0;
  let lockedCount = 0;

  (state.items || []).forEach(it => {
    if (it.status === 'AVAILABLE') availableCount++;
    else if (it.status === 'BORROWED') borrowedCount++;
    else if (it.status === 'MAINTENANCE_LOCKED') lockedCount++;
  });

  const chatStatusEl = document.getElementById('chat-header-status');
  if (chatStatusEl) {
    chatStatusEl.innerHTML = `Online &bull; ${availableCount} Ready &bull; ${borrowedCount} Dipinjam${lockedCount > 0 ? ` &bull; ${lockedCount} Terkunci` : ''}`;
  }

  dotEl.className = 'status-pulse-dot';

  if (total === 0) {
    dotEl.classList.add('green');
    textEl.innerHTML = 'Status: Bersih &bull; 0 Dipinjam';
  } else if (lockedCount > 0) {
    dotEl.classList.add('red');
    textEl.innerHTML = `Status: Perhatian &bull; ${lockedCount} Terkunci`;
  } else if (borrowedCount > 0) {
    dotEl.classList.add('yellow');
    textEl.innerHTML = `Status: Aktif &bull; ${borrowedCount} Dipinjam`;
  } else {
    dotEl.classList.add('green');
    textEl.innerHTML = 'Status: Aman &bull; 0 Dipinjam';
  }
}

function clearSearch() {
  const input = document.getElementById('search-input');
  if (input) input.value = '';
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  document.querySelectorAll('.quick-chip').forEach(c => c.classList.remove('active'));
  state.activeKeyword = '';
  renderBeranda();
}

function applyQuickKeyword(kw) {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  if (!input) return;

  if (input.value.toLowerCase() === kw.toLowerCase()) {
    clearSearch();
    return;
  }

  input.value = kw;
  if (clearBtn) clearBtn.style.display = 'block';
  document.querySelectorAll('.quick-chip').forEach(c => {
    c.classList.toggle('active', c.textContent.trim().toLowerCase() === kw.toLowerCase());
  });
  renderBeranda();
}

function resetSearchAndFilter() {
  clearSearch();
  state.activeCategory = 'ALL';
  document.querySelectorAll('.cat-pill').forEach(p => {
    p.classList.toggle('active', (p.dataset.cat || 'ALL') === 'ALL');
  });
  renderBeranda();
}

function setupNavigation() {
  const allNavButtons = document.querySelectorAll('[data-tab]');

  allNavButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      allNavButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll(`[data-tab="${target}"]`).forEach(b => b.classList.add('active'));

      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const activePane = document.getElementById(`pane-${target}`);
      if (activePane) activePane.classList.add('active');

      if (target === 'beranda') {
        updateDynamicGreeting();
        renderBeranda();
      }
      if (target === 'message') renderMessage();
      if (target === 'faq')     renderFaq();
    });
  });

  // Search input events
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (searchClearBtn) {
        searchClearBtn.style.display = e.target.value.trim() ? 'block' : 'none';
      }
      document.querySelectorAll('.quick-chip').forEach(c => {
        c.classList.toggle('active', c.textContent.trim().toLowerCase() === e.target.value.trim().toLowerCase());
      });
      renderBeranda();
    });
  }

  // Category Pills Carousel
  document.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeCategory = pill.dataset.cat || 'ALL';
      renderBeranda();
    });
  });
}

// ============================================================
// 2. DRAGGABLE FLOATING CHATBOT BUBBLE (Mobile & Desktop)
// ============================================================
function setupDraggableBubble() {
  let isDragging = false;
  let startX = 0, startY = 0;
  let initialLeft = 0, initialTop = 0;
  let hasMoved = false;

  const onPointerDown = (e) => {
    isDragging = true;
    hasMoved = false;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;

    const rect = floatingBubble.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      hasMoved = true;
    }

    if (hasMoved) {
      floatingBubble.style.bottom = 'auto';
      floatingBubble.style.right = 'auto';

      let newLeft = initialLeft + deltaX;
      let newTop = initialTop + deltaY;

      // Screen Boundary Clamping
      const maxX = window.innerWidth - 64;
      const maxY = window.innerHeight - 70;
      newLeft = Math.max(10, Math.min(newLeft, maxX));
      newTop = Math.max(10, Math.min(newTop, maxY));

      floatingBubble.style.left = `${newLeft}px`;
      floatingBubble.style.top = `${newTop}px`;
    }
  };

  const onPointerUp = () => {
    if (!isDragging) return;
    isDragging = false;

    // Jika tidak digeser (hanya tap), buka / toggle chat drawer!
    if (!hasMoved) {
      toggleChatDrawer();
    }
  };

  // Touch Events (HP)
  floatingBubble.addEventListener('touchstart', onPointerDown, { passive: true });
  window.addEventListener('touchmove', onPointerMove, { passive: true });
  window.addEventListener('touchend', onPointerUp);

  // Mouse Events (Desktop)
  floatingBubble.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  // Close with Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeChatDrawer();
      closeAssetDetailModal();
      closeReturnModal();
      closeAddItemModal();
    }
  });
}

function openChatDrawer() {
  chatDrawer.classList.add('open');
  const overlay = document.getElementById('chat-overlay');
  if (overlay) overlay.classList.add('open');
  scrollChatDown();
  const input = document.getElementById('chat-user-input');
  if (input) {
    setTimeout(() => input.focus(), 300);
  }
}

function closeChatDrawer() {
  chatDrawer.classList.remove('open');
  const overlay = document.getElementById('chat-overlay');
  if (overlay) overlay.classList.remove('open');
}

function toggleChatDrawer() {
  if (chatDrawer.classList.contains('open')) {
    closeChatDrawer();
  } else {
    openChatDrawer();
  }
}

function setupChatDrawer() {
  const closeBtn = document.getElementById('btn-close-chat') || document.getElementById('btn-minimize-chat');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeChatDrawer();
    });
  }

  const restartBtn = document.getElementById('btn-restart-chat');
  if (restartBtn) {
    restartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Mulai ulang percakapan chatbot dari awal?')) {
        chatDrawerBody.innerHTML = '';
        state.sessionId = null;
        state.isAuthenticated = false;
        state.selectedItem = null;
        state.currentPhotoUrl = '';
        state.collectedFacts = {};
        state.lastResult = null;
        startChatSession();
      }
    });
  }
}

function openChatWithItem(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  openChatDrawer();
  sendSuggestedQuery(`Informasi dan cara pinjam ${item.name}`);
}

// ============================================================
// 3. DATA LOADERS
// ============================================================
async function loadAllData() {
  await Promise.all([loadItems(), loadReminders(), loadEmailLogs()]);
  renderBeranda();
  renderMessage();
}

async function loadItems() {
  try {
    const res = await fetch('/api/items');
    const data = await res.json();
    state.items = data.items || [];
  } catch (err) {
    console.error('Error load items:', err);
  }
}

async function loadReminders() {
  try {
    const res = await fetch('/api/reminders');
    const data = await res.json();
    state.reminders = data.reminders || [];
  } catch (err) {
    console.error('Error load reminders:', err);
  }
}

async function loadEmailLogs() {
  try {
    const res = await fetch('/api/email-logs');
    const data = await res.json();
    state.emailLogs = data.email_logs || [];
  } catch (err) {
    console.error('Error load email logs:', err);
  }
}

// ============================================================
// 4. MENU 1: BERANDA (Dashboard & Inventaris Visual)
// ============================================================
function renderBeranda() {
  const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
  const catVal = state.activeCategory || 'ALL';

  let availableCount = 0;
  let borrowedCount = 0;
  let lockedCount = 0;

  state.items.forEach(it => {
    if (it.status === 'AVAILABLE') availableCount++;
    else if (it.status === 'BORROWED') borrowedCount++;
    else if (it.status === 'MAINTENANCE_LOCKED') lockedCount++;
  });

  document.getElementById('stat-available').textContent = availableCount;
  document.getElementById('stat-borrowed').textContent = borrowedCount;
  document.getElementById('stat-locked').textContent = lockedCount;
  updateHeaderStatus();

  const container = document.getElementById('inventory-grid');
  container.innerHTML = '';

  const filtered = state.items.filter(it => {
    const matchSearch = !searchVal ||
      it.name.toLowerCase().includes(searchVal) ||
      it.category.toLowerCase().includes(searchVal) ||
      (it.description || '').toLowerCase().includes(searchVal);
    const matchCat = catVal === 'ALL' || it.category === catVal;
    return matchSearch && matchCat;
  });

  if (!state.items.length) {
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
        </div>
        <div class="empty-state-title">Rak Gudang Masih Kosong</div>
        <div class="empty-state-desc">
          Belum ada perkakas yang terdaftar di inventaris. Mulai catat alat pertamamu dengan menekan tombol di bawah:
        </div>
        <button class="btn-act btn-primary-action empty-state-cta" style="width:auto;" onclick="openAddItemModal()">
          <span>+ Tambah Alat Baru</span>
        </button>
      </div>`;
    return;
  }

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-icon-wrap" style="color:var(--text-muted);background:var(--bg-subtle);border-color:var(--border-subtle);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <div class="empty-state-title">Tidak Ada Peralatan yang Sesuai</div>
        <div class="empty-state-desc">
          Tidak ditemukan peralatan dengan kata kunci <em>"${esc(searchVal)}"</em> pada kategori <em>"${esc(catVal === 'ALL' ? 'Semua Kategori' : catVal)}"</em>.
        </div>
        <button class="btn-act btn-subtle-action btn-sm" style="width:auto;padding:8px 18px;" onclick="resetSearchAndFilter()">
          Reset Filter & Pencarian
        </button>
      </div>`;
    return;
  }

  filtered.forEach(it => {
    const card = document.createElement('div');
    card.className = 'asset-card';

    const photoUrl = it.last_photo_url || '/img/bor.svg';
    const isLocked = it.status === 'MAINTENANCE_LOCKED';
    const isBorrowed = it.status === 'BORROWED';

    // --- Primary Action Button (hierarchical visual weight) ---
    let actionBtn = '';
    if (isLocked) {
      actionBtn = `<button class="btn-act btn-warning-action btn-sm" onclick="unlockTool(${it.id})">Buka Kunci Servis</button>`;
    } else if (isBorrowed) {
      actionBtn = `<button class="btn-act btn-subtle-action btn-sm" onclick="openReturnModalByItemId(${it.id})">Selesaikan Pengembalian</button>`;
    } else {
      actionBtn = `<button class="btn-act btn-primary-action btn-sm" onclick="openBorrowWizard(${it.id})">Pinjam Cepat</button>`;
    }

    // --- Clean Condition Status Pill (Aligned with Triase Zones) ---
    let condColor = 'green';
    let condLabel = 'Kondisi: Prima / Layak Pakai';
    if (isLocked) {
      condColor = 'red';
      condLabel = 'Kondisi: Perlu Perbaikan (Terkunci)';
    } else if (isBorrowed) {
      condColor = 'yellow';
      condLabel = 'Kondisi: Sedang Dipinjam Warga';
    } else if (it.danger_level === 'TINGGI' || it.danger_level === 'SANGAT TINGGI') {
      condColor = 'yellow';
      condLabel = 'Kondisi: Perlu Perhatian Khusus (Wajib APD)';
    } else if (it.danger_level === 'SEDANG') {
      condColor = 'green';
      condLabel = 'Kondisi: Layak Pakai';
    }

    // --- Social Activity Line (last borrower / active borrower) ---
    let activityLine = '';
    if (isBorrowed && it.active_borrower) {
      activityLine = `
        <div class="asset-activity">
          <span class="activity-dot yellow"></span>
          <span>Sedang dipinjam oleh <strong>${esc(it.active_borrower)}</strong></span>
        </div>`;
    } else if (!isBorrowed && it.last_borrower) {
      activityLine = `
        <div class="asset-activity">
          <span class="activity-dot green"></span>
          <span>Terakhir dipinjam: <strong>${esc(it.last_borrower)}</strong></span>
        </div>`;
    } else if (!isBorrowed && !it.last_borrower) {
      activityLine = `
        <div class="asset-activity">
          <span class="activity-dot green"></span>
          <span style="color:var(--text-muted);">Belum pernah dipinjam</span>
        </div>`;
    }

    // --- Badge with animated pulse dot ---
    const badgeLabel = it.status === 'AVAILABLE' ? 'Ready'
                     : it.status === 'BORROWED' ? 'Dipinjam' : 'Lockout';
    const badgeDotColor = it.status === 'AVAILABLE' ? 'green'
                        : it.status === 'BORROWED' ? 'yellow' : 'red';

    card.innerHTML = `
      <div class="asset-img-wrap">
        <img class="asset-img" src="${photoUrl}" alt="${esc(it.name)}" onerror="this.onerror=null; this.src='/img/bor.svg';">
        <span class="asset-badge ${it.status}">
          <span class="status-pulse-dot ${badgeDotColor}"></span>
          ${badgeLabel}
        </span>
        ${it.power_watts ? `<span style="position:absolute;bottom:8px;left:8px;font-size:10px;font-weight:700;background:rgba(0,0,0,0.6);color:#94a3b8;padding:2px 7px;border-radius:4px;backdrop-filter:blur(4px);">${it.power_watts}W</span>` : ''}
      </div>
      <div class="asset-body">
        <div class="asset-name">${esc(it.name)}</div>
        <div class="asset-meta">${esc(it.category)}</div>
        <div class="asset-condition-pill ${condColor}">
          <span class="status-pulse-dot ${condColor}" style="position:static;flex-shrink:0;"></span>
          <span>${condLabel}</span>
        </div>
        ${activityLine}
        <div class="asset-actions">
          ${actionBtn}
          <button class="btn-act btn-subtle-action btn-sm" style="width:auto;flex-shrink:0;" onclick="showAssetDetail(${it.id})">Detail</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

async function unlockTool(itemId) {
  if (!confirm('Konfirmasi bahwa alat ini telah selesai diperbaiki dan aman digunakan kembali?')) return;
  try {
    const res = await fetch('/api/items/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId })
    });
    if (res.ok) {
      showToast('Alat berhasil dibuka kunci dan kembali tersedia.', 'success');
      await loadItems();
      renderBeranda();
    } else {
      showToast('Gagal membuka kunci alat.', 'warn');
    }
  } catch (err) {
    showToast('Gagal menghubungi server.', 'warn');
  }
}

function showAssetDetail(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  const modal = document.getElementById('modal-asset-detail');
  const title = document.getElementById('detail-modal-title');
  const body = document.getElementById('detail-modal-body');
  if (!modal || !body) return;

  title.textContent = item.name;
  body.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);">Memuat data...</div>`;
  modal.classList.add('open');

  // Fetch detail record (includes borrowing history)
  fetch(`/api/items/${itemId}`)
    .then(res => res.json())
    .then(data => {
      const records = (data.item && data.item.records) || [];
      renderAssetDetailContent(item, records, body);
    })
    .catch(() => {
      renderAssetDetailContent(item, [], body);
    });
}

function renderAssetDetailContent(item, records, body) {
  const dangerColors = {
    'SANGAT TINGGI': { color: 'var(--red-text)', bg: 'var(--red-bg)' },
    'TINGGI':        { color: 'var(--yellow-text)', bg: 'var(--yellow-bg)' },
    'SEDANG':        { color: 'var(--yellow-text)', bg: 'var(--yellow-bg)' },
    'RENDAH':        { color: 'var(--green-text)', bg: 'var(--green-bg)' }
  };
  const dc = dangerColors[item.danger_level] || dangerColors['RENDAH'];

  const statusLabel = item.status === 'AVAILABLE' ? 'Tersedia' : item.status === 'BORROWED' ? 'Sedang Dipinjam' : 'Terkunci - Servis';
  const statusColor = item.status === 'AVAILABLE' ? 'var(--green-text)' : item.status === 'BORROWED' ? 'var(--yellow-text)' : 'var(--red-text)';

  let historyHtml = '';
  if (records.length) {
    historyHtml = records.map(r => {
      const zoneColor = r.zone === 'GREEN' ? 'var(--green-text)' : r.zone === 'YELLOW' ? 'var(--yellow-text)' : 'var(--red-text)';
      const zoneLabel = r.zone === 'GREEN' ? 'Hijau' : r.zone === 'YELLOW' ? 'Kuning' : 'Merah';
      return `
        <div class="history-mini-item">
          <div>
            <div style="font-weight:700;font-size:12.5px;color:var(--text-primary);">${esc(r.borrower_name || '-')}</div>
            <div style="font-size:11px;color:var(--text-muted);">${(r.created_at||'').substring(0,10)} &bull; ${r.borrow_days} hari</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700;font-size:11.5px;color:${zoneColor};">Zona ${zoneLabel}</div>
            <div style="font-size:10.5px;color:var(--text-muted);">h(S) = ${r.heuristic_score}</div>
          </div>
        </div>`;
    }).join('');
  } else {
    historyHtml = `<div style="text-align:center;padding:14px;font-size:12px;color:var(--text-muted);">Alat ini belum memiliki riwayat peminjaman.</div>`;
  }

  let borrowerBadge = '';
  if (item.active_borrower) {
    borrowerBadge = `<div style="margin-top:8px;padding:8px 10px;background:var(--yellow-bg);border:1px solid var(--yellow-border);border-radius:8px;font-size:12px;color:var(--yellow-text);">
      Sedang dipinjam oleh <strong>${esc(item.active_borrower)}</strong>
    </div>`;
  }

  body.innerHTML = `
    <div class="detail-modal-layout">
      <div class="detail-img-banner">
        <img src="${esc(item.last_photo_url || '/img/bor.svg')}" alt="${esc(item.name)}" onerror="this.onerror=null; this.src='/img/bor.svg';">
        <span class="asset-badge ${item.status}" style="position:absolute;top:10px;right:10px;">
          <span class="status-pulse-dot ${item.status === 'AVAILABLE' ? 'green' : item.status === 'BORROWED' ? 'yellow' : 'red'}"></span>
          ${statusLabel}
        </span>
      </div>

      <div class="tech-spec-grid">
        <div class="tech-spec-item">
          <div class="tech-spec-k">Kategori</div>
          <div class="tech-spec-v">${esc(item.category)}</div>
        </div>
        <div class="tech-spec-item">
          <div class="tech-spec-k">Daya Listrik</div>
          <div class="tech-spec-v">${item.power_watts ? item.power_watts + ' Watt' : 'Non-Listrik'}</div>
        </div>
        <div class="tech-spec-item">
          <div class="tech-spec-k">Status</div>
          <div class="tech-spec-v" style="color:${statusColor};">${statusLabel}</div>
        </div>
        <div class="tech-spec-item">
          <div class="tech-spec-k">Tingkat Bahaya</div>
          <div class="tech-spec-v" style="color:${dc.color};">${esc(item.danger_level)}</div>
        </div>
      </div>

      <div style="padding:10px;background:var(--bg-app);border-radius:8px;border:1px solid var(--border-subtle);font-size:12.5px;color:var(--text-secondary);line-height:1.5;">
        ${esc(item.description || '-')}
      </div>

      ${borrowerBadge}

      <div class="detail-section-title">Riwayat Triase AI (5 Terakhir)</div>
      <div class="history-mini-list">${historyHtml}</div>

      <div style="display:flex;gap:8px;margin-top:6px;">
        ${item.status === 'AVAILABLE' ? `
        <button class="btn-act btn-primary-action" onclick="closeAssetDetailModal(); openBorrowWizard(${item.id});">
          Pinjam Alat Ini Sekarang
        </button>` : ''}
        <button class="btn-act btn-danger-action btn-sm" style="width:auto;" onclick="handleDeleteItem(${item.id})">Hapus Alat</button>
      </div>
    </div>
  `;
}

function closeAssetDetailModal() {
  const modal = document.getElementById('modal-asset-detail');
  if (modal) modal.classList.remove('open');
}

// ============================================================
// 4B. SMART BORROWING WIZARD MODAL (3 LANGKAH)
// ============================================================
let wizardState = {
  itemId: null,
  item: null,
  currentStep: 1,
  photoUrl: ''
};

function getMaxBorrowDays(item) {
  if (!item) return 3;
  const cat = (item.category || '').trim();
  const power = parseInt(item.power_watts || '0', 10);
  const danger = (item.danger_level || 'SEDANG').toUpperCase();
  const heavyCats = ['Pertukangan Listrik', 'Akses Ketinggian', 'Peralatan Air & Cuci'];
  if (heavyCats.includes(cat) || power > 0 || danger === 'TINGGI' || danger === 'SANGAT TINGGI') {
    return 3;
  }
  return 7;
}

function openBorrowWizard(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) {
    showToast('Peralatan tidak ditemukan.', 'warn');
    return;
  }
  if (item.status === 'BORROWED') {
    showToast('Alat ini sedang dipinjam warga.', 'warn');
    return;
  }
  if (item.status === 'MAINTENANCE_LOCKED') {
    showToast('Alat ini sedang dikunci karantina servis.', 'warn');
    return;
  }

  wizardState = {
    itemId: item.id,
    item: item,
    currentStep: 1,
    photoUrl: item.last_photo_url || ''
  };

  // Populate header banner
  const imgEl = document.getElementById('wizard-tool-img');
  const nameEl = document.getElementById('wizard-tool-name');
  const metaEl = document.getElementById('wizard-tool-meta');
  if (imgEl) imgEl.src = item.last_photo_url || '/img/bor.svg';
  if (nameEl) nameEl.textContent = item.name;
  if (metaEl) metaEl.textContent = `${item.category} • ${item.power_watts ? item.power_watts + 'W' : 'Non-Listrik'}`;

  // Reset form inputs
  document.getElementById('wizard-borrower-name').value = '';
  document.getElementById('wizard-borrower-phone').value = '';
  document.getElementById('wizard-borrow-days').value = '1';
  const customWrap = document.getElementById('wizard-custom-days-wrap');
  if (customWrap) customWrap.style.display = 'none';
  const customInput = document.getElementById('wizard-custom-days-input');
  const maxDays = getMaxBorrowDays(item);
  if (customInput) {
    customInput.value = '';
    customInput.max = String(maxDays);
  }
  const maxHint = document.getElementById('wizard-max-days-hint');
  if (maxHint) {
    maxHint.textContent = `Aturan AI: Batas maksimal untuk ${item.category} adalah ${maxDays} hari.`;
  }
  document.getElementById('wizard-photo-file').value = '';
  const photoWrap = document.getElementById('wizard-photo-preview-wrap');
  if (photoWrap) photoWrap.style.display = 'none';

  // Checkboxes
  document.getElementById('wiz-check-cable').checked = true;
  document.getElementById('wiz-check-body').checked = true;
  document.getElementById('wiz-check-experience').checked = true;
  document.getElementById('wiz-check-spark').checked = false;

  goToWizardStep(1);

  const modal = document.getElementById('modal-borrow-wizard');
  if (modal) modal.classList.add('open');
}

function closeBorrowWizard() {
  const modal = document.getElementById('modal-borrow-wizard');
  if (modal) modal.classList.remove('open');
}

function finishBorrowWizard() {
  closeBorrowWizard();
  loadAllData();
  showToast('Peminjaman berhasil disimpan ke inventaris!', 'success');
}

function goToWizardStep(stepNum) {
  if (stepNum === 2) {
    const name = document.getElementById('wizard-borrower-name').value.trim();
    if (!name) {
      showToast('Mohon masukkan nama peminjam / tetangga.', 'warn');
      document.getElementById('wizard-borrower-name').focus();
      return;
    }
    const daysEl = document.getElementById('wizard-borrow-days');
    const selectedDays = getWizardBorrowDays();
    const maxDays = getMaxBorrowDays(wizardState.item);
    if (daysEl.value === 'custom') {
      const customVal = parseInt(document.getElementById('wizard-custom-days-input').value || '0', 10);
      if (!customVal || customVal < 1) {
        showToast('Masukkan jumlah hari peminjaman yang valid (minimal 1 hari).', 'warn');
        document.getElementById('wizard-custom-days-input').focus();
        return;
      }
    }
    if (selectedDays > maxDays) {
      showToast(`Aturan AI: Batas maksimal alat ini adalah ${maxDays} hari agar warga lain tetap kebagian.`, 'warn', 4500);
      return;
    }
  }

  wizardState.currentStep = stepNum;

  // Update stepper pills & panes
  for (let i = 1; i <= 3; i++) {
    const pill = document.getElementById(`wizard-step-pill-${i}`);
    if (pill) {
      pill.classList.toggle('active', i === stepNum);
      pill.classList.toggle('completed', i < stepNum);
    }
    const pane = document.getElementById(`wizard-step-${i}`);
    if (pane) {
      pane.classList.toggle('active', i === stepNum);
    }
  }
}

function previewWizardPhoto(e) {
  const file = e.target.files && e.target.files[0];
  const wrap = document.getElementById('wizard-photo-preview-wrap');
  const img = document.getElementById('wizard-photo-preview-img');
  if (!file || !wrap || !img) return;

  const reader = new FileReader();
  reader.onload = async function(evt) {
    img.src = evt.target.result;
    wrap.style.display = 'block';

    // Upload photo to backend
    try {
      const res = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: evt.target.result })
      });
      const data = await res.json();
      if (data.url) {
        wizardState.photoUrl = data.url;
      }
    } catch (err) {
      console.warn('Gagal upload foto wizard:', err);
    }
  };
  reader.readAsDataURL(file);
}

async function syncWizardContact() {
  if ('contacts' in navigator && 'ContactsManager' in window) {
    try {
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        const name = contact.name ? contact.name[0] : '';
        const tel = contact.tel ? contact.tel[0] : '';
        if (name) document.getElementById('wizard-borrower-name').value = name;
        if (tel) document.getElementById('wizard-borrower-phone').value = tel;
        showToast(`Kontak disematkan: ${name}`, 'success');
      }
    } catch (e) {
      console.log('Cancel sync wizard contact:', e);
    }
  } else {
    showToast('Sinkron kontak aktif di Chrome Android. Di laptop, masukkan nama & nomor langsung.', 'info', 4000);
  }
}

function handleDurationChange(selectEl) {
  const wrap = document.getElementById('wizard-custom-days-wrap');
  const customInput = document.getElementById('wizard-custom-days-input');
  if (selectEl.value === 'custom') {
    if (wrap) wrap.style.display = 'block';
    if (customInput) { customInput.value = ''; customInput.focus(); }
  } else {
    if (wrap) wrap.style.display = 'none';
  }
}

function getWizardBorrowDays() {
  const sel = document.getElementById('wizard-borrow-days');
  if (!sel) return 1;
  if (sel.value === 'custom') {
    const customVal = parseInt(document.getElementById('wizard-custom-days-input').value || '1', 10);
    return Math.max(1, Math.min(90, customVal || 1));
  }
  return parseInt(sel.value || '1', 10);
}

async function submitBorrowWizard() {
  const submitBtn = document.getElementById('btn-submit-wizard');
  if (submitBtn) {
    submitBtn.textContent = 'Menganalisis Triase AI...';
    submitBtn.disabled = true;
  }

  const name = document.getElementById('wizard-borrower-name').value.trim();
  const phone = document.getElementById('wizard-borrower-phone').value.trim();
  const days = getWizardBorrowDays();

  const cableSafe = document.getElementById('wiz-check-cable').checked;
  const bodySafe = document.getElementById('wiz-check-body').checked;
  const expSafe = document.getElementById('wiz-check-experience').checked;
  const sparkReport = document.getElementById('wiz-check-spark').checked;

  // Convert safety checklist to facts input for AI Expert System
  const factsInput = {};
  if (!cableSafe) factsInput['F01'] = 0.8; // Kabel terkelupas
  if (!bodySafe) factsInput['F02'] = 0.7;  // Bodi retak
  if (!expSafe) factsInput['F13'] = 0.6;   // Peminjam pemula
  if (sparkReport) {
    factsInput['F05'] = 0.9; // Percikan api / korsleting fatal
  }

  try {
    const res = await fetch('/api/borrow/wizard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: wizardState.itemId,
        borrower_name: name,
        borrower_phone: phone,
        borrow_days: days,
        photo_url: wizardState.photoUrl,
        facts: factsInput
      })
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Gagal memproses triase peminjaman.', 'warn');
      if (submitBtn) {
        submitBtn.textContent = 'Proses Triase & Catat Pinjam →';
        submitBtn.disabled = false;
      }
      return;
    }

    // Render Step 3 Result Card
    renderWizardResultCard(data);
    goToWizardStep(3);
    loadAllData();
  } catch (err) {
    console.error('Error submit borrow wizard:', err);
    showToast('Terjadi gangguan jaringan saat memproses triase.', 'warn');
  } finally {
    if (submitBtn) {
      submitBtn.textContent = 'Proses Triase & Catat Pinjam →';
      submitBtn.disabled = false;
    }
  }
}

async function recordDigitalReceipt(recordId, itemName, borrowerName, borrowDays) {
  try {
    await fetch('/api/archive-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        record_id: recordId,
        item_name: itemName,
        borrower_name: borrowerName,
        borrow_days: borrowDays
      })
    });
    await loadEmailLogs();
    renderMessage();
  } catch (err) {
    console.warn('Archive receipt log error:', err);
  }
}

function renderWizardResultCard(data) {
  const card = document.getElementById('wizard-result-card');
  const waBtn = document.getElementById('wizard-btn-wa');
  if (!card) return;

  const zone = data.zone || 'GREEN';
  card.className = `wizard-result-card ${zone}`;

  let badgeColor = 'var(--green-text)';
  let zoneTitle = 'ZONA HIJAU — LAYAK DIPINJAMKAN LANGSUNG';
  let dotClass = 'green';

  if (zone === 'YELLOW') {
    badgeColor = 'var(--yellow-text)';
    zoneTitle = 'ZONA KUNING — PEMINJAMAN BERSYARAT (WAJIB APD)';
    dotClass = 'yellow';
  } else if (zone === 'RED') {
    badgeColor = 'var(--red-text)';
    zoneTitle = 'ZONA MERAH — DITOLAK & DIKUNCI SERVIS';
    dotClass = 'red';
  }

  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:12.5px;color:${badgeColor};">
      <span class="status-pulse-dot ${dotClass}" style="flex-shrink:0;position:static;"></span>
      <span>${zoneTitle}</span>
    </div>

    <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-top:2px;">
      Keputusan: ${esc(data.decision_name)}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px;">
      <div style="background:var(--bg-surface);padding:8px;border-radius:6px;border:1px solid var(--border-subtle);text-align:center;">
        <div style="font-size:10.5px;color:var(--text-secondary);font-weight:600;">Skor Risiko h(S)</div>
        <div style="font-size:16px;font-weight:800;color:${badgeColor};">${data.heuristic_score} / 100</div>
      </div>
      <div style="background:var(--bg-surface);padding:8px;border-radius:6px;border:1px solid var(--border-subtle);text-align:center;">
        <div style="font-size:10.5px;color:var(--text-secondary);font-weight:600;">Keyakinan AI (CF)</div>
        <div style="font-size:16px;font-weight:800;color:var(--primary);">${data.cf_percentage}%</div>
      </div>
    </div>

    <div style="font-size:12px;color:var(--text-secondary);line-height:1.45;background:var(--bg-surface);padding:8px 10px;border-radius:6px;border:1px solid var(--border-subtle);margin-top:2px;">
      <strong>Instruksi Keselamatan:</strong> ${esc(data.safety_advice || 'Gunakan alat sesuai petunjuk keselamatan warga.')}
    </div>
  `;

  if (waBtn) {
    if (zone === 'RED') {
      waBtn.style.display = 'none';
    } else {
      waBtn.style.display = 'flex';
      waBtn.href = data.whatsapp_url;
      waBtn.onclick = () => recordDigitalReceipt(
        data.record_id,
        data.item ? data.item.name : 'Peralatan',
        document.getElementById('wizard-borrower-name').value.trim() || 'Warga',
        getWizardBorrowDays()
      );
    }
  }
}

// ============================================================
// MANUAL ADD & DELETE ITEM
// ============================================================
function openAddItemModal() {
  const modal = document.getElementById('modal-add-item');
  if (modal) modal.classList.add('open');
}

function closeAddItemModal() {
  const modal = document.getElementById('modal-add-item');
  if (modal) modal.classList.remove('open');
  const form = document.getElementById('form-add-item');
  if (form) form.reset();
  const wrap = document.getElementById('add-item-preview-wrap');
  if (wrap) wrap.style.display = 'none';
}

function previewAddItemPhoto(e) {
  const file = e.target.files && e.target.files[0];
  const wrap = document.getElementById('add-item-preview-wrap');
  const img = document.getElementById('add-item-preview-img');
  if (!file || !wrap || !img) {
    if (wrap) wrap.style.display = 'none';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(evt) {
    img.src = evt.target.result;
    wrap.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function handleCreateItem(e) {
  e.preventDefault();
  const name = document.getElementById('add-item-name').value.trim();
  const category = document.getElementById('add-item-category').value;
  const power = parseInt(document.getElementById('add-item-power').value || '0', 10);
  const danger = document.getElementById('add-item-danger').value;
  const desc = document.getElementById('add-item-desc').value.trim();
  const fileInput = document.getElementById('add-item-file');

  if (!name) {
    showToast('Nama peralatan wajib diisi.', 'warn');
    document.getElementById('add-item-name').focus();
    return;
  }

  let photoUrl = '/img/bor.svg';
  if (category === 'Perkebunan') photoUrl = '/img/rumput.svg';
  else if (category === 'Akses Ketinggian') photoUrl = '/img/tangga.svg';
  else if (category === 'Peralatan Air & Cuci') photoUrl = '/img/jetcleaner.svg';
  else if (category === 'Pertukangan Ringan') photoUrl = '/img/obeng.svg';
  else if (category === 'Perkakas Manual') photoUrl = '/img/toolset.svg';

  if (fileInput && fileInput.files && fileInput.files[0]) {
    try {
      const file = fileInput.files[0];
      const base64 = await readFileAsBase64(file);
      const uploadRes = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: base64 })
      });
      const uploadData = await uploadRes.json();
      if (uploadData.url) {
        photoUrl = uploadData.url;
      }
    } catch (err) {
      console.warn('Gagal upload gambar, menggunakan gambar ikon:', err);
    }
  }

  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        category,
        power_watts: power,
        danger_level: danger,
        description: desc,
        last_photo_url: photoUrl
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      closeAddItemModal();
      await loadItems();
      renderBeranda();
      showToast('Peralatan berhasil ditambahkan ke inventaris!', 'success');
    } else {
      showToast(data.error || 'Gagal menambahkan peralatan.', 'warn');
    }
  } catch (err) {
    showToast('Gagal menghubungi server.', 'warn');
  }
}

async function handleDeleteItem(itemId) {
  if (!confirm('Yakin ingin menghapus peralatan ini dari inventaris?')) return;
  try {
    const res = await fetch('/api/items/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId })
    });
    if (res.ok) {
      closeAssetDetailModal();
      showToast('Peralatan berhasil dihapus dari inventaris.', 'success');
      await loadItems();
      renderBeranda();
    } else {
      showToast('Gagal menghapus peralatan.', 'warn');
    }
  } catch (err) {
    showToast('Gagal menghubungi server.', 'warn');
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
// 5. MENU 2: MESSAGE (Pengingat & Manajemen Kontak)
// ============================================================
function renderMessage() {
  const reminderContainer = document.getElementById('reminder-list');
  reminderContainer.innerHTML = '';

  if (!state.reminders.length) {
    reminderContainer.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">✅ Tidak ada antrean pengembalian aktif saat ini. Semua alat aman di gudang.</div>`;
  } else {
    state.reminders.forEach(r => {
      const daysLeft = r.borrow_days - (r.days_elapsed || 0);
      let statusTag = '';
      if (daysLeft < 0) {
        statusTag = `<span class="reminder-time-tag overdue">🔴 Terlambat ${Math.abs(daysLeft)} Hari</span>`;
      } else if (daysLeft === 0) {
        statusTag = `<span class="reminder-time-tag due">⏰ Jatuh Tempo Hari Ini</span>`;
      } else if (daysLeft === 1) {
        statusTag = `<span class="reminder-time-tag due">🟠 Sisa 1 Hari</span>`;
      } else {
        statusTag = `<span class="reminder-time-tag safe">🟢 Sisa ${daysLeft} Hari</span>`;
      }

      const waMsg = encodeURIComponent(
        `Halo ${r.borrower_name}, sekadar mengingatkan alat *${r.item_name}* yang dipinjam selama ${r.borrow_days} hari ya. Kalau sudah selesai dipakai, kabari ya. Terima kasih!`
      );
      const cleanPhone = (r.borrower_phone || '').replace(/[^0-9]/g, '');
      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waMsg}` : `https://wa.me/?text=${waMsg}`;

      const tile = document.createElement('div');
      tile.className = 'reminder-tile';
      tile.innerHTML = `
        <div class="reminder-tile-top">
          <div style="flex:1;min-width:160px;">
            <strong style="font-size:13px;color:var(--text-primary);">🔧 ${esc(r.item_name)}</strong>
            <div style="font-size:11.5px;color:var(--text-secondary);margin-top:3px;">
              👤 Peminjam: <strong>${esc(r.borrower_name)}</strong> (${r.borrower_phone || 'Tanpa No. WA'})
            </div>
          </div>
          ${statusTag}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">
          <a href="${waUrl}" target="_blank" class="btn-act btn-whatsapp-action btn-sm" style="flex:1;min-width:135px;">💬 Kirim Pengingat WA</a>
          <button class="btn-act btn-subtle-action btn-sm" style="flex:1;min-width:135px;" onclick="openReturnModalByRecordId(${r.id})">📸 Cek Pengembalian</button>
        </div>
      `;
      reminderContainer.appendChild(tile);
    });
  }

  // Render Email Logs
  const emailLogBody = document.getElementById('email-log-body');
  emailLogBody.innerHTML = '';

  if (!state.emailLogs.length) {
    emailLogBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px 14px;line-height:1.6;">
          📂 Belum ada catatan serah terima alat.<br>
          <span style="font-size:11.5px;color:var(--text-secondary);">Bukti arsip digital akan otomatis tersimpan di sini setiap kali ada warga yang meminjam.</span>
        </td>
      </tr>`;
  } else {
    state.emailLogs.forEach(log => {
      let statusDisplay = esc(log.status || 'Bukti Disimpan');
      if (log.status === 'ARCHIVED' || log.status === 'TERKIRIM (Arsip Digital)' || log.status === 'SAH • Arsip Digital Permanen') {
        statusDisplay = '✅ Bukti Disimpan';
      } else if (log.status === 'TERKIRIM (Pengembalian Diverifikasi)' || log.status === 'Tercatat di Buku') {
        statusDisplay = '✅ Tercatat di Buku';
      } else if (log.status === 'Bukti Disimpan') {
        statusDisplay = '✅ Bukti Disimpan';
      }
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${(log.created_at || '').substring(0, 16)}</td>
        <td><strong>${esc(log.borrower_name || 'Warga')}</strong></td>
        <td>${esc(log.subject)}</td>
        <td><span style="font-weight:700;color:var(--green-text);white-space:nowrap;">${statusDisplay}</span></td>
      `;
      emailLogBody.appendChild(tr);
    });
  }
}

// Global Toast Feedback System
function showToast(message, type = 'info', duration = 3500) {
  const toastEl = document.getElementById('app-toast');
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className = `app-toast show ${type}`;
  clearTimeout(window.__toastTimeout);
  window.__toastTimeout = setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}

// Integrasi Web Contacts Picker API (Buku Kontak HP) dengan Aksentuasi & Feedback
async function pickDeviceContact(btn) {
  const originalText = btn ? btn.textContent : 'Sinkron Kontak HP';
  if (btn) {
    btn.textContent = 'Membaca Kontak...';
    btn.disabled = true;
    btn.style.opacity = '0.7';
  }

  try {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      showToast('Membuka kontak telepon...', 'info', 2000);
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        const name = contact.name ? contact.name[0] : 'Warga';
        const tel = contact.tel ? contact.tel[0] : '';
        showToast(`Kontak terpilih: ${name} (${tel})`, 'success', 4000);
      }
    } else {
      showToast('Buku kontak HP siap di Chrome Android. Pada desktop, nomor WA dapat diketik langsung saat pinjam alat.', 'info', 4500);
    }
  } catch (e) {
    console.log('User cancelled contact pick or not supported:', e);
  } finally {
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}

// ============================================================
// 6. MENU 3: FAQ & TRANSPARANSI AI
// ============================================================
async function renderFaq() {
  const rulesContainer = document.getElementById('faq-rules-list');
  if (rulesContainer.innerHTML.trim() !== '') return; // Sudah dimuat

  try {
    const res = await fetch('/api/knowledge-base');
    const data = await res.json();
    rulesContainer.innerHTML = '';

    data.rules.forEach(r => {
      const item = document.createElement('div');
      item.style.padding = '8px 0';
      item.style.borderBottom = '1px solid var(--border-subtle)';
      item.innerHTML = `
        <div style="font-family:monospace;font-size:11.5px;color:var(--primary);font-weight:bold;">${r.code} (CF Pakar: ${r.cf_pakar})</div>
        <div style="font-size:11.5px;color:var(--text-primary);margin-top:2px;">
          IF (${r.premises.length ? r.premises.join(` <strong>${r.operator}</strong> `) : 'Semua indikator normal'}) THEN <strong>${r.conclusion}</strong>
        </div>
        <div style="font-size:11px;color:var(--text-muted);font-style:italic;">"${esc(r.explanation)}"</div>
      `;
      rulesContainer.appendChild(item);
    });
  } catch (err) {
    console.error('Error load FAQ rules:', err);
  }
}

function toggleFaq(btn) {
  const card = btn.closest('.faq-card');
  card.classList.toggle('open');
  const span = btn.querySelector('span:last-child');
  span.textContent = card.classList.contains('open') ? '−' : '+';
}

function switchFaqSubTab(subTabId) {
  document.querySelectorAll('.faq-subtab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.faqSub === subTabId);
  });
  document.querySelectorAll('.faq-sub-content').forEach(pane => {
    pane.classList.toggle('active', pane.id === `faq-sub-${subTabId}`);
  });
  if (subTabId === 'teknis') {
    renderFaq();
  }
}

// ============================================================
// 7. INTELLIGENT AI ASSISTANT CHATBOT (Conversational & Triase)
// ============================================================
function appendBotChat(html) {
  hideTypingIndicator();
  const row = document.createElement('div');
  row.className = 'chat-row bot';
  row.innerHTML = `
    <div class="bubble bubble-bot">
      <div>${html}</div>
      <div class="bubble-meta">${getTime()}</div>
    </div>
  `;
  chatDrawerBody.appendChild(row);
  scrollChatDown();
}

function appendUserChat(text, photoUrl = '') {
  const row = document.createElement('div');
  row.className = 'chat-row user';
  const imgHtml = photoUrl ? `<img class="bubble-user-img" src="${photoUrl}" alt="Foto Terlampir">` : '';
  const textHtml = text ? `<div>${esc(text)}</div>` : '';
  row.innerHTML = `
    <div class="bubble bubble-user">
      ${imgHtml}
      ${textHtml}
      <div class="bubble-meta">${getTime()}</div>
    </div>
  `;
  chatDrawerBody.appendChild(row);
  scrollChatDown();
}

// Chat Photo Attachment Handler
let chatAttachedPhoto = {
  base64: null,
  file: null
};

function handleChatFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    chatAttachedPhoto = {
      base64: evt.target.result,
      file: file
    };
    const previewWrap = document.getElementById('chat-attach-preview');
    const previewImg = document.getElementById('chat-attach-img');
    if (previewImg && previewWrap) {
      previewImg.src = evt.target.result;
      previewWrap.style.display = 'flex';
    }
    const input = document.getElementById('chat-user-input');
    if (input) input.focus();
  };
  reader.readAsDataURL(file);
}

function removeChatAttachment() {
  chatAttachedPhoto = { base64: null, file: null };
  const previewWrap = document.getElementById('chat-attach-preview');
  if (previewWrap) previewWrap.style.display = 'none';
  const fileInput = document.getElementById('chat-file-input');
  if (fileInput) fileInput.value = '';
}

function showTypingIndicator() {
  hideTypingIndicator();
  const row = document.createElement('div');
  row.className = 'chat-row bot';
  row.id = 'chat-typing-indicator';
  row.innerHTML = `
    <div class="bubble bubble-bot typing-indicator">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;
  chatDrawerBody.appendChild(row);
  scrollChatDown();
}

function hideTypingIndicator() {
  const ind = document.getElementById('chat-typing-indicator');
  if (ind) ind.remove();
}

function scrollChatDown() {
  setTimeout(() => {
    if (chatDrawerBody) {
      chatDrawerBody.scrollTop = chatDrawerBody.scrollHeight;
    }
  }, 40);
}

function getTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Auto-authenticate session in background so user doesn't face friction
async function ensureAuthenticatedSession() {
  if (state.isAuthenticated && state.sessionId) return true;
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      state.sessionId = data.session_id;
      state.isAuthenticated = true;
      return true;
    }
  } catch (err) {
    console.warn('Session init warning:', err);
  }
  return false;
}

// Start / Human-Centric Welcome Greeting (Progressive Disclosure)
async function startChatSession() {
  await ensureAuthenticatedSession();

  appendBotChat(`
    <div style="font-size:13px;line-height:1.5;color:var(--text-primary);">
      Halo, Warga! Ada alat yang ingin dipinjam atau dikembalikan hari ini? Silakan ketik atau pilih menu di bawah ya.
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
      <button class="btn-act btn-primary-action btn-sm" style="flex:1;min-width:120px;" onclick="handleChatQuickAction('borrow_tool')">
        ⚡ Pinjam Alat
      </button>
      <button class="btn-act btn-subtle-action btn-sm" style="flex:1;min-width:120px;" onclick="handleChatQuickAction('check_ready')">
        📦 Cek Status Alat
      </button>
    </div>
  `);
}

function restartChatConversation() {
  if (chatDrawerBody) chatDrawerBody.innerHTML = '';
  startChatSession();
  showToast('Percakapan asisten dimulai ulang.', 'info');
}

function sendSuggestedQuery(text) {
  const input = document.getElementById('chat-user-input');
  if (input) input.value = '';
  processUserChatMessage(text, null);
}

async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('chat-user-input');
  const text = (input ? input.value : '').trim();
  const photo = chatAttachedPhoto.base64;

  if (!text && !photo) return;

  // Clear composer & attachment
  if (input) input.value = '';
  removeChatAttachment();

  processUserChatMessage(text, photo);
}

// Category Guesser for New Tools
function guessToolCategory(toolName) {
  const t = (toolName || '').toLowerCase();
  if (t.includes('cangkul') || t.includes('arit') || t.includes('sekop') || t.includes('rumput') || t.includes('kebun') || t.includes('tanaman') || t.includes('dahan') || t.includes('garpu')) {
    return 'Perkebunan';
  }
  if (t.includes('bor') || t.includes('gerinda') || t.includes('las') || t.includes('solder') || t.includes('jigsaw') || t.includes('listrik') || t.includes('mesin') || t.includes('circular')) {
    return 'Pertukangan Listrik';
  }
  if (t.includes('tangga') || t.includes('steger') || t.includes('scaffolding')) {
    return 'Akses Ketinggian';
  }
  if (t.includes('jet') || t.includes('cleaner') || t.includes('cuci') || t.includes('pompa') || t.includes('selang') || t.includes('steam')) {
    return 'Peralatan Air & Cuci';
  }
  if (t.includes('obeng') || t.includes('tang') || t.includes('kunci') || t.includes('meteran') || t.includes('tespen')) {
    return 'Pertukangan Ringan';
  }
  return 'Perkakas Manual';
}

function getDefaultCategoryPhoto(category) {
  if (category === 'Perkebunan') return '/img/rumput.svg';
  if (category === 'Akses Ketinggian') return '/img/tangga.svg';
  if (category === 'Peralatan Air & Cuci') return '/img/jetcleaner.svg';
  if (category === 'Pertukangan Ringan') return '/img/obeng.svg';
  if (category === 'Pertukangan Listrik') return '/img/bor.svg';
  return '/img/toolset.svg';
}

// ============================================================
// NATURAL LANGUAGE ENTITY EXTRACTOR (EXPRESS BORROWING)
// ============================================================
function parseNaturalBorrowQuery(text) {
  const lower = (text || '').toLowerCase().trim();
  if (!lower) return null;

  // 1. Check for borrow or add intent keywords
  const borrowKeywords = ['pinjam', 'minjam', 'meminjam', 'sewa', 'ambil', 'butuh', 'pakai', 'gunakan'];
  const hasBorrow = borrowKeywords.some(kw => lower.includes(kw));

  const addKeywords = ['tambah', 'daftarkan', 'catat', 'masukkan', 'input'];
  const hasAdd = addKeywords.some(kw => lower.includes(kw));

  if (!hasBorrow && !hasAdd) return null;

  // 2. Extract Phone Number (e.g. 081212341234, 6281212341234, wa 081212341234)
  let phone = '';
  const phoneRegex = /(?:wa|nomor\s*wa|no\s*wa|nohp|no|nomor|hp|telp|whatsapp)?[:\s]*((?:\+?62|0)8[0-9\-\s]{7,13})/i;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) {
    phone = phoneMatch[1].replace(/[\-\s]/g, '');
  }

  // 3. Extract Duration (days) & strip duration phrase from working text
  let days = 1;
  let durationMatchedPhrase = '';
  const durationPatterns = [
    { re: /(\d+)\s*(?:hari|hr|day|days)/i, fn: (m) => Math.max(1, Math.min(90, parseInt(m[1], 10))) },
    { re: /\b(sehari|seharian|satu\s+hari)\b/i, fn: () => 1 },
    { re: /\b(dua\s+hari)\b/i, fn: () => 2 },
    { re: /\b(tiga\s+hari)\b/i, fn: () => 3 },
    { re: /\b(empat\s+hari)\b/i, fn: () => 4 },
    { re: /\b(lima\s+hari)\b/i, fn: () => 5 },
    { re: /\b(enam\s+hari)\b/i, fn: () => 6 },
    { re: /\b(seminggu|sepekan|satu\s+minggu|tujuh\s+hari)\b/i, fn: () => 7 },
    { re: /\b(sebulan|satu\s+bulan)\b/i, fn: () => 30 }
  ];
  for (const pat of durationPatterns) {
    const m = text.match(pat.re);
    if (m) {
      days = pat.fn(m);
      durationMatchedPhrase = m[0];
      break;
    }
  }

  // Working text with phone & duration removed cleanly
  let workText = text;
  if (phoneMatch) workText = workText.replace(phoneMatch[0], ' ');
  if (durationMatchedPhrase) workText = workText.replace(durationMatchedPhrase, ' ');
  workText = workText.replace(/\s+/g, ' ').trim();

  // 4. Match Tool against existing state.items
  let matchedTool = null;
  const items = (state.items || []);

  // Try direct match
  for (const it of items) {
    if (lower.includes(it.name.toLowerCase())) {
      matchedTool = it;
      break;
    }
  }

  // Try keyword matching (e.g. "bor", "palu", "tangga", "gerinda", "rumput")
  if (!matchedTool) {
    const sorted = [...items].sort((a, b) => b.name.length - a.name.length);
    for (const it of sorted) {
      const parts = it.name.toLowerCase().split(/\s+/).filter(p => p.length >= 3);
      for (const p of parts) {
        if (lower.includes(p)) {
          matchedTool = it;
          break;
        }
      }
      if (matchedTool) break;
    }
  }

  // Common tool synonyms fallback for existing items
  if (!matchedTool && items.length > 0) {
    if (lower.includes('bor')) matchedTool = items.find(i => i.name.toLowerCase().includes('bor'));
    else if (lower.includes('palu')) matchedTool = items.find(i => i.name.toLowerCase().includes('palu'));
    else if (lower.includes('tangga')) matchedTool = items.find(i => i.name.toLowerCase().includes('tangga'));
    else if (lower.includes('gerinda')) matchedTool = items.find(i => i.name.toLowerCase().includes('gerinda'));
    else if (lower.includes('rumput')) matchedTool = items.find(i => i.name.toLowerCase().includes('rumput'));
    else if (lower.includes('jet') || lower.includes('cuci')) matchedTool = items.find(i => i.name.toLowerCase().includes('jet') || i.name.toLowerCase().includes('cuci'));
    else if (lower.includes('obeng')) matchedTool = items.find(i => i.name.toLowerCase().includes('obeng'));
    else if (lower.includes('jigsaw') || lower.includes('gergaji')) matchedTool = items.find(i => i.name.toLowerCase().includes('jigsaw'));
  }

  // 5. If Tool matches existing item:
  if (matchedTool) {
    let clean = workText;
    clean = clean.replace(new RegExp(matchedTool.name, 'gi'), ' ');
    matchedTool.name.split(/\s+/).forEach(w => {
      if (w.length >= 3) clean = clean.replace(new RegExp('\\b' + w + '\\b', 'gi'), ' ');
    });

    const stopWords = [
      'pinjam', 'minjam', 'meminjam', 'sewa', 'ambil', 'butuh', 'pakai',
      'mau', 'ingin', 'tolong', 'dong', 'bisa', 'kah', 'ya', 'nomor', 'no',
      'wa', 'whatsapp', 'hp', 'nohp', 'telp', 'telepon', 'hari', 'hr',
      'buat', 'untuk', 'atas', 'nama', 'peminjam', 'halo', 'hai', 'siang',
      'pagi', 'sore', 'malam', 'permisi', 'sehari', 'seharian', 'seminggu', 'sepekan'
    ];
    stopWords.forEach(sw => {
      clean = clean.replace(new RegExp('\\b' + sw + '\\b', 'gi'), ' ');
    });

    let name = clean.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const honorificMatch = workText.match(/\b(pak|bu|bapak|ibu|mas|mbak)\s+([A-Za-z]+)/i);
    if (honorificMatch) {
      name = `${honorificMatch[1].charAt(0).toUpperCase() + honorificMatch[1].slice(1).toLowerCase()} ${honorificMatch[2].charAt(0).toUpperCase() + honorificMatch[2].slice(1).toLowerCase()}`;
    } else if (name) {
      name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    if (!name || name.length < 2) name = 'Warga / Peminjam';

    return {
      type: 'BORROW_EXPRESS',
      tool: matchedTool,
      name,
      phone,
      days
    };
  }

  // 6. TOOL NOT FOUND IN DATABASE — Detect New Tool Candidates!
  // Example pattern A: "Abdilah pinjam sepeda sehari untuk lomba" -> Borrower: Abdilah, Tool: Sepeda
  // Example pattern B: "pinjam cangkul untuk Budi 3 hari nomor wa 0821..." -> Tool: Cangkul, Borrower: Budi
  // Example pattern C: "tambah cangkul ke gudang"
  let candidateTool = '';
  let candidateBorrower = '';

  // Pattern A: [Nama] (mau/ingin)? (pinjam|minjam) [Alat] (untuk/buat/demi ...)?
  const patternA = /^([A-Za-z\s]+?)\s+(?:(?:mau|ingin|akan|hendak)\s+)?(?:pinjam|minjam|meminjam|sewa|ambil)\s+([A-Za-z0-9\s]+?)(?:\s+(?:untuk|buat|demi|agar|keperluan)\b.*|\s+wa\b.*|\s+nomor\b.*|\s+no\b.*|\s*$)/i;
  const matchA = workText.match(patternA);

  // Pattern B: (pinjam|minjam) [Alat] (untuk|buat|atas nama) [Nama]
  const patternB = /^(?:(?:tolong|mau|ingin)\s+)?(?:pinjam|minjam|meminjam)\s+([A-Za-z0-9\s]+?)\s+(?:untuk|buat|atas nama)\s+([A-Za-z\s]+?)(?:\s+wa\b.*|\s+nomor\b.*|\s+no\b.*|\s*$)/i;
  const matchB = workText.match(patternB);

  // Pattern C: (tambah|catat|daftarkan|masukkan) [Alat]
  const patternC = /(?:tambah|catat|daftarkan|masukkan)\s+(?:alat\s+)?([A-Za-z0-9\s]+?)(?:\s+ke\s+rak|\s+baru|\s+gudang|\s*$)/i;
  const matchC = workText.match(patternC);

  if (matchA) {
    candidateBorrower = matchA[1].trim();
    candidateTool = matchA[2].trim();
  } else if (matchB) {
    candidateTool = matchB[1].trim();
    candidateBorrower = matchB[2].trim();
  } else if (matchC) {
    candidateTool = matchC[1].trim();
  }

  // Clean candidate tool from leftover stop words / duration words
  const toolStopWords = ['nomor', 'wa', 'no', 'hari', 'sehari', 'seharian', 'seminggu', 'sepekan', 'baru', 'untuk', 'buat', 'tolong'];
  toolStopWords.forEach(sw => {
    candidateTool = candidateTool.replace(new RegExp('\\b' + sw + '\\b.*$', 'gi'), '').trim();
  });

  if (candidateTool && candidateTool.length >= 3) {
    // Capitalize tool name
    const formattedToolName = candidateTool.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    
    // Capitalize borrower
    let formattedBorrower = candidateBorrower.replace(/[^a-zA-Z\s]/g, '').trim();
    if (formattedBorrower) {
      formattedBorrower = formattedBorrower.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    } else {
      formattedBorrower = 'Warga / Peminjam';
    }

    if (hasBorrow) {
      return {
        type: 'BORROW_NEW_TOOL',
        newToolName: formattedToolName,
        name: formattedBorrower,
        phone,
        days,
        category: guessToolCategory(formattedToolName)
      };
    } else {
      return {
        type: 'REGISTER_NEW_TOOL',
        newToolName: formattedToolName,
        category: guessToolCategory(formattedToolName)
      };
    }
  }

  return {
    type: 'BORROW_UNKNOWN_TOOL',
    phone,
    days,
    rawText: text
  };
}

async function registerAndBorrowDirectly(toolName, category, photoUrl, borrowerName, borrowerPhone, borrowDays) {
  const btn = document.getElementById('btn-reg-borrow-direct');
  if (btn) {
    btn.textContent = 'Memproses...';
    btn.disabled = true;
  }

  const finalPhoto = photoUrl || getDefaultCategoryPhoto(category);

  try {
    // 1. Create tool in database
    const createRes = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: toolName,
        category: category,
        power_watts: 0,
        danger_level: 'SEDANG',
        description: 'Didaftarkan instan via Asisten GudangLingling AI',
        last_photo_url: finalPhoto
      })
    });
    const createData = await createRes.json();
    if (!createRes.ok || !createData.success) {
      showToast(createData.error || 'Gagal mendaftarkan alat.', 'warn');
      if (btn) { btn.textContent = '⚡ Daftarkan & Pinjamkan (1-Klik)'; btn.disabled = false; }
      return;
    }

    const newItemId = createData.item_id;

    // 2. Process borrowing wizard
    const borrowRes = await fetch('/api/borrow/wizard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: newItemId,
        borrower_name: borrowerName,
        borrower_phone: borrowerPhone,
        borrow_days: borrowDays,
        facts: {},
        photo_url: finalPhoto
      })
    });
    const borrowData = await borrowRes.json();

    await loadAllData();

    appendBotChat(`
      <div style="background:var(--bg-surface);border:1.5px solid var(--green);border-radius:12px;padding:12px;margin-top:6px;">
        <div style="display:flex;align-items:center;gap:6px;font-weight:800;color:var(--green-text);font-size:12.5px;">
          <span class="status-pulse-dot green" style="position:static;"></span>
          <span>✅ ALAT BERHASIL DIDAFTARKAN &amp; DIPINJAMKAN!</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin:8px 0;background:var(--bg-app);padding:8px 10px;border-radius:8px;border:1px solid var(--border-subtle);">
          <img src="${finalPhoto}" style="width:44px;height:44px;border-radius:6px;object-fit:cover;" onerror="this.onerror=null; this.src='/img/bor.svg';">
          <div>
            <div style="font-weight:700;font-size:13px;color:var(--text-primary);">${esc(toolName)}</div>
            <div style="font-size:11px;color:var(--text-secondary);">${esc(category)} &bull; ${borrowDays} Hari</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-primary);margin-bottom:8px;">
          Peminjam: <strong>${esc(borrowerName)}</strong> (${borrowerPhone || 'Tanpa WA'})
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <a href="${borrowData.whatsapp_url}" target="_blank" onclick="recordDigitalReceipt(${borrowData.record_id}, '${esc(toolName)}', '${esc(borrowerName)}', ${borrowDays})" class="btn-act btn-whatsapp-action btn-sm" style="text-decoration:none;display:flex;justify-content:center;align-items:center;gap:6px;">
            💬 Kirim Bukti ke WhatsApp
          </a>
          <button class="btn-act btn-subtle-action btn-sm" onclick="closeChatDrawer()">Tutup Asisten</button>
        </div>
      </div>
    `);
    showToast(`Alat ${toolName} terdaftar & dipinjamkan ke ${borrowerName}!`, 'success');
  } catch (err) {
    showToast('Koneksi server gagal saat mendaftarkan alat.', 'warn');
    if (btn) { btn.textContent = '⚡ Daftarkan & Pinjamkan (1-Klik)'; btn.disabled = false; }
  }
}

async function registerToolOnly(toolName, category, photoUrl) {
  const finalPhoto = photoUrl || getDefaultCategoryPhoto(category);
  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: toolName,
        category: category,
        power_watts: 0,
        danger_level: 'SEDANG',
        description: 'Didaftarkan instan via Asisten GudangLingling AI',
        last_photo_url: finalPhoto
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      await loadAllData();
      appendBotChat(`
        <div style="background:var(--bg-surface);border:1px solid var(--green-border);border-radius:10px;padding:10px;margin-top:6px;">
          <strong style="color:var(--green-text);font-size:12.5px;">Alat Berhasil Ditambahkan ke Rak!</strong>
          <div style="font-size:12px;color:var(--text-primary);margin-top:4px;">
            <strong>${esc(toolName)}</strong> (${esc(category)}) sekarang berstatus <strong>Ready</strong> di inventaris.
          </div>
        </div>
      `);
      showToast(`${toolName} berhasil ditambahkan ke inventaris.`, 'success');
    } else {
      showToast(data.error || 'Gagal menambahkan alat.', 'warn');
    }
  } catch (err) {
    showToast('Koneksi server gagal.', 'warn');
  }
}

async function executeExpressBorrow(toolId, borrowerName, borrowerPhone, borrowDays) {
  const submitBtn = document.getElementById(`btn-confirm-express-${toolId}`);
  if (submitBtn) {
    submitBtn.textContent = 'Memproses...';
    submitBtn.disabled = true;
  }

  try {
    const res = await fetch('/api/borrow/wizard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: toolId,
        borrower_name: borrowerName,
        borrower_phone: borrowerPhone,
        borrow_days: borrowDays,
        facts: {}
      })
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Gagal memproses peminjaman kilat.', 'warn');
      if (submitBtn) {
        submitBtn.textContent = '⚡ Konfirmasi & Pinjam Sekarang (1-Klik)';
        submitBtn.disabled = false;
      }
      return;
    }

    await loadAllData();

    appendBotChat(`
      <div style="background:var(--bg-surface);border:1.5px solid var(--green);border-radius:12px;padding:12px;margin-top:6px;">
        <div style="display:flex;align-items:center;gap:6px;font-weight:800;color:var(--green-text);font-size:12.5px;">
          <span class="status-pulse-dot green" style="position:static;"></span>
          <span>✅ PEMINJAMAN KILAT BERHASIL DICATAT!</span>
        </div>
        <div style="font-size:12.5px;color:var(--text-primary);margin:6px 0;line-height:1.4;">
          <strong>${esc(data.item.name)}</strong> resmi tercatat dipinjam oleh <strong>${esc(borrowerName)}</strong> selama <strong>${borrowDays} hari</strong>.
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
          <a href="${data.whatsapp_url}" target="_blank" onclick="recordDigitalReceipt(${data.record_id}, '${esc(data.item.name)}', '${esc(borrowerName)}', ${borrowDays})" class="btn-act btn-whatsapp-action btn-sm" style="text-decoration:none;display:flex;justify-content:center;align-items:center;gap:6px;">
            💬 Kirim Bukti ke WhatsApp
          </a>
          <button class="btn-act btn-subtle-action btn-sm" onclick="closeChatDrawer()">Tutup Asisten</button>
        </div>
      </div>
    `);
    showToast(`Peminjaman ${data.item.name} untuk ${borrowerName} berhasil dicatat!`, 'success');
  } catch (err) {
    showToast('Koneksi server gagal saat mencatat peminjaman.', 'warn');
    if (submitBtn) {
      submitBtn.textContent = '⚡ Konfirmasi & Pinjam Sekarang (1-Klik)';
      submitBtn.disabled = false;
    }
  }
}

function openBorrowWizardWithData(toolId, name, phone, days) {
  closeChatDrawer();
  openBorrowWizard(toolId);
  if (name && name !== 'Warga / Peminjam') {
    const nameEl = document.getElementById('wizard-borrower-name');
    if (nameEl) nameEl.value = name;
  }
  if (phone) {
    const phoneEl = document.getElementById('wizard-borrower-phone');
    if (phoneEl) phoneEl.value = phone;
  }
  if (days) {
    const daysSel = document.getElementById('wizard-borrow-days');
    const customWrap = document.getElementById('wizard-custom-days-wrap');
    const customInput = document.getElementById('wizard-custom-days-input');
    if (['1', '2', '3', '5', '7'].includes(String(days))) {
      if (daysSel) daysSel.value = String(days);
      if (customWrap) customWrap.style.display = 'none';
    } else {
      if (daysSel) daysSel.value = 'custom';
      if (customWrap) customWrap.style.display = 'block';
      if (customInput) customInput.value = String(days);
    }
  }
}

// Conversational AI Parser (Intelligent Natural Responses & Photo Attachment)
async function processUserChatMessage(rawText, photoBase64 = null) {
  appendUserChat(rawText, photoBase64);
  showTypingIndicator();

  // If photo is attached, upload in background to get permanent URL
  let uploadedPhotoUrl = '';
  if (photoBase64) {
    try {
      const res = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: photoBase64 })
      });
      const data = await res.json();
      if (data.url) uploadedPhotoUrl = data.url;
    } catch (err) {
      console.warn('Photo upload in chat error:', err);
    }
  }

  const query = (rawText || '').toLowerCase().trim();

  setTimeout(() => {
    // 0. NATURAL LANGUAGE EXPRESS BORROWING (e.g. "Budi pinjam cangkul 3 hari nomor wa 082173399003")
    const borrowIntent = parseNaturalBorrowQuery(rawText);
    if (borrowIntent) {
      // CASE A: Tool exists in warehouse
      if (borrowIntent.type === 'BORROW_EXPRESS') {
        const tool = borrowIntent.tool;
        const name = borrowIntent.name;
        const phone = borrowIntent.phone;
        const days = borrowIntent.days;

        if (tool.status === 'BORROWED') {
          appendBotChat(`
            Perhatian: <strong>${esc(tool.name)}</strong> saat ini sedang dipinjam oleh <strong>${esc(tool.active_borrower || 'warga lain')}</strong>.<br>
            Estimasi alat kembali dalam beberapa hari. Silakan pilih perkakas lain yang sedang tersedia:
            <div style="margin-top:8px;">
              <button class="btn-act btn-subtle-action btn-sm" onclick="sendSuggestedQuery('Alat apa saja yang sedang ready?')">
                Lihat Perkakas Ready
              </button>
            </div>
          `);
          return;
        }

        if (tool.status === 'MAINTENANCE_LOCKED') {
          appendBotChat(`
            Peringatan Keselamatan: <strong>${esc(tool.name)}</strong> saat ini berstatus <strong>Karantina Servis (Lockout)</strong> dan belum boleh dipinjamkan demi keselamatan bersama.
          `);
          return;
        }

        const maxAllowed = getMaxBorrowDays(tool);
        if (days > maxAllowed) {
          appendBotChat(`
            <div style="background:var(--yellow-bg);border:1px solid var(--yellow-border);border-radius:10px;padding:12px;">
              <strong style="color:var(--yellow-text);font-size:12.5px;">⚠️ Aturan Sistem Pakar: Durasi Terlalu Lama</strong>
              <p style="font-size:12px;color:var(--text-primary);margin:6px 0 10px;line-height:1.45;">
                Untuk alat kategori <strong>${esc(tool.category)}</strong> (${esc(tool.name)}), batas maksimal peminjaman adalah <strong>${maxAllowed} hari</strong> agar warga lain tetap kebagian. Permintaan Anda: <strong>${days} hari</strong>.
              </p>
              <button class="btn-act btn-primary-action btn-sm" onclick="sendSuggestedQuery('${esc(name)} pinjam ${esc(tool.name)} ${maxAllowed} hari${phone ? ' wa ' + esc(phone) : ''}')">
                ⚡ Sesuaikan Jadi ${maxAllowed} Hari
              </button>
            </div>
          `);
          return;
        }

        // Available! Render the Express Borrow Card
        appendBotChat(`
          <div class="chat-express-card">
            <div class="express-header">
              <span class="express-badge">⚡ Peminjaman Kilat Terdeteksi</span>
              <span class="status-pulse-dot green" style="position:static;"></span>
            </div>

            <div class="express-tool-row">
              <img class="express-tool-thumb" src="${uploadedPhotoUrl || tool.last_photo_url || '/img/bor.svg'}" alt="${esc(tool.name)}" onerror="this.onerror=null; this.src='/img/bor.svg';">
              <div>
                <div style="font-weight:700;font-size:13px;color:var(--text-primary);">${esc(tool.name)}</div>
                <div style="font-size:11px;color:var(--text-secondary);">${esc(tool.category)} &bull; ${tool.power_watts ? tool.power_watts + 'W' : 'Non-Listrik'}</div>
              </div>
            </div>

            <div class="express-data-grid">
              <div class="express-data-item">
                <div class="express-data-lbl">Peminjam</div>
                <div class="express-data-val">${esc(name)}</div>
              </div>
              <div class="express-data-item">
                <div class="express-data-lbl">Durasi Pinjam</div>
                <div class="express-data-val">${days} Hari</div>
              </div>
              <div class="express-data-item" style="grid-column:span 2;">
                <div class="express-data-lbl">WhatsApp</div>
                <div class="express-data-val">${phone ? esc(phone) : '<span style="color:var(--text-muted);font-weight:normal;">Belum dicantumkan</span>'}</div>
              </div>
            </div>

            <div class="express-triase-bar">
              <span class="status-pulse-dot green" style="position:static;flex-shrink:0;"></span>
              <span>Triase AI Otomatis: <strong>Zona Hijau (Layak Pakai)</strong></span>
            </div>

            <div class="express-actions-col">
              <button class="btn-act btn-primary-action btn-sm" id="btn-confirm-express-${tool.id}" onclick="executeExpressBorrow(${tool.id}, '${esc(name)}', '${esc(phone)}', ${days})">
                ⚡ Konfirmasi &amp; Pinjam
              </button>
              <button class="btn-act btn-subtle-action btn-sm" onclick="openBorrowWizardWithData(${tool.id}, '${esc(name)}', '${esc(phone)}', ${days})">
                🔧 Sesuaikan di Form Wizard
              </button>
            </div>
          </div>
        `);
        return;
      }

      // CASE B: Tool is NOT YET in warehouse — Direct 1-Click Registration & Lending!
      if (borrowIntent.type === 'BORROW_NEW_TOOL') {
        const newTool = borrowIntent.newToolName;
        const cat = borrowIntent.category;
        const name = borrowIntent.name;
        const phone = borrowIntent.phone;
        const days = borrowIntent.days;
        const displayPhoto = uploadedPhotoUrl || getDefaultCategoryPhoto(cat);

        appendBotChat(`
          <div class="chat-new-tool-card">
            <div class="express-header">
              <span class="new-tool-tag">🆕 Alat Baru Terdeteksi</span>
              <span class="status-pulse-dot yellow" style="position:static;"></span>
            </div>

            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;line-height:1.45;">
              Alat <strong>"${esc(newTool)}"</strong> belum ada di inventaris gudang.<br>
              ${uploadedPhotoUrl ? 'Foto alat telah terlampir!' : 'Foto default telah disiapkan.'} Ingin langsung mendaftarkannya &amp; mencatat peminjaman untuk <strong>${esc(name)}</strong>?
            </div>

            <div class="express-tool-row">
              <img class="express-tool-thumb" src="${displayPhoto}" alt="${esc(newTool)}" onerror="this.onerror=null; this.src='/img/toolset.svg';">
              <div style="flex:1;">
                <div style="font-weight:700;font-size:13px;color:var(--text-primary);">${esc(newTool)}</div>
                <div style="font-size:11px;color:var(--text-secondary);">Kategori: <strong>${esc(cat)}</strong></div>
              </div>
            </div>

            <div class="express-data-grid">
              <div class="express-data-item">
                <div class="express-data-lbl">Peminjam</div>
                <div class="express-data-val">${esc(name)}</div>
              </div>
              <div class="express-data-item">
                <div class="express-data-lbl">Durasi Pinjam</div>
                <div class="express-data-val">${days} Hari</div>
              </div>
              <div class="express-data-item" style="grid-column:span 2;">
                <div class="express-data-lbl">WhatsApp</div>
                <div class="express-data-val">${phone ? esc(phone) : '<span style="color:var(--text-muted);font-weight:normal;">Belum dicantumkan</span>'}</div>
              </div>
            </div>

            <div class="express-actions-col">
              <button class="btn-act btn-primary-action btn-sm" id="btn-reg-borrow-direct" onclick="registerAndBorrowDirectly('${esc(newTool)}', '${esc(cat)}', '${uploadedPhotoUrl}', '${esc(name)}', '${esc(phone)}', ${days})">
                ⚡ Daftar &amp; Pinjamkan
              </button>
              <button class="btn-act btn-subtle-action btn-sm" onclick="registerToolOnly('${esc(newTool)}', '${esc(cat)}', '${uploadedPhotoUrl}')">
                📦 Simpan ke Rak Saja
              </button>
            </div>
          </div>
        `);
        return;
      }

      // CASE C: Register new tool without borrowing
      if (borrowIntent.type === 'REGISTER_NEW_TOOL') {
        const newTool = borrowIntent.newToolName;
        const cat = borrowIntent.category;
        const displayPhoto = uploadedPhotoUrl || getDefaultCategoryPhoto(cat);

        appendBotChat(`
          <div class="chat-new-tool-card">
            <div class="express-header">
              <span class="new-tool-tag">+ Tambah Alat Baru</span>
              <span class="status-pulse-dot green" style="position:static;"></span>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
              Daftarkan <strong>"${esc(newTool)}"</strong> ke rak inventaris gudang?
            </div>
            <div class="express-tool-row">
              <img class="express-tool-thumb" src="${displayPhoto}" alt="${esc(newTool)}">
              <div style="flex:1;">
                <div style="font-weight:700;font-size:13px;color:var(--text-primary);">${esc(newTool)}</div>
                <div style="font-size:11px;color:var(--text-secondary);">Kategori Rekomendasi: <strong>${esc(cat)}</strong></div>
              </div>
            </div>
            <button class="btn-act btn-primary-action btn-sm" onclick="registerToolOnly('${esc(newTool)}', '${esc(cat)}', '${uploadedPhotoUrl}')">
              + Daftarkan ${esc(newTool)} Sekarang
            </button>
          </div>
        `);
        return;
      }

      // CASE D: Unknown tool name
      if (borrowIntent.type === 'BORROW_UNKNOWN_TOOL') {
        const available = (state.items || []).filter(it => it.status === 'AVAILABLE');
        const listHtml = available.map(t => `
          <button class="chat-quick-btn" onclick="sendSuggestedQuery('${borrowIntent.rawText.replace(/pinjam/gi, '').trim()} pinjam ${t.name}')">
            <span>&rsaquo;</span> Pinjam: ${esc(t.name)}
          </button>
        `).join('');

        appendBotChat(`
          Terdeteksi permintaan peminjaman, namun nama alat belum teridentifikasi jelas.<br>
          Pilih salah satu perkakas yang sedang tersedia:
          <div style="display:flex;flex-direction:column;gap:5px;margin-top:8px;">
            ${listHtml || '<div style="font-size:11.5px;color:var(--text-muted);">Tidak ada alat ready saat ini.</div>'}
          </div>
        `);
        return;
      }
    }

    // 0B. If user sent a photo with short text (e.g. photo + "cangkul")
    if (uploadedPhotoUrl && query && query.length <= 25 && !query.includes('aturan') && !query.includes('siapa')) {
      const guessedCat = guessToolCategory(rawText);
      const formattedName = rawText.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      appendBotChat(`
        <div class="chat-new-tool-card">
          <div class="express-header">
            <span class="new-tool-tag">+ Daftarkan Alat Baru</span>
            <span class="status-pulse-dot green" style="position:static;"></span>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
            Foto telah terunggah. Daftarkan <strong>${esc(formattedName)}</strong> ke rak gudang?
          </div>
          <div class="express-tool-row">
            <img class="express-tool-thumb" src="${uploadedPhotoUrl}" alt="${esc(formattedName)}">
            <div>
              <div style="font-weight:700;font-size:13px;color:var(--text-primary);">${esc(formattedName)}</div>
              <div style="font-size:11px;color:var(--text-secondary);">Kategori: <strong>${esc(guessedCat)}</strong></div>
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-top:6px;">
            <button class="btn-act btn-primary-action btn-sm" onclick="registerToolOnly('${esc(formattedName)}', '${esc(guessedCat)}', '${uploadedPhotoUrl}')">
              + Simpan ke Inventaris
            </button>
          </div>
        </div>
      `);
      return;
    }

    // 1. Intent: Siapa Pengembang / Info Akademik
    if (query.includes('pengembang') || query.includes('developer') || query.includes('liana') || query.includes('iteba') || query.includes('dosen') || query.includes('caniago') || query.includes('nim') || query.includes('kampus')) {
      appendBotChat(`
        <strong>Informasi Pengembang Sistem:</strong><br>
        Aplikasi <strong>GudangLingling AI</strong> dikembangkan sebagai tugas proyek sistem pakar:<br>
        <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;margin-top:6px;font-size:12px;line-height:1.5;">
          <strong>Nama:</strong> Liana Sry Astuti<br>
          <strong>NIM:</strong> 2422031<br>
          <strong>Program Studi:</strong> Teknik Komputer<br>
          <strong>Institusi:</strong> Institut Teknologi Batam (ITEBA)<br>
          <strong>Dosen Pengampu:</strong> Bapak Deosa Putra Caniago, M.Kom<br>
          <strong>Modul AI:</strong> State-Space (3.2), Forward Chaining &amp; CF (6.7), Heuristic Risk Triase (4.5)
        </div>
      `);
      return;
    }

    // 2. Intent: Aturan Pinjam / Durasi / Biaya / Rusak
    if (query.includes('aturan') || query.includes('durasi') || query.includes('berapa hari') || query.includes('berapa lama') || query.includes('syarat') || query.includes('rusak') || query.includes('biaya') || query.includes('gratis') || query.includes('denda')) {
      appendBotChat(`
        <strong>Panduan &amp; Aturan Peminjaman Warga:</strong>
        <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;padding:10px;margin-top:6px;font-size:12px;line-height:1.5;">
          <strong>1. Biaya:</strong> 100% Gratis untuk seluruh warga tetangga.<br>
          <strong>2. Durasi Standar:</strong> 1 sampai 3 hari (dapat disesuaikan hingga beberapa hari jika ada pekerjaan bertahap).<br>
          <strong>3. Kondisi Rusak:</strong> Jika alat bermasalah/mati mendadak, jangan dibongkar sendiri. Laporkan saat pengembalian agar otomatis masuk karantina servis.<br>
          <strong>4. Bukti Foto:</strong> Ambil 1 foto kondisi fisik alat saat pinjam demi transparansi kondisi awal dan akhir.
        </div>
      `);
      return;
    }

    // 3. Intent: 3 Zona Triase Risiko AI
    if (query.includes('zona') || query.includes('triase') || query.includes('forward chaining') || query.includes('certainty factor') || query.includes('heuristik') || query.includes('cara kerja ai') || query.includes('sistem pakar')) {
      appendBotChat(`
        <strong>3 Zona Triase Keputusan AI:</strong>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">
          <div style="background:var(--green-bg);border:1px solid var(--green-border);padding:8px 10px;border-radius:6px;font-size:11.5px;">
            <strong style="color:var(--green-text);">ZONA HIJAU (Skor h(S) &lt; 30)</strong><br>
            Alat dalam kondisi prima dan terawat. Langsung disetujui untuk dipinjam.
          </div>
          <div style="background:var(--yellow-bg);border:1px solid var(--yellow-border);padding:8px 10px;border-radius:6px;font-size:11.5px;">
            <strong style="color:var(--yellow-text);">ZONA KUNING (Skor 30 &ndash; 69)</strong><br>
            Peminjaman bersyarat. Wajib menggunakan APD (kacamata / sarung tangan).
          </div>
          <div style="background:var(--red-bg);border:1px solid var(--red-border);padding:8px 10px;border-radius:6px;font-size:11.5px;">
            <strong style="color:var(--red-text);">ZONA MERAH (Skor &ge; 70)</strong><br>
            Bahaya fatal terdeteksi (kabel sobek/bodi nyetrum). Ditolak &amp; terkunci otomatis.
          </div>
        </div>
      `);
      return;
    }

    // 4. Intent: Tambah Alat Baru
    if (query.includes('tambah') || query.includes('input alat') || query.includes('masukkan alat') || query.includes('daftar alat baru')) {
      appendBotChat(`
        Ingin mencatat perkakas baru ke dalam inventaris gudang?<br>
        Klik tombol di bawah untuk membuka formulir pencatatan lengkap dengan foto:
        <div style="margin-top:8px;">
          <button class="btn-act btn-primary-action btn-sm" onclick="closeChatDrawer(); openAddItemModal();">
            + Buka Form Tambah Alat
          </button>
        </div>
      `);
      return;
    }

    // 5. Intent: Cek Alat Ready / Kueri Alat Spesifik
    const matches = (state.items || []).filter(it => {
      const name = it.name.toLowerCase();
      const cat = (it.category || '').toLowerCase();
      const desc = (it.description || '').toLowerCase();
      if (query.includes('ready') || query.includes('tersedia') || query.includes('ada apa') || query.includes('semua alat')) {
        return it.status === 'AVAILABLE';
      }
      return query.split(' ').some(word => word.length >= 3 && (name.includes(word) || cat.includes(word) || desc.includes(word)));
    });

    if (matches.length > 0) {
      const cardsHtml = matches.slice(0, 4).map(it => {
        const isReady = it.status === 'AVAILABLE';
        const badgeColor = isReady ? 'var(--green-text)' : 'var(--yellow-text)';
        const statusTxt = isReady ? 'Ready' : (it.status === 'BORROWED' ? 'Dipinjam' : 'Lockout');
        const photo = it.last_photo_url || '/img/bor.svg';
        const actionBtn = isReady
          ? `<button class="chat-tool-btn" onclick="closeChatDrawer(); openBorrowWizard(${it.id});">Pinjam</button>`
          : `<span style="font-size:10.5px;color:var(--text-muted);font-weight:600;">${statusTxt}</span>`;

        return `
          <div class="chat-tool-card">
            <img class="chat-tool-thumb" src="${photo}" alt="${esc(it.name)}" onerror="this.onerror=null; this.src='/img/bor.svg';">
            <div class="chat-tool-info">
              <div class="chat-tool-name">${esc(it.name)}</div>
              <div class="chat-tool-sub">${esc(it.category)} &bull; <strong style="color:${badgeColor};">${statusTxt}</strong></div>
            </div>
            ${actionBtn}
          </div>
        `;
      }).join('');

      appendBotChat(`
        Ditemukan <strong>${matches.length} peralatan</strong> yang sesuai:<br>
        ${cardsHtml}
      `);
      return;
    }

    // 6. Intent: Salam / Sapaan Ramah
    if (query.includes('halo') || query.includes('hai') || query.includes('hi') || query.includes('selamat') || query.includes('pagi') || query.includes('siang') || query.includes('malam') || query.includes('assalamu')) {
      appendBotChat(`
        Halo! Ada yang bisa saya bantu terkait peralatan gudang warga hari ini?<br>
        Kamu bisa langsung ketik nama perkakas yang ingin dicari (misal: <em>"bor"</em>, <em>"gerinda"</em>, atau <em>"tangga"</em>), atau klik salah satu topik di bawah.
      `);
      return;
    }

    // 7. Fallback Cerdas
    appendBotChat(`
      Saya siap membantu Anda. Untuk mempermudah, Anda dapat:<br>
      <div style="display:flex;flex-direction:column;gap:5px;margin-top:6px;">
        <button class="chat-quick-btn" onclick="sendSuggestedQuery('Alat apa saja yang sedang ready?')">
          <span>&bull;</span> Cek Alat yang Ready Dipinjam
        </button>
        <button class="chat-quick-btn" onclick="sendSuggestedQuery('Bagaimana aturan dan durasi pinjam?')">
          <span>&bull;</span> Lihat Aturan &amp; Durasi Pinjam
        </button>
        <button class="chat-quick-btn" onclick="sendSuggestedQuery('Jelaskan 3 Zona Triase Risiko AI')">
          <span>&bull;</span> Pelajari Triase Risiko AI
        </button>
      </div>
    `);
  }, 350);
}

function handleChatQuickAction(action) {
  if (action === 'add_item') {
    closeChatDrawer();
    openAddItemModal();
  } else if (action === 'borrow_tool') {
    const available = (state.items || []).filter(it => it.status === 'AVAILABLE');
    if (!state.items.length) {
      appendBotChat(`
        Belum ada peralatan di inventaris gudang.<br>
        Silakan tambahkan perkakas terlebih dahulu:
        <div style="margin-top:8px;">
          <button class="btn-act btn-primary-action btn-sm" onclick="closeChatDrawer(); openAddItemModal();">+ Tambah Alat Sekarang</button>
        </div>
      `);
    } else if (!available.length) {
      appendBotChat('Saat ini semua perkakas sedang dipinjam atau dalam perbaikan.');
    } else {
      const toolBtns = available.map(t => `
        <div class="chat-tool-card" style="margin-top:5px;">
          <img class="chat-tool-thumb" src="${t.last_photo_url || '/img/bor.svg'}" alt="${esc(t.name)}" onerror="this.onerror=null; this.src='/img/bor.svg';">
          <div class="chat-tool-info">
            <div class="chat-tool-name">${esc(t.name)}</div>
            <div class="chat-tool-sub">${esc(t.category)} &bull; ${t.power_watts ? t.power_watts + 'W' : 'Non-Listrik'}</div>
          </div>
          <button class="chat-tool-btn" onclick="closeChatDrawer(); openBorrowWizard(${t.id});">Pinjam</button>
        </div>
      `).join('');
      appendBotChat(`
        Pilih alat untuk membuka <strong>Formulir Pinjam Cepat (Smart Wizard 3 Langkah)</strong>:
        <div style="margin-top:6px;">${toolBtns}</div>
      `);
    }
  } else if (action === 'check_ready') {
    sendSuggestedQuery('Alat apa saja yang sedang ready?');
  }
}

// State S1: Item Selection & Camera Photo Capture
function showItemAndPhotoStep() {
  const optionsHtml = state.items.map(it => {
    const disabled = it.status !== 'AVAILABLE' ? 'disabled' : '';
    const selected = (state.selectedItem && state.selectedItem.id === it.id) ? 'selected' : '';
    return `<option value="${it.id}" ${disabled} ${selected}>${esc(it.name)} (${it.status})</option>`;
  }).join('');

  appendBotChat(`
    <strong>Langkah 1: Alat & Bukti Foto Kondisi Fisik</strong><br>
    Pilih alat dan ambil 1 foto kondisi fisik alat saat ini via kamera HP:
    <div class="chat-card">
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div>
          <label class="form-label">Peralatan</label>
          <select id="chat-sel-item" class="form-select">${optionsHtml}</select>
        </div>
        <div>
          <label class="form-label">Nama Peminjam</label>
          <input type="text" id="chat-in-name" class="form-input" placeholder="Nama" value="${esc(state.borrowerName)}">
        </div>
        <div>
          <label class="form-label">No. WhatsApp</label>
          <input type="tel" id="chat-in-phone" class="form-input" placeholder="08123..." value="${esc(state.borrowerPhone)}">
        </div>
        <div>
          <label class="form-label">Ambil Foto Alat (Kamera HP)</label>
          <input type="file" id="chat-camera-input" accept="image/*" capture="environment" class="form-input" style="padding-top:6px;">
          <div id="photo-preview-wrap" style="display:none;margin-top:6px;">
            <img id="chat-photo-preview" src="" style="width:100%;height:120px;object-fit:cover;border-radius:4px;border:1px solid var(--border-subtle);">
          </div>
        </div>
        <button class="btn-act btn-primary-action" onclick="submitItemAndPhoto()">Lanjut Pemeriksaan Cepat</button>
      </div>
    </div>
  `);

  document.getElementById('chat-camera-input').addEventListener('change', handleCameraUpload);
}

function handleCameraUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(evt) {
    const base64Data = evt.target.result;
    const previewWrap = document.getElementById('photo-preview-wrap');
    const previewImg = document.getElementById('chat-photo-preview');
    if (previewImg && previewWrap) {
      previewImg.src = base64Data;
      previewWrap.style.display = 'block';
    }

    // Unggah ke backend
    try {
      const res = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: base64Data })
      });
      const data = await res.json();
      if (data.success) {
        state.currentPhotoUrl = data.url;
      }
    } catch (err) {
      console.error('Upload photo error:', err);
    }
  };
  reader.readAsDataURL(file);
}

function submitItemAndPhoto() {
  const itemId = parseInt(document.getElementById('chat-sel-item').value);
  state.selectedItem = state.items.find(i => i.id === itemId);
  state.borrowerName = document.getElementById('chat-in-name').value.trim() || 'Peminjam';
  state.borrowerPhone = document.getElementById('chat-in-phone').value.trim();
  state.collectedFacts = {};

  appendUserChat(`Pinjam ${state.selectedItem.name} untuk ${state.borrowerName}`);
  showPhysicalCheckStep();
}

// State S2: Pengecekan Fisik Alat (F01 - F12)
function showPhysicalCheckStep() {
  appendBotChat(`
    <strong>Pemeriksaan Fisik: ${esc(state.selectedItem.name)}</strong><br>
    Apakah Anda melihat indikasi kerusakan atau komponen aus?
    <div class="chat-card">
      <div style="display:flex;flex-direction:column;gap:6px;" id="drawer-step1-btns">
        <button class="btn-act btn-primary-action" onclick="choosePhysical('NORMAL')">Kondisi Fisik Normal & Bagus (Siap Pakai)</button>
        <button class="btn-act btn-subtle-action" onclick="choosePhysical('ISSUES')">Ada Bagian Rusak / Red Flag</button>
      </div>
      <div id="drawer-physical-issues" style="display:none;margin-top:8px;">
        <div style="font-size:11.5px;color:var(--text-secondary);margin-bottom:6px;">Centang gejala yang terlihat:</div>
        <div style="display:flex;flex-direction:column;gap:5px;max-height:160px;overflow-y:auto;font-size:12px;">
          <label><input type="checkbox" value="F01"> F01: Kabel daya terkelupas / rapuh</label>
          <label><input type="checkbox" value="F04"> F04: Bodi nyetrum / induksi listrik</label>
          <label><input type="checkbox" value="F03"> F03: Dinamo percikan api / bau sangit</label>
          <label><input type="checkbox" value="F02"> F02: Steker goyang / gosong terbakar</label>
          <label><input type="checkbox" value="F06"> F06: Piringan gerinda retak sumbing</label>
          <label><input type="checkbox" value="F05"> F05: Mata pisau / bor aus tumpul</label>
          <label><input type="checkbox" value="F07"> F07: Baut pengunci bilah kendor</label>
          <label><input type="checkbox" value="F08"> F08: Pelindung keselamatan dilepas</label>
          <label><input type="checkbox" value="F09"> F09: Engsel tangga goyang / aus</label>
          <label><input type="checkbox" value="F10"> F10: Suara bearing berdecit kasar</label>
        </div>
        <button class="btn-act btn-primary-action btn-sm" style="margin-top:8px;" onclick="submitPhysicalIssues()">Lanjut ke Profil Peminjam</button>
      </div>
    </div>
  `);
}

function choosePhysical(choice) {
  if (choice === 'NORMAL') {
    appendUserChat('Kondisi fisik: Normal');
    showBorrowerProfileStep();
  } else {
    document.getElementById('drawer-step1-btns').style.display = 'none';
    document.getElementById('drawer-physical-issues').style.display = 'block';
    scrollChatDown();
  }
}

function submitPhysicalIssues() {
  const checked = document.querySelectorAll('#drawer-physical-issues input[type="checkbox"]:checked');
  const codes = [];
  checked.forEach(c => {
    state.collectedFacts[c.value] = 0.8;
    codes.push(c.value);
  });
  appendUserChat(codes.length ? `Gejala fisik terdeteksi: ${codes.join(', ')}` : 'Semua fisik normal');
  showBorrowerProfileStep();
}

// State S3: Profil Peminjam & APD (F13 - F20)
function showBorrowerProfileStep() {
  appendBotChat(`
    <strong>Pemeriksaan Profil Peminjam & APD</strong><br>
    Bagaimana kesiapan dan pengalaman ${esc(state.borrowerName)}?
    <div class="chat-card">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button class="btn-act btn-primary-action btn-sm" onclick="chooseBorrower('EXPERIENCED')">Berpengalaman & Memakai APD Lengkap</button>
        <button class="btn-act btn-subtle-action btn-sm" onclick="chooseBorrower('BEGINNER')">Pemula (Belum Pernah Pakai)</button>
        <button class="btn-act btn-subtle-action btn-sm" onclick="chooseBorrower('NO_PPE')">Tidak Memiliki APD Dasar</button>
        <button class="btn-act btn-subtle-action btn-sm" onclick="chooseBorrower('UNDERAGE')">Anak di Bawah Umur</button>
      </div>
    </div>
  `);
}

function chooseBorrower(type) {
  if (type === 'EXPERIENCED') {
    appendUserChat('Berpengalaman & ada APD');
  } else if (type === 'BEGINNER') {
    state.collectedFacts['F13'] = 0.8;
    appendUserChat('Peminjam pemula');
  } else if (type === 'NO_PPE') {
    state.collectedFacts['F14'] = 0.8;
    appendUserChat('Tanpa APD');
  } else if (type === 'UNDERAGE') {
    state.collectedFacts['F17'] = 1.0;
    appendUserChat('Di bawah umur');
  }

  showEnvironmentStep();
}

function showEnvironmentStep() {
  appendBotChat(`
    <strong>Pemeriksaan Area & Beban Kerja</strong><br>
    Di mana dan untuk apa alat ini digunakan?
    <div class="chat-card">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button class="btn-act btn-primary-action btn-sm" onclick="finishEvaluation('STANDARD')">Pekerjaan Standar (Area Kering)</button>
        <button class="btn-act btn-subtle-action btn-sm" onclick="finishEvaluation('LIGHT')">Tugas Mikro / Pasang Pigura Saja</button>
        <button class="btn-act btn-subtle-action btn-sm" onclick="finishEvaluation('WET')">Di Luar Ruangan / Area Basah</button>
        <button class="btn-act btn-subtle-action btn-sm" onclick="finishEvaluation('HEIGHT')">Di Ketinggian > 3 Meter</button>
      </div>
    </div>
  `);
}

async function finishEvaluation(envType) {
  if (envType === 'STANDARD') appendUserChat('Area standar kering');
  else if (envType === 'LIGHT') {
    state.collectedFacts['F20'] = 1.0;
    appendUserChat('Pekerjaan mikro / estetika');
  } else if (envType === 'WET') {
    state.collectedFacts['F15'] = 0.8;
    appendUserChat('Area basah / lembab');
  } else if (envType === 'HEIGHT') {
    state.collectedFacts['F19'] = 0.8;
    appendUserChat('Ketinggian > 3 meter');
  }

  appendBotChat('<em>Menjalankan Forward Chaining, kalkulasi Certainty Factor, dan Heuristik Risiko...</em>');

  try {
    const res = await fetch('/api/chat/quick-assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: state.sessionId,
        item_id: state.selectedItem.id,
        borrower_name: state.borrowerName,
        borrower_phone: state.borrowerPhone,
        days: state.days,
        facts: state.collectedFacts,
        photo_url: state.currentPhotoUrl
      })
    });
    const data = await res.json();

    if (data.finished && data.result) {
      renderChatResultCard(data.result);
    }
  } catch (err) {
    appendBotChat('Gagal memproses evaluasi AI.');
  }
}

// State G: Kartu Keputusan AI & Integrasi WhatsApp
function renderChatResultCard(result) {
  state.lastResult = result;
  const h = result.heuristic_evaluation;
  const dec = result.primary_decision;
  const zone = h.zone.toLowerCase();

  const zoneBadgeClass = h.zone;
  const actionButton = (h.zone === 'RED')
    ? `<button class="btn-act btn-danger-action btn-sm" onclick="confirmChatTransaction('LOCKOUT')">Kunci Alat (Maintenance Lockout)</button>`
    : `<button class="btn-act btn-primary-action btn-sm" onclick="confirmChatTransaction('BORROW')">Simpan Transaksi Peminjaman</button>`;

  appendBotChat(`
    <div style="background:var(--bg-surface);border:1px solid ${h.badge_color};border-radius:8px;padding:12px;margin-top:6px;">
      <span class="asset-badge ${zoneBadgeClass}" style="position:static;display:inline-block;margin-bottom:6px;">${h.zone_label}</span>
      <div style="font-size:13.5px;font-weight:700;color:var(--text-primary);">${esc(dec ? dec.name : 'Layak Pakai Optimal')}</div>
      <div style="font-size:11.5px;color:var(--text-secondary);margin:4px 0;">${esc(dec ? dec.description : '')}</div>

      <div style="display:flex;gap:8px;margin:8px 0;">
        <div style="flex:1;background:var(--bg-app);padding:6px;border-radius:4px;text-align:center;">
          <div style="font-size:9.5px;color:var(--text-muted);">Keyakinan CF</div>
          <div style="font-weight:800;font-size:15px;color:#60a5fa;">${dec ? dec.percentage : 95}%</div>
        </div>
        <div style="flex:1;background:var(--bg-app);padding:6px;border-radius:4px;text-align:center;">
          <div style="font-size:9.5px;color:var(--text-muted);">Skor Risiko h(S)</div>
          <div style="font-weight:800;font-size:15px;color:${h.badge_color};">${h.heuristic_score}/100</div>
        </div>
      </div>

      <div style="font-size:11.5px;background:var(--bg-app);padding:8px;border-radius:4px;margin-bottom:10px;border-left:3px solid ${h.badge_color};">
        <strong>Panduan:</strong> ${esc(h.safety_advice)}
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;">
        ${actionButton}
        <a href="${result.whatsapp.direct_url}" target="_blank" class="btn-act btn-whatsapp-action btn-sm">Kirim Bukti ke WhatsApp</a>
      </div>
    </div>
  `);
}

async function confirmChatTransaction() {
  try {
    const res = await fetch('/api/borrow/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: state.sessionId })
    });
    const data = await res.json();

    if (res.ok) {
      appendBotChat(`
        <strong>Transaksi Berhasil Dicatat!</strong><br>
        Status inventaris alat telah diperbarui menjadi <strong>${data.record_status}</strong>. Riwayat peminjaman tersimpan di menu Beranda & Message.
      `);
      // Refresh Beranda & Message data
      await loadAllData();
    }
  } catch (err) {
    showToast('Gagal menyimpan transaksi.', 'warn');
  }
}

// ============================================================
// 8. SIDE-BY-SIDE RETURN PHOTO CHECK MODAL
// ============================================================
function openReturnModalByItemId(itemId) {
  const record = state.reminders.find(r => r.item_id === itemId);
  if (record) {
    openReturnModalByRecordId(record.id);
  } else {
    showToast('Tidak ditemukan data peminjaman aktif untuk alat ini.', 'warn');
  }
}

function openReturnModalByRecordId(recordId) {
  state.activeRecordToReturn = recordId;
  state.returnPhotoUrl = '';
  const record = state.reminders.find(r => r.id === recordId);
  const initialImgEl = document.getElementById('comp-initial-img');
  const returnImgEl = document.getElementById('comp-return-img');
  const confirmBtn = document.getElementById('btn-confirm-return');

  const photo = (record && record.initial_photo_url) ? record.initial_photo_url : '/img/bor.svg';
  initialImgEl.src = photo;
  returnImgEl.src = photo; // default placeholder

  if (confirmBtn) {
    confirmBtn.textContent = 'Ambil Foto Kondisi Akhir Dulu (*Wajib)';
  }

  document.getElementById('return-modal-subtitle').textContent = record
    ? `Peminjam: ${record.borrower_name} • Alat: ${record.item_name}`
    : 'Bandingkan foto kondisi saat dipinjam dengan foto kondisi pengembalian saat ini:';

  modalReturnCheck.classList.add('open');

  const cameraInput = document.getElementById('return-camera-input');
  cameraInput.value = '';
  cameraInput.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Mengunggah Foto...';
    }

    const reader = new FileReader();
    reader.onload = async function(evt) {
      const b64 = evt.target.result;
      returnImgEl.src = b64;

      try {
        const res = await fetch('/api/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_data: b64 })
        });
        const data = await res.json();
        if (data.success && data.url) {
          state.returnPhotoUrl = data.url;
          if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Verifikasi & Selesaikan Pengembalian';
          }
          showToast('Foto kondisi akhir siap dibandingkan!', 'success');
        }
      } catch (err) {
        console.error('Error return photo upload:', err);
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Verifikasi & Selesaikan Pengembalian';
        }
      }
    };
    reader.readAsDataURL(file);
  };

  if (confirmBtn) confirmBtn.onclick = submitReturnCheck;
}

function closeReturnModal() {
  modalReturnCheck.classList.remove('open');
  state.activeRecordToReturn = null;
  state.returnPhotoUrl = '';
}

async function submitReturnCheck() {
  if (!state.activeRecordToReturn) return;
  if (!state.returnPhotoUrl) {
    showToast('Foto kondisi akhir alat wajib diunggah sebagai bukti perbandingan Sebelum vs Sesudah.', 'warn', 4000);
    const camInput = document.getElementById('return-camera-input');
    if (camInput) camInput.focus();
    return;
  }

  try {
    const res = await fetch('/api/borrow/return-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        record_id: state.activeRecordToReturn,
        return_photo_url: state.returnPhotoUrl
      })
    });
    const data = await res.json();

    if (res.ok) {
      showToast('Pengembalian berhasil diverifikasi! Foto akhir tersimpan.', 'success');
      closeReturnModal();
      await loadAllData();
    } else {
      showToast(data.error || 'Gagal menyelesaikan pengembalian.', 'warn');
    }
  } catch (err) {
    showToast('Koneksi server gagal.', 'warn');
  }
}
