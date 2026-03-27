import api from './api';
import type { Exchange } from '../types/celina3';

/**
 * Servis za upravljanje berzama.
 * FIXME: Backend mozda jos nije implementirao ove endpointove.
 */
const exchangeManagementService = {
  /**
   * GET /exchanges
   * Dohvata listu svih berzi.
   */
  getAll: async (): Promise<Exchange[]> => {
    const response = await api.get('/exchanges');
    return response.data;
  },

  /**
   * GET /exchanges/{acronym}
   * Dohvata detalje jedne berze po akronimu.
   */
  getByAcronym: async (acronym: string): Promise<Exchange> => {
    const response = await api.get(`/exchanges/${acronym}`);
    return response.data;
  },

  /**
   * PATCH /exchanges/{acronym}/test-mode
   * Ukljucuje ili iskljucuje test mod za berzu.
   */
  setTestMode: async (acronym: string, enabled: boolean): Promise<void> => {
    await api.patch(`/exchanges/${acronym}/test-mode`, { testMode: enabled });
  },
};

export default exchangeManagementService;
