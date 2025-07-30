import api from '../hooks/useAxios';
import { getAuthToken } from '../utils/authUtils';

export const createPermission = async (permissionsData) => {
  try {
    const token = getAuthToken();

    const response = await api.post('/permissions', permissionsData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Permission creation error:', error.response?.data || error);
    throw error.response?.data || new Error('Failed to create permission');
  }
};