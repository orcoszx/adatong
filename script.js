/*
============================================
DISCORD WEBHOOK MANAGER - MAIN SCRIPT
Copyright © 2026 TROY
All Rights Reserved
============================================
*/

// State management
let currentUser = null;
let otpCode = null;
let otpExpiry = null;
let countdownInterval = null;
let webhooks = [];
let messageStats = {
    total: 0,
    today: 0,
    spamSessions: 0
};

// Fixed OTP Webhook URL - UPDATE INI!
const OTP_WEBHOOK_URL = "https://discord.com/api/webhooks/1467229971092341084/PDsTWceMzsfS40Y909TqU5_5CWuEcVBXtG8j35D7rMutV1_FdESKb8cknqY2TK9kTUCc";

// DOM elements
const loginScreen = document.getElementById('loginScreen');
const mainScreen = document.getElementById('mainScreen');
const emailStep = document.getElementById('emailStep');
const otpStep = document.getElementById('otpStep');
const userEmailInput = document.getElementById('userEmail');
const otpInputs = document.querySelectorAll('.otp-input');
const countdownElement = document.getElementById('countdown');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const userAvatar = document.getElementById('userAvatar');
const loginLoading = document.getElementById('loginLoading');
const globalLoading = document.getElementById('globalLoading');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
    setupOTPInputs();
    setupEventListeners();
    setupMobileNavigation();
    loadMessageStats();
    setupDelayControls();
    
    // Check for saved webhooks on load
    setTimeout(() => {
        if (currentUser) {
            loadWebhooks();
        }
    }, 500);
});

// ==================== AUTH FUNCTIONS ====================

function checkLoginStatus() {
    const savedUser = localStorage.getItem('discord_webhook_user');
    const savedSession = localStorage.getItem('discord_webhook_session');
    
    if (savedUser && savedSession) {
        const session = JSON.parse(savedSession);
        const now = new Date();
        const expiry = new Date(session.expiry);
        
        if (now < expiry) {
            currentUser = JSON.parse(savedUser);
            showMainScreen();
            showNotification('Login otomatis berhasil!', 'success');
            addLog(`Selamat datang kembali, ${currentUser.email}`, 'success');
        } else {
            localStorage.removeItem('discord_webhook_user');
            localStorage.removeItem('discord_webhook_session');
        }
    }
}

function setupOTPInputs() {
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Only allow numbers
            if (!/^\d*$/.test(value)) {
                e.target.value = '';
                return;
            }
            
            if (value.length === 1) {
                if (index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '') {
                if (index > 0) {
                    otpInputs[index - 1].focus();
                }
            }
            
            // Allow navigation with arrow keys
            if (e.key === 'ArrowLeft' && index > 0) {
                otpInputs[index - 1].focus();
            }
            if (e.key === 'ArrowRight' && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });
        
        // Prevent paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
        });
    });
}

function setupEventListeners() {
    // Login events
    document.getElementById('sendOTP').addEventListener('click', sendOTP);
    document.getElementById('verifyOTP').addEventListener('click', verifyOTP);
    document.getElementById('resendOTP').addEventListener('click', resendOTP);
    document.getElementById('backToEmail').addEventListener('click', backToEmail);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Webhook events
    document.getElementById('saveWebhook').addEventListener('click', saveWebhook);
    
    // Message events
    document.getElementById('sendMessage').addEventListener('click', sendMessage);
    document.getElementById('clearMessage').addEventListener('click', clearMessage);
    
    // Navigation events
    document.getElementById('quickSend').addEventListener('click', quickSend);
    document.getElementById('addWebhookBtn').addEventListener('click', addWebhook);
    document.getElementById('testConnection').addEventListener('click', testConnection);
    document.getElementById('gotoSpam').addEventListener('click', gotoSpam);
    document.getElementById('clearLogs').addEventListener('click', clearLogs);
    
    // Enter key for email input
    userEmailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendOTP();
        }
    });
    
    // Enter key for OTP inputs
    otpInputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                verifyOTP();
            }
        });
    });
}

function setupMobileNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');
            
            // Get tab ID
            const tabId = item.getAttribute('data-tab');
            
            // Hide all tab panes
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Show selected tab pane
            const targetTab = document.getElementById(`${tabId}-tab`);
            if (targetTab) {
                targetTab.classList.add('active');
                
                // Update content based on tab
                switch(tabId) {
                    case 'webhooks':
                        updateWebhookDropdown();
                        break;
                    case 'dashboard':
                        updateStatistics();
                        break;
                    case 'spam':
                        loadSpamWebhookList();
                        updateDelayPreview();
                        break;
                }
            }
        });
    });
}

// ==================== OTP FUNCTIONS ====================

function sendOTP() {
    const email = userEmailInput.value.trim();
    
    if (!email || !email.includes('@') || !email.includes('.')) {
        showNotification('Harap masukkan email yang valid!', 'error');
        userEmailInput.focus();
        return;
    }
    
    showLoading(loginLoading, true);
    
    otpCode = generateOTP();
    otpExpiry = new Date(Date.now() + 5 * 60000);
    
    const payload = {
        content: `@here **📧 OTP Login Request - TROY Webhook Manager**`,
        embeds: [{
            title: '🔐 Kode OTP Login Discord Webhook Manager',
            description: `**Email:** ${email}\n**Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n**App:** Webhook Manager v3.0\n\n**OTP CODE:**\n\`\`\`${otpCode}\`\`\``,
            color: 5814783,
            fields: [
                {
                    name: '⏰ Expires',
                    value: `<t:${Math.floor(otpExpiry.getTime() / 1000)}:R>`,
                    inline: true
                },
                {
                    name: '🔒 Security',
                    value: 'One-time Password',
                    inline: true
                }
            ],
            footer: {
                text: 'Discord Webhook Manager © 2026 TROY',
                icon_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
            },
            timestamp: new Date().toISOString()
        }]
    };
    
    fetch(OTP_WEBHOOK_URL, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        showLoading(loginLoading, false);
        
        if (response.ok) {
            showOTPStep();
            startCountdown();
            showNotification('OTP berhasil dikirim ke Discord!', 'success');
            addLog(`OTP dikirim ke ${email}`, 'info');
            
            localStorage.setItem('temp_email', email);
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    })
    .catch(error => {
        showLoading(loginLoading, false);
        showNotification(`Gagal mengirim OTP: ${error.message}`, 'error');
        console.error('OTP Send Error:', error);
    });
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function showOTPStep() {
    emailStep.style.display = 'none';
    otpStep.style.display = 'block';
    
    otpInputs.forEach(input => {
        input.value = '';
        input.style.borderColor = '';
    });
    
    if (otpInputs.length > 0) {
        setTimeout(() => otpInputs[0].focus(), 100);
    }
}

function startCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    let timeLeft = 300;
    countdownElement.textContent = timeLeft;
    countdownElement.style.color = 'var(--warning)';
    
    countdownInterval = setInterval(() => {
        timeLeft--;
        countdownElement.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            showNotification('OTP telah kadaluarsa!', 'error');
            backToEmail();
        } else if (timeLeft <= 60) {
            countdownElement.style.color = 'var(--danger)';
        } else if (timeLeft <= 120) {
            countdownElement.style.color = 'var(--warning)';
        }
    }, 1000);
}

function verifyOTP() {
    const enteredOTP = Array.from(otpInputs).map(input => input.value).join('');
    
    if (enteredOTP.length !== 6) {
        showNotification('Masukkan 6 digit kode OTP!', 'error');
        otpInputs[0].focus();
        return;
    }
    
    if (enteredOTP !== otpCode) {
        showNotification('Kode OTP salah!', 'error');
        
        // Shake animation
        otpInputs.forEach(input => {
            input.style.animation = 'none';
            void input.offsetWidth;
            input.style.animation = 'shake 0.5s';
            input.style.borderColor = 'var(--danger)';
        });
        
        setTimeout(() => {
            otpInputs.forEach(input => {
                input.style.animation = '';
                input.style.borderColor = '';
                input.value = '';
            });
            otpInputs[0].focus();
        }, 500);
        
        return;
    }
    
    if (new Date() > otpExpiry) {
        showNotification('Kode OTP telah kadaluarsa!', 'error');
        backToEmail();
        return;
    }
    
    const email = localStorage.getItem('temp_email');
    
    currentUser = {
        email: email,
        loginTime: new Date().toISOString(),
        lastActivity: new Date().toISOString()
    };
    
    const session = {
        user: email,
        expiry: new Date(Date.now() + 24 * 60 * 60000).toISOString()
    };
    
    localStorage.setItem('discord_webhook_user', JSON.stringify(currentUser));
    localStorage.setItem('discord_webhook_session', JSON.stringify(session));
    
    clearInterval(countdownInterval);
    showMainScreen();
    
    // Send login notification
    sendLoginNotification();
    
    showNotification('Login berhasil! Selamat datang.', 'success');
    addLog(`User ${email} berhasil login`, 'success');
}

