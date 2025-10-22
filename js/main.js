// ---- Persistent state ----
// Keeps user settings and daily progress saved between sessions
const state = {
  dailyGoal: parseInt(localStorage.getItem('dailyGoal')) || 0,
  totalConsumed: parseInt(localStorage.getItem('totalConsumed')) || 0,
  intervalMinutes: parseInt(localStorage.getItem('intervalMinutes')) || 0, // changed from intervalHours
  startWindowEnabled: JSON.parse(localStorage.getItem('startWindowEnabled') || 'false'),
  windowStart: localStorage.getItem('windowStart') || '08:00',
  windowEnd: localStorage.getItem('windowEnd') || '20:00',
  lastResetISO: localStorage.getItem('lastResetISO') || null,
  scheduledTimeouts: []
};

// ---- Register service worker for PWA ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}

// ---- Initialize app when page is loaded ----
window.addEventListener('DOMContentLoaded', () => {
  maybeResetForNewDay();

  // Bind UI buttons
  document.getElementById('open-settings').addEventListener('click', openSettings);
  document.getElementById('close-settings').addEventListener('click', closeSettings);
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('reset-now').addEventListener('click', resetToday);
  document.getElementById('notify-btn').addEventListener('click', enableReminders);

  // Load saved settings into inputs
  document.getElementById('daily-goal').value = state.dailyGoal || '';
  document.getElementById('interval').value = state.intervalMinutes || '';
  document.getElementById('start-window-enabled').checked = !!state.startWindowEnabled;
  document.getElementById('window-start').value = state.windowStart;
  document.getElementById('window-end').value = state.windowEnd;

  // Initialize progress bar, summary, and timers
  updateProgress();
  renderSummary();
  scheduleAutoResetTimer();
  rescheduleNotificationsPreviewOnly();
});

