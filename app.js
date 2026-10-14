/**
 * Foodlog & Nutrition — Client Application
 * Zero-dependency SPA for real-time mobile food logging and Firebase RTDB sync.
 */

(function () {
  'use strict';

  // --- Constants & Default Configuration ---
  const DEFAULT_CONFIG = {
    dbUrl: 'https://tom-foodlog-default-rtdb.europe-west1.firebasedatabase.app',
    secret: 'tom-foodlog-2026',
    calTarget: 2200,
    protTarget: 150,
    carbsTarget: 260,
    fatTarget: 60,
    weightKg: 77.4,
  };

  const STORAGE_KEYS = {
    CONFIG: 'tom_foodlog_cfg',
    LOCAL_ENTRIES: 'tom_foodlog_local_backup',
  };

  // --- State ---
  let appConfig = loadConfig();
  let selectedDate = getTodayIso();
  let currentMeals = [];

  // --- DOM Elements ---
  const elConnectionBadge = document.getElementById('connectionBadge');
  const elBtnRefresh = document.getElementById('btnRefresh');
  const elBtnCopyMd = document.getElementById('btnCopyMd');
  const elBtnSettings = document.getElementById('btnSettings');
  const elToast = document.getElementById('toastNotification');
  const elToastIcon = document.getElementById('toastIcon');
  const elToastMsg = document.getElementById('toastMsg');
  const elToastClose = document.getElementById('toastClose');

  const elBtnPrevDay = document.getElementById('btnPrevDay');
  const elBtnNextDay = document.getElementById('btnNextDay');
  const elDatePicker = document.getElementById('datePicker');
  const elDateLabel = document.getElementById('dateLabel');
  const elBtnToday = document.getElementById('btnToday');

  const elValTotalCal = document.getElementById('valTotalCal');
  const elValRemainingCal = document.getElementById('valRemainingCal');
  const elLblCalTarget = document.getElementById('lblCalTarget');
  const elCalProgressFill = document.getElementById('calProgressFill');

  const elValProt = document.getElementById('valProt');
  const elLblProtTarget = document.getElementById('lblProtTarget');
  const elBarProt = document.getElementById('barProt');
  const elRatioProt = document.getElementById('ratioProt');

  const elValCarbs = document.getElementById('valCarbs');
  const elLblCarbsTarget = document.getElementById('lblCarbsTarget');
  const elBarCarbs = document.getElementById('barCarbs');
  const elRatioCarbs = document.getElementById('ratioCarbs');

  const elValFat = document.getElementById('valFat');
  const elLblFatTarget = document.getElementById('lblFatTarget');
  const elBarFat = document.getElementById('barFat');
  const elRatioFat = document.getElementById('ratioFat');

  const elMealsList = document.getElementById('mealsList');
  const elMealsCount = document.getElementById('mealsCount');
  const elEmptyState = document.getElementById('emptyState');
  const elBtnOpenAddModal = document.getElementById('btnOpenAddModal');

  // Modals
  const modalAddMeal = document.getElementById('modalAddMeal');
  const formAddMeal = document.getElementById('formAddMeal');
  const btnCloseAddModal = document.getElementById('btnCloseAddModal');
  const btnCancelAdd = document.getElementById('btnCancelAdd');

  const modalSettings = document.getElementById('modalSettings');
  const formSettings = document.getElementById('formSettings');
  const btnCloseSettingsModal = document.getElementById('btnCloseSettingsModal');
  const btnCancelSettings = document.getElementById('btnCancelSettings');
  const btnTestConn = document.getElementById('btnTestConn');
  const testConnResult = document.getElementById('testConnResult');

  // --- Initialization ---
  function init() {
    bindEvents();
    syncConfigToInputs();

    // Check if URL contains publish parameters
    handleUrlPublish()
      .then((published) => {
        if (!published) {
          updateDateDisplay();
          fetchMealsForDate(selectedDate);
        }
      })
      .catch((err) => {
        console.error('Initialization error:', err);
        updateDateDisplay();
        fetchMealsForDate(selectedDate);
      });
  }

  // --- Configuration Management ---
  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Could not read config from localStorage', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  function saveConfig(newCfg) {
    appConfig = { ...appConfig, ...newCfg };
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(appConfig));
    } catch (e) {
      console.warn('Could not write config to localStorage', e);
    }
  }

  function syncConfigToInputs() {
    document.getElementById('cfgDbUrl').value = appConfig.dbUrl;
    document.getElementById('cfgSecret').value = appConfig.secret;
    document.getElementById('cfgCalTarget').value = appConfig.calTarget;
    document.getElementById('cfgProtTarget').value = appConfig.protTarget;
    document.getElementById('cfgCarbsTarget').value = appConfig.carbsTarget;
    document.getElementById('cfgFatTarget').value = appConfig.fatTarget;

    elLblCalTarget.textContent = formatNumber(appConfig.calTarget);
    elLblProtTarget.textContent = appConfig.protTarget;
    elLblCarbsTarget.textContent = appConfig.carbsTarget;
    elLblFatTarget.textContent = appConfig.fatTarget;
  }

  // --- Date Helpers ---
  function getTodayIso() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatTimeNow() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  function formatDateFriendly(isoStr) {
    const today = getTodayIso();
    const [y, m, d] = isoStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    if (isoStr === today) return `Aujourd'hui (${d}/${m})`;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (isoStr === yStr) return `Hier (${d}/${m})`;

    const formatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    return formatter.format(dateObj);
  }

  function addDays(isoStr, deltaDays) {
    const [y, m, d] = isoStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    const ny = dt.getFullYear();
    const nm = String(dt.getMonth() + 1).padStart(2, '0');
    const nd = String(dt.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  }

  function updateDateDisplay() {
    elDatePicker.value = selectedDate;
    elDateLabel.textContent = formatDateFriendly(selectedDate);
  }

  // --- Firebase RTDB REST Helpers ---
  function getCleanDbUrl() {
    return (appConfig.dbUrl || '').trim().replace(/\/+$/, '');
  }

  function getBaseSecretPath() {
    const cleanUrl = getCleanDbUrl();
    const token = encodeURIComponent((appConfig.secret || 'tom-foodlog').trim());
    return `${cleanUrl}/foodlog/${token}`;
  }

  function showConnectionStatus(state, msg) {
    elConnectionBadge.className = `status-badge ${state}`;
    elConnectionBadge.textContent = msg;
  }

  // --- Publish Handler (from URL Query Parameters) ---
  async function handleUrlPublish() {
    const params = new URLSearchParams(window.location.search);

    // Support override of db/token via url if present
    if (params.get('db')) {
      appConfig.dbUrl = params.get('db');
      saveConfig({ dbUrl: appConfig.dbUrl });
    }
    if (params.get('token') || params.get('secret')) {
      appConfig.secret = params.get('token') || params.get('secret');
      saveConfig({ secret: appConfig.secret });
    }

    const mealParam = params.get('meal') || params.get('type');
    const calParam = params.get('cal') || params.get('calories');
    const textParam = params.get('text') || params.get('desc') || params.get('items');

    if (!mealParam && !calParam && !textParam) {
      return false; // Regular visit, no publish payload
    }

    const dateParam = params.get('date') || getTodayIso();
    const timeParam = params.get('time') || formatTimeNow();
    const titleParam = params.get('title') || params.get('loc') || '';
    const protParam = parseFloat(params.get('p') || params.get('prot') || params.get('protein') || '0');
    const carbsParam = parseFloat(params.get('c') || params.get('carbs') || '0');
    const fatParam = parseFloat(params.get('f') || params.get('fat') || params.get('lip') || '0');
    const calories = Math.round(parseFloat(calParam || '0'));

    const mealType = normalizeMealType(mealParam || 'lunch');
    const entryId = `${mealType}_${Date.now()}`;

    const newEntry = {
      id: entryId,
      ts: Math.round(Date.now() / 1000),
      date: dateParam,
      time: timeParam,
      meal: mealType,
      title: titleParam,
      text: textParam || 'Repas enregistré',
      calories: calories,
      protein: isNaN(protParam) ? 0 : protParam,
      carbs: isNaN(carbsParam) ? 0 : carbsParam,
      fat: isNaN(fatParam) ? 0 : fatParam,
      synced: false,
    };

    showToast('⏳ Enregistrement du repas en cours...', 'info');

    try {
      await sendMealToFirebase(newEntry);
      selectedDate = dateParam;
      updateDateDisplay();
      await fetchMealsForDate(selectedDate);

      showToast(`✅ ${getMealLabel(mealType)} enregistré (+${calories} kcal) !`, 'success');

      // Clean URL query string without reloading page
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      return true;
    } catch (err) {
      console.error('Failed to publish meal:', err);
      // Backup locally
      saveLocalBackup(newEntry);
      selectedDate = dateParam;
      updateDateDisplay();
      await fetchMealsForDate(selectedDate);
      showToast(`⚠️ Hors ligne : sauvegardé en local (+${calories} kcal)`, 'error');
      return true;
    }
  }

  // --- Firebase Communication ---
  async function sendMealToFirebase(entry) {
    const url = `${getBaseSecretPath()}/days/${entry.date}/${entry.id}.json`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });

    if (!resp.ok) {
      throw new Error(`Firebase error (${resp.status}): ${resp.statusText}`);
    }
    return resp.json();
  }

  async function deleteMealFromFirebase(date, mealId) {
    const url = `${getBaseSecretPath()}/days/${date}/${mealId}.json`;
    const resp = await fetch(url, { method: 'DELETE' });
    if (!resp.ok) {
      throw new Error(`Delete failed (${resp.status})`);
    }
    return true;
  }

  async function fetchMealsForDate(date) {
    showConnectionStatus('checking', 'Chargement...');
    const url = `${getBaseSecretPath()}/days/${date}.json`;

    try {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) {
        if (resp.status === 404) {
          showConnectionStatus('error', 'Base non trouvée (404)');
          renderMeals([], date);
          return;
        }
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const meals = [];

      if (data && typeof data === 'object') {
        for (const [id, val] of Object.entries(data)) {
          if (val && typeof val === 'object') {
            meals.push({ id, ...val });
          }
        }
      }

      // Merge with any local offline backup for this date
      const localBackups = getLocalBackups().filter((m) => m.date === date);
      const existingIds = new Set(meals.map((m) => m.id));
      for (const loc of localBackups) {
        if (!existingIds.has(loc.id)) {
          meals.push(loc);
        }
      }

      // Sort chronologically
      meals.sort((a, b) => {
        const order = { breakfast: 1, lunch: 2, snack: 3, dinner: 4, other: 5 };
        const orderA = order[a.meal] || 99;
        const orderB = order[b.meal] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return (a.time || '').localeCompare(b.time || '');
      });

      currentMeals = meals;
      showConnectionStatus('connected', 'Connecté');
      renderMeals(meals, date);
    } catch (err) {
      console.warn('Could not fetch from Firebase:', err);
      showConnectionStatus('error', 'Non connecté');
      // Load offline meals
      const localMeals = getLocalBackups().filter((m) => m.date === date);
      currentMeals = localMeals;
      renderMeals(localMeals, date);
    }
  }

  // --- Rendering Functions ---
  function renderMeals(meals, date) {
    // 1. Calculate Totals
    let totalCal = 0;
    let totalProt = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    meals.forEach((m) => {
      totalCal += Number(m.calories) || 0;
      totalProt += Number(m.protein) || 0;
      totalCarbs += Number(m.carbs) || 0;
      totalFat += Number(m.fat) || 0;
    });

    totalProt = Math.round(totalProt * 10) / 10;
    totalCarbs = Math.round(totalCarbs * 10) / 10;
    totalFat = Math.round(totalFat * 10) / 10;

    // 2. Update Summary UI
    elValTotalCal.textContent = formatNumber(totalCal);
    const remainingCal = Math.max(0, appConfig.calTarget - totalCal);
    elValRemainingCal.textContent = formatNumber(remainingCal);

    const calPct = Math.min(100, Math.round((totalCal / appConfig.calTarget) * 100));
    elCalProgressFill.style.width = `${calPct}%`;
    if (totalCal > appConfig.calTarget) {
      elCalProgressFill.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
    } else {
      elCalProgressFill.style.background = 'linear-gradient(90deg, #0284c7, #38bdf8)';
    }

    // Protein
    elValProt.textContent = totalProt;
    const protPct = Math.min(100, Math.round((totalProt / appConfig.protTarget) * 100));
    elBarProt.style.width = `${protPct}%`;
    const gPerKg = (totalProt / (appConfig.weightKg || 77.4)).toFixed(1);
    elRatioProt.textContent = `${gPerKg} g/kg (${appConfig.weightKg} kg)`;

    // Carbs
    elValCarbs.textContent = totalCarbs;
    const carbsPct = Math.min(100, Math.round((totalCarbs / appConfig.carbsTarget) * 100));
    elBarCarbs.style.width = `${carbsPct}%`;
    const carbKcal = totalCarbs * 4;
    const carbShare = totalCal > 0 ? Math.round((carbKcal / totalCal) * 100) : 0;
    elRatioCarbs.textContent = `${carbShare}% des kcal`;

    // Fat
    elValFat.textContent = totalFat;
    const fatPct = Math.min(100, Math.round((totalFat / appConfig.fatTarget) * 100));
    elBarFat.style.width = `${fatPct}%`;
    const fatKcal = totalFat * 9;
    const fatShare = totalCal > 0 ? Math.round((fatKcal / totalCal) * 100) : 0;
    elRatioFat.textContent = `${fatShare}% des kcal`;

    // 3. Update Meal List
    elMealsCount.textContent = `${meals.length} repas`;

    if (meals.length === 0) {
      elMealsList.innerHTML = '';
      elMealsList.appendChild(elEmptyState);
      elEmptyState.style.display = 'block';
      return;
    }

    elEmptyState.style.display = 'none';
    elMealsList.innerHTML = '';

    meals.forEach((m) => {
      const card = createMealCard(m);
      elMealsList.appendChild(card);
    });
  }

  function createMealCard(meal) {
    const div = document.createElement('article');
    div.className = 'meal-item';
    div.dataset.mealId = meal.id;

    const label = getMealLabel(meal.meal);
    const badgeClass = `badge-${meal.meal || 'other'}`;
    const timeStr = meal.time ? ` à ${meal.time}` : '';
    const titleStr = meal.title ? ` (${escapeHtml(meal.title)})` : '';

    div.innerHTML = `
      <div class="meal-top">
        <div class="meal-type-title">
          <span class="meal-badge ${badgeClass}">${label}</span>
          <span>${titleStr}</span>
        </div>
        <div class="meal-meta">
          <span>${timeStr}</span>
          <button class="meal-del-btn" title="Supprimer" aria-label="Supprimer ce repas">🗑️</button>
        </div>
      </div>
      <div class="meal-desc">${escapeHtml(meal.text || '')}</div>
      <div class="meal-chips">
        <span class="macro-chip chip-cal">🔥 ${meal.calories || 0} kcal</span>
        <span class="macro-chip chip-prot">🍗 ${meal.protein || 0}g P</span>
        <span class="macro-chip chip-carbs">🍞 ${meal.carbs || 0}g G</span>
        <span class="macro-chip chip-fat">🥑 ${meal.fat || 0}g L</span>
      </div>
    `;

    // Delete handler
    const delBtn = div.querySelector('.meal-del-btn');
    delBtn.addEventListener('click', async () => {
      if (confirm(`Supprimer ${label} ?`)) {
        try {
          await deleteMealFromFirebase(selectedDate, meal.id);
          removeLocalBackup(meal.id);
          showToast('Repas supprimé', 'info');
          fetchMealsForDate(selectedDate);
        } catch (e) {
          alert('Erreur lors de la suppression : ' + e.message);
        }
      }
    });

    return div;
  }

  // --- Local Backup Helpers ---
  function getLocalBackups() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_ENTRIES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLocalBackup(entry) {
    const list = getLocalBackups();
    list.push(entry);
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_ENTRIES, JSON.stringify(list));
    } catch (e) {
      console.warn('Local backup failed', e);
    }
  }

  function removeLocalBackup(id) {
    const list = getLocalBackups().filter((m) => m.id !== id);
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_ENTRIES, JSON.stringify(list));
    } catch (e) {
      console.warn('Local backup update failed', e);
    }
  }

  // --- Toast System ---
  let toastTimer = null;
  function showToast(msg, type = 'success') {
    if (toastTimer) clearTimeout(toastTimer);

    elToastMsg.textContent = msg;
    elToast.className = 'toast';
    if (type === 'error') {
      elToast.classList.add('toast-error');
      elToastIcon.textContent = '⚠️';
    } else if (type === 'info') {
      elToast.classList.add('toast-info');
      elToastIcon.textContent = 'ℹ️';
    } else {
      elToastIcon.textContent = '✅';
    }

    elToast.classList.remove('hidden');
    toastTimer = setTimeout(() => {
      elToast.classList.add('hidden');
    }, 4500);
  }

  // --- Copy Markdown ---
  function copyMarkdownFormat() {
    if (currentMeals.length === 0) {
      showToast('Aucun repas à copier pour cette journée', 'info');
      return;
    }

    const [y, m, d] = selectedDate.split('-');
    const shortDate = `${d}.${m}.${y.slice(2)}`;
    let md = `${shortDate}\n`;

    currentMeals.forEach((m) => {
      const mealName = capitalizeFirst(m.meal || 'Repas');
      const title = m.title ? ` (${m.title})` : '';
      const text = m.text || '';
      const cal = m.calories || 0;
      const p = (m.protein || 0).toFixed(1);
      const c = (m.carbs || 0).toFixed(1);
      const f = (m.fat || 0).toFixed(1);

      md += `${mealName}${title} : ${text} (~${cal} kcal, ${p}g prot, ${c}g gluc, ${f}g lip).\n`;
    });

    navigator.clipboard
      .writeText(md.trim())
      .then(() => {
        showToast('📋 Markdown copié dans le presse-papier !', 'success');
      })
      .catch((e) => {
        prompt('Copiez le texte manuellement :', md);
      });
  }

  // --- Event Bindings ---
  function bindEvents() {
    // Refresh
    elBtnRefresh.addEventListener('click', () => {
      fetchMealsForDate(selectedDate);
    });

    // Copy MD
    elBtnCopyMd.addEventListener('click', copyMarkdownFormat);

    // Toast Close
    elToastClose.addEventListener('click', () => {
      elToast.classList.add('hidden');
    });

    // Date Navigation
    elBtnPrevDay.addEventListener('click', () => {
      selectedDate = addDays(selectedDate, -1);
      updateDateDisplay();
      fetchMealsForDate(selectedDate);
    });

    elBtnNextDay.addEventListener('click', () => {
      selectedDate = addDays(selectedDate, 1);
      updateDateDisplay();
      fetchMealsForDate(selectedDate);
    });

    elDatePicker.addEventListener('change', (e) => {
      if (e.target.value) {
        selectedDate = e.target.value;
        updateDateDisplay();
        fetchMealsForDate(selectedDate);
      }
    });

    elBtnToday.addEventListener('click', () => {
      selectedDate = getTodayIso();
      updateDateDisplay();
      fetchMealsForDate(selectedDate);
    });

    // Add Meal Modal
    elBtnOpenAddModal.addEventListener('click', () => {
      document.getElementById('addMealDate').value = selectedDate;
      document.getElementById('addMealTime').value = formatTimeNow();
      document.getElementById('addMealTitle').value = '';
      document.getElementById('addMealText').value = '';
      document.getElementById('addMealCal').value = '';
      document.getElementById('addMealProt').value = '';
      document.getElementById('addMealCarbs').value = '';
      document.getElementById('addMealFat').value = '';
      modalAddMeal.showModal();
    });

    btnCloseAddModal.addEventListener('click', () => modalAddMeal.close());
    btnCancelAdd.addEventListener('click', () => modalAddMeal.close());

    formAddMeal.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dateVal = document.getElementById('addMealDate').value || selectedDate;
      const mealType = document.getElementById('addMealType').value;
      const timeVal = document.getElementById('addMealTime').value || formatTimeNow();
      const titleVal = document.getElementById('addMealTitle').value.trim();
      const textVal = document.getElementById('addMealText').value.trim();
      const calVal = Math.round(parseFloat(document.getElementById('addMealCal').value || '0'));
      const protVal = parseFloat(document.getElementById('addMealProt').value || '0');
      const carbsVal = parseFloat(document.getElementById('addMealCarbs').value || '0');
      const fatVal = parseFloat(document.getElementById('addMealFat').value || '0');

      const entry = {
        id: `${mealType}_${Date.now()}`,
        ts: Math.round(Date.now() / 1000),
        date: dateVal,
        time: timeVal,
        meal: mealType,
        title: titleVal,
        text: textVal,
        calories: calVal,
        protein: protVal,
        carbs: carbsVal,
        fat: fatVal,
        synced: false,
      };

      try {
        await sendMealToFirebase(entry);
        showToast(`✅ ${getMealLabel(mealType)} ajouté !`, 'success');
      } catch (err) {
        saveLocalBackup(entry);
        showToast('⚠️ Hors ligne : sauvegardé en local', 'error');
      }

      modalAddMeal.close();
      selectedDate = dateVal;
      updateDateDisplay();
      fetchMealsForDate(selectedDate);
    });

    // Settings Modal
    elBtnSettings.addEventListener('click', () => {
      syncConfigToInputs();
      testConnResult.textContent = '';
      testConnResult.className = 'test-result';
      modalSettings.showModal();
    });

    btnCloseSettingsModal.addEventListener('click', () => modalSettings.close());
    btnCancelSettings.addEventListener('click', () => modalSettings.close());

    btnTestConn.addEventListener('click', async () => {
      testConnResult.textContent = 'Test...';
      testConnResult.className = 'test-result';
      const testUrl = document.getElementById('cfgDbUrl').value.trim().replace(/\/+$/, '');
      const testSecret = encodeURIComponent(document.getElementById('cfgSecret').value.trim());

      try {
        const resp = await fetch(`${testUrl}/foodlog/${testSecret}/ping.json`);
        if (resp.ok) {
          testConnResult.textContent = '✓ Connexion OK';
          testConnResult.className = 'test-result ok';
        } else {
          testConnResult.textContent = `Erreur HTTP ${resp.status}`;
          testConnResult.className = 'test-result fail';
        }
      } catch (err) {
        testConnResult.textContent = 'Échec (CORS ou réseau)';
        testConnResult.className = 'test-result fail';
      }
    });

    formSettings.addEventListener('submit', (e) => {
      e.preventDefault();
      const updated = {
        dbUrl: document.getElementById('cfgDbUrl').value.trim(),
        secret: document.getElementById('cfgSecret').value.trim(),
        calTarget: parseInt(document.getElementById('cfgCalTarget').value, 10) || 2200,
        protTarget: parseInt(document.getElementById('cfgProtTarget').value, 10) || 150,
        carbsTarget: parseInt(document.getElementById('cfgCarbsTarget').value, 10) || 260,
        fatTarget: parseInt(document.getElementById('cfgFatTarget').value, 10) || 60,
      };

      saveConfig(updated);
      syncConfigToInputs();
      modalSettings.close();
      showToast('Configuration enregistrée', 'success');
      fetchMealsForDate(selectedDate);
    });
  }

  // --- Utility Helpers ---
  function normalizeMealType(m) {
    const s = String(m || '').toLowerCase();
    if (s.includes('break') || s.includes('petit') || s.includes('dej')) return 'breakfast';
    if (s.includes('snack') || s.includes('collat') || s.includes('gouter')) return 'snack';
    if (s.includes('din') || s.includes('souper')) return 'dinner';
    if (s.includes('lunch') || s.includes('midi')) return 'lunch';
    return 'other';
  }

  function getMealLabel(type) {
    const labels = {
      breakfast: 'Petit-déjeuner',
      lunch: 'Déjeuner',
      snack: 'Collation',
      dinner: 'Dîner',
      other: 'Repas',
    };
    return labels[type] || 'Repas';
  }

  function formatNumber(num) {
    return new Intl.NumberFormat('fr-FR').format(num);
  }

  function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(str));
    return p.innerHTML;
  }

  // Run
  document.addEventListener('DOMContentLoaded', init);
})();