function sendLoginNotification() {
    const loginPayload = {
        content: `✅ **Login Successful - TROY Webhook Manager**`,
        embeds: [{
            title: '👤 User Login Notification',
            description: `**Email:** ${currentUser.email}\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n**Status:** Successfully logged in\n**Version:** 3.0`,
            color: 5763719,
            footer: {
                text: 'Discord Webhook Manager © 2026 TROY',
                icon_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
            },
            timestamp: new Date().toISOString()
        }]
    };
    
    fetch(OTP_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginPayload)
    }).catch(error => {
        console.error('Login notification failed:', error);
    });
}

function showMainScreen() {
    loginScreen.style.display = 'none';
    mainScreen.style.display = 'block';
    
    // Update user info
    userEmailDisplay.textContent = currentUser.email;
    
    // Set user avatar with initials
    const initials = currentUser.email.substring(0, 2).toUpperCase();
    userAvatar.innerHTML = `<span>${initials}</span>`;
    userAvatar.style.background = `linear-gradient(135deg, var(--primary), var(--secondary))`;
    
    // Update last login
    const lastLoginElement = document.getElementById('lastLogin');
    if (lastLoginElement) {
        lastLoginElement.textContent = new Date(currentUser.loginTime).toLocaleString('id-ID');
    }
    
    // Load user data
    loadWebhooks();
    updateWebhookDropdown();
    updateStatistics();
    
    // Show dashboard by default
    document.querySelector('.nav-item[data-tab="dashboard"]').click();
}

function resendOTP() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    sendOTP();
}

function backToEmail() {
    otpStep.style.display = 'none';
    emailStep.style.display = 'block';
    
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    userEmailInput.focus();
}

function logout() {
    if (confirm('Yakin ingin logout dari aplikasi?')) {
        // Clear all user data
        localStorage.removeItem('discord_webhook_user');
        localStorage.removeItem('discord_webhook_session');
        localStorage.removeItem('temp_email');
        
        // Clear webhooks for this user
        if (currentUser && currentUser.email) {
            localStorage.removeItem(`webhooks_${currentUser.email}`);
        }
        
        // Reset state
        currentUser = null;
        otpCode = null;
        webhooks = [];
        
        // Reset UI
        mainScreen.style.display = 'none';
        loginScreen.style.display = 'block';
        emailStep.style.display = 'block';
        otpStep.style.display = 'none';
        
        // Clear inputs
        userEmailInput.value = '';
        otpInputs.forEach(input => input.value = '');
        
        showNotification('Logout berhasil!', 'info');
        addLog('User telah logout', 'info');
    }
}

// ==================== WEBHOOK FUNCTIONS ====================