// ---- Add logged water amount & trigger Apple Shortcut ----
function logWater(amount) {
  state.totalConsumed += amount;
  persist();
  updateProgress();

  const shortcutName = 'LogWater';
  const url = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}&input=${amount}`;
  window.location.href = url;
}

// ---- Update UI progress bar and text ----
function updateProgress() {
  const progress =
    state.dailyGoal > 0
      ? Math.min((state.totalConsumed / state.dailyGoal) * 100, 100)
      : 0;
  document.getElementById('progress-bar').style.width = `${progress}%`;
  document.getElementById('consumed').innerText = `${state.totalConsumed} ml / ${state.dailyGoal} ml`;
  document.getElementById('goal-label').innerText = `${state.dailyGoal} ml`;
}

// ---- Open settings modal ----
function openSettings() {
  document.getElementById('settings-modal').classList.remove('hidden');
  document.getElementById('settings-modal').setAttribute('aria-hidden', 'false');
}

// ---- Close settings modal ----
function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
  document.getElementById('settings-modal').setAttribute('aria-hidden', 'true');
}

// ---- Save settings and reschedule notifications ----
function saveSettings() {
  const goal = parseInt(document.getElementById('daily-goal').value);
  const interval = parseInt(document.getElementById('interval').value); // now in minutes
  const startEnabled = document.getElementById('start-window-enabled').checked;
  const start = document.getElementById('window-start').value || '08:00';
  const end = document.getElementById('window-end').value || '20:00';

  if (!isNaN(goal) && goal > 0) state.dailyGoal = goal;
  if (!isNaN(interval) && interval > 0) state.intervalMinutes = interval;
  state.startWindowEnabled = startEnabled;
  state.windowStart = start;
  state.windowEnd = end;

  persist();
  updateProgress();
  renderSummary();
  rescheduleNotificationsPreviewOnly();
  closeSettings();
}

// ---- Manual reset of daily progress ----
function resetToday() {
  state.totalConsumed = 0;
  state.lastResetISO = todayISO();
  persist();
  updateProgress();
  renderSummary();
  toast('Progress reset for today.');
}

// ---- Automatic reset at midnight ----
function maybeResetForNewDay() {
  const today = todayISO();
  if (state.lastResetISO !== today) {
    state.totalConsumed = 0;
    state.lastResetISO = today;
    persist();
  }
}

// ---- Schedule auto-reset at midnight ----
function scheduleAutoResetTimer() {
  if (state._midnightTimer) clearTimeout(state._midnightTimer);
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const ms = nextMidnight - now;
  state._midnightTimer = setTimeout(() => {
    resetToday();
    scheduleAutoResetTimer();
  }, ms);
}

// ---- Ask permission and enable reminders ----
function enableReminders() {
  Notification.requestPermission().then(permission => {
    if (permission !== 'granted') {
      alert('Please allow notifications to get reminders!');
      return;
    }
    scheduleTodayNotifications();
  });
}

// ---- Schedule all notifications for the current day ----
function scheduleTodayNotifications() {
  state.scheduledTimeouts.forEach(id => clearTimeout(id));
  state.scheduledTimeouts = [];

  if (!state.intervalMinutes || state.intervalMinutes <= 0) {
    toast('Set a reminder interval in Settings first.');
    return;
  }

  const now = new Date();
  const startEnd = getWindowBoundsForToday();
  let next = new Date(now);

  if (state.startWindowEnabled && next < startEnd.start) next = new Date(startEnd.start);

  let i = 0;
  while (true) {
    if (i > 0) next = new Date(next.getTime() + state.intervalMinutes * 60 * 1000);
    i++;

    if (state.startWindowEnabled && next > startEnd.end) break;
    if (!state.startWindowEnabled && next - now > 12 * 60 * 60 * 1000) break;

    const delay = next - now;
    if (delay <= 0) continue;

    const id = setTimeout(() => {
      new Notification('💧 Time to drink water!', {
        body: 'Log your next glass. Stay hydrated!',
        icon: 'icons/icon-192.png'
      });
      renderSummary();
    }, delay);

    state.scheduledTimeouts.push(id);
    renderSummary(next);
  }

  toast("Today's reminders scheduled.");
}

// ---- Preview of next reminder time ----
function rescheduleNotificationsPreviewOnly() {
  const now = new Date();
  const startEnd = getWindowBoundsForToday();
  let next = new Date(now);
  if (state.startWindowEnabled && next < startEnd.start) next = new Date(startEnd.start);
  if (state.intervalMinutes > 0) {
    next = new Date(next.getTime() + state.intervalMinutes * 60 * 1000);
  } else {
    next = null;
  }
  renderSummary(next);
}

// ---- Get start & end time boundaries for reminder window ----
function getWindowBoundsForToday() {
  const [sh, sm] = (state.windowStart || '08:00').split(':').map(n => parseInt(n, 10));
  const [eh, em] = (state.windowEnd || '20:00').split(':').map(n => parseInt(n, 10));
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em, 0, 0);
  return { start, end };
}

// ---- Update UI label for next reminder time ----
function renderSummary(nextTime = null) {
  const label = document.getElementById('next-reminder');
  if (state.intervalMinutes > 0) {
    const now = new Date();
    if (!nextTime) {
      const startEnd = getWindowBoundsForToday();
      let next = new Date(now.getTime() + state.intervalMinutes * 60 * 1000);
      if (state.startWindowEnabled && next < startEnd.start) next = startEnd.start;
      nextTime = next;
    }
    label.textContent = formatTime(nextTime);
  } else {
    label.textContent = '—';
  }
}

// ---- Simple toast logger ----
function toast(msg) {
  console.log(msg);
}

// ---- Format Date object into HH:MM ----
function formatTime(d) {
  if (!(d instanceof Date)) return '—';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// ---- Save current state to localStorage ----
function persist() {
  localStorage.setItem('dailyGoal', state.dailyGoal);
  localStorage.setItem('totalConsumed', state.totalConsumed);
  localStorage.setItem('intervalMinutes', state.intervalMinutes);
  localStorage.setItem('startWindowEnabled', JSON.stringify(state.startWindowEnabled));
  localStorage.setItem('windowStart', state.windowStart);
  localStorage.setItem('windowEnd', state.windowEnd);
  localStorage.setItem('lastResetISO', state.lastResetISO);
}

// ---- Helper: returns current date as YYYY-MM-DD ----
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
