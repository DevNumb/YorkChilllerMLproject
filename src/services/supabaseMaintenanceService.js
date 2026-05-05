import { supabase } from './supabaseClient';

/**
 * Maps Supabase snake_case task to frontend camelCase
 */
function mapTaskFromDb(dbTask) {
  if (!dbTask) return null;
  return {
    id: dbTask.id,
    name: dbTask.name,
    category: dbTask.category,
    frequencyDays: dbTask.frequency_days,
    lastCompleted: dbTask.last_completed,
    nextDue: dbTask.next_due,
    status: dbTask.status,
    assignedTo: dbTask.assigned_to,
    notes: dbTask.notes,
    priority: dbTask.priority,
    estimatedMinutes: dbTask.estimated_minutes,
    createdAt: dbTask.created_at,
    updatedAt: dbTask.updated_at
  };
}

/**
 * Maps frontend camelCase task to Supabase snake_case
 */
function mapTaskToDb(task) {
  if (!task) return null;
  return {
    id: task.id,
    name: task.name,
    category: task.category,
    frequency_days: task.frequencyDays,
    last_completed: task.lastCompleted,
    next_due: task.nextDue,
    status: task.status,
    assigned_to: task.assignedTo,
    notes: task.notes,
    priority: task.priority,
    estimated_minutes: task.estimatedMinutes
  };
}

/**
 * Maps Supabase snake_case history to frontend camelCase
 */
function mapHistoryFromDb(dbHist) {
  if (!dbHist) return null;
  return {
    id: dbHist.id,
    taskId: dbHist.task_id,
    completedDate: dbHist.completed_date,
    completedBy: dbHist.completed_by,
    durationMinutes: dbHist.duration_minutes,
    notes: dbHist.notes,
    partsReplaced: dbHist.parts_replaced,
    cost: dbHist.cost,
    attachments: dbHist.attachments,
    createdAt: dbHist.created_at
  };
}

export async function getAllTasks() {
  const { data, error } = await supabase
    .from('maintenance_tasks')
    .select('*')
    .order('next_due', { ascending: true });

  if (error) throw error;
  return data.map(mapTaskFromDb);
}

