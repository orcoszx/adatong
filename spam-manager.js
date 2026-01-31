/*
============================================
DISCORD WEBHOOK MANAGER - SPAM MANAGER
Copyright © 2026 TROY
All Rights Reserved
============================================
*/

class DelayManager {
    constructor(type = "fixed", options = {}) {
        this.type = type;
        this.options = options;
        this.currentDelay = options.start || options.value || 1000;
        this.callCount = 0;
    }
    
    getNextDelay() {
        this.callCount++;
        
        switch(this.type) {
            case "fixed":
                return this.options.value || 1000;
                
            case "random":
                const min = this.options.min || 500;
                const max = this.options.max || 3000;
                return Math.floor(Math.random() * (max - min + 1)) + min;
                
            case "incremental":
                const delay = this.currentDelay;
                this.currentDelay += (this.options.step || 100);
                return delay;
                
            default:
                return 1000;
        }
    }
    
    reset() {
        this.currentDelay = this.options.start || this.options.value || 1000;
        this.callCount = 0;
    }
    
    getAverageDelay() {
        switch(this.type) {
            case "fixed":
                return this.options.value || 1000;
                
            case "random":
                return ((this.options.min || 500) + (this.options.max || 3000)) / 2;
                
            case "incremental":
                return this.currentDelay;
                
            default:
                return 1000;
        }
    }
}

class SpamQueue {
    constructor(webhooks, message, botName, delayManager) {
        this.webhooks = webhooks;
        this.message = message;
        this.botName = botName;
        this.delayManager = delayManager;
        this.isRunning = false;
        this.isPaused = false;
        this.currentIndex = 0;
        this.sent = 0;
        this.failed = 0;
        this.total = webhooks.length;
        this.startTime = null;
        this.endTime = null;
        this.timeoutId = null;
        this.currentRequest = null;
    }
    
    async start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        this.startTime = new Date();
        this.updateUI();
        
        showNotification(`Memulai spam ke ${this.total} webhook...`, 'info');
        addLog(`[SPAM] Memulai spam ke ${this.total} webhook`, 'spam');
        
        // Update spam session count
        messageStats.spamSessions++;
        saveMessageStats();
        updateStatistics();
        
