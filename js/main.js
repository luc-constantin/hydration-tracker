// ---- Persistent state ----
const state = {
  dailyGoal: parseInt(localStorage.getItem('dailyGoal')) || 0,
  totalConsumed: parseInt(localStorage.getItem('totalConsumed')) || 0,
  intervalHours: parseInt(localStorage.getItem('intervalHours')) || 0,
  startWindowEnabled: JSON.parse(localStorage.getItem('startWindowEnabled') || 'false'),
  windowStart: localStorage.getItem('windowStart') || '08:00',
  windowEnd: localStorage.getItem('windowEnd') || '20:00',
  lastResetISO: localStorage.getItem('lastResetISO') || null,
  scheduledTimeouts: []
};

// ---- Service worker ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}

window.addEventListener('DOMContentLoaded', () => {
  maybeResetForNewDay();

  // Wire UI
  document.getElementById('open-settings').addEventListener('click', openSettings);
  document.getElementById('close-settings').addEventListener('click', closeSettings);
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('reset-now').addEventListener('click', resetToday);
  document.getElementById('notify-btn').addEventListener('click', enableReminders);

  // Init inputs
  document.getElementById('daily-goal').value = state.dailyGoal || '';
  document.getElementById('interval').value = state.intervalHours || '';
  document.getElementById('start-window-enabled').checked = !!state.startWindowEnabled;
  document.getElementById('window-start').value = state.windowStart;
  document.getElementById('window-end').value = state.windowEnd;

  updateProgress();
  renderSummary();
  scheduleAutoResetTimer();
  rescheduleNotificationsPreviewOnly();
});

// ---- Core hydration logic ----
function logWater(amount) {
  state.totalConsumed += amount;
  persist();
  updateProgress();

  // Trigger Apple Shortcut to log into HealthKit
  const shortcutName = 'LogWater';
  const url = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}&input=${amount}`;
  window.location.href = url;
}

function updateProgress() {
  const progress =
    state.dailyGoal > 0
      ? Math.min((state.totalConsumed / state.dailyGoal) * 100, 100)
      : 0;
  document.getElementById('progress-bar').style.width = `${progress}%`;
  document.getElementById('consumed').innerText = `${state.totalConsumed} ml / ${state.dailyGoal} ml`;
  document.getElementById('goal-label').innerText = `${state.dailyGoal} ml`;
}

// ---- Settings modal ----
function openSettings() {
  document.getElementById('settings-modal').classList.remove('hidden');
  document.getElementById('settings-modal').setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
  document.getElementById('settings-modal').setAttribute('aria-hidden', 'true');
}

function saveSettings() {
  const goal = parseInt(document.getElementById('daily-goal').value);
  const interval = parseInt(document.getElementById('interval').value);
  const startEnabled = document.getElementById('start-window-enabled').checked;
  const start = document.getElementById('window-start').value || '08:00';
  const end = document.getElementById('window-end').value || '20:00';

  if (!isNaN(goal) && goal > 0) state.dailyGoal = goal;
  if (!isNaN(interval) && interval > 0) state.intervalHours = interval;
  state.startWindowEnabled = startEnabled;
  state.windowStart = start;
  state.windowEnd = end;

  persist();
  updateProgress();
  renderSummary();
  rescheduleNotificationsPreviewOnly();
  closeSettings();
}

// ---- Reset logic ----
function resetToday() {
  state.totalConsumed = 0;
  state.lastResetISO = todayISO();
  persist();
  updateProgress();
  renderSummary();
  toast('Progress reset for today.');
}

function maybeResetForNewDay() {
  const today = todayISO();
  if (state.lastResetISO !== today) {
    state.totalConsumed = 0;
    state.lastResetISO = today;
    persist();
  }
}

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

// ---- Notifications ----
function enableReminders() {
  Notification.requestPermission().then(permission => {
    if (permission !== 'granted') {
      alert('Please allow notifications to get reminders!');
      return;
    }
    scheduleTodayNotifications();
  });
}

function scheduleTodayNotifications() {
  state.scheduledTimeouts.forEach(id => clearTimeout(id));
  state.scheduledTimeouts = [];

  if (!state.intervalHours || state.intervalHours <= 0) {
    toast('Set a reminder interval in Settings first.');
    return;
  }

  const now = new Date();
  const startEnd = getWindowBoundsForToday();
  let next = new Date(now);

  if (state.startWindowEnabled && next < startEnd.start) next = new Date(startEnd.start);

  let i = 0;
  while (true) {
    if (i > 0) next = new Date(next.getTime() + state.intervalHours * 60 * 60 * 1000);
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

function rescheduleNotificationsPreviewOnly() {
  const now = new Date();
  const startEnd = getWindowBoundsForToday();
  let next = new Date(now);
  if (state.startWindowEnabled && next < startEnd.start) next = new Date(startEnd.start);
  if (state.intervalHours > 0) {
    next = new Date(next.getTime() + state.intervalHours * 60 * 60 * 1000);
  } else {
    next = null;
  }
  renderSummary(next);
}

function getWindowBoundsForToday() {
  const [sh, sm] = (state.windowStart || '08:00').split(':').map(n => parseInt(n, 10));
  const [eh, em] = (state.windowEnd || '20:00').split(':').map(n => parseInt(n, 10));
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em, 0, 0);
  return { start, end };
}

// ---- UI helpers ----
function renderSummary(nextTime = null) {
  const label = document.getElementById('next-reminder');
  if (state.intervalHours > 0) {
    const now = new Date();
    if (!nextTime) {
      const startEnd = getWindowBoundsForToday();
      let next = new Date(now.getTime() + state.intervalHours * 60 * 60 * 1000);
      if (state.startWindowEnabled && next < startEnd.start) next = startEnd.start;
      nextTime = next;
    }
    label.textContent = formatTime(nextTime);
  } else {
    label.textContent = '—';
  }
}

function toast(msg) {
  console.log(msg);
}

function formatTime(d) {
  if (!(d instanceof Date)) return '—';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function persist() {
  localStorage.setItem('dailyGoal', state.dailyGoal);
  localStorage.setItem('totalConsumed', state.totalConsumed);
  localStorage.setItem('intervalHours', state.intervalHours);
  localStorage.setItem('startWindowEnabled', JSON.stringify(state.startWindowEnabled));
  localStorage.setItem('windowStart', state.windowStart);
  localStorage.setItem('windowEnd', state.windowEnd);
  localStorage.setItem('lastResetISO', state.lastResetISO);
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
