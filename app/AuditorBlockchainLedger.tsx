import React, { useEffect, useState } from "react";
import { Table, Button, Modal, Select, Card, Spin, Alert, Collapse, Input, Tag, Space, Tooltip, Divider, Empty } from "antd";
import { CopyOutlined, ExpandOutlined, LinkOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { serviceFactory } from "@/class/service-factory";
import type { ElectionRow } from "@/class/database-types";

interface VoteBlock {
  id: string;
  election_id: string;
  voter_id: string | null;
  block_index: number;
  encrypted_vote: string;
  vote_commitment: string;
  previous_hash: string;
  current_hash: string;
  created_at: string;
}

interface BlockChainMetrics {
  totalBlocks: number;
  isValid: boolean;
  invalidAt: number | null;
  reason: string | null;
}

const AuditorBlockchainLedger: React.FC = () => {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const [blocks, setBlocks] = useState<VoteBlock[]>([]);
  const [elections, setElections] = useState<ElectionRow[]>([]);
  const [selectedElection, setSelectedElection] = useState<string>(
    (searchParams?.electionId as string) || ""
  );
  const [selectedBlock, setSelectedBlock] = useState<VoteBlock | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [electionsLoading, setElectionsLoading] = useState(true);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voterNameMap, setVoterNameMap] = useState<Record<string, string>>({});
  const [searchBlockId, setSearchBlockId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "chain">("chain");
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<BlockChainMetrics>({
    totalBlocks: 0,
    isValid: false,
    invalidAt: null,
    reason: null,
  });
  const rocksDbUrl = process.env.EXPO_PUBLIC_ROCKSDB_LEDGER_URL || "http://localhost:8787";

  // Fetch elections from database
  useEffect(() => {
    const fetchElections = async () => {
      try {
        setElectionsLoading(true);
        const allElections = await serviceFactory.electionRepository.listAll();
        
        if (allElections && allElections.length > 0) {
          setElections(allElections);
          
          if (!selectedElection) {
            setSelectedElection(allElections[0].id);
          }
        } else {
          setError("No elections found in the system.");
        }
      } catch (err) {
        console.error("Failed to fetch elections:", err);
        setError(`Failed to load elections: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setElectionsLoading(false);
      }
    };

    fetchElections();
  }, []);

  // Fetch voter names for the current blocks
  useEffect(() => {
    if (!selectedElection || blocks.length === 0) return;

    const fetchVoterNames = async () => {
      try {
        const nameMap: Record<string, string> = {};
        const voterIds = Array.from(new Set(blocks.map(b => b.voter_id).filter(Boolean))) as string[];
        
        for (const voterId of voterIds) {
          try {
            const profile = await serviceFactory.profileRepository.getByUserId(voterId);
            if (profile) {
              nameMap[voterId] = profile.full_name;
            } else {
              nameMap[voterId] = voterId.substring(0, 8);
            }
          } catch (err) {
            console.error(`Failed to fetch profile for voter ${voterId}:`, err);
            nameMap[voterId] = voterId.substring(0, 8);
          }
        }
        
        setVoterNameMap(nameMap);
      } catch (err) {
        console.error("Failed to fetch voter names:", err);
      }
    };

    fetchVoterNames();
  }, [selectedElection, blocks]);

  // Fetch blockchain ledger for selected election
  useEffect(() => {
    if (!selectedElection) return;

    const fetchBlockchain = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(`Fetching ledger for election: ${selectedElection}`);
        
        const response = await fetch(
          `${rocksDbUrl}/ledger/${encodeURIComponent(selectedElection)}`
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch ledger (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`Received ${data?.length || 0} blocks`);
        setBlocks(data || []);

        // Verify chain integrity
        try {
          const verifyResponse = await fetch(
            `${rocksDbUrl}/verify-chain/${encodeURIComponent(selectedElection)}`
          );
          
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            setChainValid(verifyData.is_valid);
            setMetrics({
              totalBlocks: data?.length || 0,
              isValid: verifyData.is_valid,
              invalidAt: verifyData.invalid_block_index,
              reason: verifyData.reason,
            });
            
            if (!verifyData.is_valid) {
              setError(`⚠️ Blockchain compromised at block ${verifyData.invalid_block_index}: ${verifyData.reason}`);
            }
          }
        } catch (verifyError) {
          console.error("Chain verification error:", verifyError);
        }
      } catch (err) {
        console.error("Failed to fetch blockchain:", err);
        const errorMsg = err instanceof Error 
          ? err.message 
          : typeof err === 'object' && err !== null && 'message' in err 
            ? String(err.message)
            : "Failed to fetch blockchain ledger";
        setError(errorMsg);
        setBlocks([]);
        setChainValid(false);
      } finally {
        setLoading(false);
      }
    };

    fetchBlockchain();
  }, [selectedElection, rocksDbUrl]);

  const handleViewDetails = (block: VoteBlock) => {
    setSelectedBlock(block);
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setSelectedBlock(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  // Filter blocks based on search
  const filteredBlocks = blocks.filter((block) => {
    if (!searchBlockId) return true;
    return (
      block.block_index.toString().includes(searchBlockId) ||
      block.current_hash.includes(searchBlockId) ||
      block.previous_hash.includes(searchBlockId)
    );
  });

  // Table columns
  const tableColumns = [
    {
      title: "Block #",
      dataIndex: "block_index",
      key: "block_index",
      width: 80,
      render: (text: number) => <strong>#{text}</strong>,
    },
    {
      title: "Voter",
      dataIndex: "voter_id",
      key: "voter_id",
      width: 150,
      render: (voterId: string | null) => {
        if (!voterId) return <Tag>Unknown</Tag>;
        return <Tag color="blue">{voterNameMap[voterId] || voterId.substring(0, 12)}</Tag>;
      },
    },
    {
      title: "Timestamp",
      dataIndex: "created_at",
      key: "created_at",
      render: (text: string) => new Date(text).toLocaleString(),
      width: 180,
    },
    {
      title: "Chain Link",
      key: "chainLink",
      width: 80,
      render: (_: any, record: VoteBlock, index: number) => {
        if (index < blocks.length - 1) {
          const nextBlock = blocks[index + 1];
          const isLinked = nextBlock.previous_hash === record.current_hash;
          return (
            <Tooltip title={isLinked ? "Linked correctly" : "⚠️ Chain broken!"}>
              {isLinked ? (
                <LinkOutlined style={{ color: "#52c41a", fontSize: "16px" }} />
              ) : (
                <ExclamationCircleOutlined style={{ color: "#ff4d4f", fontSize: "16px" }} />
              )}
            </Tooltip>
          );
        }
        return <Tag>End</Tag>;
      },
    },
    {
      title: "Vote Hash",
      dataIndex: "vote_commitment",
      key: "vote_commitment",
      render: (text: string) => (
        <Tooltip title={text}>
          <Space>
            <code style={{ fontSize: "11px" }}>{text.substring(0, 12)}...</code>
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(text)}
            />
          </Space>
        </Tooltip>
      ),
    },
    {
      title: "Current Hash",
      dataIndex: "current_hash",
      key: "current_hash",
      render: (text: string) => (
        <Tooltip title={text}>
          <Space>
            <code style={{ fontSize: "11px" }}>{text.substring(0, 12)}...</code>
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(text)}
            />
          </Space>
        </Tooltip>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: any, record: VoteBlock) => (
        <Button
          type="primary"
          size="small"
          icon={<ExpandOutlined />}
          onClick={() => handleViewDetails(record)}
        >
          Details
        </Button>
      ),
    },
  ];

  // Chain view component
  const ChainVisualization = () => (
    <div style={{ overflowX: "auto", padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minWidth: "100%" }}>
        {filteredBlocks.map((block, index) => (
          <React.Fragment key={block.id}>
            <Card
              style={{
                minWidth: "150px",
                cursor: "pointer",
                borderColor: metrics.invalidAt === block.block_index ? "#ff4d4f" : 
                           chainValid ? "#52c41a" : "#faad14",
                borderWidth: "2px",
                backgroundColor: metrics.invalidAt === block.block_index ? "#fff1f0" : "white",
              }}
              onClick={() => handleViewDetails(block)}
              hoverable
            >
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 8px 0", fontWeight: "bold", fontSize: "14px" }}>Block #{block.block_index}</p>
                <Divider style={{ margin: "8px 0" }} />
                <p style={{ margin: "4px 0", fontSize: "12px" }}>
                  <strong>Voter:</strong>
                </p>
                <p style={{ margin: "0 0 8px 0", fontSize: "11px" }}>
                  {voterNameMap[block.voter_id || ""] || block.voter_id?.substring(0, 8) || "Unknown"}
                </p>
                <p style={{ margin: "4px 0", fontSize: "12px" }}>
                  <strong>Hash:</strong>
                </p>
                <code style={{ fontSize: "10px" }}>{block.current_hash.substring(0, 8)}...</code>
                <p style={{ margin: "8px 0 0 0", fontSize: "10px", color: "#666" }}>
                  {new Date(block.created_at).toLocaleTimeString()}
                </p>
              </div>
            </Card>
            {index < filteredBlocks.length - 1 && (
              <div style={{ fontSize: "20px", color: chainValid ? "#52c41a" : "#faad14" }}>→</div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: "20px", backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <LinkOutlined /> Blockchain Ledger - Auditor View
      </h1>

      {/* Election Selection */}
      <Card style={{ marginBottom: "20px" }}>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
            Select Election:
          </label>
          <Spin spinning={electionsLoading}>
            <Select
              placeholder="Loading elections..."
              value={selectedElection}
              onChange={setSelectedElection}
              style={{ width: "100%", maxWidth: "400px" }}
            >
              {elections.map((election) => (
                <Select.Option key={election.id} value={election.id}>
                  {election.title} ({election.status})
                </Select.Option>
              ))}
            </Select>
          </Spin>
        </div>
      </Card>

      {/* Blockchain Status Metrics */}
      {selectedElection && blocks.length > 0 && (
        <Card style={{ marginBottom: "20px", backgroundColor: chainValid ? "#f6ffed" : "#fff7e6" }}>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: "0 0 5px 0", color: "#666" }}>Total Blocks:</p>
              <p style={{ margin: "0", fontSize: "18px", fontWeight: "bold" }}>{metrics.totalBlocks}</p>
            </div>
            <div>
              <p style={{ margin: "0 0 5px 0", color: "#666" }}>Chain Status:</p>
              <p style={{ margin: "0", fontSize: "18px", fontWeight: "bold" }}>
                {chainValid ? (
                  <span style={{ color: "#52c41a" }}>
                    <CheckCircleOutlined /> Valid
                  </span>
                ) : (
                  <span style={{ color: "#ff4d4f" }}>
                    <ExclamationCircleOutlined /> Invalid
                  </span>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Alert
          message="⚠️ Alert"
          description={error}
          type={error.includes("compromised") ? "error" : "warning"}
          closable
          style={{ marginBottom: "20px" }}
          onClose={() => setError(null)}
        />
      )}

      {/* Chain Validity Alert */}
      {selectedElection && chainValid === true && !error && (
        <Alert
          message="✓ Blockchain is Valid and Tamper-Proof"
          description="All blocks are properly linked and hashes are valid."
          type="success"
          style={{ marginBottom: "20px" }}
          icon={<CheckCircleOutlined />}
        />
      )}

      {/* Search and View Mode */}
      {selectedElection && blocks.length > 0 && (
        <Card style={{ marginBottom: "20px" }}>
          <Space>
            <Input
              placeholder="Search by block #, hash..."
              value={searchBlockId}
              onChange={(e) => setSearchBlockId(e.target.value)}
              style={{ width: "300px" }}
            />
            <Select
              value={viewMode}
              onChange={setViewMode}
              style={{ width: "150px" }}
            >
              <Select.Option value="chain">Chain View</Select.Option>
              <Select.Option value="table">Table View</Select.Option>
            </Select>
          </Space>
        </Card>
      )}

      {/* Ledger Display */}
      {selectedElection && (
        <Card>
          <Spin spinning={loading}>
            {blocks.length > 0 ? (
              <div>
                {filteredBlocks.length === 0 ? (
                  <Empty description="No blocks match your search" />
                ) : viewMode === "chain" ? (
                  <ChainVisualization />
                ) : (
                  <Table
                    dataSource={filteredBlocks}
                    columns={tableColumns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1400 }}
                    size="small"
                  />
                )}
              </div>
            ) : !loading ? (
              <Empty description="No votes recorded for this election yet." />
            ) : null}
          </Spin>
        </Card>
      )}

      {/* Block Detail Modal */}
      <Modal
        title={`Block #${selectedBlock?.block_index} - Complete Details`}
        open={isModalVisible}
        onCancel={handleModalClose}
        footer={null}
        width={900}
        bodyStyle={{ maxHeight: "80vh", overflowY: "auto" }}
      >
        {selectedBlock && (
          <Collapse
            items={[
              {
                key: "basic",
                label: "Basic Information",
                children: (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                    <div>
                      <p style={{ margin: "0 0 5px 0", color: "#666" }}>Block Index:</p>
                      <p style={{ margin: "0 0 15px 0", fontSize: "16px", fontWeight: "bold" }}>#{selectedBlock.block_index}</p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 5px 0", color: "#666" }}>Timestamp:</p>
                      <p style={{ margin: "0 0 15px 0", fontSize: "14px" }}>
                        {new Date(selectedBlock.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <p style={{ margin: "0 0 5px 0", color: "#666" }}>Voter:</p>
                      <p style={{ margin: "0 0 15px 0", fontSize: "14px" }}>
                        {selectedBlock.voter_id ? (voterNameMap[selectedBlock.voter_id] || selectedBlock.voter_id) : "Unknown"}
                      </p>
                    </div>
                  </div>
                ),
              },
              {
                key: "hashes",
                label: "Blockchain Hashes",
                children: (
                  <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                    <div>
                      <p style={{ margin: "0 0 5px 0", color: "#666", fontWeight: "bold" }}>Vote Commitment (SHA256):</p>
                      <div style={{
                        backgroundColor: "#f0f7ff",
                        padding: "10px",
                        borderRadius: "4px",
                        wordBreak: "break-all",
                        fontFamily: "monospace",
                        fontSize: "12px",
                      }}>
                        {selectedBlock.vote_commitment}
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(selectedBlock.vote_commitment)}
                          style={{ marginLeft: "10px" }}
                        />
                      </div>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 5px 0", color: "#666", fontWeight: "bold" }}>Previous Block Hash:</p>
                      <div style={{
                        backgroundColor: "#f0f7ff",
                        padding: "10px",
                        borderRadius: "4px",
                        wordBreak: "break-all",
                        fontFamily: "monospace",
                        fontSize: "12px",
                      }}>
                        {selectedBlock.previous_hash}
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(selectedBlock.previous_hash)}
                          style={{ marginLeft: "10px" }}
                        />
                      </div>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 5px 0", color: "#666", fontWeight: "bold" }}>Current Block Hash:</p>
                      <div style={{
                        backgroundColor: "#f0f7ff",
                        padding: "10px",
                        borderRadius: "4px",
                        wordBreak: "break-all",
                        fontFamily: "monospace",
                        fontSize: "12px",
                        borderLeft: "4px solid #1890ff",
                      }}>
                        {selectedBlock.current_hash}
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(selectedBlock.current_hash)}
                          style={{ marginLeft: "10px" }}
                        />
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "encrypted",
                label: "Encrypted Vote Data",
                children: (
                  <div style={{
                    backgroundColor: "#faf8f3",
                    padding: "12px",
                    borderRadius: "4px",
                    wordBreak: "break-all",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    maxHeight: "300px",
                    overflowY: "auto",
                    color: "#999",
                  }}>
                    {selectedBlock.encrypted_vote}
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(selectedBlock.encrypted_vote)}
                      style={{ marginLeft: "10px" }}
                    />
                  </div>
                ),
              },
              {
                key: "metadata",
                label: "Metadata",
                children: (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                    <div>
                      <p style={{ margin: "0 0 5px 0", color: "#666" }}>Block ID:</p>
                      <code style={{ fontSize: "12px" }}>{selectedBlock.id}</code>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 5px 0", color: "#666" }}>Election ID:</p>
                      <code style={{ fontSize: "12px" }}>{selectedBlock.election_id}</code>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
};

export default AuditorBlockchainLedger;