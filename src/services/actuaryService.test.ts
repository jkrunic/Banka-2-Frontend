import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import actuaryService from './actuaryService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('actuaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== getAgents ====================

  describe('getAgents', () => {
    it('should fetch agents without filters', async () => {
      const agents = [
        { id: 1, employeeId: 10, employeeName: 'Agent 1', employeeEmail: 'agent1@banka.rs', employeePosition: 'Agent', actuaryType: 'AGENT', dailyLimit: 100000, usedLimit: 50000, needApproval: false },
      ];
      mockedApi.get.mockResolvedValue({ data: agents });

      const result = await actuaryService.getAgents();

      expect(mockedApi.get).toHaveBeenCalledWith('/actuaries/agents', { params: {} });
      expect(result).toEqual(agents);
    });

    it('should pass email filter', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await actuaryService.getAgents('agent@banka.rs');

      expect(mockedApi.get).toHaveBeenCalledWith('/actuaries/agents', {
        params: { email: 'agent@banka.rs' },
      });
    });

    it('should pass all filters', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await actuaryService.getAgents('agent@banka.rs', 'Marko', 'Petrovic');

      expect(mockedApi.get).toHaveBeenCalledWith('/actuaries/agents', {
        params: { email: 'agent@banka.rs', firstName: 'Marko', lastName: 'Petrovic' },
      });
    });

    it('should omit undefined filters', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await actuaryService.getAgents(undefined, 'Marko');

      expect(mockedApi.get).toHaveBeenCalledWith('/actuaries/agents', {
        params: { firstName: 'Marko' },
      });
    });

    it('should omit empty string filters', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await actuaryService.getAgents('', '', 'Petrovic');

      expect(mockedApi.get).toHaveBeenCalledWith('/actuaries/agents', {
        params: { lastName: 'Petrovic' },
      });
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Forbidden'));
      await expect(actuaryService.getAgents()).rejects.toThrow('Forbidden');
    });
  });

  // ==================== updateLimit ====================

  describe('updateLimit', () => {
    it('should update daily limit', async () => {
      const updated = { id: 1, employeeId: 10, dailyLimit: 200000, needApproval: false };
      mockedApi.patch.mockResolvedValue({ data: updated });

      const result = await actuaryService.updateLimit(10, { dailyLimit: 200000 });

      expect(mockedApi.patch).toHaveBeenCalledWith('/actuaries/10/limit', { dailyLimit: 200000 });
      expect(result).toEqual(updated);
    });

    it('should update needApproval', async () => {
      const updated = { id: 1, employeeId: 10, dailyLimit: 100000, needApproval: true };
      mockedApi.patch.mockResolvedValue({ data: updated });

      const result = await actuaryService.updateLimit(10, { needApproval: true });

      expect(mockedApi.patch).toHaveBeenCalledWith('/actuaries/10/limit', { needApproval: true });
      expect(result.needApproval).toBe(true);
    });

    it('should update both limit and needApproval', async () => {
      mockedApi.patch.mockResolvedValue({ data: { id: 1, dailyLimit: 300000, needApproval: true } });

      await actuaryService.updateLimit(10, { dailyLimit: 300000, needApproval: true });

      expect(mockedApi.patch).toHaveBeenCalledWith('/actuaries/10/limit', {
        dailyLimit: 300000,
        needApproval: true,
      });
    });

    it('should propagate errors', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Update failed'));
      await expect(actuaryService.updateLimit(10, { dailyLimit: -1 })).rejects.toThrow('Update failed');
    });
  });

  // ==================== resetLimit ====================

  describe('resetLimit', () => {
    it('should reset used limit', async () => {
      const reset = { id: 1, employeeId: 10, dailyLimit: 100000, usedLimit: 0 };
      mockedApi.patch.mockResolvedValue({ data: reset });

      const result = await actuaryService.resetLimit(10);

      expect(mockedApi.patch).toHaveBeenCalledWith('/actuaries/10/reset-limit');
      expect(result.usedLimit).toBe(0);
    });

    it('should propagate errors', async () => {
      mockedApi.patch.mockRejectedValue(new Error('Reset failed'));
      await expect(actuaryService.resetLimit(999)).rejects.toThrow('Reset failed');
    });
  });
});
