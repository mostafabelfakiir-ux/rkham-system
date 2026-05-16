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
    fourn_payments: [],
    products: [],
    stock_sales: []
};

// ============ UTILITY FUNCTIONS ============
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function formatCurrency(num) {
    let suffix = ' DH';
    if (D.settings.currency === 'EUR') suffix = ' €';
    // Force en-US locale to guarantee Western Arabic numerals (1234567890)
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
}

function formatNumber(num, decimals = 2) {
    // Force en-US locale to guarantee Western Arabic numerals (1234567890)
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Converts Eastern Arabic/Indic digits (٠١٢٣٤٥٦٧٨٩) to Western Arabic (0-9)
 * and strips any character that is not a digit, dot, or leading minus.
 */
function toWesternFloat(str) {
    // Normalize Eastern Arabic-Indic digits
    str = String(str).replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    // Replace Arabic decimal comma with dot
    str = str.replace(/،/g, '.').replace(/,/g, '.');
    // Keep only digits, one dot, and optional leading minus
    str = str.replace(/[^0-9.\-]/g, '');
    // Prevent multiple dots
    const parts = str.split('.');
    if (parts.length > 2) str = parts[0] + '.' + parts.slice(1).join('');
    return str;
}

/**
 * Attaches paste + input sanitizer to a numeric text input so it:
 * - Accepts floats (preserves decimal point)
 * - Converts Eastern Arabic digits to Western Arabic
 * - Strips all non-numeric characters except dot
 */
function attachNumericSanitizer(input) {
    if (!input || input.dataset.sanitized) return;
    input.dataset.sanitized = '1';

    input.addEventListener('paste', function(e) {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const cleaned = toWesternFloat(pasted);
        // Insert at cursor position
        const start = this.selectionStart;
        const end = this.selectionEnd;
        const current = this.value;
        this.value = current.substring(0, start) + cleaned + current.substring(end);
        // Re-sanitize the whole value
        this.value = toWesternFloat(this.value);
        this.dispatchEvent(new Event('input', { bubbles: true }));
    });

    input.addEventListener('input', function() {
        const caret = this.selectionStart;
        const cleaned = toWesternFloat(this.value);
        if (this.value !== cleaned) {
            this.value = cleaned;
            // Restore caret (best effort)
            try { this.setSelectionRange(caret, caret); } catch(e) {}
        }
    });
}

/** Attaches sanitizer to all numeric inputs within a container (or document) */
function sanitizeNumericInputs(container) {
    const root = container || document;
    root.querySelectorAll('input[data-numeric]').forEach(attachNumericSanitizer);
}

// ============ AUTH / LOGIN ============
function toggleAuthMode(e) {
    if (e) e.preventDefault();
    const modeInput = document.getElementById('auth-mode');
    const submitText = document.getElementById('auth-submit-text');
    const toggleLabel = document.getElementById('toggle-label');
    const toggleBtn = document.getElementById('toggle-auth-btn');
    
    if (modeInput.value === 'login') {
        modeInput.value = 'register';
        submitText.textContent = D.settings.lang === 'ar' ? 'إنشاء حساب جديد' : 'Créer un compte';
        toggleLabel.textContent = D.settings.lang === 'ar' ? 'لديك حساب بالفعل؟' : 'Vous avez déjà un compte ?';
        toggleBtn.textContent = D.settings.lang === 'ar' ? 'تسجيل الدخول' : 'Se connecter';
    } else {
        modeInput.value = 'login';
        submitText.textContent = D.settings.lang === 'ar' ? 'تسجيل الدخول' : 'Se connecter';
        toggleLabel.textContent = D.settings.lang === 'ar' ? 'ليس لديك حساب؟' : 'Pas de compte ?';
        toggleBtn.textContent = D.settings.lang === 'ar' ? 'إنشاء حساب جديد' : 'Créer un compte';
    }
}

let _authSubmitting = false;
function handleLogin(e) {
    e.preventDefault();
    if (_authSubmitting) return;
    _authSubmitting = true;

    const mode = document.getElementById('auth-mode').value;
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;

    const btn = document.getElementById('auth-submit-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-left: 8px;"></i> ' + (D.settings.lang === 'ar' ? 'جاري التحميل...' : 'Chargement...');
    btn.disabled = true;

    if (mode === 'register') {
        auth.createUserWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                alert(D.settings.lang === 'ar' ? 'تم إنشاء الحساب بنجاح!' : 'Compte créé avec succès !');
                _authSubmitting = false;
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            })
            .catch((err) => {
                console.error('Registration error:', err);
                alert((D.settings.lang === 'ar' ? 'خطأ في إنشاء الحساب: ' : 'Erreur de création: ') + err.message);
                _authSubmitting = false;
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            });
    } else {
        auth.signInWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                _authSubmitting = false;
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            })
            .catch((err) => {
                console.error('Login error:', err);
                alert((D.settings.lang === 'ar' ? 'خطأ في البريد الإلكتروني أو كلمة المرور: ' : 'Email ou mot de passe incorrect: ') + err.message);
                _authSubmitting = false;
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            });
    }
}


function handleLogout() {
    auth.signOut().then(() => {
        currentUser = null;
        showLoginScreen();
    });
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-interface').style.display = 'block';
    load();
}

function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-interface').style.display = 'none';
}

// ============ FIREBASE AUTH STATE ============
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        showApp();
    } else {
        currentUser = null;
        showLoginScreen();
    }
});

// ============ DATA SAVE/LOAD (FIRESTORE) ============
function save() {
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).set(D)
            .catch(err => console.error('Save error:', err));
        localStorage.setItem(DB + '_' + currentUser.uid, JSON.stringify(D));
    }
}

function freshD() {
    return {
        bl_list: [], clients: [], journal: [], staff: [], payments: [],
        masarif: [], fournisseurs: [], fourn_bls: [], fourn_payments: [],
        settings: { lang: 'ar', currency: 'MAD', company: { name: '', phone: '', address: '' } }
    };
}

function load() {
    if (!currentUser) { refreshAll(); return; }
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        if (doc.exists) {
            // Full replace — never mix with another user's data
            const remote = doc.data();
            D = { ...freshD(), ...remote };
        } else {
            const local = localStorage.getItem(DB + '_' + currentUser.uid);
            if (local) {
                try { D = { ...freshD(), ...JSON.parse(local) }; } catch(e) { D = freshD(); }
            } else {
                D = freshD();
            }
        }
        refreshAll();
    }).catch(err => {
        console.error('Load error:', err);
        const local = localStorage.getItem(DB + '_' + currentUser.uid);
        if (local) {
            try { D = { ...freshD(), ...JSON.parse(local) }; } catch(e) { D = freshD(); }
        }
        refreshAll();
    });
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
    if (tab === 'stock') populateStockTab();
    if (tab === 'settings') populateSettings();
}

