const DB = 'rkham_saas_v1';
let currentUser = null;

let D = {
    bl_list: [],
    clients: [],
    settings: {
        lang: 'ar',
        currency: 'MAD',
        company: { name: '', phone: '', address: '' }
    },
    journal: [],
    staff: [],
    payments: []
};

// ============ UTILITY FUNCTIONS ============
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function formatCurrency(num) {
    let suffix = ' DH';
    if (D.settings.currency === 'EUR') suffix = ' €';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
}

function formatNumber(num, decimals = 2) {
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ============ AUTH / LOGIN ============
function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    if (u === 'admin' && p === 'admin') {
        showApp();
    } else {
        alert(D.settings.lang === 'ar' ? 'خطأ في اسم المستخدم أو كلمة المرور' : 'Nom d\'utilisateur ou mot de passe incorrect');
    }
}

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
        console.error('Google login error:', err);
        alert('خطأ في تسجيل الدخول: ' + err.message);
    });
}

function handleLogout() {
    auth.signOut().then(() => {
        currentUser = null;
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-interface').style.display = 'none';
    });
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-interface').style.display = 'block';
    load();
}

// ============ FIREBASE AUTH STATE ============
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
    }
});

// ============ DATA SAVE/LOAD (FIRESTORE) ============
function save() {
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).set(D)
            .catch(err => console.error('Save error:', err));
    }
    localStorage.setItem(DB, JSON.stringify(D));
}

function load() {
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).get().then(doc => {
            if (doc.exists) {
                const data = doc.data();
                D = { ...D, ...data };
            } else {
                // Try local storage fallback
                const local = localStorage.getItem(DB);
                if (local) {
                    try { D = { ...D, ...JSON.parse(local) }; } catch(e) {}
                }
            }
            refreshAll();
        }).catch(err => {
            console.error('Load error:', err);
            // Fallback to local
            const local = localStorage.getItem(DB);
            if (local) {
                try { D = { ...D, ...JSON.parse(local) }; } catch(e) {}
            }
            refreshAll();
        });
    } else {
        const local = localStorage.getItem(DB);
        if (local) {
            try { D = { ...D, ...JSON.parse(local) }; } catch(e) {}
        }
        refreshAll();
    }
}

// ============ TAB NAVIGATION ============
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    const content = document.getElementById('tab-content-' + tab);
    const btn = document.getElementById('tab-' + tab);

    if (content) content.classList.add('active');
    if (btn) btn.classList.add('active');

    if (tab === 'journal') populateJournal();
    if (tab === 'home') refreshStats();
    if (tab === 'bl') populateBLList();
    if (tab === 'clients') populateClientsList();
    if (tab === 'staff') populateStaffList();
    if (tab === 'settings') populateSettings();
}

