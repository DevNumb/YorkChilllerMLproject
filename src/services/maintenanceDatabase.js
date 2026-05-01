const DB_NAME = 'chiller-maintenance-db';
const DB_VERSION = 1;
const TASKS_STORE = 'tasks';
const HISTORY_STORE = 'history';
const YEARLY_STATS_STORE = 'yearlyStats';

const DEFAULT_TASKS = [
  { id: 'task-1', name: 'Clean condenser coils', category: 'cleaning', frequencyDays: 30, lastCompleted: null, nextDue: null, status: 'pending', assignedTo: '', notes: '', priority: 'high', estimatedMinutes: 60 },
  { id: 'task-2', name: 'Check refrigerant levels', category: 'refrigerant', frequencyDays: 90, lastCompleted: null, nextDue: null, status: 'pending', assignedTo: '', notes: '', priority: 'high', estimatedMinutes: 45 },
  { id: 'task-3', name: 'Inspect and replace filters', category: 'filters', frequencyDays: 45, lastCompleted: null, nextDue: null, status: 'pending', assignedTo: '', notes: '', priority: 'medium', estimatedMinutes: 30 },
  { id: 'task-4', name: 'Calibrate sensors', category: 'calibration', frequencyDays: 180, lastCompleted: null, nextDue: null, status: 'pending', assignedTo: '', notes: '', priority: 'medium', estimatedMinutes: 90 },
  { id: 'task-5', name: 'Inspect electrical connections', category: 'inspection', frequencyDays: 60, lastCompleted: null, nextDue: null, status: 'pending', assignedTo: '', notes: '', priority: 'high', estimatedMinutes: 45 },
  { id: 'task-6', name: 'Lubricate moving parts', category: 'cleaning', frequencyDays: 90, lastCompleted: null, nextDue: null, status: 'pending', assignedTo: '', notes: '', priority: 'medium', estimatedMinutes: 30 },
  { id: 'task-7', name: 'Test safety controls', category: 'inspection', frequencyDays: 30, lastCompleted: null, nextDue: null, status: 'pending', assignedTo: '', notes: '', priority: 'high', estimatedMinutes: 60 },
  { id: 'task-8', name: 'Check belt tension', category: 'inspection', frequencyDays: 60, lastCompleted: null, nextDue: null, status: 'pending', assignedTo: '', notes: '', priority: 'medium', estimatedMinutes: 20 },
];

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(TASKS_STORE)) {
        const taskStore = database.createObjectStore(TASKS_STORE, { keyPath: 'id' });
        taskStore.createIndex('category', 'category', { unique: false });
        taskStore.createIndex('status', 'status', { unique: false });
        taskStore.createIndex('priority', 'priority', { unique: false });
      }

      if (!database.objectStoreNames.contains(HISTORY_STORE)) {
        const historyStore = database.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
        historyStore.createIndex('taskId', 'taskId', { unique: false });
        historyStore.createIndex('completedDate', 'completedDate', { unique: false });
      }

      if (!database.objectStoreNames.contains(YEARLY_STATS_STORE)) {
        const statsStore = database.createObjectStore(YEARLY_STATS_STORE, { keyPath: 'id' });
        statsStore.createIndex('year', 'year', { unique: false });
        statsStore.createIndex('taskId', 'taskId', { unique: false });
      }
    };

    request.onsuccess = async () => {
      const database = request.result;
      const taskCount = await countRecords(database, TASKS_STORE);
      if (taskCount === 0) {
        await seedDefaultTasks(database);
      }
      resolve(database);
    };

    request.onerror = () => reject(request.error || new Error('Failed to open maintenance database.'));
  });
}

function countRecords(database, storeName) {
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

function seedDefaultTasks(database) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(TASKS_STORE, 'readwrite');
    const store = tx.objectStore(TASKS_STORE);
    const now = new Date();

    DEFAULT_TASKS.forEach((task) => {
      const nextDue = new Date(now.getTime() + task.frequencyDays * 24 * 60 * 60 * 1000);
      const seeded = {
        ...task,
        nextDue: nextDue.toISOString(),
        status: 'pending',
      };
      store.put(seeded);
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function wrapRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });
}

export async function getAllTasks() {
  const database = await openDatabase();
  const tx = database.transaction(TASKS_STORE, 'readonly');
  const store = tx.objectStore(TASKS_STORE);
  const rows = await wrapRequest(store.getAll());
  database.close();
  return Array.isArray(rows) ? rows : [];
}

export async function getTaskById(id) {
  const database = await openDatabase();
  const tx = database.transaction(TASKS_STORE, 'readonly');
  const store = tx.objectStore(TASKS_STORE);
  const task = await wrapRequest(store.get(id));
  database.close();
  return task || null;
}

