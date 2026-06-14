import api from './api';

export interface HRInfoResponse {
  id: string;
  name: string;
  fatherName?: string;
  gender: string;
  dob: string; // format 'YYYY-MM-DD'
  maritialStatus?: string; // Spelling matches backend: maritialStatus
  cnic?: string;
  appointmentDate: string; // format 'YYYY-MM-DD'
  joiningDate: string; // format 'YYYY-MM-DD'
  designation?: string;
  salaryType: string;
  salary: number;
  leaveCharges: number;
  overtime: number;
  expenseAccount?: string;
  payableAccount?: string;
  createdBy?: string;
  createdOn?: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface HRInfoUpsertRequest {
  name: string;
  fatherName?: string;
  gender: string;
  dob: string; // format 'YYYY-MM-DD'
  maritialStatus?: string; // Spelling matches backend
  cnic?: string;
  appointmentDate: string; // format 'YYYY-MM-DD'
  joiningDate: string; // format 'YYYY-MM-DD'
  designation?: string;
  salaryType: string;
  salary: number;
  leaveCharges: number;
  overtime: number;
  expenseAccount?: string;
  payableAccount?: string;
}

export const hrInfoService = {
  async getHRInfos() {
    const response = await api.get('/api/hrinfo');
    return response.data.body as HRInfoResponse[];
  },

  async getById(id: string) {
    const response = await api.get(`/api/hrinfo/${id}`);
    return response.data.body as HRInfoResponse;
  },

  async create(data: HRInfoUpsertRequest) {
    const response = await api.post('/api/hrinfo', data);
    return response.data.body as string;
  },

  async update(id: string, data: HRInfoUpsertRequest) {
    const response = await api.put(`/api/hrinfo/${id}`, data);
    return response.data.body as string;
  },

  async delete(id: string) {
    const response = await api.delete(`/api/hrinfo/${id}`);
    return response.data.body as string;
  }
};
