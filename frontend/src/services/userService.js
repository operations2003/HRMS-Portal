import { http } from './api.js';

export const userService = {
  async listUsers() {
    const res = await http.get('/v1/users');
    return res.data;
  },

  async getUserById(id) {
    const res = await http.get(`/v1/users/${id}`);
    return res.data;
  },

  async createUser(data) {
    const res = await http.post('/v1/users', data);
    return res.data;
  },

  async updateUser(id, data) {
    const res = await http.put(`/v1/users/${id}`, data);
    return res.data;
  },

  async getRoles() {
    const res = await http.get('/v1/users/meta/roles');
    return res.data;
  },
};
