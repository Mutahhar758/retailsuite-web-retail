import React, { useState, useEffect } from 'react';
import {
  Modal, Upload, Button, Table, Space, Typography, Tag, Select,
  InputNumber, Image, Spin, message, Row, Col, DatePicker, Card
} from 'antd';
import {
  InboxOutlined, CameraOutlined, DeleteOutlined, ImportOutlined,
  PlusOutlined, CalendarOutlined, ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  saleSupplyService,
  type SaleSupplyScanResponse,
  type ScannedSaleSupplyLine
} from '../../../services/saleSupplyService';
import type { ChartOfAccountHeadDto } from '../../../services/chartOfAccountService';

const { Text } = Typography;
const { Dragger } = Upload;

export interface ScannedAttachmentMeta {
  mediaId: string;
  fileName?: string;
  previewUrl?: string;
}

interface SelectedPageItem {
  id: string;
  file: File;
  previewUrl: string;
  mediaId?: string;
}

interface ScanSupplySheetModalProps {
  visible: boolean;
  onClose: () => void;
  customers: ChartOfAccountHeadDto[];
  initialDate?: string;
  onImportLines: (
    importedLines: any[],
    attachments?: ScannedAttachmentMeta[] | string,
    fileName?: string,
    previewUrl?: string
  ) => void;
}

