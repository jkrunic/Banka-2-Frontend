import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { gameScoreService } from './gameScoreService';
import api from './api';

describe('gameScoreService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submit() POSTs /games/scores sa DTO-em', async () => {
    const mockScore = { id: 1, clientId: 4, playerName: 'Ana', gameType: 'DINO', score: 5000, createdAt: '2026-05-14' };
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockScore });

    const result = await gameScoreService.submit({ gameType: 'DINO', score: 5000 });

    expect(api.post).toHaveBeenCalledWith('/games/scores', { gameType: 'DINO', score: 5000 });
    expect(result.score).toBe(5000);
  });

  it('leaderboard() salje type i limit query params', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });

    await gameScoreService.leaderboard('BANKA2_RUSH', 5);

    expect(api.get).toHaveBeenCalledWith('/games/leaderboard', {
      params: { type: 'BANKA2_RUSH', limit: 5 },
    });
  });

  it('leaderboard() default limit 10', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });

    await gameScoreService.leaderboard('CHESS');

    expect(api.get).toHaveBeenCalledWith('/games/leaderboard', {
      params: { type: 'CHESS', limit: 10 },
    });
  });

  it('myBest() salje type query param', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { score: 100 } });

    await gameScoreService.myBest('SOLITAIRE');

    expect(api.get).toHaveBeenCalledWith('/games/my-best', {
      params: { type: 'SOLITAIRE' },
    });
  });
});
