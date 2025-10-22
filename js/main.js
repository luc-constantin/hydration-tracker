// ===============================
// Persistent State
// ===============================
const state = {
  dailyGoal: parseInt(localStorage.getItem('dailyGoal')) || 2000,
  totalConsumed: parseInt(localStorage.getItem('totalConsumed')) || 0,
  intervalHours: parseFloat(localStorage.getItem('intervalHours')) || 1,
  startWindowEnabled: JSON.parse(localStorage.getItem('startWindowEnabled') || 'false'),
  windowStart: localStorage.getItem('windowStart') || '08:00',
  windowEnd: localStorage.getItem('windowEnd') || '20:00',
  lastResetISO: localStorage.getItem('lastResetISO') || null,
  nextReminder: parseInt(localStorage.getItem('nextReminder')) || null,
  reminderInterval: null
};

// ===============================
// UI Elements
// ===============================
const progressText = document.getElementById('progressText');
const reminderText = document.getElementById('reminderText');
const settingsBtn = document.getElementById('settingsBtn');
const resetBtn = document.getElementById('resetBtn');
const add250 = document.getElementById('add250');
const add300 = document.getElementById('add300');
const add500 = document.getElementById('add500');
const enableRemindersBtn = document.getElementById('enableRemindersBtn');
const progressBar = document.getElementById('progressBar');

// ===============================
// Helper Functions
// ===============================
function saveState() {
  localStorage.setItem('dailyGoal', state.dailyGoal);
  localStorage.setItem('totalConsumed', state.totalConsumed);
  localStorage.setItem('intervalHours', state.intervalHours);
  localStorage.setItem('startWindowEnabled', state.startWindowEnabled);
  localStorage.setItem('windowStart', state.windowStart);
  localStorage.setItem('windowEnd', state.windowEnd);
  localStorage.setItem('lastResetISO', state.lastResetISO);
  localStorage.setItem('nextReminder', state.nextReminder || '');
}

// ===============================
// Hydration Progress
// ===============================
function updateProgressUI() {
  progressText.textContent = `${state.totalConsumed} ml / ${state.dailyGoal} ml`;
  const percent = Math.min(100, (state.totalConsumed / state.dailyGoal) * 100);
  progressBar.style.width = `${percent}%`;
}

// ===============================
// Reminder Logic
// ===============================

// Schedule a new reminder
function scheduleReminder(hours) {
  const now = Date.now();
  const reminderTime = now + hours * 60 * 60 * 1000;
  state.nextReminder = reminderTime;
  saveState();
  startReminderCountdown(reminderTime);
}

// Start the reminder countdown
function startReminderCountdown(reminderTime) {
  if (state.reminderInterval) clearInterval(state.reminderInterval);

  state.reminderInterval = setInterval(() => {
    const diff = reminderTime - Date.now();

    if (diff <= 0) {
      clearInterval(state.reminderInterval);
      state.nextReminder = null;
      saveState();
      showReminderNotification();
      reminderText.textContent = 'No active reminder';
    } else {
      const minutesLeft = Math.ceil(diff / 60000);
      reminderText.textContent = `Next reminder in ${minutesLeft} min`;
    }
  }, 1000);
}

// Show notification
function showReminderNotification() {
  if (Notification.permission === "granted") {
    new Notification("💧 Time to drink water!");
  } else {
    alert("💧 Time to drink water!");
  }
}

// Request notification permission
enableRemindersBtn.addEventListener('click', () => {
  if (Notification.permission !== "granted") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        scheduleReminder(state.intervalHours);
      }
    });
  } else {
    scheduleReminder(state.intervalHours);
  }
});

// ===============================
// Daily Reset Logic
// ===============================
function resetDailyProgress() {
  state.totalConsumed = 0;
  state.lastResetISO = new Date().toISOString();
  state.nextReminder = null;
  saveState();
  updateProgressUI();
  reminderText.textContent = 'No active reminder';
  if (state.reminderInterval) clearInterval(state.reminderInterval);
}

// ===============================
// Add Water Functions
// ===============================
function addWater(amount) {
  state.totalConsumed += amount;
  saveState();
  updateProgressUI();
}

// ===============================
// Event Listeners
// ===============================
add250.addEventListener('click', () => addWater(250));
add300.addEventListener('click', () => addWater(300));
add500.addEventListener('click', () => addWater(500));
resetBtn.addEventListener('click', resetDailyProgress);

// ===============================
// App Init
// ===============================

// Resume progress UI
updateProgressUI();

// Resume reminder if there's one stored
if (state.nextReminder && state.nextReminder > Date.now()) {
  startReminderCountdown(state.nextReminder);
} else {
  state.nextReminder = null;
  saveState();
  reminderText.textContent = 'No active reminder';
}

// Register service worker 
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(err => console.log('SW error:', err));
}
