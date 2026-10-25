import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createAuthStub } from '../../../testing/auth-stub';
import { HasPermissionDirective } from './has-permission.directive';

@Component({
  imports: [HasPermissionDirective],
  template: `
    <button *appHasPermission="'users:create'" id="single">Create</button>
    <button *appHasPermission="['roles:update', 'permissions:assign']" id="all">Edit</button>
  `,
})
class Host {}

describe('HasPermissionDirective', () => {
  it('renders content only while the user holds every required permission', async () => {
    const { stub, provider } = createAuthStub(['users:create', 'roles:update']);
    TestBed.configureTestingModule({ imports: [Host], providers: [provider] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('#single')).not.toBeNull();
    expect(element.querySelector('#all')).toBeNull();

    stub.setPermissions(['roles:update', 'permissions:assign']);
    await fixture.whenStable();
    expect(element.querySelector('#single')).toBeNull();
    expect(element.querySelector('#all')).not.toBeNull();
  });
});
