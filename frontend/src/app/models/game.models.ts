export interface DiceResult {
  count: number;
  initialCount: number;
  values: number[];
  diceTotal: number;
  modifier: number;
  total: number;
  explosions: number;
}

export interface CardInfo {
  kind: string;
  suit?: string;
  suitName?: string;
  rank: number;
  label: string;
  glyph: string;
  shortName: string;
}

export interface DrawResult {
  card: CardInfo;
  remaining: number;
  reshuffledNext: boolean;
}

export interface HistoryEntry {
  type: 'dice_roll' | 'card_draw' | 'text_message' | 'system';
  nickname: string;
  timestamp: string;
  text?: string;
  data?: DiceResult | DrawResult;
}

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

export interface JoinedMessage extends WsMessage {
  roomCode: string;
  nickname: string;
  sessionToken: string;
  isAdmin: boolean;
  deckRemaining: number;
  users: string[];
  history: HistoryEntry[];
}

export interface ErrorMessage extends WsMessage {
  message: string;
}

export interface DiceRollMessage extends WsMessage {
  nickname: string;
  timestamp: string;
  result: DiceResult;
}

export interface CardDrawMessage extends WsMessage {
  nickname: string;
  card: CardInfo;
  remaining: number;
  reshuffledNext: boolean;
  timestamp: string;
}

export interface TextMessage extends WsMessage {
  nickname: string;
  text: string;
  timestamp: string;
}

export interface UserJoinedMessage extends WsMessage {
  nickname: string;
}

export interface UserLeftMessage extends WsMessage {
  nickname: string;
  reason: string;
}

export interface UserKickedMessage extends WsMessage {
  nickname: string;
  byNickname: string;
}

export interface AdminChangedMessage extends WsMessage {
  newAdminNickname: string;
}

export interface DeckReshuffledMessage extends WsMessage {
  byNickname: string;
  remaining: number;
  timestamp: string;
}

export interface UserListMessage extends WsMessage {
  users: string[];
}

export interface ChatDisplayEntry {
  id: string;
  type: 'dice_roll' | 'card_draw' | 'text_message' | 'system' | 'user_joined' | 'user_left' | 'user_kicked' | 'admin_changed' | 'deck_reshuffled';
  nickname: string;
  timestamp: string;
  isSelf: boolean;
  result?: DiceResult;
  card?: CardInfo;
  remaining?: number;
  reshuffledNext?: boolean;
  text?: string;
  reason?: string;
  byNickname?: string;
  newAdminNickname?: string;
}
