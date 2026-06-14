import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import type { TimeRangePickerProps } from 'antd';

dayjs.extend(quarterOfYear);

export const rangePresets: TimeRangePickerProps['presets'] = [
  { label: 'Today', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
  { label: 'Yesterday', value: [dayjs().subtract(1, 'd').startOf('day'), dayjs().subtract(1, 'd').endOf('day')] },
  { label: 'Last 7 Days', value: [dayjs().subtract(7, 'd'), dayjs()] },
  { label: 'Last 30 Days', value: [dayjs().subtract(30, 'd'), dayjs()] },
  { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
  { label: 'Last Month', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
  { label: 'This Quarter', value: [dayjs().startOf('quarter'), dayjs().endOf('quarter')] },
  { label: 'Last Quarter', value: [dayjs().subtract(1, 'quarter').startOf('quarter'), dayjs().subtract(1, 'quarter').endOf('quarter')] },
  { label: 'This Year', value: [dayjs().startOf('year'), dayjs().endOf('year')] },
  { label: 'Last Year', value: [dayjs().subtract(1, 'year').startOf('year'), dayjs().subtract(1, 'year').endOf('year')] },
  { label: 'Last 365 Days', value: [dayjs().subtract(365, 'd'), dayjs()] },
];
