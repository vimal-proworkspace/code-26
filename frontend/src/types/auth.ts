export type UserRole = 'ADMIN' | 'STUDENT';

export interface SafeUser {
  id: string;
  role: UserRole;
  username?: string;
  studentId?: string;
  name?: string;
  batch?: string;
}

export interface AuthResponse {
  status: 'success' | 'error';
  data?: {
    user: SafeUser;
  };
  message?: string;
}

export interface RegisterResponse {
  status: 'success' | 'error';
  data?: {
    studentId: string;
    fullName: string;
    batchNumber: string;
  };
  message?: string;
}
