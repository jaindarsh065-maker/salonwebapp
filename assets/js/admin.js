
const SUPABASE_URL = 'https://kouwlhuazgugzmrxpprf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdXdsaHVhemd1Z3ptcnhwcHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTcwNzcsImV4cCI6MjA4OTQ5MzA3N30.no3mpNpuiOVXeM9aN2UZn4d_OWj6r_2VR8OZ6bbSetM';

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
}

const ADMIN_HASH = '-1661697300';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allBookings = [];
let currentFilter = 'all';

// KALENDER STATE
let blockedSlots = [];
let adminCalDate = new Date();
let adminSelectedDateStr = null;
const ADMIN_SLOTS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// TOAST UI
function showAdminToast(msg) {
  const wrap = document.getElementById('adminToastWrap');
  const el = document.createElement('div');
  el.className = 'bg-[#1C1410] text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium transform transition-all translate-x-full opacity-0 flex items-center gap-2';
  el.innerHTML = `<span class="text-green-400">✓</span> ${msg}`;
  wrap.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.remove('translate-x-full', 'opacity-0');
  }));
  setTimeout(() => {
    el.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

function checkPassword() {
  const val = document.getElementById('passwordInput').value;
  if (simpleHash(val) === ADMIN_HASH) {
    sessionStorage.setItem('bg_admin', '1');
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    loadBookings();
    loadBlockedSlots();
    loadProcedures();
  } else {
    document.getElementById('loginError').classList.remove('hidden');
  }
}

function logout() {
  sessionStorage.removeItem('bg_admin');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('passwordInput').value = '';
}

if (sessionStorage.getItem('bg_admin') === '1') {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminPanel').classList.remove('hidden');
  loadBookings();
  loadBlockedSlots();
  loadProcedures();
}

async function loadBookings() {
  document.getElementById('loadingState').classList.remove('hidden');
  document.getElementById('bookingsTable').classList.add('hidden');
  document.getElementById('emptyState').classList.add('hidden');
  const { data, error } = await supabaseClient
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  allBookings = data || [];
  updateStats();
  renderTable();
  if(!document.getElementById('viewKalender').classList.contains('hidden')) {
    renderAdminCalendar();
    if(adminSelectedDateStr) renderAdminSlots(adminSelectedDateStr);
  }
}

// REAL-TIME
supabaseClient.channel('custom-all-channel')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
    loadBookings();
  })
  .subscribe();

// translations dictionary for JS dynamic inserts
const tDict = {
  total: { de: '{n} Buchungen gesamt', ru: 'Всего {n} записей', en: '{n} total bookings' },
  statusLabels: {
    pending: { de: 'Ausstehend', ru: 'Ожидает', en: 'Pending' },
    confirmed: { de: 'Bestätigt', ru: 'Подтверждена', en: 'Confirmed' },
    cancelled: { de: 'Storniert', ru: 'Отменена', en: 'Cancelled' },
    rescheduled: { de: 'Verschoben', ru: 'Перенесена', en: 'Rescheduled' },
  },
  btnConfirm: { de: '✓ Bestätigen', ru: '✓ Подтвердить', en: '✓ Confirm' },
  btnCancel: { de: '✗ Freigeben', ru: '✗ В свободные', en: '✗ Release' },
  btnEdit: { de: '✎ Bearbeiten', ru: '✎ Изменить', en: '✎ Edit' },
  btnRestore: { de: '↩ Wiederherstellen', ru: '↩ Вернуть', en: '↩ Restore' },
};

let currentAdminLang = localStorage.getItem('bg_lang') || 'de';

function setAdminLang(l) {
  currentAdminLang = l;
  localStorage.setItem('bg_lang', l);
  document.getElementById('adminLangHeader').value = l;
  
  // static text
  document.querySelectorAll('[data-de]').forEach(el => {
    if (el.hasAttribute(`data-${l}`)) {
      el.textContent = el.getAttribute(`data-${l}`);
    }
  });
  // placeholders
  document.querySelectorAll('[data-placeholder-de]').forEach(el => {
    if (el.hasAttribute(`data-placeholder-${l}`)) {
      el.placeholder = el.getAttribute(`data-placeholder-${l}`);
    }
  });
  
  updateStats();
  renderTable();
}

function updateStats() {
  document.getElementById('statPending').textContent = allBookings.filter(b => b.status === 'pending').length;
  document.getElementById('statConfirmed').textContent = allBookings.filter(b => b.status === 'confirmed').length;
  document.getElementById('statCancelled').textContent = allBookings.filter(b => b.status === 'cancelled').length;
  const reschEl = document.getElementById('statRescheduled');
  if(reschEl) reschEl.textContent = allBookings.filter(b => b.status === 'rescheduled').length;
  const countRaw = tDict.total[currentAdminLang].replace('{n}', allBookings.length);
  document.getElementById('totalCount').textContent = countRaw;
}

function filterStatus(status) {
  currentFilter = status;
  // Reset all pills to default
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('bg-[#1C1410]', 'text-white', 'bg-purple-600', 'text-purple-50');
    const isReschBtn = btn.id === 'filter-rescheduled';
    if(isReschBtn) {
      btn.classList.add('bg-white', 'text-purple-600');
    } else {
      btn.classList.add('bg-white', 'text-gray-600');
    }
  });
  const active = document.getElementById('filter-' + status);
  if(active) {
    if(status === 'rescheduled') {
      active.classList.remove('bg-white', 'text-purple-600');
      active.classList.add('bg-purple-600', 'text-purple-50');
    } else {
      active.classList.remove('bg-white', 'text-gray-600');
      active.classList.add('bg-[#1C1410]', 'text-white');
    }
  }
  renderTable();
}

