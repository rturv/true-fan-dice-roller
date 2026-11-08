/**
 * Chat commands typed in the message input, e.g. `/carta` or `/3d6+3`.
 *
 * Parsing lives outside the component so it can be unit tested without
 * bootstrapping Angular or the WebSocket service. The component is responsible
 * for executing the returned command.
 */

export type ChatCommand =
  | { kind: 'draw_card' }
  | { kind: 'roll_current' }
  | { kind: 'roll'; count: number; modifier: number }
  | { kind: 'easter_egg' };

/** Matches `Nd6`, `Nd6+M` and `Nd6-M` (N is optional, so `d6` means one die). */
const DICE_PATTERN = /^(\d{0,2})d6(?:\s*([+-])\s*(\d{1,2}))?$/i;

// Same limits enforced by the backend (GameService).
const DICE_MIN = 1;
const DICE_MAX = 20;
const MODIFIER_MIN = -99;
const MODIFIER_MAX = 99;

/**
 * Returns the command described by `raw`, or `null` when the text is not a
 * valid command and must be sent as a normal chat message.
 */
export function parseChatCommand(raw: string): ChatCommand | null {
  const text = raw.trim();
  if (!text.startsWith('/')) return null;

  const body = text.slice(1).trim();
  if (!body) return null;

  const lower = body.toLowerCase();
  if (lower === 'carta') return { kind: 'draw_card' };
  if (lower === 'roll') return { kind: 'roll_current' };
  // Hidden easter egg, deliberately left out of the command hint.
  if (lower === 'rtur' || lower === 'ramorco') return { kind: 'easter_egg' };

  const match = DICE_PATTERN.exec(lower);
  if (!match) return null;

  const count = match[1] ? Number(match[1]) : 1;
  const modifier = match[2] ? Number(`${match[2]}${match[3]}`) : 0;

  if (count < DICE_MIN || count > DICE_MAX) return null;
  if (modifier < MODIFIER_MIN || modifier > MODIFIER_MAX) return null;

  return { kind: 'roll', count, modifier };
}
