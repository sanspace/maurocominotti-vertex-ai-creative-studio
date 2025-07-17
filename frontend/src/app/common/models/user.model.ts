/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {DocumentData} from '@angular/fire/firestore';

export interface UserData extends DocumentData {
  uid: string;
  email: string;
  photoURL: string;
  displayName: string;
  domain: string;
  role: string;
  appRole: string;
  organizationName: string;
  organizationKey: string;
}

export interface OrgUser extends DocumentData {
  userId: string;
  email: string;
  domain: string;
  role?: string;
  appRole?: string;
  status: string;
  organizationName?: string;
  organizationKey?: string;
}

interface Selection {
  value: string;
  viewValue: string;
}

export const APP_ROLES: Selection[] = [
  {value: 'user', viewValue: 'User'},
  {value: 'super_admin', viewValue: 'Super Admin'},
  {value: 'org_admin', viewValue: 'Org Admin'},
];

export const ROLES: Selection[] = [
  {value: 'Practice Lead', viewValue: 'Practice Lead'},
  {value: 'Practitioner', viewValue: 'Practitioner'},
];

export const DRP_PRACTICE_LEAD_ROLES: string[] = [
  'Resource Manager',
  'Partner SPOC',
  'Google Admin',
  'Google Super Admin',
];
export const DRP_PRACTITIONER_ROLES: string[] = [
  'Partner User',
  'Partner Individual',
];