export async function completeTask(taskId, completionData) {
  const database = await openDatabase();

  const tx1 = database.transaction(TASKS_STORE, 'readonly');
  const taskStore = tx1.objectStore(TASKS_STORE);
  const task = await wrapRequest(taskStore.get(taskId));

  if (!task) {
    database.close();
    throw new Error(`Task ${taskId} not found.`);
  }

  const now = new Date();
  const completedDate = completionData.completedDate || now.toISOString();

  const nextDueDate = new Date(new Date(completedDate).getTime() + task.frequencyDays * 24 * 60 * 60 * 1000);

  const updatedTask = {
    ...task,
    lastCompleted: completedDate,
    nextDue: nextDueDate.toISOString(),
    status: 'completed',
  };

  const historyEntry = {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    taskId: task.id,
    completedDate,
    completedBy: completionData.completedBy || '',
    durationMinutes: completionData.durationMinutes || 0,
    notes: completionData.notes || '',
    partsReplaced: completionData.partsReplaced || '',
    cost: completionData.cost || 0,
    attachments: completionData.attachments || [],
  };

  const completedDateObj = new Date(completedDate);
  const year = completedDateObj.getFullYear();
  const month = completedDateObj.getMonth() + 1;
  const statsId = `stats-${year}-${month}-${task.id}`;

  const tx2 = database.transaction(TASKS_STORE, 'readwrite');
  const tStore = tx2.objectStore(TASKS_STORE);
  await wrapRequest(tStore.put(updatedTask));

  const tx3 = database.transaction(HISTORY_STORE, 'readwrite');
  const hStore = tx3.objectStore(HISTORY_STORE);
  await wrapRequest(hStore.put(historyEntry));

  let existingStats = null;
  try {
    const tx4 = database.transaction(YEARLY_STATS_STORE, 'readwrite');
    const sStore = tx4.objectStore(YEARLY_STATS_STORE);
    existingStats = await wrapRequest(sStore.get(statsId));

    const updatedStats = {
      id: statsId,
      year,
      month,
      taskId: task.id,
      completedCount: (existingStats?.completedCount || 0) + 1,
      totalDurationMinutes: (existingStats?.totalDurationMinutes || 0) + (completionData.durationMinutes || 0),
      averageCompletionDays: 0,
    };

    if (task.lastCompleted) {
      const daysSinceLast = Math.round(
        (new Date(completedDate).getTime() - new Date(task.lastCompleted).getTime()) / (24 * 60 * 60 * 1000)
      );
      const prevCount = existingStats?.completedCount || 0;
      const prevAvg = existingStats?.averageCompletionDays || 0;
      updatedStats.averageCompletionDays = prevCount > 0
        ? Math.round((prevAvg * prevCount + daysSinceLast) / (prevCount + 1))
        : daysSinceLast;
    }

    await wrapRequest(sStore.put(updatedStats));
  } catch {
    const tx5 = database.transaction(YEARLY_STATS_STORE, 'readwrite');
    const sStore = tx5.objectStore(YEARLY_STATS_STORE);
    await wrapRequest(sStore.put({
      id: statsId,
      year,
      month,
      taskId: task.id,
      completedCount: 1,
      totalDurationMinutes: completionData.durationMinutes || 0,
      averageCompletionDays: 0,
    }));
  }

  database.close();
  return { updatedTask, historyEntry };
}

export async function getHistory(taskId, limit = 10) {
  const database = await openDatabase();
  const tx = database.transaction(HISTORY_STORE, 'readonly');
  const store = tx.objectStore(HISTORY_STORE);
  const allHistory = await wrapRequest(store.getAll());
  database.close();

  let filtered = Array.isArray(allHistory) ? allHistory : [];
  if (taskId) {
    filtered = filtered.filter((h) => h.taskId === taskId);
  }
  filtered.sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
  return limit ? filtered.slice(0, limit) : filtered;
}

export async function getYearlyStats(year) {
  const database = await openDatabase();
  const tx = database.transaction(YEARLY_STATS_STORE, 'readonly');
  const store = tx.objectStore(YEARLY_STATS_STORE);
  const allStats = await wrapRequest(store.getAll());
  database.close();

  const rows = Array.isArray(allStats) ? allStats : [];
  if (year) {
    return rows.filter((s) => s.year === year);
  }
  return rows;
}

export async function addNewTask(task) {
  const database = await openDatabase();
  const now = new Date();
  const newTask = {
    id: task.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: task.name || 'Unnamed task',
    category: task.category || 'inspection',
    frequencyDays: task.frequencyDays || 30,
    lastCompleted: null,
    nextDue: new Date(now.getTime() + (task.frequencyDays || 30) * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    assignedTo: task.assignedTo || '',
    notes: task.notes || '',
    priority: task.priority || 'medium',
    estimatedMinutes: task.estimatedMinutes || 30,
  };

  const tx = database.transaction(TASKS_STORE, 'readwrite');
  const store = tx.objectStore(TASKS_STORE);
  await wrapRequest(store.put(newTask));
  database.close();
  return newTask;
}

export async function updateTask(task) {
  const database = await openDatabase();
  const tx = database.transaction(TASKS_STORE, 'readwrite');
  const store = tx.objectStore(TASKS_STORE);
  await wrapRequest(store.put(task));
  database.close();
  return task;
}

export async function refreshTaskStatuses() {
  const tasks = await getAllTasks();
  const now = new Date();
  const updated = [];

  for (const task of tasks) {
    if (task.status === 'completed' && task.nextDue) {
      const dueDate = new Date(task.nextDue);
      if (dueDate <= now) {
        task.status = 'overdue';
        await updateTask(task);
      } else if (dueDate.getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000) {
        task.status = 'pending';
        await updateTask(task);
      }
    } else if (task.status === 'pending' && task.nextDue) {
      const dueDate = new Date(task.nextDue);
      if (dueDate <= now) {
        task.status = 'overdue';
        await updateTask(task);
      }
    }
    updated.push(task);
  }

  return updated;
}