// ============ JOURNAL ============
function populateJournal() {
    const tbody = document.getElementById('journal-body');
    const totalAmountEl = document.getElementById('journal-total-amount');
    const totalMetersEl = document.getElementById('journal-total-meters');
    const totalDateEl = document.getElementById('journal-total-date');

    if (!D.journal) D.journal = [];

    // All journal entries — direct + bl_snapshots (independent from bl_list)
    const allEntries = (D.journal || [])
        .filter(j => j.source === 'direct' || j.source === 'bl_snapshot')
        .map(j => ({ ...j }));
    
    // Sort by date descending
    allEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let grandTotal = 0;
    let grandMeters = 0;
    
    tbody.innerHTML = allEntries.map(line => {
        const total = Number(line.total) || (Number(line.meters) * Number(line.price));
        grandTotal += total;
        grandMeters += Number(line.meters) || 0;
        
        const dateStr = line.date || new Date().toLocaleDateString('fr-FR');
        
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
                <td class="col-actions" style="display: flex; justify-content: center; align-items: center;">
                    <button class="btn-delete-row" style="width: 26px; height: 26px; font-size: 0.8rem;" onclick="deleteJournalEntry('${line.id}')" title="حذف">
                        <i class="fas fa-trash"></i>
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

let _jLock = false;
function calcJournalRow(changed) {
    if (_jLock) return;
    _jLock = true;
    const p = parseFloat(document.getElementById('entry-price').value)   || 0;
    const m = parseFloat(document.getElementById('entry-meters').value)  || 0;
    const s = parseFloat(document.getElementById('entry-service').value) || 0;
    const t = parseFloat(document.getElementById('entry-total').value)   || 0;

    if (changed === 'total' && p > 0 && t > 0) {
        document.getElementById('entry-meters').value = ((t - s) / p).toFixed(3);
    } else if (changed === 'meters' && p > 0) {
        document.getElementById('entry-total').value = ((m * p) + s).toFixed(2);
    } else if (changed === 'price') {
        if (t > 0 && p > 0) document.getElementById('entry-meters').value = ((t - s) / p).toFixed(3);
        else if (m > 0 && p > 0) document.getElementById('entry-total').value = ((m * p) + s).toFixed(2);
    } else if (changed === 'service') {
        if (m > 0 && p > 0) document.getElementById('entry-total').value = ((m * p) + s).toFixed(2);
    }
    _jLock = false;
}

function openJournalModal() {
    document.getElementById('journal-modal').style.display = 'flex';
    document.getElementById('journal-form').reset();
    document.getElementById('entry-total').value = '';
    document.getElementById('entry-service').value = '';
    document.getElementById('entry-meters').value = '';
    document.getElementById('entry-price').value = '';
    document.getElementById('entry-type').value = '';
    document.getElementById('entry-payment').value = 'espece';
    document.getElementById('pay-cash').classList.add('active');
    document.getElementById('pay-check').classList.remove('active');
    document.getElementById('entry-date').value = new Date().toISOString().split('T')[0];

    // Populate client select
    const select = document.getElementById('entry-client');
    if (select) {
        select.innerHTML = '<option value="">-- عميل غير محدد --</option>';
        (D.clients || []).forEach(c => {
            select.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });
    }
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

    const type    = document.getElementById('entry-type').value.trim();
    const client  = document.getElementById('entry-client')?.value || '';
    const meters  = parseFloat(document.getElementById('entry-meters').value)  || 0;
    const price   = parseFloat(document.getElementById('entry-price').value)   || 0;
    const service = parseFloat(document.getElementById('entry-service').value) || 0;
    const totalField = parseFloat(document.getElementById('entry-total').value) || 0;
    const total   = totalField > 0 ? totalField : (meters * price) + service;
    const payment = document.getElementById('entry-payment').value || 'espece';
    const date    = document.getElementById('entry-date').value || new Date().toISOString().split('T')[0];

    if (!type || total <= 0) {
        alert('يرجى إدخال نوع الرخام والمبلغ الإجمالي.');
        _journalSubmitting = false;
        return;
    }

    if (!D.journal) D.journal = [];
    D.journal.push({ id: generateId(), type, client, meters, price, service, total, payment, date, source: 'direct' });
    save();
    refreshAll();
    populateJournal();
    closeJournalModal();
    _journalSubmitting = false;
}

// ============ EXPORT JOURNAL ============
function exportJournal() {
    let text = 'العميل/النوع\tالأمتار\tالثمن\tالمجموع\tالتاريخ\n';
    const directEntries = (D.journal || []).filter(j => j.source === 'direct');
    const blEntries = (D.bl_list || []).map(bl => ({
        type: bl.client || 'بيع مباشر',
        meters: bl.grand_total_m2 || 0,
        price: bl.grand_total_m2 > 0 ? bl.grand_total_ttc / bl.grand_total_m2 : 0,
        total: bl.grand_total_ttc || 0,
        date: bl.date || ''
    }));
    [...directEntries, ...blEntries].forEach(e => {
        text += `${e.type}\t${e.meters}\t${Number(e.price).toFixed(2)}\t${Number(e.total).toFixed(2)}\t${e.date}\n`;
    });
    const blob = new Blob([text], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'journal_' + new Date().toISOString().split('T')[0] + '.tsv';
    a.click();
}

// ============ BL (BON DE LIVRAISON) ============
function blProductRowHTML(vals) {
    const v = vals || {};
    return `<div class="bl-product-row">
        <input type="text" placeholder="نوع الرخام" class="bl-prod-name" value="${v.name||''}">
        <input type="text" inputmode="decimal" placeholder="الثمن" class="bl-prod-price" lang="en" value="${v.price||''}" oninput="calcBLRow(this,'price')">
        <input type="text" inputmode="decimal" placeholder="المساحة" class="bl-prod-meters" lang="en" value="${v.meters||''}" oninput="calcBLRow(this,'meters')">
        <input type="text" inputmode="decimal" placeholder="المجموع" class="bl-prod-total-input" lang="en" value="${v.total||''}" oninput="calcBLRow(this,'total')" style="background:#f0fdf4;border-color:#10b981;">
        <button type="button" class="btn-remove-row" onclick="this.closest('.bl-product-row').remove();calcBLGrand();" title="حذف"><i class="fas fa-times"></i></button>
    </div>`;
}

function setBLPayment(mode) {
    document.getElementById('bl-payment').value = mode;
    document.getElementById('bl-pay-cash').classList.toggle('active', mode === 'espece');
    document.getElementById('bl-pay-check').classList.toggle('active', mode === 'cheque');
}

function openNewBL() {
    document.getElementById('bl-modal').style.display = 'flex';
    document.getElementById('bl-form').reset();
    document.getElementById('bl-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('bl-service').value = '';
    setBLPayment('espece');

    const select = document.getElementById('bl-client');
    select.innerHTML = '<option value="">-- اختر العميل --</option>';
    (D.clients || []).forEach(c => {
        select.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });

    document.getElementById('bl-products').innerHTML = blProductRowHTML();
    document.getElementById('bl-grand-total').textContent = '0.00';
}

function closeBLModal() {
    document.getElementById('bl-modal').style.display = 'none';
    _blEditId = null;
}

function addBLProductRow() {
    const container = document.getElementById('bl-products');
    const div = document.createElement('div');
    div.innerHTML = blProductRowHTML();
    container.appendChild(div.firstElementChild);
}

function calcBLRow(input, changed) {
    const row = input.closest('.bl-product-row');
    const price  = parseFloat(row.querySelector('.bl-prod-price').value) || 0;
    const meters = parseFloat(row.querySelector('.bl-prod-meters').value) || 0;
    const total  = parseFloat(row.querySelector('.bl-prod-total-input').value) || 0;

    if (changed === 'total' && price > 0) {
        // Calcul inverse: Surface = Total / Prix
        row.querySelector('.bl-prod-meters').value = (total / price).toFixed(3);
    } else if (changed === 'meters' && price > 0) {
        row.querySelector('.bl-prod-total-input').value = (meters * price).toFixed(2);
    } else if (changed === 'price') {
        if (meters > 0) row.querySelector('.bl-prod-total-input').value = (meters * price).toFixed(2);
        else if (total > 0 && price > 0) row.querySelector('.bl-prod-meters').value = (total / price).toFixed(3);
    }
    calcBLGrand();
}

function calcBLGrand() {
    let grand = 0;
    document.querySelectorAll('#bl-products .bl-product-row').forEach(r => {
        grand += parseFloat(r.querySelector('.bl-prod-total-input').value) || 0;
    });
    const service = parseFloat(document.getElementById('bl-service')?.value) || 0;
    document.getElementById('bl-grand-total').textContent = formatNumber(grand + service);
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
        const name   = row.querySelector('.bl-prod-name').value.trim();
        const meters = parseFloat(row.querySelector('.bl-prod-meters').value) || 0;
        const price  = parseFloat(row.querySelector('.bl-prod-price').value) || 0;
        const total  = parseFloat(row.querySelector('.bl-prod-total-input').value) || (meters * price);

        if (name && total > 0) {
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
    const blService = parseFloat(document.getElementById('bl-service')?.value) || 0;
    grandTotal += blService;
    
    if (products.length === 0) {
        _blSubmitting = false;
        alert('يرجى إضافة منتج واحد على الأقل');
        return;
    }
    
    const paymentMode = document.getElementById('bl-payment')?.value || 'espece';

    if (_blEditId) {
        // UPDATE existing BL — remove old snapshots for this BL, re-add fresh ones
        D.journal = (D.journal || []).filter(j => j.bl_id !== _blEditId);
        const idx = D.bl_list.findIndex(b => b.id === _blEditId);
        if (idx !== -1) {
            D.bl_list[idx].client = client;
            D.bl_list[idx].date = date;
            D.bl_list[idx].products = products;
            D.bl_list[idx].grand_total_m2 = grandM2;
            D.bl_list[idx].grand_total_tr = products.length;
            D.bl_list[idx].grand_total_ttc = grandTotal;
        }
        // Re-push snapshots for updated BL
        products.forEach(p => {
            D.journal.push({
                id: generateId(),
                bl_id: _blEditId,
                type: p.name,
                meters: p.total_m2,
                price: p.pu,
                service: blService / products.length,
                total: p.total_ttc,
                payment: paymentMode,
                date,
                source: 'bl_snapshot'
            });
        });
        _blEditId = null;
    } else {
        // CREATE new BL
        const blId = generateId();
        const bl = {
            id: blId,
            client, date, products,
            grand_total_m2: grandM2,
            grand_total_tr: products.length,
            grand_total_ttc: grandTotal
        };
        D.bl_list.push(bl);
        // Push independent journal snapshots — one per product
        products.forEach(p => {
            D.journal.push({
                id: generateId(),
                bl_id: blId,
                type: p.name,
                meters: p.total_m2,
                price: p.pu,
                service: blService / products.length,
                total: p.total_ttc,
                payment: paymentMode,
                date,
                source: 'bl_snapshot'
            });
        });
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
        const div = document.createElement('div');
        div.innerHTML = blProductRowHTML({
            name: p.name || '',
            price: p.pu || '',
            meters: p.total_m2 || '',
            total: p.total_ttc || ((p.total_m2 || 0) * (p.pu || 0))
        });
        container.appendChild(div.firstElementChild);
    });
    document.getElementById('bl-service').value = bl.service || '';
    document.getElementById('bl-grand-total').textContent = formatNumber(bl.grand_total_ttc || 0);
    // Payment mode — get from first journal snapshot of this BL
    const snap = (D.journal || []).find(j => j.bl_id === id && j.source === 'bl_snapshot');
    setBLPayment(snap?.payment || 'espece');
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
    document.documentElement.lang = lang === 'ar' ? 'ar-MA' : lang;
    
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

    // ── Revenue: BLs only (journal direct entries are already inside BLs or standalone)
    let totalRevenue = 0, totalM2Sold = 0;
    (D.bl_list || []).forEach(bl => {
        totalRevenue += Number(bl.grand_total_ttc) || 0;
        totalM2Sold += Number(bl.grand_total_m2) || 0;
    });
    // Add standalone journal entries (source !== 'bl')
    (D.journal || []).forEach(j => {
        if (j.source !== 'bl') {
            totalRevenue += Number(j.total) || (Number(j.meters) * Number(j.price)) || 0;
            totalM2Sold += Number(j.meters) || 0;
        }
    });

    // ── Client debt
    let totalClientPaid = 0;
    (D.payments || []).forEach(p => { totalClientPaid += Number(p.amount) || 0; });
    const totalDebt = totalRevenue - totalClientPaid;

    document.getElementById('stat-bl-count').textContent = blCount;
    document.getElementById('stat-total-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('stat-total-m2').textContent = formatNumber(totalM2Sold) + ' m²';
    document.getElementById('stat-client-count').textContent = clientCount;
    const debtEl = document.getElementById('stat-total-debt');
    if (debtEl) debtEl.textContent = formatCurrency(totalDebt);

    // ── Fixed charges (masarif + staff only — NOT fourn_payments which is supplier debt not expense)
    let totalMasarif = 0;
    (D.masarif || []).forEach(m => { totalMasarif += Number(m.amount) || 0; });
    let totalStaff = 0;
    (D.staff || []).forEach(s => { totalStaff += Number(s.amount) || 0; });
    const totalFixedCharges = totalMasarif + totalStaff;

    const masarifEl = document.getElementById('stat-total-masarif');
    if (masarifEl) masarifEl.textContent = formatCurrency(totalMasarif);
    const chargesEl = document.getElementById('stat-total-charges');
    if (chargesEl) chargesEl.textContent = formatCurrency(totalFixedCharges);

    // ── P&L: Net Profit = Revenue - COGS (cost of goods sold) - Fixed Charges
    // COGS = avg purchase price * m² sold (not total stock purchased)
    let totalPurchasedM2 = 0, totalPurchasedCost = 0;
    (D.fourn_bls || []).forEach(b => {
        (b.products || []).forEach(p => {
            totalPurchasedM2 += Number(p.meters) || 0;
            totalPurchasedCost += Number(p.total) || (Number(p.meters) * Number(p.price)) || 0;
        });
    });
    const avgCostPerM2 = totalPurchasedM2 > 0 ? totalPurchasedCost / totalPurchasedM2 : 0;
    const cogs = avgCostPerM2 * totalM2Sold; // cost of goods actually sold
    const netProfit = totalRevenue - cogs - totalFixedCharges;

    const profitEl = document.getElementById('stat-net-profit');
    if (profitEl) {
        profitEl.textContent = formatCurrency(netProfit);
        profitEl.style.color = netProfit >= 0 ? 'var(--success)' : 'var(--danger)';
    }

    // ── Live Stock = m² purchased - m² sold
    let stockIn = 0, stockOut = totalM2Sold;
    (D.fourn_bls || []).forEach(b => {
        (b.products || []).forEach(p => { stockIn += Number(p.meters) || 0; });
    });
    const liveStockEl = document.getElementById('stat-live-stock');
    if (liveStockEl) liveStockEl.textContent = formatNumber(Math.max(0, stockIn - stockOut)) + ' m²';
}

// ============ REFRESH ALL ============
function refreshAll() {
    populateJournal();
    refreshStats();
    if (document.getElementById('masarif-body')) populateMasarif();
    if (document.getElementById('stock-products-list')) populateStockTab();
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
function fournNewProductRowHTML(removable) {
    return `
    <div class="fourn-new-prod-row">
        <input type="text" placeholder="نوع الرخام" class="fourn-new-prod-name" required>
        <input type="text" inputmode="decimal" data-numeric placeholder="الكمية" class="fourn-new-prod-qty" oninput="calcNewFournisseurRow(this)">
        <input type="text" inputmode="decimal" data-numeric placeholder="م²" class="fourn-new-prod-meters" oninput="calcNewFournisseurRow(this)">
        <input type="text" inputmode="decimal" data-numeric placeholder="الثمن" class="fourn-new-prod-price" oninput="calcNewFournisseurRow(this)" required>
        <span class="fourn-new-prod-total" style="font-weight:700;color:var(--success);font-size:0.88rem;text-align:center;">0.00</span>
        ${removable ? `
            <button type="button" class="btn-remove-row" onclick="removeNewFournisseurRow(this)" title="حذف">
                <i class="fas fa-times"></i>
            </button>
        ` : '<span style="width:32px;display:inline-block;"></span>'}
    </div>`;
}

function openNewFournisseur() {
    document.getElementById('fournisseur-modal').style.display = 'flex';
    document.getElementById('fournisseur-form').reset();
    document.getElementById('fourn-payment-default').value = 'espece';
    document.getElementById('fourn-pay-cash').classList.add('active');
    document.getElementById('fourn-pay-check').classList.remove('active');
    document.getElementById('fourn-new-products-list').innerHTML = fournNewProductRowHTML(false);
    // Attach sanitizers after HTML injection
    document.querySelectorAll('#fourn-new-products-list input[data-numeric]').forEach(attachNumericSanitizer);
    document.getElementById('fourn-new-grand-total').textContent = '0.00 DH';
}

function addNewFournisseurRow() {
    const container = document.getElementById('fourn-new-products-list');
    const div = document.createElement('div');
    div.innerHTML = fournNewProductRowHTML(true);
    const newRow = div.firstElementChild;
    container.appendChild(newRow);
    // Attach sanitizers to freshly added row
    newRow.querySelectorAll('input[data-numeric]').forEach(attachNumericSanitizer);
}

function removeNewFournisseurRow(btn) {
    btn.closest('.fourn-new-prod-row').remove();
    calcNewFournisseurGrand();
}

function calcNewFournisseurRow(input) {
    const row = input.closest('.fourn-new-prod-row');
    const qty = parseFloat(row.querySelector('.fourn-new-prod-qty').value) || 0;
    const meters = parseFloat(row.querySelector('.fourn-new-prod-meters').value) || 0;
    const price = parseFloat(row.querySelector('.fourn-new-prod-price').value) || 0;
    const factor = meters > 0 ? meters : qty;
    row.querySelector('.fourn-new-prod-total').textContent = formatNumber(factor * price);
    calcNewFournisseurGrand();
}

function calcNewFournisseurGrand() {
    let grand = 0;
    document.querySelectorAll('#fourn-new-products-list .fourn-new-prod-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.fourn-new-prod-qty').value) || 0;
        const meters = parseFloat(row.querySelector('.fourn-new-prod-meters').value) || 0;
        const price = parseFloat(row.querySelector('.fourn-new-prod-price').value) || 0;
        const factor = meters > 0 ? meters : qty;
        grand += factor * price;
    });
    document.getElementById('fourn-new-grand-total').textContent = formatCurrency(grand);
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
    
    // Validate inputs
    let valid = true;
    document.querySelectorAll('#fourn-new-products-list .fourn-new-prod-row').forEach(row => {
        const name = row.querySelector('.fourn-new-prod-name').value.trim();
        const qty = parseFloat(row.querySelector('.fourn-new-prod-qty').value) || 0;
        const meters = parseFloat(row.querySelector('.fourn-new-prod-meters').value) || 0;
        const price = parseFloat(row.querySelector('.fourn-new-prod-price').value) || 0;

        if (name) {
            if (qty <= 0 && meters <= 0) {
                alert('يرجى إدخال الكمية أو المساحة (م²) لكل منتج');
                valid = false;
            }
            if (price <= 0) {
                alert('يرجى إدخال ثمن الوحدة لكل منتج');
                valid = false;
            }
        }
    });
    if (!valid) return;

    const name = document.getElementById('fourn-name').value;
    const phone = document.getElementById('fourn-phone').value;
    const paymentDefault = document.getElementById('fourn-payment-default').value;
    const note = document.getElementById('fourn-note').value;

    const products = [];
    let grandTotal = 0;
    const marbleTypes = [];

    document.querySelectorAll('#fourn-new-products-list .fourn-new-prod-row').forEach(row => {
        const prodName = row.querySelector('.fourn-new-prod-name').value.trim();
        const qty = parseFloat(row.querySelector('.fourn-new-prod-qty').value) || 0;
        const meters = parseFloat(row.querySelector('.fourn-new-prod-meters').value) || 0;
        const price = parseFloat(row.querySelector('.fourn-new-prod-price').value) || 0;

        if (prodName && (qty > 0 || meters > 0)) {
            const factor = meters > 0 ? meters : qty;
            const total = factor * price;
            products.push({
                name: prodName,
                qty: qty,
                meters: meters,
                price: price,
                total: total
            });
            grandTotal += total;
            if (!marbleTypes.includes(prodName)) {
                marbleTypes.push(prodName);
            }
        }
    });

    const supplierId = generateId();

    if (!D.fournisseurs) D.fournisseurs = [];
    D.fournisseurs.push({
        id: supplierId,
        name: name,
        phone: phone,
        marble_types: marbleTypes,
        payment_default: paymentDefault,
        note: note
    });

    // Automatically record initial receipt/purchase if products are entered!
    if (products.length > 0) {
        if (!D.fourn_bls) D.fourn_bls = [];
        D.fourn_bls.push({
            id: generateId(),
            fournisseur_id: supplierId,
            date: new Date().toISOString().split('T')[0],
            products: products,
            grand_total: grandTotal
        });
    }

    save();
    closeFournisseurModal();
    populateFournisseurList();
    refreshStats(); // Immediately recalculates live stock & totals on the dashboard!
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
                                <th style="padding:3px 6px;text-align:center;">م²</th>
                                <th style="padding:3px 6px;text-align:center;">الثمن</th>
                                <th style="padding:3px 6px;text-align:center;border-radius:0 4px 4px 0;">المجموع</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(b.products || []).map(p => `
                            <tr style="border-bottom:1px dashed #e2e8f0;">
                                <td style="padding:3px 6px;font-weight:600;">${p.name}</td>
                                <td style="padding:3px 6px;text-align:center;" dir="ltr">${p.qty ? formatNumber(p.qty) : '-'}</td>
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
        <input type="text" inputmode="decimal" data-numeric placeholder="الكمية" class="fourn-prod-qty" oninput="calcFournRow(this)">
        <input type="text" inputmode="decimal" data-numeric placeholder="م²" class="fourn-prod-meters" oninput="calcFournRow(this)">
        <input type="text" inputmode="decimal" data-numeric placeholder="الثمن" class="fourn-prod-price" oninput="calcFournRow(this)">
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
    // Attach sanitizers after HTML injection
    document.querySelectorAll('#fourn-bl-products input[data-numeric]').forEach(attachNumericSanitizer);
    document.getElementById('fourn-bl-grand-total').textContent = '0.00';
}

function closeFournBLModal() {
    document.getElementById('fourn-bl-modal').style.display = 'none';
}

function addFournProductRow() {
    const container = document.getElementById('fourn-bl-products');
    const div = document.createElement('div');
    div.innerHTML = fournProductRowHTML(true);
    const newRow = div.firstElementChild;
    container.appendChild(newRow);
    // Attach sanitizers to freshly added row
    newRow.querySelectorAll('input[data-numeric]').forEach(attachNumericSanitizer);
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
    const qty = parseFloat(row.querySelector('.fourn-prod-qty').value) || 0;
    const meters = parseFloat(row.querySelector('.fourn-prod-meters').value) || 0;
    const price = parseFloat(row.querySelector('.fourn-prod-price').value) || 0;
    const factor = meters > 0 ? meters : (qty > 0 ? qty : 0);
    row.querySelector('.fourn-prod-total').textContent = formatNumber(factor * price);
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
        const qty = parseFloat(row.querySelector('.fourn-prod-qty').value) || 0;
        const meters = parseFloat(row.querySelector('.fourn-prod-meters').value) || 0;
        const price = parseFloat(row.querySelector('.fourn-prod-price').value) || 0;
        if (name && (meters > 0 || qty > 0)) {
            const factor = meters > 0 ? meters : (qty > 0 ? qty : 0);
            const total = factor * price;
            products.push({ name, qty, meters, price, total });
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

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar-MA"><head>
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
            ${isA4 ? '' : ''}
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

        <div class="footer">شكراً على ثقتكم</div>
    </body></html>`;

    const win = window.open('', '_blank', `width=${isA4 ? 800 : 350},height=600`);
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); };
}

// ============ DUMMY DATA GENERATION ============
function fillDummyData() {
    if (!confirm(D.settings.lang === 'ar' ? 'هل أنت متأكد من تعبئة البيانات التجريبية؟ سيؤدي ذلك إلى ملء التطبيق ببيانات وهمية جميلة لتصوير الفيديو.' : 'Êtes-vous sûr de vouloir remplir les données d\'essai ? Cela remplira l\'application avec de belles données fictives pour l\'enregistrement de votre vidéo.')) return;
    
    // Generate unique IDs for mock entries
    const mock_clients = [
        { id: generateId(), name: "Mounir El Alami", phone: "0661234567", address: "Rabat" },
        { id: generateId(), name: "Youssef Amrani", phone: "0662345678", address: "Casablanca" },
        { id: generateId(), name: "Karim Bensalah", phone: "0663456789", address: "Marrakech" },
        { id: generateId(), name: "Mostafa Belfakir", phone: "0664567890", address: "Agadir" }
    ];

    const mock_bl_list = [
        {
            id: generateId(),
            client: "Mounir El Alami",
            date: "2026-05-01",
            products: [
                { id: generateId(), name: "Crema Marfil", pu: 350, total_m2: 45, total_tr: 1, total_ttc: 15750, measurements: [{ id: generateId(), length: 45, width: 1, tr: 1 }] },
                { id: generateId(), name: "Nero Marquina", pu: 450, total_m2: 20, total_tr: 1, total_ttc: 9000, measurements: [{ id: generateId(), length: 20, width: 1, tr: 1 }] }
            ],
            grand_total_m2: 65,
            grand_total_tr: 2,
            grand_total_ttc: 24750
        },
        {
            id: generateId(),
            client: "Youssef Amrani",
            date: "2026-05-04",
            products: [
                { id: generateId(), name: "Carrara Bianco", pu: 600, total_m2: 30, total_tr: 1, total_ttc: 18000, measurements: [{ id: generateId(), length: 30, width: 1, tr: 1 }] }
            ],
            grand_total_m2: 30,
            grand_total_tr: 1,
            grand_total_ttc: 18000
        },
        {
            id: generateId(),
            client: "Karim Bensalah",
            date: "2026-05-07",
            products: [
                { id: generateId(), name: "Emperador Dark", pu: 380, total_m2: 50, total_tr: 1, total_ttc: 19000, measurements: [{ id: generateId(), length: 50, width: 1, tr: 1 }] },
                { id: generateId(), name: "Atlas Grey", pu: 280, total_m2: 80, total_tr: 1, total_ttc: 22400, measurements: [{ id: generateId(), length: 80, width: 1, tr: 1 }] }
            ],
            grand_total_m2: 130,
            grand_total_tr: 2,
            grand_total_ttc: 41400
        }
    ];

    const mock_payments = [
        { id: generateId(), clientName: "Mounir El Alami", amount: 15000, method: "espece", date: "2026-05-02" },
        { id: generateId(), clientName: "Youssef Amrani", amount: 18000, method: "cheque", date: "2026-05-05" },
        { id: generateId(), clientName: "Karim Bensalah", amount: 20000, method: "espece", date: "2026-05-08" }
    ];

    const mock_masarif = [
        { id: generateId(), type: "كراء المستودع", amount: 5000, payment: "cheque", note: "كراء شهر ماي", date: "2026-05-01" },
        { id: generateId(), type: "كهرباء ومكتب", amount: 850, payment: "espece", note: "فاتورة المكتب والمخزن", date: "2026-05-03" },
        { id: generateId(), type: "شحن ونقل الرخام", amount: 1200, payment: "espece", note: "توصيل سلعة الرباط", date: "2026-05-05" },
        { id: generateId(), type: "إصلاح آلات التقطيع", amount: 1500, payment: "espece", note: "صيانة دورية", date: "2026-05-06" }
    ];

    const mock_staff = [
        { id: generateId(), name: "عبد الرحيم", amount: 2500, note: "أسبوعية العمل", date: "2026-05-07" },
        { id: generateId(), name: "هشام", amount: 2200, note: "أسبوعية العمل والتقطيع", date: "2026-05-07" },
        { id: generateId(), name: "رشيد", amount: 1800, note: "مساعد شحن", date: "2026-05-07" }
    ];

    const mock_fournisseurs = [
        { id: "supplier_atlas", name: "Société Atlas Marbre", phone: "0522112233", marble_types: ["Crema Marfil", "Atlas Grey"], payment_default: "cheque", note: "المورد الرئيسي للرخام المحلي" },
        { id: "supplier_carrara", name: "Importations Carrara", phone: "0522445566", marble_types: ["Carrara Bianco"], payment_default: "cheque", note: "رخام إيطالي مستورد" }
    ];

    const mock_fourn_bls = [
        {
            id: generateId(),
            fournisseur_id: "supplier_atlas",
            date: "2026-04-25",
            products: [
                { name: "Crema Marfil", qty: 200, meters: 150, price: 180, total: 27000 },
                { name: "Atlas Grey", qty: 150, meters: 120, price: 130, total: 15600 }
            ],
            grand_total: 42600
        },
        {
            id: generateId(),
            fournisseur_id: "supplier_carrara",
            date: "2026-04-28",
            products: [
                { name: "Carrara Bianco", qty: 100, meters: 80, price: 320, total: 25600 }
            ],
            grand_total: 25600
        }
    ];

    const mock_fourn_payments = [
        { id: generateId(), fournisseur_id: "supplier_atlas", amount: 30000, method: "cheque", date: "2026-04-26" },
        { id: generateId(), fournisseur_id: "supplier_carrara", amount: 20000, method: "cheque", date: "2026-04-29" }
    ];

    const mock_journal = [
        { id: generateId(), type: "Nero Marquina", meters: 8, price: 420, total: 3360, payment: "espece", date: "2026-05-08", source: "direct" },
        { id: generateId(), type: "Emperador Dark", meters: 12, price: 370, total: 4440, payment: "espece", date: "2026-05-09", source: "direct" }
    ];

    D.clients = mock_clients;
    D.bl_list = mock_bl_list;
    D.payments = mock_payments;
    D.masarif = mock_masarif;
    D.staff = mock_staff;
    D.fournisseurs = mock_fournisseurs;
    D.fourn_bls = mock_fourn_bls;
    D.fourn_payments = mock_fourn_payments;
    D.journal = mock_journal;

    save();
    
    // Refresh all views
    refreshAll();
    populateBLList();
    populateClientsList();
    populateStaffList();
    populateFournisseurList();

    alert(D.settings.lang === 'ar' ? 'تمت تعبئة البيانات التجريبية بنجاح!' : 'Données d\'essai remplies avec succès !');
}

function clearAllData() {
    if (!confirm(D.settings.lang === 'ar' ? 'هل أنت متأكد من مسح جميع البيانات؟ سيؤدي ذلك إلى تصفير البرنامج بالكامل وحذف كل العمليات والعملاء والموردين بشكل نهائي.' : 'Êtes-vous sûr de vouloir tout effacer ? Cela réinitialisera complètement l\'application.')) return;
    
    D.clients = [];
    D.bl_list = [];
    D.payments = [];
    D.masarif = [];
    D.staff = [];
    D.fournisseurs = [];
    D.fourn_bls = [];
    D.fourn_payments = [];
    D.journal = [];
    D.products = [];
    D.stock_sales = [];

    save();

    // Refresh all views
    refreshAll();
    populateBLList();
    populateClientsList();
    populateStaffList();
    populateFournisseurList();
    populateStockTab();

    alert(D.settings.lang === 'ar' ? 'تم تصفير جميع البيانات بنجاح!' : 'Toutes les données ont été réinitialisées avec succès !');
}

// ============ STOCK MANAGEMENT MODULE ============

const LOW_STOCK_DEFAULT = 5;

// Preview product image before upload
function previewProductImage(input) {
    const preview = document.getElementById('product-image-preview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="معاينة">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function openProductModal(editId) {
    const modal = document.getElementById('product-modal');
    modal.style.display = 'flex';
    document.getElementById('product-form').reset();
    document.getElementById('product-edit-id').value = '';
    document.getElementById('product-image-preview').innerHTML = '<i class="fas fa-camera"></i><span>اختر صورة</span>';

    // Attach sanitizers
    ['product-cost', 'product-sell', 'product-qty', 'product-threshold'].forEach(id => {
        attachNumericSanitizer(document.getElementById(id));
    });

    if (editId) {
        const product = (D.products || []).find(p => p.id === editId);
        if (product) {
            document.getElementById('product-modal-title').textContent = 'تعديل المنتج';
            document.getElementById('product-edit-id').value = editId;
            document.getElementById('product-name').value = product.name || '';
            document.getElementById('product-cost').value = product.cost || '';
            document.getElementById('product-sell').value = product.sell || '';
            document.getElementById('product-qty').value = product.qty || '';
            document.getElementById('product-threshold').value = product.threshold || LOW_STOCK_DEFAULT;
            if (product.image) {
                document.getElementById('product-image-preview').innerHTML = `<img src="${product.image}" alt="صورة المنتج">`;
            }
        }
    } else {
        document.getElementById('product-modal-title').textContent = 'منتج جديد';
    }
}

function closeProductModal() {
    document.getElementById('product-modal').style.display = 'none';
}

let _productSubmitting = false;
function saveProduct(e) {
    e.preventDefault();
    if (_productSubmitting) return;
    _productSubmitting = true;

    const editId = document.getElementById('product-edit-id').value;
    const name = document.getElementById('product-name').value.trim();
    const cost = parseFloat(document.getElementById('product-cost').value) || 0;
    const sell = parseFloat(document.getElementById('product-sell').value) || 0;
    const qty = parseFloat(document.getElementById('product-qty').value) || 0;
    const threshold = parseFloat(document.getElementById('product-threshold').value) || LOW_STOCK_DEFAULT;

    if (!D.products) D.products = [];

    // Get image as base64 (if a new one was selected)
    const fileInput = document.getElementById('product-image');
    const previewImg = document.querySelector('#product-image-preview img');

    const finalizeSave = (imageData) => {
        if (editId) {
            const idx = D.products.findIndex(p => p.id === editId);
            if (idx !== -1) {
                D.products[idx].name = name;
                D.products[idx].cost = cost;
                D.products[idx].sell = sell;
                D.products[idx].qty = qty;
                D.products[idx].threshold = threshold;
                if (imageData) D.products[idx].image = imageData;
            }
        } else {
            D.products.push({
                id: generateId(),
                name, cost, sell, qty, threshold,
                image: imageData || '',
                created: new Date().toISOString().split('T')[0]
            });
        }

        save();
        closeProductModal();
        populateStockTab();
        refreshStats();
        _productSubmitting = false;
        alert(D.settings.lang === 'ar' ? 'تم حفظ المنتج!' : 'Produit enregistré !');
    };

    // If there's a new file, read it
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Compress image to keep data size reasonable
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const maxW = 400, maxH = 400;
                let w = img.width, h = img.height;
                if (w > maxW) { h = (h * maxW) / w; w = maxW; }
                if (h > maxH) { w = (w * maxH) / h; h = maxH; }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                const compressed = canvas.toDataURL('image/jpeg', 0.7);
                finalizeSave(compressed);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        // Keep existing image if editing
        const existingImage = previewImg ? previewImg.src : '';
        finalizeSave(editId ? null : existingImage);
    }
}

function deleteProduct(id) {
    if (!confirm('هل تريد حذف هذا المنتج؟')) return;
    D.products = (D.products || []).filter(p => p.id !== id);
    save();
    populateStockTab();
    refreshStats();
}

// ===== STOCK TAB POPULATION =====
function populateStockTab() {
    if (!D.products) D.products = [];
    if (!D.stock_sales) D.stock_sales = [];

    const container = document.getElementById('stock-products-list');
    const alertsContainer = document.getElementById('stock-alerts-container');

    // Calculate summary
    let totalProducts = D.products.length;
    let totalSellValue = 0;
    let totalCostValue = 0;
    let lowStockProducts = [];

    D.products.forEach(p => {
        totalSellValue += (p.sell || 0) * (p.qty || 0);
        totalCostValue += (p.cost || 0) * (p.qty || 0);
        const threshold = p.threshold || LOW_STOCK_DEFAULT;
        if ((p.qty || 0) <= threshold) {
            lowStockProducts.push(p);
        }
    });

    // Update summary cards
    document.getElementById('stock-total-products').textContent = totalProducts;
    document.getElementById('stock-total-value').textContent = formatCurrency(totalSellValue);
    document.getElementById('stock-cost-value').textContent = formatCurrency(totalCostValue);
    document.getElementById('stock-low-count').textContent = lowStockProducts.length;

    // Low stock alerts
    if (lowStockProducts.length > 0) {
        alertsContainer.style.display = 'block';
        alertsContainer.innerHTML = `
            <div class="stock-alerts-bar">
                <div class="alert-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div>
                    <div class="alert-text">⚠️ تنبيه: ${lowStockProducts.length} منتج(ات) بكمية منخفضة!</div>
                    <div class="alert-items">
                        ${lowStockProducts.map(p => `
                            <span class="alert-chip">${p.name} (${formatNumber(p.qty || 0, 0)})</span>
                        `).join('')}
                    </div>
                </div>
            </div>`;
    } else {
        alertsContainer.style.display = 'none';
    }

    // Products grid
    if (D.products.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;grid-column:1/-1;">لا توجد منتجات بعد. أضف منتجك الأول!</p>';
        return;
    }

    container.innerHTML = D.products.map(p => {
        const qty = p.qty || 0;
        const threshold = p.threshold || LOW_STOCK_DEFAULT;
        let badgeClass = 'stock-badge-ok';
        let badgeText = 'متوفر';
        let badgeIcon = 'check-circle';

        if (qty <= 0) {
            badgeClass = 'stock-badge-out';
            badgeText = 'نفذ';
            badgeIcon = 'times-circle';
        } else if (qty <= threshold) {
            badgeClass = 'stock-badge-low';
            badgeText = 'كمية منخفضة';
            badgeIcon = 'exclamation-triangle';
        }

        const totalValue = (p.sell || 0) * qty;
        const profit = ((p.sell || 0) - (p.cost || 0)) * qty;

        return `
        <div class="stock-product-card">
            ${p.image
                ? `<img src="${p.image}" class="stock-product-image" alt="${p.name}">`
                : `<div class="stock-product-image-placeholder"><i class="fas fa-layer-group"></i></div>`
            }
            <div class="stock-product-body">
                <div class="stock-product-name">${p.name}</div>
                <div class="stock-product-prices">
                    <div>
                        <span class="price-label">سعر الشراء</span>
                        <span class="price-cost" dir="ltr">${formatCurrency(p.cost)}</span>
                    </div>
                    <div>
                        <span class="price-label">سعر البيع</span>
                        <span class="price-sell" dir="ltr">${formatCurrency(p.sell)}</span>
                    </div>
                </div>
                <div class="stock-product-qty-bar">
                    <span class="stock-product-qty">${formatNumber(qty, 0)}</span>
                    <span class="stock-badge ${badgeClass}">
                        <i class="fas fa-${badgeIcon}"></i> ${badgeText}
                    </span>
                </div>
                <div class="stock-product-value">
                    <span>قيمة المخزون: <strong dir="ltr">${formatCurrency(totalValue)}</strong></span>
                    <span>هامش الربح: <strong style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'};" dir="ltr">${formatCurrency(profit)}</strong></span>
                </div>
                <div class="stock-product-actions">
                    <button class="btn btn-primary btn-sm" onclick="openProductModal('${p.id}')">
                        <i class="fas fa-pen"></i> تعديل
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ===== STOCK SALE =====
function openStockSaleModal() {
    document.getElementById('stock-sale-modal').style.display = 'flex';
    document.getElementById('stock-sale-form').reset();
    document.getElementById('stock-sale-total').value = '';
    document.getElementById('stock-sale-profit').value = '';
    document.getElementById('stock-sale-info').style.display = 'none';
    document.getElementById('stock-sale-payment').value = 'espece';
    document.getElementById('ss-cash').classList.add('active');
    document.getElementById('ss-check').classList.remove('active');

    // Populate product select
    const select = document.getElementById('stock-sale-product');
    select.innerHTML = '<option value="">-- اختر المنتج --</option>';
    (D.products || []).forEach(p => {
        if ((p.qty || 0) > 0) {
            select.innerHTML += `<option value="${p.id}">${p.name} (${formatNumber(p.qty, 0)} متوفر)</option>`;
        }
    });

    // Attach sanitizer
    attachNumericSanitizer(document.getElementById('stock-sale-qty'));
}

function closeStockSaleModal() {
    document.getElementById('stock-sale-modal').style.display = 'none';
}

function onStockSaleProductChange() {
    const productId = document.getElementById('stock-sale-product').value;
    const infoBar = document.getElementById('stock-sale-info');

    if (!productId) {
        infoBar.style.display = 'none';
        return;
    }

    const product = (D.products || []).find(p => p.id === productId);
    if (!product) return;

    infoBar.style.display = 'block';
    document.getElementById('stock-sale-available').textContent = formatNumber(product.qty || 0, 0);
    document.getElementById('stock-sale-unit-price').textContent = formatCurrency(product.sell);
    document.getElementById('stock-sale-cost-price').textContent = formatCurrency(product.cost);

    calcStockSaleTotal();
}

function calcStockSaleTotal() {
    const productId = document.getElementById('stock-sale-product').value;
    const qty = parseFloat(document.getElementById('stock-sale-qty').value) || 0;

    if (!productId) return;

    const product = (D.products || []).find(p => p.id === productId);
    if (!product) return;

    const total = qty * (product.sell || 0);
    const profit = qty * ((product.sell || 0) - (product.cost || 0));

    document.getElementById('stock-sale-total').value = formatCurrency(total);
    document.getElementById('stock-sale-profit').value = formatCurrency(profit);
}

function selectStockSalePayment(method) {
    document.getElementById('stock-sale-payment').value = method;
    document.getElementById('ss-cash').classList.toggle('active', method === 'espece');
    document.getElementById('ss-check').classList.toggle('active', method === 'cheque');
}

let _stockSaleSubmitting = false;
function saveStockSale(e) {
    e.preventDefault();
    if (_stockSaleSubmitting) return;
    _stockSaleSubmitting = true;

    const productId = document.getElementById('stock-sale-product').value;
    const qty = parseFloat(document.getElementById('stock-sale-qty').value) || 0;
    const payment = document.getElementById('stock-sale-payment').value;

    if (!productId) {
        alert('يرجى اختيار منتج');
        _stockSaleSubmitting = false;
        return;
    }

    const product = (D.products || []).find(p => p.id === productId);
    if (!product) {
        alert('المنتج غير موجود');
        _stockSaleSubmitting = false;
        return;
    }

    if (qty <= 0) {
        alert('يرجى إدخال كمية صحيحة');
        _stockSaleSubmitting = false;
        return;
    }

    if (qty > (product.qty || 0)) {
        alert(`الكمية المطلوبة (${qty}) أكبر من المتوفر (${product.qty || 0})`);
        _stockSaleSubmitting = false;
        return;
    }

    // Deduct from stock
    product.qty = (product.qty || 0) - qty;

    // Record the sale
    if (!D.stock_sales) D.stock_sales = [];
    D.stock_sales.push({
        id: generateId(),
        product_id: productId,
        product_name: product.name,
        qty: qty,
        sell_price: product.sell || 0,
        cost_price: product.cost || 0,
        total: qty * (product.sell || 0),
        profit: qty * ((product.sell || 0) - (product.cost || 0)),
        payment: payment,
        date: new Date().toISOString().split('T')[0]
    });

    // Also add to journal for unified tracking
    if (!D.journal) D.journal = [];
    D.journal.push({
        id: generateId(),
        type: product.name + ' (مخزون)',
        meters: qty,
        price: product.sell || 0,
        total: qty * (product.sell || 0),
        payment: payment,
        date: new Date().toISOString().split('T')[0],
        source: 'stock'
    });

    save();
    closeStockSaleModal();
    refreshAll();
    _stockSaleSubmitting = false;

    // Low stock notification after sale
    const threshold = product.threshold || LOW_STOCK_DEFAULT;
    if (product.qty <= threshold && product.qty > 0) {
        alert(`⚠️ تنبيه: المنتج "${product.name}" أصبح بكمية منخفضة (${product.qty} متبقي)`);
    } else if (product.qty <= 0) {
        alert(`🔴 المنتج "${product.name}" نفذ من المخزون!`);
    } else {
        alert('تم تسجيل البيع بنجاح!');
    }
}

// ===== STOCK PDF REPORT =====
function exportStockPDF() {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        alert('جاري تحميل مكتبة التقارير... أعد المحاولة.');
        return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const company = D.settings.company || {};
    const today = new Date().toLocaleDateString('fr-FR');

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(company.name || 'Rkham System', 105, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Stock Report / Rapport de Stock', 105, 28, { align: 'center' });
    doc.text(`Date: ${today}`, 105, 34, { align: 'center' });

    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(15, 38, 195, 38);

    // Summary Section
    let y = 45;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Inventory Summary', 15, y);
    y += 8;

    let totalSellValue = 0, totalCostValue = 0, lowCount = 0;
    (D.products || []).forEach(p => {
        totalSellValue += (p.sell || 0) * (p.qty || 0);
        totalCostValue += (p.cost || 0) * (p.qty || 0);
        if ((p.qty || 0) <= (p.threshold || LOW_STOCK_DEFAULT)) lowCount++;
    });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Products: ${(D.products || []).length}`, 15, y);
    doc.text(`Total Inventory Value (Sell): ${formatNumber(totalSellValue)} DH`, 15, y + 6);
    doc.text(`Total Inventory Value (Cost): ${formatNumber(totalCostValue)} DH`, 15, y + 12);
    doc.text(`Low Stock Items: ${lowCount}`, 15, y + 18);
    y += 28;

    // Products Table
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Products Detail', 15, y);
    y += 4;

    const tableData = (D.products || []).map(p => [
        p.name || '-',
        formatNumber(p.cost || 0),
        formatNumber(p.sell || 0),
        formatNumber(p.qty || 0, 0),
        formatNumber((p.sell || 0) * (p.qty || 0)),
        (p.qty || 0) <= (p.threshold || LOW_STOCK_DEFAULT) ? 'LOW' : 'OK'
    ]);

    doc.autoTable({
        startY: y,
        head: [['Product', 'Cost', 'Sell Price', 'Qty', 'Total Value', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [37, 99, 235],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: { halign: 'center', fontSize: 9 },
        columnStyles: {
            0: { halign: 'left' },
            5: { fontStyle: 'bold' }
        },
        didParseCell: function(data) {
            if (data.column.index === 5 && data.section === 'body') {
                if (data.cell.raw === 'LOW') {
                    data.cell.styles.textColor = [220, 38, 38];
                    data.cell.styles.fontStyle = 'bold';
                } else {
                    data.cell.styles.textColor = [5, 150, 105];
                }
            }
        }
    });

    // Stock Movements Section
    y = doc.lastAutoTable.finalY + 12;
    if (y > 250) { doc.addPage(); y = 20; }

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Recent Stock Sales', 15, y);
    y += 4;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthSales = (D.stock_sales || []).filter(s => (s.date || '').startsWith(currentMonth));

    if (monthSales.length > 0) {
        const salesData = monthSales.map(s => [
            s.product_name || '-',
            formatNumber(s.qty || 0, 0),
            formatNumber(s.sell_price || 0),
            formatNumber(s.total || 0),
            formatNumber(s.profit || 0),
            s.date || '-'
        ]);

        doc.autoTable({
            startY: y,
            head: [['Product', 'Qty', 'Unit Price', 'Total', 'Profit', 'Date']],
            body: salesData,
            theme: 'grid',
            headStyles: {
                fillColor: [16, 185, 129],
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: { halign: 'center', fontSize: 9 },
            columnStyles: { 0: { halign: 'left' } }
        });

        y = doc.lastAutoTable.finalY + 8;
        let totalSalesRevenue = 0, totalSalesProfit = 0;
        monthSales.forEach(s => {
            totalSalesRevenue += s.total || 0;
            totalSalesProfit += s.profit || 0;
        });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Monthly Sales Revenue: ${formatNumber(totalSalesRevenue)} DH`, 15, y);
        doc.text(`Monthly Stock Profit: ${formatNumber(totalSalesProfit)} DH`, 15, y + 6);
    } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('No stock sales recorded this month.', 15, y + 4);
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150);
        doc.text(`Generated by Rkham System - ${today}`, 105, 290, { align: 'center' });
        doc.text(`Page ${i} / ${pageCount}`, 195, 290, { align: 'right' });
    }

    doc.save(`stock_report_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    // Attach decimal-safe sanitizers to all static numeric inputs
    // (Journal modal, Masarif modal, Staff modal, Payment modals)
    const staticNumericIds = [
        'entry-meters', 'entry-price',
        'masarif-amount',
        'staff-amount',
        'payment-amount',
        'fourn-payment-amount',
        'product-cost', 'product-sell', 'product-qty', 'product-threshold',
        'stock-sale-qty'
    ];
    staticNumericIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // Convert type="number" to text+inputmode so paste works properly
            el.type = 'text';
            el.setAttribute('inputmode', 'decimal');
            el.setAttribute('data-numeric', '');
            attachNumericSanitizer(el);
        }
    });

    // Also attach sanitizers to any data-numeric inputs already in the DOM
    // (e.g., the static BL product row rendered in index.html)
    document.querySelectorAll('input[data-numeric]').forEach(attachNumericSanitizer);

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
