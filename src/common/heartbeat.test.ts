/**
 * Tests for Heartbeat module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HdcHeartbeat,
  HeartbeatState,
  createHeartbeatPayload,
  parseHeartbeatPayload,
  HEARTBEAT_INTERVAL,
  HEARTBEAT_TIMEOUT,
  MAX_MISSED_HEARTBEATS,
} from './heartbeat.js';

describe('HdcHeartbeat', () => {
  describe('constructor', () => {
    it('should create heartbeat instance', () => {
      const heartbeat = new HdcHeartbeat();

      expect(heartbeat.getState()).toBe(HeartbeatState.STOPPED);
    });

    it('should accept custom options', () => {
      const heartbeat = new HdcHeartbeat({
        interval: 5000,
        timeout: 15000,
        maxMissed: 5,
      });

      expect(heartbeat['interval']).toBe(5000);
      expect(heartbeat['timeout']).toBe(15000);
      expect(heartbeat['maxMissed']).toBe(5);
    });

    it('should use default options', () => {
      const heartbeat = new HdcHeartbeat();

      expect(heartbeat['interval']).toBe(HEARTBEAT_INTERVAL);
      expect(heartbeat['timeout']).toBe(HEARTBEAT_TIMEOUT);
      expect(heartbeat['maxMissed']).toBe(MAX_MISSED_HEARTBEATS);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const heartbeat = new HdcHeartbeat();
      expect(heartbeat.getState()).toBe(HeartbeatState.STOPPED);
    });
  });

  describe('setSendCallback', () => {
    it('should set send callback', () => {
      const heartbeat = new HdcHeartbeat();
      const callback = vi.fn();

      heartbeat.setSendCallback(callback);

      expect(heartbeat['sendCallback']).toBe(callback);
    });
  });

  describe('start', () => {
    it('should start heartbeat', () => {
      const heartbeat = new HdcHeartbeat({ interval: 100 });
      heartbeat.start();

      expect(heartbeat.getState()).toBe(HeartbeatState.RUNNING);

      heartbeat.stop();
    });

    it('should emit start event', () => {
      const heartbeat = new HdcHeartbeat({ interval: 100 });
      const handler = vi.fn();
      heartbeat.on('start', handler);

      heartbeat.start();

      expect(handler).toHaveBeenCalled();

      heartbeat.stop();
    });

    it('should be idempotent', () => {
      const heartbeat = new HdcHeartbeat({ interval: 100 });
      heartbeat.start();
      heartbeat.start();
      heartbeat.start();

      expect(heartbeat.getState()).toBe(HeartbeatState.RUNNING);

      heartbeat.stop();
    });
  });

  describe('stop', () => {
    it('should stop heartbeat', () => {
      const heartbeat = new HdcHeartbeat({ interval: 100 });
      heartbeat.start();
      heartbeat.stop();

      expect(heartbeat.getState()).toBe(HeartbeatState.STOPPED);
    });

    it('should emit stop event', () => {
      const heartbeat = new HdcHeartbeat({ interval: 100 });
      const handler = vi.fn();
      heartbeat.on('stop', handler);

      heartbeat.start();
      heartbeat.stop();

      expect(handler).toHaveBeenCalled();
    });

    it('should be idempotent', () => {
      const heartbeat = new HdcHeartbeat();
      heartbeat.stop();
      heartbeat.stop();
      heartbeat.stop();

      expect(heartbeat.getState()).toBe(HeartbeatState.STOPPED);
    });
  });

  describe('onReceive', () => {
    it('should handle received heartbeat', () => {
      const heartbeat = new HdcHeartbeat({ interval: 100 });
      heartbeat.start();

      heartbeat.onReceive();

      expect(heartbeat['received']).toBe(1);
      expect(heartbeat['missed']).toBe(0);

      heartbeat.stop();
    });

    it('should emit receive event', () => {
      const heartbeat = new HdcHeartbeat({ interval: 100 });
      const handler = vi.fn();
      heartbeat.on('receive', handler);
      heartbeat.start();

      heartbeat.onReceive();

      expect(handler).toHaveBeenCalled();

      heartbeat.stop();
    });

    it('should reset missed count', () => {
      const heartbeat = new HdcHeartbeat({ interval: 100 });
      heartbeat.start();
      heartbeat['missed'] = 2;

      heartbeat.onReceive();

      expect(heartbeat['missed']).toBe(0);

      heartbeat.stop();
    });

    it('should recover from timeout', () => {
      const heartbeat = new HdcHeartbeat({ interval: 100 });
      heartbeat.start();
      heartbeat['state'] = HeartbeatState.TIMEOUT;

      heartbeat.onReceive();

      expect(heartbeat.getState()).toBe(HeartbeatState.RUNNING);

      heartbeat.stop();
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const heartbeat = new HdcHeartbeat();
      const stats = heartbeat.getStats();

      expect(stats.sent).toBe(0);
      expect(stats.received).toBe(0);
      expect(stats.missed).toBe(0);
      expect(stats.lastSent).toBe(0);
      expect(stats.lastReceived).toBe(0);
      expect(stats.latency).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset statistics', () => {
      const heartbeat = new HdcHeartbeat();
      heartbeat['sent'] = 10;
      heartbeat['received'] = 8;
      heartbeat['missed'] = 2;

      heartbeat.reset();

      expect(heartbeat['sent']).toBe(0);
      expect(heartbeat['received']).toBe(0);
      expect(heartbeat['missed']).toBe(0);
    });
  });

  describe('isHealthy', () => {
    it('should return true when running and no missed heartbeats', () => {
      const heartbeat = new HdcHeartbeat({ interval: 100 });
      heartbeat.start();

      expect(heartbeat.isHealthy()).toBe(true);

      heartbeat.stop();
    });

    it('should return false when stopped', () => {
      const heartbeat = new HdcHeartbeat();

      expect(heartbeat.isHealthy()).toBe(false);
    });

    it('should return false when too many missed heartbeats', () => {
      const heartbeat = new HdcHeartbeat({ interval: 100, maxMissed: 3 });
      heartbeat.start();
      heartbeat['missed'] = 3;

      expect(heartbeat.isHealthy()).toBe(false);

      heartbeat.stop();
    });
  });

  describe('getLatency', () => {
    it('should return latency', () => {
      const heartbeat = new HdcHeartbeat();
      heartbeat['latency'] = 50;

      expect(heartbeat.getLatency()).toBe(50);
    });
  });
});

describe('Helper functions', () => {
  describe('createHeartbeatPayload', () => {
    it('should create 8-byte buffer', () => {
      const payload = createHeartbeatPayload();

      expect(payload.length).toBe(8);
    });

    it('should contain timestamp', () => {
      const before = Date.now();
      const payload = createHeartbeatPayload();
      const after = Date.now();

      const timestamp = Number(payload.readBigUInt64BE(0));

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('parseHeartbeatPayload', () => {
    it('should parse timestamp', () => {
      const timestamp = BigInt(1234567890);
      const buffer = Buffer.alloc(8);
      buffer.writeBigUInt64BE(timestamp, 0);

      const parsed = parseHeartbeatPayload(buffer);

      expect(parsed).toBe(Number(timestamp));
    });

    it('should return 0 for short buffer', () => {
      const buffer = Buffer.alloc(4);

      const parsed = parseHeartbeatPayload(buffer);

      expect(parsed).toBe(0);
    });

    it('should be reversible', () => {
      const payload = createHeartbeatPayload();
      const parsed = parseHeartbeatPayload(payload);

      expect(parsed).toBeGreaterThan(0);
    });
  });
});

describe('HeartbeatState enum', () => {
  it('should have correct values', () => {
    expect(HeartbeatState.STOPPED).toBe('stopped');
    expect(HeartbeatState.RUNNING).toBe('running');
    expect(HeartbeatState.TIMEOUT).toBe('timeout');
  });
});

describe('Constants', () => {
  it('should have correct values', () => {
    expect(HEARTBEAT_INTERVAL).toBe(10000);
    expect(HEARTBEAT_TIMEOUT).toBe(30000);
    expect(MAX_MISSED_HEARTBEATS).toBe(3);
  });
});
