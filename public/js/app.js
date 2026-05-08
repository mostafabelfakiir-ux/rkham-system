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
    payments: [],
    masarif: [],
    fournisseurs: [],
    fourn_bls: [],
    fourn_payments: []
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
    if (tab === 'masarif') populateMasarif();
    if (tab === 'fournisseur') populateFournisseurList();
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

let _journalSubmitting = false;
function saveQuickEntry(e) {
    e.preventDefault();
    if (_journalSubmitting) return;
    _journalSubmitting = true;

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
    save();
    refreshAll();
    populateJournal();
    closeJournalModal();
    _journalSubmitting = false;
    
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
            <input type="number" step="0.01" placeholder="المساحة" class="bl-prod-meters" oninput="calcBLRow(this)" lang="fr">
            <input type="number" step="0.01" placeholder="الثمن" class="bl-prod-price" oninput="calcBLRow(this)" lang="fr">
            <span class="bl-prod-total">0.00</span>
        </div>
    `;
    document.getElementById('bl-grand-total').textContent = '0.00';
}

function closeBLModal() {
    document.getElementById('bl-modal').style.display = 'none';
    _blEditId = null;
}

function addBLProductRow() {
    const container = document.getElementById('bl-products');
    const row = document.createElement('div');
    row.className = 'bl-product-row';
    row.innerHTML = `
        <input type="text" placeholder="نوع الرخام" class="bl-prod-name">
        <input type="number" step="0.01" placeholder="المساحة" class="bl-prod-meters" oninput="calcBLRow(this)" lang="fr">
        <input type="number" step="0.01" placeholder="الثمن" class="bl-prod-price" oninput="calcBLRow(this)" lang="fr">
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

let _blEditId = null;
let _blSubmitting = false;
function saveBL(e) {
    e.preventDefault();
    if (_blSubmitting) return;
    _blSubmitting = true;
    
    const client = document.getElementById('bl-client').value || 'عميل غير محدد';
    const date = document.getElementById('bl-date').value;
    
    const products = [];
    let grandM2 = 0, grandTotal = 0;
    
    document.querySelectorAll('#bl-modal .bl-product-row').forEach(row => {
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
        _blSubmitting = false;
        alert('يرجى إضافة منتج واحد على الأقل');
        return;
    }
    
    if (_blEditId) {
        // UPDATE existing BL
        const idx = D.bl_list.findIndex(b => b.id === _blEditId);
        if (idx !== -1) {
            D.bl_list[idx].client = client;
            D.bl_list[idx].date = date;
            D.bl_list[idx].products = products;
            D.bl_list[idx].grand_total_m2 = grandM2;
            D.bl_list[idx].grand_total_tr = products.length;
            D.bl_list[idx].grand_total_ttc = grandTotal;
        }
        _blEditId = null;
    } else {
        // CREATE new BL
        const bl = {
            id: generateId(),
            client, date, products,
            grand_total_m2: grandM2,
            grand_total_tr: products.length,
            grand_total_ttc: grandTotal
        };
        D.bl_list.push(bl);
    }
    
    save();
    closeBLModal();
    refreshAll();
    _blSubmitting = false;
    alert(D.settings.lang === 'ar' ? 'تم حفظ الوصل!' : 'BL enregistré !');
}

function editBL(id) {
    const bl = D.bl_list.find(b => b.id === id);
    if (!bl) return;
    _blEditId = id;
    
    document.getElementById('bl-modal').style.display = 'flex';
    document.getElementById('bl-date').value = bl.date || new Date().toISOString().split('T')[0];
    
    // Populate client select
    const select = document.getElementById('bl-client');
    select.innerHTML = '<option value="">-- اختر العميل --</option>';
    (D.clients || []).forEach(c => {
        select.innerHTML += `<option value="${c.name}" ${c.name === bl.client ? 'selected' : ''}>${c.name}</option>`;
    });
    if (!D.clients.find(c => c.name === bl.client)) {
        select.innerHTML += `<option value="${bl.client}" selected>${bl.client}</option>`;
    }
    
    // Populate existing products
    const container = document.getElementById('bl-products');
    container.innerHTML = '';
    (bl.products || []).forEach(p => {
        const row = document.createElement('div');
        row.className = 'bl-product-row';
        row.innerHTML = `
            <input type="text" placeholder="نوع الرخام" class="bl-prod-name" value="${p.name || ''}">
            <input type="number" step="0.01" placeholder="المساحة" class="bl-prod-meters" value="${p.total_m2 || ''}" oninput="calcBLRow(this)" lang="fr">
            <input type="number" step="0.01" placeholder="الثمن" class="bl-prod-price" value="${p.pu || ''}" oninput="calcBLRow(this)" lang="fr">
            <span class="bl-prod-total">${formatNumber((p.total_m2 || 0) * (p.pu || 0))}</span>
        `;
        container.appendChild(row);
    });
    
    document.getElementById('bl-grand-total').textContent = formatNumber(bl.grand_total_ttc || 0);
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
                <div style="display:flex;gap:5px;align-items:center;">
                    <button class="btn-edit-bl" onclick="editBL('${bl.id}')" title="تعديل">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="btn-whatsapp" onclick="shareBL('${bl.id}')" title="WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button class="btn-print-a4" onclick="printBL('${bl.id}','a4')" title="A4">
                        <i class="fas fa-print"></i> A4
                    </button>
                    <button class="btn-print-thermal" onclick="printBL('${bl.id}','thermal')" title="Ticket">
                        <i class="fas fa-receipt"></i>
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

    // Revenue from BLs
    let totalRevenueBL = 0, totalM2 = 0;
    (D.bl_list || []).forEach(bl => {
        totalRevenueBL += bl.grand_total_ttc || 0;
        totalM2 += bl.grand_total_m2 || 0;
    });
    // Revenue from direct journal entries
    let totalRevenueDirect = 0;
    (D.journal || []).forEach(j => {
        totalRevenueDirect += j.total || (j.meters * j.price) || 0;
    });
    const totalRevenue = totalRevenueBL + totalRevenueDirect;

    let totalPaid = 0;
    (D.payments || []).forEach(p => { totalPaid += p.amount || 0; });

    const totalDebt = totalRevenueBL - totalPaid;

    document.getElementById('stat-bl-count').textContent = blCount;
    document.getElementById('stat-total-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('stat-total-m2').textContent = formatNumber(totalM2) + ' m²';
    document.getElementById('stat-client-count').textContent = clientCount;

    const debtEl = document.getElementById('stat-total-debt');
    if (debtEl) debtEl.textContent = formatCurrency(totalDebt);

    // Total expenses (masarif + staff + fourn)
    let totalMasarif = 0;
    (D.masarif || []).forEach(m => { totalMasarif += m.amount || 0; });
    let totalStaff = 0;
    (D.staff || []).forEach(s => { totalStaff += s.amount || 0; });
    let totalFournPaid = 0;
    (D.fourn_payments || []).forEach(fp => { totalFournPaid += fp.amount || 0; });
    const totalCharges = totalMasarif + totalStaff + totalFournPaid;

    const masarifEl = document.getElementById('stat-total-masarif');
    if (masarifEl) masarifEl.textContent = formatCurrency(totalMasarif);

    // P&L: Net Profit
    const netProfit = totalRevenue - totalCharges;
    const profitEl = document.getElementById('stat-net-profit');
    if (profitEl) {
        profitEl.textContent = formatCurrency(netProfit);
        profitEl.style.color = netProfit >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    const chargesEl = document.getElementById('stat-total-charges');
    if (chargesEl) chargesEl.textContent = formatCurrency(totalCharges);

    // Live Stock = m² purchased - m² sold
    let stockIn = 0, stockOut = 0;
    (D.fourn_bls || []).forEach(b => { (b.products || []).forEach(p => { stockIn += p.meters || 0; }); });
    (D.bl_list || []).forEach(bl => { stockOut += bl.grand_total_m2 || 0; });
    const liveStockEl = document.getElementById('stat-live-stock');
    if (liveStockEl) liveStockEl.textContent = formatNumber(Math.max(0, stockIn - stockOut)) + ' m²';
}

// ============ REFRESH ALL ============
function refreshAll() {
    populateJournal();
    refreshStats();
    if (document.getElementById('masarif-body')) populateMasarif();
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

// ============ MASARIF ============
function openMasarifModal() {
    document.getElementById('masarif-modal').style.display = 'flex';
    document.getElementById('masarif-form').reset();
    document.getElementById('masarif-payment').value = 'espece';
    document.getElementById('mas-cash').classList.add('active');
    document.getElementById('mas-check').classList.remove('active');
}

function closeMasarifModal() {
    document.getElementById('masarif-modal').style.display = 'none';
}

function selectMasarifPayment(method) {
    document.getElementById('masarif-payment').value = method;
    document.getElementById('mas-cash').classList.toggle('active', method === 'espece');
    document.getElementById('mas-check').classList.toggle('active', method === 'cheque');
}

function saveMasarif(e) {
    e.preventDefault();
    if (!D.masarif) D.masarif = [];
    D.masarif.push({
        id: generateId(),
        type: document.getElementById('masarif-type').value,
        amount: parseFloat(document.getElementById('masarif-amount').value) || 0,
        payment: document.getElementById('masarif-payment').value || 'espece',
        note: document.getElementById('masarif-note').value,
        date: new Date().toISOString().split('T')[0]
    });
    save();
    closeMasarifModal();
    populateMasarif();
    refreshStats();
}

function deleteMasarif(id) {
    if (!confirm('هل تريد حذف هذا المصروف؟')) return;
    D.masarif = D.masarif.filter(m => m.id !== id);
    save();
    populateMasarif();
    refreshStats();
}

function populateMasarif() {
    const tbody = document.getElementById('masarif-body');
    const totalEl = document.getElementById('masarif-total');
    const dateEl = document.getElementById('masarif-total-date');
    if (!D.masarif) D.masarif = [];

    const sorted = D.masarif.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    let grand = 0;

    tbody.innerHTML = sorted.map(m => {
        grand += m.amount || 0;
        const payBadge = m.payment === 'cheque'
            ? '<span class="badge-cheque">Chèque</span>'
            : '<span class="badge-espece">Espèce</span>';
        return `
            <tr>
                <td class="col-type">${m.type || '-'}</td>
                <td class="col-total"><span dir="ltr" style="display:inline-block;">${formatNumber(m.amount, 0).replace(/,/g, ' ')}</span></td>
                <td class="col-payment">${payBadge}</td>
                <td class="col-date"><span dir="ltr" style="display:inline-block;">${m.date || '-'}</span></td>
                <td class="col-type">${m.note || '-'}</td>
                <td class="col-actions">
                    <button class="btn-delete-row" onclick="deleteMasarif('${m.id}')" title="حذف"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    }).join('');

    dateEl.textContent = new Date().toLocaleDateString('fr-FR');
    totalEl.innerHTML = `<span dir="ltr" style="display:inline-block;">${grand.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/,/g, ' ')}</span>`;
}

function exportMasarif() {
    let text = 'النوع\tالمبلغ\tالدفع\tالتاريخ\tالملاحظة\n';
    (D.masarif || []).forEach(m => {
        text += `${m.type}\t${m.amount}\t${m.payment}\t${m.date}\t${m.note || ''}\n`;
    });
    const blob = new Blob([text], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'masarif_' + new Date().toISOString().split('T')[0] + '.tsv';
    a.click();
}

// ============ FOURNISSEURS ============
function openNewFournisseur() {
    document.getElementById('fournisseur-modal').style.display = 'flex';
    document.getElementById('fournisseur-form').reset();
    document.getElementById('fourn-payment-default').value = 'espece';
    document.getElementById('fourn-pay-cash').classList.add('active');
    document.getElementById('fourn-pay-check').classList.remove('active');
    document.getElementById('fourn-marble-types-list').innerHTML = `
        <div class="fourn-marble-type-row">
            <input type="text" class="fourn-marble-type-input" placeholder="مثال: galax, emperador...">
        </div>`;
}

function addMarbleTypeRow() {
    const container = document.getElementById('fourn-marble-types-list');
    const row = document.createElement('div');
    row.className = 'fourn-marble-type-row';
    row.innerHTML = `
        <input type="text" class="fourn-marble-type-input" placeholder="نوع آخر...">
        <button type="button" class="btn-remove-row" onclick="this.closest('.fourn-marble-type-row').remove()">
            <i class="fas fa-times"></i>
        </button>`;
    container.appendChild(row);
}

function closeFournisseurModal() {
    document.getElementById('fournisseur-modal').style.display = 'none';
}

function selectFournisseurPayment(method) {
    document.getElementById('fourn-payment-default').value = method;
    document.getElementById('fourn-pay-cash').classList.toggle('active', method === 'espece');
    document.getElementById('fourn-pay-check').classList.toggle('active', method === 'cheque');
}

function saveFournisseur(e) {
    e.preventDefault();
    const marbleTypes = [...document.querySelectorAll('.fourn-marble-type-input')]
        .map(i => i.value.trim()).filter(v => v);
    if (!D.fournisseurs) D.fournisseurs = [];
    D.fournisseurs.push({
        id: generateId(),
        name: document.getElementById('fourn-name').value,
        phone: document.getElementById('fourn-phone').value,
        marble_types: marbleTypes,
        payment_default: document.getElementById('fourn-payment-default').value,
        note: document.getElementById('fourn-note').value
    });
    save();
    closeFournisseurModal();
    populateFournisseurList();
}

function deleteFournisseur(id) {
    if (!confirm('هل تريد حذف هذا الفورنيسور؟')) return;
    D.fournisseurs = D.fournisseurs.filter(f => f.id !== id);
    save();
    populateFournisseurList();
}

function getFournisseurDebt(fournId) {
    let total = 0, paid = 0;
    (D.fourn_bls || []).forEach(bl => {
        if (bl.fournisseur_id === fournId) total += bl.grand_total || 0;
    });
    (D.fourn_payments || []).forEach(p => {
        if (p.fournisseur_id === fournId) paid += p.amount || 0;
    });
    return { total, paid, remaining: total - paid };
}

function populateFournisseurList() {
    const container = document.getElementById('fournisseur-list');
    const summaryBar = document.getElementById('fournisseur-debt-summary');
    if (!D.fournisseurs) D.fournisseurs = [];

    if (D.fournisseurs.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">لا يوجد فورنيسور بعد</p>';
        if (summaryBar) summaryBar.style.display = 'none';
        return;
    }

    let grandTotal = 0, grandPaid = 0;

    container.innerHTML = D.fournisseurs.map(f => {
        const debt = getFournisseurDebt(f.id);
        grandTotal += debt.total;
        grandPaid += debt.paid;
        const bls = (D.fourn_bls || []).filter(b => b.fournisseur_id === f.id);
        return `
        <div class="client-card card">
            <h3 style="margin-bottom:6px;">${f.name}</h3>
            ${f.phone ? `<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:3px;"><i class="fas fa-phone"></i> ${f.phone}</p>` : ''}
            ${(f.marble_types && f.marble_types.length > 0) ? `<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:3px;"><i class="fas fa-layer-group"></i> ${f.marble_types.join(' · ')}</p>` : (f.marble_type ? `<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:3px;"><i class="fas fa-layer-group"></i> ${f.marble_type}</p>` : '')}
            ${f.payment_default ? `<p style="font-size:0.85rem;margin-bottom:3px;">
                <i class="fas fa-credit-card"></i>
                ${f.payment_default === 'cheque'
                    ? '<span class="badge-cheque">Chèque</span>'
                    : '<span class="badge-espece">Espèce</span>'}
            </p>` : ''}
            ${f.note ? `<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:3px;"><i class="fas fa-sticky-note"></i> ${f.note}</p>` : ''}
            <div class="client-debt-row">
                <div class="client-debt-item">
                    <span>إجمالي الشراء</span>
                    <strong>${formatCurrency(debt.total)}</strong>
                </div>
                <div class="client-debt-item">
                    <span>المدفوع</span>
                    <strong style="color:var(--success);">${formatCurrency(debt.paid)}</strong>
                </div>
                <div class="client-debt-item">
                    <span>ما خلصناهمش</span>
                    <strong style="color:${debt.remaining > 0 ? 'var(--danger)' : 'var(--success)'};">${formatCurrency(debt.remaining)}</strong>
                </div>
            </div>
            ${bls.length > 0 ? `
            <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px;">
                <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;"><i class="fas fa-file-invoice"></i> فواتير الشراء</div>
                ${bls.slice().reverse().map(b => `
                <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;margin-bottom:6px;border:1px solid var(--border);">
                    <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                        <span style="font-size:0.78rem;color:var(--text-muted);"><i class="fas fa-calendar-alt"></i> ${b.date}</span>
                        <strong style="color:var(--primary);font-size:0.88rem;">${formatCurrency(b.grand_total)}</strong>
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:0.78rem;">
                        <thead>
                            <tr style="background:#e2e8f0;">
                                <th style="padding:3px 6px;text-align:right;border-radius:4px 0 0 4px;">النوع</th>
                                <th style="padding:3px 6px;text-align:center;">الكمية</th>
                                <th style="padding:3px 6px;text-align:center;">الثمن</th>
                                <th style="padding:3px 6px;text-align:center;border-radius:0 4px 4px 0;">المجموع</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(b.products || []).map(p => `
                            <tr style="border-bottom:1px dashed #e2e8f0;">
                                <td style="padding:3px 6px;font-weight:600;">${p.name}</td>
                                <td style="padding:3px 6px;text-align:center;" dir="ltr">${formatNumber(p.meters)} m²</td>
                                <td style="padding:3px 6px;text-align:center;" dir="ltr">${formatNumber(p.price)}</td>
                                <td style="padding:3px 6px;text-align:center;font-weight:700;color:var(--success);" dir="ltr">${formatCurrency(p.total)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`).join('')}
            </div>` : ''}
            ${(D.fourn_payments || []).filter(p => p.fournisseur_id === f.id).length > 0 ? `
            <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px;">
                <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:4px;">المدفوعات</div>
                ${(D.fourn_payments || []).filter(p => p.fournisseur_id === f.id).slice().reverse().map(p => `
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;padding:4px 0;border-bottom:1px dashed var(--border);">
                    <span style="color:var(--text-muted);">${p.date}</span>
                    <span>
                        ${p.method === 'cheque'
                            ? `<span class="badge-cheque">Chèque${p.cheque_num ? ' #' + p.cheque_num : ''}</span>`
                            : `<span class="badge-espece">Espèce</span>`}
                    </span>
                    <strong style="color:var(--success);">${formatCurrency(p.amount)}</strong>
                </div>`).join('')}
            </div>` : ''}
            <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="btn btn-primary btn-sm" onclick="openFournBLModal('${f.id}','${f.name.replace(/'/g,"\\'")}')">
                    <i class="fas fa-file-invoice"></i> فاتورة شراء
                </button>
                <button class="btn btn-success btn-sm" onclick="openFournPaymentModal('${f.id}')">
                    <i class="fas fa-hand-holding-usd"></i> دفعة
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteFournisseur('${f.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');

    if (summaryBar) {
        summaryBar.style.display = 'flex';
        document.getElementById('fourn-total').textContent = formatCurrency(grandTotal);
        document.getElementById('fourn-paid').textContent = formatCurrency(grandPaid);
        document.getElementById('fourn-remaining').textContent = formatCurrency(grandTotal - grandPaid);
    }
}

// FOURNISSEUR BL
function fournProductRowHTML(removable) {
    return `<div class="fourn-prod-row">
        <input type="text" placeholder="نوع الرخام" class="fourn-prod-name">
        <input type="number" step="0.01" placeholder="م²" class="fourn-prod-meters" oninput="calcFournRow(this)" lang="fr">
        <input type="number" step="0.01" placeholder="الثمن" class="fourn-prod-price" oninput="calcFournRow(this)" lang="fr">
        <span class="fourn-prod-total">0.00</span>
        ${removable ? `<button type="button" class="btn-remove-row" onclick="removeFournRow(this)" title="حذف"><i class="fas fa-times"></i></button>` : '<span style="width:22px;display:inline-block;"></span>'}
    </div>`;
}

function openFournBLModal(fournId, fournName) {
    document.getElementById('fourn-bl-modal').style.display = 'flex';
    document.getElementById('fourn-bl-fournisseur-id').value = fournId;
    document.getElementById('fourn-bl-fournisseur-name').value = fournName;
    document.getElementById('fourn-bl-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('fourn-bl-products').innerHTML = fournProductRowHTML(false);
    document.getElementById('fourn-bl-grand-total').textContent = '0.00';
}

function closeFournBLModal() {
    document.getElementById('fourn-bl-modal').style.display = 'none';
}

function addFournProductRow() {
    const container = document.getElementById('fourn-bl-products');
    const div = document.createElement('div');
    div.innerHTML = fournProductRowHTML(true);
    container.appendChild(div.firstElementChild);
}

function removeFournRow(btn) {
    const row = btn.closest('.fourn-prod-row');
    row.remove();
    calcFournGrand();
}

function calcFournGrand() {
    let grand = 0;
    document.querySelectorAll('#fourn-bl-products .fourn-prod-row').forEach(r => {
        const m = parseFloat(r.querySelector('.fourn-prod-meters').value) || 0;
        const p = parseFloat(r.querySelector('.fourn-prod-price').value) || 0;
        grand += m * p;
    });
    document.getElementById('fourn-bl-grand-total').textContent = formatNumber(grand);
}

function calcFournRow(input) {
    const row = input.closest('.fourn-prod-row');
    const meters = parseFloat(row.querySelector('.fourn-prod-meters').value) || 0;
    const price = parseFloat(row.querySelector('.fourn-prod-price').value) || 0;
    row.querySelector('.fourn-prod-total').textContent = formatNumber(meters * price);
    calcFournGrand();
}

function saveFournBL(e) {
    e.preventDefault();
    const fournId = document.getElementById('fourn-bl-fournisseur-id').value;
    const date = document.getElementById('fourn-bl-date').value;
    const products = [];
    let grandTotal = 0;

    document.querySelectorAll('#fourn-bl-products .fourn-prod-row').forEach(row => {
        const name = row.querySelector('.fourn-prod-name').value;
        const meters = parseFloat(row.querySelector('.fourn-prod-meters').value) || 0;
        const price = parseFloat(row.querySelector('.fourn-prod-price').value) || 0;
        if (name && meters > 0) {
            const total = meters * price;
            products.push({ name, meters, price, total });
            grandTotal += total;
        }
    });

    if (products.length === 0) { alert('يرجى إضافة منتج واحد على الأقل'); return; }

    if (!D.fourn_bls) D.fourn_bls = [];
    D.fourn_bls.push({ id: generateId(), fournisseur_id: fournId, date, products, grand_total: grandTotal });
    save();
    closeFournBLModal();
    populateFournisseurList();
}

// FOURNISSEUR PAYMENT
function openFournPaymentModal(fournId) {
    document.getElementById('fourn-payment-modal').style.display = 'flex';
    document.getElementById('fourn-payment-id').value = fournId;
    document.getElementById('fourn-payment-form').reset();
    document.getElementById('fourn-payment-id').value = fournId;
    document.getElementById('fourn-payment-method').value = 'espece';
    document.getElementById('fp-cash').classList.add('active');
    document.getElementById('fp-check').classList.remove('active');
    document.getElementById('fourn-cheque-row').style.display = 'none';
    document.getElementById('fourn-cheque-num').value = '';
}

function closeFournPaymentModal() {
    document.getElementById('fourn-payment-modal').style.display = 'none';
}

function selectFournPayment(method) {
    document.getElementById('fourn-payment-method').value = method;
    document.getElementById('fp-cash').classList.toggle('active', method === 'espece');
    document.getElementById('fp-check').classList.toggle('active', method === 'cheque');
    document.getElementById('fourn-cheque-row').style.display = method === 'cheque' ? 'block' : 'none';
    if (method !== 'cheque') document.getElementById('fourn-cheque-num').value = '';
}

function saveFournPayment(e) {
    e.preventDefault();
    const fournId = document.getElementById('fourn-payment-id').value;
    const amount = parseFloat(document.getElementById('fourn-payment-amount').value) || 0;
    const method = document.getElementById('fourn-payment-method').value;
    const chequeNum = document.getElementById('fourn-cheque-num').value.trim();
    if (!D.fourn_payments) D.fourn_payments = [];
    D.fourn_payments.push({
        id: generateId(),
        fournisseur_id: fournId,
        amount,
        method,
        cheque_num: method === 'cheque' ? chequeNum : '',
        date: new Date().toISOString().split('T')[0]
    });
    save();
    closeFournPaymentModal();
    populateFournisseurList();
}

// ============ PRINT ============
function printBL(id, format) {
    const bl = D.bl_list.find(b => b.id === id);
    if (!bl) return;
    const company = D.settings.company || {};
    const isA4 = format === 'a4';

    const rows = (bl.products || []).map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${formatNumber(p.total_m2)} m²</td>
            <td>${formatNumber(p.pu)}</td>
            <td>${formatCurrency(p.total_ttc)}</td>
        </tr>`).join('');

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
        <meta charset="UTF-8">
        <title>وصل التسليم</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: 'Tajawal', Arial, sans-serif; font-size:${isA4 ? '13px' : '11px'}; width:${isA4 ? '210mm' : '80mm'}; padding:${isA4 ? '20mm' : '6mm'}; }
            .header { text-align:center; margin-bottom:${isA4 ? '16px' : '8px'}; border-bottom:2px solid #333; padding-bottom:8px; }
            .header h1 { font-size:${isA4 ? '20px' : '14px'}; }
            .header p { font-size:${isA4 ? '12px' : '10px'}; color:#555; }
            .info { display:flex; justify-content:space-between; margin:${isA4 ? '12px 0' : '6px 0'}; font-size:${isA4 ? '12px' : '10px'}; }
            table { width:100%; border-collapse:collapse; margin:${isA4 ? '12px 0' : '6px 0'}; }
            th { background:#2563eb; color:white; padding:${isA4 ? '8px' : '4px'}; text-align:center; font-size:${isA4 ? '12px' : '10px'}; }
            td { padding:${isA4 ? '7px' : '3px 4px'}; text-align:center; border-bottom:1px solid #ddd; font-size:${isA4 ? '12px' : '10px'}; }
            .total { text-align:left; margin-top:${isA4 ? '12px' : '6px'}; font-size:${isA4 ? '15px' : '12px'}; font-weight:700; border-top:2px solid #333; padding-top:6px; }
            .footer { text-align:center; margin-top:${isA4 ? '20px' : '10px'}; font-size:${isA4 ? '11px' : '9px'}; color:#888; border-top:1px dashed #ccc; padding-top:6px; }
            ${isA4 ? '.signature { display:flex; justify-content:space-between; margin-top:40px; } .sig-box { text-align:center; } .sig-line { border-top:1px solid #333; width:120px; margin:0 auto; padding-top:4px; font-size:11px; color:#555; }' : ''}
        </style>
    </head><body>
        <div class="header">
            <h1>${company.name || 'نظام الرخام'}</h1>
            ${company.phone ? `<p>📞 ${company.phone}</p>` : ''}
            <p>${isA4 ? 'وصل التسليم' : 'فاتورة مبسطة'}</p>
        </div>
        <div class="info">
            <span>العميل: <strong>${bl.client}</strong></span>
            <span>التاريخ: <strong>${bl.date}</strong></span>
        </div>
        <table>
            <thead><tr><th>النوع</th><th>م²</th><th>الثمن</th><th>المجموع</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="total">المجموع الكلي: ${formatCurrency(bl.grand_total_ttc)}</div>
        ${isA4 ? `<div class="signature"><div class="sig-box"><div class="sig-line">توقيع المورد</div></div><div class="sig-box"><div class="sig-line">توقيع العميل</div></div></div>` : ''}
        <div class="footer">شكراً على ثقتكم</div>
    </body></html>`;

    const win = window.open('', '_blank', `width=${isA4 ? 800 : 350},height=600`);
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); };
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
