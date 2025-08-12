export interface UserModel {
  id?: number | string;
  name?: string;
  email: string;
  roles?: string[];
  picture?: string;
  createdAt?: string;
  updatedAt?: string;
}