export async function getTaskById(id) {
  const { data, error } = await supabase
    .from('maintenance_tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return mapTaskFromDb(data);
}

export async function completeTask(taskId, completionData) {
  const task = await getTaskById(taskId);
  if (!task) throw new Error(`Task ${taskId} not found.`);

  const now = new Date();
  const completedDate = completionData.completedDate || now.toISOString();
  const nextDueDate = new Date(new Date(completedDate).getTime() + task.frequencyDays * 24 * 60 * 60 * 1000);

  // 1. Update Task
  const { data: updatedTaskData, error: taskError } = await supabase
    .from('maintenance_tasks')
    .update({
      last_completed: completedDate,
      next_due: nextDueDate.toISOString(),
      status: 'completed'
    })
    .eq('id', taskId)
    .select()
    .single();

  if (taskError) throw taskError;

  // 2. Add History Entry
  const historyEntry = {
    task_id: taskId,
    completed_date: completedDate,
    completed_by: completionData.completedBy || '',
    duration_minutes: completionData.durationMinutes || 0,
    notes: completionData.notes || '',
    parts_replaced: completionData.partsReplaced || '',
    cost: completionData.cost || 0,
    attachments: completionData.attachments || []
  };

  const { data: historyData, error: historyError } = await supabase
    .from('maintenance_history')
    .insert(historyEntry)
    .select()
    .single();

  if (historyError) throw historyError;

  // 3. Update Stats
  const completedDateObj = new Date(completedDate);
  const year = completedDateObj.getFullYear();
  const month = completedDateObj.getMonth() + 1;
  const statsId = `stats-${year}-${month}-${taskId}`;

  // Check if stats exist
  const { data: existingStats, error: statsFetchError } = await supabase
    .from('maintenance_stats')
    .select('*')
    .eq('id', statsId)
    .single();

  let updatedStats;
  if (existingStats) {
    let averageCompletionDays = existingStats.average_completion_days;
    if (task.lastCompleted) {
      const daysSinceLast = Math.round(
        (new Date(completedDate).getTime() - new Date(task.lastCompleted).getTime()) / (24 * 60 * 60 * 1000)
      );
      const prevCount = existingStats.completed_count;
      const prevAvg = existingStats.average_completion_days;
      averageCompletionDays = Math.round((prevAvg * prevCount + daysSinceLast) / (prevCount + 1));
    }

    const { data, error } = await supabase
      .from('maintenance_stats')
      .update({
        completed_count: existingStats.completed_count + 1,
        total_duration_minutes: existingStats.total_duration_minutes + (completionData.durationMinutes || 0),
        average_completion_days: averageCompletionDays,
        updated_at: now.toISOString()
      })
      .eq('id', statsId)
      .select()
      .single();
    
    if (error) throw error;
    updatedStats = data;
  } else {
    const { data, error } = await supabase
      .from('maintenance_stats')
      .insert({
        id: statsId,
        year,
        month,
        task_id: taskId,
        completed_count: 1,
        total_duration_minutes: completionData.durationMinutes || 0,
        average_completion_days: 0
      })
      .select()
      .single();
    
    if (error) throw error;
    updatedStats = data;
  }

  return { 
    updatedTask: mapTaskFromDb(updatedTaskData), 
    historyEntry: mapHistoryFromDb(historyData) 
  };
}

export async function getHistory(taskId, limit = 10) {
  let query = supabase
    .from('maintenance_history')
    .select('*')
    .order('completed_date', { ascending: false });

  if (taskId) {
    query = query.eq('task_id', taskId);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapHistoryFromDb);
}

export async function getYearlyStats(year) {
  let query = supabase.from('maintenance_stats').select('*');
  if (year) {
    query = query.eq('year', year);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  return data.map(s => ({
    id: s.id,
    year: s.year,
    month: s.month,
    taskId: s.task_id,
    completedCount: s.completed_count,
    totalDurationMinutes: s.total_duration_minutes,
    averageCompletionDays: s.average_completion_days
  }));
}

export async function addNewTask(task) {
  const now = new Date();
  const dbTask = {
    name: task.name || 'Unnamed task',
    category: task.category || 'inspection',
    frequency_days: task.frequencyDays || 30,
    last_completed: null,
    next_due: new Date(now.getTime() + (task.frequencyDays || 30) * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    assigned_to: task.assignedTo || '',
    notes: task.notes || '',
    priority: task.priority || 'medium',
    estimated_minutes: task.estimatedMinutes || 30
  };

  const { data, error } = await supabase
    .from('maintenance_tasks')
    .insert(dbTask)
    .select()
    .single();

  if (error) throw error;
  return mapTaskFromDb(data);
}

export async function updateTask(task) {
  const dbTask = mapTaskToDb(task);
  const { id, ...updateFields } = dbTask;

  const { data, error } = await supabase
    .from('maintenance_tasks')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapTaskFromDb(data);
}

export async function refreshTaskStatuses() {
  const tasks = await getAllTasks();
  const now = new Date();
  const updated = [];

  for (const task of tasks) {
    let newStatus = task.status;
    const dueDate = task.nextDue ? new Date(task.nextDue) : null;

    if (task.status === 'completed' && dueDate) {
      if (dueDate <= now) {
        newStatus = 'overdue';
      } else if (dueDate.getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000) {
        newStatus = 'pending';
      }
    } else if (task.status === 'pending' && dueDate) {
      if (dueDate <= now) {
        newStatus = 'overdue';
      }
    }

    if (newStatus !== task.status) {
      const { data, error } = await supabase
        .from('maintenance_tasks')
        .update({ status: newStatus })
        .eq('id', task.id)
        .select()
        .single();
      
      if (!error) {
        updated.push(mapTaskFromDb(data));
      } else {
        updated.push(task);
      }
    } else {
      updated.push(task);
    }
  }

  return updated;
}
