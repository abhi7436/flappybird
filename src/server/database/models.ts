/**
 * Mongoose schemas & models.
 *
 * Each schema's toJSON transform converts _id → id (as string)
 * and strips __v, keeping the rest of the codebase unaware of
 * MongoDB internals.
 */
import mongoose, { Schema, Document, Types } from 'mongoose';

// ── Shared transform ──────────────────────────────────────────
const toJSON = {
  virtuals: true,
  transform: (_doc: Document, ret: Record<string, unknown>) => {
    ret['id'] = ret['_id']?.toString();
    delete ret['_id'];
    delete ret['__v'];
  },
};

// ─────────────────────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────────────────────
export interface IUser extends Document {
  username: string;
  email: string;
  password_hash: string;
  avatar: string;
  high_score: number;
  elo_rating: number;
  games_played: number;
  is_online: boolean;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username:      { type: String, required: true, unique: true, trim: true, maxlength: 32 },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    avatar:        { type: String, default: '' },
    high_score:    { type: Number, default: 0 },
    elo_rating:    { type: Number, default: 1000, index: -1 },
    games_played:  { type: Number, default: 0 },
    is_online:     { type: Boolean, default: false },
    created_at:    { type: Date, default: () => new Date() },
    updated_at:    { type: Date, default: () => new Date() },
  },
  { toJSON, toObject: toJSON }
);

UserSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const UserModel = mongoose.model<IUser>('User', UserSchema);

// ─────────────────────────────────────────────────────────────
// FRIEND
// ─────────────────────────────────────────────────────────────
export interface IFriend extends Document {
  requester_id: Types.ObjectId;
  receiver_id: Types.ObjectId;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: Date;
  updated_at: Date;
}

const FriendSchema = new Schema<IFriend>(
  {
    requester_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiver_id:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status:       { type: String, enum: ['pending', 'accepted', 'blocked'], default: 'pending' },
    created_at:   { type: Date, default: () => new Date() },
    updated_at:   { type: Date, default: () => new Date() },
  },
  { toJSON, toObject: toJSON }
);

// Unique pair (regardless of direction) is enforced at the application level;
// this index speeds up directional lookups.
FriendSchema.index({ requester_id: 1, receiver_id: 1 }, { unique: true });
FriendSchema.index({ receiver_id: 1, status: 1 });

FriendSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const FriendModel = mongoose.model<IFriend>('Friend', FriendSchema);

// ─────────────────────────────────────────────────────────────
// GAME HISTORY
// ─────────────────────────────────────────────────────────────
export interface IGameHistory extends Document {
  user_id: Types.ObjectId;
  room_id: string;
  score: number;
  rank: number | null;
  duration_ms: number | null;
  elo_before: number | null;
  elo_after: number | null;
  elo_change: number | null;
  powerups_collected: Record<string, number>;
  total_players: number | null;
  tournament_match_id: Types.ObjectId | null;
  created_at: Date;
}