function saveWebhook() {
    const url = document.getElementById('webhookUrl').value.trim();
    const name = document.getElementById('webhookName').value.trim() || 'Webhook Bot';
    const botName = document.getElementById('botName').value.trim();
    
    if (!url || !url.includes('discord.com/api/webhooks/')) {
        showNotification('URL webhook Discord tidak valid!', 'error');
        document.getElementById('webhookUrl').focus();
        return;
    }
    
    // Check if webhook already exists
    const existingIndex = webhooks.findIndex(w => w.url === url);
    if (existingIndex !== -1) {
        // Update existing webhook
        webhooks[existingIndex].name = name;
        webhooks[existingIndex].botName = botName || name;
        webhooks[existingIndex].updated = new Date().toISOString();
        showNotification('Webhook berhasil diperbarui!', 'success');
    } else {
        // Create new webhook
        const webhook = {
            id: Date.now(),
            url: url,
            name: name,
            botName: botName || name,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            enabled: true
        };
        webhooks.push(webhook);
        showNotification('Webhook berhasil disimpan!', 'success');
    }
    
    saveWebhooksToStorage();
    updateWebhookList();
    updateWebhookDropdown();
    updateSpamWebhookList();
    updateStatistics();
    
    // Clear form
    document.getElementById('webhookUrl').value = '';
    document.getElementById('webhookName').value = '';
    document.getElementById('botName').value = '';
    
    addLog(`Webhook "${name}" disimpan`, 'success');
    
    // Switch to webhooks tab
    document.querySelector('.nav-item[data-tab="webhooks"]').click();
}

function loadWebhooks() {
    if (!currentUser || !currentUser.email) return;
    
    const saved = localStorage.getItem(`webhooks_${currentUser.email}`);
    webhooks = saved ? JSON.parse(saved) : [];
    updateWebhookList();
    updateWebhookDropdown();
    updateSpamWebhookList();
}

function saveWebhooksToStorage() {
    if (!currentUser || !currentUser.email) return;
    localStorage.setItem(`webhooks_${currentUser.email}`, JSON.stringify(webhooks));
}

