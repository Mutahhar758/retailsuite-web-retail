import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Table, Tag, Spin, message } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, ShoppingCartOutlined,
  BankOutlined, WalletOutlined, AppstoreOutlined
} from '@ant-design/icons';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import type { 
  DashboardStatsDto, 
  SalesTrendDto, 
  CashFlowTrendDto, 
  ExpenseCategoryDto, 
  RecentExpenseDto, 
  StockStatusDto, 
  RecentPaymentDto 
} from '../../services/dashboardService';
import { dashboardService } from '../../services/dashboardService';

const { Title, Text } = Typography;

const COLORS = ['#16a34a', '#1677ff', '#faad14', '#f5222d', '#722ed1'];

// Tables Columns Definitions
const paymentColumns = [
  { title: 'Voucher', dataIndex: 'id', key: 'id', render: (t: string) => <a className="text-blue-600 font-medium">#{t}</a> },
  { title: 'Date', dataIndex: 'date', key: 'date' },
  { title: 'Party', dataIndex: 'party', key: 'party' },
  {
    title: 'Amount', dataIndex: 'amount', key: 'amount', render: (a: number, r: any) => (
      <span className={`font-semibold ${r.type === 'In' ? 'text-green-600' : 'text-red-600'}`}>
        {r.type === 'In' ? '+' : '-'}Rs. {a.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </span>
    )
  },
  {
    title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => (
      <Tag color={s === 'Completed' ? 'green' : 'orange'} className="border-gray-200">{s.toUpperCase()}</Tag>
    )
  },
];

const expenseColumns = [
  { title: 'Voucher', dataIndex: 'id', key: 'id', render: (t: string) => <a className="text-purple-600 font-medium">#{t}</a> },
  { title: 'Category', dataIndex: 'category', key: 'category' },
  { title: 'Date', dataIndex: 'date', key: 'date' },
  { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (a: number) => <span className="text-red-600 font-medium">-Rs. {a.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> },
];

const stockColumns = [
  { title: 'Code', dataIndex: 'code', key: 'code', render: (t: string) => <a className="text-gray-600 font-mono">{t}</a> },
  { title: 'Item Name', dataIndex: 'name', key: 'name' },
  {
    title: 'Quantity', dataIndex: 'qty', key: 'qty', render: (q: number) => (
      <span className={q < 10 ? 'text-red-600 font-bold' : 'text-green-600'}>{q.toLocaleString()}</span>
    )
  },
  { title: 'Value', dataIndex: 'value', key: 'value', render: (v: number) => `Rs. ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
  {
    title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => (
      <Tag color={s === 'In Stock' ? 'blue' : (s === 'Low Stock' ? 'orange' : 'red')}>{s}</Tag>
    )
  },
];

const StatCard = ({ title, value, prefix, trend, trendValue, colorClass, iconBgClass }: any) => (
  <Card bordered={false} styles={{ body: { padding: '20px' } }} className="shadow-sm rounded-xl border border-gray-100 h-full hover:shadow-md transition-all">
    <div className="flex justify-between items-start">
      <div>
        <Text type="secondary" className="text-sm font-medium block">{title}</Text>
        <Title level={3} className="mt-1 mb-0" style={{ fontFamily: 'Calibri, sans-serif', fontWeight: 'bold', lineHeight: 1 }}>
          {value}
        </Title>
      </div>
      <div className={`p-3 rounded-full ${iconBgClass} ${colorClass} flex items-center justify-center text-xl`}>
        {prefix}
      </div>
    </div>
    {(trend || trendValue) && (
      <div className="mt-3 flex items-center text-sm">
        {trend ? (
          <span className={`flex items-center font-semibold ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
            {trend === 'up' ? <ArrowUpOutlined className="mr-1" /> : <ArrowDownOutlined className="mr-1" />}
            {trendValue}
          </span>
        ) : (
          <span className="flex items-center font-semibold">{trendValue}</span>
        )}
        <span className="text-gray-400 ml-2">vs last month</span>
      </div>
    )}
  </Card>
);

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStatsDto | null>(null);
  const [salesTrend, setSalesTrend] = useState<SalesTrendDto[]>([]);
  const [cashFlowTrend, setCashFlowTrend] = useState<CashFlowTrendDto[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseCategoryDto[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpenseDto[]>([]);
  const [stockStatus, setStockStatus] = useState<StockStatusDto[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPaymentDto[]>([]);

  const [loading, setLoading] = useState({
    stats: true,
    salesTrend: true,
    cashFlowTrend: true,
    expenses: true,
    stock: true,
    payments: true
  });

  const cardClass = "shadow-sm border border-gray-200 h-full hover:shadow-md transition-shadow rounded-xl";

  useEffect(() => {
    // Fetch stats
    dashboardService.getStats().then(setStats).catch(() => message.error('Failed to load stats')).finally(() => setLoading(prev => ({ ...prev, stats: false })));
    
    // Fetch sales trend
    dashboardService.getSalesTrend().then(setSalesTrend).catch(() => message.error('Failed to load sales trend')).finally(() => setLoading(prev => ({ ...prev, salesTrend: false })));
    
    // Fetch cash flow trend
    dashboardService.getCashFlowTrend().then(setCashFlowTrend).catch(() => message.error('Failed to load cash flow trend')).finally(() => setLoading(prev => ({ ...prev, cashFlowTrend: false })));
    
    // Fetch expenses
    dashboardService.getExpensesByCategory().then(setExpensesByCategory).catch(() => message.error('Failed to load expense categories')).finally(() => setLoading(prev => ({ ...prev, expenses: false })));
    dashboardService.getRecentExpenses().then(setRecentExpenses).catch(() => message.error('Failed to load recent expenses'));
    
    // Fetch stock
    dashboardService.getStockStatus().then(setStockStatus).catch(() => message.error('Failed to load stock status')).finally(() => setLoading(prev => ({ ...prev, stock: false })));
    
    // Fetch payments
    dashboardService.getRecentPayments().then(setRecentPayments).catch(() => message.error('Failed to load recent transactions')).finally(() => setLoading(prev => ({ ...prev, payments: false })));
  }, []);

  return (
    <div className="pb-8 animate-in fade-in duration-500">
      {/* --- ROW 1: KEY STATS --- */}
      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} sm={12} lg={6}>
          <Spin spinning={loading.stats}>
            <StatCard
              title="Total Sales (MTD)"
              value={stats ? `Rs. ${stats.totalSalesMTD.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Rs. 0.00'}
              prefix={<ShoppingCartOutlined />}
              trend="up"
              trendValue="Auto"
              colorClass="text-blue-500"
              iconBgClass="bg-blue-50"
            />
          </Spin>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Spin spinning={loading.stats}>
            <StatCard
              title="Cash In"
              value={stats ? `Rs. ${stats.cashInMTD.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Rs. 0.00'}
              prefix={<BankOutlined />}
              trend="up"
              trendValue="Auto"
              colorClass="text-green-500"
              iconBgClass="bg-green-50"
            />
          </Spin>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Spin spinning={loading.stats}>
            <StatCard
              title="Cash Out"
              value={stats ? `Rs. ${stats.cashOutMTD.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Rs. 0.00'}
              prefix={<WalletOutlined />}
              trend="down"
              trendValue="Auto"
              colorClass="text-red-500"
              iconBgClass="bg-red-50"
            />
          </Spin>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Spin spinning={loading.stats}>
            <StatCard
              title="Total Stock Value"
              value={stats ? `Rs. ${stats.totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Rs. 0.00'}
              prefix={<AppstoreOutlined />}
              trend="up"
              trendValue="Auto"
              colorClass="text-teal-500"
              iconBgClass="bg-teal-50"
            />
          </Spin>
        </Col>
      </Row>

      {/* --- ROW 2: SALES & CASH FLOW GRAPHS --- */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} lg={12}>
          <Card title={<span className="font-bold text-gray-700">Sales Trend (Last 7 Months)</span>} bordered={true} className={cardClass}>
            <Spin spinning={loading.salesTrend}>
              <div style={{ height: 300, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1677ff" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8c8c8c', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8c8c8c', fontSize: 12 }} tickFormatter={(value) => `Rs. ${value.toLocaleString()}`} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value: any) => [`Rs. ${Number(value).toLocaleString()}`, 'Sales']} 
                    />
                    <Area type="monotone" dataKey="sales" stroke="#1677ff" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Spin>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<span className="font-bold text-gray-700">Cash In vs Cash Out</span>} bordered={true} className={cardClass}>
            <Spin spinning={loading.cashFlowTrend}>
              <div style={{ height: 300, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlowTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8c8c8c', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8c8c8c', fontSize: 12 }} tickFormatter={(value) => `Rs. ${value.toLocaleString()}`} />
                    <RechartsTooltip 
                      cursor={{ fill: '#f5f5f5' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value: any) => [`Rs. ${Number(value).toLocaleString()}`]} 
                    />
                    <Legend iconType="circle" />
                    <Bar dataKey="cashIn" name="Cash In" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="cashOut" name="Cash Out" fill="#f5222d" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* --- ROW 3: EXPENSES --- */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} lg={8}>
          <Card title={<span className="font-bold text-gray-700">Expenses by Category</span>} bordered={true} className={cardClass}>
            <Spin spinning={loading.expenses}>
              <div style={{ height: 280, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={expensesByCategory} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={90} 
                      paddingAngle={5} 
                      dataKey="value"
                      nameKey="category"
                    >
                      {expensesByCategory.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value: any) => `Rs. ${Number(value).toLocaleString()}`} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Spin>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title={<span className="font-bold text-gray-700">Recent Expenses</span>} bordered={true} className={cardClass}>
            <Table columns={expenseColumns} dataSource={recentExpenses} pagination={false} size="small" rowKey="id" loading={loading.expenses} />
          </Card>
        </Col>
      </Row>

      {/* --- ROW 4: STOCKS & PAYMENTS TABLES --- */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title={<span className="font-bold text-gray-700">Stock Inventory (Top Items)</span>} bordered={true} className={cardClass}>
            <Table columns={stockColumns} dataSource={stockStatus} pagination={false} size="small" rowKey="code" loading={loading.stock} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<span className="font-bold text-gray-700">Recent Transactions</span>} bordered={true} className={cardClass}>
            <Table columns={paymentColumns} dataSource={recentPayments} pagination={false} size="small" rowKey="id" loading={loading.payments} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

