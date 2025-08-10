import api from '../hooks/useAxios';
import { getAuthToken } from '../utils/authUtils';
// Get all topics
export const getTopics = async (data) => {
  try {
    const token = getAuthToken();
    const response = await api.get(`/topics/all?subdomain=${data.subdomain}`, { // Changed to GET request and passing subdomain as query parameter
                  headers: { Authorization: `Bearer ${token}` }
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Topics Fetch Error:', error);
    throw error.response ? error.response.data : new Error('Failed to fetch topics')
  }
};
// Create new topic
export const createTopic = async (topicData) => {
  try {
    const token = getAuthToken();
    const response = await api.post('/topics', topicData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Failed to create topic');
  }
};

// Update topic
export const updateTopic = async (id, topicData, subdomain) => { 
  try {
    const token = getAuthToken();
    const response = await api.put(`/topics/${id}`, { ...topicData, subdomain }, {
            headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Failed to update topic');
  }
};

// Delete topic
export const deleteTopic = async (id, subdomain) => {
  try {
    const token = getAuthToken();
    const response = await api.delete(`/topics/${id}?subdomain=${subdomain}`, { // Passed subdomain as query param
           headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : new Error('Failed to delete topic');
  }
};

export const addSubtopicToTopic = async (topicId, subtopicData, subdomain) => {
    try {
      const token = getAuthToken();
      const response = await api.put(`/topics/${topicId}/subtopic`, { 
              ...subtopicData, 
              subdomain 
            }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : new Error('Failed to add sub-topic');
    }
  };
  
  // New function: Update a sub-topic
  export const updateSubtopic = async (topicId, subtopicId, subtopicData, subdomain) => {
    try {
      const token = getAuthToken();
      const response = await api.put(`/topics/${topicId}/subtopic/${subtopicId}`, { ...subtopicData, subdomain }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : new Error('Failed to update sub-topic');
    }
  };
  
 // NEW FUNCTION: Delete a sub-topic from an existing topic
// MODIFIED: This function deletes a specific subtopic.
export const deleteSubtopic = async (topicId, subtopicId, subdomain) => {
    try {
      const token = getAuthToken();
      // MODIFIED: Use the correct DELETE endpoint for a specific subtopic.
      // Pass subdomain as a query parameter for authorization.
      const response = await api.delete(`/topics/${topicId}/subtopic/${subtopicId}?subdomain=${subdomain}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : new Error('Failed to delete sub-topic');
    }
  };
