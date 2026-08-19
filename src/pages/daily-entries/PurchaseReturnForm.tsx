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
import { purchaseReturnService } from '../../services/purchaseReturnService';
import { inventoryService, type Item, type Unit } from '../../services/inventoryService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, type NarrationDto } from '../../services/narrationService';

import { useAppStore } from '../../stores/useAppStore';
import { round } from '../../utils/numberUtils';

const { Title, Text } = Typography;

export const PurchaseReturnForm: React.FC = () => {
  const { licenses, currentTenantIdentifier } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const hasSecondaryQty = currentOrg?.hasSecondaryQty ?? false;
  const hasVariablePackFeature = currentOrg?.hasVariablePackFeature ?? false;

  const { voucherNo } = useParams<{ voucherNo: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [vendors, setVendors] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [purchaseLines, setPurchaseLines] = useState<any[]>([]);

  const isEdit = !!voucherNo && voucherNo !== 'new';

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [itemsRes, unitsRes, vendorsRes, narrsRes] = await Promise.all([
          inventoryService.getItemsLookup(),
          inventoryService.getUnitsLookup(),
          chartOfAccountService.getDetailAccounts(),
          narrationService.getActiveNarrationsLookup()
        ]);
        setItems(itemsRes);
        setUnits(unitsRes);
        setVendors(vendorsRes);
        setNarrations(narrsRes);
      } catch (error) {
        message.error('Failed to load lookups');
      }
    };
    fetchLookups();
  }, []);

  useEffect(() => {
    if (isEdit) {
      const loadPurchase = async () => {
        try {
          setLoading(true);
          const details = await purchaseReturnService.getDetail(voucherNo!);
          if (details && details.length > 0) {
             const first = details[0];
             form.setFieldsValue({
               date: dayjs(first.date),
               account: first.accountId,
               narration: first.narrationId,
               description: first.description
             });
             setPurchaseLines(details.map((d, i) => ({
               key: i,
               seq: d.seq,
               itemId: d.itemId,
               unit: d.unit,
               qty: d.qty,
               rate: d.rate,
               addLess: d.addLess,
               amount: d.amount,
               secQty: d.secQty,
               secRate: d.secRate,
               secUnit: d.secUnit,
               packQty: (d as any).qtyInPack || ((d.qty > 0 && d.secQty && d.secQty > 0) ? round(d.qty / d.secQty, 2) : 0),
               packing: (d as any).packing || 0
             })));
           }
         } catch (error) {
           message.error('Failed to load return details');
           navigate('/daily-entries/purchase-return');
         } finally {
           setLoading(false);
         }
       };
       loadPurchase();
     } else {
       form.setFieldsValue({ date: dayjs() });
       setPurchaseLines([{
         key: Date.now(),
         seq: 1,
         itemId: undefined,
         unit: undefined,
         qty: 1,
         rate: 0,
         addLess: 0,
         amount: 0,
         secQty: 0,
         secRate: 0,
         packQty: 0,
         packing: 0
       }]);
     }
   }, [isEdit, voucherNo, form, navigate]);
 
   const addRow = () => {
     const maxSeq = purchaseLines.reduce((max, row) => Math.max(max, row.seq || 0), 0);
     const newRow = {
       key: Date.now(),
       seq: maxSeq + 1,
       itemId: undefined,
       unit: undefined,
       qty: 1,
       rate: 0,
       addLess: 0,
       amount: 0,
       secQty: 0,
       secRate: 0,
       packQty: 0,
       packing: 0
     };
     setPurchaseLines([...purchaseLines, newRow]);
   };

  const removeRow = async (record: any) => {
    if (isEdit && record.seq) {
      try {
        await purchaseReturnService.deleteLine(voucherNo!, record.seq);
      } catch (error) {
        message.error('Failed to delete line');
        return;
      }
    }
    setPurchaseLines(purchaseLines.filter(row => row.key !== record.key));
  };

  const updateRow = (key: any, field: string, value: any) => {
    setPurchaseLines(prev => {
      const updatedLines = prev.map(row => {
        if (row.key === key) {
          const updatedRow = { ...row, [field]: value };
          if (field === 'itemId') {
            const item = items.find(i => String(i.id) === String(value));
            if (item) {
              updatedRow.unit = item.defaultUnit || item.primaryUnit;
              updatedRow.rate = item.priRate;
              updatedRow.secUnit = item.secondaryUnit;
              const pSize = Number(item.qtyInPack || (item as any).QtyInPack || (item as any).qty_in_pack || 0);
              updatedRow.packQty = pSize;
              updatedRow.packing = pSize;
              updatedRow.secRate = item.secRate || 0;
              updatedRow.secQty = 0;
            }
          }

          const cleanVal = typeof value === 'string' ? value.replace(/,/g, '') : value;
          const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;

          if (hasVariablePackFeature) {
            let kgQty = updatedRow.qty || 0;
            let bagQty = updatedRow.secQty || 0;
            let packQty = updatedRow.packQty || 0;
            let packing = updatedRow.packing || 0;
            let kgRate = updatedRow.rate || 0;
            let bagRate = updatedRow.secRate || 0;

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

            updatedRow.qty = round(kgQty, 2);
            updatedRow.secQty = round(bagQty, 2);
            updatedRow.packQty = round(packQty, 2);
            updatedRow.packing = round(packing, 2);
            updatedRow.rate = round(kgRate, 4);
            updatedRow.secRate = round(bagRate, 4);
          }

          const qty = updatedRow.qty || 0;
          const rate = updatedRow.rate || 0;
          const addLess = updatedRow.addLess || 0;
          const secQty = updatedRow.secQty || 0;
          const secRate = updatedRow.secRate || 0;
          updatedRow.amount = hasVariablePackFeature
            ? round((qty * rate) + addLess, 2)
            : round((qty * rate) + addLess + (secQty * secRate), 2);
          return updatedRow;
        }
        return row;
      });

      const lastRow = updatedLines[updatedLines.length - 1];
      if (lastRow.key === key && lastRow.itemId && lastRow.qty > 0) {
        const maxSeq = updatedLines.reduce((max, row) => Math.max(max, row.seq || 0), 0);
        return [...updatedLines, {
          key: Date.now() + 1,
          seq: maxSeq + 1,
          itemId: undefined,
          unit: undefined,
          qty: 1,
          rate: 0,
          addLess: 0,
          amount: 0,
          secQty: 0,
          secRate: 0,
          packQty: 0,
          packing: 0
        }];
      }
      return updatedLines;
    });
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await purchaseReturnService.delete(voucherNo!);
      message.success('Purchase return deleted successfully');
      navigate('/daily-entries/purchase-return');
    } catch (error) {
      message.error('Failed to delete return');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validLines = purchaseLines.filter(l => l.itemId && l.qty > 0);
      if (validLines.length === 0) {
        message.warning('Please add at least one item');
        return;
      }

      setLoading(true);
      const request = {
        date: values.date.format('YYYY-MM-DD'),
        account: values.account,
        narration: values.narration,
        description: values.description,
        lines: validLines.map(l => ({
          seq: l.seq,
          itemId: l.itemId,
          unit: l.unit || null,
          qty: l.qty,
          rate: l.rate,
          addLess: l.addLess,
          secUnit: l.secUnit || null,
          secQty: l.secQty || 0,
          secRate: l.secRate || 0,
          qtyInPack: l.packQty || l.qtyInPack || null,
          packing: l.packing || null
        }))
      };

      if (isEdit) {
        await purchaseReturnService.update(voucherNo!, request);
        message.success('Purchase return updated successfully');
      } else {
        const newVNo = await purchaseReturnService.create(request);
        message.success('Purchase return created successfully');
        navigate(`/daily-entries/purchase-return/${newVNo}`);
      }
    } catch (error: any) {
      message.error('Failed to save purchase return');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Item',
      dataIndex: 'itemId',
      render: (text: string, record: any) => (
        <Select
          showSearch
          placeholder="Select Item"
          value={text}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.key, 'itemId', val)}
          optionFilterProp="children"
        >
          {items.map(item => (
            <Select.Option key={item.id} value={item.id}>{item.title}</Select.Option>
          ))}
        </Select>
      )
    },
    ...(!hasSecondaryQty ? [
      {
        title: 'Unit',
        dataIndex: 'unit',
        width: 120,
        render: (text: string, record: any) => {
          const item = items.find(i => i.id === record.itemId);
          const filteredUnits = units.filter(u => u.code === item?.primaryUnit || u.code === item?.secondaryUnit);
          return (
            <Select
              value={text}
              style={{ width: '100%' }}
              onChange={(val) => updateRow(record.key, 'unit', val)}
              disabled={!record.itemId}
            >
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
      width: 100,
      render: (text: number, record: any) => (
        <InputNumber value={text} style={{ width: '100%' }} onChange={(val) => updateRow(record.key, 'qty', val)} min={0} precision={2} />
      )
    },
    ...(hasVariablePackFeature ? [
      {
        title: 'Bag Qty',
        dataIndex: 'secQty',
        width: 100,
        render: (text: number, record: any) => (
          <InputNumber value={text} style={{ width: '100%' }} onChange={(val) => updateRow(record.key, 'secQty', val)} min={0} precision={2} />
        )
      },
      {
        title: 'Pack Qty',
        dataIndex: 'packQty',
        width: 100,
        render: (text: number, record: any) => (
          <InputNumber value={text} style={{ width: '100%' }} onChange={(val) => updateRow(record.key, 'packQty', val)} min={0} precision={2} />
        )
      },
      {
        title: 'Packing',
        dataIndex: 'packing',
        width: 100,
        render: (text: number, record: any) => (
          <InputNumber value={text} style={{ width: '100%' }} onChange={(val) => updateRow(record.key, 'packing', val)} min={0} precision={2} />
        )
      }
    ] : []),
    {
      title: hasVariablePackFeature ? 'Rate (/Kg)' : (hasSecondaryQty ? 'Single Rate' : 'Rate'),
      dataIndex: 'rate',
      width: 120,
      render: (text: number, record: any) => (
        <InputNumber
          value={text}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.key, 'rate', val)}
          min={0}
          precision={4}
          step={0.01}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        />
      )
    },
    ...((hasSecondaryQty || hasVariablePackFeature) ? [
      {
        title: hasVariablePackFeature ? 'Bag Rate' : 'Pack Rate',
        dataIndex: 'secRate',
        width: 120,
        render: (text: number, record: any) => (
          <InputNumber
            style={{ width: '100%' }}
            value={text}
            onChange={(val) => updateRow(record.key, 'secRate', val)}
            min={0}
            precision={4}
            step={0.01}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          />
        )
      }
    ] : []),
    ...(hasSecondaryQty && !hasVariablePackFeature ? [
      {
        title: 'Pack Qty',
        dataIndex: 'secQty',
        width: 100,
        render: (text: number, record: any) => (
          <InputNumber value={text} style={{ width: '100%' }} onChange={(val) => updateRow(record.key, 'secQty', val)} min={0} />
        )
      }
    ] : []),
    {
      title: 'Add/Less',
      dataIndex: 'addLess',
      width: 100,
      render: (text: number, record: any) => (
        <InputNumber value={text} style={{ width: '100%' }} onChange={(val) => updateRow(record.key, 'addLess', val)} />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: 150,
      align: 'right' as const,
      render: (val: number) => <Text strong>{val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
    },
    {
      title: '',
      width: 60,
      render: (_: any, record: any) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => removeRow(record)} 
          disabled={purchaseLines.length === 1}
        />
      )
    }
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/purchase-return')} type="text" />
          <UndoOutlined style={{ fontSize: 24, color: '#e11d48' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit Purchase Return: PR-${voucherNo}` : 'New Purchase Return'}
            </Title>
            <Text type="secondary">{isEdit ? 'Modify existing purchase return' : 'Record a return to vendor'}</Text>
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
              <Input value={isEdit ? `PR-${voucherNo}` : ''} readOnly style={{ backgroundColor: '#f5f5f5' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Date" name="date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={8}>
            <Form.Item label="Vendor / Supplier" name="account" rules={[{ required: true }]}>
              <Select showSearch placeholder="Select Vendor" prefix={<UserOutlined />} optionFilterProp="children">
                {vendors.map(v => (
                  <Select.Option key={v.account} value={v.account}>{v.title}</Select.Option>
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
          <Button type="dashed" icon={<PlusOutlined />} onClick={addRow}>Add Row</Button>
        </div>

        <Table
          dataSource={purchaseLines}
          columns={columns}
          pagination={false}
          size="small"
          bordered
          className="mb-4"
          summary={pageData => {
            let totalAmount = 0;
            pageData.forEach(({ amount }) => {
              totalAmount += amount || 0;
            });
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5} align="right"><b>Total Return Amount</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong style={{ color: '#e11d48' }}>Rs. {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Form>
    </Card>
  );
};
