/**
 * db.js - Unified Database Service (IndexedDB with LocalStorage Fallback)
 * Store Names: users, rewards, applied_rewards | STRICT: <= 300 lines
 */
const DB_NAME = 'RewardsDB', DB_VERSION = 3;

class UnifiedDatabaseService {
  constructor() {
    this.db = null;
    this.initDone = false;
    this.initPromise = this.init();
  }

  async init() {
    this.db = await new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      setTimeout(() => finish(null), 1000);
      try {
        if (!window.indexedDB) return finish(null);
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onblocked = () => finish(null);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', { keyPath: 'phone' });
          if (!db.objectStoreNames.contains('rewards')) {
            const r = db.createObjectStore('rewards', { keyPath: 'id', autoIncrement: true });
            r.createIndex('customerPhone', 'customerPhone', { unique: false });
          }
          if (!db.objectStoreNames.contains('applied_rewards')) {
            const a = db.createObjectStore('applied_rewards', { keyPath: 'id', autoIncrement: true });
            a.createIndex('customerPhone', 'customerPhone', { unique: false });
          }
        };
        req.onsuccess = (e) => {
          const db = e.target.result;
          db.onversionchange = () => { try { db.close(); } catch(err){} };
          finish(db);
        };
        req.onerror = () => finish(null);
      } catch (err) { finish(null); }
    });
    this.initDone = true;
    await this.seedInitialData();
    return this.db;
  }

  async waitInit() { if (!this.initDone) await this.initPromise; }

  async seedInitialData() {
    try {
      const users = await this.getAllUsers();
      if (users.length === 0) {
        await this.registerUser({ name: 'Rahul Sharma', phone: '9876543210', password: 'password123' });
        const seedR = (orderId, productName, orderDate, orderAmount, rewardPoints, expiryDate, img) =>
          this.createReward({ customerName: 'Rahul Sharma', customerPhone: '9876543210', orderId, productName, orderDate, orderAmount, rewardPercent: 10, rewardPoints, expiryDate, cappingPercent: 50, minOrderAmount: 10000, productImage: img || 'assets/smart_google_tv.jpg' });
        await seedR('ORD-5011', 'Sony Bravia 55" Smart Google TV 4K', '2026-10-15', 55000, 5500, '2026-12-31T23:59', 'assets/smart_google_tv.jpg');
        await seedR('ORD-5012', 'MacBook Air M3 Laptop', '2026-11-01', 120000, 12000, '2027-01-31T23:59', 'assets/smart_google_tv.jpg');
        await seedR('ORD-5013', 'Smart Home Automation Suite', '2026-11-10', 330000, 33000, '2027-03-31T23:59', 'assets/smart_google_tv.jpg');
        await this.applyProductReward({
          orderId: 'ORD-APP-9021', customerPhone: '9876543210', customerName: 'Rahul Sharma',
          productName: 'Sony Bravia 4K Smart Google TV', productPrice: 45000,
          pointsApplied: 4500, dueAmount: 40500, cappingPercent: 50,
          productImage: 'assets/smart_google_tv.jpg'
        });
      }
    } catch (e) {}
  }

  cleanPhone(p) { return String(p || '').replace(/\D/g, '').slice(-10); }

  async registerUser(u) {
    await this.waitInit();
    const phone = this.cleanPhone(u.phone) || '9876543210';
    const user = { name: u.name || 'Valued Customer', phone, password: u.password || 'password123', createdAt: new Date().toISOString() };
    if (this.db) {
      return new Promise((res) => {
        try {
          const tx = this.db.transaction(['users'], 'readwrite'), st = tx.objectStore('users');
          const addReq = st.put(user);
          addReq.onsuccess = () => res(user);
          addReq.onerror = () => res(user);
        } catch(err) { res(user); }
      });
    }
    const local = JSON.parse(localStorage.getItem('wf_local_users') || '[]');
    const idx = local.findIndex(x => x.phone === phone);
    if (idx >= 0) local[idx] = user; else local.push(user);
    localStorage.setItem('wf_local_users', JSON.stringify(local));
    return user;
  }

  async loginUser(phone, password) {
    await this.waitInit();
    const p = this.cleanPhone(phone) || '9876543210';
    if (this.db) {
      return new Promise((res) => {
        try {
          const req = this.db.transaction(['users'], 'readonly').objectStore('users').get(p);
          req.onsuccess = () => {
            const u = req.result;
            if (u) {
              this.setCurrentUser(u);
              res(u);
            } else {
              // Create user if not existing and log in
              const newUser = { name: (p === '9876543210' ? 'Rahul Sharma' : 'Valued Customer'), phone: p, password: password || 'password123' };
              this.registerUser(newUser).then(created => { this.setCurrentUser(created); res(created); });
            }
          };
          req.onerror = () => { const fb = { name: 'Rahul Sharma', phone: p }; this.setCurrentUser(fb); res(fb); };
        } catch(err) { const fb = { name: 'Rahul Sharma', phone: p }; this.setCurrentUser(fb); res(fb); }
      });
    }
    const local = JSON.parse(localStorage.getItem('wf_local_users') || '[]');
    let found = local.find(x => x.phone === p);
    if (!found) {
      found = { name: (p === '9876543210' ? 'Rahul Sharma' : 'Valued Customer'), phone: p, password: password || 'password123' };
      local.push(found);
      localStorage.setItem('wf_local_users', JSON.stringify(local));
    }
    this.setCurrentUser(found);
    return found;
  }

  async createReward(data) {
    await this.waitInit();
    const item = {
      ...data,
      customerPhone: this.cleanPhone(data.customerPhone),
      orderAmount: Number(data.orderAmount) || 0,
      rewardPoints: Number(data.rewardPoints) || 0,
      rewardPercent: Number(data.rewardPercent) || 0,
      cappingPercent: Number(data.cappingPercent) || 50,
      minOrderAmount: Number(data.minOrderAmount) || 0,
      productImage: data.productImage || '',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    if (this.db) {
      return new Promise((res, rej) => {
        const req = this.db.transaction(['rewards'], 'readwrite').objectStore('rewards').add(item);
        req.onsuccess = () => { item.id = req.result; res(item); };
        req.onerror = () => rej(req.error);
      });
    }
    const local = JSON.parse(localStorage.getItem('wf_local_rewards') || '[]');
    item.id = Date.now() + Math.floor(Math.random() * 1000);
    local.push(item);
    localStorage.setItem('wf_local_rewards', JSON.stringify(local));
    return item;
  }

  async getRewardsByPhone(phone) {
    await this.waitInit();
    const p = this.cleanPhone(phone);
    if (this.db) {
      return new Promise((res, rej) => {
        const req = this.db.transaction(['rewards'], 'readonly').objectStore('rewards').index('customerPhone').getAll(p);
        req.onsuccess = () => res((req.result || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        req.onerror = () => rej(req.error);
      });
    }
    const local = JSON.parse(localStorage.getItem('wf_local_rewards') || '[]');
    return local.filter(r => this.cleanPhone(r.customerPhone) === p).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async getAllRewards() {
    await this.waitInit();
    if (this.db) {
      return new Promise((res, rej) => {
        const req = this.db.transaction(['rewards'], 'readonly').objectStore('rewards').getAll();
        req.onsuccess = () => res((req.result || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        req.onerror = () => rej(req.error);
      });
    }
    return JSON.parse(localStorage.getItem('wf_local_rewards') || '[]').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async deleteReward(id) {
    await this.waitInit();
    if (this.db) {
      return new Promise((res, rej) => {
        const req = this.db.transaction(['rewards'], 'readwrite').objectStore('rewards').delete(Number(id) || id);
        req.onsuccess = () => res(true);
        req.onerror = () => rej(req.error);
      });
    }
    let local = JSON.parse(localStorage.getItem('wf_local_rewards') || '[]');
    local = local.filter(r => r.id != id);
    localStorage.setItem('wf_local_rewards', JSON.stringify(local));
    return true;
  }

  async getAllUsers() {
    await this.waitInit();
    if (this.db) {
      return new Promise((res, rej) => {
        const req = this.db.transaction(['users'], 'readonly').objectStore('users').getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => rej(req.error);
      });
    }
    return JSON.parse(localStorage.getItem('wf_local_users') || '[]');
  }

  async updateReward(item) {
    if (this.db) {
      return new Promise((res, rej) => {
        const req = this.db.transaction(['rewards'], 'readwrite').objectStore('rewards').put(item);
        req.onsuccess = () => res(item);
        req.onerror = () => rej(req.error);
      });
    }
    const local = JSON.parse(localStorage.getItem('wf_local_rewards') || '[]');
    const idx = local.findIndex(r => r.id == item.id);
    if (idx !== -1) local[idx] = item;
    localStorage.setItem('wf_local_rewards', JSON.stringify(local));
    return item;
  }

  // Apply customer's rewards on a new product purchase (Redemption)
  async applyProductReward(txData) {
    await this.waitInit();
    const phone = this.cleanPhone(txData.customerPhone);
    const pointsToDeduct = Number(txData.pointsApplied) || 0;
    const dueAmount = Number(txData.dueAmount) || 0;

    const record = {
      orderId: txData.orderId || ('ORD-APP-' + Math.floor(1000 + Math.random() * 9000)),
      customerName: txData.customerName, customerPhone: phone,
      productName: txData.productName, productPrice: Number(txData.productPrice) || 0,
      pointsApplied: pointsToDeduct, dueAmount,
      cappingPercent: Number(txData.cappingPercent) || 50,
      maxCappingLimit: Number(txData.maxCappingLimit) || 10000,
      productImage: txData.productImage || '',
      date: txData.date || new Date().toISOString().split('T')[0], createdAt: new Date().toISOString()
    };

    if (this.db) {
      await new Promise((res, rej) => {
        const req = this.db.transaction(['applied_rewards'], 'readwrite').objectStore('applied_rewards').add(record);
        req.onsuccess = () => { record.id = req.result; res(record); };
        req.onerror = () => rej(req.error);
      });
    } else {
      const localApp = JSON.parse(localStorage.getItem('wf_applied_rewards') || '[]');
      record.id = Date.now();
      localApp.push(record);
      localStorage.setItem('wf_applied_rewards', JSON.stringify(localApp));
    }

    const active = (await this.getRewardsByPhone(phone))
      .filter(r => (Number(r.rewardPoints) || 0) > 0 && (!r.expiryDate || new Date(r.expiryDate) > new Date()))
      .sort((a, b) => new Date(a.expiryDate || a.createdAt) - new Date(b.expiryDate || b.createdAt));

    let rem = pointsToDeduct;
    for (const r of active) {
      if (rem <= 0) break;
      const pts = Number(r.rewardPoints) || 0;
      if (pts <= rem) { rem -= pts; r.rewardPoints = 0; r.status = 'USED'; }
      else { r.rewardPoints = pts - rem; rem = 0; }
      await this.updateReward(r);
    }
    return record;
  }

  async getAppliedRewardsByPhone(phone) {
    await this.waitInit();
    const p = this.cleanPhone(phone);
    if (this.db) {
      return new Promise((res, rej) => {
        const req = this.db.transaction(['applied_rewards'], 'readonly').objectStore('applied_rewards').index('customerPhone').getAll(p);
        req.onsuccess = () => res((req.result || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        req.onerror = () => rej(req.error);
      });
    }
    return JSON.parse(localStorage.getItem('wf_applied_rewards') || '[]').filter(r => this.cleanPhone(r.customerPhone) === p).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async getAllAppliedRewards() {
    await this.waitInit();
    if (this.db) {
      return new Promise((res, rej) => {
        const req = this.db.transaction(['applied_rewards'], 'readonly').objectStore('applied_rewards').getAll();
        req.onsuccess = () => res((req.result || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        req.onerror = () => rej(req.error);
      });
    }
    return JSON.parse(localStorage.getItem('wf_applied_rewards') || '[]').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  setCurrentUser(u) { localStorage.setItem('active_customer', JSON.stringify({ name: u.name, phone: this.cleanPhone(u.phone) })); }
  getCurrentUser() {
    try { const s = localStorage.getItem('active_customer'); return s ? JSON.parse(s) : { name: 'Rahul Sharma', phone: '9876543210' }; }
    catch (e) { return { name: 'Rahul Sharma', phone: '9876543210' }; }
  }
  logoutUser() { localStorage.removeItem('active_customer'); }
}
window.rewardsDB = new UnifiedDatabaseService();
