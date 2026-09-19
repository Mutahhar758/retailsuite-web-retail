import React, { useEffect, useState } from 'react';
import { Modal, Button, Space, Typography, Tooltip } from 'antd';
import {
  DownloadOutlined,
  PrinterOutlined,
  ExportOutlined,
  CloseOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface PdfViewerModalProps {
  open: boolean;
  title?: string;
  pdfBlob: Blob | null;
  fileName?: string;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  open,
  title = 'Report PDF Viewer',
  pdfBlob,
  fileName = 'Report.pdf',
  onClose
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      setBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setBlobUrl(null);
      };
    } else {
      setBlobUrl(null);
    }
  }, [pdfBlob]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    if (!blobUrl) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Failed to trigger direct print', e);
        } finally {
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 60000);
        }
      }, 300);
    };
  };

  const handleOpenNewTab = () => {
    if (!blobUrl) return;
    window.open(blobUrl, '_blank');
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="90vw"
      style={{ top: 20, maxWidth: 1200 }}
      styles={{
        body: { padding: 0, height: '80vh', display: 'flex', flexDirection: 'column' }
      }}
      title={
        <div className="flex items-center justify-between pr-8">
          <Space>
            <Text strong style={{ fontSize: 16 }}>{title}</Text>
          </Space>
        </div>
      }
      footer={
        <div className="flex items-center justify-end px-4 py-2">
          <Space>
            <Tooltip title="Open in dedicated browser tab">
              <Button icon={<ExportOutlined />} onClick={handleOpenNewTab}>
                Open in Tab
              </Button>
            </Tooltip>
            <Tooltip title="Print pixel-perfect vector PDF">
              <Button icon={<PrinterOutlined />} type="default" onClick={handlePrint}>
                Print
              </Button>
            </Tooltip>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
              Download PDF
            </Button>
            <Button icon={<CloseOutlined />} onClick={onClose}>
              Close
            </Button>
          </Space>
        </div>
      }
      destroyOnClose
    >
      {blobUrl ? (
        <iframe
          src={blobUrl}
          title={title}
          className="w-full h-full border-0"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <Text type="secondary">Loading PDF Document...</Text>
        </div>
      )}
    </Modal>
  );
};