// ============ JOURNAL ============
function populateJournal() {
    const tbody = document.getElementById('journal-body');
    const totalAmountEl = document.getElementById('journal-total-amount');
    const totalMetersEl = document.getElementById('journal-total-meters');
    const totalDateEl = document.getElementById('journal-total-date');
    
    if (!D.journal) D.journal = [];
    
    // Also include BL entries in journal
    let allEntries = [...(D.journal || [])];
    
    // Add entries from BLs
    (D.bl_list || []).forEach(bl => {
        (bl.products || []).forEach(prod => {
            allEntries.push({
                id: prod.id || generateId(),
                type: prod.name || 'N/A',
                meters: prod.total_m2 || 0,
                price: prod.pu || 0,
                total: (prod.total_m2 || 0) * (prod.pu || 0),
                date: bl.date || new Date().toISOString().split('T')[0],
                source: 'bl',
                bl_id: bl.id
            });
        });
    });
    
    // Sort by date descending
    allEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let grandTotal = 0;
    let grandMeters = 0;
    
    tbody.innerHTML = allEntries.map(line => {
        const total = Number(line.total) || (Number(line.meters) * Number(line.price));
        grandTotal += total;
        grandMeters += Number(line.meters) || 0;
        
        const dateStr = line.date || new Date().toLocaleDateString('fr-FR');
        const whatsappMsg = encodeURIComponent(
            `${line.type}: ${formatNumber(line.meters)} m² × ${formatNumber(line.price)} = ${formatCurrency(total)}`
        );
        
        const payBadge = line.payment === 'cheque'
            ? '<span class="badge-cheque">Chèque</span>'
            : '<span class="badge-espece">Espèce</span>';

        return `
            <tr>
                <td class="col-type">${line.type || '-'}</td>
                <td class="col-meters"><span dir="ltr" style="display:inline-block;">${formatNumber(line.meters)}</span></td>
                <td class="col-price"><span dir="ltr" style="display:inline-block;">${formatNumber(line.price)}</span></td>
                <td class="col-total"><span dir="ltr" style="display:inline-block;">${formatNumber(total, 0).replace(/,/g, ' ')}</span></td>
                <td class="col-payment">${payBadge}</td>
                <td class="col-date"><span dir="ltr" style="display:inline-block;">${dateStr}</span></td>
                <td class="col-actions">
                    <button class="btn-whatsapp" onclick="window.open('https://wa.me/?text=${whatsappMsg}','_blank')" title="WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    ${line.source !== 'bl' ? `<button class="btn-delete-row" onclick="deleteJournalEntry('${line.id}')" title="حذف"><i class="fas fa-trash"></i></button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
    
    totalDateEl.textContent = new Date().toLocaleDateString('fr-FR');
    totalAmountEl.innerHTML = `<span dir="ltr" style="display:inline-block;">${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/,/g, ' ')}</span>`;
    if (totalMetersEl) totalMetersEl.innerHTML = `<span dir="ltr" style="display:inline-block;">${formatNumber(grandMeters)}</span>`;
}

function deleteJournalEntry(id) {
    if (!confirm(D.settings.lang === 'ar' ? 'هل تريد حذف هذا السطر؟' : 'Supprimer cette entrée ?')) return;
    D.journal = (D.journal || []).filter(e => e.id !== id);
    save();
    populateJournal();
}

function openJournalModal() {
    document.getElementById('journal-modal').style.display = 'flex';
    document.getElementById('journal-form').reset();
    document.getElementById('entry-total').value = '';
    document.getElementById('entry-payment').value = 'espece';
    document.getElementById('pay-cash').classList.add('active');
    document.getElementById('pay-check').classList.remove('active');

    const meters = document.getElementById('entry-meters');
    const price = document.getElementById('entry-price');
    const total = document.getElementById('entry-total');

    const calc = () => {
        const m = parseFloat(meters.value) || 0;
        const p = parseFloat(price.value) || 0;
        total.value = formatCurrency(m * p);
    };

    meters.oninput = calc;
    price.oninput = calc;
}

function closeJournalModal() {
    document.getElementById('journal-modal').style.display = 'none';
}

function selectPayment(method) {
    document.getElementById('entry-payment').value = method;
    document.getElementById('pay-cash').classList.toggle('active', method === 'espece');
    document.getElementById('pay-check').classList.toggle('active', method === 'cheque');
}

function saveQuickEntry(e) {
    e.preventDefault();

    const type = document.getElementById('entry-type').value;
    const meters = parseFloat(document.getElementById('entry-meters').value) || 0;
    const price = parseFloat(document.getElementById('entry-price').value) || 0;
    const total = meters * price;
    const payment = document.getElementById('entry-payment').value || 'espece';

    if (!D.journal) D.journal = [];

    const entry = {
        id: generateId(),
        type: type,
        meters: meters,
        price: price,
        total: total,
        payment: payment,
        date: new Date().toISOString().split('T')[0],
        source: 'direct'
    };
    
    D.journal.push(entry);
    
    // Also add as a BL
    const bl = {
        id: generateId(),
        client: 'بيع مباشر',
        date: new Date().toISOString().split('T')[0],
        products: [{
            id: generateId(),
            name: type,
            pu: price,
            measurements: [{ id: generateId(), length: meters, width: 1, tr: 1 }],
            total_m2: meters,
            total_tr: 1,
            total_ttc: total
        }],
        grand_total_m2: meters,
        grand_total_tr: 1,
        grand_total_ttc: total
    };
    
    D.bl_list.push(bl);
    save();
    refreshAll();
    populateJournal();
    closeJournalModal();
    
    alert(D.settings.lang === 'ar' ? 'تم الحفظ بنجاح!' : 'Enregistré avec succès !');
}

// ============ EXPORT JOURNAL ============
function exportJournal() {
    let text = 'نوع الرخام\tالأمتار\tالثمن\tالمجموع\tالتاريخ\n';
    let allEntries = [...(D.journal || [])];
    (D.bl_list || []).forEach(bl => {
        (bl.products || []).forEach(prod => {
            allEntries.push({
                type: prod.name || '',
                meters: prod.total_m2 || 0,
                price: prod.pu || 0,
                total: (prod.total_m2 || 0) * (prod.pu || 0),
                date: bl.date || ''
            });
        });
    });
    
    allEntries.forEach(e => {
        text += `${e.type}\t${e.meters}\t${e.price}\t${e.total}\t${e.date}\n`;
    });
    
    const blob = new Blob([text], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'journal_' + new Date().toISOString().split('T')[0] + '.tsv';
    a.click();
}

// ============ BL (BON DE LIVRAISON) ============
function openNewBL() {
    document.getElementById('bl-modal').style.display = 'flex';
    document.getElementById('bl-form').reset();
    document.getElementById('bl-date').value = new Date().toISOString().split('T')[0];
    
    // Populate client select
    const select = document.getElementById('bl-client');
    select.innerHTML = '<option value="">-- اختر العميل --</option>';
    (D.clients || []).forEach(c => {
        select.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
    
    // Reset products
    document.getElementById('bl-products').innerHTML = `
        <div class="bl-product-row">
            <input type="text" placeholder="نوع الرخام" class="bl-prod-name">
            <input type="number" step="0.01" placeholder="المساحة" class="bl-prod-meters" oninput="calcBLRow(this)">
            <input type="number" step="0.01" placeholder="الثمن" class="bl-prod-price" oninput="calcBLRow(this)">
            <span class="bl-prod-total">0.00</span>
        </div>
    `;
    document.getElementById('bl-grand-total').textContent = '0.00';
}

function closeBLModal() {
    document.getElementById('bl-modal').style.display = 'none';
}

function addBLProductRow() {
    const container = document.getElementById('bl-products');
    const row = document.createElement('div');
    row.className = 'bl-product-row';
    row.innerHTML = `
        <input type="text" placeholder="نوع الرخام" class="bl-prod-name">
        <input type="number" step="0.01" placeholder="المساحة" class="bl-prod-meters" oninput="calcBLRow(this)">
        <input type="number" step="0.01" placeholder="الثمن" class="bl-prod-price" oninput="calcBLRow(this)">
        <span class="bl-prod-total">0.00</span>
    `;
    container.appendChild(row);
}

function calcBLRow(input) {
    const row = input.closest('.bl-product-row');
    const meters = parseFloat(row.querySelector('.bl-prod-meters').value) || 0;
    const price = parseFloat(row.querySelector('.bl-prod-price').value) || 0;
    row.querySelector('.bl-prod-total').textContent = formatNumber(meters * price);
    
    // Update grand total
    let grand = 0;
    document.querySelectorAll('.bl-product-row').forEach(r => {
        const m = parseFloat(r.querySelector('.bl-prod-meters').value) || 0;
        const p = parseFloat(r.querySelector('.bl-prod-price').value) || 0;
        grand += m * p;
    });
    document.getElementById('bl-grand-total').textContent = formatNumber(grand);
}

function saveBL(e) {
    e.preventDefault();
    
    const client = document.getElementById('bl-client').value || 'عميل غير محدد';
    const date = document.getElementById('bl-date').value;
    
    const products = [];
    let grandM2 = 0, grandTotal = 0;
    
    document.querySelectorAll('.bl-product-row').forEach(row => {
        const name = row.querySelector('.bl-prod-name').value;
        const meters = parseFloat(row.querySelector('.bl-prod-meters').value) || 0;
        const price = parseFloat(row.querySelector('.bl-prod-price').value) || 0;
        const total = meters * price;
        
        if (name && meters > 0) {
            products.push({
                id: generateId(),
                name, pu: price,
                total_m2: meters, total_tr: 1, total_ttc: total,
                measurements: [{ id: generateId(), length: meters, width: 1, tr: 1 }]
            });
            grandM2 += meters;
            grandTotal += total;
        }
    });
    
    if (products.length === 0) {
        alert('يرجى إضافة منتج واحد على الأقل');
        return;
    }
    
    const bl = {
        id: generateId(),
        client, date, products,
        grand_total_m2: grandM2,
        grand_total_tr: products.length,
        grand_total_ttc: grandTotal
    };
    
    D.bl_list.push(bl);
    save();
    closeBLModal();
    refreshAll();
    alert(D.settings.lang === 'ar' ? 'تم حفظ الوصل!' : 'BL enregistré !');
}

function populateBLList() {
    const container = document.getElementById('bl-list');
    if (!D.bl_list || D.bl_list.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">لا توجد وصولات بعد</p>';
        return;
    }
    
    container.innerHTML = D.bl_list.slice().reverse().map(bl => `
        <div class="bl-card card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <strong>${bl.client}</strong>
                <span style="color:var(--text-muted);font-size:0.85rem;">${bl.date}</span>
            </div>
            <div style="font-size:0.85rem;color:var(--text-muted);">
                ${(bl.products || []).map(p => `${p.name}: ${formatNumber(p.total_m2)}m² × ${formatNumber(p.pu)}`).join('<br>')}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:8px;border-top:1px solid var(--border);">
                <strong style="color:var(--primary);">${formatCurrency(bl.grand_total_ttc)}</strong>
                <div>
                    <button class="btn-whatsapp" onclick="shareBL('${bl.id}')" title="WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button class="btn-delete-row" onclick="deleteBL('${bl.id}')" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function deleteBL(id) {
    if (!confirm('هل تريد حذف هذا الوصل؟')) return;
    D.bl_list = D.bl_list.filter(b => b.id !== id);
    save();
    populateBLList();
    populateJournal();
}

function shareBL(id) {
    const bl = D.bl_list.find(b => b.id === id);
    if (!bl) return;
    
    let msg = `*وصل التسليم*\n`;
    msg += `العميل: ${bl.client}\n`;
    msg += `التاريخ: ${bl.date}\n\n`;
    
    (bl.products || []).forEach(p => {
        msg += `- ${p.name}: ${formatNumber(p.total_m2)}m² × ${formatNumber(p.pu)} = ${formatCurrency(p.total_ttc)}\n`;
    });
    
    msg += `\n*المجموع: ${formatCurrency(bl.grand_total_ttc)}*`;
    
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

// ============ CLIENTS ============
function openNewClient() {
    document.getElementById('client-modal').style.display = 'flex';
    document.getElementById('client-form').reset();
}

function closeClientModal() {
    document.getElementById('client-modal').style.display = 'none';
}

function saveClient(e) {
    e.preventDefault();
    
    const client = {
        id: generateId(),
        name: document.getElementById('client-name').value,
        phone: document.getElementById('client-phone').value,
        address: document.getElementById('client-address').value
    };
    
    if (!D.clients) D.clients = [];
    D.clients.push(client);
    save();
    closeClientModal();
    populateClientsList();
    alert(D.settings.lang === 'ar' ? 'تم إضافة العميل!' : 'Client ajouté !');
}

function getClientDebt(clientName) {
    let total = 0, paid = 0;
    (D.bl_list || []).forEach(bl => {
        if (bl.client === clientName) total += bl.grand_total_ttc || 0;
    });
    (D.payments || []).forEach(p => {
        if (p.clientName === clientName) paid += p.amount || 0;
    });
    return { total, paid, remaining: total - paid };
}

function populateClientsList() {
    const container = document.getElementById('clients-list');
    const summaryBar = document.getElementById('clients-debt-summary');

    if (!D.clients || D.clients.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">لا يوجد عملاء بعد</p>';
        if (summaryBar) summaryBar.style.display = 'none';
        return;
    }

    let grandTotal = 0, grandPaid = 0;

    container.innerHTML = D.clients.map(c => {
        const debt = getClientDebt(c.name);
        grandTotal += debt.total;
        grandPaid += debt.paid;
        return `
        <div class="client-card card">
            <h3 style="margin-bottom:6px;">${c.name}</h3>
            ${c.phone ? `<p style="color:var(--text-muted);font-size:0.85rem;"><i class="fas fa-phone"></i> ${c.phone}</p>` : ''}
            ${c.address ? `<p style="color:var(--text-muted);font-size:0.85rem;"><i class="fas fa-map-marker-alt"></i> ${c.address}</p>` : ''}
            <div class="client-debt-row">
                <div class="client-debt-item">
                    <span>إجمالي الفواتير</span>
                    <strong>${formatCurrency(debt.total)}</strong>
                </div>
                <div class="client-debt-item">
                    <span>المدفوع</span>
                    <strong style="color:var(--success);">${formatCurrency(debt.paid)}</strong>
                </div>
                <div class="client-debt-item">
                    <span>الباقي</span>
                    <strong style="color:${debt.remaining > 0 ? 'var(--danger)' : 'var(--success)'};">${formatCurrency(debt.remaining)}</strong>
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="btn btn-primary btn-sm" onclick="openPaymentModal('${c.id}','${c.name}')">
                    <i class="fas fa-hand-holding-usd"></i> دفعة
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteClient('${c.id}')">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </div>
        </div>`;
    }).join('');

    if (summaryBar) {
        summaryBar.style.display = 'flex';
        document.getElementById('debt-total').textContent = formatCurrency(grandTotal);
        document.getElementById('debt-paid').textContent = formatCurrency(grandPaid);
        document.getElementById('debt-remaining').textContent = formatCurrency(grandTotal - grandPaid);
    }
}

function deleteClient(id) {
    if (!confirm('هل تريد حذف هذا العميل؟')) return;
    D.clients = D.clients.filter(c => c.id !== id);
    save();
    populateClientsList();
}

// ============ PAYMENTS ============
function openPaymentModal(clientId, clientName) {
    document.getElementById('payment-modal').style.display = 'flex';
    document.getElementById('payment-client-id').value = clientId;
    document.getElementById('payment-form').reset();
    document.getElementById('payment-client-id').value = clientId;
    document.getElementById('payment-modal').dataset.clientName = clientName;
    document.getElementById('payment-method').value = 'espece';
    document.getElementById('pmnt-cash').classList.add('active');
    document.getElementById('pmnt-check').classList.remove('active');
}

function closePaymentModal() {
    document.getElementById('payment-modal').style.display = 'none';
}

function selectPaymentModal(method) {
    document.getElementById('payment-method').value = method;
    document.getElementById('pmnt-cash').classList.toggle('active', method === 'espece');
    document.getElementById('pmnt-check').classList.toggle('active', method === 'cheque');
}

function savePayment(e) {
    e.preventDefault();
    const clientName = document.getElementById('payment-modal').dataset.clientName;
    const amount = parseFloat(document.getElementById('payment-amount').value) || 0;
    const method = document.getElementById('payment-method').value;

    if (!D.payments) D.payments = [];
    D.payments.push({
        id: generateId(),
        clientName,
        amount,
        method,
        date: new Date().toISOString().split('T')[0]
    });
    save();
    closePaymentModal();
    populateClientsList();
}

// ============ STAFF ============
function openStaffModal() {
    document.getElementById('staff-modal').style.display = 'flex';
    document.getElementById('staff-form').reset();
}

function closeStaffModal() {
    document.getElementById('staff-modal').style.display = 'none';
}

function saveStaff(e) {
    e.preventDefault();
    if (!D.staff) D.staff = [];
    D.staff.push({
        id: generateId(),
        name: document.getElementById('staff-name').value,
        amount: parseFloat(document.getElementById('staff-amount').value) || 0,
        note: document.getElementById('staff-note').value,
        date: new Date().toISOString().split('T')[0]
    });
    save();
    closeStaffModal();
    populateStaffList();
}

function populateStaffList() {
    const container = document.getElementById('staff-list');
    if (!D.staff || D.staff.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">لا يوجد خدامة بعد</p>';
        return;
    }

    let totalPaid = 0;
    const cards = D.staff.slice().reverse().map(s => {
        totalPaid += s.amount || 0;
        return `
        <div class="staff-card">
            <div class="staff-card-header">
                <div class="staff-avatar"><i class="fas fa-hard-hat"></i></div>
                <div>
                    <div class="staff-card-name">${s.name}</div>
                    ${s.note ? `<div class="staff-card-note">${s.note}</div>` : ''}
                    <div class="staff-card-note">${s.date}</div>
                </div>
            </div>
            <div class="staff-card-amount">
                <span>المبلغ المدفوع</span>
                <strong>${formatCurrency(s.amount)}</strong>
            </div>
            <button class="btn btn-danger btn-sm" style="margin-top:10px;width:100%;" onclick="deleteStaff('${s.id}')">
                <i class="fas fa-trash"></i> حذف
            </button>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="card" style="grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:linear-gradient(135deg,#fef3c7,#fde68a);">
            <span style="font-weight:700;color:#92400e;">إجمالي المدفوع للخدامة</span>
            <strong style="font-size:1.2rem;color:#92400e;">${formatCurrency(totalPaid)}</strong>
        </div>
        ${cards}`;
}

function deleteStaff(id) {
    if (!confirm('هل تريد حذف هذا السطر؟')) return;
    D.staff = D.staff.filter(s => s.id !== id);
    save();
    populateStaffList();
}

// ============ SETTINGS ============
function populateSettings() {
    document.getElementById('setting-lang').value = D.settings.lang || 'ar';
    document.getElementById('setting-currency').value = D.settings.currency || 'MAD';
    document.getElementById('setting-company').value = D.settings.company?.name || '';
    document.getElementById('setting-phone').value = D.settings.company?.phone || '';
}

function changeLang(lang) {
    D.settings.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    
    document.querySelectorAll('[data-' + lang + ']').forEach(el => {
        el.textContent = el.getAttribute('data-' + lang);
    });
    
    save();
}

function changeCurrency(currency) {
    D.settings.currency = currency;
    save();
    populateJournal();
}

function saveSettings() {
    D.settings.company = {
        name: document.getElementById('setting-company').value,
        phone: document.getElementById('setting-phone').value
    };
    save();
    alert(D.settings.lang === 'ar' ? 'تم الحفظ بنجاح!' : 'Enregistré avec succès !');
}

// ============ STATS / DASHBOARD ============
function refreshStats() {
    const blCount = (D.bl_list || []).length;
    const clientCount = (D.clients || []).length;

    let totalRevenue = 0, totalM2 = 0;
    (D.bl_list || []).forEach(bl => {
        totalRevenue += bl.grand_total_ttc || 0;
        totalM2 += bl.grand_total_m2 || 0;
    });

    let totalPaid = 0;
    (D.payments || []).forEach(p => { totalPaid += p.amount || 0; });

    const totalDebt = totalRevenue - totalPaid;

    document.getElementById('stat-bl-count').textContent = blCount;
    document.getElementById('stat-total-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('stat-total-m2').textContent = formatNumber(totalM2) + ' m²';
    document.getElementById('stat-client-count').textContent = clientCount;

    const debtEl = document.getElementById('stat-total-debt');
    if (debtEl) debtEl.textContent = formatCurrency(totalDebt);
}

// ============ REFRESH ALL ============
function refreshAll() {
    populateJournal();
    refreshStats();
}


// ============ SHARE JOURNAL TO WHATSAPP ============
function shareJournalToWhatsApp() {
    let allEntries = [...(D.journal || [])];
    (D.bl_list || []).forEach(bl => {
        (bl.products || []).forEach(prod => {
            allEntries.push({
                type: prod.name || '',
                meters: prod.total_m2 || 0,
                price: prod.pu || 0,
                total: (prod.total_m2 || 0) * (prod.pu || 0),
                date: bl.date || ''
            });
        });
    });
    
    let msg = `*سجل المبيعات - ${new Date().toLocaleDateString('fr-FR')}*\n\n`;
    let grandTotal = 0;
    
    allEntries.forEach(e => {
        const t = e.total || (e.meters * e.price);
        grandTotal += t;
        msg += `• ${e.type}: ${formatNumber(e.meters)}m² × ${formatNumber(e.price)} = ${formatCurrency(t)}\n`;
    });
    
    msg += `\n*المجموع الكلي: ${formatCurrency(grandTotal)}*`;
    
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    showApp();
    
    // Auto-calculate in journal modal
    const metersInput = document.getElementById('entry-meters');
    const priceInput = document.getElementById('entry-price');
    if (metersInput && priceInput) {
        const calc = () => {
            const m = parseFloat(metersInput.value) || 0;
            const p = parseFloat(priceInput.value) || 0;
            document.getElementById('entry-total').value = formatCurrency(m * p);
        };
        metersInput.addEventListener('input', calc);
        priceInput.addEventListener('input', calc);
    }
});