function updateWebhookList() {
    const list = document.getElementById('webhookList');
    
    if (!list) return;
    
    if (webhooks.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 30px 15px; color: var(--light-gray);">
                <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p style="font-weight: 500;">Belum ada webhook</p>
                <p style="font-size: 0.9rem; margin-top: 5px;">Tambahkan webhook pertama Anda</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = '';
    
    webhooks.forEach((webhook, index) => {
        const item = document.createElement('div');
        item.className = 'webhook-item';
        
        const displayUrl = webhook.url.length > 35 
            ? webhook.url.substring(0, 35) + '...' 
            : webhook.url;
        
        item.innerHTML = `
            <div class="webhook-info">
                <h4>${webhook.name}</h4>
                <p><strong>Bot:</strong> ${webhook.botName}</p>
                <p style="font-size: 0.8rem;">${displayUrl}</p>
                <small style="color: var(--gray);">Ditambahkan: ${new Date(webhook.created).toLocaleDateString('id-ID')}</small>
            </div>
            <div class="webhook-actions">
                <button class="btn btn-secondary btn-small use-webhook" data-id="${webhook.id}">
                    <i class="fas fa-paper-plane"></i> Pakai
                </button>
                <button class="btn btn-danger btn-small delete-webhook" data-id="${webhook.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        list.appendChild(item);
    });
    
    // Add event listeners to new buttons
    document.querySelectorAll('.use-webhook').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.getAttribute('data-id'));
            useWebhook(id);
        });
    });
    
    document.querySelectorAll('.delete-webhook').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.getAttribute('data-id'));
            deleteWebhook(id);
        });
    });
}

function updateWebhookDropdown() {
    const select = document.getElementById('messageWebhook');
    if (!select) return;
    
    select.innerHTML = '<option value="">Pilih webhook...</option>';
    
    webhooks.forEach(webhook => {
        if (webhook.enabled) {
            const option = document.createElement('option');
            option.value = webhook.id;
            option.textContent = `${webhook.name} (${webhook.botName})`;
            select.appendChild(option);
        }
    });
    
    // Select first webhook if available
    if (webhooks.length > 0) {
        select.value = webhooks[0].id;
    }
}

function useWebhook(id) {
    const webhook = webhooks.find(w => w.id === id);
    if (webhook) {
        document.querySelector('.nav-item[data-tab="send"]').click();
        document.getElementById('messageWebhook').value = webhook.id;
        document.getElementById('customUsername').value = webhook.botName;
        document.getElementById('messageContent').focus();
        showNotification(`Menggunakan webhook: ${webhook.name}`, 'info');
    }
}

function deleteWebhook(id) {
    if (confirm('Hapus webhook ini?')) {
        webhooks = webhooks.filter(w => w.id !== id);
        saveWebhooksToStorage();
        updateWebhookList();
        updateWebhookDropdown();
        updateSpamWebhookList();
        updateStatistics();
        showNotification('Webhook berhasil dihapus', 'info');
        addLog('Webhook dihapus', 'info');
    }
}

// ==================== MESSAGE FUNCTIONS ====================

function sendMessage() {
    const webhookSelect = document.getElementById('messageWebhook');
    const selectedWebhookId = webhookSelect.value;
    
    if (!selectedWebhookId) {
        showNotification('Pilih webhook terlebih dahulu!', 'error');
        return;
    }
    
    const webhook = webhooks.find(w => w.id.toString() === selectedWebhookId);
    if (!webhook) {
        showNotification('Webhook tidak ditemukan!', 'error');
        return;
    }
    
    const message = document.getElementById('messageContent').value.trim();
    const customUsername = document.getElementById('customUsername').value.trim() || webhook.botName;
    
    if (!message) {
        showNotification('Pesan tidak boleh kosong!', 'error');
        document.getElementById('messageContent').focus();
        return;
    }
    
    const payload = {
        content: message,
        username: customUsername,
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(customUsername)}&background=5865F2&color=fff`
    };
    
    showLoading(globalLoading, true);
    
    fetch(webhook.url, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'User-Agent': 'Discord-Webhook-Manager-by-TROY-2026'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        showLoading(globalLoading, false);
        
        if (response.ok) {
            // Update statistics
            messageStats.total++;
            messageStats.today++;
            saveMessageStats();
            updateStatistics();
            
            // Clear message
            document.getElementById('messageContent').value = '';
            
            showNotification('Pesan berhasil dikirim!', 'success');
            addLog(`Pesan dikirim ke ${webhook.name} sebagai "${customUsername}"`, 'success');
            
            // Log to Discord
            logMessageToDiscord(webhook.name, customUsername, message.substring(0, 100));
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    })
    .catch(error => {
        showLoading(globalLoading, false);
        showNotification(`Gagal mengirim pesan: ${error.message}`, 'error');
        addLog(`Gagal mengirim ke ${webhook.name}: ${error.message}`, 'error');
    });
}

function logMessageToDiscord(webhookName, botName, messagePreview) {
    const logPayload = {
        content: `📨 **New Message Sent - TROY Webhook Manager**`,
        embeds: [{
            title: 'Message Log',
            description: `**Webhook:** ${webhookName}\n**Bot Name:** ${botName}\n**User:** ${currentUser.email}\n**Preview:** ${messagePreview}...`,
            color: 3447003,
            footer: {
                text: 'Discord Webhook Manager © 2026 TROY',
                icon_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
            },
            timestamp: new Date().toISOString()
        }]
    };
    
    fetch(OTP_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logPayload)
    }).catch(() => {});
}

function clearMessage() {
    document.getElementById('messageContent').value = '';
    document.getElementById('customUsername').value = '';
    showNotification('Form berhasil dibersihkan', 'info');
}

// ==================== SPAM FUNCTIONS ====================

