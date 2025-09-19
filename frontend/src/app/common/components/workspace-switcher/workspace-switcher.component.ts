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
import {Workspace} from '../../models/workspace.model';
import {WorkspaceService} from '../../../services/workspace/workspace.service';
import {WorkspaceStateService} from '../../../services/workspace/workspace-state.service';
import {CreateWorkspaceModalComponent} from '../create-workspace-modal/create-workspace-modal.component';
import {handleErrorSnackbar} from '../../../utils/handleErrorSnackbar';

@Component({
  selector: 'app-workspace-switcher',
  templateUrl: './workspace-switcher.component.html',
  styleUrls: ['./workspace-switcher.component.scss'],
})
export class WorkspaceSwitcherComponent implements OnInit {
  workspaces: Workspace[] = [];
  activeWorkspaceId: string | null = null;

  constructor(
    private workspaceService: WorkspaceService,
    private workspaceStateService: WorkspaceStateService,
    private route: ActivatedRoute,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadWorkspaces();
    this.workspaceStateService.activeWorkspaceId$.subscribe(id => {
      this.activeWorkspaceId = id;
    });
  }

  loadWorkspaces(): void {
    this.workspaceService.getWorkspaces().subscribe({
      next: workspaces => {
        this.workspaces = workspaces;
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
      w => w.name === 'Google Workspace',
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
}

