/**
 * HDC Task Module
 *
 * Task management for async operations.
 * Ported from: hdc-source/src/common/task.cpp
 */

import { EventEmitter } from 'events';
import { GetRandomU32 } from './base.js';

// ============================================================================
// Constants
// ============================================================================

export const MAX_TASK_COUNT = 1024;
export const TASK_TIMEOUT = 30000; // 30 seconds

export enum TaskState {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TaskType {
  UNITY = 0,
  SHELL = 1,
  FILE = 2,
  FORWARD = 3,
  APP = 4,
  FLASHD = 5,
  JDWP = 6,
}

// ============================================================================
// Types
// ============================================================================

export interface TaskOptions {
  type: TaskType;
  channelId?: number;
  sessionId?: number;
  timeout?: number;
  data?: any;
}

export interface TaskInfo {
  taskId: number;
  type: TaskType;
  state: TaskState;
  channelId: number;
  sessionId: number;
  createTime: number;
  startTime: number;
  endTime: number;
  progress: number;
  error?: Error;
  data?: any;
}

// ============================================================================
// HdcTask - Single Task
// ============================================================================

export class HdcTask extends EventEmitter {
  public taskId: number;
  public type: TaskType;
  public state: TaskState = TaskState.IDLE;
  public channelId: number;
  public sessionId: number;
  public createTime: number;
  public startTime: number = 0;
  public endTime: number = 0;
  public progress: number = 0;
  public error?: Error;
  public data?: any;

  private timeout: number;
  private timeoutTimer: NodeJS.Timeout | null = null;
  private refCount: number = 0;

  constructor(options: TaskOptions) {
    super();
    this.taskId = GetRandomU32();
    this.type = options.type;
    this.channelId = options.channelId || 0;
    this.sessionId = options.sessionId || 0;
    this.timeout = options.timeout || TASK_TIMEOUT;
    this.createTime = Date.now();
    this.data = options.data;
  }

  /**
   * Get task info
   */
  getInfo(): TaskInfo {
    return {
      taskId: this.taskId,
      type: this.type,
      state: this.state,
      channelId: this.channelId,
      sessionId: this.sessionId,
      createTime: this.createTime,
      startTime: this.startTime,
      endTime: this.endTime,
      progress: this.progress,
      error: this.error,
      data: this.data,
    };
  }

  /**
   * Start task
   */
  start(): void {
    if (this.state === TaskState.RUNNING) {
      return;
    }

    this.state = TaskState.RUNNING;
    this.startTime = Date.now();
    this.emit('start');

    // Start timeout timer
    this.timeoutTimer = setTimeout(() => {
      if (this.state === TaskState.RUNNING) {
        this.fail(new Error('Task timeout'));
      }
    }, this.timeout);
  }

  /**
   * Pause task
   */
  pause(): void {
    if (this.state !== TaskState.RUNNING) {
      return;
    }

    this.state = TaskState.PAUSED;
    this.clearTimeout();
    this.emit('pause');
  }

  /**
   * Resume task
   */
  resume(): void {
    if (this.state !== TaskState.PAUSED) {
      return;
    }

    this.state = TaskState.RUNNING;
    this.emit('resume');
  }

  /**
   * Complete task
   */
  complete(): void {
    if (this.state === TaskState.COMPLETED) {
      return;
    }

    this.state = TaskState.COMPLETED;
    this.endTime = Date.now();
    this.progress = 100;
    this.clearTimeout();
    this.emit('complete');
  }

  /**
   * Fail task
   */
  fail(error: Error): void {
    if (this.state === TaskState.FAILED) {
      return;
    }

    this.state = TaskState.FAILED;
    this.endTime = Date.now();
    this.error = error;
    this.clearTimeout();
    this.emit('error', error);
  }

  /**
   * Cancel task
   */
  cancel(): void {
    if (this.state === TaskState.CANCELLED || this.state === TaskState.COMPLETED) {
      return;
    }

    this.state = TaskState.CANCELLED;
    this.endTime = Date.now();
    this.clearTimeout();
    this.emit('cancel');
  }

  /**
   * Update progress
   */
  updateProgress(progress: number): void {
    this.progress = Math.max(0, Math.min(100, progress));
    this.emit('progress', this.progress);
  }

  /**
   * Increment reference count
   */
  addRef(): number {
    return ++this.refCount;
  }

  /**
   * Decrement reference count
   */
  release(): number {
    return --this.refCount;
  }

  /**
   * Check if task is active
   */
  isActive(): boolean {
    return this.state === TaskState.RUNNING || this.state === TaskState.PAUSED;
  }

  /**
   * Check if task is finished
   */
  isFinished(): boolean {
    return (
      this.state === TaskState.COMPLETED ||
      this.state === TaskState.FAILED ||
      this.state === TaskState.CANCELLED
    );
  }

  /**
   * Clear timeout timer
   */
  private clearTimeout(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
}

// ============================================================================
// HdcTaskManager - Manage all tasks
// ============================================================================

export class HdcTaskManager extends EventEmitter {
  private tasks: Map<number, HdcTask> = new Map();
  private maxTasks: number = MAX_TASK_COUNT;

  constructor(maxTasks?: number) {
    super();
    if (maxTasks) {
      this.maxTasks = maxTasks;
    }
  }

  /**
   * Create new task
   */
  createTask(options: TaskOptions): HdcTask | null {
    if (this.tasks.size >= this.maxTasks) {
      return null;
    }

    const task = new HdcTask(options);

    task.on('complete', () => {
      this.emit('task-complete', task);
    });

    task.on('error', (err: Error) => {
      this.emit('task-error', task, err);
    });

    task.on('cancel', () => {
      this.emit('task-cancel', task);
    });

    this.tasks.set(task.taskId, task);
    this.emit('task-create', task);

    return task;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: number): HdcTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get task by channel ID
   */
  getTaskByChannel(channelId: number): HdcTask | undefined {
    for (const task of this.tasks.values()) {
      if (task.channelId === channelId) {
        return task;
      }
    }
    return undefined;
  }

  /**
   * Remove task
   */
  removeTask(taskId: number): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.isActive()) {
      task.cancel();
    }

    this.tasks.delete(taskId);
    this.emit('task-remove', task);
    return true;
  }

  /**
   * List all tasks
   */
  listTasks(): HdcTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * List active tasks
   */
  listActiveTasks(): HdcTask[] {
    return Array.from(this.tasks.values()).filter(t => t.isActive());
  }

  /**
   * List tasks by type
   */
  listTasksByType(type: TaskType): HdcTask[] {
    return Array.from(this.tasks.values()).filter(t => t.type === type);
  }

  /**
   * Get task count
   */
  get count(): number {
    return this.tasks.size;
  }

  /**
   * Get active task count
   */
  get activeCount(): number {
    return this.listActiveTasks().length;
  }

  /**
   * Cancel all tasks
   */
  cancelAll(): void {
    for (const task of this.tasks.values()) {
      if (task.isActive()) {
        task.cancel();
      }
    }
  }

  /**
   * Remove finished tasks
   */
  cleanupFinished(): number {
    let removed = 0;
    for (const [id, task] of this.tasks) {
      if (task.isFinished()) {
        this.tasks.delete(id);
        removed++;
      }
    }
    return removed;
  }
}
