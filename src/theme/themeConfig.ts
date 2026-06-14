import { theme } from 'antd';
import type { ThemeConfig } from 'antd';

export const lightTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#1677ff', // Professional Blue
    colorInfo: '#1677ff',
    colorBgLayout: '#f0f2f5',
    colorBgContainer: '#ffffff',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    borderRadius: 8,
    wireframe: false,
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#ffffff',
    },
    Menu: {
      itemBg: '#ffffff',
    }
  }
};

export const darkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#1668dc', // Slightly darker blue for dark mode
    colorInfo: '#1668dc',
    colorBgLayout: '#141414',
    colorBgContainer: '#1f1f1f',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    borderRadius: 8,
    wireframe: false,
  },
  components: {
    Layout: {
      headerBg: '#1f1f1f',
      siderBg: '#1f1f1f',
    },
    Menu: {
      itemBg: '#1f1f1f',
      darkItemBg: '#1f1f1f',
    }
  }
};