function loadSpamWebhookList() {
    const spamList = document.getElementById('spamWebhookList');
    if (!spamList) return;
    
    if (webhooks.length === 0) {
        spamList.innerHTML = `
            <div style="text-align: center; padding: 30px 15px; color: var(--light-gray);">
                <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p style="font-weight: 500;">Belum ada webhook</p>
                <p style="font-size: 0.9rem; margin-top: 5px;">Tambahkan webhook terlebih dahulu</p>
            </div>
        `;
        updateSelectedCount();
        return;
    }
    
    spamList.innerHTML = '';
    
    webhooks.forEach(webhook => {
        const checkbox = document.createElement('div');
        checkbox.className = 'webhook-checkbox';
        checkbox.dataset.id = webhook.id;
        
        checkbox.innerHTML = `
            <div class="checkbox-input"></div>
            <div class="webhook-checkbox-info">
                <h5>${webhook.name}</h5>
                <p>Bot: ${webhook.botName} | ${webhook.url.substring(0, 30)}...</p>
            </div>
        `;
        
        checkbox.addEventListener('click', function(e) {
            if (!e.target.classList.contains('checkbox-input')) {
                const checkboxInput = this.querySelector('.checkbox-input');
                checkboxInput.classList.toggle('checked');
                this.classList.toggle('selected');
                checkboxInput.classList.add('pulse');
                updateSelectedCount();
                updateDelayPreview();
                
                setTimeout(() => {
                    checkboxInput.classList.remove('pulse');
                }, 300);
            }
        });
        
        spamList.appendChild(checkbox);
    });
    
    // Setup select/deselect all buttons
    document.getElementById('selectAllSpam')?.addEventListener('click', function() {
        document.querySelectorAll('.webhook-checkbox').forEach(cb => {
            cb.querySelector('.checkbox-input').classList.add('checked');
            cb.classList.add('selected');
        });
        updateSelectedCount();
        updateDelayPreview();
    });
    
    document.getElementById('deselectAllSpam')?.addEventListener('click', function() {
        document.querySelectorAll('.webhook-checkbox').forEach(cb => {
            cb.querySelector('.checkbox-input').classList.remove('checked');
            cb.classList.remove('selected');
        });
        updateSelectedCount();
        updateDelayPreview();
    });
    
    updateSelectedCount();
}

function updateSelectedCount() {
    const selectedCount = document.querySelectorAll('.checkbox-input.checked').length;
    document.getElementById('selectedWebhooksCount').textContent = selectedCount;
}

function getSelectedWebhooks() {
    const selectedIds = [];
    document.querySelectorAll('.checkbox-input.checked').forEach(cb => {
        const checkbox = cb.closest('.webhook-checkbox');
        if (checkbox) {
            selectedIds.push(parseInt(checkbox.dataset.id));
        }
    });
    
    return webhooks.filter(w => selectedIds.includes(w.id));
}

// ==================== DELAY CONTROL FUNCTIONS ====================

function setupDelayControls() {
    // Delay type change
    document.querySelectorAll('input[name="delayType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            // Hide all delay settings
            document.querySelectorAll('.delay-settings').forEach(el => {
                el.style.display = 'none';
            });
            
            // Show selected delay settings
            const selectedType = this.value;
            document.getElementById(`${selectedType}DelaySettings`).style.display = 'block';
            
            // Update rate limit warning
            updateRateLimitWarning();
            updateDelayPreview();
        });
    });
    
    // Fixed delay slider
    const fixedDelaySlider = document.getElementById('fixedDelayValue');
    if (fixedDelaySlider) {
        fixedDelaySlider.addEventListener('input', function() {
            document.getElementById('fixedDelayDisplay').textContent = this.value;
            updateRateLimitWarning();
            updateDelayPreview();
        });
    }
    
    // Random delay inputs
    document.getElementById('randomDelayMin')?.addEventListener('input', updateRandomDelayPreview);
    document.getElementById('randomDelayMax')?.addEventListener('input', updateRandomDelayPreview);
    
    // Incremental delay inputs
    document.getElementById('incrementalStart')?.addEventListener('input', updateDelayPreview);
    document.getElementById('incrementalStep')?.addEventListener('input', updateDelayPreview);
    
    // Spam message input
    document.getElementById('spamMessage')?.addEventListener('input', updateDelayPreview);
    document.getElementById('spamBotName')?.addEventListener('input', updateDelayPreview);
}

function updateRandomDelayPreview() {
    const min = parseInt(document.getElementById('randomDelayMin').value) || 500;
    const max = parseInt(document.getElementById('randomDelayMax').value) || 3000;
    
    if (min > max) {
        document.getElementById('randomDelayMax').value = min;
    }
    
    document.getElementById('randomRangePreview').textContent = `${min}-${max}`;
    updateRateLimitWarning();
    updateDelayPreview();
}