        await this.processQueue();
    }
    
    async processQueue() {
        while (this.currentIndex < this.total && this.isRunning && !this.isPaused) {
            const webhook = this.webhooks[this.currentIndex];
            const delay = this.delayManager.getNextDelay();
            
            // Update current delay display
            document.getElementById('statsCurrentDelay').textContent = delay;
            
            // Show countdown for current webhook
            this.showCountdown(this.currentIndex + 1, delay);
            
            // Wait for delay (unless paused)
            await this.waitWithPause(delay);
            
            if (!this.isRunning || this.isPaused) break;
            
            // Send to webhook
            await this.sendToWebhook(webhook);
            
            this.currentIndex++;
            this.updateProgress();
        }
        
        if (this.currentIndex >= this.total) {
            this.complete();
        }
    }
    
    async waitWithPause(delay) {
        return new Promise(resolve => {
            let remaining = delay;
            const start = Date.now();
            
            const check = () => {
                if (!this.isRunning) {
                    clearInterval(interval);
                    resolve();
                    return;
                }
                
                if (this.isPaused) {
                    // If paused, don't decrement remaining time
                    setTimeout(check, 100);
                    return;
                }
                
                const elapsed = Date.now() - start;
                remaining = delay - elapsed;
                
                if (remaining <= 0) {
                    clearInterval(interval);
                    resolve();
                } else {
                    // Update countdown display
                    this.updateCountdownDisplay(Math.ceil(remaining / 1000));
                }
            };
            
            const interval = setInterval(check, 100);
            check();
        });
    }
    
    async sendToWebhook(webhook) {
        try {
            const payload = {
                content: this.message,
                username: this.botName || webhook.botName || webhook.name,
                avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(this.botName || webhook.botName || webhook.name)}&background=5865F2&color=fff`
            };
            
            this.currentRequest = fetch(webhook.url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'Discord-Webhook-Spammer-by-TROY-2026'
                },
                body: JSON.stringify(payload)
            });
            
            const response = await this.currentRequest;
            
            if (response.ok) {
                this.sent++;
                messageStats.total++;
                messageStats.today++;
                saveMessageStats();
                updateStatistics();
                
                addLog(`[SPAM] Berhasil ke ${webhook.name} (${this.currentIndex + 1}/${this.total})`, 'success');
                
                // Update success count
                document.getElementById('statsSuccess').textContent = this.sent;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
            
        } catch (error) {
            this.failed++;
            
            // Update failed count
            document.getElementById('statsFailed').textContent = this.failed;
            
            addLog(`[SPAM] Gagal ke ${webhook.name}: ${error.message}`, 'error');
            
            // Log error to Discord
            this.logErrorToDiscord(webhook.name, error.message);
        } finally {
            this.currentRequest = null;
        }
    }
    
    showCountdown(index, delay) {
        const countdownElement = document.getElementById('spamTimeRemaining');
        if (countdownElement) {
            countdownElement.textContent = `Webhook ${index}/${this.total} (${Math.ceil(delay/1000)}s)`;
        }
    }
    
    updateCountdownDisplay(seconds) {
        const countdownElement = document.getElementById('spamTimeRemaining');
        if (countdownElement) {
            const currentText = countdownElement.textContent;
            const newText = currentText.replace(/\(\d+s\)/, `(${seconds}s)`);
            countdownElement.textContent = newText;
        }
    }
    
    updateProgress() {
        const progress = (this.currentIndex / this.total) * 100;
        const progressFill = document.getElementById('spamProgressFill');
        const progressText = document.getElementById('spamProgressText');
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(progress)}% (${this.currentIndex}/${this.total})`;
        }
        
        // Calculate estimated time remaining
        if (this.startTime && this.currentIndex > 0) {
            const elapsed = new Date() - this.startTime;
            const avgTimePerRequest = elapsed / this.currentIndex;
            const remainingRequests = this.total - this.currentIndex;
            const estimatedRemaining = Math.round((remainingRequests * avgTimePerRequest) / 1000);
            
            const timeElement = document.getElementById('spamTimeRemaining');
            if (timeElement) {
                timeElement.textContent = `Estimasi: ${estimatedRemaining}s lagi`;
            }
        }
    }
    
    updateUI() {
        // Enable/disable buttons
        document.getElementById('startSpam').disabled = this.isRunning && !this.isPaused;
        document.getElementById('pauseSpam').disabled = !this.isRunning || this.isPaused;
        document.getElementById('stopSpam').disabled = !this.isRunning;
        
        // Update button text based on state
        const pauseBtn = document.getElementById('pauseSpam');
        if (pauseBtn) {
            pauseBtn.innerHTML = this.isPaused ? 
                '<i class="fas fa-play"></i> Lanjut' : 
                '<i class="fas fa-pause"></i> Jeda';
        }
    }
    
    pause() {
        if (!this.isRunning || this.isPaused) return;
        
        this.isPaused = true;
        this.updateUI();
        showNotification('Spam dijeda', 'warning');
        addLog('[SPAM] Dijeda oleh user', 'info');
    }
    
    resume() {
        if (!this.isRunning || !this.isPaused) return;
        
        this.isPaused = false;
        this.updateUI();
        showNotification('Spam dilanjutkan', 'info');
        addLog('[SPAM] Dilanjutkan oleh user', 'info');
        
        // Continue processing
        this.processQueue();
    }
    
    stop() {
        this.isRunning = false;
        this.isPaused = false;
        
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        
        if (this.currentRequest) {
            // Try to abort current request
            // Note: Fetch API doesn't have abort in older browsers
        }
        
        this.endTime = new Date();
        this.updateUI();
        
        showNotification('Spam dihentikan', 'warning');
        addLog(`[SPAM] Dihentikan. Berhasil: ${this.sent}, Gagal: ${this.failed}`, 'info');
        
        // Log completion to Discord
        this.logCompletionToDiscord();
    }
    
    complete() {
        this.isRunning = false;
        this.endTime = new Date();
        
        const totalTime = this.endTime - this.startTime;
        const avgTime = totalTime / this.total;
        
        showNotification(`Spam selesai! ${this.sent} berhasil, ${this.failed} gagal`, 'success');
        addLog(`[SPAM] Selesai. Total waktu: ${Math.round(totalTime/1000)}s, Rata-rata: ${Math.round(avgTime)}ms/webhook`, 'success');
        
        // Update UI
        document.getElementById('startSpam').disabled = false;
        document.getElementById('pauseSpam').disabled = true;
        document.getElementById('stopSpam').disabled = true;
        
        // Log completion to Discord
        this.logCompletionToDiscord();
        
        // Reset progress bar after delay
        setTimeout(() => {
            const progressFill = document.getElementById('spamProgressFill');
            if (progressFill) {
                progressFill.style.width = '0%';
            }
        }, 3000);
    }
    
    logErrorToDiscord(webhookName, error) {
        const logPayload = {
            content: `❌ **Spam Error - TROY Webhook Manager**`,
            embeds: [{
                title: 'Spam Error Log',
                description: `**Webhook:** ${webhookName}\n**Error:** ${error}\n**Progress:** ${this.currentIndex + 1}/${this.total}`,
                color: 15158332,
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
    
    logCompletionToDiscord() {
        const totalTime = this.endTime ? (this.endTime - this.startTime) / 1000 : 0;
        
        const logPayload = {
            content: `📊 **Spam Completed - TROY Webhook Manager**`,
            embeds: [{
                title: 'Spam Completion Report',
                description: `**User:** ${currentUser.email}\n**Total Webhooks:** ${this.total}\n**Success:** ${this.sent}\n**Failed:** ${this.failed}\n**Total Time:** ${totalTime.toFixed(1)}s`,
                color: 3066993,
                fields: [
                    {
                        name: '📈 Success Rate',
                        value: `${((this.sent / this.total) * 100).toFixed(1)}%`,
                        inline: true
                    },
                    {
                        name: '⏱️ Average Time',
                        value: `${(totalTime / this.total).toFixed(1)}s/webhook`,
                        inline: true
                    },
                    {
                        name: '⚙️ Delay Type',
                        value: this.delayManager.type,
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logPayload)
        }).catch(() => {});
    }
}

// Global spam queue instance
let spamQueue = null;

// Initialize spam functionality
document.addEventListener('DOMContentLoaded', function() {
    setupSpamControls();
});

function setupSpamControls() {
    // Start Spam Button
    document.getElementById('startSpam')?.addEventListener('click', function() {
        startSpam();
    });
    
    // Pause/Resume Spam Button
    document.getElementById('pauseSpam')?.addEventListener('click', function() {
        if (spamQueue) {
            if (spamQueue.isPaused) {
                spamQueue.resume();
            } else {
                spamQueue.pause();
            }
        }
    });
    
    // Stop Spam Button
    document.getElementById('stopSpam')?.addEventListener('click', function() {
        if (spamQueue) {
            spamQueue.stop();
        }
    });
}

function startSpam() {
    // Get selected webhooks
    const selectedWebhooks = getSelectedWebhooks();
    
    if (selectedWebhooks.length === 0) {
        showNotification('Pilih minimal 1 webhook untuk spam!', 'error');
        return;
    }
    
    // Get message
    const message = document.getElementById('spamMessage').value.trim();
    if (!message) {
        showNotification('Masukkan pesan untuk spam!', 'error');
        document.getElementById('spamMessage').focus();
        return;
    }
    
    // Get bot name (use custom or fallback to first webhook's bot name)
    const customBotName = document.getElementById('spamBotName').value.trim();
    
    // Get delay configuration
    const delayConfig = getDelayConfig();
    
    // Create delay manager
    const delayManager = new DelayManager(delayConfig.type, delayConfig);
    
    // Create spam queue
    spamQueue = new SpamQueue(
        selectedWebhooks,
        message,
        customBotName,
        delayManager
    );
    
    // Reset stats display
    document.getElementById('statsSuccess').textContent = '0';
    document.getElementById('statsFailed').textContent = '0';
    document.getElementById('statsCurrentDelay').textContent = delayManager.getAverageDelay();
    
    // Start spam
    spamQueue.start();
}

// Utility function to validate spam configuration
function validateSpamConfig() {
    const selectedWebhooks = getSelectedWebhooks();
    const message = document.getElementById('spamMessage').value.trim();
    const delayConfig = getDelayConfig();
    
    const errors = [];
    const warnings = [];
    
    // Check for errors
    if (selectedWebhooks.length === 0) {
        errors.push('Pilih minimal 1 webhook');
    }
    
    if (!message) {
        errors.push('Masukkan pesan untuk spam');
    }
    
    // Check for warnings
    if (selectedWebhooks.length > 50) {
        warnings.push('Banyak webhook (>50) mungkin butuh waktu lama');
    }
    
    if (delayConfig.type === 'fixed' && delayConfig.value < 200) {
        warnings.push('Delay terlalu kecil (<200ms) bisa kena rate limit');
    }
    
    if (delayConfig.type === 'random' && delayConfig.min < 200) {
        warnings.push('Minimum delay terlalu kecil (<200ms)');
    }
    
    // Calculate requests per second
    let avgDelay;
    switch(delayConfig.type) {
        case 'fixed':
            avgDelay = delayConfig.value;
            break;
        case 'random':
            avgDelay = (delayConfig.min + delayConfig.max) / 2;
            break;
        case 'incremental':
            avgDelay = delayConfig.start;
            break;
    }
    
    const rps = 1000 / avgDelay;
    if (rps > 5) {
        warnings.push(`Rate tinggi: ${rps.toFixed(1)} request/detik (max 5)`);
    }
    
    return { errors, warnings };
}

// Function to estimate spam completion time
function estimateSpamTime(webhookCount, delayConfig) {
    let avgDelay;
    
    switch(delayConfig.type) {
        case 'fixed':
            avgDelay = delayConfig.value;
            break;
        case 'random':
            avgDelay = (delayConfig.min + delayConfig.max) / 2;
            break;
        case 'incremental':
            avgDelay = delayConfig.start + ((webhookCount - 1) * delayConfig.step / 2);
            break;
        default:
            avgDelay = 1000;
    }
    
    const totalTime = (webhookCount - 1) * avgDelay;
    return {
        totalSeconds: Math.round(totalTime / 1000),
        avgDelay: Math.round(avgDelay),
        requestsPerSecond: (1000 / avgDelay).toFixed(1)
    };
}

// Function to save spam configuration as preset
function saveSpamPreset(name) {
    const config = {
        name: name,
        message: document.getElementById('spamMessage').value,
        botName: document.getElementById('spamBotName').value,
        delayConfig: getDelayConfig(),
        selectedWebhooks: getSelectedWebhooks().map(w => w.id),
        timestamp: new Date().toISOString()
    };
    
    const presets = JSON.parse(localStorage.getItem('spam_presets') || '[]');
    presets.push(config);
    localStorage.setItem('spam_presets', JSON.stringify(presets));
    
    showNotification(`Preset "${name}" disimpan`, 'success');
}

// Function to load spam preset
function loadSpamPreset(presetName) {
    const presets = JSON.parse(localStorage.getItem('spam_presets') || '[]');
    const preset = presets.find(p => p.name === presetName);
    
    if (!preset) {
        showNotification(`Preset "${presetName}" tidak ditemukan`, 'error');
        return;
    }
    
    // Load message and bot name
    document.getElementById('spamMessage').value = preset.message || '';
    document.getElementById('spamBotName').value = preset.botName || '';
    
    // Load delay config
    const delayType = preset.delayConfig.type;
    document.querySelector(`input[name="delayType"][value="${delayType}"]`).checked = true;
    
    // Trigger change event to show correct settings
    document.querySelector(`input[name="delayType"][value="${delayType}"]`).dispatchEvent(new Event('change'));
    
    // Set delay values
    switch(delayType) {
        case 'fixed':
            document.getElementById('fixedDelayValue').value = preset.delayConfig.value || 1000;
            document.getElementById('fixedDelayDisplay').textContent = preset.delayConfig.value || 1000;
            break;
        case 'random':
            document.getElementById('randomDelayMin').value = preset.delayConfig.min || 500;
            document.getElementById('randomDelayMax').value = preset.delayConfig.max || 3000;
            updateRandomDelayPreview();
            break;
        case 'incremental':
            document.getElementById('incrementalStart').value = preset.delayConfig.start || 500;
            document.getElementById('incrementalStep').value = preset.delayConfig.step || 100;
            break;
    }
    
    // Select webhooks
    const selectedIds = preset.selectedWebhooks || [];
    document.querySelectorAll('.webhook-checkbox').forEach(cb => {
        const id = parseInt(cb.dataset.id);
        const checkboxInput = cb.querySelector('.checkbox-input');
        
        if (selectedIds.includes(id)) {
            checkboxInput.classList.add('checked');
            cb.classList.add('selected');
        } else {
            checkboxInput.classList.remove('checked');
            cb.classList.remove('selected');
        }
    });
    
    updateSelectedCount();
    updateDelayPreview();
    
    showNotification(`Preset "${presetName}" dimuat`, 'success');
}

// Function to get spam presets
function getSpamPresets() {
    return JSON.parse(localStorage.getItem('spam_presets') || '[]');
}

// Function to delete spam preset
function deleteSpamPreset(presetName) {
    const presets = JSON.parse(localStorage.getItem('spam_presets') || '[]');
    const filtered = presets.filter(p => p.name !== presetName);
    localStorage.setItem('spam_presets', JSON.stringify(filtered));
    
    showNotification(`Preset "${presetName}" dihapus`, 'info');
}

// Auto-save spam configuration when leaving page
window.addEventListener('beforeunload', function() {
    if (spamQueue && spamQueue.isRunning) {
        // Warn user if spam is running
        return 'Spam sedang berjalan. Yakin ingin meninggalkan halaman?';
    }
    
    // Save current spam configuration
    const spamConfig = {
        message: document.getElementById('spamMessage').value,
        botName: document.getElementById('spamBotName').value,
        delayConfig: getDelayConfig(),
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('last_spam_config', JSON.stringify(spamConfig));
});

// Load last spam configuration on page load
window.addEventListener('load', function() {
    const lastConfig = localStorage.getItem('last_spam_config');
    if (lastConfig) {
        try {
            const config = JSON.parse(lastConfig);
            
            // Load message and bot name
            document.getElementById('spamMessage').value = config.message || '';
            document.getElementById('spamBotName').value = config.botName || '';
            
            // Load delay config if available
            if (config.delayConfig) {
                const delayType = config.delayConfig.type;
                const radio = document.querySelector(`input[name="delayType"][value="${delayType}"]`);
                if (radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change'));
                    
                    // Set delay values
                    switch(delayType) {
                        case 'fixed':
                            if (document.getElementById('fixedDelayValue')) {
                                document.getElementById('fixedDelayValue').value = config.delayConfig.value || 1000;
                                document.getElementById('fixedDelayDisplay').textContent = config.delayConfig.value || 1000;
                            }
                            break;
                        case 'random':
                            if (document.getElementById('randomDelayMin')) {
                                document.getElementById('randomDelayMin').value = config.delayConfig.min || 500;
                                document.getElementById('randomDelayMax').value = config.delayConfig.max || 3000;
                                updateRandomDelayPreview();
                            }
                            break;
                        case 'incremental':
                            if (document.getElementById('incrementalStart')) {
                                document.getElementById('incrementalStart').value = config.delayConfig.start || 500;
                                document.getElementById('incrementalStep').value = config.delayConfig.step || 100;
                            }
                            break;
                    }
                }
            }
            
            updateDelayPreview();
            
        } catch (error) {
            console.error('Error loading last spam config:', error);
        }
    }
});

// Export spam functions to global scope
window.startSpam = startSpam;
window.saveSpamPreset = saveSpamPreset;
window.loadSpamPreset = loadSpamPreset;
window.getSpamPresets = getSpamPresets;
window.deleteSpamPreset = deleteSpamPreset;
window.validateSpamConfig = validateSpamConfig;
window.estimateSpamTime = estimateSpamTime;

// Add keyboard shortcuts for spam controls
document.addEventListener('keydown', function(e) {
    // Ctrl+Enter to start spam (when in spam tab)
    if (e.ctrlKey && e.key === 'Enter') {
        const activeTab = document.querySelector('.nav-item.active');
        if (activeTab && activeTab.dataset.tab === 'spam') {
            e.preventDefault();
            startSpam();
        }
    }
    
    // Space to pause/resume spam
    if (e.key === ' ' && spamQueue && spamQueue.isRunning) {
        e.preventDefault();
        if (spamQueue.isPaused) {
            spamQueue.resume();
        } else {
            spamQueue.pause();
        }
    }
    
    // Escape to stop spam
    if (e.key === 'Escape' && spamQueue && spamQueue.isRunning) {
        e.preventDefault();
        spamQueue.stop();
    }
});

// Helper function to create example spam configuration
function createExampleSpam() {
    if (webhooks.length === 0) {
        showNotification('Tambahkan webhook terlebih dahulu', 'error');
        return;
    }
    
    // Set example message
    document.getElementById('spamMessage').value = '🚀 **Auto Message from TROY Webhook Manager**\n\nThis is an automated message sent using the spam feature.\n\n*Powered by TROY Webhook Manager 2026*';
    
    // Set example bot name
    document.getElementById('spamBotName').value = 'TROY Spam Bot';
    
    // Select all webhooks
    document.querySelectorAll('.webhook-checkbox').forEach(cb => {
        cb.querySelector('.checkbox-input').classList.add('checked');
        cb.classList.add('selected');
    });
    
    updateSelectedCount();
    updateDelayPreview();
    
    showNotification('Contoh konfigurasi spam dimuat', 'info');
}

// Add example button if needed (uncomment to add)
/*
const exampleBtn = document.createElement('button');
exampleBtn.className = 'btn btn-secondary btn-small';
exampleBtn.innerHTML = '<i class="fas fa-magic"></i> Contoh';
exampleBtn.style.marginLeft = '10px';
exampleBtn.onclick = createExampleSpam;

const spamControls = document.querySelector('.selection-controls');
if (spamControls) {
    spamControls.appendChild(exampleBtn);
}
*/

console.log('🎯 Spam Manager loaded successfully!');
console.log('📝 Copyright © 2026 TROY - Discord Webhook Manager');