function renderTable() {
  const dateFilter = document.getElementById('dateFilter').value;
  let filtered = allBookings;

  if (currentFilter !== 'all') {
    filtered = filtered.filter(b => b.status === currentFilter);
  }
  if (dateFilter) {
    filtered = filtered.filter(b => b.date === dateFilter);
  }

  document.getElementById('loadingState').classList.add('hidden');
  if (filtered.length === 0) {
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('bookingsTable').classList.add('hidden');
    const cardsEl = document.getElementById('bookingsCards');
    if (cardsEl) cardsEl.innerHTML = '';
    return;
  }
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('bookingsTable').classList.remove('hidden');
  
  const locDict = tDict.statusLabels;
  const locale = currentAdminLang === 'de' ? 'de-DE' : (currentAdminLang === 'ru' ? 'ru-RU' : 'en-US');

  // ── Desktop table rows ──────────────────────────────────
  document.getElementById('bookingsBody').innerHTML = filtered.map(b => {
    let dateStr = new Date(b.date).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    let createdStr = new Date(b.created_at).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const t = (b.time || '').substring(0,5);
    const badgeText = locDict[b.status]?.[currentAdminLang] || b.status;
    
    return `<tr class="group border-b border-gray-100 hover:bg-gray-50/80 transition-all duration-200">
      <td class="px-5 py-4">
        <div class="font-semibold text-sm text-gray-900">${b.name}</div>
        <div class="text-xs text-gray-400 mt-0.5"><a href="tel:${b.phone}" class="hover:text-[#C4826A] transition-colors">${b.phone}</a></div>
        <div class="text-xs text-gray-400"><a href="mailto:${b.email}" class="hover:text-[#C4826A] transition-colors">${b.email}</a></div>
        <div class="text-xs text-gray-300 mt-1">${createdStr}</div>
      </td>
      <td class="px-5 py-4">
        <div class="text-sm text-gray-800 font-medium whitespace-break-spaces">${b.service}</div>
        ${(b.notes || '').replace(/\[DUR=\d+\]\s*/, '') ? '<div class="text-xs text-gray-500 mt-1 italic border-l-2 border-gray-200 pl-2 whitespace-break-spaces">"' + b.notes.replace(/\[DUR=\d+\]\s*/, '') + '"</div>' : ''}
      </td>
      <td class="px-5 py-4">
        <div class="text-sm font-semibold text-gray-900">${dateStr}</div>
        <div class="text-sm text-[#C4826A] font-bold mt-0.5">${t}</div>
      </td>
      <td class="px-5 py-4">
        <span class="px-3 py-1 rounded-full text-xs font-semibold shadow-sm status-${b.status}">${badgeText}</span>
      </td>
      <td class="px-5 py-4">
        <div class="flex gap-2 flex-wrap items-center">
          ${b.status !== 'confirmed' ? `<button onclick="updateStatus('${b.id}','confirmed')" class="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100 transition-all shadow-sm">${tDict.btnConfirm[currentAdminLang]}</button>` : ''}
          ${b.status === 'rescheduled' ? `<button onclick="updateStatus('${b.id}','pending')" class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-yellow-50 hover:text-yellow-700 transition-all shadow-sm">${tDict.btnRestore[currentAdminLang]}</button>` : ''}
          <button onclick="openEditModal('${b.id}', '${b.date}', '${t}')" class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm opacity-70 group-hover:opacity-100">${tDict.btnEdit[currentAdminLang]}</button>
          ${b.status !== 'cancelled' ? `
          <button onclick="updateStatus('${b.id}','cancelled')" class="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all opacity-50 group-hover:opacity-100" title="${tDict.btnCancel[currentAdminLang]}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>` : `
          <button onclick="deleteBookingPermanently('${b.id}')" class="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all opacity-50 group-hover:opacity-100" title="Dauerhaft löschen / Удалить навсегда">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>`}
        </div>
      </td>
    </tr>`;
  }).join('');

  // ── Mobile cards ──────────────────────────────────────────
  const cardsEl = document.getElementById('bookingsCards');
  if (cardsEl) {
    cardsEl.innerHTML = filtered.map(b => {
      let dateStr = new Date(b.date).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
      const t = (b.time || '').substring(0,5);
      const badgeText = locDict[b.status]?.[currentAdminLang] || b.status;
      const notesClean = (b.notes || '').replace(/\[DUR=\d+\]\s*/, '');

      return `<div class="booking-card">
        <div class="booking-card-row">
          <div>
            <div class="font-semibold text-sm text-gray-900">${b.name}</div>
            <div class="text-xs text-gray-400 mt-0.5"><a href="tel:${b.phone}" class="hover:text-[#C4826A]">${b.phone}</a></div>
            <div class="text-xs text-gray-400"><a href="mailto:${b.email}" class="hover:text-[#C4826A] break-all">${b.email}</a></div>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold status-${b.status} whitespace-nowrap">${badgeText}</span>
        </div>
        <div class="mt-3 pt-3 border-t border-gray-50">
          <div class="text-sm font-medium text-gray-800">${b.service}</div>
          ${notesClean ? `<div class="text-xs text-gray-500 mt-1 italic border-l-2 border-gray-200 pl-2">"${notesClean}"</div>` : ''}
          <div class="flex items-center gap-2 mt-2">
            <span class="text-xs font-bold text-[#C4826A]">📅 ${dateStr}</span>
            <span class="text-xs font-bold text-[#1C1410] bg-gray-100 px-2 py-0.5 rounded-full">⏰ ${t}</span>
          </div>
        </div>
        <div class="booking-card-actions">
          ${b.status !== 'confirmed' ? `<button onclick="updateStatus('${b.id}','confirmed')" class="px-3 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 transition-all">${tDict.btnConfirm[currentAdminLang]}</button>` : ''}
          ${b.status === 'rescheduled' ? `<button onclick="updateStatus('${b.id}','pending')" class="px-3 py-2 bg-yellow-50 text-yellow-700 rounded-xl text-xs font-semibold hover:bg-yellow-100 transition-all">${tDict.btnRestore[currentAdminLang]}</button>` : ''}
          <button onclick="openEditModal('${b.id}', '${b.date}', '${t}')" class="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all">${tDict.btnEdit[currentAdminLang]}</button>
          ${b.status !== 'cancelled' ? `
          <button onclick="updateStatus('${b.id}','cancelled')" class="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all" title="${tDict.btnCancel[currentAdminLang]}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>` : `
          <button onclick="deleteBookingPermanently('${b.id}')" class="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all" title="Dauerhaft löschen">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>`}
        </div>
      </div>`;
    }).join('');
  }
}

async function freeManualSlots(booking) {
  const match = (booking.notes || '').match(/\[DUR=(\d+)\]/);
  if(!match) return;
  const duration = parseInt(match[1], 10);
  const reqSlots = get15MinSlots(booking.time.substring(0,5), duration);
  if (reqSlots.length > 0) {
    const { error } = await supabaseClient.from('blocked_slots')
      .delete()
      .eq('date', booking.date)
      .eq('is_full_day', false)
      .in('time', reqSlots);
    if (!error) await loadBlockedSlots();
  }
}

async function updateStatus(id, status) {
  const { error } = await supabaseClient.from('bookings').update({ status }).eq('id', id);
  if (!error) {
    const booking = allBookings.find(b => b.id === id);
    if (booking) {
      booking.status = status;
      if (status === 'cancelled') await freeManualSlots(booking);
    }
    updateStats();
    renderTable();
    // If rescheduled tab is open, refresh it too
    if(!document.getElementById('viewVerschoben').classList.contains('hidden')) renderRescheduledTable();
  }
}

function renderRescheduledTable() {
  const rescheduled = allBookings.filter(b => b.status === 'rescheduled');
  const loadEl = document.getElementById('reschedLoadingState');
  const emptyEl = document.getElementById('reschedEmptyState');
  const tableEl = document.getElementById('reschedTable');
  const bodyEl = document.getElementById('reschedBody');

  loadEl.classList.add('hidden');
  if (rescheduled.length === 0) {
    emptyEl.classList.remove('hidden');
    tableEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  tableEl.classList.remove('hidden');

  const locDict = tDict.statusLabels;
  bodyEl.innerHTML = rescheduled.map(b => {
    const dateStr = new Date(b.date).toLocaleDateString(currentAdminLang === 'de' ? 'de-DE' : (currentAdminLang === 'ru' ? 'ru-RU' : 'en-US'), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    const t = (b.time || '').substring(0,5);
    return `<tr class="group border-b border-gray-100 hover:bg-purple-50/30 transition-all duration-200">
      <td class="px-5 py-4">
        <div class="font-semibold text-sm text-gray-900">${b.name}</div>
        <div class="text-xs text-gray-400 mt-0.5"><a href="tel:${b.phone}" class="hover:text-[#C4826A] transition-colors">${b.phone}</a></div>
        <div class="text-xs text-gray-400"><a href="mailto:${b.email}" class="hover:text-[#C4826A] transition-colors">${b.email}</a></div>
      </td>
      <td class="px-5 py-4">
        <div class="text-sm text-gray-800 font-medium">${b.service}</div>
        ${(b.notes || '').replace(/\[DUR=\d+\]\s*/, '') ? `<div class="text-xs text-gray-500 mt-1 italic border-l-2 border-purple-200 pl-2">"${(b.notes || '').replace(/\[DUR=\d+\]\s*/, '')}"</div>` : ''}
      </td>
      <td class="px-5 py-4">
        <div class="text-sm font-semibold text-gray-900">${dateStr}</div>
        <div class="text-sm text-[#C4826A] font-bold mt-0.5">${t}</div>
      </td>
      <td class="px-5 py-4">
        <div class="flex gap-2 flex-wrap items-center">
          <button onclick="updateStatus('${b.id}','confirmed')" class="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100 transition-all shadow-sm">${tDict.btnConfirm[currentAdminLang]}</button>
          <button onclick="updateStatus('${b.id}','pending')" class="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-semibold hover:bg-yellow-100 transition-all shadow-sm">${tDict.btnRestore[currentAdminLang]}</button>
          <button onclick="openEditModal('${b.id}', '${b.date}', '${t}')" class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm">${tDict.btnEdit[currentAdminLang]}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function deleteBookingPermanently(id) {
  const ask = currentAdminLang === 'de' ? 'Buchung wirklich dauerhaft löschen?' : (currentAdminLang === 'ru' ? 'Точно удалить запись НАВСЕГДА?' : 'Delete booking permanently?');
  if (!confirm(ask)) return;
  const booking = allBookings.find(b => b.id === id);
  if (booking) await freeManualSlots(booking);
  const { error } = await supabaseClient.from('bookings').delete().eq('id', id);
  if (!error) {
    allBookings = allBookings.filter(b => b.id !== id);
    updateStats();
    renderTable();
  }
}

// EDIT
function openEditModal(id, date, time) {
  document.getElementById('editBookingId').value = id;
  document.getElementById('editDate').value = date;
  document.getElementById('editTime').value = time;
  document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editModal').classList.add('hidden');
}

async function saveEdit() {
  const id = document.getElementById('editBookingId').value;
  const newDate = document.getElementById('editDate').value;
  const newTime = document.getElementById('editTime').value;

  const isTaken = allBookings.some(b => b.id !== id && b.date === newDate && b.time.substring(0,5) === newTime && b.status !== 'cancelled');
  const txtErr = currentAdminLang === 'de' ? 'Zeit bereits belegt!' : (currentAdminLang === 'ru' ? 'Время уже занято!' : 'Time already taken!');
  if (isTaken) {
    alert(txtErr);
    return;
  }

  const { error } = await supabaseClient.from('bookings').update({ date: newDate, time: newTime, status: 'rescheduled' }).eq('id', id);
  
  if (error) {
    if (error.code === '23505' || error.message.includes('duplicate')) {
      alert(txtErr);
    } else {
      const dbErr = currentAdminLang === 'de' ? 'Fehler beim Speichern' : (currentAdminLang === 'ru' ? 'Ошибка сохранения' : 'Save Error');
      alert(dbErr);
    }
  } else {
    // Local state update
    const booking = allBookings.find(b => b.id === id);
    if (booking) {
      booking.date = newDate;
      // Add :00 safely
      booking.time = newTime.length === 5 ? newTime + ':00' : newTime;
      booking.status = 'rescheduled';
    }
    updateStats();
    renderTable();
    closeEditModal();
    const ok = currentAdminLang === 'de' ? 'Gespeichert' : (currentAdminLang === 'ru' ? 'Сохранено' : 'Saved');
    showAdminToast(ok);
  }
}

// ================= CREATE BOOKING ЛОГИКА =================

function openCreateModal() {
  if(!adminSelectedDateStr) return;
  document.getElementById('createDate').value = adminSelectedDateStr;
  
  document.getElementById('createName').value = '';
  document.getElementById('createService').value = '';
  document.getElementById('createPhone').value = '';
  document.getElementById('createEmail').value = '';
  document.getElementById('createNotes').value = '';
  
  let slots15 = [];
  for(let h=9; h<=18; h++) {
    for(let m of ['00','15','30','45']) {
      if(h===18 && m!=='00') continue;
      slots15.push(`${String(h).padStart(2,'0')}:${m}`);
    }
  }
  document.getElementById('createTime').innerHTML = slots15.map(t => `<option value="${t}">${t}</option>`).join('');
  
  let durHtml = '';
  // 10 to 90 mins in 5 min steps
  for(let d=10; d<=90; d+=5) {
    durHtml += `<option value="${d}">${d} мин</option>`;
  }
  document.getElementById('createDuration').innerHTML = durHtml;
  document.getElementById('createDuration').value = '60'; // Default
  
  document.getElementById('createModal').classList.remove('hidden');
}

function closeCreateModal() {
  document.getElementById('createModal').classList.add('hidden');
}

function get15MinSlots(startStr, durationMins) {
  const slots = [];
  let parts = startStr.split(':');
  let h = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  let currentMins = h * 60 + m;
  const endMins = currentMins + parseInt(durationMins, 10);
  
  while(currentMins < endMins) {
    const sh = Math.floor(currentMins / 60);
    const sm = currentMins % 60;
    const snapM = Math.floor(sm / 15) * 15;
    const slotStr = String(sh).padStart(2,'0') + ':' + String(snapM).padStart(2,'0');
    if(!slots.includes(slotStr) && sh >= 9 && sh <= 18) {
      if(sh === 18 && snapM > 0) {} else {
        slots.push(slotStr);
      }
    }
    currentMins += 15;
  }
  return slots;
}

async function createBooking() {
  const name = document.getElementById('createName').value.trim();
  const service = document.getElementById('createService').value.trim();
  const date = document.getElementById('createDate').value;
  const time = document.getElementById('createTime').value;
  const durationStr = document.getElementById('createDuration').value;
  const duration = parseInt(durationStr, 10) || 60;
  const phone = document.getElementById('createPhone').value.trim();
  const email = document.getElementById('createEmail').value.trim();
  const notes = document.getElementById('createNotes').value.trim();
  
  if(!name || !service || !date || !time) {
    const fillTxt = currentAdminLang === 'de' ? 'Bitte alle Pflichtfelder (*) ausfüllen' : (currentAdminLang === 'ru' ? 'Заполните все обязательные поля (*)' : 'Please fill all required fields (*)');
    alert(fillTxt);
    return;
  }
  
  const reqSlots = get15MinSlots(time, duration);
  
  // Check overlapping with any bookings or blocked slots
  const isTaken = reqSlots.some(slot => {
     return blockedSlots.some(b => b.date === date && b.time === slot) ||
            allBookings.some(b => b.date === date && (b.time||'').substring(0,5) === slot && b.status !== 'cancelled');
  });
  
  if(isTaken) {
    const takenTxt = currentAdminLang === 'de' ? 'Slot (oder Teile davon) bereits belegt!' : (currentAdminLang === 'ru' ? 'Это время или его часть уже заняты' : 'Slot or parts of it already taken!');
    alert(takenTxt);
    return;
  }
  
  const btn = document.getElementById('createSaveBtn');
  const orgTxt = btn.textContent;
  btn.textContent = '...';
  btn.disabled = true;
  
  const finalNotes = duration > 0 ? `[DUR=${duration}] ` + notes : notes;
  const payload = {
    name, service, date, time: time + ':00', phone, email, notes: finalNotes, status: 'confirmed'
  };
  
  const { error } = await supabaseClient.from('bookings').insert([payload]);
  
  btn.textContent = orgTxt;
  btn.disabled = false;
  
  if (error) {
    alert("Error: " + error.message);
  } else {
    // Automatically block the duration slots in database
    const blockPayload = [];
    for(const s of reqSlots) {
       // Avoid duplicates if they manually clicked some already? isTaken protects it.
       blockPayload.push({ date: date, time: s, is_full_day: false });
    }
    if (blockPayload.length > 0) {
      await supabaseClient.from('blocked_slots').insert(blockPayload);
    }
    
    closeCreateModal();
    const ok = currentAdminLang === 'de' ? 'Gebucht' : (currentAdminLang === 'ru' ? 'Запись создана' : 'Booking created');
    showAdminToast(ok);
    await loadBlockedSlots();
    await loadBookings();
  }
}

// ================= KALENDER ЛОГИКА =================

function switchTab(tab) {
  const tabs = { buchungen:'tabBuchungen', kalender:'tabKalender', prozeduren:'tabProzeduren' };
  const views = { buchungen:'viewBuchungen', kalender:'viewKalender', prozeduren:'viewProzeduren' };
  const activeClass = 'pb-3 px-2 text-sm font-semibold text-[#1C1410] border-b-2 border-[#1C1410] transition-colors';
  const inactiveClass = 'pb-3 px-2 text-sm font-medium text-gray-400 hover:text-gray-700 border-b-2 border-transparent transition-colors';

  Object.values(tabs).forEach(id => { const el = document.getElementById(id); if(el) el.className = inactiveClass; });
  Object.values(views).forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.classList.add('hidden'); el.classList.remove('flex'); }
  });

  const tEl = document.getElementById(tabs[tab]);
  if(tEl) tEl.className = activeClass;
  const vEl = document.getElementById(views[tab]);
  if(vEl) vEl.classList.remove('hidden');

  if(tab === 'kalender') {
    if(vEl) vEl.classList.add('flex');
    renderAdminCalendar();
    if(adminSelectedDateStr) renderAdminSlots(adminSelectedDateStr);
  }
  if(tab === 'prozeduren') {
    loadProcedures();
  }
}

