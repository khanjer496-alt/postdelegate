// the hooks file pulls in the fetch provider (a .tsx React module)
jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: jest.fn(),
}));

import { channelsToActOn } from '@gitroom/frontend/components/approvals/approvals.hooks';

describe('channelsToActOn', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  const later = '2026-11-02T12:00:00Z';
  const earlier = '2026-10-31T12:00:00Z';
  const siblings = [
    { id: 'waiting', state: 'DRAFT', approvalStatus: 'IN_REVIEW', publishDate: later },
    { id: 'sent_back', state: 'DRAFT', approvalStatus: 'CHANGES_REQUESTED', publishDate: later },
    { id: 'rejected', state: 'DRAFT', approvalStatus: 'REJECTED', publishDate: later },
    { id: 'draft', state: 'DRAFT', approvalStatus: 'NONE', publishDate: later },
    { id: 'approved', state: 'QUEUE', approvalStatus: 'APPROVED', publishDate: later },
    { id: 'going_out', state: 'QUEUE', approvalStatus: 'APPROVED', publishDate: earlier },
    { id: 'published', state: 'PUBLISHED', approvalStatus: 'IN_REVIEW', publishDate: earlier },
  ];
  const ids = (action: Parameters<typeof channelsToActOn>[1]) =>
    channelsToActOn(siblings, action, now).map((p) => p.id);

  it('approves and rejects every other channel still waiting', () => {
    expect(ids('approve')).toEqual(['waiting', 'sent_back']);
    expect(ids('reject')).toEqual(['waiting', 'sent_back']);
  });

  it('requests changes only on channels in review', () => {
    expect(ids('request_changes')).toEqual(['waiting']);
  });

  it('submits the channels that can go back to review', () => {
    expect(ids('submit')).toEqual(['sent_back', 'rejected', 'draft']);
  });

  it('shares every channel that has not gone out', () => {
    expect(ids('share')).toEqual([
      'waiting',
      'sent_back',
      'rejected',
      'draft',
      'approved',
    ]);
  });

  it('acts on nothing more for a single channel post', () => {
    expect(channelsToActOn([], 'approve', now)).toEqual([]);
  });
});
