/**
 * Tests for Auth module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HdcAuth, AuthType, AuthState } from './auth.js';

describe('HdcAuth', () => {
  let auth: HdcAuth;
  let tempDir: string;

  beforeEach(async () => {
    auth = new HdcAuth();
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hdc-auth-test-'));
  });

  afterEach(async () => {
    auth.clearSessions();
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should create auth instance', () => {
      expect(auth).toBeDefined();
    });
  });

  describe('generateKeyPair', () => {
    it('should generate key pair', async () => {
      const keyPair = await auth.generateKeyPair();

      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(keyPair.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    });

    it('should generate different keys each time', async () => {
      const keyPair1 = await auth.generateKeyPair();
      const keyPair2 = await auth.generateKeyPair();

      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    });
  });

  describe('getKeyPair', () => {
    it('should return null before key generation', () => {
      expect(auth.getKeyPair()).toBeNull();
    });

    it('should return key pair after generation', async () => {
      const keyPair = await auth.generateKeyPair();
      expect(auth.getKeyPair()).toBe(keyPair);
    });
  });

  describe('getPublicKey', () => {
    it('should return null before key generation', () => {
      expect(auth.getPublicKey()).toBeNull();
    });

    it('should return public key after generation', async () => {
      const keyPair = await auth.generateKeyPair();
      expect(auth.getPublicKey()).toBe(keyPair.publicKey);
    });
  });

  describe('signToken', () => {
    it('should throw error without private key', () => {
      const token = Buffer.from('test');
      expect(() => auth.signToken(token)).toThrow('No private key available');
    });

    it('should sign token with private key', async () => {
      await auth.generateKeyPair();
      const token = crypto.getRandomValues(new Uint8Array(20));
      const signature = auth.signToken(Buffer.from(token));

      expect(signature).toBeDefined();
      expect(signature.length).toBeGreaterThan(0);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', async () => {
      const keyPair = await auth.generateKeyPair();
      const token = crypto.getRandomValues(new Uint8Array(20));
      const tokenBuffer = Buffer.from(token);
      const signature = auth.signToken(tokenBuffer);
      const verified = auth.verifySignature(tokenBuffer, signature, keyPair.publicKey);

      expect(verified).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const keyPair = await auth.generateKeyPair();
      const token = crypto.getRandomValues(new Uint8Array(20));
      const tokenBuffer = Buffer.from(token);
      const signature = auth.signToken(tokenBuffer);
      const wrongToken = Buffer.from('wrong token');
      const verified = auth.verifySignature(wrongToken, signature, keyPair.publicKey);

      expect(verified).toBe(false);
    });

    it('should reject modified token', async () => {
      const keyPair = await auth.generateKeyPair();
      const token = crypto.getRandomValues(new Uint8Array(20));
      const tokenBuffer = Buffer.from(token);
      const signature = auth.signToken(tokenBuffer);
      const modifiedToken = Buffer.from('modified');
      const verified = auth.verifySignature(modifiedToken, signature, keyPair.publicKey);

      expect(verified).toBe(false);
    });
  });

  describe('createSession', () => {
    it('should create auth session', () => {
      const session = auth.createSession();

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.token.length).toBe(20);
      expect(session.state).toBe(AuthState.WAITING_TOKEN);
    });

    it('should create unique session IDs', () => {
      const session1 = auth.createSession();
      const session2 = auth.createSession();

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });
  });

  describe('getSession', () => {
    it('should get session by ID', () => {
      const session = auth.createSession();
      const found = auth.getSession(session.sessionId);

      expect(found).toBe(session);
    });

    it('should return undefined for non-existent session', () => {
      const found = auth.getSession('nonexistent');
      expect(found).toBeUndefined();
    });
  });

  describe('removeSession', () => {
    it('should remove session', () => {
      const session = auth.createSession();
      const result = auth.removeSession(session.sessionId);

      expect(result).toBe(true);
      expect(auth.getSession(session.sessionId)).toBeUndefined();
    });

    it('should return false for non-existent session', () => {
      const result = auth.removeSession('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('authenticateWithSignature', () => {
    it('should authenticate successfully', async () => {
      const keyPair = await auth.generateKeyPair();
      const session = auth.createSession();
      session.peerPublicKey = keyPair.publicKey;

      const signature = auth.signToken(session.token);
      const result = auth.authenticateWithSignature(session.sessionId, signature);

      expect(result).toBe(true);
      expect(session.state).toBe(AuthState.AUTHENTICATED);
    });

    it('should fail for non-existent session', async () => {
      await auth.generateKeyPair();
      const signature = Buffer.from('signature');
      const result = auth.authenticateWithSignature('nonexistent', signature);

      expect(result).toBe(false);
    });

    it('should fail for invalid signature', async () => {
      const keyPair = await auth.generateKeyPair();
      const session = auth.createSession();
      session.peerPublicKey = keyPair.publicKey;

      const invalidSignature = Buffer.from('invalid');
      const result = auth.authenticateWithSignature(session.sessionId, invalidSignature);

      expect(result).toBe(false);
      expect(session.state).toBe(AuthState.FAILED);
    });
  });

  describe('trusted keys', () => {
    it('should manage trusted keys', () => {
      const publicKey = 'test-public-key';

      auth.addTrustedKey(publicKey);
      expect(auth.isTrustedKey(publicKey)).toBe(true);

      const result = auth.removeTrustedKey(publicKey);
      expect(result).toBe(true);
      expect(auth.isTrustedKey(publicKey)).toBe(false);
    });

    it('should list trusted keys', () => {
      auth.addTrustedKey('key1');
      auth.addTrustedKey('key2');

      const keys = auth.listTrustedKeys();
      expect(keys.length).toBe(2);
    });
  });

  describe('clearSessions', () => {
    it('should clear all sessions', () => {
      auth.createSession();
      auth.createSession();
      auth.createSession();

      auth.clearSessions();

      expect(auth['sessions'].size).toBe(0);
    });
  });

  describe('clearExpiredSessions', () => {
    it('should clear expired sessions', () => {
      const session = auth.createSession();

      // Mock old creation time
      session.createdAt = Date.now() - 120000; // 2 minutes ago

      const removed = auth.clearExpiredSessions(60000); // 1 minute max age

      expect(removed).toBe(1);
      expect(auth.getSession(session.sessionId)).toBeUndefined();
    });
  });
});

describe('AuthType enum', () => {
  it('should have correct values', () => {
    expect(AuthType.NONE).toBe(0);
    expect(AuthType.TOKEN).toBe(1);
    expect(AuthType.SIGNATURE).toBe(2);
    expect(AuthType.PUBLICKEY).toBe(3);
    expect(AuthType.OK).toBe(4);
    expect(AuthType.FAIL).toBe(5);
  });
});

describe('AuthState enum', () => {
  it('should have correct values', () => {
    expect(AuthState.IDLE).toBe('idle');
    expect(AuthState.WAITING_TOKEN).toBe('waiting_token');
    expect(AuthState.WAITING_SIGNATURE).toBe('waiting_signature');
    expect(AuthState.AUTHENTICATED).toBe('authenticated');
    expect(AuthState.FAILED).toBe('failed');
  });
});