function updateRateLimitWarning() {
    const delayType = document.querySelector('input[name="delayType"]:checked').value;
    let delayValue;
    
    if (delayType === 'fixed') {
        delayValue = parseInt(document.getElementById('fixedDelayValue').value);
    } else if (delayType === 'random') {
        delayValue = (parseInt(document.getElementById('randomDelayMin').value) + 
                     parseInt(document.getElementById('randomDelayMax').value)) / 2;
    } else {
        delayValue = parseInt(document.getElementById('incrementalStart').value);
    }
    
    const warningElement = document.getElementById('rateLimitWarning');
    if (delayValue < 500) {
        warningElement.style.display = 'block';
    } else {
        warningElement.style.display = 'none';
    }
}

function updateDelayPreview() {
    const selectedWebhooks = getSelectedWebhooks();
    const totalWebhooks = selectedWebhooks.length;
    
    if (totalWebhooks === 0) {
        updatePreviewStats(0, 0, 0, 0);
        return;
    }
    
    const delayType = document.querySelector('input[name="delayType"]:checked').value;
    let avgDelay, totalTime;
    
    switch(delayType) {
        case 'fixed':
            const fixedDelay = parseInt(document.getElementById('fixedDelayValue').value) || 1000;
            avgDelay = fixedDelay;
            totalTime = (totalWebhooks - 1) * fixedDelay;
            break;
            
        case 'random':
            const min = parseInt(document.getElementById('randomDelayMin').value) || 500;
            const max = parseInt(document.getElementById('randomDelayMax').value) || 3000;
            avgDelay = (min + max) / 2;
            totalTime = (totalWebhooks - 1) * avgDelay;
            break;
            
        case 'incremental':
            const start = parseInt(document.getElementById('incrementalStart').value) || 500;
            const step = parseInt(document.getElementById('incrementalStep').value) || 100;
            avgDelay = start + ((totalWebhooks - 1) * step / 2);
            totalTime = (totalWebhooks * (2 * start + (totalWebhooks - 1) * step)) / 2;
            break;
    }
    
    const rps = avgDelay > 0 ? (1000 / avgDelay).toFixed(1) : 0;
    
    updatePreviewStats(totalWebhooks, avgDelay, totalTime / 1000, rps);
    drawTimelinePreview(totalWebhooks, delayType);
}

function updatePreviewStats(total, avgDelay, totalTime, rps) {
    document.getElementById('previewTotal').textContent = total;
    document.getElementById('previewAvgDelay').textContent = Math.round(avgDelay);
    document.getElementById('previewTotalTime').textContent = totalTime.toFixed(1);
    document.getElementById('previewRPS').textContent = rps;
}

function drawTimelinePreview(total, delayType) {
    const timeline = document.getElementById('timelinePreview');
    timeline.innerHTML = '';
    
    if (total === 0) return;
    
    // Limit display to max 10 items for performance
    const displayCount = Math.min(total, 10);
    const scale = 100 / displayCount;
    
    for (let i = 0; i < displayCount; i++) {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        
        // Calculate position and width based on delay type
        let left, width;
        
        switch(delayType) {
            case 'fixed':
                left = i * scale;
                width = scale * 0.8;
                break;
                
            case 'random':
                left = i * scale;
                width = scale * 0.6 + Math.random() * scale * 0.4;
                break;
                
            case 'incremental':
                left = i * scale;
                width = scale * 0.5 + (i * scale * 0.05);
                break;
        }
        
        item.style.left = `${left}%`;
        item.style.width = `${width}%`;
        item.textContent = i + 1;
        
        // Add hover effect
        item.title = `Webhook ${i + 1}`;
        
        timeline.appendChild(item);
    }
}

// ==================== SPAM CONTROL FUNCTIONS ====================

function getDelayConfig() {
    const delayType = document.querySelector('input[name="delayType"]:checked').value;
    
    switch(delayType) {
        case 'fixed':
            return {
                type: 'fixed',
                value: parseInt(document.getElementById('fixedDelayValue').value) || 1000
            };
            
        case 'random':
            return {
                type: 'random',
                min: parseInt(document.getElementById('randomDelayMin').value) || 500,
                max: parseInt(document.getElementById('randomDelayMax').value) || 3000
            };
            
        case 'incremental':
            return {
                type: 'incremental',
                start: parseInt(document.getElementById('incrementalStart').value) || 500,
                step: parseInt(document.getElementById('incrementalStep').value) || 100
            };
    }
}

