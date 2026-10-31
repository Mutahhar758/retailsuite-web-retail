import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Modal, Button, Space, Typography, Table, Tag, Tooltip, message,
  Input, InputNumber, Select, Switch, Row, Col, Card, Alert, Radio,
  Popconfirm, Dropdown
} from 'antd';
import {
  DownloadOutlined, UploadOutlined, SnippetsOutlined, PlusOutlined,
  DeleteOutlined, SaveOutlined,
  ExclamationCircleOutlined, SyncOutlined, ClearOutlined, FileExcelOutlined,
  CloudDownloadOutlined, DownOutlined, SearchOutlined, AppstoreOutlined
} from '@ant-design/icons';
import { parseCsv, parseClipboardTable, toCsv, downloadCsv } from '../../utils/csvUtils';
import { customerService, type CustomerBulkItemDto, type BulkOperationResult } from '../../services/customerService';
import { vendorService, type VendorBulkItemDto } from '../../services/vendorService';
import { inventoryService, type InventoryItemBulkItemDto } from '../../services/inventoryService';
import { hrInfoService, type HRInfoBulkItemDto } from '../../services/hrInfoService';
import { itemCategoryService, type ItemCategoryDto } from '../../services/itemCategoryService';
import { unitService, type UnitDto } from '../../services/unitService';
import { brandService, type BrandLookupDto } from '../../services/brandService';
import { customerCategoryService, type CustomerCategoryLookupResponse } from '../../services/customerCategoryService';
import type { ItemCustomerCategoryPriceDto } from '../../services/inventoryService';

const { Text } = Typography;
const { TextArea } = Input;

export type BulkEntityType = 'customers' | 'products' | 'vendors' | 'employees';

export interface BulkOperationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  entityType: BulkEntityType;
  initialRows?: any[];
  autoPopulate?: boolean;
}

export const mapProductToBulkRow = (p: any) => ({
  _key: `prod-${p.id}`,
  id: p.id,
  itemType: p.itemType || 'Product',
  barcode: p.barcode || '',
  itemCategoryCode: p.itemCategoryCode || '',
  title: p.title || '',
  brandId: p.brandId || '',
  primaryUnit: p.primaryUnit || '',
  secondaryUnit: p.secondaryUnit || '',
  qtyInPack: p.qtyInPack ?? 1,
  priRate: p.priRate ?? 0,
  secRate: p.secRate ?? 0,
  opnStock: p.itemType === 'Service' ? 0 : (p.opnStock ?? 0),
  opnRate: p.itemType === 'Service' ? 0 : (p.opnRate ?? p.costRate ?? 0),
});

