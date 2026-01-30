// Datenbank-Simulation mit localStorage (synchronisiert zwischen Tabs)
const DB_KEY = 'urlaubskasse_db';

// Aktueller User State
let currentUser = {
    nickname: '',
    fundId: ''
};

// Datenbank Struktur
function getDB() {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : { funds: {} };
}

function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    // Event für andere Tabs triggern
    window.dispatchEvent(new Event('storage'));
}

// Screen Navigation
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showStart() {
    showScreen('startScreen');
    currentUser = { nickname: '', fundId: '' };
}

function showCreate() {
    showScreen('createScreen');
}

function showJoin() {
    showScreen('joinScreen');
}

// Benachrichtigungen
function notify(message, type = 'success') {
    const notif = document.getElementById('notification');
    notif.textContent = message;
    notif.className = `notification ${type}`;
    notif.classList.add('show');
    
    setTimeout(() => {
        notif.classList.remove('show');
    }, 3000);
}

// Kasse erstellen
function createFund() {
    const nickname = document.getElementById('createNickname').value.trim();
    const fundName = document.getElementById('createFundName').value.trim();
    const fundId = document.getElementById('createId').value.trim();
    
    if (!nickname) {
        notify('Bitte gib einen Nickname ein!', 'error');
        return;
    }
    
    if (!fundName) {
        notify('Bitte gib einen Kassennamen ein!', 'error');
        return;
    }
    
    if (!fundId || fundId.length < 4 || fundId.length > 8 || !/^\d+$/.test(fundId)) {
        notify('ID muss 4-8 Ziffern enthalten!', 'error');
        return;
    }
    
    const db = getDB();
    
    if (db.funds[fundId]) {
        notify('Diese ID existiert bereits!', 'error');
        return;
    }
    
    // Neue Kasse anlegen
    db.funds[fundId] = {
        name: fundName,
        balance: 0,
        transactions: [],
        members: [nickname],
        created: Date.now()
    };
    
    saveDB(db);
    
    currentUser.nickname = nickname;
    currentUser.fundId = fundId;
    
    // Clear inputs
    document.getElementById('createNickname').value = '';
    document.getElementById('createFundName').value = '';
    document.getElementById('createId').value = '';
    
    showFund();
    notify(`Kasse "${fundName}" erfolgreich erstellt!`);
}

// Kasse beitreten
function joinFund() {
    const nickname = document.getElementById('joinNickname').value.trim();
    const fundId = document.getElementById('joinId').value.trim();
    
    if (!nickname) {
        notify('Bitte gib einen Nickname ein!', 'error');
        return;
    }
    
    if (!fundId) {
        notify('Bitte gib eine ID ein!', 'error');
        return;
    }
    
    const db = getDB();
    
    if (!db.funds[fundId]) {
        notify('Kasse nicht gefunden!', 'error');
        return;
    }
    
    // Member hinzufügen wenn noch nicht vorhanden
    if (!db.funds[fundId].members.includes(nickname)) {
        db.funds[fundId].members.push(nickname);
        saveDB(db);
    }
    
    currentUser.nickname = nickname;
    currentUser.fundId = fundId;
    
    // Clear inputs
    document.getElementById('joinNickname').value = '';
    document.getElementById('joinId').value = '';
    
    showFund();
    notify(`Du bist der Kasse beigetreten!`);
}

// Kasse verlassen
function leaveFund() {
    if (confirm('Möchtest du die Kasse wirklich verlassen?')) {
        currentUser = { nickname: '', fundId: '' };
        showStart();
    }
}

// Haupt-Screen anzeigen
function showFund() {
    const db = getDB();
    const fund = db.funds[currentUser.fundId];
    
    if (!fund) {
        notify('Kasse nicht gefunden!', 'error');
        showStart();
        return;
    }
    
    document.getElementById('fundName').textContent = fund.name;
    document.getElementById('userNickname').textContent = currentUser.nickname;
    document.getElementById('fundId').textContent = `ID: ${currentUser.fundId}`;
    
    updateBalance();
    updateHistory();
    showScreen('fundScreen');
    
    // Echtzeit-Updates für andere Tabs
    startRealtimeSync();
}

// Balance aktualisieren
function updateBalance() {
    const db = getDB();
    const fund = db.funds[currentUser.fundId];
    
    if (fund) {
        document.getElementById('balance').textContent = formatMoney(fund.balance);
    }
}

// History aktualisieren
function updateHistory() {
    const db = getDB();
    const fund = db.funds[currentUser.fundId];
    const historyEl = document.getElementById('history');
    
    if (!fund || !fund.transactions || fund.transactions.length === 0) {
        historyEl.innerHTML = '';
        return;
    }
    
    historyEl.innerHTML = fund.transactions
        .slice()
        .reverse()
        .map(t => {
            const date = new Date(t.timestamp);
            const timeStr = date.toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <div class="history-item ${t.type}">
                    <div class="history-left">
                        <div class="history-user">${t.user}</div>
                        <div class="history-type">${t.type === 'deposit' ? 'Einzahlung' : 'Abhebung'}</div>
                        <div class="history-time">${timeStr}</div>
                    </div>
                    <div class="history-amount">
                        ${t.type === 'deposit' ? '+' : '-'}${formatMoney(t.amount)}
                    </div>
                </div>
            `;
        })
        .join('');
}

// Einzahlen
function deposit() {
    const amount = parseFloat(document.getElementById('amount').value);
    
    if (!amount || amount <= 0) {
        notify('Bitte gib einen gültigen Betrag ein!', 'error');
        return;
    }
    
    const db = getDB();
    const fund = db.funds[currentUser.fundId];
    
    fund.balance += amount;
    fund.transactions.push({
        type: 'deposit',
        amount: amount,
        user: currentUser.nickname,
        timestamp: Date.now()
    });
    
    saveDB(db);
    
    document.getElementById('amount').value = '';
    updateBalance();
    updateHistory();
    
    notify(`${formatMoney(amount)} eingezahlt!`);
}

// Abheben
function withdraw() {
    const amount = parseFloat(document.getElementById('amount').value);
    
    if (!amount || amount <= 0) {
        notify('Bitte gib einen gültigen Betrag ein!', 'error');
        return;
    }
    
    const db = getDB();
    const fund = db.funds[currentUser.fundId];
    
    if (amount > fund.balance) {
        notify(`Nicht genug Guthaben! Verfügbar: ${formatMoney(fund.balance)}`, 'error');
        return;
    }
    
    fund.balance -= amount;
    fund.transactions.push({
        type: 'withdraw',
        amount: amount,
        user: currentUser.nickname,
        timestamp: Date.now()
    });
    
    saveDB(db);
    
    document.getElementById('amount').value = '';
    updateBalance();
    updateHistory();
    
    notify(`${formatMoney(amount)} abgehoben!`);
}

// Echtzeit-Synchronisation zwischen Tabs
let syncInterval;
function startRealtimeSync() {
    // Update alle 2 Sekunden
    if (syncInterval) clearInterval(syncInterval);
    
    syncInterval = setInterval(() => {
        if (currentUser.fundId) {
            updateBalance();
            updateHistory();
        }
    }, 2000);
}

// Storage Event Listener für Tab-Sync
window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY && currentUser.fundId) {
        updateBalance();
        updateHistory();
    }
});

// Hilfsfunktionen
function formatMoney(amount) {
    return amount.toFixed(2).replace('.', ',') + ' €';
}

// Enter-Taste Support
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen.id === 'createScreen') createFund();
            if (activeScreen.id === 'joinScreen') joinFund();
        }
    });
});
