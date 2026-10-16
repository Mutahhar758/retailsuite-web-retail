import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Modal, Button, Space, Typography, Table, Tag, Tooltip, message,
  Input, InputNumber, Select, Switch, Row, Col, Card, Alert, Radio,
  Popconfirm
} from 'antd';
import {
  DownloadOutlined, UploadOutlined, SnippetsOutlined, PlusOutlined,
  DeleteOutlined, SaveOutlined,
  ExclamationCircleOutlined, SyncOutlined, ClearOutlined, FileExcelOutlined
} from '@ant-design/icons';
import { parseCsv, parseClipboardTable, toCsv, downloadCsv } from '../../utils/csvUtils';
import { customerService, type CustomerBulkItemDto, type BulkOperationResult } from '../../services/customerService';
import { vendorService, type VendorBulkItemDto } from '../../services/vendorService';
import { inventoryService, type InventoryItemBulkItemDto } from '../../services/inventoryService';
import { hrInfoService, type HRInfoBulkItemDto } from '../../services/hrInfoService';
import { itemCategoryService, type ItemCategoryDto } from '../../services/itemCategoryService';
import { unitService, type UnitDto } from '../../services/unitService';
import { brandService, type BrandLookupDto } from '../../services/brandService';

const { Text } = Typography;
const { TextArea } = Input;

export type BulkEntityType = 'customers' | 'products' | 'vendors' | 'employees';

interface BulkOperationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  entityType: BulkEntityType;
}