export const BulkOperationModal: React.FC<BulkOperationModalProps> = ({
  visible,
  onClose,
  onSuccess,
  entityType,
  initialRows,
  autoPopulate = false,
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [populating, setPopulating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'new' | 'update' | 'error'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pasteModalVisible, setPasteModalVisible] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Lookups for products
  const [categories, setCategories] = useState<ItemCategoryDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [brands, setBrands] = useState<BrandLookupDto[]>([]);
  const [customerCategories, setCustomerCategories] = useState<CustomerCategoryLookupResponse[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevVisibleRef = useRef(false);
  const rowsRef = useRef<any[]>([]);
  rowsRef.current = rows;
  const categoriesRef = useRef<ItemCategoryDto[]>([]);
  categoriesRef.current = categories;
  const unitsRef = useRef<UnitDto[]>([]);
  unitsRef.current = units;
  const customerCategoriesRef = useRef<CustomerCategoryLookupResponse[]>([]);
  customerCategoriesRef.current = customerCategories;

  // Load lookups when modal opens if products
  useEffect(() => {
    if (visible && entityType === 'products') {
      Promise.all([
        itemCategoryService.getActiveItemCategories().catch(() => []),
        unitService.getActiveUnits().catch(() => []),
        brandService.getActiveBrands().catch(() => []),
        customerCategoryService.getLookup().catch(() => [])
      ]).then(([cat, un, br, cc]) => {
        setCategories(cat);
        setUnits(un);
        setBrands(br);
        setCustomerCategories(cc);
      });
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
      case 'products': {
        const activeCcList = customerCategories.length > 0 ? customerCategories : customerCategoriesRef.current;
        return {
          title: 'Products (Inventory Items)',
          idField: 'id',
          idLabel: 'Item ID',
          sampleHeaders: [
            'Id', 'Type', 'Barcode', 'ItemCategoryCode', 'Title', 'BrandId',
            'PrimaryUnit', 'SecondaryUnit', 'QtyInPack', 'PriRate',
            'SecRate',
            ...activeCcList.map(c => `Rate_${c.code}`),
            'OpnStock', 'OpnRate'
          ],
          sampleData: [
            ['', 'Product', '', '01', 'Cooking Oil 1L', '', 'PCS', '', '1', '450', '450', ...activeCcList.map(() => '420'), '50', '380'],
            ['', 'Product', '', '01', 'Basmati Rice 5kg', '', 'KG', '', '1', '1200', '1200', ...activeCcList.map(() => '1150'), '100', '1050'],
            ['', 'Service', '', '02', 'General Service / Labor', '', '', '', '1', '500', '0', ...activeCcList.map(() => '0'), '0', '0'],
            ['000001', 'Product', '1000001', '01', 'Sugar 1kg Pack', '', 'KG', '', '1', '150', '150', ...activeCcList.map(() => '140'), '0', '0']
          ]
        };
      }
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
  }, [entityType, customerCategories]);

  // Helper to build normalized price lookup map
  const buildPriceMap = (catPrices: ItemCustomerCategoryPriceDto[]) => {
    const priceMap = new Map<string, number>();
    catPrices.forEach((cp: ItemCustomerCategoryPriceDto) => {
      if (!cp.itemId) return;
      const itemIdNorm = String(cp.itemId).trim().toLowerCase();
      const catIdNorm = String(cp.customerCategoryId || '').trim().toLowerCase();
      const catTitleNorm = String(cp.customerCategoryTitle || '').trim().toLowerCase();
      const rate = Number(cp.priRate) || 0;

      if (catIdNorm) priceMap.set(`${itemIdNorm}:::${catIdNorm}`, rate);
      if (catTitleNorm) priceMap.set(`${itemIdNorm}:::${catTitleNorm}`, rate);

      const parsedInt = parseInt(itemIdNorm, 10);
      if (!isNaN(parsedInt)) {
        if (catIdNorm) priceMap.set(`${parsedInt}:::${catIdNorm}`, rate);
        if (catTitleNorm) priceMap.set(`${parsedInt}:::${catTitleNorm}`, rate);
      }
    });
    return priceMap;
  };

  const getPriceForProductCategory = (
    priceMap: Map<string, number>,
    itemId: string,
    catCode: string,
    catTitle?: string
  ) => {
    const itemIdNorm = String(itemId || '').trim().toLowerCase();
    const catCodeNorm = String(catCode || '').trim().toLowerCase();
    const catTitleNorm = String(catTitle || '').trim().toLowerCase();
    const parsedInt = parseInt(itemIdNorm, 10);

    return (
      priceMap.get(`${itemIdNorm}:::${catCodeNorm}`) ??
      (catTitleNorm ? priceMap.get(`${itemIdNorm}:::${catTitleNorm}`) : undefined) ??
      (!isNaN(parsedInt) ? priceMap.get(`${parsedInt}:::${catCodeNorm}`) : undefined) ??
      (!isNaN(parsedInt) && catTitleNorm ? priceMap.get(`${parsedInt}:::${catTitleNorm}`) : undefined) ??
      0
    );
  };

  // Populate existing data handler
  const handlePopulateExisting = useCallback(async (categoryCode?: string) => {
    try {
      setPopulating(true);
      let newRows: any[] = [];
      if (entityType === 'products') {
        const [list, catPrices, ccList] = await Promise.all([
          inventoryService.getItems(categoryCode),
          inventoryService.getCustomerCategoryPrices().catch(() => []),
          customerCategoryService.getLookup().catch(() => [])
        ]);

        if (ccList && ccList.length > 0) {
          setCustomerCategories(ccList);
          customerCategoriesRef.current = ccList;
        }
        const activeCcList = (ccList && ccList.length > 0) ? ccList : customerCategoriesRef.current;
        const priceMap = buildPriceMap(catPrices);

        newRows = list.map(p => {
          const row: any = mapProductToBulkRow(p);
          activeCcList.forEach(cc => {
            row[`catRate_${cc.code}`] = getPriceForProductCategory(priceMap, p.id, cc.code, cc.title);
          });
          return row;
        });
      } else if (entityType === 'customers') {
        const list = await customerService.getCustomers();
        newRows = list.map(c => ({
          _key: `cust-${c.account}`,
          account: c.account,
          title: c.title,
          phone1: c.phone1 || '',
          phone2: c.phone2 || '',
          email: c.email || '',
          cnic: c.cnic || '',
          address: c.address || '',
          qualification: c.qualification || '',
          active: c.active ?? true
        }));
      } else if (entityType === 'vendors') {
        const list = await vendorService.getVendors();
        newRows = list.map(v => ({
          _key: `vend-${v.account}`,
          account: v.account,
          title: v.title,
          phone1: v.phone1 || '',
          phone2: v.phone2 || '',
          email: v.email || '',
          cnic: v.cnic || '',
          address: v.address || '',
          showInSales: v.showInSales ?? false,
          active: v.active ?? true
        }));
      } else if (entityType === 'employees') {
        const list = await hrInfoService.getHRInfos();
        newRows = list.map(e => ({
          _key: `emp-${e.id}`,
          id: e.id,
          name: e.name,
          fatherName: e.fatherName || '',
          gender: e.gender || 'Male',
          dob: e.dob || '',
          cnic: e.cnic || '',
          designation: e.designation || '',
          salaryType: e.salaryType || 'Monthly',
          salary: e.salary ?? 0,
          joiningDate: e.joiningDate || ''
        }));
      }

      const applyRows = (mode: 'replace' | 'append') => {
        if (mode === 'replace') {
          setRows(newRows);
        } else {
          setRows(prev => {
            const idField = entityMeta.idField;
            const existingIds = new Set(prev.map(r => r[idField]).filter(Boolean));
            const distinctNew = newRows.filter(r => !existingIds.has(r[idField]));
            return [...prev, ...distinctNew];
          });
        }
        message.success(`Populated ${newRows.length} ${entityMeta.title} for bulk update`);
      };

      if (rowsRef.current.length > 0) {
        Modal.confirm({
          title: 'Existing Data in Grid',
          content: `There are currently ${rowsRef.current.length} row(s) in the table. Would you like to Replace them or Append the loaded data?`,
          okText: 'Replace All',
          cancelText: 'Append New',
          onOk: () => applyRows('replace'),
          onCancel: (e) => {
            if (e?.triggerCancel) return;
            applyRows('append');
          }
        });
      } else {
        applyRows('replace');
      }
    } catch {
      message.error(`Failed to load ${entityMeta.title}`);
    } finally {
      setPopulating(false);
    }
  }, [entityType, entityMeta.idField, entityMeta.title]);

  // Reset or initialize state when entityType changes or modal opens
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      if (initialRows && initialRows.length > 0) {
        if (entityType === 'products') {
          setLoading(true);
          Promise.all([
            inventoryService.getCustomerCategoryPrices().catch(() => []),
            customerCategoryService.getLookup().catch(() => [])
          ]).then(([catPrices, ccList]) => {
            if (ccList && ccList.length > 0) {
              setCustomerCategories(ccList);
              customerCategoriesRef.current = ccList;
            }
            const activeCcList = (ccList && ccList.length > 0) ? ccList : customerCategoriesRef.current;
            const priceMap = buildPriceMap(catPrices);

            const hydrated = initialRows.map(p => {
              const row: any = { ...p };
              activeCcList.forEach(cc => {
                row[`catRate_${cc.code}`] = getPriceForProductCategory(priceMap, p.id, cc.code, cc.title);
              });
              return row;
            });
            setRows(hydrated);
          }).finally(() => {
            setLoading(false);
          });
        } else {
          setRows(initialRows);
        }
      } else if (autoPopulate) {
        handlePopulateExisting();
      } else {
        setRows([]);
      }
      setFilterMode('all');
      setSearchQuery('');
      setPasteText('');
    }
    prevVisibleRef.current = visible;
  }, [visible, entityType, initialRows, autoPopulate, handlePopulateExisting]);

  // Row validation logic
  const validateRow = useCallback((row: any) => {
    const errors: string[] = [];
    if (entityType === 'customers' || entityType === 'vendors') {
      if (!row.title || !String(row.title).trim()) {
        errors.push('Name/Title is required');
      }
    } else if (entityType === 'products') {
      const isService = row.itemType === 'Service';
      if (!row.title || !String(row.title).trim()) {
        errors.push(isService ? 'Service Title is required' : 'Product Title is required');
      }
      if (!row.itemCategoryCode || !String(row.itemCategoryCode).trim()) {
        errors.push('Category is required');
      }
      if (!isService && (!row.primaryUnit || !String(row.primaryUnit).trim())) {
        errors.push('Primary Unit is required for Products');
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
        _key: row._key || (idVal ? `row-id-${idVal}` : `row-${index}-${Date.now()}`),
        _rowIndex: index + 1,
        _status: status,
        _errors: errors
      };
    });
  }, [rows, entityMeta.idField, validateRow]);

  // Filtered rows for display
  const displayRows = useMemo(() => {
    let list = processedRows;
    if (filterMode !== 'all') {
      list = list.filter(r => r._status === filterMode);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => {
        const title = String(r.title || r.name || '').toLowerCase();
        const id = String(r.id || r.account || '').toLowerCase();
        const barcode = String(r.barcode || '').toLowerCase();
        const type = String(r.itemType || '').toLowerCase();
        return title.includes(q) || id.includes(q) || barcode.includes(q) || type.includes(q);
      });
    }
    return list;
  }, [processedRows, filterMode, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = processedRows.length;
    const newCount = processedRows.filter(r => r._status === 'new').length;
    const updateCount = processedRows.filter(r => r._status === 'update').length;
    const errorCount = processedRows.filter(r => r._status === 'error').length;
    return { total, newCount, updateCount, errorCount };
  }, [processedRows]);

  // Handle cell edit by row key
  const handleCellChange = (key: string, field: string, value: any) => {
    setRows(prev => prev.map(r => (r._key === key ? { ...r, [field]: value } : r)));
  };

  // Add row
  const handleAddRow = () => {
    const newRow: any = { _key: `row-new-${Date.now()}` };
    if (entityType === 'customers' || entityType === 'vendors') {
      newRow.title = '';
      newRow.active = true;
    } else if (entityType === 'products') {
      newRow.itemType = 'Product';
      newRow.title = '';
      newRow.itemCategoryCode = categories[0]?.code || '';
      newRow.primaryUnit = units[0]?.code || '';
      newRow.qtyInPack = 1;
      newRow.priRate = 0;
      newRow.secRate = 0;
      newRow.opnStock = 0;
      newRow.opnRate = 0;
      const activeCcList = customerCategories.length > 0 ? customerCategories : customerCategoriesRef.current;
      activeCcList.forEach(cc => {
        newRow[`catRate_${cc.code}`] = 0;
      });
    } else if (entityType === 'employees') {
      newRow.name = '';
      newRow.gender = 'Male';
      newRow.salaryType = 'Monthly';
      newRow.salary = 0;
    }
    setRows(prev => [...prev, newRow]);
  };

  // Delete row by key
  const handleDeleteRow = (key: string) => {
    setRows(prev => prev.filter(r => r._key !== key));
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
        const [list, catPrices, ccList] = await Promise.all([
          inventoryService.getItems(),
          inventoryService.getCustomerCategoryPrices().catch(() => []),
          customerCategoryService.getLookup().catch(() => [])
        ]);
        if (ccList && ccList.length > 0) {
          setCustomerCategories(ccList);
          customerCategoriesRef.current = ccList;
        }
        const activeCcList = (ccList && ccList.length > 0) ? ccList : customerCategoriesRef.current;
        const priceMap = buildPriceMap(catPrices);

        const catHeaders = activeCcList.map(c => `Rate_${c.code}`);
        headers = [
          'Id', 'Type', 'Barcode', 'ItemCategoryCode', 'Title', 'BrandId',
          'PrimaryUnit', 'SecondaryUnit', 'QtyInPack', 'PriRate', 'SecRate',
          ...catHeaders,
          'OpnStock', 'OpnRate'
        ];
        dataRows = list.map(p => [
          p.id, p.itemType || 'Product', p.barcode || '', p.itemCategoryCode || '', p.title, p.brandId || '',
          p.primaryUnit || '', p.secondaryUnit || '', p.qtyInPack ?? 1, p.priRate, p.secRate,
          ...activeCcList.map(c => getPriceForProductCategory(priceMap, p.id, c.code, c.title)),
          p.itemType === 'Service' ? 0 : (p.opnStock ?? 0), p.itemType === 'Service' ? 0 : (p.opnRate ?? 0)
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
        } else if (h === 'type' || h === 'itemtype') {
          rowObj.itemType = val.toLowerCase() === 'service' ? 'Service' : 'Product';
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
        } else if (
          h === 'itemcategorycode' ||
          h === 'categorycode' ||
          h === 'category' ||
          h === 'standardcategory' ||
          h === 'itemcategory' ||
          h === 'productcategory' ||
          h === 'categoryname' ||
          h === 'itemcategorytitle'
        ) {
          const valTrim = val.trim();
          const matchedCat = categoriesRef.current.find(
            c => c.code.trim().toLowerCase() === valTrim.toLowerCase() ||
                 c.title.trim().toLowerCase() === valTrim.toLowerCase()
          );
          rowObj.itemCategoryCode = matchedCat ? matchedCat.code : valTrim;
        } else if (
          h === 'primaryunit' ||
          h === 'unit' ||
          h === 'punit' ||
          h === 'unitname' ||
          h === 'unittitle' ||
          h === 'uom'
        ) {
          const valTrim = val.trim();
          const matchedUnit = unitsRef.current.find(
            u => u.code.trim().toLowerCase() === valTrim.toLowerCase() ||
                 u.title.trim().toLowerCase() === valTrim.toLowerCase() ||
                 (u.shortTitle && u.shortTitle.trim().toLowerCase() === valTrim.toLowerCase())
          );
          rowObj.primaryUnit = matchedUnit ? matchedUnit.code : valTrim;
        } else if (h === 'secondaryunit' || h === 'sunit') {
          rowObj.secondaryUnit = val;
        } else if (h === 'qtyinpack' || h === 'packqty' || h === 'pack') {
          rowObj.qtyInPack = parseFloat(val) || 1;
        } else if (
          h === 'prirate' ||
          h === 'rate' ||
          h === 'price' ||
          h === 'saleprice' ||
          h === 'retail' ||
          h === 'retailprice' ||
          h === 'retailrate'
        ) {
          rowObj.priRate = parseFloat(val) || 0;
          if (rowObj.secRate === undefined || rowObj.secRate === 0) {
            rowObj.secRate = rowObj.priRate;
          }
        } else if (h === 'secrate' || h === 'unitrate') {
          rowObj.secRate = parseFloat(val) || 0;
        } else if (h === 'opnstock' || h === 'openingstock' || h === 'stock' || h === 'qty') {
          rowObj.opnStock = parseFloat(val) || 0;
        } else if (
          h === 'opnrate' ||
          h === 'openingrate' ||
          h === 'cost' ||
          h === 'costrate' ||
          h === 'costprice' ||
          h === 'purchaserate' ||
          h === 'purchaseprice' ||
          h === 'purrate'
        ) {
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
        } else {
          for (const cc of customerCategoriesRef.current) {
            const codeNorm = cc.code.toLowerCase().replace(/[\s_-]/g, '');
            const titleNorm = cc.title.toLowerCase().replace(/[\s_-]/g, '');
            const isMatch =
              h === codeNorm ||
              h === titleNorm ||
              h === `rate${codeNorm}` ||
              h === `rate(${codeNorm})` ||
              h === `rate${titleNorm}` ||
              h === `rate(${titleNorm})` ||
              h === `${titleNorm}rate` ||
              h === `${titleNorm}price` ||
              h === `${codeNorm}rate` ||
              h === `${codeNorm}price` ||
              h.includes(`(${titleNorm})`) ||
              h.includes(`(${codeNorm})`) ||
              (titleNorm.length >= 4 && (h.includes(titleNorm) || titleNorm.includes(h))) ||
              (titleNorm.startsWith('distribut') && h.startsWith('distribut')) ||
              (titleNorm.startsWith('whole') && h.startsWith('whole'));

            if (isMatch) {
              rowObj[`catRate_${cc.code}`] = parseFloat(val) || 0;
              break;
            }
          }
        }
      });

      if (!rowObj.itemType) rowObj.itemType = 'Product';
      if (!rowObj.qtyInPack) rowObj.qtyInPack = 1;
      if (rowObj.priRate !== undefined && (!rowObj.secRate || rowObj.secRate === 0)) {
        rowObj.secRate = rowObj.priRate;
      }
      if (rowObj.opnStock === undefined) rowObj.opnStock = 0;
      if (rowObj.opnRate === undefined) rowObj.opnRate = 0;

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
        const payload: InventoryItemBulkItemDto[] = validRows.map(r => {
          const isService = r.itemType === 'Service';
          const activeCcList = customerCategories.length > 0 ? customerCategories : customerCategoriesRef.current;
          const customerCategoryPrices = activeCcList
            .filter(cc => r[`catRate_${cc.code}`] !== undefined)
            .map(cc => ({
              customerCategoryId: cc.code,
              priRate: Number(r[`catRate_${cc.code}`]) || 0,
              secRate: 0
            }));

          return {
            id: r.id?.trim() || undefined,
            itemType: isService ? 'Service' : 'Product',
            barcode: isService ? undefined : (r.barcode?.trim() || undefined),
            itemCategoryCode: r.itemCategoryCode?.trim() || '',
            title: r.title?.trim() || '',
            brandId: isService ? undefined : (r.brandId?.trim() || undefined),
            primaryUnit: isService ? (r.primaryUnit?.trim() || '') : (r.primaryUnit?.trim() || ''),
            secondaryUnit: isService ? undefined : (r.secondaryUnit?.trim() || undefined),
            qtyInPack: isService ? 1 : (r.qtyInPack ? Number(r.qtyInPack) : 1),
            priRate: r.priRate ? Number(r.priRate) : 0,
            secRate: isService ? 0 : (r.secRate ? Number(r.secRate) : 0),
            opnStock: isService ? 0 : (r.opnStock ? Number(r.opnStock) : 0),
            opnRate: isService ? 0 : (r.opnRate ? Number(r.opnRate) : 0),
            customerCategoryPrices: customerCategoryPrices.length > 0 ? customerCategoryPrices : undefined
          };
        });
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
          render: (val: string, record: any) => (
            <Input
              value={val}
              placeholder="Auto-assigned"
              size="small"
              style={{ fontFamily: 'monospace' }}
              onChange={e => handleCellChange(record._key, 'account', e.target.value)}
            />
          )
        },
        {
          title: 'Name / Title *',
          dataIndex: 'title',
          key: 'title',
          width: 200,
          render: (val: string, record: any) => {
            const hasError = !val || !val.trim();
            return (
              <Tooltip title={hasError ? 'Title is required' : ''}>
                <Input
                  value={val}
                  placeholder="Required name"
                  size="small"
                  status={hasError ? 'error' : ''}
                  onChange={e => handleCellChange(record._key, 'title', e.target.value)}
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
          render: (val: string, record: any) => (
            <Input
              value={val}
              placeholder="Phone number"
              size="small"
              onChange={e => handleCellChange(record._key, 'phone1', e.target.value)}
            />
          )
        },
        {
          title: 'Phone 2',
          dataIndex: 'phone2',
          key: 'phone2',
          width: 130,
          render: (val: string, record: any) => (
            <Input
              value={val}
              placeholder="Alternate phone"
              size="small"
              onChange={e => handleCellChange(record._key, 'phone2', e.target.value)}
            />
          )
        },
        {
          title: 'Email',
          dataIndex: 'email',
          key: 'email',
          width: 170,
          render: (val: string, record: any) => (
            <Input
              value={val}
              placeholder="Email address"
              size="small"
              onChange={e => handleCellChange(record._key, 'email', e.target.value)}
            />
          )
        },
        {
          title: 'CNIC / NTN',
          dataIndex: 'cnic',
          key: 'cnic',
          width: 140,
          render: (val: string, record: any) => (
            <Input
              value={val}
              placeholder="CNIC / NTN"
              size="small"
              onChange={e => handleCellChange(record._key, 'cnic', e.target.value)}
            />
          )
        },
        {
          title: 'Address',
          dataIndex: 'address',
          key: 'address',
          width: 200,
          render: (val: string, record: any) => (
            <Input
              value={val}
              placeholder="Address"
              size="small"
              onChange={e => handleCellChange(record._key, 'address', e.target.value)}
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
          render: (val: boolean, record: any) => (
            <Switch
              size="small"
              checked={Boolean(val)}
              onChange={checked => handleCellChange(record._key, 'showInSales', checked)}
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
        render: (val: boolean, record: any) => (
          <Switch
            size="small"
            checked={val !== false}
            onChange={checked => handleCellChange(record._key, 'active', checked)}
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
          render: (val: string, record: any) => (
            <Input
              value={val}
              placeholder="Auto-generated"
              size="small"
              style={{ fontFamily: 'monospace' }}
              onChange={e => handleCellChange(record._key, 'id', e.target.value)}
            />
          )
        },
        {
          title: 'Type',
          dataIndex: 'itemType',
          key: 'itemType',
          width: 110,
          render: (val: string, record: any) => (
            <Select
              value={val || 'Product'}
              size="small"
              style={{ width: '100%' }}
              onChange={v => handleCellChange(record._key, 'itemType', v)}
            >
              <Select.Option value="Product">
                <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>Product</Tag>
              </Select.Option>
              <Select.Option value="Service">
                <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>Service</Tag>
              </Select.Option>
            </Select>
          )
        },
        {
          title: 'Barcode',
          dataIndex: 'barcode',
          key: 'barcode',
          width: 140,
          render: (val: string, record: any) => {
            const isService = record.itemType === 'Service';
            return (
              <Input
                value={val}
                placeholder={isService ? 'Optional' : 'Auto-generated'}
                size="small"
                style={{ fontFamily: 'monospace' }}
                onChange={e => handleCellChange(record._key, 'barcode', e.target.value)}
              />
            );
          }
        },
        {
          title: 'Category *',
          dataIndex: 'itemCategoryCode',
          key: 'itemCategoryCode',
          width: 160,
          render: (val: string, record: any) => {
            const hasError = !val || !val.trim();
            return (
              <Select
                value={val || undefined}
                placeholder="Select category"
                size="small"
                status={hasError ? 'error' : ''}
                style={{ width: '100%' }}
                onChange={v => handleCellChange(record._key, 'itemCategoryCode', v)}
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
          title: 'Title / Name *',
          dataIndex: 'title',
          key: 'title',
          width: 200,
          render: (val: string, record: any) => {
            const hasError = !val || !val.trim();
            const isService = record.itemType === 'Service';
            return (
              <Input
                value={val}
                placeholder={isService ? 'Service name' : 'Product name'}
                size="small"
                status={hasError ? 'error' : ''}
                onChange={e => handleCellChange(record._key, 'title', e.target.value)}
              />
            );
          }
        },
        {
          title: 'Brand',
          dataIndex: 'brandId',
          key: 'brandId',
          width: 130,
          render: (val: string, record: any) => {
            if (record.itemType === 'Service') {
              return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
            }
            return (
              <Select
                value={val || undefined}
                placeholder="Optional brand"
                size="small"
                allowClear
                style={{ width: '100%' }}
                onChange={v => handleCellChange(record._key, 'brandId', v)}
                showSearch
                optionFilterProp="children"
              >
                {brands.map(b => (
                  <Select.Option key={b.id} value={b.id}>
                    {b.title}
                  </Select.Option>
                ))}
              </Select>
            );
          }
        },
        {
          title: 'Primary Unit',
          dataIndex: 'primaryUnit',
          key: 'primaryUnit',
          width: 130,
          render: (val: string, record: any) => {
            const isService = record.itemType === 'Service';
            const hasError = !isService && (!val || !val.trim());
            return (
              <Select
                value={val || undefined}
                placeholder={isService ? 'N/A' : 'Unit *'}
                size="small"
                status={hasError ? 'error' : ''}
                disabled={isService}
                allowClear={isService}
                style={{ width: '100%' }}
                onChange={v => handleCellChange(record._key, 'primaryUnit', v)}
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
          render: (val: string, record: any) => {
            if (record.itemType === 'Service') {
              return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
            }
            return (
              <Select
                value={val || undefined}
                placeholder="Optional"
                size="small"
                allowClear
                style={{ width: '100%' }}
                onChange={v => handleCellChange(record._key, 'secondaryUnit', v)}
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
          title: 'Pack Qty',
          dataIndex: 'qtyInPack',
          key: 'qtyInPack',
          width: 90,
          render: (val: number, record: any) => {
            if (record.itemType === 'Service') {
              return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
            }
            return (
              <InputNumber
                value={val}
                size="small"
                min={1}
                style={{ width: '100%' }}
                onChange={v => handleCellChange(record._key, 'qtyInPack', v)}
              />
            );
          }
        },
        {
          title: 'Rate / Price',
          dataIndex: 'priRate',
          key: 'priRate',
          width: 100,
          render: (val: number, record: any) => (
            <InputNumber
              value={val}
              size="small"
              min={0}
              style={{ width: '100%' }}
              onChange={v => handleCellChange(record._key, 'priRate', v)}
            />
          )
        },
        {
          title: 'Unit Rate',
          dataIndex: 'secRate',
          key: 'secRate',
          width: 100,
          render: (val: number, record: any) => {
            if (record.itemType === 'Service') {
              return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
            }
            return (
              <InputNumber
                value={val}
                size="small"
                min={0}
                style={{ width: '100%' }}
                onChange={v => handleCellChange(record._key, 'secRate', v)}
              />
            );
          }
        },
        ...customerCategories.map(cc => ({
          title: (
            <span>
              Rate <Tag color="cyan" style={{ margin: 0, fontSize: 11 }}>{cc.title}</Tag>
            </span>
          ),
          dataIndex: `catRate_${cc.code}`,
          key: `catRate_${cc.code}`,
          width: 125,
          render: (val: number, record: any) => (
            <InputNumber
              value={val}
              size="small"
              min={0}
              placeholder="0"
              style={{ width: '100%' }}
              onChange={v => handleCellChange(record._key, `catRate_${cc.code}`, v ?? 0)}
            />
          )
        })),
        {
          title: 'Opn Stock',
          dataIndex: 'opnStock',
          key: 'opnStock',
          width: 100,
          render: (val: number, record: any) => {
            if (record.itemType === 'Service') {
              return <Text type="secondary" style={{ fontSize: 11 }}>N/A</Text>;
            }
            return (
              <InputNumber
                value={val}
                size="small"
                min={0}
                style={{ width: '100%' }}
                onChange={v => handleCellChange(record._key, 'opnStock', v)}
              />
            );
          }
        },
        {
          title: 'Opn Rate / Cost',
          dataIndex: 'opnRate',
          key: 'opnRate',
          width: 110,
          render: (val: number, record: any) => {
            if (record.itemType === 'Service') {
              return <Text type="secondary" style={{ fontSize: 11 }}>N/A</Text>;
            }
            return (
              <InputNumber
                value={val}
                size="small"
                min={0}
                style={{ width: '100%' }}
                onChange={v => handleCellChange(record._key, 'opnRate', v)}
              />
            );
          }
        }
      );
    } else if (entityType === 'employees') {
      baseCols.push(
        {
          title: 'Emp ID',
          dataIndex: 'id',
          key: 'id',
          width: 110,
          render: (val: string, record: any) => (
            <Input
              value={val}
              placeholder="Auto-assigned"
              size="small"
              style={{ fontFamily: 'monospace' }}
              onChange={e => handleCellChange(record._key, 'id', e.target.value)}
            />
          )
        },
        {
          title: 'Employee Name *',
          dataIndex: 'name',
          key: 'name',
          width: 180,
          render: (val: string, record: any) => {
            const hasError = !val || !val.trim();
            return (
              <Input
                value={val}
                placeholder="Full name"
                size="small"
                status={hasError ? 'error' : ''}
                onChange={e => handleCellChange(record._key, 'name', e.target.value)}
              />
            );
          }
        },
        {
          title: "Father's Name",
          dataIndex: 'fatherName',
          key: 'fatherName',
          width: 150,
          render: (val: string, record: any) => (
            <Input
              value={val}
              placeholder="Father's name"
              size="small"
              onChange={e => handleCellChange(record._key, 'fatherName', e.target.value)}
            />
          )
        },
        {
          title: 'Gender',
          dataIndex: 'gender',
          key: 'gender',
          width: 110,
          render: (val: string, record: any) => (
            <Select
              value={val || 'Male'}
              size="small"
              style={{ width: '100%' }}
              onChange={v => handleCellChange(record._key, 'gender', v)}
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
          render: (val: string, record: any) => (
            <Input
              value={val}
              placeholder="YYYY-MM-DD"
              size="small"
              onChange={e => handleCellChange(record._key, 'dob', e.target.value)}
            />
          )
        },
        {
          title: 'CNIC',
          dataIndex: 'cnic',
          key: 'cnic',
          width: 140,
          render: (val: string, record: any) => (
            <Input
              value={val}
              placeholder="35201-..."
              size="small"
              onChange={e => handleCellChange(record._key, 'cnic', e.target.value)}
            />
          )
        },
        {
          title: 'Designation',
          dataIndex: 'designation',
          key: 'designation',
          width: 150,
          render: (val: string, record: any) => (
            <Input
              value={val}
              placeholder="Role / Title"
              size="small"
              onChange={e => handleCellChange(record._key, 'designation', e.target.value)}
            />
          )
        },
        {
          title: 'Salary Type',
          dataIndex: 'salaryType',
          key: 'salaryType',
          width: 110,
          render: (val: string, record: any) => (
            <Select
              value={val || 'Monthly'}
              size="small"
              style={{ width: '100%' }}
              onChange={v => handleCellChange(record._key, 'salaryType', v)}
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
          render: (val: number, record: any) => (
            <InputNumber
              value={val}
              size="small"
              min={0}
              style={{ width: '100%' }}
              onChange={v => handleCellChange(record._key, 'salary', v)}
            />
          )
        },
        {
          title: 'Joining Date',
          dataIndex: 'joiningDate',
          key: 'joiningDate',
          width: 130,
          render: (val: string, record: any) => (
            <Input
              value={val}
              placeholder="YYYY-MM-DD"
              size="small"
              onChange={e => handleCellChange(record._key, 'joiningDate', e.target.value)}
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
      render: (_: any, record: any) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteRow(record._key)}
        />
      )
    });

    return baseCols;
  }, [entityType, categories, units, brands, customerCategories]);

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

                  {entityType === 'products' ? (
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: 'all',
                            label: 'Populate All Products',
                            icon: <AppstoreOutlined />,
                            onClick: () => handlePopulateExisting(),
                          },
                          ...(categories.length > 0
                            ? [
                                {
                                  type: 'divider' as const,
                                },
                                {
                                  key: 'by-category',
                                  label: 'Populate By Category',
                                  children: categories.map(c => ({
                                    key: c.code,
                                    label: `${c.title} (${c.code})`,
                                    onClick: () => handlePopulateExisting(c.code),
                                  })),
                                },
                              ]
                            : []),
                        ],
                      }}
                    >
                      <Button
                        type="primary"
                        ghost
                        icon={<CloudDownloadOutlined />}
                        loading={populating}
                        style={{ borderColor: '#1677ff', fontWeight: 500 }}
                      >
                        Populate Existing Products <DownOutlined />
                      </Button>
                    </Dropdown>
                  ) : (
                    <Button
                      type="primary"
                      ghost
                      icon={<CloudDownloadOutlined />}
                      onClick={() => handlePopulateExisting()}
                      loading={populating}
                    >
                      Populate Existing Data
                    </Button>
                  )}

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
                  <Input
                    placeholder="Search rows..."
                    prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    allowClear
                    size="small"
                    style={{ width: 170 }}
                  />
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
