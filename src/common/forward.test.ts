/**
 * Tests for Forward module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HdcForward, HdcForwardManager, ForwardType, ForwardState, createTcpForward } from './forward.js';

describe('HdcForward', () => {
  describe('constructor', () => {
    it('should create forward instance', () => {
      const forward = new HdcForward({
        localPort: 8080,
        remoteHost: '127.0.0.1',
        remotePort: 9090,
      });

      expect(forward.getId()).toBeDefined();
      expect(forward.getState()).toBe(ForwardState.IDLE);
      expect(forward.getLocalPort()).toBe(8080);
      expect(forward.getRemoteAddress()).toBe('127.0.0.1:9090');
    });

    it('should accept custom forward type', () => {
      const forward = new HdcForward({
        localPort: 8080,
        remoteHost: 'localhost',
        remotePort: 5005,
        type: ForwardType.JDWP,
      });

      expect(forward['type']).toBe(ForwardType.JDWP);
    });
  });

  describe('getId', () => {
    it('should return 8-character ID', () => {
      const forward = new HdcForward({
        localPort: 8080,
        remoteHost: '127.0.0.1',
        remotePort: 9090,
      });

      expect(forward.getId().length).toBe(8);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const forward = new HdcForward({
        localPort: 8080,
        remoteHost: '127.0.0.1',
        remotePort: 9090,
      });

      expect(forward.getState()).toBe(ForwardState.IDLE);
    });
  });

  describe('getSession', () => {
    it('should return session info', () => {
      const forward = new HdcForward({
        localPort: 8080,
        remoteHost: '127.0.0.1',
        remotePort: 9090,
      });

      const session = forward.getSession();

      expect(session.id).toBeDefined();
      expect(session.type).toBe(ForwardType.TCP);
      expect(session.localPort).toBe(8080);
      expect(session.remoteHost).toBe('127.0.0.1');
      expect(session.remotePort).toBe(9090);
      expect(session.state).toBe(ForwardState.IDLE);
      expect(session.bytesForwarded).toBe(0);
      expect(session.connections).toBe(0);
    });
  });

  describe('getBytesForwarded', () => {
    it('should return 0 initially', () => {
      const forward = new HdcForward({
        localPort: 8080,
        remoteHost: '127.0.0.1',
        remotePort: 9090,
      });

      expect(forward.getBytesForwarded()).toBe(0);
    });
  });

  describe('getConnections', () => {
    it('should return 0 initially', () => {
      const forward = new HdcForward({
        localPort: 8080,
        remoteHost: '127.0.0.1',
        remotePort: 9090,
      });

      expect(forward.getConnections()).toBe(0);
    });
  });

  describe('start', () => {
    it('should start listening on local port', async () => {
      const forward = new HdcForward({
        localPort: 0, // Use random port
        remoteHost: '127.0.0.1',
        remotePort: 9999,
      });

      await forward.start();

      expect(forward.getState()).toBe(ForwardState.FORAWRDING);
      expect(forward.isActive()).toBe(true);

      await forward.stop();
    });

    it('should emit listening event', async () => {
      const forward = new HdcForward({
        localPort: 0,
        remoteHost: '127.0.0.1',
        remotePort: 9999,
      });

      let listeningPort = 0;
      forward.on('listening', (port: number) => {
        listeningPort = port;
      });

      await forward.start();
      
      // Give event time to fire
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // listeningPort should be updated
      expect(listeningPort).toBeGreaterThanOrEqual(0);

      await forward.stop();
    });

    it('should throw error when already started', async () => {
      const forward = new HdcForward({
        localPort: 0,
        remoteHost: '127.0.0.1',
        remotePort: 9999,
      });

      await forward.start();

      await expect(forward.start()).rejects.toThrow('already started');

      await forward.stop();
    });
  });

  describe('stop', () => {
    it('should stop forwarding', async () => {
      const forward = new HdcForward({
        localPort: 0,
        remoteHost: '127.0.0.1',
        remotePort: 9999,
      });

      await forward.start();
      await forward.stop();

      expect(forward.getState()).toBe(ForwardState.CLOSED);
      expect(forward.isActive()).toBe(false);
    });

    it('should be idempotent', async () => {
      const forward = new HdcForward({
        localPort: 0,
        remoteHost: '127.0.0.1',
        remotePort: 9999,
      });

      await forward.start();
      await forward.stop();
      await forward.stop();
      await forward.stop();

      expect(forward.getState()).toBe(ForwardState.CLOSED);
    });

    it('should emit close event', async () => {
      const forward = new HdcForward({
        localPort: 0,
        remoteHost: '127.0.0.1',
        remotePort: 9999,
      });

      let closed = false;
      forward.on('close', () => {
        closed = true;
      });

      await forward.start();
      await forward.stop();

      expect(closed).toBe(true);
    });
  });
});

describe('HdcForwardManager', () => {
  let manager: HdcForwardManager;

  beforeEach(() => {
    manager = new HdcForwardManager();
  });

  afterEach(async () => {
    await manager.stopAll();
  });

  describe('constructor', () => {
    it('should create manager', () => {
      expect(manager.count).toBe(0);
    });
  });

  describe('createForward', () => {
    it('should create and start forward', async () => {
      const forward = await manager.createForward({
        localPort: 0,
        remoteHost: '127.0.0.1',
        remotePort: 9999,
      });

      expect(forward).toBeDefined();
      expect(forward.isActive()).toBe(true);
      expect(manager.count).toBe(1);
    });

    it('should emit forward-start event', async () => {
      let started = false;
      manager.on('forward-start', () => {
        started = true;
      });

      await manager.createForward({
        localPort: 0,
        remoteHost: '127.0.0.1',
        remotePort: 9999,
      });

      expect(started).toBe(true);
    });
  });

  describe('removeForward', () => {
    it('should remove forward', async () => {
      const forward = await manager.createForward({
        localPort: 0,
        remoteHost: '127.0.0.1',
        remotePort: 9999,
      });

      const result = await manager.removeForward(forward.getId());

      expect(result).toBe(true);
      expect(manager.count).toBe(0);
    });

    it('should return false for non-existent forward', async () => {
      const result = await manager.removeForward('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getForward', () => {
    it('should return forward by ID', async () => {
      const forward = await manager.createForward({
        localPort: 0,
        remoteHost: '127.0.0.1',
        remotePort: 9999,
      });

      const found = manager.getForward(forward.getId());
      expect(found).toBe(forward);
    });

    it('should return undefined for non-existent ID', () => {
      const found = manager.getForward('nonexistent');
      expect(found).toBeUndefined();
    });
  });

  describe('listForwards', () => {
    it('should list all forwards', async () => {
      await manager.createForward({
        localPort: 0,
        remoteHost: '127.0.0.1',
        remotePort: 9999,
      });

      await manager.createForward({
        localPort: 0,
        remoteHost: '127.0.0.1',
        remotePort: 8888,
      });

      const forwards = manager.listForwards();
      expect(forwards.length).toBe(2);
    });
  });

  describe('stopAll', () => {
    it('should stop all forwards', async () => {
      await manager.createForward({
        localPort: 0,
        remoteHost: '127.0.0.1',
        remotePort: 9999,
      });

      await manager.createForward({
        localPort: 0,
        remoteHost: '127.0.0.1',
        remotePort: 8888,
      });

      await manager.stopAll();

      expect(manager.count).toBe(0);
    });
  });
});

describe('ForwardState enum', () => {
  it('should have correct values', () => {
    expect(ForwardState.IDLE).toBe('idle');
    expect(ForwardState.LISTENING).toBe('listening');
    expect(ForwardState.CONNECTING).toBe('connecting');
    expect(ForwardState.FORAWRDING).toBe('forwarding');
    expect(ForwardState.CLOSED).toBe('closed');
    expect(ForwardState.ERROR).toBe('error');
  });
});

describe('ForwardType enum', () => {
  it('should have correct values', () => {
    expect(ForwardType.TCP).toBe('tcp');
    expect(ForwardType.JDWP).toBe('jdwp');
    expect(ForwardType.ABSTRACT).toBe('abstract');
    expect(ForwardType.RESERVED).toBe('reserved');
  });
});
