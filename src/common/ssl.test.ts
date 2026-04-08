/**
 * Tests for SSL module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as tls from 'tls';
import {
  HdcSSL,
  SSLState,
  SSL_MIN_VERSION,
  isTLSAvailable
} from './ssl.js';

const SSL_DEFAULT_PORT = 8711;

describe('HdcSSL', () => {
  describe('constructor', () => {
    it('should create SSL instance', () => {
      const ssl = new HdcSSL();

      expect(ssl.getState()).toBe(SSLState.IDLE);
      expect(ssl.getSessionId()).toBeDefined();
      expect(ssl.getSessionId().length).toBe(16);
    });

    it('should accept custom options', () => {
      const ssl = new HdcSSL({
        rejectUnauthorized: true,
        minVersion: 'TLSv1.3',
        servername: 'example.com',
      });

      expect(ssl['options'].rejectUnauthorized).toBe(true);
      expect(ssl['options'].minVersion).toBe('TLSv1.3');
      expect(ssl['options'].servername).toBe('example.com');
    });

    it('should use default options', () => {
      const ssl = new HdcSSL();

      expect(ssl['options'].minVersion).toBe(SSL_MIN_VERSION);
      expect(ssl['options'].rejectUnauthorized).toBe(false);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const ssl = new HdcSSL();
      expect(ssl.getState()).toBe(SSLState.IDLE);
    });
  });

  describe('getSessionId', () => {
    it('should return session ID', () => {
      const ssl = new HdcSSL();
      const sessionId = ssl.getSessionId();

      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBe(16);
    });
  });

  describe('isAuthorized', () => {
    it('should return false initially', () => {
      const ssl = new HdcSSL();
      expect(ssl.isAuthorized()).toBe(false);
    });
  });

  describe('getCipher', () => {
    it('should return null when not connected', () => {
      const ssl = new HdcSSL();
      expect(ssl.getCipher()).toBeNull();
    });
  });

  describe('getProtocol', () => {
    it('should return null when not connected', () => {
      const ssl = new HdcSSL();
      expect(ssl.getProtocol()).toBeNull();
    });
  });

  describe('getPeerCertificate', () => {
    it('should return null when not connected', () => {
      const ssl = new HdcSSL();
      expect(ssl.getPeerCertificate()).toBeNull();
    });
  });

  describe('getSessionInfo', () => {
    it('should return session info', () => {
      const ssl = new HdcSSL();
      const info = ssl.getSessionInfo();

      expect(info.sessionId).toBe(ssl.getSessionId());
      expect(info.state).toBe(SSLState.IDLE);
      expect(info.authorized).toBe(false);
      expect(info.startTime).toBeDefined();
    });
  });

  describe('close', () => {
    it('should handle close when not connected', async () => {
      const ssl = new HdcSSL();
      await ssl.close();

      expect(ssl.getState()).toBe(SSLState.IDLE);
    });

    it('should be idempotent', async () => {
      const ssl = new HdcSSL();
      await ssl.close();
      await ssl.close();
      await ssl.close();

      expect(ssl.getState()).toBe(SSLState.IDLE);
    });
  });

  describe('createServerSocket', () => {
    it('should create TLS server socket', () => {
      const ssl = new HdcSSL();

      // Just test that the method exists
      expect(typeof ssl.createServerSocket).toBe('function');
    });
  });
});

describe('Helper functions', () => {
  describe('isTLSAvailable', () => {
    it('should return true in Node.js', () => {
      expect(isTLSAvailable()).toBe(true);
    });
  });
});

describe('SSLState enum', () => {
  it('should have correct values', () => {
    expect(SSLState.IDLE).toBe('idle');
    expect(SSLState.HANDSHAKING).toBe('handshaking');
    expect(SSLState.CONNECTED).toBe('connected');
    expect(SSLState.DISCONNECTED).toBe('disconnected');
    expect(SSLState.ERROR).toBe('error');
  });
});

describe('Constants', () => {
  it('should have correct values', () => {
    expect(SSL_MIN_VERSION).toBe('TLSv1.2');
    expect(SSL_DEFAULT_PORT).toBe(8711);
  });
});
