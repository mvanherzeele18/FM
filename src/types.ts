export type LeagueId = 'first' | 'secondA' | 'secondB'
export type Position = 'GK' | 'DEF' | 'MID' | 'ATT'
export type Player = {
  id: string; name: string; age: number; position: Position; rating: number;
  stamina: number; morale: number; value: number; wage: number; goals: number; starter: boolean
}
export type Club = {
  id: string; name: string; league: LeagueId; isBot: boolean; manager: string;
  points: number; played: number; wins: number; draws: number; losses: number;
  gf: number; ga: number; cash: number; stadium: number; players: Player[]
}
export type GameState = {
  season: number; clubId: string; clubs: Club[]; matchday: number;
  lastPlayedAt?: number; transferLog: string[]; trainingLog: string[]
}
export type MatchEvent = { minute: number; text: string; type: 'goal' | 'chance' | 'info' }
export type MatchState = {
  homeId: string; awayId: string; startedAt: number; elapsed: number;
  homeGoals: number; awayGoals: number; events: MatchEvent[]; finished: boolean
}