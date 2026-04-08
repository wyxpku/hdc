/**
 * Tests for Task module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HdcTask, HdcTaskManager, TaskState, TaskType } from './task.js';

describe('HdcTask', () => {
  describe('constructor', () => {
    it('should create task instance', () => {
      const task = new HdcTask({ type: TaskType.SHELL });

      expect(task.taskId).toBeGreaterThan(0);
      expect(task.type).toBe(TaskType.SHELL);
      expect(task.state).toBe(TaskState.IDLE);
      expect(task.progress).toBe(0);
    });

    it('should accept custom options', () => {
      const task = new HdcTask({
        type: TaskType.FILE,
        channelId: 123,
        sessionId: 456,
        timeout: 60000,
        data: { path: '/test' },
      });

      expect(task.type).toBe(TaskType.FILE);
      expect(task.channelId).toBe(123);
      expect(task.sessionId).toBe(456);
      expect(task['timeout']).toBe(60000);
      expect(task.data).toEqual({ path: '/test' });
    });
  });

  describe('getInfo', () => {
    it('should return task info', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      const info = task.getInfo();

      expect(info.taskId).toBe(task.taskId);
      expect(info.type).toBe(TaskType.SHELL);
      expect(info.state).toBe(TaskState.IDLE);
    });
  });

  describe('start', () => {
    it('should start task', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      task.start();

      expect(task.state).toBe(TaskState.RUNNING);
    });

    it('should emit start event', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      const handler = vi.fn();
      task.on('start', handler);

      task.start();

      expect(handler).toHaveBeenCalled();
    });

    it('should be idempotent', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      task.start();
      task.start();

      expect(task.state).toBe(TaskState.RUNNING);
    });
  });

  describe('pause/resume', () => {
    it('should pause task', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      task.start();
      task.pause();

      expect(task.state).toBe(TaskState.PAUSED);
    });

    it('should resume task', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      task.start();
      task.pause();
      task.resume();

      expect(task.state).toBe(TaskState.RUNNING);
    });
  });

  describe('complete', () => {
    it('should complete task', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      task.start();
      task.complete();

      expect(task.state).toBe(TaskState.COMPLETED);
      expect(task.progress).toBe(100);
    });

    it('should emit complete event', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      const handler = vi.fn();
      task.on('complete', handler);

      task.start();
      task.complete();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('fail', () => {
    it('should fail task', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      task.start();
      
      // Suppress error event to avoid test failure
      task.on('error', () => {});
      task.fail(new Error('Test error'));

      expect(task.state).toBe(TaskState.FAILED);
      expect(task.error).toBeDefined();
    });

    it('should emit error event', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      const handler = vi.fn();
      task.on('error', handler);

      task.start();
      task.fail(new Error('Test error'));

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should cancel task', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      task.start();
      task.cancel();

      expect(task.state).toBe(TaskState.CANCELLED);
    });

    it('should emit cancel event', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      const handler = vi.fn();
      task.on('cancel', handler);

      task.start();
      task.cancel();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('updateProgress', () => {
    it('should update progress', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      task.updateProgress(50);

      expect(task.progress).toBe(50);
    });

    it('should clamp progress to 0-100', () => {
      const task = new HdcTask({ type: TaskType.SHELL });

      task.updateProgress(-10);
      expect(task.progress).toBe(0);

      task.updateProgress(110);
      expect(task.progress).toBe(100);
    });

    it('should emit progress event', () => {
      const task = new HdcTask({ type: TaskType.SHELL });
      const handler = vi.fn();
      task.on('progress', handler);

      task.updateProgress(50);

      expect(handler).toHaveBeenCalledWith(50);
    });
  });

  describe('addRef/release', () => {
    it('should manage reference count', () => {
      const task = new HdcTask({ type: TaskType.SHELL });

      expect(task.addRef()).toBe(1);
      expect(task.addRef()).toBe(2);
      expect(task.release()).toBe(1);
    });
  });

  describe('isActive/isFinished', () => {
    it('should check active state', () => {
      const task = new HdcTask({ type: TaskType.SHELL });

      expect(task.isActive()).toBe(false);

      task.start();
      expect(task.isActive()).toBe(true);

      task.complete();
      expect(task.isActive()).toBe(false);
    });

    it('should check finished state', () => {
      const task = new HdcTask({ type: TaskType.SHELL });

      expect(task.isFinished()).toBe(false);

      task.start();
      expect(task.isFinished()).toBe(false);

      task.complete();
      expect(task.isFinished()).toBe(true);
    });
  });
});

describe('HdcTaskManager', () => {
  let manager: HdcTaskManager;

  beforeEach(() => {
    manager = new HdcTaskManager();
  });

  afterEach(() => {
    manager.cancelAll();
  });

  describe('constructor', () => {
    it('should create manager', () => {
      expect(manager.count).toBe(0);
    });

    it('should accept max tasks', () => {
      const customManager = new HdcTaskManager(10);
      expect(customManager['maxTasks']).toBe(10);
    });
  });

  describe('createTask', () => {
    it('should create task', () => {
      const task = manager.createTask({ type: TaskType.SHELL });

      expect(task).not.toBeNull();
      expect(manager.count).toBe(1);
    });

    it('should emit task-create event', () => {
      const handler = vi.fn();
      manager.on('task-create', handler);

      manager.createTask({ type: TaskType.SHELL });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getTask', () => {
    it('should get task by ID', () => {
      const task = manager.createTask({ type: TaskType.SHELL });
      const found = manager.getTask(task!.taskId);

      expect(found).toBe(task);
    });

    it('should return undefined for non-existent ID', () => {
      const found = manager.getTask(99999);
      expect(found).toBeUndefined();
    });
  });

  describe('getTaskByChannel', () => {
    it('should get task by channel ID', () => {
      const task = manager.createTask({ type: TaskType.SHELL, channelId: 123 });
      const found = manager.getTaskByChannel(123);

      expect(found).toBe(task);
    });
  });

  describe('removeTask', () => {
    it('should remove task', () => {
      const task = manager.createTask({ type: TaskType.SHELL });
      const result = manager.removeTask(task!.taskId);

      expect(result).toBe(true);
      expect(manager.count).toBe(0);
    });

    it('should return false for non-existent task', () => {
      const result = manager.removeTask(99999);
      expect(result).toBe(false);
    });
  });

  describe('listTasks', () => {
    it('should list all tasks', () => {
      manager.createTask({ type: TaskType.SHELL });
      manager.createTask({ type: TaskType.FILE });

      const tasks = manager.listTasks();

      expect(tasks.length).toBe(2);
    });
  });

  describe('listActiveTasks', () => {
    it('should list active tasks', () => {
      const task1 = manager.createTask({ type: TaskType.SHELL });
      const task2 = manager.createTask({ type: TaskType.FILE });

      task1!.start();

      const active = manager.listActiveTasks();

      expect(active.length).toBe(1);
      expect(active).toContain(task1);
    });
  });

  describe('listTasksByType', () => {
    it('should list tasks by type', () => {
      manager.createTask({ type: TaskType.SHELL });
      manager.createTask({ type: TaskType.SHELL });
      manager.createTask({ type: TaskType.FILE });

      const shellTasks = manager.listTasksByType(TaskType.SHELL);

      expect(shellTasks.length).toBe(2);
    });
  });

  describe('activeCount', () => {
    it('should count active tasks', () => {
      const task1 = manager.createTask({ type: TaskType.SHELL });
      const task2 = manager.createTask({ type: TaskType.FILE });

      task1!.start();

      expect(manager.activeCount).toBe(1);
    });
  });

  describe('cancelAll', () => {
    it('should cancel all tasks', () => {
      const task1 = manager.createTask({ type: TaskType.SHELL });
      const task2 = manager.createTask({ type: TaskType.FILE });

      task1!.start();
      task2!.start();

      manager.cancelAll();

      expect(task1!.state).toBe(TaskState.CANCELLED);
      expect(task2!.state).toBe(TaskState.CANCELLED);
    });
  });

  describe('cleanupFinished', () => {
    it('should remove finished tasks', () => {
      const task1 = manager.createTask({ type: TaskType.SHELL });
      const task2 = manager.createTask({ type: TaskType.FILE });

      task1!.start();
      task1!.complete();
      task2!.start();

      const removed = manager.cleanupFinished();

      expect(removed).toBe(1);
      expect(manager.count).toBe(1);
    });
  });
});

describe('TaskState enum', () => {
  it('should have correct values', () => {
    expect(TaskState.IDLE).toBe('idle');
    expect(TaskState.RUNNING).toBe('running');
    expect(TaskState.PAUSED).toBe('paused');
    expect(TaskState.COMPLETED).toBe('completed');
    expect(TaskState.FAILED).toBe('failed');
    expect(TaskState.CANCELLED).toBe('cancelled');
  });
});

describe('TaskType enum', () => {
  it('should have correct values', () => {
    expect(TaskType.UNITY).toBe(0);
    expect(TaskType.SHELL).toBe(1);
    expect(TaskType.FILE).toBe(2);
    expect(TaskType.FORWARD).toBe(3);
    expect(TaskType.APP).toBe(4);
    expect(TaskType.FLASHD).toBe(5);
    expect(TaskType.JDWP).toBe(6);
  });
});