async function loadBlockedSlots() {
  const { data, error } = await supabaseClient.from('blocked_slots').select('*');
  if(!error) {
    blockedSlots = data || [];
    if(!document.getElementById('viewKalender').classList.contains('hidden')) {
      renderAdminCalendar();
      if(adminSelectedDateStr) renderAdminSlots(adminSelectedDateStr);
    }
  }
}

function changeAdminMonth(dir) {
  adminCalDate.setMonth(adminCalDate.getMonth() + dir);
  renderAdminCalendar();
}

function renderAdminCalendar() {
  const year = adminCalDate.getFullYear();
  const month = adminCalDate.getMonth();
  
  const monthNames = {
    de: ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
    ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December']
  };
  const wdNames = {
    de: ['Mo','Di','Mi','Do','Fr','Sa','So'],
    ru: ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],
    en: ['Mo','Tu','We','Th','Fr','Sa','Su']
  };
  
  const safeLang = monthNames[currentAdminLang] ? currentAdminLang : 'de';
  
  document.getElementById('adminMonthYear').textContent = `${monthNames[safeLang][month]} ${year}`;
  
  const wds = document.getElementById('adminCalWeekdays');
  wds.innerHTML = wdNames[safeLang].map(d => `<div>${d}</div>`).join('');
  
  const daysEl = document.getElementById('adminCalDays');
  daysEl.innerHTML = '';
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  let startDay = firstDay.getDay() || 7; 
  startDay--; // Mon=0
  
  for(let i=0; i<startDay; i++){
    daysEl.innerHTML += `<div></div>`;
  }
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayStr = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-');
  
  for(let d=1; d<=lastDay.getDate(); d++){
    // const dateObj = new Date(year, month, d);
    const dateStr = [year, String(month+1).padStart(2,'0'), String(d).padStart(2,'0')].join('-');
    const isPast = dateStr < todayStr;
    
    // Check bookings/blocks for dot indicators
    const hasBookings = allBookings.some(b => b.date === dateStr && b.status !== 'cancelled');
    const partiallyBlocked = blockedSlots.some(b => b.date === dateStr && !b.is_full_day);
    const isFullDay = blockedSlots.some(b => b.date === dateStr && b.is_full_day === true);
    
    let dotsHtml = '';
    if(!isPast && (hasBookings || partiallyBlocked) && !isFullDay) {
       dotsHtml = `<div class="flex gap-1 mt-0.5 justify-center absolute bottom-1.5 left-0 right-0">`;
       if(hasBookings) dotsHtml += `<div class="w-1 h-1 rounded-full bg-green-500"></div>`;
       if(partiallyBlocked) dotsHtml += `<div class="w-1 h-1 rounded-full bg-red-400"></div>`;
       dotsHtml += `</div>`;
    }
    
    let btnClass = isPast ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:bg-[#F5EFE8] hover:text-[#1C1410] transition-colors";
    
    if(!isPast && isFullDay) {
       btnClass += " bg-red-50 text-red-600 font-bold border border-red-200";
    } else if(!isPast && adminSelectedDateStr === dateStr) {
       btnClass += " bg-[#1C1410] text-[#F5EFE8] font-bold shadow-md";
    } else if (!isPast) {
       btnClass += " bg-white text-gray-700 border border-gray-100";
    }
    
    daysEl.innerHTML += `<button 
        ${isPast ? 'disabled' : `onclick="selectAdminDay('${dateStr}')"`}
        class="aspect-square flex flex-col items-center justify-center rounded-xl text-sm ${btnClass} relative overflow-hidden">
        <span>${d}</span>
        ${dotsHtml}
      </button>`;
  }
}

