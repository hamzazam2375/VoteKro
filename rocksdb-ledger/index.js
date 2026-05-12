// RocksDB Ledger Demo API
// This is a minimal local demo server for testing RocksDB-based voting ledger
// In production, use the Supabase PostgreSQL database instead

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'RocksDB ledger API running', timestamp: new Date().toISOString() });
});

// Placeholder ledger endpoints
app.get('/api/ledger', (req, res) => {
  res.json({ message: 'RocksDB ledger API - ledger endpoint', data: [] });
});

app.post('/api/ledger/entry', (req, res) => {
  res.json({ success: true, message: 'Entry recorded to ledger' });
});

app.listen(PORT, () => {
  console.log(`RocksDB Ledger API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
