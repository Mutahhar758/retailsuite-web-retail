import React, { useState, useEffect, useMemo } from 'react';
import {
  Drawer, Button, Upload, Typography, Space, Popconfirm,
  Image, message, Spin, Tag, Tooltip
} from 'antd';
import {
  PaperClipOutlined, UploadOutlined, DeleteOutlined, DownloadOutlined,
  FileTextOutlined, FilePdfOutlined, FileImageOutlined,
  FileExcelOutlined, ExportOutlined, FullscreenOutlined, FullscreenExitOutlined,
  ReloadOutlined, InboxOutlined
} from '@ant-design/icons';
import {
  saleSupplyService,
  type SaleSupplyAttachment
} from '../../../services/saleSupplyService';

const { Text } = Typography;

interface SaleSupplyAttachmentsDrawerProps {
  visible: boolean;
  onClose: () => void;
  voucherNo?: string;
  isEdit: boolean;
  stagedMediaIds?: string[];
  onAddStagedMedia: (mediaId: string, meta?: { fileName: string; fileUrl?: string }) => void;
  onRemoveStagedMedia: (mediaId: string) => void;
  stagedAttachmentsMeta?: Array<{ mediaId: string; fileName: string; fileUrl?: string }>;
}

interface UnifiedAttachment {
  key: string;
  id?: number;
  mediaId: string;
  fileName: string;
  fileUrl?: string;
  downloadUrl?: string;
  description?: string;
  createdOn?: string;
  isStaged: boolean;
}

