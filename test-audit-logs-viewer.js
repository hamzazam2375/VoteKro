/**
 * Audit Logs Viewer - Test Suite
 * Tests the filtering, sorting, and display functionality of audit logs
 * 
 * Run with: node test-audit-logs-viewer.js
 */

const mockAuditLogs = [
  {
    id: '1',
    action: 'Admin created election',
    created_at: '2026-04-28T10:30:00Z',
    actor_id: 'admin-001',
    target_table: 'elections',
    target_id: 'election-1',
    metadata: { electionTitle: 'General Election 2026' },
  },
  {
    id: '2',
    action: 'Admin added candidate',
    created_at: '2026-04-28T10:35:00Z',
    actor_id: 'admin-001',
    target_table: 'candidates',
    target_id: 'candidate-1',
    metadata: { candidateName: 'John Doe', partyName: 'Party A' },
  },
  {
    id: '3',
    action: 'Vote cast',
    created_at: '2026-04-28T10:45:00Z',
    actor_id: null,
    target_table: 'vote_blocks',
    target_id: 'block-1',
    metadata: { blockIndex: 0, candidateId: 'candidate-1' },
  },
  {
    id: '4',
    action: 'Blockchain verified',
    created_at: '2026-04-28T11:00:00Z',
    actor_id: null,
    target_table: null,
    target_id: null,
    metadata: { isValid: true, blocksChecked: 1 },
  },
  {
    id: '5',
    action: 'Integrity check completed',
    created_at: '2026-04-28T11:15:00Z',
    actor_id: null,
    target_table: null,
    target_id: null,
    metadata: { status: 'success', checkDuration: '150ms' },
  },
  {
    id: '6',
    action: 'Admin updated election',
    created_at: '2026-04-28T11:30:00Z',
    actor_id: 'admin-001',
    target_table: 'elections',
    target_id: 'election-1',
    metadata: { fieldsUpdated: ['title', 'description'] },
  },
  {
    id: '7',
    action: 'Vote cast',
    created_at: '2026-04-28T11:45:00Z',
    actor_id: null,
    target_table: 'vote_blocks',
    target_id: 'block-2',
    metadata: { blockIndex: 1, candidateId: 'candidate-2' },
  },
];

// ============================================
// Filter Function (copied from AuditorService)
// ============================================

