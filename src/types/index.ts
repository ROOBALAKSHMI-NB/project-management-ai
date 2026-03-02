export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type OrgRole = 'owner' | 'admin' | 'member' | 'guest';
export type ProjectRole = 'manager' | 'contributor' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  role?: OrgRole;
  created_at: string;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'completed';
  created_by: string;
  role?: ProjectRole;
  member_count?: number;
  task_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string;
  due_date?: string;
  time_estimate?: number;
  position: number;
  assignees?: User[];
  dependencies?: string[];
  comment_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  parent_id?: string;
  content: string;
  user?: User;
  replies?: Comment[];
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message?: string;
  type: string;
  is_read: boolean;
  related_task_id?: string;
  created_at: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