export const SaleSupplyAttachmentsDrawer: React.FC<SaleSupplyAttachmentsDrawerProps> = ({
  visible,
  onClose,
  voucherNo,
  isEdit,
  onAddStagedMedia,
  onRemoveStagedMedia,
  stagedAttachmentsMeta = []
}) => {
  const [loading, setLoading] = useState(false);
  const [savedAttachments, setSavedAttachments] = useState<SaleSupplyAttachment[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [failedImageKeys, setFailedImageKeys] = useState<Record<string, boolean>>({});
  const [renderedPdfUrl, setRenderedPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const fetchAttachments = async () => {
    if (!voucherNo || voucherNo === 'new') return;
    setLoading(true);
    try {
      const data = await saleSupplyService.getAttachments(voucherNo);
      setSavedAttachments(data || []);
    } catch (err: any) {
      message.error(err.message || 'Failed to load attachments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && isEdit && voucherNo) {
      fetchAttachments();
    }
  }, [visible, isEdit, voucherNo]);

  // Combine saved attachments and staged attachments into a unified list
  const unifiedAttachments: UnifiedAttachment[] = useMemo(() => {
    const list: UnifiedAttachment[] = [];

    // 1. Saved attachments from database
    for (const item of savedAttachments) {
      list.push({
        key: `saved-${item.id}`,
        id: item.id,
        mediaId: item.mediaId,
        fileName: item.fileName || 'Slip.jpg',
        fileUrl: item.fileUrl,
        downloadUrl: item.downloadUrl || item.fileUrl,
        description: item.description,
        createdOn: item.createdOn,
        isStaged: false,
      });
    }

    // 2. Staged attachments pending save
    for (const staged of stagedAttachmentsMeta) {
      list.push({
        key: `staged-${staged.mediaId}`,
        mediaId: staged.mediaId,
        fileName: staged.fileName || 'Slip.jpg',
        fileUrl: staged.fileUrl,
        downloadUrl: staged.fileUrl,
        isStaged: true,
      });
    }

    return list;
  }, [savedAttachments, stagedAttachmentsMeta]);

  // Auto-select the first attachment if none selected or if selection no longer exists
  useEffect(() => {
    if (unifiedAttachments.length > 0) {
      const exists = unifiedAttachments.some(a => a.key === selectedKey);
      if (!exists || !selectedKey) {
        setSelectedKey(unifiedAttachments[0].key);
      }
    } else {
      setSelectedKey(null);
    }
  }, [unifiedAttachments, selectedKey]);

  const activeAttachment = useMemo(() => {
    if (!selectedKey) return unifiedAttachments[0] || null;
    return unifiedAttachments.find(a => a.key === selectedKey) || unifiedAttachments[0] || null;
  }, [unifiedAttachments, selectedKey]);

  useEffect(() => {
    let activeObjectUrl: string | null = null;
    let isCancelled = false;

    if (!activeAttachment?.fileUrl || !isPdf(activeAttachment.fileName)) {
      setRenderedPdfUrl(null);
      setPdfError(null);
      setPdfLoading(false);
      return;
    }

    // If it's already a local blob URL (e.g. from local file upload)
    if (activeAttachment.fileUrl.startsWith('blob:')) {
      setRenderedPdfUrl(activeAttachment.fileUrl);
      setPdfError(null);
      setPdfLoading(false);
      return;
    }

    setPdfLoading(true);
    setPdfError(null);

    fetch(activeAttachment.fileUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load document (${response.status})`);
        }
        return response.blob();
      })
      .then((blob) => {
        if (isCancelled) return;
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        activeObjectUrl = URL.createObjectURL(pdfBlob);
        setRenderedPdfUrl(activeObjectUrl);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('PDF in-app preview fetch error:', err);
        setPdfError('Remote storage refused direct embedding. Click "Tab" above to view.');
      })
      .finally(() => {
        if (!isCancelled) setPdfLoading(false);
      });

    return () => {
      isCancelled = true;
      if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl);
      }
    };
  }, [activeAttachment?.fileUrl, activeAttachment?.fileName]);

  const handleUploadNew = async (file: File) => {
    setLoading(true);
    try {
      const { mediaId, fileName } = await saleSupplyService.uploadAttachmentDirect(file);
      const localBlobUrl = URL.createObjectURL(file);
      const effectiveFileName = fileName || file.name;

      if (isEdit && voucherNo && voucherNo !== 'new') {
        await saleSupplyService.addAttachment(voucherNo, { mediaId, fileName: effectiveFileName, description: file.name });
        message.success('Attachment uploaded and saved.');
        await fetchAttachments();
        // Select newly added attachment
        setSelectedKey(`staged-${mediaId}`);
      } else {
        onAddStagedMedia(mediaId, {
          fileName: effectiveFileName,
          fileUrl: localBlobUrl
        });
        setSelectedKey(`staged-${mediaId}`);
        message.success('Attachment uploaded.');
      }
    } catch (err: any) {
      message.error(err.message || 'Failed to upload document.');
    } finally {
      setLoading(false);
    }
    return false;
  };

  const handleDeleteActive = async (target: UnifiedAttachment) => {
    if (target.isStaged) {
      onRemoveStagedMedia(target.mediaId);
      message.success('Pending attachment removed.');
    } else if (target.id && voucherNo) {
      try {
        await saleSupplyService.deleteAttachment(voucherNo, target.id);
        message.success('Attachment deleted.');
        setSavedAttachments(prev => prev.filter(a => a.id !== target.id));
      } catch (err: any) {
        message.error(err.message || 'Failed to delete attachment.');
      }
    }
  };

  const handleDownload = (target: UnifiedAttachment) => {
    const url = target.downloadUrl || target.fileUrl;
    if (!url) {
      message.warning('File URL is not available.');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    let downloadName = target.fileName || 'attachment';
    if (!downloadName.includes('.')) {
      downloadName = `${downloadName}.jpg`;
    }
    a.download = downloadName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getFileExtension = (name?: string) => {
    if (!name) return '';
    const clean = name.trim();
    const lastDot = clean.lastIndexOf('.');
    if (lastDot === -1 || lastDot === clean.length - 1) return '';
    return clean.substring(lastDot + 1).toLowerCase();
  };

  const isPdf = (name?: string) => getFileExtension(name) === 'pdf';
  const isText = (name?: string) => ['txt', 'csv', 'log', 'json'].includes(getFileExtension(name));

  // If extension is known image or missing, default to image format (for camera slips/scans)
  const isImage = (target: UnifiedAttachment) => {
    if (failedImageKeys[target.key]) return false;
    const ext = getFileExtension(target.fileName);
    if (!ext) return true; // Default missing extension to image
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext);
  };

  const getFileIcon = (fileName?: string) => {
    const ext = getFileExtension(fileName);
    if (ext === 'pdf') return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
    if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileExcelOutlined style={{ color: '#52c41a' }} />;
    if (['txt', 'log'].includes(ext)) return <FileTextOutlined style={{ color: '#1677ff' }} />;
    return <FileImageOutlined style={{ color: '#1677ff' }} />;
  };

  const drawerWidth = isExpanded ? Math.min(window.innerWidth * 0.96, 1200) : Math.min(window.innerWidth * 0.95, 750);

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 }}>
          <Space align="center" size="small">
            <PaperClipOutlined style={{ color: '#1677ff', fontSize: 18 }} />
            <span style={{ fontWeight: 600 }}>Attachments</span>
            {voucherNo && voucherNo !== 'new' && (
              <Tag color="blue" style={{ margin: 0 }}>{voucherNo}</Tag>
            )}
            <Tag color={unifiedAttachments.length > 0 ? 'green' : 'default'} style={{ margin: 0 }}>
              {unifiedAttachments.length}
            </Tag>
          </Space>
          <Space size="small">
            <Tooltip title={isExpanded ? 'Normal view' : 'Expand preview width'}>
              <Button
                type="text"
                size="small"
                icon={isExpanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={() => setIsExpanded(!isExpanded)}
              />
            </Tooltip>
            {isEdit && voucherNo && voucherNo !== 'new' && (
              <Tooltip title="Refresh">
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={fetchAttachments}
                  loading={loading}
                />
              </Tooltip>
            )}
            <Upload beforeUpload={handleUploadNew} showUploadList={false}>
              <Button type="primary" icon={<UploadOutlined />} size="small">
                Upload File
              </Button>
            </Upload>
          </Space>
        </div>
      }
      placement="right"
      width={drawerWidth}
      onClose={onClose}
      open={visible}
      styles={{
        body: {
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          background: '#f8fafc'
        }
      }}
    >
      <Spin spinning={loading} wrapperClassName="h-full flex flex-col" style={{ height: '100%' }}>
        {unifiedAttachments.length === 0 ? (
          /* Empty State with Drag/Upload */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 420,
                background: '#fff',
                border: '2px dashed #d9d9d9',
                borderRadius: 12,
                padding: '40px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: '#f0f5ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1677ff',
                  fontSize: 28
                }}
              >
                <InboxOutlined />
              </div>
              <div>
                <Typography.Title level={5} style={{ margin: '0 0 6px 0' }}>
                  No Attachments Yet
                </Typography.Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Attach paper slips, PDF invoices, delivery challans, or camera photos to this voucher.
                </Text>
              </div>
              <Upload beforeUpload={handleUploadNew} showUploadList={false}>
                <Button type="primary" icon={<UploadOutlined />}>
                  Select File to Upload
                </Button>
              </Upload>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {/* Top Multi-Attachment Switcher Strip (if >= 2 items) */}
            {unifiedAttachments.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                  paddingBottom: 10,
                  marginBottom: 10,
                  borderBottom: '1px solid #e2e8f0',
                  flexShrink: 0
                }}
              >
                {unifiedAttachments.map((item, idx) => {
                  const isActive = item.key === activeAttachment?.key;
                  return (
                    <div
                      key={item.key}
                      onClick={() => setSelectedKey(item.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: isActive ? '1.5px solid #1677ff' : '1px solid #e2e8f0',
                        background: isActive ? '#e6f4ff' : '#ffffff',
                        boxShadow: isActive ? '0 1px 4px rgba(22, 119, 255, 0.15)' : 'none',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                        userSelect: 'none'
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{getFileIcon(item.fileName)}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                        <Text
                          strong={isActive}
                          ellipsis
                          style={{
                            maxWidth: 140,
                            fontSize: 12,
                            color: isActive ? '#0958d9' : '#334155'
                          }}
                        >
                          {item.fileName || `Attachment ${idx + 1}`}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 10 }}>
                          {item.isStaged ? 'Pending save' : (item.createdOn ? new Date(item.createdOn).toLocaleDateString() : 'Saved')}
                        </Text>
                      </div>
                      {item.isStaged && (
                        <Tag color="orange" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                          New
                        </Tag>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Active Attachment Direct Viewer Card */}
            {activeAttachment && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  background: '#ffffff',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  minHeight: 'calc(100vh - 160px)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  overflow: 'hidden'
                }}
              >
                {/* Active Item Action Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    background: '#fafafa',
                    flexShrink: 0
                  }}
                >
                  <Space align="center" style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 20 }}>{getFileIcon(activeAttachment.fileName)}</span>
                    <Tooltip title={activeAttachment.fileName}>
                      <Text strong ellipsis style={{ maxWidth: 300, fontSize: 14 }}>
                        {activeAttachment.fileName}
                      </Text>
                    </Tooltip>
                    {activeAttachment.isStaged ? (
                      <Tag color="orange">Pending Voucher Save</Tag>
                    ) : (
                      activeAttachment.createdOn && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(activeAttachment.createdOn).toLocaleString()}
                        </Text>
                      )
                    )}
                  </Space>

                  <Space size="small">
                    {activeAttachment.fileUrl && (
                      <Tooltip title="Open in browser new tab">
                        <Button
                          size="small"
                          icon={<ExportOutlined />}
                          href={activeAttachment.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Tab
                        </Button>
                      </Tooltip>
                    )}
                    {(activeAttachment.downloadUrl || activeAttachment.fileUrl) && (
                      <Tooltip title="Download file">
                        <Button
                          size="small"
                          type="primary"
                          ghost
                          icon={<DownloadOutlined />}
                          onClick={() => handleDownload(activeAttachment)}
                        >
                          Download
                        </Button>
                      </Tooltip>
                    )}
                    <Popconfirm
                      title="Delete this attachment?"
                      description="This will remove the file permanently."
                      onConfirm={() => handleDeleteActive(activeAttachment)}
                      okText="Yes, Delete"
                      cancelText="Cancel"
                      okButtonProps={{ danger: true }}
                    >
                      <Tooltip title="Delete attachment">
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Tooltip>
                    </Popconfirm>
                  </Space>
                </div>

                {/* Direct Inline Render Body (0 extra clicks!) */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f8fafc',
                    position: 'relative',
                    overflow: 'auto',
                    minHeight: 'calc(100vh - 210px)',
                    padding: 10
                  }}
                >
                  {!activeAttachment.fileUrl ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <Spin tip="Preparing attachment preview..." />
                    </div>
                  ) : isPdf(activeAttachment.fileName) ? (
                    pdfLoading ? (
                      <div style={{ textAlign: 'center', padding: 40 }}>
                        <Spin tip="Loading document in app..." />
                      </div>
                    ) : renderedPdfUrl ? (
                      <iframe
                        src={`${renderedPdfUrl}#toolbar=1`}
                        style={{
                          width: '100%',
                          height: 'calc(100vh - 210px)',
                          minHeight: 680,
                          border: 'none',
                          borderRadius: 6
                        }}
                        title={activeAttachment.fileName}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', padding: 32, maxWidth: 400 }}>
                        <FilePdfOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 12 }} />
                        <Typography.Title level={5} style={{ margin: '0 0 6px 0' }}>
                          {activeAttachment.fileName}
                        </Typography.Title>
                        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                          {pdfError || 'Document could not be displayed directly in-app.'}
                        </Text>
                        <Space>
                          <Button
                            type="primary"
                            icon={<ExportOutlined />}
                            href={activeAttachment.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open in Dedicated Tab
                          </Button>
                          <Button
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownload(activeAttachment)}
                          >
                            Download
                          </Button>
                        </Space>
                      </div>
                    )
                  ) : isText(activeAttachment.fileName) ? (
                    <iframe
                      src={activeAttachment.fileUrl}
                      style={{
                        width: '100%',
                        height: 'calc(100vh - 210px)',
                        minHeight: 680,
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        background: '#ffffff'
                      }}
                      title={activeAttachment.fileName}
                    />
                  ) : isImage(activeAttachment) ? (
                    <div
                      style={{
                        width: '100%',
                        height: 'calc(100vh - 210px)',
                        minHeight: 680,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#ffffff',
                        borderRadius: 6,
                        padding: 16,
                        overflow: 'hidden'
                      }}
                    >
                      <Image
                        src={activeAttachment.fileUrl}
                        alt={activeAttachment.fileName}
                        onError={() => {
                          setFailedImageKeys(prev => ({ ...prev, [activeAttachment.key]: true }));
                        }}
                        style={{
                          maxHeight: 'calc(100vh - 260px)',
                          maxWidth: '100%',
                          objectFit: 'contain',
                          display: 'block',
                          margin: 'auto',
                          borderRadius: 6,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                        }}
                        preview={{
                          mask: 'Click to zoom & inspect full slip'
                        }}
                      />
                    </div>
                  ) : (
                    /* Fallback for binary / non-renderable file types */
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '48px 24px',
                        background: '#ffffff',
                        borderRadius: 12,
                        border: '1px dashed #cbd5e1',
                        maxWidth: 420
                      }}
                    >
                      <div style={{ fontSize: 54, marginBottom: 16 }}>
                        {getFileIcon(activeAttachment.fileName)}
                      </div>
                      <Typography.Title level={5} style={{ margin: '0 0 8px 0' }}>
                        {activeAttachment.fileName}
                      </Typography.Title>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                        This file format cannot be rendered inline in the browser. Click below to download or view externally.
                      </Text>
                      <Space>
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={() => handleDownload(activeAttachment)}
                        >
                          Download File
                        </Button>
                        <Button
                          icon={<ExportOutlined />}
                          href={activeAttachment.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Tab
                        </Button>
                      </Space>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Spin>
    </Drawer>
  );
};