function formatAdminDate(ds) {
  const [y,m,d] = ds.split('-');
  return `${d}.${m}.${y}`;
}

function selectAdminDay(dateStr) {
  adminSelectedDateStr = dateStr;
  
  // reset selection
  selectedSlotsSet.clear();
  const actionPanel = document.getElementById('slotActionPanel');
  if(actionPanel) actionPanel.classList.add('hidden');
  
  renderAdminCalendar(); // refresh selection state
  
  document.getElementById('adminDayEmpty').classList.add('hidden');
  const dDetail = document.getElementById('adminDayDetail');
  dDetail.classList.remove('hidden');
  
  document.getElementById('adminSelectedDateDisplay').textContent = formatAdminDate(dateStr);
  
  renderAdminSlots(dateStr);
}

// === DRAG & DROP SELECTION ===
let isDragSelecting = false;
let dragStartIndex = -1;
let selectedSlotsSet = new Set();
let currentDragLockMode = true; // true=booking, false=unbooking

window.addEventListener('mouseup', () => {
  if (isDragSelecting) {
    isDragSelecting = false;
    processSlotSelection();
  }
});

function handleSlotDown(idx, isFree) {
  isDragSelecting = true;
  dragStartIndex = idx;
  currentDragLockMode = isFree; 
  selectedSlotsSet.clear();
  selectedSlotsSet.add(idx);
  redrawSlotsDOM();
}

