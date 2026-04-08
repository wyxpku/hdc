/**
 * Tests for Hilog module
 */

import { describe, it, expect, vi } from 'vitest';
import { HdcHilog, HilogState, HilogLevel, HILOG_PREFIX, HILOG_STOP } from './hilog.js';

// Mock socket factory
function createMockSocket() {
  const handlers: Map<string, Function[]> = new Map();

  return {
    write: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      if (!handlers.has(event)) {
        handlers.set(event, []);
      }
      handlers.get(event)?.push(handler);
    }),
    off: vi.fn((event: string, handler: Function) => {
      const eventHandlers = handlers.get(event);
      if (eventHandlers) {
        const index = eventHandlers.indexOf(handler);
        if (index > -1) {
          eventHandlers.splice(index, 1);
        }
      }
    }),
    emit: vi.fn((event: string, ...args: any[]) => {
      const eventHandlers = handlers.get(event);
      if (eventHandlers) {
        eventHandlers.forEach(h => h(...args));
      }
    }),
    _handlers: handlers,
  } as any;
}

describe('HdcHilog', () => {
  describe('constructor', () => {
    it('should create hilog instance', () => {
      const mockSocket = createMockSocket();
      const hilog = new HdcHilog(mockSocket);

      expect(hilog.getSessionId()).toBeDefined();
      expect(hilog.getSessionId().length).toBe(8);
      expect(hilog.getState()).toBe(HilogState.IDLE);
      expect(hilog.getLinesReceived()).toBe(0);
    });

    it('should accept options', () => {
      const mockSocket = createMockSocket();
      const hilog = new HdcHilog(mockSocket, {
        level: HilogLevel.ERROR,
        tags: ['TAG1', 'TAG2'],
        pid: 1234,
      });

      expect(hilog['options'].level).toBe(HilogLevel.ERROR);
      expect(hilog['options'].tags).toEqual(['TAG1', 'TAG2']);
      expect(hilog['options'].pid).toBe(1234);
    });
  });

  describe('getSessionId', () => {
    it('should return session ID', () => {
      const mockSocket = createMockSocket();
      const hilog = new HdcHilog(mockSocket);

      const sessionId = hilog.getSessionId();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBe(8);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const mockSocket = createMockSocket();
      const hilog = new HdcHilog(mockSocket);

      expect(hilog.getState()).toBe(HilogState.IDLE);
    });
  });

  describe('getLinesReceived', () => {
    it('should return 0 initially', () => {
      const mockSocket = createMockSocket();
      const hilog = new HdcHilog(mockSocket);

      expect(hilog.getLinesReceived()).toBe(0);
    });
  });

  describe('start', () => {
    it('should start streaming', async () => {
      const mockSocket = createMockSocket();
      const hilog = new HdcHilog(mockSocket);

      await hilog.start();

      expect(hilog.getState()).toBe(HilogState.STREAMING);
      expect(mockSocket.write).toHaveBeenCalled();

      await hilog.stop();
    });

    it('should emit start event', async () => {
      const mockSocket = createMockSocket();
      const hilog = new HdcHilog(mockSocket);

      let started = false;
      hilog.on('start', () => {
        started = true;
      });

      await hilog.start();
      expect(started).toBe(true);

      await hilog.stop();
    });

    it('should throw error if already started', async () => {
      const mockSocket = createMockSocket();
      const hilog = new HdcHilog(mockSocket);

      await hilog.start();

      await expect(hilog.start()).rejects.toThrow('already started');

      await hilog.stop();
    });
  });

  describe('stop', () => {
    it('should stop streaming', async () => {
      const mockSocket = createMockSocket();
      const hilog = new HdcHilog(mockSocket);

      await hilog.start();
      await hilog.stop();

      expect(hilog.getState()).toBe(HilogState.CLOSED);
    });

    it('should be idempotent', async () => {
      const mockSocket = createMockSocket();
      const hilog = new HdcHilog(mockSocket);

      await hilog.start();
      await hilog.stop();
      await hilog.stop();
      await hilog.stop();

      expect(hilog.getState()).toBe(HilogState.CLOSED);
    });

    it('should emit stop event', async () => {
      const mockSocket = createMockSocket();
      const hilog = new HdcHilog(mockSocket);

      let stopped = false;
      hilog.on('stop', () => {
        stopped = true;
      });

      await hilog.start();
      await hilog.stop();

      expect(stopped).toBe(true);
    });
  });

  describe('clear', () => {
    it('should send clear command', async () => {
      const mockSocket = createMockSocket();
      const hilog = new HdcHilog(mockSocket);

      await hilog.clear();

      expect(mockSocket.write).toHaveBeenCalled();
    });

    it('should emit clear event', async () => {
      const mockSocket = createMockSocket();
      const hilog = new HdcHilog(mockSocket);

      let cleared = false;
      hilog.on('clear', () => {
        cleared = true;
      });

      await hilog.clear();

      expect(cleared).toBe(true);
    });
  });
});

describe('HilogState enum', () => {
  it('should have correct values', () => {
    expect(HilogState.IDLE).toBe('idle');
    expect(HilogState.STARTING).toBe('starting');
    expect(HilogState.STREAMING).toBe('streaming');
    expect(HilogState.STOPPING).toBe('stopping');
    expect(HilogState.CLOSED).toBe('closed');
    expect(HilogState.ERROR).toBe('error');
  });
});

describe('HilogLevel enum', () => {
  it('should have correct values', () => {
    expect(HilogLevel.DEBUG).toBe('D');
    expect(HilogLevel.INFO).toBe('I');
    expect(HilogLevel.WARN).toBe('W');
    expect(HilogLevel.ERROR).toBe('E');
    expect(HilogLevel.FATAL).toBe('F');
  });
});

describe('Constants', () => {
  it('should have correct prefix values', () => {
    expect(HILOG_PREFIX).toBe('hilog:');
    expect(HILOG_STOP).toBe('hilog:stop');
  });
});
