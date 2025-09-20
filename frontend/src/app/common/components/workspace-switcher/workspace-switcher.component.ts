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

import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Workspace, WorkspaceScope} from '../../models/workspace.model';
import {WorkspaceService} from '../../../services/workspace/workspace.service';
import {WorkspaceStateService} from '../../../services/workspace/workspace-state.service';
import {CreateWorkspaceModalComponent} from '../create-workspace-modal/create-workspace-modal.component';
import {handleErrorSnackbar} from '../../../utils/handleErrorSnackbar';
import {
  InviteUserData,
  InviteUserModalComponent,
} from '../invite-user-modal/invite-user-modal.component';
import {UserService} from '../../services/user.service';
import {UserModel, UserRolesEnum} from '../../models/user.model';

@Component({
  selector: 'app-workspace-switcher',
  templateUrl: './workspace-switcher.component.html',
  styleUrls: ['./workspace-switcher.component.scss'],
})
export class WorkspaceSwitcherComponent implements OnInit {
  workspaces: Workspace[] = [];
  activeWorkspaceId: string | null = null;
  activeWorkspace: Workspace | null = null;
  currentUser: UserModel | null;
  public WorkspaceScope = WorkspaceScope;

  constructor(
    private workspaceService: WorkspaceService,
    private workspaceStateService: WorkspaceStateService,
    private userService: UserService,
    private route: ActivatedRoute,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {
    this.currentUser = this.userService.getUserDetails();
  }

  ngOnInit(): void {
    this.loadWorkspaces();
    this.workspaceStateService.activeWorkspaceId$.subscribe(id => {
      this.activeWorkspaceId = id;
      this.activeWorkspace = this.workspaces.find(w => w.id === id) || null;
    });
  }

  loadWorkspaces(): void {
    this.workspaceService.getWorkspaces().subscribe({
      next: workspaces => {
        this.workspaces = workspaces;
        this.activeWorkspace =
          this.workspaces.find(w => w.id === this.activeWorkspaceId) || null;
        this.initializeActiveWorkspace();
      },
      error: error => {
        handleErrorSnackbar(this.snackBar, error, 'Could not load workspaces');
      },
    });
  }

  initializeActiveWorkspace(): void {
    const queryParamId = this.route.snapshot.queryParamMap.get('workspaceId');
    if (queryParamId && this.workspaces.some(w => w.id === queryParamId)) {
      this.setActiveWorkspace(queryParamId);
      return;
    }

    const googleWorkspace = this.workspaces.find(
      w => w.scope === WorkspaceScope.PUBLIC,
    );
    if (googleWorkspace) {
      this.setActiveWorkspace(googleWorkspace.id);
      return;
    }

    if (this.workspaces.length > 0) {
      this.setActiveWorkspace(this.workspaces[0].id);
    }
  }

  setActiveWorkspace(workspaceId: string | null): void {
    this.workspaceStateService.setActiveWorkspaceId(workspaceId);
    this.activeWorkspace =
      this.workspaces.find(w => w.id === workspaceId) || null;
  }

  openCreateWorkspaceDialog(): void {
    const dialogRef = this.dialog.open(CreateWorkspaceModalComponent, {
      width: '300px',
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.createWorkspace(result);
      }
    });
  }

  createWorkspace(name: string): void {
    this.workspaceService.createWorkspace(name).subscribe({
      next: newWorkspace => {
        this.snackBar.open(`Workspace "${name}" created!`, 'OK', {
          duration: 3000,
        });
        this.workspaces.push(newWorkspace);
        this.setActiveWorkspace(newWorkspace.id);
      },
      error: error => {
        handleErrorSnackbar(this.snackBar, error, 'Could not create workspace');
      },
    });
  }

  get canInvite(): boolean {
    if (
      !this.currentUser ||
      !this.activeWorkspace ||
      this.activeWorkspace?.scope === WorkspaceScope.PUBLIC
    ) {
      return false;
    }
    const isOwner = this.currentUser.id === this.activeWorkspace.ownerId;
    const isAdmin = !!this.currentUser.roles?.includes(UserRolesEnum.ADMIN);
    return isOwner || isAdmin;
  }

  openInviteDialog(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.activeWorkspace) return;

    const dialogRef = this.dialog.open<
      InviteUserModalComponent,
      InviteUserData
    >(InviteUserModalComponent, {
      width: '350px',
      data: {workspaceName: this.activeWorkspace.name},
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && this.activeWorkspaceId) {
        this.workspaceService
          .inviteUser(this.activeWorkspaceId, result.email, result.role)
          .subscribe({
            next: () => {
              this.snackBar.open('Invitation sent!', 'OK', {duration: 3000});
            },
            error: error => {
              handleErrorSnackbar(
                this.snackBar,
                error,
                'Failed to send invitation',
              );
            },
          });
      }
    });
  }
}