function handleSlotEnter(idx) {
  if (isDragSelecting) {
    selectedSlotsSet.clear();
    const min = Math.min(dragStartIndex, idx);
    const max = Math.max(dragStartIndex, idx);
    for(let i=min; i<=max; i++) selectedSlotsSet.add(i);
    redrawSlotsDOM();
  }
}

function redrawSlotsDOM() {
  ADMIN_SLOTS.forEach((time, idx) => {
    const el = document.getElementById(`admin-slot-${idx}`);
    if(!el) return;
    if (selectedSlotsSet.has(idx)) {
       el.className = el.getAttribute('data-orig-class') + " ring-2 ring-[#1C1410] scale-95 shadow-inner opacity-90 backdrop-brightness-95";
    } else {
       el.className = el.getAttribute('data-orig-class');
    }
  });
}

function cancelSlotSelection() {
  selectedSlotsSet.clear();
  document.getElementById('slotActionPanel').classList.add('hidden');
  redrawSlotsDOM();
}

function processSlotSelection() {
  if (selectedSlotsSet.size === 0) {
    document.getElementById('slotActionPanel').classList.add('hidden');
    return;
  }
  
  const lock = currentDragLockMode;
  const panel = document.getElementById('slotActionPanel');
  const txt = document.getElementById('slotActionText');
  const btn = document.getElementById('slotActionConfirmBtn');
  
  panel.classList.remove('hidden');
  
  const count = selectedSlotsSet.size;
  if(currentAdminLang === 'ru') {
    txt.textContent = `Выбрано слотов: ${count}`;
    btn.textContent = lock ? 'Закрыть выбранное' : 'Открыть выбранное';
  } else if (currentAdminLang === 'en') {
    txt.textContent = `Selected slots: ${count}`;
    btn.textContent = lock ? 'Lock Selected' : 'Unlock Selected';
  } else {
    txt.textContent = `${count} Slots ausgewählt`;
    btn.textContent = lock ? 'Auswahl sperren' : 'Auswahl freigeben';
  }
  
  if (lock) {
    btn.className = "flex-1 sm:flex-none px-6 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl transition-colors shadow-sm text-sm border border-red-200";
  } else {
    btn.className = "flex-1 sm:flex-none px-6 py-2.5 bg-[#1C1410] text-white hover:bg-[#C4826A] font-bold rounded-xl transition-colors shadow-md text-sm";
  }
}

async function commitSlotSelection() {
  if (selectedSlotsSet.size === 0) return;
  const lock = currentDragLockMode;
  const dateStr = adminSelectedDateStr;
  
  const inserts = [];
  const times = [];
  Array.from(selectedSlotsSet).forEach(idx => {
    const hStr = ADMIN_SLOTS[idx].substring(0,2);
    times.push(`${hStr}:00`);
    if (hStr !== '18') times.push(`${hStr}:15`, `${hStr}:30`, `${hStr}:45`);
  });
  
  // lock UI
  document.getElementById('slotActionPanel').classList.add('opacity-50', 'pointer-events-none');
  
  if (lock) {
    for(const t of times) {
       // if not already blocked
       if(!blockedSlots.some(b => b.date === dateStr && b.time === t)) {
          inserts.push({ date: dateStr, time: t, is_full_day: false });
          // local UI state predictive
          blockedSlots.push({ date: dateStr, time: t, is_full_day: false });
       }
    }
    if(inserts.length > 0) {
      const { error } = await supabaseClient.from('blocked_slots').insert(inserts);
      if(error) alert(error.message);
    }
  } else {
    for(const t of times) {
      const { error } = await supabaseClient.from('blocked_slots').delete().match({ date: dateStr, time: t });
      if(error) alert(error.message);
      else blockedSlots = blockedSlots.filter(b => !(b.date === dateStr && b.time === t));
    }
  }
  
  selectedSlotsSet.clear();
  document.getElementById('slotActionPanel').classList.remove('opacity-50', 'pointer-events-none');
  document.getElementById('slotActionPanel').classList.add('hidden');
  
  await loadBlockedSlots();
  const msg = lock ? (currentAdminLang==='ru'?'Слоты закрыты':'Slots locked') : (currentAdminLang==='ru'?'Слоты открыты':'Slots opened');
  showAdminToast(msg);
}

// ==== DAY DETAILS SLOTS ====
function renderAdminSlots(dateStr) {
  const grid = document.getElementById('adminSlotsGrid');
  grid.innerHTML = '';
  
  const isFullDay = blockedSlots.some(b => b.date === dateStr && b.is_full_day === true);
  
  const btnFull = document.getElementById('adminToggleFullDayBtn');
  if(isFullDay) {
    btnFull.className = "px-5 py-2.5 text-xs font-bold rounded-2xl transition-colors bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm";
    btnFull.textContent = currentAdminLang === 'de' ? 'Tag öffnen' : (currentAdminLang === 'ru' ? 'Открыть день' : 'Open day');
    btnFull.onclick = () => toggleFullDay(dateStr, false);
  } else {
    btnFull.className = "px-5 py-2.5 text-xs font-bold rounded-2xl transition-colors bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 shadow-sm";
    btnFull.textContent = currentAdminLang === 'de' ? 'Gesamten Tag schließen' : (currentAdminLang === 'ru' ? 'Закрыть весь день' : 'Close full day');
    btnFull.onclick = () => toggleFullDay(dateStr, true);
  }

  ADMIN_SLOTS.forEach((time, idx) => {
    // If any 15-min chunk matches this hour, consider it booked/blocked for the grid visuals
    const hourPrefix = time.substring(0,2) + ':';
    
    const isBooked = allBookings.some(b => b.date === dateStr && (b.time || '').substring(0,3) === hourPrefix && b.status !== 'cancelled');
    const isBlocked = isFullDay || blockedSlots.some(b => b.date === dateStr && b.time.substring(0,3) === hourPrefix);
    
    let bg = "bg-white", border = "border-gray-200", text = "text-gray-700";
    let sub = currentAdminLang==='de'?'Frei':(currentAdminLang==='ru'?'Свободно':'Free');
    let subOp = "opacity-40";
    let cursor = "cursor-pointer hover:border-[#1C1410] hover:shadow-md";
    let line = "";
    let isFree = true;

    if (isBooked) {
      isFree = false;
      bg = "bg-green-50"; text = "text-green-700"; border = "border-green-200";
      sub = currentAdminLang==='de'?'Gebucht':(currentAdminLang==='ru'?'Занято':'Booked');
      subOp = "opacity-80";
      cursor = "cursor-not-allowed";
    } else if (isBlocked) {
      isFree = false;
      bg = "bg-red-50"; text = "text-red-700"; border = "border-red-200";
      sub = currentAdminLang==='de'?'Gesperrt':(currentAdminLang==='ru'?'Закрыто':'Blocked');
      subOp = "opacity-80";
      cursor = "cursor-pointer hover:bg-red-100";
      line = "line-through opacity-70";
    }

    const events = isBooked ? '' : `onmousedown="handleSlotDown(${idx}, ${isFree})" onmouseenter="handleSlotEnter(${idx})"`;
    const fullClass = `select-none py-3.5 rounded-2xl border text-sm font-medium transition-all duration-200 text-center ${bg} ${border} ${text} ${cursor}`;

    grid.innerHTML += `<div id="admin-slot-${idx}" data-orig-class="${fullClass}" class="${fullClass}" ${events}>
      <div class="font-bold mb-1 ${line} pointer-events-none text-base">${time}</div>
      <div class="text-[9px] sm:text-[10px] uppercase tracking-wide font-bold ${subOp} pointer-events-none">${sub}</div>
    </div>`;
  });

  // Render bookings for this day below slots
  renderDayBookings(dateStr);
}