function filterAuditLogs(logs, type = null, searchText = null, startDate = null, endDate = null) {
  let filtered = logs;

  // Filter by type
  if (type) {
    filtered = filtered.filter((log) => {
      const action = log.action.toUpperCase();
      return (
        (type === 'ADMIN_ACTION' &&
          (action.includes('ADMIN') ||
            action.includes('CREATED') ||
            action.includes('ADDED') ||
            action.includes('UPDATED'))) ||
        (type === 'VOTE' && (action.includes('VOTE') || action.includes('CAST'))) ||
        (type === 'SYSTEM' &&
          (action.includes('VERIFIED') ||
            action.includes('CHECK') ||
            action.includes('BLOCKCHAIN') ||
            action.includes('INTEGRITY')))
      );
    });
  }

  // Filter by search text
  if (searchText) {
    const searchLower = searchText.toLowerCase();
    filtered = filtered.filter((log) => {
      const actionLower = log.action.toLowerCase();
      const metadataStr = JSON.stringify(log.metadata).toLowerCase();
      return actionLower.includes(searchLower) || metadataStr.includes(searchLower);
    });
  }

  // Filter by date range
  if (startDate) {
    const startTime = new Date(startDate).getTime();
    filtered = filtered.filter((log) => new Date(log.created_at).getTime() >= startTime);
  }

  if (endDate) {
    const endTime = new Date(endDate).getTime() + 86400000;
    filtered = filtered.filter((log) => new Date(log.created_at).getTime() <= endTime);
  }

  // Sort by timestamp descending
  return filtered.sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// ============================================
// Test Cases
// ============================================

function runTests() {
  let passedTests = 0;
  let failedTests = 0;

  function assert(testName, condition, expected, actual) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.log(`❌ FAIL: ${testName}`);
      console.log(`   Expected: ${expected}`);
      console.log(`   Actual: ${actual}`);
      failedTests++;
    }
  }

  console.log('\n📋 Running Audit Logs Viewer Tests\n');
  console.log('='.repeat(60));

  // Test 1: Filter by ADMIN_ACTION type
  console.log('\n📝 Test 1: Filter by ADMIN_ACTION type');
  const adminLogs = filterAuditLogs(mockAuditLogs, 'ADMIN_ACTION');
  assert(
    'Should return 3 admin actions',
    adminLogs.length === 3,
    3,
    adminLogs.length
  );
  assert(
    'All logs should be admin actions',
    adminLogs.every(
      (log) =>
        log.action.includes('Admin') ||
        log.action.includes('admin')
    ),
    true,
    adminLogs.every(
      (log) =>
        log.action.includes('Admin') ||
        log.action.includes('admin')
    )
  );

  // Test 2: Filter by VOTE type
  console.log('\n📝 Test 2: Filter by VOTE type');
  const voteLogs = filterAuditLogs(mockAuditLogs, 'VOTE');
  assert('Should return 2 vote logs', voteLogs.length === 2, 2, voteLogs.length);

  // Test 3: Filter by SYSTEM type
  console.log('\n📝 Test 3: Filter by SYSTEM type');
  const systemLogs = filterAuditLogs(mockAuditLogs, 'SYSTEM');
  assert(
    'Should return 2 system logs',
    systemLogs.length === 2,
    2,
    systemLogs.length
  );

  // Test 4: Search by keyword
  console.log('\n📝 Test 4: Search by keyword "election"');
  const electionLogs = filterAuditLogs(mockAuditLogs, null, 'election');
  assert(
    'Should find logs mentioning "election"',
    electionLogs.length >= 2,
    '>=2',
    electionLogs.length
  );

  // Test 5: Search in metadata
  console.log('\n📝 Test 5: Search in metadata "Party A"');
  const partyLogs = filterAuditLogs(mockAuditLogs, null, 'Party A');
  assert(
    'Should find logs with "Party A" in metadata',
    partyLogs.length === 1,
    1,
    partyLogs.length
  );

  // Test 6: Sort by timestamp (newest first)
  console.log('\n📝 Test 6: Sorting - newest first');
  const sortedLogs = filterAuditLogs(mockAuditLogs);
  const isSorted = sortedLogs.every((log, i) => {
    if (i === 0) return true;
    return (
      new Date(log.created_at).getTime() <=
      new Date(sortedLogs[i - 1].created_at).getTime()
    );
  });
  assert('Logs should be sorted by timestamp (newest first)', isSorted, true, isSorted);

  // Test 7: Filter by date range
  console.log('\n📝 Test 7: Filter by date range');
  const dateRangeLogs = filterAuditLogs(
    mockAuditLogs,
    null,
    null,
    '2026-04-28T10:30:00Z',
    '2026-04-28T11:00:00Z'
  );
  assert(
    'Should return logs within date range',
    dateRangeLogs.length >= 3,
    '>=3',
    dateRangeLogs.length
  );

  // Test 8: Combined filters
  console.log('\n📝 Test 8: Combined filters (ADMIN_ACTION + search "election")');
  const combinedLogs = filterAuditLogs(
    mockAuditLogs,
    'ADMIN_ACTION',
    'election'
  );
  assert(
    'Should return only admin actions mentioning election',
    combinedLogs.length === 2,
    2,
    combinedLogs.length
  );

  // Test 9: No results found
  console.log('\n📝 Test 9: No results with non-matching search');
  const noResultsLogs = filterAuditLogs(
    mockAuditLogs,
    null,
    'nonexistent_keyword_xyz'
  );
  assert(
    'Should return empty array for non-matching search',
    noResultsLogs.length === 0,
    0,
    noResultsLogs.length
  );

  // Test 10: All logs returned when no filters applied
  console.log('\n📝 Test 10: All logs returned when no filters applied');
  const allLogs = filterAuditLogs(mockAuditLogs);
  assert(
    'Should return all logs when no filters applied',
    allLogs.length === mockAuditLogs.length,
    mockAuditLogs.length,
    allLogs.length
  );

  // ============================================
  // Summary
  // ============================================

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Test Summary:`);
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   📈 Total:  ${passedTests + failedTests}`);
  console.log(
    `\n${failedTests === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed!'}\n`
  );

  return failedTests === 0;
}

// ============================================
// Display Example Data
// ============================================

function displayExamples() {
  console.log('\n' + '='.repeat(60));
  console.log('📚 Example Filtering Results\n');

  console.log('1️⃣  All ADMIN_ACTION logs:');
  const adminLogs = filterAuditLogs(mockAuditLogs, 'ADMIN_ACTION');
  console.table(adminLogs.map((log) => ({
    timestamp: log.created_at.substring(11, 19),
    action: log.action,
    actor: log.actor_id || 'System',
  })));

  console.log('\n2️⃣  All VOTE logs:');
  const voteLogs = filterAuditLogs(mockAuditLogs, 'VOTE');
  console.table(voteLogs.map((log) => ({
    timestamp: log.created_at.substring(11, 19),
    action: log.action,
    actor: log.actor_id || 'System',
  })));

  console.log('\n3️⃣  All SYSTEM logs:');
  const systemLogs = filterAuditLogs(mockAuditLogs, 'SYSTEM');
  console.table(systemLogs.map((log) => ({
    timestamp: log.created_at.substring(11, 19),
    action: log.action,
    actor: log.actor_id || 'System',
  })));

  console.log('\n4️⃣  Logs containing "election":');
  const searchLogs = filterAuditLogs(mockAuditLogs, null, 'election');
  console.table(searchLogs.map((log) => ({
    timestamp: log.created_at.substring(11, 19),
    action: log.action,
    type: log.action.includes('Admin')
      ? 'ADMIN'
      : log.action.includes('Vote')
        ? 'VOTE'
        : 'SYSTEM',
  })));
}

// ============================================
// Run Tests and Display Examples
// ============================================

if (require.main === module) {
  const testsPassed = runTests();
  displayExamples();
  process.exit(testsPassed ? 0 : 1);
}

module.exports = { filterAuditLogs, mockAuditLogs };