// ==================== UTILITY FUNCTIONS ====================

function quickSend() {
    document.querySelector('.nav-item[data-tab="send"]').click();
    
    // Fill with sample message
    document.getElementById('messageContent').value = 'Halo! Ini adalah pesan cepat dari Discord Webhook Manager by TROY 2026.';
    
    // Auto-focus on message
    setTimeout(() => {
        document.getElementById('messageContent').focus();
    }, 300);
}

function addWebhook() {
    document.querySelector('.nav-item[data-tab="webhooks"]').click();
    document.getElementById('webhookUrl').focus();
}

function testConnection() {
    if (webhooks.length === 0) {
        showNotification('Belum ada webhook yang disimpan!', 'error');
        return;
    }
    
    const webhook = webhooks[0];
    showLoading(globalLoading, true);
    
    // Test by sending a simple message
    const testPayload = {
        content: '🔧 **Connection Test - TROY Webhook Manager**\nWebhook Manager v3.0 terhubung dengan baik!',
        username: 'Connection Tester',
        avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
    };
    
    fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
    })
    .then(response => {
        showLoading(globalLoading, false);
        if (response.ok) {
            showNotification('Koneksi webhook berhasil!', 'success');
            addLog(`Test koneksi berhasil ke ${webhook.name}`, 'success');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    })
    .catch(error => {
        showLoading(globalLoading, false);
        showNotification(`Test koneksi gagal: ${error.message}`, 'error');
        addLog(`Test koneksi gagal: ${error.message}`, 'error');
    });
}

function gotoSpam() {
    document.querySelector('.nav-item[data-tab="spam"]').click();
}

function clearLogs() {
    if (confirm('Hapus semua log aktivitas?')) {
        const logContent = document.getElementById('logContent');
        logContent.innerHTML = '<div class="log-entry info">[SISTEM] Log dibersihkan</div>';
        showNotification('Log berhasil dibersihkan', 'success');
    }
}

function loadMessageStats() {
    const saved = localStorage.getItem('message_stats');
    if (saved) {
        const stats = JSON.parse(saved);
        messageStats.total = stats.total || 0;
        messageStats.today = stats.today || 0;
        messageStats.spamSessions = stats.spamSessions || 0;
        
        // Check if today's date has changed
        const today = new Date().toDateString();
        const lastSavedDate = stats.lastSaved ? new Date(stats.lastSaved).toDateString() : null;
        
        if (lastSavedDate !== today) {
            messageStats.today = 0;
        }
    }
    updateStatistics();
}

function saveMessageStats() {
    messageStats.lastSaved = new Date().toISOString();
    localStorage.setItem('message_stats', JSON.stringify(messageStats));
}

function updateStatistics() {
    // Update counts
    document.getElementById('webhookCount').textContent = webhooks.length;
    document.getElementById('messageCount').textContent = messageStats.total;
    document.getElementById('spamCount').textContent = messageStats.spamSessions;
    document.getElementById('todayCount').textContent = messageStats.today;
    document.getElementById('totalCount').textContent = messageStats.total;
    document.getElementById('spamSessionCount').textContent = messageStats.spamSessions;
    
    // Update last login
    const lastLoginElement = document.getElementById('lastLogin');
    if (lastLoginElement && currentUser) {
        lastLoginElement.textContent = new Date(currentUser.loginTime).toLocaleString('id-ID');
    }
}

function addLog(message, type = 'info') {
    const logContent = document.getElementById('logContent');
    if (!logContent) return;
    
    const timestamp = new Date().toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    logContent.appendChild(logEntry);
    
    // Scroll to bottom
    logContent.scrollTop = logContent.scrollHeight;
    
    // Limit logs to 50 entries
    const entries = logContent.querySelectorAll('.log-entry');
    if (entries.length > 50) {
        entries[0].remove();
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    
    // Remove existing notification
    const existing = container.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            notification.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 4000);
}

function showLoading(element, show) {
    if (!element) return;
    
    if (show) {
        element.classList.add('active');
    } else {
        element.classList.remove('active');
    }
}

// Add shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// Make functions available globally
window.showNotification = showNotification;
window.showLoading = showLoading;
