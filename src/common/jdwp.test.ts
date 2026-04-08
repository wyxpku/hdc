/**
 * Tests for JDWP module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HdcJDWP, JDWPState, JDWPCommandSet, JDWP_HANDSHAKE, JDWP_HEADER_SIZE, isJDWPAvailable } from './jdwp.js';

describe('HdcJDWP', () => {
  describe('constructor', () => {
    it('should create JDWP instance', () => {
      const jdwp = new HdcJDWP();

      expect(jdwp.getState()).toBe(JDWPState.IDLE);
    });

    it('should accept custom options', () => {
      const jdwp = new HdcJDWP({
        port: 5006,
        timeout: 20000,
      });

      expect(jdwp['options'].port).toBe(5006);
      expect(jdwp['options'].timeout).toBe(20000);
    });

    it('should use default options', () => {
      const jdwp = new HdcJDWP();

      expect(jdwp['options'].port).toBe(5005);
      expect(jdwp['options'].timeout).toBe(10000);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const jdwp = new HdcJDWP();
      expect(jdwp.getState()).toBe(JDWPState.IDLE);
    });
  });

  describe('connect', () => {
    it('should throw error when already connected', async () => {
      const jdwp = new HdcJDWP();
      jdwp['state'] = JDWPState.CONNECTED;

      await expect(jdwp.connect()).rejects.toThrow('already connected');
    });
  });

  describe('sendCommand', () => {
    it('should throw error when not connected', async () => {
      const jdwp = new HdcJDWP();

      await expect(
        jdwp.sendCommand(JDWPCommandSet.VIRTUAL_MACHINE, 1)
      ).rejects.toThrow('not connected');
    });
  });

  describe('sendReply', () => {
    it('should throw error when not connected', () => {
      const jdwp = new HdcJDWP();

      expect(() => jdwp.sendReply(1, 0)).toThrow('not connected');
    });
  });

  describe('disconnect', () => {
    it('should handle disconnect when not connected', async () => {
      const jdwp = new HdcJDWP();
      await jdwp.disconnect();

      expect(jdwp.getState()).toBe(JDWPState.IDLE);
    });

    it('should be idempotent', async () => {
      const jdwp = new HdcJDWP();
      await jdwp.disconnect();
      await jdwp.disconnect();
      await jdwp.disconnect();

      expect(jdwp.getState()).toBe(JDWPState.IDLE);
    });
  });
});

describe('JDWPState enum', () => {
  it('should have correct values', () => {
    expect(JDWPState.IDLE).toBe('idle');
    expect(JDWPState.HANDSHAKING).toBe('handshaking');
    expect(JDWPState.CONNECTED).toBe('connected');
    expect(JDWPState.DISCONNECTED).toBe('disconnected');
    expect(JDWPState.ERROR).toBe('error');
  });
});

describe('JDWPCommandSet enum', () => {
  it('should have correct values', () => {
    expect(JDWPCommandSet.VIRTUAL_MACHINE).toBe(1);
    expect(JDWPCommandSet.REFERENCE_TYPE).toBe(2);
    expect(JDWPCommandSet.CLASS_TYPE).toBe(3);
    expect(JDWPCommandSet.ARRAY_TYPE).toBe(4);
    expect(JDWPCommandSet.INTERFACE_TYPE).toBe(5);
    expect(JDWPCommandSet.METHOD).toBe(6);
    expect(JDWPCommandSet.FIELD).toBe(8);
    expect(JDWPCommandSet.OBJECT_REFERENCE).toBe(9);
    expect(JDWPCommandSet.STRING_REFERENCE).toBe(10);
    expect(JDWPCommandSet.THREAD_REFERENCE).toBe(11);
    expect(JDWPCommandSet.THREAD_GROUP_REFERENCE).toBe(12);
    expect(JDWPCommandSet.ARRAY_REFERENCE).toBe(13);
    expect(JDWPCommandSet.CLASS_LOADER_REFERENCE).toBe(14);
    expect(JDWPCommandSet.EVENT_REQUEST).toBe(15);
    expect(JDWPCommandSet.STACK_FRAME).toBe(16);
    expect(JDWPCommandSet.CLASS_OBJECT_REFERENCE).toBe(17);
    expect(JDWPCommandSet.EVENT).toBe(64);
  });
});

describe('Constants', () => {
  it('should have correct values', () => {
    expect(JDWP_HANDSHAKE).toBe('JDWP-Handshake');
    expect(JDWP_HEADER_SIZE).toBe(11);
  });
});

describe('Helper functions', () => {
  describe('isJDWPAvailable', () => {
    it('should return true in Node.js', () => {
      expect(isJDWPAvailable()).toBe(true);
    });
  });
});
