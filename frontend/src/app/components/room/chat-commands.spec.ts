import { describe, it, expect } from 'vitest';
import { parseChatCommand } from './chat-commands';

describe('parseChatCommand', () => {
  it('parses /carta case-insensitively', () => {
    expect(parseChatCommand('/carta')).toEqual({ kind: 'draw_card' });
    expect(parseChatCommand('/CARTA')).toEqual({ kind: 'draw_card' });
    expect(parseChatCommand('/Carta')).toEqual({ kind: 'draw_card' });
    expect(parseChatCommand('  /carta  ')).toEqual({ kind: 'draw_card' });
    expect(parseChatCommand('/ carta')).toEqual({ kind: 'draw_card' });
  });

  it('parses /roll as a roll with the current controls', () => {
    expect(parseChatCommand('/roll')).toEqual({ kind: 'roll_current' });
    expect(parseChatCommand('/ROLL')).toEqual({ kind: 'roll_current' });
  });

  it('parses dice expressions', () => {
    expect(parseChatCommand('/d6')).toEqual({ kind: 'roll', count: 1, modifier: 0 });
    expect(parseChatCommand('/3d6')).toEqual({ kind: 'roll', count: 3, modifier: 0 });
    expect(parseChatCommand('/3D6')).toEqual({ kind: 'roll', count: 3, modifier: 0 });
    expect(parseChatCommand('/3d6+3')).toEqual({ kind: 'roll', count: 3, modifier: 3 });
    expect(parseChatCommand('/3d6 + 3')).toEqual({ kind: 'roll', count: 3, modifier: 3 });
    expect(parseChatCommand('/3d6-2')).toEqual({ kind: 'roll', count: 3, modifier: -2 });
    expect(parseChatCommand('/1d6+0')).toEqual({ kind: 'roll', count: 1, modifier: 0 });
    expect(parseChatCommand('/20d6+99')).toEqual({ kind: 'roll', count: 20, modifier: 99 });
    expect(parseChatCommand('/20d6-99')).toEqual({ kind: 'roll', count: 20, modifier: -99 });
  });

  it('rejects anything that is not a command', () => {
    expect(parseChatCommand('')).toBeNull();
    expect(parseChatCommand('/')).toBeNull();
    expect(parseChatCommand('/   ')).toBeNull();
    expect(parseChatCommand('/hola')).toBeNull();
    expect(parseChatCommand('/carta algo')).toBeNull();
    expect(parseChatCommand('/roll ahora')).toBeNull();
    expect(parseChatCommand('texto normal')).toBeNull();
    expect(parseChatCommand('hola /carta')).toBeNull();
  });

  it('rejects dice expressions outside the allowed ranges', () => {
    expect(parseChatCommand('/0d6')).toBeNull();
    expect(parseChatCommand('/21d6')).toBeNull();
    expect(parseChatCommand('/3d6+100')).toBeNull();
    expect(parseChatCommand('/3d6-100')).toBeNull();
    expect(parseChatCommand('/123d6')).toBeNull();
    expect(parseChatCommand('/3d6+')).toBeNull();
  });

  it('rejects other die sizes because the game only uses d6', () => {
    expect(parseChatCommand('/3d20')).toBeNull();
    expect(parseChatCommand('/2d8')).toBeNull();
  });
});
