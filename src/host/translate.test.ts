/**
 * Command Translation Tests
 *
 * Translated from: test/unittest/host/host_translate_test.cpp
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  usage,
  verbose,
  targetConnect,
  forwardPort,
  runMode,
  targetReboot,
  string2FormatCommand,
  createFormatCommand,
  FormatCommand,
} from './translate.js';
import { CommandFlag } from '../index.js';

describe('TranslateCommand Usage', () => {
  it('should contain main help sections', () => {
    const text = usage();
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('-l[0-5]');
    expect(text).toContain('checkserver');
    expect(text).toContain('tconn key [-remove]');
    expect(text).toContain('-s [ip:]port');
  });

  it('verbose help should contain flash commands', () => {
    const text = verbose();
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('-l[0-5]');
    expect(text).toContain('checkserver');
    expect(text).toContain('tconn key [-remove]');
    expect(text).toContain('-s [ip:]port');
    expect(text).toContain('flash commands');
  });
});

describe('TranslateCommand TargetConnect', () => {
  let cmd: FormatCommand;

  beforeEach(() => {
    cmd = createFormatCommand();
  });

  it('should parse target connect', () => {
    cmd.parameters = '127.0.0.1:12345';
    const result = targetConnect(cmd);

    expect(cmd.bJumpDo).toBe(false);
    expect(result).toBe('');
    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_KERNEL_TARGET_CONNECT);
  });

  it('should parse target connect with remove', () => {
    cmd.parameters = '127.0.0.1:12345 -remove';
    const result = targetConnect(cmd);

    expect(cmd.bJumpDo).toBe(false);
    expect(result).toBe('');
    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_KERNEL_TARGET_DISCONNECT);
    expect(cmd.parameters).toBe('127.0.0.1:12345');
  });

  it('should reject long connect key', () => {
    const longCommand = 'a'.repeat(51);
    cmd.parameters = longCommand;
    const result = targetConnect(cmd);

    expect(cmd.bJumpDo).toBe(true);
    expect(result).toBe('Error connect key\'s size');
  });

  it('should reject invalid IP', () => {
    cmd.parameters = '127.0.0.256:12345';
    const result = targetConnect(cmd);

    expect(cmd.bJumpDo).toBe(true);
    expect(result).toBe('[E001104]:IP address incorrect');
  });

  it('should resolve localhost to 127.0.0.1', () => {
    cmd.parameters = 'localhost:12345';
    const result = targetConnect(cmd);

    expect(result).toBe('');
    expect(cmd.parameters).toBe('127.0.0.1:12345');
  });

  it('should reject port out of range', () => {
    cmd.parameters = '127.0.0.1:66666';
    const result = targetConnect(cmd);

    expect(cmd.bJumpDo).toBe(true);
    expect(result).toBe('IP:Port incorrect');
  });
});

describe('TranslateCommand ForwardPort', () => {
  let cmd: FormatCommand;

  beforeEach(() => {
    cmd = createFormatCommand();
  });

  it('should parse fport ls', () => {
    const result = forwardPort('fport ls', cmd);

    expect(cmd.bJumpDo).toBe(false);
    expect(result).toBe('');
    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_FORWARD_LIST);
  });

  it('should parse fport rm', () => {
    const result = forwardPort('fport rm tcp:12345 tcp:54321', cmd);

    expect(result).toBe('');
    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_FORWARD_REMOVE);
    expect(cmd.bJumpDo).toBe(false);
    expect(cmd.parameters).toBe('tcp:12345 tcp:54321');
  });

  it('should parse fport tcp', () => {
    const result = forwardPort('fport tcp:12345 tcp:54321', cmd);

    expect(result).toBe('');
    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_FORWARD_INIT);
    expect(cmd.bJumpDo).toBe(false);
    expect(cmd.parameters).toBe('fport fport tcp:12345 tcp:54321');
  });

  it('should reject invalid fport command', () => {
    const result = forwardPort('fport invalid', cmd);

    expect(cmd.bJumpDo).toBe(true);
    expect(result).toBe('Incorrect forward command');
  });

  it('should reject empty fport', () => {
    const result = forwardPort('', cmd);

    expect(cmd.bJumpDo).toBe(true);
    expect(result).toBe('Incorrect forward command');
  });
});

describe('TranslateCommand RunMode', () => {
  let cmd: FormatCommand;

  beforeEach(() => {
    cmd = createFormatCommand();
  });

  it('should parse tmode port', () => {
    const result = runMode('tmode port 8710', cmd);

    expect(result).toBe('');
    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_UNITY_RUNMODE);
    expect(cmd.bJumpDo).toBe(false);
    expect(cmd.parameters).toBe('port 8710');
  });

  it('should parse tmode port close', () => {
    const result = runMode('tmode port close', cmd);

    expect(result).toBe('');
    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_UNITY_RUNMODE);
    expect(cmd.bJumpDo).toBe(false);
    expect(cmd.parameters).toBe('port close');
  });

  it('should reject invalid tmode', () => {
    const result = runMode('tmode invalid', cmd);

    expect(result).toBe('Error tmode command');
    expect(cmd.bJumpDo).toBe(true);
  });

  it('should reject port out of range (0)', () => {
    const result = runMode('tmode port 0', cmd);

    expect(result).toBe('Incorrect port range');
    expect(cmd.bJumpDo).toBe(true);
  });

  it('should reject missing port', () => {
    const result = runMode('tmode port ', cmd);

    expect(result).toBe('Incorrect port range');
    expect(cmd.bJumpDo).toBe(true);
  });

  it('should accept minimum port (1)', () => {
    const result = runMode('tmode port 1', cmd);

    expect(result).toBe('');
    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_UNITY_RUNMODE);
    expect(cmd.bJumpDo).toBe(false);
    expect(cmd.parameters).toBe('port 1');
  });

  it('should accept maximum port (65535)', () => {
    const result = runMode('tmode port 65535', cmd);

    expect(result).toBe('');
    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_UNITY_RUNMODE);
    expect(cmd.bJumpDo).toBe(false);
    expect(cmd.parameters).toBe('port 65535');
  });
});

describe('TranslateCommand TargetReboot', () => {
  let cmd: FormatCommand;

  beforeEach(() => {
    cmd = createFormatCommand();
  });

  it('should parse target boot -bootloader', () => {
    targetReboot('target boot -bootloader', cmd);

    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_UNITY_REBOOT);
    expect(cmd.parameters).toBe('bootloader');
  });

  it('should parse target boot', () => {
    targetReboot('target boot', cmd);

    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_UNITY_REBOOT);
    expect(cmd.parameters).toBe('');
  });
});

describe('TranslateCommand String2FormatCommand', () => {
  let cmd: FormatCommand;

  beforeEach(() => {
    cmd = createFormatCommand();
  });

  it('should parse help command', () => {
    const expectResult = usage() + '\n';
    const result = string2FormatCommand('help', cmd);

    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_KERNEL_HELP);
    expect(result).toBe(expectResult);
  });

  it('should parse kill command', () => {
    const result = string2FormatCommand('kill', cmd);

    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_SERVER_KILL);
    expect(result).toBe('');
  });

  it('should handle unknown command', () => {
    const result = string2FormatCommand('unknown', cmd);

    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_KERNEL_HELP);
    expect(result).toBe('Unknown command...\n');
  });

  it('should parse fport ls command', () => {
    const result = string2FormatCommand('fport ls', cmd);

    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_FORWARD_LIST);
  });

  it('should parse track-jpid -p command', () => {
    const result = string2FormatCommand('track-jpid -p', cmd);

    expect(cmd.cmdFlag).toBe(CommandFlag.CMD_JDWP_TRACK);
    expect(cmd.parameters).toBe('p');
  });
});
