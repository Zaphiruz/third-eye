import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import type { MeDto } from '@third-eye/shared';
import { App } from '../App';
import { makeStore } from '../store';

export function renderApp(ui: ReactElement = <App />, { route = '/' }: { route?: string } = {}) {
  const store = makeStore();
  return { store, ...render(<Provider store={store}><MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter></Provider>) };
}

export const me = (over: Partial<MeDto> = {}): MeDto => ({
  user: { sub: 's1', name: 'Ada', email: 'a@x', isAdmin: false },
  profile: { birthDate: '1990-06-15', fullName: null, bloodType: null, timeZone: 'UTC', persona: 'CONFIDANT' },
  onboarded: true,
  ...over,
});
