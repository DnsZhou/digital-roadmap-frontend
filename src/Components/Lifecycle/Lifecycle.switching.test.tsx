import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import * as api from '../../api';
import LifecycleTab from './Lifecycle';
import { createLifecycleDataLoader, loadLifecycleData } from './lifecycleData';

jest.mock('../../api');
jest.mock('../../utils/export', () => ({ exportData: jest.fn() }));
jest.mock('./lifecycleData', () => ({
  ...jest.requireActual('./lifecycleData'),
  loadLifecycleData: jest.fn(),
}));
jest.mock(
  '../LifecycleChart/LifecycleChart',
  () =>
    function MockAppStreamChart() {
      return <div>AppStream chart</div>;
    }
);
jest.mock(
  '../LifecycleChartSystem/LifecycleChartSystem',
  () =>
    function MockRhelChart() {
      return <div>RHEL chart</div>;
    }
);

if (!global.structuredClone) global.structuredClone = (value) => JSON.parse(JSON.stringify(value));

const stream = (major: number) => ({
  name: 'nodejs',
  display_name: `Node.js on RHEL ${major}`,
  application_stream_name: `Node.js ${major}`,
  os_major: major,
  os_minor: 0,
  start_date: '2020-01-01',
  end_date: '2040-01-01',
  support_status: 'Supported',
  count: major === 10 ? 0 : 10,
  related: false,
  systems_detail: [],
  rolling: false,
});
const system = {
  name: 'RHEL',
  display_name: 'RHEL 9.0',
  major: 9,
  minor: 0,
  lifecycle_type: 'mainline',
  start_date: '2020-01-01',
  end_date: '2040-01-01',
  support_status: 'Supported',
  count: 10,
  related: false,
  systems_detail: [],
};

describe('Lifecycle with real filters and table', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    const originalError = console.error;
    consoleError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (!String(args[0]).includes('not wrapped in act')) originalError(...args);
    });
    jest.clearAllMocks();
    jest.mocked(loadLifecycleData).mockImplementation(createLifecycleDataLoader());
    jest
      .mocked(api.getRelevantLifecycleAppstreams)
      .mockImplementation(async (major) => ({ data: major === 10 ? [] : [stream(major)] }));
    jest.mocked(api.getAllLifecycleAppstreams).mockImplementation(async (major) => ({ data: [stream(major)] }));
    jest.mocked(api.getRelevantLifecycleSystems).mockResolvedValue({ data: [system] });
    jest.mocked(api.getAllLifecycleSystems).mockResolvedValue({ data: [system] });
  });

  afterEach(() => consoleError.mockRestore());

  test.each([
    { legacyRoot: true, view: 'all', major: 10 },
    { legacyRoot: false, view: 'all', major: 10 },
    { legacyRoot: true, view: 'installed-only', major: 9 },
    { legacyRoot: false, view: 'installed-only', major: 9 },
  ])(
    'cached switching and empty RHEL10 fallback settle ($view, legacy: $legacyRoot)',
    async ({ legacyRoot, view, major }) => {
      const user = userEvent.setup();
      window.history.replaceState(
        null,
        '',
        `/?lifecycleDropdown=RHEL+${major}+Application+Streams&viewFilter=${view}`
      );
      render(
        <React.StrictMode>
          <BrowserRouter>
            <React.Suspense fallback={<div>Loading route</div>}>
              <LifecycleTab />
            </React.Suspense>
          </BrowserRouter>
        </React.StrictMode>,
        { legacyRoot }
      );
      await screen.findByText(`Node.js on RHEL ${major}`);
      let current = `RHEL ${major} Application Streams`;
      for (const selection of [
        'RHEL 9 Application Streams',
        'RHEL 8 Application Streams',
        'Red Hat Enterprise Linux',
        'RHEL 10 Application Streams',
        'RHEL 9 Application Streams',
        'RHEL 10 Application Streams',
      ]) {
        await act(async () => {
          await user.click(screen.getByRole('button', { name: current }));
        });
        await act(async () => {
          await user.click(screen.getByRole('option', { name: selection }));
        });
        current = selection;
        await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
        expect(new URLSearchParams(window.location.search).get('lifecycleDropdown')).toBe(selection);
      }
      expect(await screen.findByText('Node.js on RHEL 10')).toBeInTheDocument();
      expect(api.getRelevantLifecycleAppstreams).toHaveBeenCalledTimes(3);
      expect(api.getAllLifecycleAppstreams).toHaveBeenCalledTimes(3);
      expect(new URLSearchParams(window.location.search).get('viewFilter')).toBe('all');
      await act(async () => undefined);
      expect(
        consoleError.mock.calls.filter(([message]) =>
          /Cannot update a component|Maximum update depth|Too many re-renders/.test(String(message))
        )
      ).toEqual([]);
    },
    60000
  );
});