export const BulkOperationModal: React.FC<BulkOperationModalProps> = ({
  visible,
  onClose,
  onSuccess,
  entityType,
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'new' | 'update' | 'error'>('all');
  const [pasteModalVisible, setPasteModalVisible] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Lookups for products
  const [categories, setCategories] = useState<ItemCategoryDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [brands, setBrands] = useState<BrandLookupDto[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load lookups when modal opens if products
  useEffect(() => {
    if (visible && entityType === 'products') {
      Promise.all([
        itemCategoryService.getActiveItemCategories().catch(() => []),
        unitService.getActiveUnits().catch(() => []),
        brandService.getActiveBrands().catch(() => [])
      ]).then(([cat, un, br]) => {
        setCategories(cat);
        setUnits(un);
        setBrands(br);
      });
    }
  }, [visible, entityType]);

  // Reset state when entityType changes or modal opens
  useEffect(() => {
    if (visible) {
      setRows([]);
      setFilterMode('all');
      setPasteText('');
    }
  }, [visible, entityType]);

  // Entity Title & Description
  const entityMeta = useMemo(() => {
    switch (entityType) {
      case 'customers':
        return {
          title: 'Customers',
          idField: 'account',
          idLabel: 'Account Code',
          sampleHeaders: ['Account', 'Title', 'Phone1', 'Phone2', 'Email', 'CNIC', 'Address', 'Qualification', 'Active'],
          sampleData: [
            ['', 'Sample Customer', '03001234567', '', 'sample@example.com', '35201-1234567-1', 'Gulberg III, Lahore', '', 'true'],
            ['102001', 'Existing Customer Ltd', '03217654321', '', 'corp@example.com', '', 'Main Boulevard', '', 'true']
          ]
        };
      case 'vendors':
        return {
          title: 'Vendors / Suppliers',
          idField: 'account',
          idLabel: 'Account Code',
          sampleHeaders: ['Account', 'Title', 'Phone1', 'Phone2', 'Email', 'CNIC', 'Address', 'ShowInSales', 'Active'],
          sampleData: [
            ['', 'Global Traders', '03007654321', '', 'supplier@global.com', 'NTN-12345', 'Industrial Estate', 'false', 'true'],
            ['201001', 'Prime Distributors', '03211122334', '', 'info@prime.com', '', 'Railway Road', 'false', 'true']
          ]
        };
      case 'products':
        return {
          title: 'Products (Inventory Items)',
          idField: 'id',
          idLabel: 'Item ID',
          sampleHeaders: [
            'Id', 'Barcode', 'ItemCategoryCode', 'Title', 'BrandId',
            'PrimaryUnit', 'SecondaryUnit', 'QtyInPack', 'PriRate',
            'SecRate', 'OpnStock', 'OpnRate'
          ],
          sampleData: [
            ['', '', '01', 'Cooking Oil 1L', '', 'PCS', '', '1', '450', '450', '50', '380'],
            ['', '', '01', 'Basmati Rice 5kg', '', 'KG', '', '1', '1200', '1200', '100', '1050'],
            ['000001', '1000001', '01', 'Sugar 1kg Pack', '', 'KG', '', '1', '150', '150', '0', '0']
          ]
        };
      case 'employees':
        return {
          title: 'Employees (HR Info)',
          idField: 'id',
          idLabel: 'Employee ID',
          sampleHeaders: ['Id', 'Name', 'FatherName', 'Gender', 'Dob', 'Cnic', 'Designation', 'SalaryType', 'Salary', 'JoiningDate'],
          sampleData: [
            ['', 'Muhammad Ali', 'Ahmed Ali', 'Male', '1995-05-12', '35202-1234567-1', 'Sales Manager', 'Monthly', '50000', '2024-01-15'],
            ['001', 'Fatima Zahra', 'Tariq Khan', 'Female', '1998-09-20', '35202-9876543-2', 'Accountant', 'Monthly', '60000', '2023-06-01']
          ]
        };
    }
  }, [entityType]);

  // Row validation logic
  const validateRow = useCallback((row: any) => {
    const errors: string[] = [];
    if (entityType === 'customers' || entityType === 'vendors') {
      if (!row.title || !String(row.title).trim()) {
        errors.push('Name/Title is required');
      }
    } else if (entityType === 'products') {
      if (!row.title || !String(row.title).trim()) {
        errors.push('Product Title is required');
      }
      if (!row.itemCategoryCode || !String(row.itemCategoryCode).trim()) {
        errors.push('Category is required');
      }
      if (!row.primaryUnit || !String(row.primaryUnit).trim()) {
        errors.push('Primary Unit is required');
      }
    } else if (entityType === 'employees') {
      if (!row.name || !String(row.name).trim()) {
        errors.push('Employee Name is required');
      }
    }
    return errors;
  }, [entityType]);

  // Enhance row with status and errors
  const processedRows = useMemo(() => {
    return rows.map((row, index) => {
      const idVal = (row[entityMeta.idField] || '').trim();
      const isUpdate = Boolean(idVal && idVal !== '0');
      const errors = validateRow(row);
      const isError = errors.length > 0;
      const status: 'new' | 'update' | 'error' = isError ? 'error' : isUpdate ? 'update' : 'new';

      return {
        ...row,
        _key: row._key || `row-${index}-${Date.now()}`,
        _rowIndex: index + 1,
        _status: status,
        _errors: errors
      };
    });
  }, [rows, entityMeta.idField, validateRow]);

  // Filtered rows for display
  const displayRows = useMemo(() => {
    if (filterMode === 'all') return processedRows;
    return processedRows.filter(r => r._status === filterMode);
  }, [processedRows, filterMode]);

  // Statistics
  const stats = useMemo(() => {
    const total = processedRows.length;
    const newCount = processedRows.filter(r => r._status === 'new').length;
    const updateCount = processedRows.filter(r => r._status === 'update').length;
    const errorCount = processedRows.filter(r => r._status === 'error').length;
    return { total, newCount, updateCount, errorCount };
  }, [processedRows]);

  // Handle cell edit
  const handleCellChange = (rowIndex: number, field: string, value: any) => {
    setRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [field]: value };
      return next;
    });
  };

  // Add row
  const handleAddRow = () => {
    const newRow: any = { _key: `row-new-${Date.now()}` };
    if (entityType === 'customers' || entityType === 'vendors') {
      newRow.title = '';
      newRow.active = true;
    } else if (entityType === 'products') {
      newRow.title = '';
      newRow.itemCategoryCode = categories[0]?.code || '';
      newRow.primaryUnit = units[0]?.code || '';
      newRow.qtyInPack = 1;
      newRow.priRate = 0;
      newRow.secRate = 0;
      newRow.opnStock = 0;
      newRow.opnRate = 0;
    } else if (entityType === 'employees') {
      newRow.name = '';
      newRow.gender = 'Male';
      newRow.salaryType = 'Monthly';
      newRow.salary = 0;
    }
    setRows(prev => [...prev, newRow]);
  };

  // Delete row
  const handleDeleteRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  // Download sample CSV template
  const handleDownloadTemplate = () => {
    const csv = toCsv(entityMeta.sampleHeaders, entityMeta.sampleData);
    downloadCsv(`${entityType}_import_template`, csv);
    message.success('Sample template downloaded');
  };

  // Export current active data
  const handleExportCurrent = async () => {
    try {
      setLoading(true);
      let headers: string[] = [];
      let dataRows: any[][] = [];

      if (entityType === 'customers') {
        const list = await customerService.getCustomers();
        headers = ['Account', 'Title', 'Phone1', 'Phone2', 'Email', 'CNIC', 'Address', 'Qualification', 'Active'];
        dataRows = list.map(c => [
          c.account, c.title, c.phone1 || '', c.phone2 || '', c.email || '',
          c.cnic || '', c.address || '', c.qualification || '', c.active ? 'true' : 'false'
        ]);
      } else if (entityType === 'vendors') {
        const list = await vendorService.getVendors();
        headers = ['Account', 'Title', 'Phone1', 'Phone2', 'Email', 'CNIC', 'Address', 'ShowInSales', 'Active'];
        dataRows = list.map(v => [
          v.account, v.title, v.phone1 || '', v.phone2 || '', v.email || '',
          v.cnic || '', v.address || '', v.showInSales ? 'true' : 'false', v.active ? 'true' : 'false'
        ]);
      } else if (entityType === 'products') {
        const list = await inventoryService.getItemsLookup();
        headers = ['Id', 'Barcode', 'ItemCategoryCode', 'Title', 'BrandId', 'PrimaryUnit', 'SecondaryUnit', 'QtyInPack', 'PriRate', 'SecRate', 'OpnStock', 'OpnRate'];
        dataRows = list.map(p => [
          p.id, p.barcode || '', p.itemCategoryCode || '', p.title, p.brandId || '',
          p.primaryUnit || '', p.secondaryUnit || '', p.qtyInPack ?? 1, p.priRate, p.secRate,
          p.opnStock ?? 0, p.opnRate ?? 0
        ]);
      } else if (entityType === 'employees') {
        const list = await hrInfoService.getHRInfos();
        headers = ['Id', 'Name', 'FatherName', 'Gender', 'Dob', 'Cnic', 'Designation', 'SalaryType', 'Salary', 'JoiningDate'];
        dataRows = list.map(e => [
          e.id, e.name, e.fatherName || '', e.gender || '', e.dob || '',
          e.cnic || '', e.designation || '', e.salaryType || '', e.salary, e.joiningDate || ''
        ]);
      }

      const csv = toCsv(headers, dataRows);
      downloadCsv(`${entityType}_current_export`, csv);
      message.success(`Exported ${dataRows.length} ${entityMeta.title}`);
    } catch {
      message.error(`Failed to export ${entityMeta.title}`);
    } finally {
      setLoading(false);
    }
  };

  // Convert raw tabular matrix (headers + rows) into object records
  const loadTabularMatrix = (matrix: string[][]) => {
    if (matrix.length < 2) {
      message.warning('File or pasted text must contain a header row and at least one data row.');
      return;
    }

    const rawHeaders = matrix[0].map(h => h.trim().toLowerCase().replace(/[\s_-]/g, ''));
    const dataLines = matrix.slice(1);

    const mapped = dataLines.map((line, idx) => {
      const rowObj: any = { _key: `row-${idx}-${Date.now()}` };
      rawHeaders.forEach((h, colIndex) => {
        const val = line[colIndex]?.trim() ?? '';
        // Map common synonyms
        if (h === 'account' || h === 'accountcode' || h === 'code') {
          rowObj.account = val;
        } else if (h === 'id' || h === 'itemid' || h === 'productid' || h === 'empid' || h === 'employeeid') {
          rowObj.id = val;
        } else if (h === 'title' || h === 'name' || h === 'customername' || h === 'vendorname' || h === 'productname' || h === 'employeename') {
          rowObj.title = val;
          rowObj.name = val;
        } else if (h === 'phone' || h === 'phone1' || h === 'mobile' || h === 'contact') {
          rowObj.phone1 = val;
        } else if (h === 'phone2' || h === 'tel' || h === 'telephone') {
          rowObj.phone2 = val;
        } else if (h === 'email') {
          rowObj.email = val;
        } else if (h === 'cnic' || h === 'ntn') {
          rowObj.cnic = val;
        } else if (h === 'address') {
          rowObj.address = val;
        } else if (h === 'qualification') {
          rowObj.qualification = val;
        } else if (h === 'barcode') {
          rowObj.barcode = val;
        } else if (h === 'itemcategorycode' || h === 'categorycode' || h === 'category') {
          rowObj.itemCategoryCode = val;
        } else if (h === 'primaryunit' || h === 'unit' || h === 'punit') {
          rowObj.primaryUnit = val;
        } else if (h === 'secondaryunit' || h === 'sunit') {
          rowObj.secondaryUnit = val;
        } else if (h === 'qtyinpack' || h === 'packqty' || h === 'pack') {
          rowObj.qtyInPack = parseFloat(val) || 1;
        } else if (h === 'prirate' || h === 'rate' || h === 'price' || h === 'saleprice') {
          rowObj.priRate = parseFloat(val) || 0;
        } else if (h === 'secrate' || h === 'unitrate') {
          rowObj.secRate = parseFloat(val) || 0;
        } else if (h === 'opnstock' || h === 'openingstock' || h === 'stock' || h === 'qty') {
          rowObj.opnStock = parseFloat(val) || 0;
        } else if (h === 'opnrate' || h === 'openingrate' || h === 'cost' || h === 'costrate') {
          rowObj.opnRate = parseFloat(val) || 0;
        } else if (h === 'fathername') {
          rowObj.fatherName = val;
        } else if (h === 'gender') {
          rowObj.gender = val;
        } else if (h === 'dob') {
          rowObj.dob = val;
        } else if (h === 'designation' || h === 'role') {
          rowObj.designation = val;
        } else if (h === 'salarytype') {
          rowObj.salaryType = val;
        } else if (h === 'salary' || h === 'basicsalary') {
          rowObj.salary = parseFloat(val) || 0;
        } else if (h === 'joiningdate' || h === 'doj') {
          rowObj.joiningDate = val;
        } else if (h === 'active') {
          rowObj.active = val.toLowerCase() !== 'false' && val !== '0';
        } else if (h === 'showinsales') {
          rowObj.showInSales = val.toLowerCase() === 'true' || val === '1';
        }
      });
      return rowObj;
    });

    setRows(mapped);
    message.success(`Loaded ${mapped.length} rows into the grid`);
  };

  // Upload CSV handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const matrix = parseCsv(content);
        loadTabularMatrix(matrix);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Process paste modal submit
  const handleApplyPaste = () => {
    if (!pasteText.trim()) {
      message.warning('Please paste data into the textarea first.');
      return;
    }
    const matrix = parseClipboardTable(pasteText);
    loadTabularMatrix(matrix);
    setPasteModalVisible(false);
    setPasteText('');
  };

  // Submit Batch
  const handleSaveBatch = async () => {
    if (processedRows.length === 0) {
      message.warning('There are no rows to save.');
      return;
    }

    const errorRows = processedRows.filter(r => r._status === 'error');
    if (errorRows.length > 0) {
      Modal.confirm({
        title: `${errorRows.length} Invalid Row(s) Detected`,
        content: `There are ${errorRows.length} rows with missing required fields. Do you want to remove invalid rows and save the remaining ${processedRows.length - errorRows.length} valid rows?`,
        okText: 'Remove Invalid & Save',
        cancelText: 'Review Errors',
        okButtonProps: { danger: true },
        onOk: () => {
          const validOnly = processedRows.filter(r => r._status !== 'error');
          executeBulkUpsert(validOnly);
        }
      });
      return;
    }

    executeBulkUpsert(processedRows);
  };

  const executeBulkUpsert = async (validRows: any[]) => {
    try {
      setSaving(true);
      let result: BulkOperationResult;

      if (entityType === 'customers') {
        const payload: CustomerBulkItemDto[] = validRows.map(r => ({
          account: r.account?.trim() || undefined,
          title: r.title?.trim() || '',
          phone1: r.phone1 || undefined,
          phone2: r.phone2 || undefined,
          email: r.email || undefined,
          cnic: r.cnic || undefined,
          address: r.address || undefined,
          qualification: r.qualification || undefined,
          active: r.active ?? true
        }));
        result = await customerService.bulkUpsert({ customers: payload });
      } else if (entityType === 'vendors') {
        const payload: VendorBulkItemDto[] = validRows.map(r => ({
          account: r.account?.trim() || undefined,
          title: r.title?.trim() || '',
          phone1: r.phone1 || undefined,
          phone2: r.phone2 || undefined,
          email: r.email || undefined,
          cnic: r.cnic || undefined,
          address: r.address || undefined,
          qualification: r.qualification || undefined,
          active: r.active ?? true,
          showInSales: r.showInSales ?? false
        }));
        result = await vendorService.bulkUpsert({ vendors: payload });
      } else if (entityType === 'products') {
        const payload: InventoryItemBulkItemDto[] = validRows.map(r => ({
          id: r.id?.trim() || undefined,
          barcode: r.barcode?.trim() || undefined,
          itemCategoryCode: r.itemCategoryCode?.trim() || '',
          title: r.title?.trim() || '',
          brandId: r.brandId?.trim() || undefined,
          primaryUnit: r.primaryUnit?.trim() || '',
          secondaryUnit: r.secondaryUnit?.trim() || undefined,
          qtyInPack: r.qtyInPack ? Number(r.qtyInPack) : 1,
          priRate: r.priRate ? Number(r.priRate) : 0,
          secRate: r.secRate ? Number(r.secRate) : 0,
          opnStock: r.opnStock ? Number(r.opnStock) : 0,
          opnRate: r.opnRate ? Number(r.opnRate) : 0
        }));
        result = await inventoryService.bulkUpsert({ items: payload });
      } else {
        const payload: HRInfoBulkItemDto[] = validRows.map(r => ({
          id: r.id?.trim() || undefined,
          name: r.name?.trim() || '',
          fatherName: r.fatherName?.trim() || undefined,
          gender: r.gender || 'Male',
          dob: r.dob || undefined,
          cnic: r.cnic || undefined,
          designation: r.designation || undefined,
          salaryType: r.salaryType || 'Monthly',
          salary: r.salary ? Number(r.salary) : 0,
          joiningDate: r.joiningDate || undefined
        }));
        result = await hrInfoService.bulkUpsert({ employees: payload });
      }

      if (result.errors && result.errors.length > 0) {
        Modal.error({
          title: 'Bulk Operation Completed with Issues',
          content: (
            <div>
              <p>
                <strong>Created:</strong> {result.createdCount} | <strong>Updated:</strong> {result.updatedCount} | <strong>Failed:</strong> {result.failedCount}
              </p>
              <ul style={{ maxHeight: '200px', overflowY: 'auto', paddingLeft: '20px' }}>
                {result.errors.map((e, idx) => (
                  <li key={idx} style={{ color: '#ff4d4f' }}>
                    Row #{e.rowIndex} ({e.identifier}): {e.errorMessage}
                  </li>
                ))}
              </ul>
            </div>
          )
        });
      } else {
        message.success(`Successfully saved! ${result.createdCount} created, ${result.updatedCount} updated.`);
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      message.error(err?.response?.data?.metadata?.message || err?.message || 'Failed to execute bulk save');
    } finally {
      setSaving(false);
    }
  };

  // Columns definition based on entityType
  const columns: any[] = useMemo(() => {
    const baseCols: any[] = [
      {
        title: '#',
        dataIndex: '_rowIndex',
        key: '_rowIndex',
        width: 60,
        align: 'center',
        render: (idx: number) => <Text type="secondary" style={{ fontSize: '12px' }}>{idx}</Text>
      },
      {
        title: 'Status',
        key: '_status',
        width: 100,
        align: 'center',
        render: (_: any, record: any) => {
          if (record._status === 'error') {
            return (
              <Tooltip title={record._errors.join(', ')}>
                <Tag color="error" icon={<ExclamationCircleOutlined />} style={{ cursor: 'pointer' }}>
                  ERROR
                </Tag>
              </Tooltip>
            );
          }
          if (record._status === 'update') {
            return (
              <Tag color="processing" icon={<SyncOutlined spin={false} />}>
                UPDATE
              </Tag>
            );
          }
          return (
            <Tag color="success" icon={<PlusOutlined />}>
              + NEW
            </Tag>
          );
        }
      }
    ];

    if (entityType === 'customers' || entityType === 'vendors') {
      baseCols.push(
        {
          title: 'Account Code',
          dataIndex: 'account',
          key: 'account',
          width: 130,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="Auto-assigned"
              size="small"
              style={{ fontFamily: 'monospace' }}
              onChange={e => handleCellChange(idx, 'account', e.target.value)}
            />
          )
        },
        {
          title: 'Name / Title *',
          dataIndex: 'title',
          key: 'title',
          width: 200,
          render: (val: string, _: any, idx: number) => {
            const hasError = !val || !val.trim();
            return (
              <Tooltip title={hasError ? 'Title is required' : ''}>
                <Input
                  value={val}
                  placeholder="Required name"
                  size="small"
                  status={hasError ? 'error' : ''}
                  onChange={e => handleCellChange(idx, 'title', e.target.value)}
                />
              </Tooltip>
            );
          }
        },
        {
          title: 'Phone 1',
          dataIndex: 'phone1',
          key: 'phone1',
          width: 130,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="Phone number"
              size="small"
              onChange={e => handleCellChange(idx, 'phone1', e.target.value)}
            />
          )
        },
        {
          title: 'Phone 2',
          dataIndex: 'phone2',
          key: 'phone2',
          width: 130,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="Alternate phone"
              size="small"
              onChange={e => handleCellChange(idx, 'phone2', e.target.value)}
            />
          )
        },
        {
          title: 'Email',
          dataIndex: 'email',
          key: 'email',
          width: 170,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="Email address"
              size="small"
              onChange={e => handleCellChange(idx, 'email', e.target.value)}
            />
          )
        },
        {
          title: 'CNIC / NTN',
          dataIndex: 'cnic',
          key: 'cnic',
          width: 140,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="CNIC / NTN"
              size="small"
              onChange={e => handleCellChange(idx, 'cnic', e.target.value)}
            />
          )
        },
        {
          title: 'Address',
          dataIndex: 'address',
          key: 'address',
          width: 200,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="Address"
              size="small"
              onChange={e => handleCellChange(idx, 'address', e.target.value)}
            />
          )
        }
      );

      if (entityType === 'vendors') {
        baseCols.push({
          title: 'Show In Sales',
          dataIndex: 'showInSales',
          key: 'showInSales',
          width: 110,
          align: 'center',
          render: (val: boolean, _: any, idx: number) => (
            <Switch
              size="small"
              checked={Boolean(val)}
              onChange={checked => handleCellChange(idx, 'showInSales', checked)}
            />
          )
        });
      }

      baseCols.push({
        title: 'Active',
        dataIndex: 'active',
        key: 'active',
        width: 80,
        align: 'center',
        render: (val: boolean, _: any, idx: number) => (
          <Switch
            size="small"
            checked={val !== false}
            onChange={checked => handleCellChange(idx, 'active', checked)}
          />
        )
      });
    } else if (entityType === 'products') {
      baseCols.push(
        {
          title: 'Item ID',
          dataIndex: 'id',
          key: 'id',
          width: 120,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="Auto-generated"
              size="small"
              style={{ fontFamily: 'monospace' }}
              onChange={e => handleCellChange(idx, 'id', e.target.value)}
            />
          )
        },
        {
          title: 'Barcode',
          dataIndex: 'barcode',
          key: 'barcode',
          width: 140,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="Auto-generated"
              size="small"
              style={{ fontFamily: 'monospace' }}
              onChange={e => handleCellChange(idx, 'barcode', e.target.value)}
            />
          )
        },
        {
          title: 'Category *',
          dataIndex: 'itemCategoryCode',
          key: 'itemCategoryCode',
          width: 160,
          render: (val: string, _: any, idx: number) => {
            const hasError = !val || !val.trim();
            return (
              <Select
                value={val || undefined}
                placeholder="Select category"
                size="small"
                status={hasError ? 'error' : ''}
                style={{ width: '100%' }}
                onChange={v => handleCellChange(idx, 'itemCategoryCode', v)}
                showSearch
                optionFilterProp="children"
              >
                {categories.map(c => (
                  <Select.Option key={c.code} value={c.code}>
                    {c.title} ({c.code})
                  </Select.Option>
                ))}
              </Select>
            );
          }
        },
        {
          title: 'Product Title *',
          dataIndex: 'title',
          key: 'title',
          width: 200,
          render: (val: string, _: any, idx: number) => {
            const hasError = !val || !val.trim();
            return (
              <Input
                value={val}
                placeholder="Product name"
                size="small"
                status={hasError ? 'error' : ''}
                onChange={e => handleCellChange(idx, 'title', e.target.value)}
              />
            );
          }
        },
        {
          title: 'Brand',
          dataIndex: 'brandId',
          key: 'brandId',
          width: 130,
          render: (val: string, _: any, idx: number) => (
            <Select
              value={val || undefined}
              placeholder="Optional brand"
              size="small"
              allowClear
              style={{ width: '100%' }}
              onChange={v => handleCellChange(idx, 'brandId', v)}
              showSearch
              optionFilterProp="children"
            >
              {brands.map(b => (
                <Select.Option key={b.id} value={b.id}>
                  {b.title}
                </Select.Option>
              ))}
            </Select>
          )
        },
        {
          title: 'Primary Unit *',
          dataIndex: 'primaryUnit',
          key: 'primaryUnit',
          width: 130,
          render: (val: string, _: any, idx: number) => {
            const hasError = !val || !val.trim();
            return (
              <Select
                value={val || undefined}
                placeholder="Unit"
                size="small"
                status={hasError ? 'error' : ''}
                style={{ width: '100%' }}
                onChange={v => handleCellChange(idx, 'primaryUnit', v)}
                showSearch
                optionFilterProp="children"
              >
                {units.map(u => (
                  <Select.Option key={u.code} value={u.code}>
                    {u.title}
                  </Select.Option>
                ))}
              </Select>
            );
          }
        },
        {
          title: 'Sec Unit',
          dataIndex: 'secondaryUnit',
          key: 'secondaryUnit',
          width: 120,
          render: (val: string, _: any, idx: number) => (
            <Select
              value={val || undefined}
              placeholder="Optional"
              size="small"
              allowClear
              style={{ width: '100%' }}
              onChange={v => handleCellChange(idx, 'secondaryUnit', v)}
              showSearch
              optionFilterProp="children"
            >
              {units.map(u => (
                <Select.Option key={u.code} value={u.code}>
                  {u.title}
                </Select.Option>
              ))}
            </Select>
          )
        },
        {
          title: 'Pack Qty',
          dataIndex: 'qtyInPack',
          key: 'qtyInPack',
          width: 90,
          render: (val: number, _: any, idx: number) => (
            <InputNumber
              value={val}
              size="small"
              min={1}
              style={{ width: '100%' }}
              onChange={v => handleCellChange(idx, 'qtyInPack', v)}
            />
          )
        },
        {
          title: 'Sale Rate',
          dataIndex: 'priRate',
          key: 'priRate',
          width: 100,
          render: (val: number, _: any, idx: number) => (
            <InputNumber
              value={val}
              size="small"
              min={0}
              style={{ width: '100%' }}
              onChange={v => handleCellChange(idx, 'priRate', v)}
            />
          )
        },
        {
          title: 'Unit Rate',
          dataIndex: 'secRate',
          key: 'secRate',
          width: 100,
          render: (val: number, _: any, idx: number) => (
            <InputNumber
              value={val}
              size="small"
              min={0}
              style={{ width: '100%' }}
              onChange={v => handleCellChange(idx, 'secRate', v)}
            />
          )
        },
        {
          title: 'Opn Stock',
          dataIndex: 'opnStock',
          key: 'opnStock',
          width: 100,
          render: (val: number, _: any, idx: number) => (
            <InputNumber
              value={val}
              size="small"
              min={0}
              style={{ width: '100%' }}
              onChange={v => handleCellChange(idx, 'opnStock', v)}
            />
          )
        },
        {
          title: 'Opn Rate / Cost',
          dataIndex: 'opnRate',
          key: 'opnRate',
          width: 110,
          render: (val: number, _: any, idx: number) => (
            <InputNumber
              value={val}
              size="small"
              min={0}
              style={{ width: '100%' }}
              onChange={v => handleCellChange(idx, 'opnRate', v)}
            />
          )
        }
      );
    } else if (entityType === 'employees') {
      baseCols.push(
        {
          title: 'Emp ID',
          dataIndex: 'id',
          key: 'id',
          width: 110,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="Auto-assigned"
              size="small"
              style={{ fontFamily: 'monospace' }}
              onChange={e => handleCellChange(idx, 'id', e.target.value)}
            />
          )
        },
        {
          title: 'Employee Name *',
          dataIndex: 'name',
          key: 'name',
          width: 180,
          render: (val: string, _: any, idx: number) => {
            const hasError = !val || !val.trim();
            return (
              <Input
                value={val}
                placeholder="Full name"
                size="small"
                status={hasError ? 'error' : ''}
                onChange={e => handleCellChange(idx, 'name', e.target.value)}
              />
            );
          }
        },
        {
          title: "Father's Name",
          dataIndex: 'fatherName',
          key: 'fatherName',
          width: 150,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="Father's name"
              size="small"
              onChange={e => handleCellChange(idx, 'fatherName', e.target.value)}
            />
          )
        },
        {
          title: 'Gender',
          dataIndex: 'gender',
          key: 'gender',
          width: 110,
          render: (val: string, _: any, idx: number) => (
            <Select
              value={val || 'Male'}
              size="small"
              style={{ width: '100%' }}
              onChange={v => handleCellChange(idx, 'gender', v)}
            >
              <Select.Option value="Male">Male</Select.Option>
              <Select.Option value="Female">Female</Select.Option>
              <Select.Option value="Other">Other</Select.Option>
            </Select>
          )
        },
        {
          title: 'DOB',
          dataIndex: 'dob',
          key: 'dob',
          width: 130,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="YYYY-MM-DD"
              size="small"
              onChange={e => handleCellChange(idx, 'dob', e.target.value)}
            />
          )
        },
        {
          title: 'CNIC',
          dataIndex: 'cnic',
          key: 'cnic',
          width: 140,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="35201-..."
              size="small"
              onChange={e => handleCellChange(idx, 'cnic', e.target.value)}
            />
          )
        },
        {
          title: 'Designation',
          dataIndex: 'designation',
          key: 'designation',
          width: 150,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="Role / Title"
              size="small"
              onChange={e => handleCellChange(idx, 'designation', e.target.value)}
            />
          )
        },
        {
          title: 'Salary Type',
          dataIndex: 'salaryType',
          key: 'salaryType',
          width: 110,
          render: (val: string, _: any, idx: number) => (
            <Select
              value={val || 'Monthly'}
              size="small"
              style={{ width: '100%' }}
              onChange={v => handleCellChange(idx, 'salaryType', v)}
            >
              <Select.Option value="Monthly">Monthly</Select.Option>
              <Select.Option value="Daily">Daily</Select.Option>
              <Select.Option value="Weekly">Weekly</Select.Option>
            </Select>
          )
        },
        {
          title: 'Salary',
          dataIndex: 'salary',
          key: 'salary',
          width: 120,
          render: (val: number, _: any, idx: number) => (
            <InputNumber
              value={val}
              size="small"
              min={0}
              style={{ width: '100%' }}
              onChange={v => handleCellChange(idx, 'salary', v)}
            />
          )
        },
        {
          title: 'Joining Date',
          dataIndex: 'joiningDate',
          key: 'joiningDate',
          width: 130,
          render: (val: string, _: any, idx: number) => (
            <Input
              value={val}
              placeholder="YYYY-MM-DD"
              size="small"
              onChange={e => handleCellChange(idx, 'joiningDate', e.target.value)}
            />
          )
        }
      );
    }

    baseCols.push({
      title: 'Action',
      key: 'action',
      width: 70,
      align: 'center',
      fixed: 'right',
      render: (_: any, __: any, idx: number) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteRow(idx)}
        />
      )
    });

    return baseCols;
  }, [entityType, categories, units, brands]);

  return (
    <>
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileExcelOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
            <div>
              <Text strong style={{ fontSize: '17px' }}>
                Bulk Operations: {entityMeta.title}
              </Text>
              <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#8c8c8c' }}>
                Import from CSV, paste from Excel, or edit directly in the spreadsheet grid below.
              </div>
            </div>
          </div>
        }
        open={visible}
        onCancel={onClose}
        width={1300}
        style={{ top: 20 }}
        footer={null}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* Action Toolbar */}
          <Card size="small" style={{ backgroundColor: '#fafafa', border: '1px solid #f0f0f0' }}>
            <Row justify="space-between" align="middle" gutter={[8, 8]}>
              <Col>
                <Space wrap>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadTemplate}
                    style={{ borderColor: '#d9d9d9' }}
                  >
                    Sample Template (.CSV)
                  </Button>

                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExportCurrent}
                    loading={loading}
                  >
                    Export Current (.CSV)
                  </Button>

                  <Button
                    icon={<UploadOutlined />}
                    type="primary"
                    ghost
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload CSV
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                  />

                  <Button
                    icon={<SnippetsOutlined />}
                    onClick={() => setPasteModalVisible(true)}
                  >
                    Paste from Excel
                  </Button>

                  <Button
                    icon={<PlusOutlined />}
                    onClick={handleAddRow}
                  >
                    Add Row
                  </Button>

                  {rows.length > 0 && (
                    <Popconfirm
                      title="Clear table?"
                      description="This will remove all rows currently in the grid."
                      onConfirm={() => setRows([])}
                      okText="Yes, Clear"
                      cancelText="Cancel"
                    >
                      <Button danger icon={<ClearOutlined />}>
                        Clear All
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              </Col>

              <Col>
                <Space>
                  <Radio.Group
                    size="small"
                    value={filterMode}
                    onChange={e => setFilterMode(e.target.value)}
                  >
                    <Radio.Button value="all">All ({stats.total})</Radio.Button>
                    <Radio.Button value="new">
                      <Tag color="success" style={{ margin: 0 }}>New ({stats.newCount})</Tag>
                    </Radio.Button>
                    <Radio.Button value="update">
                      <Tag color="processing" style={{ margin: 0 }}>Update ({stats.updateCount})</Tag>
                    </Radio.Button>
                    {stats.errorCount > 0 && (
                      <Radio.Button value="error">
                        <Tag color="error" style={{ margin: 0 }}>Errors ({stats.errorCount})</Tag>
                      </Radio.Button>
                    )}
                  </Radio.Group>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Validation Notice if errors */}
          {stats.errorCount > 0 && (
            <Alert
              type="warning"
              showIcon
              message={
                <span>
                  <strong>{stats.errorCount} row(s) have validation errors.</strong> Cells with missing required fields are highlighted. Please update them or click the Errors filter to review.
                </span>
              }
            />
          )}

          {/* Editable Grid Table */}
          <Table
            dataSource={displayRows}
            columns={columns}
            rowKey="_key"
            size="small"
            bordered
            scroll={{ x: 'max-content', y: 440 }}
            pagination={{
              defaultPageSize: 50,
              showSizeChanger: true,
              pageSizeOptions: ['25', '50', '100', '200']
            }}
            locale={{
              emptyText: (
                <div style={{ padding: '30px 0', textAlign: 'center' }}>
                  <Text type="secondary">
                    No records in the grid. Click <strong>"Upload CSV"</strong>, <strong>"Paste from Excel"</strong>, or <strong>"+ Add Row"</strong> to begin.
                  </Text>
                </div>
              )
            }}
          />

          {/* Footer Bar */}
          <Row justify="space-between" align="middle" style={{ marginTop: '8px' }}>
            <Col>
              <Space size="large">
                <Text type="secondary">
                  Total rows: <Text strong>{stats.total}</Text>
                </Text>
                <Text type="secondary">
                  Ready to Create: <Text strong style={{ color: '#52c41a' }}>{stats.newCount}</Text>
                </Text>
                <Text type="secondary">
                  Ready to Update: <Text strong style={{ color: '#1677ff' }}>{stats.updateCount}</Text>
                </Text>
                {stats.errorCount > 0 && (
                  <Text type="danger">
                    Errors: <Text strong style={{ color: '#ff4d4f' }}>{stats.errorCount}</Text>
                  </Text>
                )}
              </Space>
            </Col>

            <Col>
              <Space>
                <Button onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveBatch}
                  loading={saving}
                  disabled={processedRows.length === 0}
                  style={{ minWidth: '150px' }}
                >
                  Save Batch ({stats.total})
                </Button>
              </Space>
            </Col>
          </Row>
        </Space>
      </Modal>

      {/* Paste from Excel Modal */}
      <Modal
        title="Paste Tabular Data from Excel / Google Sheets"
        open={pasteModalVisible}
        onCancel={() => setPasteModalVisible(false)}
        onOk={handleApplyPaste}
        okText="Load into Grid"
        width={700}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            type="info"
            showIcon
            message="Copy rows directly from Excel or Google Sheets (including header names) and paste (Ctrl+V) into the box below:"
          />
          <TextArea
            rows={10}
            value={pasteText}
            placeholder={`Account\tTitle\tPhone1\tEmail\n\tWalk-in Customer\t03001234567\tcustomer@example.com`}
            onChange={e => setPasteText(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: '13px' }}
          />
        </Space>
      </Modal>
    </>
  );
};
