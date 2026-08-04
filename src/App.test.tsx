import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the editor shell and loads the default station', async () => {
  const requestAnimationFrameSpy = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation(callback => {
      callback(0);
      return 0;
    });

  try {
    render(<App />);
    expect(screen.getByText(/ESP Editor/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Run PDF SOD/i)).toBeInTheDocument();
    expect(await screen.findByText('PTLP')).toBeInTheDocument();
  } finally {
    requestAnimationFrameSpy.mockRestore();
  }
});