export const ScanSupplySheetModal: React.FC<ScanSupplySheetModalProps> = ({
  visible,
  onClose,
  customers,
  initialDate,
  onImportLines
}) => {
  const [loading, setLoading] = useState(false);
  const [targetDate, setTargetDate] = useState<dayjs.Dayjs | null>(
    initialDate ? dayjs(initialDate) : dayjs()
  );
  const [selectedPages, setSelectedPages] = useState<SelectedPageItem[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [scanResult, setScanResult] = useState<SaleSupplyScanResponse | null>(null);
  const [editableLines, setEditableLines] = useState<ScannedSaleSupplyLine[]>([]);

  // Update target date when modal becomes visible or initialDate changes
  useEffect(() => {
    if (visible) {
      setTargetDate(initialDate ? dayjs(initialDate) : dayjs());
    }
  }, [visible, initialDate]);

  const handleFileSelect = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setSelectedPages(prev => [
      ...prev,
      {
        id: `${file.name}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl
      }
    ]);
    return false; // Prevent automatic upload
  };

  const handleRemovePage = (id: string) => {
    setSelectedPages(prev => {
      const removed = prev.find(p => p.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      const updated = prev.filter(p => p.id !== id);
      if (activePageIndex >= updated.length) {
        setActivePageIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
  };

  const handleStartScan = async () => {
    if (selectedPages.length === 0) {
      message.warning('Please select or drop at least one paper sheet image or PDF.');
      return;
    }

    setLoading(true);
    try {
      // 1. Direct upload attachments to storage in background
      const updatedPages = [...selectedPages];
      await Promise.allSettled(
        updatedPages.map(async (page, idx) => {
          if (!page.mediaId) {
            try {
              const directUpload = await saleSupplyService.uploadAttachmentDirect(page.file);
              updatedPages[idx] = { ...page, mediaId: directUpload.mediaId };
            } catch (uploadErr) {
              console.warn(`Direct upload failed for ${page.file.name}:`, uploadErr);
            }
          }
        })
      );
      setSelectedPages(updatedPages);

      // 2. Call backend scan API with all files and target date
      const filesToScan = updatedPages.map(p => p.file);
      const dateString = targetDate ? targetDate.format('YYYY-MM-DD') : undefined;

      const result = await saleSupplyService.scanSheet(filesToScan, dateString);
      setScanResult(result);
      setEditableLines(result.lines || []);
      setActivePageIndex(0);

      message.success(`Extracted ${result.lines.length} lines from ${filesToScan.length} page(s).`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to scan paper sheet.';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = (seq: number, customerId: string) => {
    const cust = customers.find(c => c.account === customerId);
    setEditableLines(prev =>
      prev.map(line =>
        line.seq === seq
          ? {
              ...line,
              matchedCustomerId: customerId,
              matchedCustomerName: cust?.title || customerId,
              isCustomerMatched: true
            }
          : line
      )
    );
  };

  const handleFieldChange = (seq: number, field: keyof ScannedSaleSupplyLine, value: any) => {
    setEditableLines(prev =>
      prev.map(line => {
        if (line.seq === seq) {
          const updated = { ...line, [field]: value };
          const qty = Number(updated.qty) || 0;
          const rate = Number(updated.rate) || 0;
          const disc = Number(updated.discount) || 0;
          const addLess = Number(updated.addLess) || 0;
          const carriage = Number(updated.carriage) || 0;
          updated.amount = Math.max(0, (qty * rate) - disc + addLess + carriage);
          return updated;
        }
        return line;
      })
    );
  };

  const handleDeleteRow = (seq: number) => {
    setEditableLines(prev => prev.filter(l => l.seq !== seq));
  };

  const handleConfirmImport = () => {
    if (editableLines.length === 0) {
      message.warning('No lines to import.');
      return;
    }

    const unassigned = editableLines.filter(l => !l.matchedCustomerId);
    if (unassigned.length > 0) {
      Modal.confirm({
        title: 'Unmatched Customers Detected',
        content: `${unassigned.length} line(s) do not have a customer assigned. Do you want to continue importing? Those rows will require a customer before saving.`,
        okText: 'Import Anyway',
        cancelText: 'Back to Edit',
        onOk: () => doImport()
      });
      return;
    }

    doImport();
  };

  const doImport = () => {
    const linesToImport = editableLines.map((line, idx) => ({
      key: Date.now() + idx,
      seq: idx + 1,
      customerId: line.matchedCustomerId || null,
      qty: Number(line.qty) || 1,
      rate: Number(line.rate) || 0,
      discount: Number(line.discount) || 0,
      addLess: Number(line.addLess) || 0,
      carriage: Number(line.carriage) || 0,
      amount: Number(line.amount) || 0,
      secQty: 0,
      secRate: 0
    }));

    const attachments: ScannedAttachmentMeta[] = selectedPages
      .filter(p => !!p.mediaId)
      .map(p => ({
        mediaId: p.mediaId!,
        fileName: p.file.name,
        previewUrl: p.previewUrl
      }));

    onImportLines(
      linesToImport,
      attachments.length > 0 ? attachments : undefined,
      attachments[0]?.fileName,
      attachments[0]?.previewUrl
    );

    message.success(`Imported ${linesToImport.length} lines into voucher with ${attachments.length} attached sheet(s).`);
    handleClose();
  };

  const handleClose = () => {
    selectedPages.forEach(p => URL.revokeObjectURL(p.previewUrl));
    setSelectedPages([]);
    setScanResult(null);
    setEditableLines([]);
    setActivePageIndex(0);
    onClose();
  };

  const columns = [
    {
      title: '#',
      dataIndex: 'seq',
      width: 45,
      render: (v: number) => <Text type="secondary">{v}</Text>
    },
    {
      title: 'Customer (Slip)',
      dataIndex: 'rawCustomerName',
      width: 170,
      render: (text: string, record: ScannedSaleSupplyLine) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Text strong style={{ fontSize: 13 }}>{text || '—'}</Text>
          <Select
            showSearch
            placeholder="Map to Account"
            value={record.matchedCustomerId || undefined}
            onChange={(val) => handleCustomerChange(record.seq, val)}
            status={record.isCustomerMatched ? undefined : 'warning'}
            style={{ width: '100%' }}
            size="small"
            filterOption={(input, option) =>
              (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={customers.map(c => ({
              label: `${c.title} (${c.account})`,
              value: c.account
            }))}
          />
        </Space>
      )
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      width: 80,
      render: (val: number, record: ScannedSaleSupplyLine) => (
        <InputNumber
          min={0.01}
          value={val}
          size="small"
          style={{ width: '100%' }}
          onChange={(v) => handleFieldChange(record.seq, 'qty', v ?? 0)}
        />
      )
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      width: 85,
      render: (val: number, record: ScannedSaleSupplyLine) => (
        <InputNumber
          min={0}
          value={val}
          size="small"
          style={{ width: '100%' }}
          onChange={(v) => handleFieldChange(record.seq, 'rate', v ?? 0)}
        />
      )
    },
    {
      title: 'Disc',
      dataIndex: 'discount',
      width: 75,
      render: (val: number, record: ScannedSaleSupplyLine) => (
        <InputNumber
          min={0}
          value={val}
          size="small"
          style={{ width: '100%' }}
          onChange={(v) => handleFieldChange(record.seq, 'discount', v ?? 0)}
        />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: 90,
      render: (val: number) => <Text strong>{Number(val || 0).toFixed(2)}</Text>
    },
    {
      title: '',
      key: 'actions',
      width: 45,
      render: (_: any, record: ScannedSaleSupplyLine) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteRow(record.seq)}
        />
      )
    }
  ];

  const currentActivePage = selectedPages[activePageIndex] || selectedPages[0];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
          <Space>
            <CameraOutlined style={{ color: '#1677ff', fontSize: 18 }} />
            <span style={{ fontWeight: 600 }}>AI Handwritten Slip & Register Scanner</span>
          </Space>
          {scanResult && (
            <Tag color={scanResult.remainingScansThisMonth > 5 ? 'blue' : 'warning'}>
              Remaining Quota: {scanResult.remainingScansThisMonth} / {scanResult.monthlyLimit} this month
            </Tag>
          )}
        </div>
      }
      open={visible}
      onCancel={handleClose}
      width={1050}
      footer={
        editableLines.length > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">
              Total lines: {editableLines.length} | Matched:{' '}
              {editableLines.filter(l => l.isCustomerMatched).length} | Attached Sheets: {selectedPages.length}
            </Text>
            <Space>
              <Button onClick={handleClose}>Cancel</Button>
              <Button
                type="primary"
                icon={<ImportOutlined />}
                onClick={handleConfirmImport}
              >
                Import Lines & Attach {selectedPages.length} Sheet(s)
              </Button>
            </Space>
          </div>
        ) : null
      }
      destroyOnClose
    >
      <Spin
        spinning={loading}
        tip={
          selectedPages.length > 1
            ? `Analyzing ${selectedPages.length} pages via Gemini Vision AI (Matrix/Multi-page merge enabled)...`
            : 'Analyzing handwritten paper sheet via Gemini Vision AI...'
        }
      >
        {/* Top Control Bar: Target Date & Pivot Matrix Support */}
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            backgroundColor: '#f5f7fa',
            borderRadius: 6,
            border: '1px solid #e8e8e8',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <Space size="middle" align="center">
            <Space size={6}>
              <CalendarOutlined style={{ color: '#1677ff' }} />
              <Text strong>Target Extraction Date:</Text>
            </Space>
            <DatePicker
              value={targetDate}
              onChange={(val) => setTargetDate(val)}
              format="YYYY-MM-DD"
              placeholder="Select date (optional)"
              allowClear
              style={{ width: 160 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Filters specific date row if sheet is a multi-date pivot/matrix register (customers as columns, dates as rows).
            </Text>
          </Space>

          {scanResult && (
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => {
                setScanResult(null);
                setEditableLines([]);
              }}
            >
              Scan New Sheet(s)
            </Button>
          )}
        </div>

        {!scanResult ? (
          <div>
            <Dragger
              accept="image/*,.pdf"
              multiple={true}
              showUploadList={false}
              beforeUpload={handleFileSelect}
              style={{ padding: '24px 16px', backgroundColor: '#fafcff' }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#1677ff', fontSize: 44 }} />
              </p>
              <p className="ant-upload-text" style={{ fontSize: 15, fontWeight: 500 }}>
                Click or drag & drop handwritten slip(s) or register pages here
              </p>
              <p className="ant-upload-hint" style={{ color: '#666' }}>
                Supports multiple images for multi-page registers (e.g. Page 1 & Page 2 continuation sheets), Urdu, Roman Urdu, or English.
              </p>
            </Dragger>

            {/* Selected Pages List */}
            {selectedPages.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text strong>
                    Selected Pages ({selectedPages.length}):
                  </Text>
                  <Upload
                    accept="image/*,.pdf"
                    multiple={true}
                    showUploadList={false}
                    beforeUpload={handleFileSelect}
                  >
                    <Button size="small" icon={<PlusOutlined />}>Add Another Page</Button>
                  </Upload>
                </div>

                <Row gutter={[12, 12]}>
                  {selectedPages.map((item, index) => (
                    <Col xs={12} sm={8} md={6} key={item.id}>
                      <Card
                        size="small"
                        hoverable
                        style={{ border: '1px solid #d9d9d9', textAlign: 'center', position: 'relative' }}
                        cover={
                          <div style={{ height: 110, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }}>
                            <Image
                              src={item.previewUrl}
                              alt={`Page ${index + 1}`}
                              style={{ maxHeight: 110, objectFit: 'cover' }}
                              preview={false}
                            />
                          </div>
                        }
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <Tag color="geekblue">Page {index + 1}</Tag>
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePage(item.id);
                            }}
                          />
                        </div>
                        <Text ellipsis style={{ display: 'block', fontSize: 11, marginTop: 4, color: '#888' }}>
                          {item.file.name}
                        </Text>
                      </Card>
                    </Col>
                  ))}
                </Row>

                <div style={{ textAlign: 'center', marginTop: 20 }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<CameraOutlined />}
                    onClick={handleStartScan}
                    style={{ minWidth: 240, height: 42, fontSize: 15 }}
                  >
                    Analyze {selectedPages.length} Page{selectedPages.length > 1 ? 's' : ''} with AI
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Row gutter={16}>
            {/* Left Column: Multi-page viewer */}
            <Col span={10}>
              <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: 10, backgroundColor: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text strong>Scanned Sheets</Text>
                  {selectedPages.length > 1 && (
                    <Space size={4}>
                      {selectedPages.map((_, idx) => (
                        <Button
                          key={idx}
                          size="small"
                          type={activePageIndex === idx ? 'primary' : 'default'}
                          onClick={() => setActivePageIndex(idx)}
                        >
                          Page {idx + 1}
                        </Button>
                      ))}
                    </Space>
                  )}
                </div>

                {currentActivePage && (
                  <div style={{ textAlign: 'center', minHeight: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Image
                      src={currentActivePage.previewUrl}
                      alt={`Page ${activePageIndex + 1}`}
                      style={{ maxHeight: 420, maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }}
                    />
                  </div>
                )}
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {currentActivePage?.file.name} (Click image to zoom)
                  </Text>
                </div>
              </div>
            </Col>

            {/* Right Column: Extracted lines */}
            <Col span={14}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Text strong>Extracted Line Items ({editableLines.length})</Text>
                  {targetDate && (
                    <Tag color="blue">
                      Target: {targetDate.format('YYYY-MM-DD')}
                    </Tag>
                  )}
                  {selectedPages.length > 1 && (
                    <Tag color="purple">{selectedPages.length} Pages Merged</Tag>
                  )}
                </Space>
                <Tag color="cyan">Review and adjust before importing</Tag>
              </div>

              <Table
                dataSource={editableLines}
                columns={columns}
                rowKey="seq"
                pagination={false}
                scroll={{ y: 380 }}
                size="small"
              />
            </Col>
          </Row>
        )}
      </Spin>
    </Modal>
  );
};