const GameHistorySchema = new Schema<IGameHistory>(
  {
    user_id:              { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    room_id:              { type: String, required: true },
    score:                { type: Number, required: true },
    rank:                 { type: Number, default: null },
    duration_ms:          { type: Number, default: null },
    elo_before:           { type: Number, default: null },
    elo_after:            { type: Number, default: null },
    elo_change:           { type: Number, default: null },
    powerups_collected:   { type: Schema.Types.Mixed, default: {} },
    total_players:        { type: Number, default: null },
    tournament_match_id:  { type: Schema.Types.ObjectId, ref: 'TournamentMatch', default: null },
    created_at:           { type: Date, default: () => new Date() },
  },
  { toJSON, toObject: toJSON }
);

GameHistorySchema.index({ score: -1 });

export const GameHistoryModel = mongoose.model<IGameHistory>('GameHistory', GameHistorySchema);

// ─────────────────────────────────────────────────────────────
// ROOM INVITE
// ─────────────────────────────────────────────────────────────
export interface IRoomInvite extends Document {
  room_id: string;
  invite_code: string;
  created_by: Types.ObjectId;
  expires_at: Date;
  created_at: Date;
}

const RoomInviteSchema = new Schema<IRoomInvite>(
  {
    room_id:     { type: String, required: true, index: true },
    invite_code: { type: String, required: true, unique: true },
    created_by:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expires_at:  { type: Date, required: true },
    created_at:  { type: Date, default: () => new Date() },
  },
  { toJSON, toObject: toJSON }
);

// TTL index — MongoDB auto-removes expired invite documents.
RoomInviteSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const RoomInviteModel = mongoose.model<IRoomInvite>('RoomInvite', RoomInviteSchema);

// ─────────────────────────────────────────────────────────────
// REPLAY
// ─────────────────────────────────────────────────────────────
export interface IReplay extends Document {
  room_id: string;
  user_id: Types.ObjectId;
  final_score: number;
  final_rank: number | null;
  duration_ms: number;
  seed: number;
  events: unknown[];
  canvas_width: number;
  canvas_height: number;
  engine_version: string;
  created_at: Date;
}

const ReplaySchema = new Schema<IReplay>(
  {
    room_id:        { type: String, required: true, index: true },
    user_id:        { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    final_score:    { type: Number, required: true, index: -1 },
    final_rank:     { type: Number, default: null },
    duration_ms:    { type: Number, required: true },
    seed:           { type: Number, required: true },
    events:         { type: [Schema.Types.Mixed], default: [] },
    canvas_width:   { type: Number, default: 400 },
    canvas_height:  { type: Number, default: 600 },
    engine_version: { type: String, default: '2' },
    created_at:     { type: Date, default: () => new Date() },
  },
  { toJSON, toObject: toJSON }
);

export const ReplayModel = mongoose.model<IReplay>('Replay', ReplaySchema);

// ─────────────────────────────────────────────────────────────
// SKIN  (string _id, e.g. "classic")
// ─────────────────────────────────────────────────────────────
export interface ISkin {
  _id: string;
  name: string;
  description: string | null;
  season: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlock_condition: string | null;
  color_body: string;
  color_wing: string;
  color_eye: string;
  color_beak: string;
  is_active: boolean;
  min_elo: number;
  created_at: Date;
}

const SkinSchema = new Schema<ISkin>(
  {
    _id:              { type: String },
    name:             { type: String, required: true },
    description:      { type: String, default: null },
    season:           { type: String, default: null },
    rarity:           { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
    unlock_condition: { type: String, default: null },
    color_body:       { type: String, default: '#FFD700' },
    color_wing:       { type: String, default: '#FFA500' },
    color_eye:        { type: String, default: '#FFFFFF' },
    color_beak:       { type: String, default: '#FF8C00' },
    is_active:        { type: Boolean, default: true },
    min_elo:          { type: Number, default: 0 },
    created_at:       { type: Date, default: () => new Date() },
  },
  {
    _id: false,    // we manage _id ourselves (string slug)
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: Record<string, unknown>) => {
        // For skins _id IS the string id, make id available too
        ret['id'] = ret['_id'];
        (ret as Record<string, any>)['__v'] = undefined;
      },
    },
  }
);

export const SkinModel = mongoose.model<ISkin>('Skin', SkinSchema);

// ── Seed skins if the collection is empty ──────────────────────
export async function seedSkins(): Promise<void> {
  if (await SkinModel.countDocuments() > 0) return;
  await SkinModel.insertMany([
    { _id: 'classic',  name: 'Classic',       description: 'The original yellow bird',       season: null,     rarity: 'common',    color_body: '#FFD700', color_wing: '#FFA500', color_eye: '#FFFFFF', color_beak: '#FF8C00' },
    { _id: 'spring',   name: 'Spring Blossom',description: 'Pink blooms for spring',          season: 'spring', rarity: 'rare',      color_body: '#FFB6C1', color_wing: '#FF69B4', color_eye: '#FFFFFF', color_beak: '#FF4500' },
    { _id: 'summer',   name: 'Beach Bird',    description: 'Cool shades for summer heat',     season: 'summer', rarity: 'rare',      color_body: '#00CED1', color_wing: '#20B2AA', color_eye: '#FFFFFF', color_beak: '#FF6347' },
    { _id: 'autumn',   name: 'Harvest',       description: 'Warm amber autumn plumage',       season: 'autumn', rarity: 'rare',      color_body: '#D2691E', color_wing: '#A0522D', color_eye: '#FFFFFF', color_beak: '#8B4513' },
    { _id: 'winter',   name: 'Frosty',        description: 'Icy blue winter feathers',        season: 'winter', rarity: 'rare',      color_body: '#B0E0E6', color_wing: '#87CEEB', color_eye: '#FFFFFF', color_beak: '#4169E1' },
    { _id: 'champion', name: 'Champion',      description: 'Gold champion bird — top 1%',     season: null,     rarity: 'legendary', color_body: '#FFD700', color_wing: '#DAA520', color_eye: '#FF0000', color_beak: '#B8860B' },
    { _id: 'neon',     name: 'Neon',          description: 'Electric neon glow — rare find',  season: null,     rarity: 'epic',      color_body: '#39FF14', color_wing: '#00FF7F', color_eye: '#FFFFFF', color_beak: '#FF1493' },
    { _id: 'midnight', name: 'Midnight',      description: 'Dark mysterious midnight bird',   season: null,     rarity: 'epic',      color_body: '#191970', color_wing: '#000080', color_eye: '#AAAAFF', color_beak: '#4169E1' },
  ]);
  console.log('[DB] Seeded default skins');
}

// ─────────────────────────────────────────────────────────────
// USER SKIN (ownership)
// ─────────────────────────────────────────────────────────────
export interface IUserSkin extends Document {
  user_id: Types.ObjectId;
  skin_id: string;
  unlocked_at: Date;
  is_equipped: boolean;
}

const UserSkinSchema = new Schema<IUserSkin>(
  {
    user_id:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    skin_id:     { type: String, ref: 'Skin', required: true },
    unlocked_at: { type: Date, default: () => new Date() },
    is_equipped: { type: Boolean, default: false },
  },
  { toJSON, toObject: toJSON }
);

UserSkinSchema.index({ user_id: 1, skin_id: 1 }, { unique: true });
UserSkinSchema.index({ user_id: 1 });

export const UserSkinModel = mongoose.model<IUserSkin>('UserSkin', UserSkinSchema);

// ─────────────────────────────────────────────────────────────
// TOURNAMENT
// ─────────────────────────────────────────────────────────────
export interface ITournament extends Document {
  name: string;
  description: string | null;
  status: 'registration' | 'active' | 'completed' | 'cancelled';
  bracket_type: 'single_elimination' | 'round_robin';
  max_participants: number;
  rounds_total: number;
  current_round: number;
  prize_info: string | null;
  created_by: Types.ObjectId;
  starts_at: Date;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const TournamentSchema = new Schema<ITournament>(
  {
    name:             { type: String, required: true, maxlength: 128 },
    description:      { type: String, default: null },
    status:           { type: String, enum: ['registration', 'active', 'completed', 'cancelled'], default: 'registration', index: true },
    bracket_type:     { type: String, enum: ['single_elimination', 'round_robin'], default: 'single_elimination' },
    max_participants: { type: Number, default: 16 },
    rounds_total:     { type: Number, default: 4 },
    current_round:    { type: Number, default: 0 },
    prize_info:       { type: String, default: null },
    created_by:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    starts_at:        { type: Date, required: true, index: true },
    ended_at:         { type: Date, default: null },
    created_at:       { type: Date, default: () => new Date() },
    updated_at:       { type: Date, default: () => new Date() },
  },
  { toJSON, toObject: toJSON }
);

TournamentSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const TournamentModel = mongoose.model<ITournament>('Tournament', TournamentSchema);

// ─────────────────────────────────────────────────────────────
// TOURNAMENT PARTICIPANT
// ─────────────────────────────────────────────────────────────
export interface ITournamentParticipant extends Document {
  tournament_id: Types.ObjectId;
  user_id: Types.ObjectId;
  elo_at_entry: number;
  seed: number | null;
  eliminated_round: number | null;
  final_placement: number | null;
  created_at: Date;
}

const TournamentParticipantSchema = new Schema<ITournamentParticipant>(
  {
    tournament_id:     { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    user_id:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
    elo_at_entry:      { type: Number, default: 1000 },
    seed:              { type: Number, default: null },
    eliminated_round:  { type: Number, default: null },
    final_placement:   { type: Number, default: null },
    created_at:        { type: Date, default: () => new Date() },
  },
  { toJSON, toObject: toJSON }
);

TournamentParticipantSchema.index({ tournament_id: 1, user_id: 1 }, { unique: true });
TournamentParticipantSchema.index({ tournament_id: 1 });

export const TournamentParticipantModel = mongoose.model<ITournamentParticipant>(
  'TournamentParticipant',
  TournamentParticipantSchema
);

// ─────────────────────────────────────────────────────────────
// TOURNAMENT MATCH
// ─────────────────────────────────────────────────────────────
export interface ITournamentMatch extends Document {
  tournament_id: Types.ObjectId;
  round_number: number;
  match_number: number;
  room_id: string | null;
  player1_id: Types.ObjectId | null;
  player2_id: Types.ObjectId | null;
  winner_id: Types.ObjectId | null;
  player1_score: number | null;
  player2_score: number | null;
  status: 'pending' | 'active' | 'completed' | 'bye';
  scheduled_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

const TournamentMatchSchema = new Schema<ITournamentMatch>(
  {
    tournament_id: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    round_number:  { type: Number, required: true },
    match_number:  { type: Number, required: true },
    room_id:       { type: String, default: null, index: true },
    player1_id:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
    player2_id:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
    winner_id:     { type: Schema.Types.ObjectId, ref: 'User', default: null },
    player1_score: { type: Number, default: null },
    player2_score: { type: Number, default: null },
    status:        { type: String, enum: ['pending', 'active', 'completed', 'bye'], default: 'pending' },
    scheduled_at:  { type: Date, default: null },
    completed_at:  { type: Date, default: null },
    created_at:    { type: Date, default: () => new Date() },
  },
  { toJSON, toObject: toJSON }
);

export const TournamentMatchModel = mongoose.model<ITournamentMatch>(
  'TournamentMatch',
  TournamentMatchSchema
);

// ─────────────────────────────────────────────────────────────
// DEVICE TOKEN (push notifications)
// ─────────────────────────────────────────────────────────────
export interface IDeviceToken extends Document {
  user_id: Types.ObjectId;
  token: string;
  platform: 'expo' | 'apns' | 'fcm';
  created_at: Date;
  updated_at: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    user_id:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token:      { type: String, required: true },
    platform:   { type: String, enum: ['expo', 'apns', 'fcm'], default: 'expo' },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  { toJSON, toObject: toJSON }
);

DeviceTokenSchema.index({ user_id: 1, token: 1 }, { unique: true });
DeviceTokenSchema.index({ user_id: 1 });

DeviceTokenSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const DeviceTokenModel = mongoose.model<IDeviceToken>('DeviceToken', DeviceTokenSchema);
