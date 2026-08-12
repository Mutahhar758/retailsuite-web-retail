import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  UndoOutlined, UserOutlined, FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';
import { round } from '../../utils/numberUtils';
import { saleReturnService } from '../../services/saleReturnService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, type NarrationDto } from '../../services/narrationService';
import { inventoryService, type Item } from '../../services/inventoryService';

const { Title, Text } = Typography;

export const SaleReturnForm: React.FC = () => {
  const { licenses, currentTenantIdentifier } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const hasSecondaryQty = currentOrg?.hasSecondaryQty ?? false;
  const hasVariablePackFeature = currentOrg?.hasVariablePackFeature ?? false;

  const { voucherNo } = useParams<{ voucherNo: string }>();
  const isEdit = !!voucherNo && voucherNo !== 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<{ code: string; title: string }[]>([]);
  const [saleLines, setSaleLines] = useState<any[]>([]);

  useEffect(() => {
    chartOfAccountService.getCustomerAccounts().then(setCustomers);
    narrationService.getActiveNarrationsLookup().then(setNarrations);
    inventoryService.getItemsLookup().then(setItems);
    inventoryService.getUnitsLookup().then(setUnits);

    if (isEdit) {
      fetchDetail();
    } else {
      setSaleLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]);
      form.setFieldsValue({ date: dayjs() });
    }
  }, [isEdit, voucherNo]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const details = await saleReturnService.getDetail(voucherNo!);
      if (details.length > 0) {
        const first = details[0];
        form.setFieldsValue({
          date: dayjs(first.date),
          account: first.accountId,
          narration: first.narrationId,
          description: first.description
        });

        setSaleLines(details.map(d => {
          const pQty = (d as any).qtyInPack || ((d.qty > 0 && d.secQty && d.secQty > 0) ? round(d.qty / d.secQty, 2) : 0);
          const pCking = (d.rate > 0 && d.secRate && d.secRate > 0) ? round(d.secRate / d.rate, 2) : ((d as any).qtyInPack || 0);
          return {
            ...d,
            key: d.seq,
            rate: d.rate,
            discount: d.discount,
            amount: d.amount,
            secQty: d.secQty,
            secRate: d.secRate,
            secUnit: d.secUnit,
            packQty: pQty,
            packing: pCking
          };
        }));
      }
    } catch (error) {
      message.error('Failed to fetch sale return details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = () => {
    setSaleLines(prev => {
      const newSeq = prev.length > 0 ? Math.max(...prev.map(l => l.seq)) + 1 : 1;
      return [...prev, { key: Date.now(), seq: newSeq, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }];
    });
  };

  const handleRemoveRow = async (key: number, seq: number) => {
    if (isEdit && typeof key === 'number' && key < 1000000000) {
      try {
        await saleReturnService.deleteLine(voucherNo!, seq);
      } catch (error) {
        message.error('Failed to delete line');
        return;
      }
    }
    setSaleLines(prev => prev.filter(l => l.key !== key));
  };

  const updateLine = (key: number, field: string, value: any) => {
    setSaleLines(prev => {
      const newLines = prev.map(l => {
        if (l.key === key) {
          const updated = { ...l, [field]: value };
          if (field === 'itemId') {
            const item = items.find(i => String(i.id) === String(value));
            if (item) {
              updated.unit = item.defaultUnit;
              updated.rate = item.priRate;
              updated.secUnit = item.secondaryUnit;
              const pSize = Number(item.qtyInPack || (item as any).QtyInPack || (item as any).qty_in_pack || 0);
              updated.packQty = pSize;
              updated.packing = pSize;
              updated.secRate = item.secRate || 0;
              updated.secQty = 0;
            }
          }

          const cleanVal = typeof value === 'string' ? value.replace(/,/g, '') : value;
          const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;

          if (hasVariablePackFeature) {
            let kgQty = updated.qty || 0;
            let bagQty = updated.secQty || 0;
            let packQty = updated.packQty || 0;
            let packing = updated.packing || 0;
            let kgRate = updated.rate || 0;
            let bagRate = updated.secRate || 0;

            if (field === 'qty') {
              kgQty = numVal;
              if (bagQty > 0) {
                packQty = round(kgQty / bagQty, 2);
              } else if (packQty > 0) {
                bagQty = round(kgQty / packQty, 2);
              }
            } else if (field === 'secQty') {
              bagQty = numVal;
              if (packQty > 0) {
                kgQty = round(bagQty * packQty, 2);
              } else if (kgQty > 0) {
                packQty = round(kgQty / bagQty, 2);
              }
            } else if (field === 'packQty') {
              packQty = numVal;
              if (bagQty > 0) {
                kgQty = round(bagQty * packQty, 2);
              } else if (kgQty > 0) {
                bagQty = round(kgQty / bagQty, 2);
              }
            } else if (field === 'packing') {
              packing = numVal;
              if (packing > 0) {
                if (bagRate > 0) {
                  kgRate = round(bagRate / packing, 4);
                } else if (kgRate > 0) {
                  bagRate = round(kgRate * packing, 4);
                }
              }
            } else if (field === 'rate') {
              kgRate = numVal;
              if (packing > 0) {
                bagRate = round(kgRate * packing, 4);
              }
            } else if (field === 'secRate') {
              bagRate = numVal;
              if (packing > 0) {
                kgRate = round(bagRate / packing, 4);
              }
            }

            updated.qty = round(kgQty, 2);
            updated.secQty = round(bagQty, 2);
            updated.packQty = round(packQty, 2);
            updated.packing = round(packing, 2);
            updated.rate = round(kgRate, 4);
            updated.secRate = round(bagRate, 4);
          }

          const qty = updated.qty || 0;
          const rate = updated.rate || 0;
          const disc = updated.discount || 0;
          const secQty = updated.secQty || 0;
          const secRate = updated.secRate || 0;
          updated.amount = hasVariablePackFeature
            ? round(qty * (rate - disc), 2)
            : round((qty * (rate - disc)) + (secQty * secRate), 2);
          return updated;
        }
        return l;
      });

      const lastRow = newLines[newLines.length - 1];
      if (lastRow.key === key && lastRow.itemId) {
        const newSeq = newLines.length > 0 ? Math.max(...newLines.map(l => l.seq)) + 1 : 1;
        return [...newLines, { key: Date.now() + 1, seq: newSeq, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }];
      }
      return newLines;
    });
  };

  const totalAmount = saleLines.reduce((sum, l) => sum + (l.amount || 0), 0);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validLines = saleLines.filter(l => l.itemId && l.qty > 0);
      if (validLines.length === 0) {
        message.error('Please add at least one item');
        return;
      }

      setLoading(true);
      const request = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        lines: validLines.map(l => {
          const item = items.find(i => i.id === l.itemId);
          return {
            seq: l.seq,
            itemId: l.itemId,
            unit: item?.itemType === 'Service' ? null : (l.unit || null),
            qty: l.qty,
            rate: l.rate,
            discount: l.discount,
            secUnit: l.secUnit || null,
            secQty: l.secQty || 0,
            secRate: l.secRate || 0,
            qtyInPack: l.packQty || l.qtyInPack || null
          };
        })
      };

      if (isEdit) {
        await saleReturnService.update(voucherNo!, request);
        message.success('Sale return updated successfully');
      } else {
        const newVno = await saleReturnService.create(request);
        message.success('Sale return created successfully');
        navigate(`/daily-entries/sale-return/${newVno}`);
      }
    } catch (error) {
      message.error('Failed to save sale return');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await saleReturnService.delete(voucherNo!);
      message.success('Sale return deleted successfully');
      navigate('/daily-entries/sale-return');
    } catch (error) {
      message.error('Failed to delete sale return');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Item',
      dataIndex: 'itemId',
      key: 'itemId',
      render: (text: string, record: any) => (
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder="Select Item"
          optionFilterProp="children"
          value={text}
          onChange={(val) => updateLine(record.key, 'itemId', val)}
        >
          {items.map(i => (
            <Select.Option key={i.id} value={i.id}>{i.title}</Select.Option>
          ))}
        </Select>
      )
    },
    ...(!hasSecondaryQty ? [
      {
        title: 'Unit',
        dataIndex: 'unit',
        key: 'unit',
        width: 120,
        render: (text: string, record: any) => {
          const item = items.find(i => i.id === record.itemId);
          const filteredUnits = item ? units.filter(u => u.code === item.primaryUnit || u.code === item.secondaryUnit) : units;
          return (
            <Select style={{ width: '100%' }} value={text} disabled={!record.itemId} onChange={(val) => updateLine(record.key, 'unit', val)}>
              {filteredUnits.map(u => (
                <Select.Option key={u.code} value={u.code}>{u.title}</Select.Option>
              ))}
            </Select>
          );
        }
      }
    ] : []),
    {
      title: hasVariablePackFeature ? 'Qty (Kg)' : (hasSecondaryQty ? 'Single Qty' : 'Qty'),
      dataIndex: 'qty',
      key: 'qty',
      width: 100,
      render: (val: number, record: any) => (
        <InputNumber style={{ width: '100%' }} value={val} min={0} precision={2} onChange={(v) => updateLine(record.key, 'qty', v)} />
      )
    },
    ...(hasVariablePackFeature ? [
      {
        title: 'Bag Qty',
        dataIndex: 'secQty',
        key: 'secQty',
        width: 100,
        render: (val: number, record: any) => (
          <InputNumber style={{ width: '100%' }} value={val} min={0} precision={2} onChange={(v) => updateLine(record.key, 'secQty', v)} />
        )
      },
      {
        title: 'Pack Qty',
        dataIndex: 'packQty',
        key: 'packQty',
        width: 100,
        render: (val: number, record: any) => (
          <InputNumber style={{ width: '100%' }} value={val} min={0} precision={2} onChange={(v) => updateLine(record.key, 'packQty', v)} />
        )
      },
      {
        title: 'Packing',
        dataIndex: 'packing',
        key: 'packing',
        width: 100,
        render: (val: number, record: any) => (
          <InputNumber style={{ width: '100%' }} value={val} min={0} precision={2} onChange={(v) => updateLine(record.key, 'packing', v)} />
        )
      }
    ] : []),
    {
      title: hasVariablePackFeature ? 'Rate (/Kg)' : (hasSecondaryQty ? 'Single Rate' : 'Rate'),
      dataIndex: 'rate',
      key: 'rate',
      width: 120,
      render: (val: number, record: any) => (
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0}
          precision={4}
          step={0.01}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={(v) => updateLine(record.key, 'rate', v)}
        />
      )
    },
    ...((hasSecondaryQty || hasVariablePackFeature) ? [
      {
        title: hasVariablePackFeature ? 'Bag Rate' : 'Pack Rate',
        dataIndex: 'secRate',
        key: 'secRate',
        width: 120,
        render: (val: number, record: any) => (
          <InputNumber
            style={{ width: '100%' }}
            value={val}
            min={0}
            precision={4}
            step={0.01}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            onChange={(v) => updateLine(record.key, 'secRate', v)}
          />
        )
      }
    ] : []),
    ...(hasSecondaryQty && !hasVariablePackFeature ? [
      {
        title: 'Pack Qty',
        dataIndex: 'secQty',
        key: 'secQty',
        width: 100,
        render: (val: number, record: any) => (
          <InputNumber style={{ width: '100%' }} value={val} min={0} onChange={(v) => updateLine(record.key, 'secQty', v)} />
        )
      }
    ] : []),
    {
      title: 'Disc',
      dataIndex: 'discount',
      key: 'discount',
      width: 100,
      render: (val: number, record: any) => (
        <InputNumber style={{ width: '100%' }} value={val} min={0} onChange={(v) => updateLine(record.key, 'discount', v)} />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right' as const,
      render: (val: number) => <Text strong>{(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: any, record: any) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => handleRemoveRow(record.key, record.seq)}
          disabled={saleLines.length === 1}
        />
      )
    }
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/sale-return')} type="text" />
          <UndoOutlined style={{ fontSize: 24, color: '#e11d48' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit Sale Return: SR-${voucherNo}` : 'New Sale Return'}
            </Title>
            <Text type="secondary">{isEdit ? 'Modify existing sale return' : 'Process a customer return'}</Text>
          </div>
        </Space>
        <Space>
          {isEdit && (
            <Popconfirm title="Delete this return?" onConfirm={handleDelete}>
              <Button danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          )}
          <Button type="primary" danger icon={<SaveOutlined />} onClick={handleSave} loading={loading}>
            Save Return
          </Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Voucher #">
              <Input value={isEdit ? `SR-${voucherNo}` : ''} readOnly style={{ backgroundColor: '#f5f5f5' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Date" name="date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={8}>
            <Form.Item label="Customer" name="account" rules={[{ required: true }]}>
              <Select showSearch placeholder="Select Customer" prefix={<UserOutlined />} optionFilterProp="children">
                {customers.map(c => (
                  <Select.Option key={c.account} value={c.account}>{c.title}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={24} lg={8}>
            <Form.Item label="Narration" name="narration">
              <Select showSearch placeholder="Select narration" prefix={<FileTextOutlined />} allowClear>
                {narrations.map(n => (
                  <Select.Option key={n.code} value={n.code}>{n.title}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} lg={24}>
            <Form.Item label="Description" name="description">
              <Input placeholder="Additional return details..." />
            </Form.Item>
          </Col>
        </Row>

        <div className="flex justify-between items-center mb-4 mt-2">
          <Title level={5} style={{ margin: 0 }}>Return Items</Title>
          <Button type="dashed" onClick={handleAddRow} icon={<PlusOutlined />}>Add Row</Button>
        </div>
        
        <Table
          dataSource={saleLines}
          columns={columns}
          pagination={false}
          rowKey="key"
          size="small"
          bordered
          className="mb-6"
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5} align="right"><b>Total Refund Amount</b></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong style={{ color: '#e11d48' }}>Rs. {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}></Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Form>
    </Card>
  );
};
