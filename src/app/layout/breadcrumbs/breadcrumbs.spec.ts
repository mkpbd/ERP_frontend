import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { buildBreadcrumbs } from './breadcrumbs';

@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
class Outlet {}

@Component({ template: '' })
class Leaf {}

describe('buildBreadcrumbs', () => {
  it('builds the trail from route data, with URLs', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: Outlet,
            data: { breadcrumb: 'Home' },
            children: [
              {
                path: 'users',
                component: Outlet,
                data: { breadcrumb: 'Users' },
                children: [
                  { path: '', component: Leaf },
                  { path: ':id', component: Leaf, data: { breadcrumb: 'User details' } },
                ],
              },
            ],
          },
        ]),
      ],
    });
    const router = TestBed.inject(Router);
    TestBed.createComponent(Outlet);
    await router.navigateByUrl('/users/42');

    expect(buildBreadcrumbs(router.routerState.snapshot.root)).toEqual([
      { label: 'Home', url: '/' },
      { label: 'Users', url: '/users' },
      { label: 'User details', url: '/users/42' },
    ]);
  });
});