// ==== DAY BOOKINGS IN CALENDAR ====
function renderDayBookings(dateStr) {
  const container = document.getElementById('adminDayBookings');
  const list = document.getElementById('adminDayBookingsList');
  if (!container || !list) return;

  const dayBookings = allBookings.filter(b => b.date === dateStr && b.status !== 'cancelled');
  
  if (dayBookings.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  const locDict = tDict.statusLabels;
  const locale = currentAdminLang === 'de' ? 'de-DE' : (currentAdminLang === 'ru' ? 'ru-RU' : 'en-US');

  list.innerHTML = dayBookings.map(b => {
    const t = (b.time || '').substring(0,5);
    const badgeText = locDict[b.status]?.[currentAdminLang] || b.status;
    const notesClean = (b.notes || '').replace(/\[DUR=\d+\]\s*/, '');

    return `<div class="flex flex-col sm:flex-row sm:items-center gap-3 p-4 mb-3 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-gray-100/70 transition-colors">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-sm text-[#1C1410]">${t}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold status-${b.status}">${badgeText}</span>
        </div>
        <div class="font-semibold text-sm text-gray-800 mt-1">${b.name}</div>
        <div class="text-xs text-gray-500 mt-0.5">${b.service}</div>
        ${b.phone ? `<div class="text-xs text-gray-400 mt-0.5"><a href="tel:${b.phone}" class="hover:text-[#C4826A]">${b.phone}</a></div>` : ''}
        ${notesClean ? `<div class="text-xs text-gray-400 mt-0.5 italic">"${notesClean}"</div>` : ''}
      </div>
      <div class="flex gap-2 flex-wrap flex-shrink-0">
        ${b.status !== 'confirmed' ? `<button onclick="updateStatus('${b.id}','confirmed')" class="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100 transition-all shadow-sm">${tDict.btnConfirm[currentAdminLang]}</button>` : ''}
        <button onclick="openEditModal('${b.id}', '${b.date}', '${t}')" class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm">${tDict.btnEdit[currentAdminLang]}</button>
        <button onclick="updateStatus('${b.id}','cancelled')" class="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all" title="${tDict.btnCancel[currentAdminLang]}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

// ==== MASS ACTIONS & RANGE ====

async function applyMassDateBlock(lock) {
  const dFrom = document.getElementById('massDateFrom').value;
  const dTo = document.getElementById('massDateTo').value || dFrom;

  if (!dFrom) {
    alert(currentAdminLang==='ru' ? 'Выберите дату!' : 'Date required!');
    return;
  }

  let current = new Date(dFrom);
  const end = new Date(dTo);
  const dates = [];
  while(current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  if (lock) {
    // delete all partial/full blocks for these dates first
    for(const d of dates) await supabaseClient.from('blocked_slots').delete().eq('date', d);
    const inserts = dates.map(d => ({ date: d, time: null, is_full_day: true }));
    const { error } = await supabaseClient.from('blocked_slots').insert(inserts);
    if(error) { alert("Error: "+error.message); return; }
  } else {
    for(const d of dates) await supabaseClient.from('blocked_slots').delete().eq('date', d);
  }

  showAdminToast(lock ? (currentAdminLang==='ru'?'Дни закрыты':'Days locked') : (currentAdminLang==='ru'?'Дни открыты':'Days unlocked'));
  await loadBlockedSlots();
}

async function applyMassTimeBlock(lock) {
  const dStr = adminSelectedDateStr;
  if (!dStr) {
    alert(currentAdminLang==='ru' ? 'Сначала выберите день!' : 'Select a day first!');
    return;
  }

  const tFrom = document.getElementById('massTimeFrom').value;
  const tTo = document.getElementById('massTimeTo').value;

  if(!tFrom || !tTo) { 
    alert(currentAdminLang==='ru' ? 'Выберите время от и до!' : 'Time range required!'); 
    return; 
  }

  let startIdx = ADMIN_SLOTS.indexOf(tFrom);
  let endIdx = ADMIN_SLOTS.indexOf(tTo);
  if(startIdx === -1) startIdx = 0; 
  if(endIdx === -1) endIdx = ADMIN_SLOTS.length - 1;
  if(startIdx > endIdx) { const tmp=startIdx; startIdx=endIdx; endIdx=tmp; }
  
  const selectedHours = ADMIN_SLOTS.slice(startIdx, endIdx + 1);
  const times = [];
  selectedHours.forEach(t => {
     const hStr = t.substring(0,2);
     times.push(`${hStr}:00`);
     if (hStr !== '18') times.push(`${hStr}:15`, `${hStr}:30`, `${hStr}:45`);
  });

  if (lock) {
    const inserts = [];
    for(const t of times) {
       // Only insert if not already blocked
       if(!blockedSlots.some(b => b.date === dStr && b.time === t)) {
          inserts.push({ date: dStr, time: t, is_full_day: false });
       }
    }
    if (inserts.length > 0) {
      const { error } = await supabaseClient.from('blocked_slots').insert(inserts);
      if(error) { alert("Error: "+error.message); return; }
    }
  } else {
    for(const t of times) {
      await supabaseClient.from('blocked_slots').delete().match({date: dStr, time: t});
    }
  }

  showAdminToast(lock ? (currentAdminLang==='ru'?'Время закрыто':'Time locked') : (currentAdminLang==='ru'?'Время открыто':'Time unlocked'));
  document.getElementById('massTimeFrom').value = '';
  document.getElementById('massTimeTo').value = '';
  await loadBlockedSlots();
}

async function toggleFullDay(dateStr, lock) {
  if (lock) {
    await supabaseClient.from('blocked_slots').delete().eq('date', dateStr);
    const { error } = await supabaseClient.from('blocked_slots').insert([{ date: dateStr, is_full_day: true, time: null }]);
    if (error) { 
      alert("Supabase Error (Full Day Lock): " + (error.message || JSON.stringify(error))); 
      console.error(error); 
      return; 
    }
    blockedSlots = blockedSlots.filter(b => b.date !== dateStr);
    blockedSlots.push({ date: dateStr, is_full_day: true, time: null });
  } else {
    const { error } = await supabaseClient.from('blocked_slots').delete().eq('date', dateStr);
    if (error) { 
      alert("Supabase Error (Full Day Unlock): " + (error.message || JSON.stringify(error))); 
      console.error(error); 
      return; 
    }
    blockedSlots = blockedSlots.filter(b => b.date !== dateStr);
  }
  await loadBlockedSlots(); // sync
  renderAdminCalendar();
  if (adminSelectedDateStr === dateStr) renderAdminSlots(dateStr);
  
  const msg = lock ? (currentAdminLang==='ru'?'День закрыт':'Day closed') : (currentAdminLang==='ru'?'День открыт':'Day opened');
  showAdminToast(msg);
}

// ========== PROCEDURES MANAGEMENT ==========
let allProcedures = [];

async function loadProcedures() {
  const { data, error } = await supabaseClient
    .from('procedures')
    .select('*')
    .order('category_sort').order('subcategory_sort').order('sort_order');
  if (error) {
    console.error('loadProcedures error:', error);
    showAdminToast('❌ Fehler beim Laden der Prozeduren: ' + error.message);
  }
  allProcedures = data || [];
  buildProcCategoryFilter();
  if (!document.getElementById('viewProzeduren').classList.contains('hidden')) renderProcedures();
}

function buildProcCategoryFilter() {
  const sel = document.getElementById('procCategoryFilter');
  if (!sel) return;
  const seen = new Set();
  const opts = ['<option value="all">Alle Kategorien</option>'];
  allProcedures.forEach(p => {
    if (!seen.has(p.category_id)) {
      seen.add(p.category_id);
      opts.push(`<option value="${p.category_id}">${p['category_' + currentAdminLang] || p.category_de}</option>`);
    }
  });
  sel.innerHTML = opts.join('');
}

function renderProcedures() {
  const filterCat = document.getElementById('procCategoryFilter')?.value || 'all';
  let procs = filterCat === 'all' ? allProcedures : allProcedures.filter(p => p.category_id === filterCat);
  const loadEl = document.getElementById('procLoadingState');
  const emptyEl = document.getElementById('procEmptyState');
  const tableEl = document.getElementById('procTableWrap');
  const body = document.getElementById('procTableBody');
  if (loadEl) loadEl.classList.add('hidden');
  if (procs.length === 0) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (tableEl) tableEl.classList.add('hidden');
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');
  if (tableEl) tableEl.classList.remove('hidden');
  let lastCat = null;
  body.innerHTML = procs.map(p => {
    let catCell = '';
    if (p.category_id !== lastCat) {
      lastCat = p.category_id;
      catCell = `<td class="px-4 py-3 align-top"><span class="inline-block bg-[#F5EFE8] text-[#C4826A] text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap">${p['category_' + currentAdminLang] || p.category_de}</span></td>`;
    } else {
      catCell = '<td class="px-4 py-3"></td>';
    }
    const subName = p.subcategory_id ? (p['subcategory_' + currentAdminLang] || p.subcategory_de || p.subcategory_id) : '—';
    const bookBadge = p.show_in_booking
      ? '<span class="text-green-600 font-bold text-xs">✓</span>'
      : '<span class="text-gray-300 text-xs">✗</span>';
    return `<tr class="group border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
      ${catCell}
      <td class="px-4 py-3 text-sm text-gray-500">${subName}</td>
      <td class="px-4 py-3">
        <div class="text-sm font-medium text-gray-900">${p.name_de}</div>
        <div class="text-xs text-gray-400">${p.name_ru}</div>
      </td>
      <td class="px-4 py-3 text-sm font-bold text-[#C4826A] whitespace-nowrap">${p.price}</td>
      <td class="px-4 py-3 text-center">${bookBadge}</td>
      <td class="px-4 py-3">
        <div class="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
          <button onclick="openProcedureModal('${p.id}')" class="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Bearbeiten">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onclick="deleteProcedure('${p.id}')" class="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors" title="Löschen">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openProcedureModal(id = null) {
  document.getElementById('procEditId').value = id || '';
  const title = document.getElementById('procModalTitle');
  const modal = document.getElementById('procedureModal');

  // Build category select
  const catSel = document.getElementById('procCatIdSelect');
  const seenCats = new Map();
  allProcedures.forEach(p => { if (!seenCats.has(p.category_id)) seenCats.set(p.category_id, p); });
  catSel.innerHTML = '<option value="__new__">+ Neue Kategorie...</option>';
  seenCats.forEach((p, catId) => {
    catSel.innerHTML += `<option value="${catId}">${p['category_' + currentAdminLang] || p.category_de} (${catId})</option>`;
  });

  if (id) {
    const p = allProcedures.find(x => x.id === id);
    if (!p) return;
    title.textContent = currentAdminLang === 'ru' ? 'Изменить процедуру' : 'Prozedur bearbeiten';
    catSel.value = p.category_id;
    document.getElementById('procCatIdNew').classList.add('hidden');
    document.getElementById('procCatDe').value = p.category_de;
    document.getElementById('procCatRu').value = p.category_ru;
    document.getElementById('procCatEn').value = p.category_en;
    document.getElementById('procCatSort').value = p.category_sort;
    // subcategory
    onProcCatSelect(p.category_id);
    const subSel = document.getElementById('procSubIdSelect');
    subSel.value = p.subcategory_id || '';
    document.getElementById('procSubDe').value = p.subcategory_de || '';
    document.getElementById('procSubRu').value = p.subcategory_ru || '';
    document.getElementById('procSubEn').value = p.subcategory_en || '';
    document.getElementById('procSubSort').value = p.subcategory_sort;
    document.getElementById('procNameDe').value = p.name_de;
    document.getElementById('procNameRu').value = p.name_ru;
    document.getElementById('procNameEn').value = p.name_en;
    document.getElementById('procPrice').value = p.price;
    document.getElementById('procSortOrder').value = p.sort_order;
    document.getElementById('procShowInBooking').checked = p.show_in_booking;
  } else {
    title.textContent = currentAdminLang === 'ru' ? 'Новая процедура' : 'Neue Prozedur';
    catSel.value = seenCats.size ? [...seenCats.keys()][0] : '__new__';
    onProcCatSelect();
    ['procCatDe','procCatRu','procCatEn','procSubDe','procSubRu','procSubEn','procNameDe','procNameRu','procNameEn','procPrice'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('procCatSort').value = 0;
    document.getElementById('procSubSort').value = 0;
    document.getElementById('procSortOrder').value = 0;
    document.getElementById('procShowInBooking').checked = true;
    if (seenCats.size > 0) {
      const firstCat = [...seenCats.values()][0];
      document.getElementById('procCatDe').value = firstCat.category_de;
      document.getElementById('procCatRu').value = firstCat.category_ru;
      document.getElementById('procCatEn').value = firstCat.category_en;
      document.getElementById('procCatSort').value = firstCat.category_sort;
    }
  }
  modal.classList.remove('hidden');
}

function onProcCatSelect(forceCatId = null) {
  const catSel = document.getElementById('procCatIdSelect');
  const catId = forceCatId || catSel.value;
  const newInput = document.getElementById('procCatIdNew');
  if (catId === '__new__') {
    newInput.classList.remove('hidden');
    document.getElementById('procCatDe').value = '';
    document.getElementById('procCatRu').value = '';
    document.getElementById('procCatEn').value = '';
  } else {
    newInput.classList.add('hidden');
    const p = allProcedures.find(x => x.category_id === catId);
    if (p) {
      document.getElementById('procCatDe').value = p.category_de;
      document.getElementById('procCatRu').value = p.category_ru;
      document.getElementById('procCatEn').value = p.category_en;
      document.getElementById('procCatSort').value = p.category_sort;
    }
  }
  // Rebuild sub select
  const subSel = document.getElementById('procSubIdSelect');
  const seenSubs = new Map();
  allProcedures.filter(p => p.category_id === catId && p.subcategory_id).forEach(p => {
    if (!seenSubs.has(p.subcategory_id)) seenSubs.set(p.subcategory_id, p);
  });
  subSel.innerHTML = '<option value="">— keine —</option><option value="__new__">+ Neue Subkategorie...</option>';
  seenSubs.forEach((p, subId) => {
    subSel.innerHTML += `<option value="${subId}">${p['subcategory_' + currentAdminLang] || p.subcategory_de} (${subId})</option>`;
  });
}

function onProcSubSelect() {
  const subSel = document.getElementById('procSubIdSelect');
  const subId = subSel.value;
  const newInput = document.getElementById('procSubIdNew');
  if (subId === '__new__') {
    newInput.classList.remove('hidden');
    document.getElementById('procSubDe').value = '';
    document.getElementById('procSubRu').value = '';
    document.getElementById('procSubEn').value = '';
  } else {
    newInput.classList.add('hidden');
    if (subId) {
      const catSel = document.getElementById('procCatIdSelect');
      const p = allProcedures.find(x => x.category_id === catSel.value && x.subcategory_id === subId);
      if (p) {
        document.getElementById('procSubDe').value = p.subcategory_de || '';
        document.getElementById('procSubRu').value = p.subcategory_ru || '';
        document.getElementById('procSubEn').value = p.subcategory_en || '';
        document.getElementById('procSubSort').value = p.subcategory_sort;
      }
    } else {
      document.getElementById('procSubDe').value = '';
      document.getElementById('procSubRu').value = '';
      document.getElementById('procSubEn').value = '';
    }
  }
}

function closeProcedureModal() {
  document.getElementById('procedureModal').classList.add('hidden');
}

async function saveProcedure() {
  const editId = document.getElementById('procEditId').value;
  const catSel = document.getElementById('procCatIdSelect');
  const subSel = document.getElementById('procSubIdSelect');
  const catId = catSel.value === '__new__' ? document.getElementById('procCatIdNew').value.trim().toLowerCase().replace(/\s+/g,'-') : catSel.value;
  const subIdRaw = subSel.value;
  const subId = subIdRaw === '__new__' ? (document.getElementById('procSubIdNew').value.trim().toLowerCase().replace(/\s+/g,'-') || null) : (subIdRaw || null);
  const payload = {
    category_id: catId,
    category_sort: parseInt(document.getElementById('procCatSort').value) || 0,
    category_de: document.getElementById('procCatDe').value.trim(),
    category_ru: document.getElementById('procCatRu').value.trim(),
    category_en: document.getElementById('procCatEn').value.trim(),
    subcategory_id: subId,
    subcategory_sort: parseInt(document.getElementById('procSubSort').value) || 0,
    subcategory_de: document.getElementById('procSubDe').value.trim() || null,
    subcategory_ru: document.getElementById('procSubRu').value.trim() || null,
    subcategory_en: document.getElementById('procSubEn').value.trim() || null,
    name_de: document.getElementById('procNameDe').value.trim(),
    name_ru: document.getElementById('procNameRu').value.trim(),
    name_en: document.getElementById('procNameEn').value.trim(),
    price: document.getElementById('procPrice').value.trim(),
    show_in_booking: document.getElementById('procShowInBooking').checked,
    sort_order: parseInt(document.getElementById('procSortOrder').value) || 0,
  };
  if (!payload.category_id || !payload.name_de || !payload.price) {
    alert(currentAdminLang === 'ru' ? 'Заполните обязательные поля' : 'Bitte Pflichtfelder ausfüllen');
    return;
  }
  const btn = document.getElementById('procSaveBtn');
  btn.textContent = '...'; btn.disabled = true;
  let error;
  if (editId) {
    ({ error } = await supabaseClient.from('procedures').update(payload).eq('id', editId));
  } else {
    ({ error } = await supabaseClient.from('procedures').insert([payload]));
  }
  btn.textContent = 'Speichern'; btn.disabled = false;
  if (error) { alert('Error: ' + error.message); return; }
  closeProcedureModal();
  showAdminToast(currentAdminLang === 'ru' ? 'Сохранено' : 'Gespeichert');
  await loadProcedures();
}

async function deleteProcedure(id) {
  const ask = currentAdminLang === 'ru' ? 'Удалить процедуру?' : 'Prozedur wirklich löschen?';
  if (!confirm(ask)) return;
  const { error } = await supabaseClient.from('procedures').delete().eq('id', id);
  if (!error) {
    allProcedures = allProcedures.filter(p => p.id !== id);
    renderProcedures();
    showAdminToast(currentAdminLang === 'ru' ? 'Удалено' : 'Gelöscht');
  }
}

// Realtime для процедур
supabaseClient.channel('procedures-channel')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'procedures' }, () => loadProcedures())
  .subscribe();

// Initialize language on load
document.addEventListener('DOMContentLoaded', () => {
  setAdminLang(currentAdminLang);
  
  // Populate time dropdowns with 15-min granularities independent of ADMIN_SLOTS
  let slots15 = [];
  for(let h=9; h<=18; h++) {
    for(let m of ['00','15','30','45']) {
      if(h===18 && m!=='00') continue;
      slots15.push(`${String(h).padStart(2,'0')}:${m}`);
    }
  }

  const html = slots15.map(t => `<option value="${t}">${t}</option>`).join('');
  if(document.getElementById('massTimeFrom')) document.getElementById('massTimeFrom').innerHTML = html;
  
  const mTo = document.getElementById('massTimeTo');
  if(mTo) {
    mTo.innerHTML = html;
    mTo.value = '18:00';
  }
  
  // Edit modal uses 1-hour steps (matching the booking grid)
  const html1h = ADMIN_SLOTS.map(t => `<option value="${t}">${t}</option>`).join('');
  if(document.getElementById('editTime')) document.getElementById('editTime').innerHTML = html1h;
});
