import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import { paymentRecipientService } from './paymentRecipientService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('paymentRecipientService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== getAll ====================

  describe('getAll', () => {
    it('should return array when backend returns plain array', async () => {
      const recipients = [
        { id: 1, name: 'Marko', accountNumber: '111111111111111111' },
        { id: 2, name: 'Jovan', accountNumber: '222222222222222222' },
      ];
      mockedApi.get.mockResolvedValue({ data: recipients });

      const result = await paymentRecipientService.getAll();

      expect(mockedApi.get).toHaveBeenCalledWith('/payment-recipients');
      expect(result).toEqual(recipients);
    });

    it('should extract content when backend returns paginated response', async () => {
      const recipients = [
        { id: 1, name: 'Marko', accountNumber: '111111111111111111' },
      ];
      mockedApi.get.mockResolvedValue({ data: { content: recipients, totalElements: 1 } });

      const result = await paymentRecipientService.getAll();

      expect(result).toEqual(recipients);
    });

    it('should return empty array when data is null', async () => {
      mockedApi.get.mockResolvedValue({ data: null });

      const result = await paymentRecipientService.getAll();

      expect(result).toEqual([]);
    });

    it('should return empty array when data is undefined', async () => {
      mockedApi.get.mockResolvedValue({ data: undefined });

      const result = await paymentRecipientService.getAll();

      expect(result).toEqual([]);
    });

    it('should return empty array when data is an object without content', async () => {
      mockedApi.get.mockResolvedValue({ data: { something: 'else' } });

      const result = await paymentRecipientService.getAll();

      expect(result).toEqual([]);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Server error'));
      await expect(paymentRecipientService.getAll()).rejects.toThrow('Server error');
    });
  });

  // ==================== create ====================

  describe('create', () => {
    it('should create a new recipient', async () => {
      const newRecipient = { name: 'Novi Primalac', accountNumber: '444444444444444444', address: 'Beograd' };
      const created = { id: 10, ...newRecipient };
      mockedApi.post.mockResolvedValue({ data: created });

      const result = await paymentRecipientService.create(newRecipient);

      expect(mockedApi.post).toHaveBeenCalledWith('/payment-recipients', newRecipient);
      expect(result).toEqual(created);
    });

    it('should create recipient with minimal data', async () => {
      const newRecipient = { name: 'Minimal', accountNumber: '555555555555555555' };
      const created = { id: 11, ...newRecipient };
      mockedApi.post.mockResolvedValue({ data: created });

      const result = await paymentRecipientService.create(newRecipient);

      expect(result.id).toBe(11);
    });

    it('should propagate errors', async () => {
      mockedApi.post.mockRejectedValue(new Error('Validation error'));
      await expect(paymentRecipientService.create({ name: '', accountNumber: '' })).rejects.toThrow('Validation error');
    });
  });

  // ==================== update ====================

  describe('update', () => {
    it('should update an existing recipient', async () => {
      const updateData = { name: 'Updated Name' };
      const updated = { id: 5, name: 'Updated Name', accountNumber: '111111111111111111' };
      mockedApi.put.mockResolvedValue({ data: updated });

      const result = await paymentRecipientService.update(5, updateData);

      expect(mockedApi.put).toHaveBeenCalledWith('/payment-recipients/5', updateData);
      expect(result).toEqual(updated);
    });

    it('should propagate errors', async () => {
      mockedApi.put.mockRejectedValue(new Error('Update failed'));
      await expect(paymentRecipientService.update(5, { name: 'x' })).rejects.toThrow('Update failed');
    });
  });

  // ==================== delete ====================

  describe('delete', () => {
    it('should delete a recipient', async () => {
      mockedApi.delete.mockResolvedValue({ data: undefined });

      await paymentRecipientService.delete(5);

      expect(mockedApi.delete).toHaveBeenCalledWith('/payment-recipients/5');
    });

    it('should propagate errors', async () => {
      mockedApi.delete.mockRejectedValue(new Error('Delete failed'));
      await expect(paymentRecipientService.delete(999)).rejects.toThrow('Delete failed');
    });
  });
});
