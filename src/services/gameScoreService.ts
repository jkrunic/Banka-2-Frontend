import api from './api';
import type { GameScore, GameType, SubmitScoreDto } from '@/types/games';

export const gameScoreService = {
  submit: async (dto: SubmitScoreDto): Promise<GameScore> => {
    const response = await api.post<GameScore>('/games/scores', dto);
    return response.data;
  },

  leaderboard: async (gameType: GameType, limit = 10): Promise<GameScore[]> => {
    const response = await api.get<GameScore[]>('/games/leaderboard', {
      params: { type: gameType, limit },
    });
    return response.data;
  },

  myBest: async (gameType: GameType): Promise<GameScore> => {
    const response = await api.get<GameScore>('/games/my-best', {
      params: { type: gameType },
    });
    return response.data;
  },
};
