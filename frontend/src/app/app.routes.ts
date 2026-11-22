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
    path: 'ayuda',
    loadComponent: () => import('./components/help/help').then(m => m.HelpComponent),
  },
  {
    path: 'changelog',
    loadComponent: () =>
      import('./components/changelog/changelog').then(m => m.ChangelogComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
