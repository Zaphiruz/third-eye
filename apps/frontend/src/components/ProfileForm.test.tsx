import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileForm } from './ProfileForm';

// jsdom date inputs reject partial values, so set the whole date at once.
const setDate = (value: string) => fireEvent.change(screen.getByLabelText('Birth date'), { target: { value } });

describe('ProfileForm', () => {
  it('requires a birth date', async () => {
    const onSubmit = vi.fn(async () => {});
    render(<ProfileForm submitLabel="Begin" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Begin' }));
    expect(await screen.findByText(/birth date/i, { selector: '.field-error' })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a full payload with detected time zone and defaults', async () => {
    const onSubmit = vi.fn(async () => {});
    render(<ProfileForm submitLabel="Begin" onSubmit={onSubmit} />);
    setDate('1990-06-15');
    await userEvent.type(screen.getByLabelText(/full birth name/i), 'Ada Lovelace');
    await userEvent.selectOptions(screen.getByLabelText('Blood type'), 'AB');
    await userEvent.click(screen.getByRole('radio', { name: /The Trickster/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Begin' }));
    expect(onSubmit).toHaveBeenCalledWith({
      birthDate: '1990-06-15', fullName: 'Ada Lovelace', bloodType: 'AB', timeZone: expect.any(String), persona: 'TRICKSTER',
    });
  });

  it('maps "I don\'t know" blood type and a blank name to null', async () => {
    const onSubmit = vi.fn(async () => {});
    render(<ProfileForm submitLabel="Save" onSubmit={onSubmit}
      initial={{ birthDate: '1990-06-15', fullName: 'Ada', bloodType: 'A', timeZone: 'Europe/London', persona: 'MYSTIC' }} />);
    await userEvent.clear(screen.getByLabelText(/full birth name/i));
    await userEvent.selectOptions(screen.getByLabelText('Blood type'), '');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({
      birthDate: '1990-06-15', fullName: null, bloodType: null, timeZone: 'Europe/London', persona: 'MYSTIC',
    });
  });
});
