import React from 'react';
import { Typography, Empty, Card } from 'antd';
import { useLocation } from 'react-router-dom';

const { Title } = Typography;

export const PlaceholderPage: React.FC = () => {
  const location = useLocation();
  const pageName = location.pathname.replace('/', '').charAt(0).toUpperCase() + location.pathname.slice(2);

  return (
    <Card bordered={false} className="h-full min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <Title level={3} className="mb-8">{pageName || 'Page'} Module</Title>
        <Empty 
          description={
            <span className="text-gray-400">
              This module is currently under development.
            </span>
          }
        />
      </div>
    </Card>
  );
};
