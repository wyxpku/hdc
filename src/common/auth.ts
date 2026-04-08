/**
 * HDC Authentication Module
 *
 * Provides RSA-based authentication for HDC connections.
 * Ported from: hdc-source/src/common/auth.cpp
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { GetRandomString } from './base.js';

// ============================================================================
// Constants
// ============================================================================

export const RSA_TOKEN_SIZE = 20;
export const RSA_KEY_SIZE = 2048;
export const RSA_SIGNATURE_SIZE = 256;

export enum AuthType {
  NONE = 0,
  TOKEN = 1,
  SIGNATURE = 2,
  PUBLICKEY = 3,
  OK = 4,
  FAIL = 5,
}

export enum AuthState {
  IDLE = 'idle',
  WAITING_TOKEN = 'waiting_token',
  WAITING_SIGNATURE = 'waiting_signature',
  AUTHENTICATED = 'authenticated',
  FAILED = 'failed',
}

// ============================================================================
// Types
// ============================================================================

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface AuthSession {
  sessionId: string;
  token: Buffer;
  state: AuthState;
  peerPublicKey?: string;
  createdAt: number;
}

// ============================================================================
// HdcAuth - Authentication Manager
// ============================================================================

export class HdcAuth {
  private keyPair: KeyPair | null = null;
  private sessions: Map<string, AuthSession> = new Map();
  private trustedKeys: Set<string> = new Set();

  /**
   * Generate RSA key pair
   */
  async generateKeyPair(): Promise<KeyPair> {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair(
        'rsa',
        {
          modulusLength: RSA_KEY_SIZE,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
          },
        },
        (err, publicKey, privateKey) => {
          if (err) {
            reject(err);
          } else {
            this.keyPair = { publicKey, privateKey };
            resolve(this.keyPair);
          }
        }
      );
    });
  }

  /**
   * Load key pair from files
   */
  async loadKeyPair(publicKeyPath: string, privateKeyPath: string): Promise<KeyPair> {
    const publicKey = await fs.promises.readFile(publicKeyPath, 'utf8');
    const privateKey = await fs.promises.readFile(privateKeyPath, 'utf8');

    this.keyPair = { publicKey, privateKey };
    return this.keyPair;
  }

  /**
   * Save key pair to files
   */
  async saveKeyPair(publicKeyPath: string, privateKeyPath: string): Promise<void> {
    if (!this.keyPair) {
      throw new Error('No key pair available');
    }

    await fs.promises.mkdir(path.dirname(publicKeyPath), { recursive: true });
    await fs.promises.mkdir(path.dirname(privateKeyPath), { recursive: true });

    await fs.promises.writeFile(publicKeyPath, this.keyPair.publicKey);
    await fs.promises.writeFile(privateKeyPath, this.keyPair.privateKey);
  }

  /**
   * Get current key pair
   */
  getKeyPair(): KeyPair | null {
    return this.keyPair;
  }

  /**
   * Get public key
   */
  getPublicKey(): string | null {
    return this.keyPair?.publicKey || null;
  }

  /**
   * Create auth session
   */
  createSession(): AuthSession {
    const sessionId = GetRandomString(16);
    const token = crypto.randomBytes(RSA_TOKEN_SIZE);

    const session: AuthSession = {
      sessionId,
      token,
      state: AuthState.WAITING_TOKEN,
      createdAt: Date.now(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get auth session
   */
  getSession(sessionId: string): AuthSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Remove auth session
   */
  removeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Sign token with private key
   */
  signToken(token: Buffer): Buffer {
    if (!this.keyPair?.privateKey) {
      throw new Error('No private key available');
    }

    const sign = crypto.createSign('SHA256');
    sign.update(token);
    sign.end();

    const signature = sign.sign(this.keyPair.privateKey);
    return signature;
  }

  /**
   * Verify signature with public key
   */
  verifySignature(token: Buffer, signature: Buffer, publicKey: string): boolean {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(token);
      verify.end();

      return verify.verify(publicKey, signature);
    } catch {
      return false;
    }
  }

  /**
   * Authenticate with signature
   */
  authenticateWithSignature(sessionId: string, signature: Buffer): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.peerPublicKey) {
      return false;
    }

    const verified = this.verifySignature(session.token, signature, session.peerPublicKey);

    if (verified) {
      session.state = AuthState.AUTHENTICATED;
      this.trustedKeys.add(session.peerPublicKey);
      return true;
    } else {
      session.state = AuthState.FAILED;
      return false;
    }
  }

  /**
   * Add trusted public key
   */
  addTrustedKey(publicKey: string): void {
    this.trustedKeys.add(publicKey);
  }

  /**
   * Check if key is trusted
   */
  isTrustedKey(publicKey: string): boolean {
    return this.trustedKeys.has(publicKey);
  }

  /**
   * Remove trusted key
   */
  removeTrustedKey(publicKey: string): boolean {
    return this.trustedKeys.delete(publicKey);
  }

  /**
   * List trusted keys
   */
  listTrustedKeys(): string[] {
    return Array.from(this.trustedKeys);
  }

  /**
   * Clear all sessions
   */
  clearSessions(): void {
    this.sessions.clear();
  }

  /**
   * Clear expired sessions
   */
  clearExpiredSessions(maxAge: number = 60000): number {
    const now = Date.now();
    let removed = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > maxAge) {
        this.sessions.delete(id);
        removed++;
      }
    }

    return removed;
  }
}
