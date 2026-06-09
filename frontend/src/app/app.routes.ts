import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/lobby/lobby').then(m => m.LobbyComponent),
  },
  {
    path: 'room/:code',
    loadComponent: () => import('./components/room/room').then(m => m.RoomComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
