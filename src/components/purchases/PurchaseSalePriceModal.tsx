import React, { useEffect, useState } from 'react';
import { Modal, Form, InputNumber, Table, Typography, Divider, Space, Spin } from 'antd';
import { customerCategoryService } from '../../services/customerCategoryService';
import { inventoryService, type Item, type ItemCustomerCategoryPriceUpsertRequest } from '../../services/inventoryService';

const { Text } = Typography;

export interface PurchasePriceModalValues {
  salePrice: number;
  secSalePrice: number;
  minSalePrice: number | null;
  customerCategoryPrices: ItemCustomerCategoryPriceUpsertRequest[];
}

interface CategoryPriceRow {
  customerCategoryId: string;
  customerCategoryTitle: string;
  priRate: number;
  secRate: number;
}

interface PurchaseSalePriceModalProps {
  open: boolean;
  item?: Item;
  initialSalePrice?: number | null;
  initialSecSalePrice?: number | null;
  initialMinSalePrice?: number | null;
  initialCategoryPrices?: ItemCustomerCategoryPriceUpsertRequest[];
  showSecondaryRate?: boolean;
  onCancel: () => void;
  onApply: (values: PurchasePriceModalValues) => void;
}

export const PurchaseSalePriceModal: React.FC<PurchaseSalePriceModalProps> = ({
  open,
  item,
  initialSalePrice,
  initialSecSalePrice,
  initialMinSalePrice,
  initialCategoryPrices,
  showSecondaryRate = false,
  onCancel,
  onApply,
}) => {
  const [salePrice, setSalePrice] = useState<number>(0);
  const [secSalePrice, setSecSalePrice] = useState<number>(0);
  const [minSalePrice, setMinSalePrice] = useState<number | null>(null);
  const [catRates, setCatRates] = useState<CategoryPriceRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item) return;

    const basePri = initialSalePrice ?? item.priRate ?? 0;
    const baseSec = initialSecSalePrice ?? item.secRate ?? 0;
    const baseMin = initialMinSalePrice !== undefined ? initialMinSalePrice : (item.minSalePrice ?? null);

    setSalePrice(basePri);
    setSecSalePrice(baseSec);
    setMinSalePrice(baseMin);

    let cancelled = false;
    const loadCategoryPrices = async () => {
      setLoading(true);
      try {
        const categories = await customerCategoryService.getLookup();
        let existing: Array<{ customerCategoryId: string; priRate: number; secRate?: number | null }> = [];

        if (initialCategoryPrices) {
          existing = initialCategoryPrices;
        } else {
          try {
            existing = await inventoryService.getItemCategoryPrices(item.id);
          } catch {
            existing = [];
          }
        }

        if (cancelled) return;

        const merged: CategoryPriceRow[] = categories.map(cat => {
          const found = existing.find(p => p.customerCategoryId === cat.code);
          return {
            customerCategoryId: cat.code,
            customerCategoryTitle: cat.title,
            priRate: found ? Number(found.priRate) : Number(basePri),
            secRate: found && found.secRate != null ? Number(found.secRate) : Number(baseSec),
          };
        });
        setCatRates(merged);
      } catch {
        if (!cancelled) setCatRates([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCategoryPrices();
    return () => {
      cancelled = true;
    };
  }, [open, item, initialSalePrice, initialSecSalePrice, initialMinSalePrice, initialCategoryPrices]);

  const handleOk = () => {
    onApply({
      salePrice: Number(salePrice) || 0,
      secSalePrice: Number(secSalePrice) || 0,
      minSalePrice: minSalePrice != null ? Number(minSalePrice) : null,
      customerCategoryPrices: catRates.map(r => ({
        customerCategoryId: r.customerCategoryId,
        priRate: Number(r.priRate) || 0,
        secRate: Number(r.secRate) || 0,
      })),
    });
  };

  return (
    <Modal
      title={item ? `Sale Prices — ${item.title}` : 'Sale Prices'}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="Apply to Row"
      width={620}
      destroyOnClose
    >
      <Form layout="vertical" size="middle">
        <Space size="middle" style={{ width: '100%', display: 'flex' }} wrap>
          <Form.Item label="Sale Price (Primary)" style={{ minWidth: 170, marginBottom: 8 }}>
            <InputNumber
              value={salePrice}
              min={0}
              precision={4}
              style={{ width: '100%' }}
              onChange={(v) => setSalePrice(v != null ? Number(v) : 0)}
            />
          </Form.Item>

          {(showSecondaryRate || Boolean(item?.secondaryUnit)) && (
            <Form.Item label="Sec. Sale Price" style={{ minWidth: 170, marginBottom: 8 }}>
              <InputNumber
                value={secSalePrice}
                min={0}
                precision={4}
                style={{ width: '100%' }}
                onChange={(v) => setSecSalePrice(v != null ? Number(v) : 0)}
              />
            </Form.Item>
          )}

          <Form.Item label="Min Sale Price" style={{ minWidth: 170, marginBottom: 8 }}>
            <InputNumber
              value={minSalePrice}
              min={0}
              precision={4}
              placeholder="Optional"
              style={{ width: '100%' }}
              onChange={(v) => setMinSalePrice(v != null ? Number(v) : null)}
            />
          </Form.Item>
        </Space>
      </Form>

      <Divider style={{ margin: '12px 0' }}>Customer Category Rates</Divider>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : catRates.length === 0 ? (
        <Text type="secondary">No customer categories configured.</Text>
      ) : (
        <Table
          dataSource={catRates}
          rowKey="customerCategoryId"
          pagination={false}
          size="small"
          bordered
          columns={[
            {
              title: 'Customer Category',
              dataIndex: 'customerCategoryTitle',
              key: 'title',
              render: (title: string) => <Text strong>{title}</Text>,
            },
            {
              title: 'Primary Rate',
              dataIndex: 'priRate',
              key: 'priRate',
              width: 150,
              render: (val: number, record: CategoryPriceRow) => (
                <InputNumber
                  value={val}
                  min={0}
                  precision={4}
                  style={{ width: '100%' }}
                  onChange={(v) => {
                    const next = v != null ? Number(v) : 0;
                    setCatRates(prev =>
                      prev.map(r => r.customerCategoryId === record.customerCategoryId ? { ...r, priRate: next } : r)
                    );
                  }}
                />
              ),
            },
            ...(showSecondaryRate || Boolean(item?.secondaryUnit)
              ? [{
                  title: 'Secondary Rate',
                  dataIndex: 'secRate',
                  key: 'secRate',
                  width: 150,
                  render: (val: number, record: CategoryPriceRow) => (
                    <InputNumber
                      value={val}
                      min={0}
                      precision={4}
                      style={{ width: '100%' }}
                      onChange={(v) => {
                        const next = v != null ? Number(v) : 0;
                        setCatRates(prev =>
                          prev.map(r => r.customerCategoryId === record.customerCategoryId ? { ...r, secRate: next } : r)
                        );
                      }}
                    />
                  ),
                }]
              : []),
          ]}
        />
      )}
    </Modal>
  );
};
