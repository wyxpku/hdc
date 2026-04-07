/**
 * TLV Buffer Tests
 *
 * Translated from: test/unittest/common/tlv_ut.cpp
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TlvBuf, TLV_HEAD_SIZE, TLV_VALUE_MAX_LEN } from './tlv.js';

const tlvSize = (len: number) => len + TLV_HEAD_SIZE;

function buildTlv(tags: number[], sizes: number[], val: number): Buffer {
  const totalSize = sizes.reduce((sum, s) => sum + tlvSize(s), 0);
  const buf = Buffer.alloc(totalSize);
  let pos = 0;

  for (let i = 0; i < tags.length; i++) {
    buf.writeUInt32LE(tags[i], pos);
    buf.writeUInt32LE(sizes[i], pos + 4);
    buf.fill(val, pos + TLV_HEAD_SIZE, pos + TLV_HEAD_SIZE + sizes[i]);
    pos += tlvSize(sizes[i]);
  }

  return buf;
}

describe('TlvBuf Constructor', () => {
  it('should create empty TlvBuf', () => {
    const tb = new TlvBuf();
    expect(tb.getBufSize()).toBe(0);
  });

  it('should create TlvBuf with valid tags', () => {
    const validTags = new Set([1, 2, 3]);
    const tb = new TlvBuf(undefined, undefined, validTags);
    expect(tb.getBufSize()).toBe(0);
  });

  it('should create TlvBuf from buffer', () => {
    const tlv = buildTlv([1], [1], 0xab);
    const tb = new TlvBuf(tlv, tlv.length);
    expect(tb.getBufSize()).toBe(tlv.length);
  });

  it('should create TlvBuf from buffer with valid tags', () => {
    const validTags = new Set([1, 2, 3]);
    const tlv = buildTlv([1], [1], 0xab);
    const tb = new TlvBuf(tlv, tlv.length, validTags);
    expect(tb.getBufSize()).toBe(tlv.length);
  });

  it('should reject TLV with value exceeding max length', () => {
    const validTags = new Set([1, 2, 3]);
    const tlv = buildTlv([1], [TLV_VALUE_MAX_LEN + 1], 0xab);
    const tb = new TlvBuf(tlv, tlv.length, validTags);
    expect(tb.getBufSize()).toBe(0);
  });
});

describe('TlvBuf Clear', () => {
  it('should clear buffer', () => {
    const tlv = buildTlv([1], [1], 0xab);
    const tb = new TlvBuf(tlv, tlv.length);
    expect(tb.getBufSize()).toBe(tlv.length);
    tb.clear();
    expect(tb.getBufSize()).toBe(0);
  });
});

describe('TlvBuf Append', () => {
  it('should append value and update size', () => {
    const tb = new TlvBuf();
    expect(tb.getBufSize()).toBe(0);

    const val = Buffer.alloc(10, 0xac);
    expect(tb.append(1, val)).toBe(true);
    expect(tb.getBufSize()).toBe(tlvSize(10));

    // Duplicate tag should fail
    expect(tb.append(1, val)).toBe(false);
    expect(tb.getBufSize()).toBe(tlvSize(10));

    expect(tb.append(2, val)).toBe(true);
    expect(tb.getBufSize()).toBe(tlvSize(10) * 2);
  });

  it('should append string', () => {
    const tb = new TlvBuf();
    expect(tb.getBufSize()).toBe(0);

    const val = 'hello world!';
    expect(tb.appendString(1, val)).toBe(true);
    expect(tb.getBufSize()).toBe(tlvSize(val.length));
  });

  it('should reject invalid parameters', () => {
    const tb = new TlvBuf();

    expect(tb.append(1, 0, null)).toBe(false);
    expect(tb.getBufSize()).toBe(0);

    expect(tb.append(1, TLV_VALUE_MAX_LEN + 1, null)).toBe(false);
    expect(tb.getBufSize()).toBe(0);

    expect(tb.append(1, TLV_VALUE_MAX_LEN, null)).toBe(false);
    expect(tb.getBufSize()).toBe(0);
  });
});

describe('TlvBuf CopyToBuf', () => {
  it('should copy to buffer', () => {
    const val = Buffer.alloc(10, 0xac);
    const tb = new TlvBuf();
    expect(tb.append(1, val)).toBe(true);

    const size = tb.getBufSize();
    expect(size).toBe(tlvSize(10));

    const buf = Buffer.alloc(size);

    expect(tb.copyToBuf(buf, size - 1)).toBe(false);
    expect(tb.copyToBuf(Buffer.alloc(0), size)).toBe(false);

    expect(tb.copyToBuf(buf, size)).toBe(true);
    expect(buf.readUInt32LE(0)).toBe(1);
    expect(buf.readUInt32LE(4)).toBe(10);
    expect(buf.subarray(TLV_HEAD_SIZE, TLV_HEAD_SIZE + 10).equals(val)).toBe(true);
  });
});

describe('TlvBuf FindTlv', () => {
  it('should find tag', () => {
    const val = Buffer.alloc(10, 0xac);
    const tb = new TlvBuf();
    expect(tb.append(1, val)).toBe(true);

    const result = tb.findTag(2);
    expect(result).toBeNull();

    const found = tb.findTag(1);
    expect(found).not.toBeNull();
    expect(found!.length).toBe(10);
    expect(found!.value.equals(val)).toBe(true);
  });

  it('should find string', () => {
    const val = 'hello world!';
    const tb = new TlvBuf();
    expect(tb.appendString(1, val)).toBe(true);

    const found = tb.findString(1);
    expect(found).toBe(val);
  });
});

describe('TlvBuf ContainInvalidTag', () => {
  it('should detect invalid tag', () => {
    const validTags = new Set([1, 2, 3]);
    const tlv = buildTlv([1, 2, 3], [4, 4, 4], 0xab);
    const tb = new TlvBuf(tlv, tlv.length, validTags);
    expect(tb.getBufSize()).toBe(tlv.length);
    expect(tb.containInvalidTag()).toBe(false);

    expect(tb.append(5, Buffer.alloc(10, 0xac))).toBe(true);
    expect(tb.containInvalidTag()).toBe(true);
  });

  it('should detect invalid tag on construction', () => {
    const validTags = new Set([1, 2]);
    const tlv = buildTlv([1, 2, 3], [4, 4, 4], 0xab);
    const tb = new TlvBuf(tlv, tlv.length, validTags);
    expect(tb.getBufSize()).toBe(tlv.length);
    expect(tb.containInvalidTag()).toBe(true);
  });
});
