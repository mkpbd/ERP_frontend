import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { addDays, type OtBoard, toDay } from '../models/ot.models';
import { OtApi } from '../services/ot-api.service';
import { OtBoardStore } from './ot-board.store';

const stable = () => TestBed.inject(ApplicationRef).whenStable();

describe('OtBoardStore', () => {
  it("loads today's board, then the day moved to", async () => {
    const board = (day: string): OtBoard => ({
      day,
      rooms: [{ id: 'r1', name: 'OT-1', floor: null, cases: [] }],
      waiting: [],
    });
    const api = { board: vi.fn((day: string) => of(board(day))) };
    TestBed.configureTestingModule({ providers: [OtBoardStore, { provide: OtApi, useValue: api }] });
    const store = TestBed.inject(OtBoardStore);
    const today = toDay(new Date());

    await stable();
    expect(api.board).toHaveBeenLastCalledWith(today);
    expect(store.isToday()).toBe(true);
    expect(store.booked()).toBe(0);

    store.shift(1);
    await stable();
    expect(api.board).toHaveBeenLastCalledWith(addDays(today, 1));
    expect(store.board()?.day).toBe(addDays(today, 1));
    expect(store.isToday()).toBe(false);

    store.today();
    expect(store.day()).toBe(today);
  });
});
