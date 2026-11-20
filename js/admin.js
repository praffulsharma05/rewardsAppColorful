/**
 * admin.js - Admin Panel Core Controller
 * Handles Grant Form, Settings, Feed & Navigation | STRICT: <= 300 lines
 */
document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const adminForm = $('adminRewardForm'), orderAmountInput = $('orderAmount'), rewardPercentInput = $('rewardPercent'), rewardPointsInput = $('rewardPoints');
  const photoInput = $('productPhoto'), photoPreview = $('photoPreview'), btnSampleData = $('btnSampleData'), adminRewardsList = $('adminRewardsList');
  const adminToast = $('admin-toast'), btnAdminRefresh = $('btn-admin-refresh'), btnResetForm = $('btnResetForm');
  const statIssuedPoints = $('stat-issued-points'), statRewardsCount = $('stat-rewards-count'), statUsersCount = $('stat-users-count'), statAppliedCount = $('stat-applied-count');
  const navTabItems = document.querySelectorAll('.nav-tab-item[data-screen]'), adminScreens = document.querySelectorAll('.admin-screen');
  let base64PhotoData = '', activeFeedTab = 'all';

  window.switchAdminScreen = function(targetId) {
    adminScreens.forEach(s => s.classList.toggle('active', s.id === targetId));
    navTabItems.forEach(t => t.classList.toggle('active', t.dataset.screen === targetId));
    if (targetId === 'screen-issued' || targetId === 'screen-overview') loadRewardsAndStats();
    if (targetId === 'screen-apply' && window.initApplyRewardsScreen) window.initApplyRewardsScreen();
  };

  navTabItems.forEach(tab => tab.addEventListener('click', (e) => { e.preventDefault(); window.switchAdminScreen(tab.dataset.screen); }));

  window.showAdminToast = function(msg) {
    if (!adminToast) return;
    adminToast.textContent = msg; adminToast.classList.add('toast-visible');
    setTimeout(() => adminToast.classList.remove('toast-visible'), 3500);
  };

  const SETTINGS_KEY = 'rewards_app_admin_settings_v1', defaultSettings = { rewardPercent: 10, expiryMonths: 2, cappingPercent: 50, minOrderAmount: 10000 };
  window.getAdminSettings = function() {
    try { const s = localStorage.getItem(SETTINGS_KEY); if (s) return { ...defaultSettings, ...JSON.parse(s) }; } catch (e) {}
    return { ...defaultSettings };
  };
  function saveAdminSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
  function calculateExpiryDate(months) {
    const d = new Date(); d.setMonth(d.getMonth() + months); const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function applySettingsToUI(s) {
    const setVal = (id, v) => { const el = $(id); if (el) el.value = v; };
    const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    setVal('settingRewardPercent', s.rewardPercent); setVal('settingExpiryMonths', s.expiryMonths);
    setVal('settingCappingPercent', s.cappingPercent); setVal('settingMinOrderAmount', s.minOrderAmount);
    setText('settingsBadgeReward', `${s.rewardPercent}%`); setText('settingsBadgeExpiry', `${s.expiryMonths}M`);
    setText('settingsBadgeCapping', `${s.cappingPercent}%  `);
    setText('pointsGivenRateBadge', `${s.rewardPercent}% Policy`);
    if (rewardPercentInput) rewardPercentInput.value = s.rewardPercent;
    setVal('expiryDate', calculateExpiryDate(s.expiryMonths)); setVal('cappingPercent', s.cappingPercent);
    setVal('minOrderAmount', s.minOrderAmount); setVal('applyCappingPercent', s.cappingPercent); setVal('applyMaxCappingLimit', s.minOrderAmount);
    if (window.recalculateApplyMath) window.recalculateApplyMath();
    updatePointsFromPercent();
  }

  function updatePointsFromPercent() {
    const amount = parseFloat(orderAmountInput.value) || 0, pct = parseFloat(rewardPercentInput ? rewardPercentInput.value : 10) || 10;
    const box = document.getElementById('pointsGivenContainer'), badge = document.getElementById('pointsGivenRateBadge');
    if (badge) badge.textContent = `${pct}% Policy`;
    if (amount > 0 && pct >= 0) {
      if (rewardPointsInput) rewardPointsInput.value = Math.round((amount * pct) / 100);
      if (box) box.classList.remove('u-hidden');
    } else {
      if (rewardPointsInput) rewardPointsInput.value = '';
      if (box) box.classList.add('u-hidden');
    }
  }

  if (orderAmountInput) orderAmountInput.addEventListener('input', updatePointsFromPercent);
  if (rewardPercentInput) rewardPercentInput.addEventListener('input', updatePointsFromPercent);

  // Settings form submit
  const adminSettingsForm = $('adminSettingsForm');
  if (adminSettingsForm) {
    adminSettingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const getNum = (id, def) => parseFloat($(id)?.value) || def;
      const newSettings = { rewardPercent: getNum('settingRewardPercent', 10), expiryMonths: getNum('settingExpiryMonths', 2), cappingPercent: getNum('settingCappingPercent', 50), minOrderAmount: getNum('settingMinOrderAmount', 0) };
      saveAdminSettings(newSettings); applySettingsToUI(newSettings);
      window.showAdminToast('✅ Settings updated & applied!');
      setTimeout(() => window.switchAdminScreen('screen-grant'), 600);
    });
  }

  // Explicit Reset for Grant Form
  window.resetGrantForm = function() {
    if (adminForm) adminForm.reset();
    ['customerName', 'customerPhone', 'orderId', 'productName', 'orderAmount', 'rewardPoints'].forEach(id => { const el = $(id); if (el) el.value = ''; });
    const dateIn = $('orderDate'); if (dateIn) dateIn.value = new Date().toISOString().split('T')[0];
    base64PhotoData = '';
    if (photoInput) photoInput.value = '';
    const upTxt = $('photoUploadText'); if (upTxt) upTxt.textContent = 'Choose product photo';
    if (photoPreview) photoPreview.innerHTML = '<span>NO<br>PHOTO</span>';
    const ptsBox = $('pointsGivenContainer'); if (ptsBox) ptsBox.classList.add('u-hidden');
    applySettingsToUI(window.getAdminSettings());
  };

  if (btnAdminRefresh) btnAdminRefresh.addEventListener('click', async () => { window.resetGrantForm(); if (window.resetApplyForm) window.resetApplyForm(); await loadRewardsAndStats(); window.showAdminToast('Refreshed & reloaded'); });
  if (btnResetForm) btnResetForm.addEventListener('click', () => { window.resetGrantForm(); window.showAdminToast('Form fields cleared'); });
  if (btnSampleData) {
    btnSampleData.addEventListener('click', () => {
      const setVal = (id, val) => { const el = $(id); if (el) el.value = val; };
      setVal('customerName', 'Rahul Sharma'); setVal('customerPhone', '9876543210');
      setVal('orderId', 'ORD-' + Math.floor(10000 + Math.random() * 90000));
      setVal('productName', 'Sony 55" 4K Smart Google TV'); setVal('orderAmount', '45000');
      setVal('orderDate', new Date().toISOString().split('T')[0]);
      base64PhotoData = 'assets/smart_google_tv.jpg';
      const upTxt = $('photoUploadText'); if (upTxt) upTxt.textContent = 'smart_google_tv.jpg';
      if (photoPreview) photoPreview.innerHTML = `<img src="${base64PhotoData}" alt="Thumb" />`;
      updatePointsFromPercent();
      window.showAdminToast('Loaded sample ₹45,000 Smart Google TV order');
    });
  }

  const btnSampleTv = $('btnUseSampleTvPhotoGrant');
  if (btnSampleTv) {
    btnSampleTv.addEventListener('click', () => {
      base64PhotoData = 'assets/smart_google_tv.jpg';
      const upTxt = $('photoUploadText'); if (upTxt) upTxt.textContent = 'smart_google_tv.jpg';
      if (photoPreview) photoPreview.innerHTML = `<img src="${base64PhotoData}" alt="Thumb" />`;
      window.showAdminToast('Attached Smart TV photo to Grant form');
    });
  }

  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const upTxt = $('photoUploadText');
      if (!file) {
        base64PhotoData = '';
        if (upTxt) upTxt.textContent = 'Choose product photo';
        photoPreview.innerHTML = '<span>NO<br>PHOTO</span>';
        return;
      }
      if (upTxt) upTxt.textContent = file.name;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const cvs = document.createElement('canvas'); cvs.width = 160; cvs.height = 120;
          const ctx = cvs.getContext('2d'), r = Math.max(160 / img.width, 120 / img.height);
          const nw = img.width * r, nh = img.height * r;
          ctx.drawImage(img, (160 - nw) / 2, (120 - nh) / 2, nw, nh);
          base64PhotoData = cvs.toDataURL('image/jpeg', 0.85);
          photoPreview.innerHTML = `<img src="${base64PhotoData}" alt="Thumb" />`;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Grant Form Submit
  if (adminForm) {
    adminForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const getVal = (id) => ($(id)?.value || '').trim();
      const customerName = getVal('customerName'), customerPhone = getVal('customerPhone'), orderId = getVal('orderId'), productName = getVal('productName'), orderDate = getVal('orderDate');
      const orderAmount = parseFloat(orderAmountInput.value) || 0, settings = window.getAdminSettings();
      const rewardPoints = Math.round((orderAmount * settings.rewardPercent) / 100), expiryDate = calculateExpiryDate(settings.expiryMonths);
      if (!customerName || !customerPhone || !orderAmount) return window.showAdminToast('Please fill all fields');
      try {
        await window.rewardsDB.createReward({
          customerName, customerPhone, orderId, productName, orderDate, orderAmount,
          rewardPercent: settings.rewardPercent, rewardPoints, expiryDate,
          cappingPercent: settings.cappingPercent, minOrderAmount: settings.minOrderAmount,
          productImage: base64PhotoData, status: 'ACTIVE'
        });
        window.showAdminToast(`✅ Granted ${rewardPoints} PTS to ${customerName}`);
        window.resetGrantForm(); await loadRewardsAndStats();
        setTimeout(() => window.switchAdminScreen('screen-issued'), 700);
      } catch (err) { window.showAdminToast('Error: ' + err.message); }
    });
  }

  // Feed Filter buttons
  const btnFeedAll = $('btnFeedAll'), btnFeedApplied = $('btnFeedApplied');
  function setFeedTab(tab) {
    activeFeedTab = tab;
    if (btnFeedAll) btnFeedAll.className = `wf-btn wf-btn-sm ${tab === 'all' ? '' : 'wf-btn-secondary'}`;
    if (btnFeedApplied) btnFeedApplied.className = `wf-btn wf-btn-sm ${tab === 'applied' ? '' : 'wf-btn-secondary'}`;
    loadRewardsAndStats();
  }
  if (btnFeedAll) btnFeedAll.addEventListener('click', () => setFeedTab('all'));
  if (btnFeedApplied) btnFeedApplied.addEventListener('click', () => setFeedTab('applied'));

  window.loadRewardsAndStats = async function() {
    try {
      const rewards = await window.rewardsDB.getAllRewards(), users = await window.rewardsDB.getAllUsers(), applied = await window.rewardsDB.getAllAppliedRewards();
      if (statIssuedPoints) statIssuedPoints.textContent = rewards.reduce((s, r) => s + (Number(r.rewardPoints) || 0), 0).toLocaleString();
      if (statRewardsCount) statRewardsCount.textContent = rewards.length;
      if (statUsersCount) statUsersCount.textContent = users.length;
      if (statAppliedCount) statAppliedCount.textContent = applied.length;
      if (!adminRewardsList) return;
      adminRewardsList.innerHTML = '';

      if (activeFeedTab === 'applied') {
        if (applied.length === 0) {
          adminRewardsList.innerHTML = '<div class="wf-card dashed empty-feed-card">No applied rewards yet.</div>';
          return;
        }
        applied.forEach(item => {
          const ord = (item.orderId && item.orderId !== 'N/A' && item.orderId.trim()) ? item.orderId : ('ORD-' + (item.id || 101));
          const card = document.createElement('div');
          card.className = 'reward-card is-expandable';
          card.innerHTML = `
            <div class="reward-card-header reward-card-header-btn" role="button" tabindex="0">
              <div class="reward-card-item">
                <div class="thumb-box thumb-box-applied">
                  ${item.productImage ? `<img src="${item.productImage}" alt="">` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`}
                </div>
                <div class="reward-card-info">
                  <div class="admin-applied-header">
                    <strong class="reward-card-title">${item.productName}</strong>
                    <span class="pill-applied-pts">-${item.pointsApplied.toLocaleString()} PTS</span>
                  </div>
                  <div class="reward-card-subrow">
                    <span class="card-customer-sub">${item.customerName}</span>
                    <span class="card-date-text">${item.date}</span>
                  </div>
                </div>
                <div class="reward-card-chevron-box"><span class="chevron-icon"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg></span></div>
              </div>
            </div>
            <div class="reward-card-drawer">
              <div class="reward-drawer-inner reward-drawer-pad">
                <div class="reward-breakdown-card">
                  <div class="breakdown-row"><span class="breakdown-label">Customer:</span><span class="breakdown-val">${item.customerName} (+91 ${item.customerPhone})</span></div>
                  <div class="breakdown-row"><span class="breakdown-label">Order Ref:</span><span class="breakdown-val"><code class="val-order-code">#${ord}</code> <button type="button" class="btn-copy-order" data-order="${ord}" title="Copy Order ID"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copy</span></button></span></div>
                  <div class="breakdown-row"><span class="breakdown-label">Product Price:</span><span class="breakdown-val breakdown-bold">₹${Number(item.productPrice).toLocaleString()}</span></div>
                  <div class="breakdown-row"><span class="breakdown-label">Rewards Applied:</span><span class="breakdown-val font-brand-blue">-${item.pointsApplied.toLocaleString()} PTS (${item.cappingPercent}% Cap)</span></div>
                  <div class="breakdown-row breakdown-row-due"><span class="breakdown-label breakdown-due-label">Due Paid to Shopkeeper:</span><span class="breakdown-val breakdown-due-amount">₹${Number(item.dueAmount).toLocaleString()}</span></div>
                </div>
              </div>
            </div>`;
          card.querySelector('.reward-card-header').addEventListener('click', () => card.classList.toggle('is-expanded'));
          card.querySelector('.btn-copy-order')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (navigator.clipboard) navigator.clipboard.writeText(ord);
            const gIn = $('orderId'); if (gIn) gIn.value = ord;
            const btn = ev.currentTarget;
            btn.classList.add('copied'); btn.innerHTML = '<span>Copied!</span>';
            window.showAdminToast(`Copied #${ord} to clipboard & Grant form!`);
            setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copy</span>'; }, 2000);
          });
          adminRewardsList.appendChild(card);
        });
        return;
      }

      if (rewards.length === 0) {
        adminRewardsList.innerHTML = '<div class="wf-card dashed empty-feed-card">No rewards granted yet.</div>';
        return;
      }

      rewards.forEach(item => {
        const isExp = item.expiryDate && new Date(item.expiryDate) < new Date();
        const card = document.createElement('div');
        card.className = `reward-card ${isExp ? 'is-expired' : ''}`;
        card.innerHTML = `
          <div class="admin-reward-card-body" style="display: flex; gap: 8px; align-items: center;">
            <div class="thumb-box" style="width: 38px; height: 38px; min-width: 38px; border-radius: 8px; overflow: hidden; background: #f1f5f9; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0;">
              ${item.productImage ? `<img src="${item.productImage}" alt="" style="width: 100%; height: 100%; object-fit: cover;" />` : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--glacier-700)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`}
            </div>
            <div style="flex: 1; min-width: 0;">
              <strong class="reward-card-title">${item.productName}</strong>
              <div class="wf-meta">${item.customerName} • +${Number(item.rewardPoints).toLocaleString()} PTS</div>
              <small class="card-date-text">Exp: ${item.expiryDate ? item.expiryDate.split('T')[0] : 'N/A'}</small>
            </div>
            <div class="admin-header-actions">
              <span class="header-pill card-pill-mini ${isExp ? 'pill-expired' : 'pill-active'}">${isExp ? 'EXPIRED' : 'ACTIVE'}</span>
              <button type="button" class="btn-del-reward" title="Delete Reward" data-id="${item.id}">
                <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          </div>`;
        card.querySelector('.btn-del-reward').addEventListener('click', (ev) => {
          ev.stopPropagation();
          openDeleteConfirm(item.id, item.productName || item.customerName, item.rewardPoints);
        });
        adminRewardsList.appendChild(card);
      });
    } catch (e) { console.error(e); }
  };

  // Delete Confirmation Modal Logic
  let pendingDeleteId = null;
  const delModal = $('confirmDeleteModal'), btnCancelDel = $('btnCancelDelete'), btnConfirmDel = $('btnConfirmDelete'), delMsg = $('confirmDeleteModalMsg');
  function openDeleteConfirm(id, name, pts) {
    pendingDeleteId = id;
    if (delMsg) delMsg.textContent = `Are you sure you want to delete reward for "${name}" (+${Number(pts || 0).toLocaleString()} PTS)?`;
    if (delModal) delModal.classList.add('is-open');
  }
  function closeDeleteConfirm() { pendingDeleteId = null; if (delModal) delModal.classList.remove('is-open'); }
  if (btnCancelDel) btnCancelDel.addEventListener('click', closeDeleteConfirm);
  if (btnConfirmDel) {
    btnConfirmDel.addEventListener('click', async () => {
      if (pendingDeleteId) {
        await window.rewardsDB.deleteReward(pendingDeleteId);
        window.showAdminToast('Reward deleted successfully');
        closeDeleteConfirm(); loadRewardsAndStats();
      }
    });
  }

  // Init
  applySettingsToUI(window.getAdminSettings());
  const dateIn = $('orderDate');
  if (dateIn && !dateIn.value) dateIn.value = new Date().toISOString().split('T')[0];
  await loadRewardsAndStats();
});
