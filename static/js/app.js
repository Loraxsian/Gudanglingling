/**
 * GudangLingling AI — 3-Menu Architecture & Draggable Floating Chatbot
 * Pengembang: Liana Sry Astuti (NIM: 2422031) - Teknik Komputer ITEBA
 * Dosen Pengampu: Bapak Deosa Putra Caniago, M.Kom
 */

const state = {
  sessionId: null,
  isAuthenticated: false,
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
  updateDynamicGreeting();
  updateHeaderStatus();
  loadAllData();
  startChatSession();
});

// ============================================================
// 0. THEME CONTROLLER (Light / Dark)
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
  if (theme === 'light') {
    if (iconEl) iconEl.innerHTML = '&#9790;'; // Moon
    if (labelEl) labelEl.textContent = 'Dark';
  } else {
    if (iconEl) iconEl.innerHTML = '&#9788;'; // Sun
    if (labelEl) labelEl.textContent = 'Light';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'light' ? 'dark' : 'light');
}

// ============================================================
// 1. NAVIGATION & DYNAMIC GREETING
// ============================================================
function updateDynamicGreeting() {
  const hour = new Date().getHours();
  let timeTag = 'Gudang Utama RT';
  let title = 'Halo Andrian • Gudang Utama RT';
  let sub = 'Sistem inventaris & peminjaman perkakas warga mandiri. Cek fisik alat sebelum serah terima.';

  if (hour >= 11 && hour < 15) {
    timeTag = 'Shift Siang • Operasional';
    title = 'Halo Andrian • Gudang Utama RT';
    sub = 'Shift siang aktif. Pantau perkakas yang sedang digunakan di lapangan dan cek kelayakan fisik.';
  } else if (hour >= 15 && hour < 18) {
    timeTag = 'Shift Sore • Pengembalian';
    title = 'Halo Andrian • Gudang Utama RT';
    sub = 'Waktu pengecekan pengembalian alat warga. Pastikan kabel rapi dan perkakas kembali bersih.';
  } else if (hour >= 18 || hour < 4) {
    timeTag = 'Standby Malam • Inventaris Terkunci';
    title = 'Halo Andrian • Gudang Utama RT';
    sub = 'Peralatan tersimpan rapi di rak inventaris. Log peminjaman dan rekam triase risiko aktif.';
  } else {
    timeTag = 'Shift Pagi • Kesiapan Alat';
    title = 'Halo Andrian • Gudang Utama RT';
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
  let borrowedCount = 0;
  let lockedCount = 0;

  (state.items || []).forEach(it => {
    if (it.status === 'BORROWED') borrowedCount++;
    else if (it.status === 'MAINTENANCE_LOCKED') lockedCount++;
  });

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
  state.selectedItem = state.items.find(i => i.id === itemId);
  openChatDrawer();

  if (!state.isAuthenticated) {
    // Selesaikan auth dulu
    startChatSession();
  } else {
    // Langsung buka form peminjaman dengan alat terpilih
    showItemAndPhotoStep();
  }
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

    // --- Health / Risk Gauge ---
    const dangerMap = { 'SANGAT TINGGI': 'red', 'TINGGI': 'yellow', 'SEDANG': 'yellow', 'RENDAH': 'green' };
    const healthColor = dangerMap[it.danger_level] || 'green';
    const healthLabel = it.danger_level === 'SANGAT TINGGI' ? 'Risiko Sangat Tinggi'
                      : it.danger_level === 'TINGGI' ? 'Risiko Tinggi'
                      : it.danger_level === 'SEDANG' ? 'Risiko Sedang'
                      : 'Risiko Rendah';

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
        <div class="asset-health-bar">
          <div class="health-label">
            <span>Kelayakan Teknis</span>
          </div>
          <div class="health-gauge">
            <div class="health-fill ${healthColor}"></div>
          </div>
          <span style="font-size:10.5px;font-weight:700;color:${healthColor === 'red' ? 'var(--red-text)' : healthColor === 'yellow' ? 'var(--yellow-text)' : 'var(--green-text)'};">${healthLabel.split(' ').pop()}</span>
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
  if (customInput) customInput.value = '';
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
    if (daysEl.value === 'custom') {
      const customVal = parseInt(document.getElementById('wizard-custom-days-input').value || '0', 10);
      if (!customVal || customVal < 1) {
        showToast('Masukkan jumlah hari peminjaman yang valid (minimal 1 hari).', 'warn');
        document.getElementById('wizard-custom-days-input').focus();
        return;
      }
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
    reminderContainer.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">Tidak ada antrean pengembalian aktif saat ini. Semua alat aman di gudang.</div>`;
  } else {
    state.reminders.forEach(r => {
      const daysLeft = r.borrow_days - (r.days_elapsed || 0);
      let statusTag = '';
      if (daysLeft < 0) {
        statusTag = `<span class="reminder-time-tag overdue">Terlambat ${Math.abs(daysLeft)} Hari</span>`;
      } else if (daysLeft === 0) {
        statusTag = `<span class="reminder-time-tag due">Jatuh Tempo Hari Ini</span>`;
      } else {
        statusTag = `<span class="reminder-time-tag due">Sisa ${daysLeft} Hari</span>`;
      }

      const waMsg = encodeURIComponent(
        `Halo ${r.borrower_name}, ini pengingat ramah dari GudangLingling mengenai peminjaman alat *${r.item_name}* (Durasi: ${r.borrow_days} hari). Mohon informasikan jika sudah selesai digunakan. Terima kasih!`
      );
      const cleanPhone = (r.borrower_phone || '').replace(/[^0-9]/g, '');
      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waMsg}` : `https://wa.me/?text=${waMsg}`;

      const tile = document.createElement('div');
      tile.className = 'reminder-tile';
      tile.innerHTML = `
        <div class="reminder-tile-top">
          <div>
            <strong style="font-size:13px;color:var(--text-primary);">${esc(r.item_name)}</strong>
            <div style="font-size:11.5px;color:var(--text-secondary);margin-top:2px;">
              Peminjam: <strong>${esc(r.borrower_name)}</strong> (${r.borrower_phone || 'Tanpa No. WA'})
            </div>
          </div>
          ${statusTag}
        </div>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <a href="${waUrl}" target="_blank" class="btn-act btn-whatsapp-action btn-sm">Kirim Pengingat WA</a>
          <button class="btn-act btn-subtle-action btn-sm" onclick="openReturnModalByRecordId(${r.id})">Cek Pengembalian</button>
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
        <td colspan="4" style="text-align:center;color:var(--text-muted);padding:18px 14px;line-height:1.6;">
          Belum ada riwayat peminjaman yang dicatat.<br>
          <span style="font-size:11.5px;color:var(--text-secondary);">Arsip bukti digital akan otomatis muncul di sini saat alat mulai dipinjam.</span>
        </td>
      </tr>`;
  } else {
    state.emailLogs.forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${(log.created_at || '').substring(0, 16)}</td>
        <td>${esc(log.borrower_name || 'Keluarga')}</td>
        <td>${esc(log.subject)}</td>
        <td><span style="font-weight:700;color:var(--green-text);">${esc(log.status)}</span></td>
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
// 7. DRAGGABLE CHATBOT WORKFLOW (State-Space S0 -> G)
// ============================================================
function appendBotChat(html) {
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

function appendUserChat(text) {
  const row = document.createElement('div');
  row.className = 'chat-row user';
  row.innerHTML = `
    <div class="bubble bubble-user">
      <div>${esc(text)}</div>
      <div class="bubble-meta">${getTime()}</div>
    </div>
  `;
  chatDrawerBody.appendChild(row);
  scrollChatDown();
}

function scrollChatDown() {
  setTimeout(() => {
    chatDrawerBody.scrollTop = chatDrawerBody.scrollHeight;
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

// State S0: PIN Auth
function startChatSession() {
  appendBotChat(`
    <strong>Halo! Asisten GudangLingling siap memandu.</strong><br>
    Masukkan PIN keamanan keluarga untuk akses sistem (Default: <code>1234</code>):
    <div class="chat-card">
      <div style="display:flex;gap:6px;">
        <input type="password" id="drawer-pin-field" class="form-input" maxlength="7" placeholder="••••" value="1234">
        <button class="btn-act btn-primary-action" style="width:80px;" onclick="verifyDrawerPin()">Buka</button>
      </div>
      <div id="drawer-pin-err" style="color:var(--red-text);font-size:11px;margin-top:4px;display:none;">PIN salah! Gunakan PIN default: 1234 (atau 2422031).</div>
    </div>
  `);
}

async function verifyDrawerPin() {
  const pin = document.getElementById('drawer-pin-field').value.trim();
  const errEl = document.getElementById('drawer-pin-err');

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      state.sessionId = data.session_id;
      state.isAuthenticated = true;
      appendUserChat('PIN Terverifikasi');

      if (state.selectedItem) {
        showItemAndPhotoStep();
      } else {
        showDynamicWelcomeAndQuickReplies();
      }
    } else {
      errEl.style.display = 'block';
    }
  } catch (err) {
    showToast('Koneksi server gagal. Periksa PIN dan coba lagi.', 'warn');
  }
}

// Dynamic Welcome & Quick Reply Chips
function showDynamicWelcomeAndQuickReplies() {
  const totalItems = state.items.length;
  const availableItems = state.items.filter(it => it.status === 'AVAILABLE').length;
  const borrowedItems = state.items.filter(it => it.status === 'BORROWED').length;

  let greetingText = '';
  if (totalItems === 0) {
    greetingText = `<strong>PIN Benar! Halo, selamat datang di GudangLingling AI.</strong><br>Saat ini gudang masih bersih dan belum ada perkakas yang tercatat. Ada yang bisa saya bantu?`;
  } else {
    greetingText = `<strong>PIN Benar! Halo, selamat datang di GudangLingling AI.</strong><br>Saat ini terdapat <strong>${availableItems} alat tersedia</strong>${borrowedItems > 0 ? ` dan <strong>${borrowedItems} alat sedang dipinjam</strong>` : ' di gudang'}. Ada yang bisa saya bantu?`;
  }

  appendBotChat(`
    ${greetingText}
    <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
      <button class="chat-quick-btn" onclick="handleChatQuickAction('add_item')">
        <span style="font-size:14px;color:var(--primary);font-weight:bold;">+</span>
        <span>Tambah Alat Baru ke Inventaris</span>
      </button>
      <button class="chat-quick-btn" onclick="handleChatQuickAction('borrow_tool')">
        <span style="font-size:12px;color:var(--green-text);">&#9658;</span>
        <span>Pinjam Alat & Triase Risiko AI</span>
      </button>
      <button class="chat-quick-btn" onclick="handleChatQuickAction('check_borrowers')">
        <span style="font-size:12px;color:var(--yellow-text);">&#9679;</span>
        <span>Cek Status & Antrean Peminjam</span>
      </button>
      <button class="chat-quick-btn" onclick="handleChatQuickAction('view_faq')">
        <span style="font-size:12px;color:#60a5fa;">?</span>
        <span>Cara Kerja Sistem Pakar AI</span>
      </button>
    </div>
  `);
}

function handleChatQuickAction(action) {
  if (action === 'add_item') {
    appendUserChat('Tambah Alat Baru');
    appendBotChat('Membuka formulir pencatatan alat baru ke inventaris gudang...');
    setTimeout(() => {
      closeChatDrawer();
      openAddItemModal();
    }, 400);
  } else if (action === 'borrow_tool') {
    appendUserChat('Pinjam Alat');
    const available = state.items.filter(it => it.status === 'AVAILABLE');
    if (!state.items.length) {
      appendBotChat(`
        Belum ada peralatan di inventaris gudang.<br>
        Silakan tambahkan alat terlebih dahulu sebelum memproses peminjaman:
        <div style="margin-top:8px;">
          <button class="btn-act btn-primary-action btn-sm" onclick="closeChatDrawer(); openAddItemModal();">+ Tambah Alat Sekarang</button>
        </div>
      `);
    } else if (!available.length) {
      appendBotChat('Saat ini semua perkakas sedang dipinjam atau dalam servis.');
    } else {
      const toolBtns = available.map(t => `
        <button class="btn-act btn-primary-action btn-sm" style="margin-top:5px;display:block;width:100%;text-align:left;" onclick="closeChatDrawer(); openBorrowWizard(${t.id});">
          Pinjam: ${esc(t.name)} (${esc(t.category)})
        </button>
      `).join('');
      appendBotChat(`
        Pilih alat yang ingin Anda pinjam untuk membuka <strong>Formulir Pinjam Cepat (Smart Wizard 3 Langkah)</strong>:
        <div style="margin-top:8px;">${toolBtns}</div>
      `);
    }
  } else if (action === 'check_borrowers') {
    appendUserChat('Cek Antrean Peminjam');
    const borrowed = state.items.filter(it => it.status === 'BORROWED');
    if (!borrowed.length) {
      appendBotChat('Saat ini tidak ada alat yang sedang dipinjam. Semua peralatan tersimpan aman di gudang!');
    } else {
      const listHtml = borrowed.map(b => `&bull; <strong>${esc(b.name)}</strong>: Dipinjam oleh <em>${esc(b.active_borrower || 'Keluarga')}</em>`).join('<br>');
      appendBotChat(`
        Daftar peminjaman aktif saat ini:<br>
        ${listHtml}
        <div style="margin-top:8px;">
          <button class="btn-act btn-subtle-action btn-sm" onclick="closeChatDrawer(); document.querySelector('[data-tab=message]').click();">Buka Menu Message</button>
        </div>
      `);
    }
  } else if (action === 'view_faq') {
    appendUserChat('Cara Kerja AI');
    appendBotChat(`
      <strong>Sistem Pakar GudangLingling AI</strong> menggabungkan 3 modul perkuliahan:
      <ol style="margin:6px 0 6px 18px;font-size:12px;line-height:1.5;">
        <li><strong>Modul 3.2 (State-Space S0 &rarr; G):</strong> Memandu alur percakapan & fakta lapangan.</li>
        <li><strong>Modul 6.7 (Forward Chaining & CF):</strong> Mesin inferensi kaidah rule pakar R01–R15 dengan Certainty Factor.</li>
        <li><strong>Modul 4.5 (Heuristic Risk Triase):</strong> Evaluasi 3 zona keselamatan (Hijau, Kuning, Merah).</li>
      </ol>
      <div style="margin-top:6px;">
        <button class="btn-act btn-subtle-action btn-sm" onclick="closeChatDrawer(); document.querySelector('[data-tab=faq]').click(); switchFaqSubTab('teknis');">Buka Dokumentasi Teknis di Menu FaQ</button>
      </div>
    `);
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
  const record = state.reminders.find(r => r.id === recordId);
  const initialImgEl = document.getElementById('comp-initial-img');
  const returnImgEl = document.getElementById('comp-return-img');

  const photo = (record && record.initial_photo_url) ? record.initial_photo_url : '/img/bor.svg';
  initialImgEl.src = photo;
  returnImgEl.src = photo; // default placeholder

  document.getElementById('return-modal-subtitle').textContent = record
    ? `Peminjam: ${record.borrower_name} • Alat: ${record.item_name}`
    : 'Bandingkan foto kondisi saat dipinjam dengan foto kondisi pengembalian saat ini:';

  modalReturnCheck.classList.add('open');

  const cameraInput = document.getElementById('return-camera-input');
  cameraInput.value = '';
  cameraInput.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;

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
        if (data.success) {
          state.returnPhotoUrl = data.url;
        }
      } catch (err) {
        console.error('Error return photo upload:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  document.getElementById('btn-confirm-return').onclick = submitReturnCheck;
}

function closeReturnModal() {
  modalReturnCheck.classList.remove('open');
  state.activeRecordToReturn = null;
  state.returnPhotoUrl = '';
}

async function submitReturnCheck() {
  if (!state.activeRecordToReturn) return;

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
      showToast('Pengembalian berhasil diverifikasi! Alat kembali tersedia di gudang.', 'success');
      closeReturnModal();
      await loadAllData();
    } else {
      showToast('Gagal menyelesaikan pengembalian.', 'warn');
    }
  } catch (err) {
    showToast('Koneksi server gagal.', 'warn');
  }
}
