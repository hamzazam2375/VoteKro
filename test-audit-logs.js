/**
 * Sample Audit Logs Test Data
 * Used for testing and demoing the Audit Logs Viewer feature
 * Run this file to generate mock audit logs in the database
 */

const mockAuditLogs = [
  {
    action: 'Admin created election',
    timestamp: '2026-04-28T10:30:00Z',
    type: 'ADMIN_ACTION',
    performedBy: 'Admin',
  },
  {
    action: 'Admin added candidate',
    timestamp: '2026-04-28T10:35:00Z',
    type: 'ADMIN_ACTION',
    performedBy: 'Admin',
  },
  {
    action: 'Vote cast at 10:45 AM',
    timestamp: '2026-04-28T10:45:00Z',
    type: 'VOTE',
    performedBy: 'Voter',
  },
  {
    action: 'Blockchain verified',
    timestamp: '2026-04-28T11:00:00Z',
    type: 'SYSTEM',
    performedBy: 'System',
  },
  {
    action: 'Integrity check completed',
    timestamp: '2026-04-28T11:15:00Z',
    type: 'SYSTEM',
    performedBy: 'System',
  },
  {
    action: 'Admin updated election',
    timestamp: '2026-04-28T11:30:00Z',
    type: 'ADMIN_ACTION',
    performedBy: 'Admin',
  },
  {
    action: 'Vote cast at 11:45 AM',
    timestamp: '2026-04-28T11:45:00Z',
    type: 'VOTE',
    performedBy: 'Voter',
  },
  {
    action: 'Vote cast at 12:00 PM',
    timestamp: '2026-04-28T12:00:00Z',
    type: 'VOTE',
    performedBy: 'Voter',
  },
  {
    action: 'Admin opened voting',
    timestamp: '2026-04-28T09:00:00Z',
    type: 'ADMIN_ACTION',
    performedBy: 'Admin',
  },
  {
    action: 'Election published',
    timestamp: '2026-04-28T12:30:00Z',
    type: 'SYSTEM',
    performedBy: 'System',
  },
  {
    action: 'Vote cast at 01:15 PM',
    timestamp: '2026-04-28T13:15:00Z',
    type: 'VOTE',
    performedBy: 'Voter',
  },
  {
    action: 'Admin closed election',
    timestamp: '2026-04-28T14:00:00Z',
    type: 'ADMIN_ACTION',
    performedBy: 'Admin',
  },
];

module.exports = mockAuditLogs;

/**
 * How to use this test data:
 * 
 * 1. Import the mock data in a test file:
 *    import mockAuditLogs from './test-audit-logs.js';
 * 
 * 2. Use with the AuditorService filtering function:
 *    const auditorService = serviceFactory.auditorService;
 *    const filtered = auditorService.filterAuditLogs(
 *      mockAuditLogs,
 *      'ADMIN_ACTION',  // type
 *      'election',      // searchText
 *      null,            // startDate
 *      null             // endDate
 *    );
 * 
 * 3. Expected filtering examples:
 *    - By type: Filter for ADMIN_ACTION, VOTE, or SYSTEM logs
 *    - By search: Filter for logs containing specific keywords
 *    - By date: Filter for logs within a specific date range
 *    - Combined: All filters can be used together
 * 
 * 4. Test cases to implement:
 *    ✓ Filter by type (ADMIN_ACTION, VOTE, SYSTEM)
 *    ✓ Search by keyword
 *    ✓ Filter by date range
 *    ✓ Sorting (newest first)
 *    ✓ No results found
 *    ✓ Pagination (first 10 logs)
 *    ✓ Highlighting (ADMIN=Blue, VOTE=Green, SYSTEM=Gray)
 */
