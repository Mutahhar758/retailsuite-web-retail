import { useState, useEffect } from 'react';

export type ConnectionMethod = 'WEB_USB' | 'LOCAL_RELAY';

export interface PrinterOptions {
  printerName?: string; // Client's local printer name (for Windows Local Relay)
  openDrawer?: boolean; // Append drawer open command
  cutPaper?: boolean;   // Append paper cut command
}

/**
 * Align text to the center within the specified width.
 */
export const centerLine = (text: string, width: number = 40): string => {
  if (text.length >= width) return text.substring(0, width);
  const leftPad = Math.floor((width - text.length) / 2);
  return ' '.repeat(leftPad) + text;
};

/**
 * Align left and right columns with spaces in between.
 */
export const padLine = (left: string, right: string, width: number = 40): string => {
  const spaceNeeded = width - left.length - right.length;
  if (spaceNeeded <= 0) {
    return left.substring(0, width - right.length - 1) + ' ' + right;
  }
  return left + ' '.repeat(spaceNeeded) + right;
};

/**
 * Create a divider line with a specific character.
 */
export const divider = (char: string = '-', width: number = 40): string => {
  return char.repeat(width);
};

/**
 * Direct print driver function (can be called programmatically)
 */
export const printDirect = async (
  lines: string[],
  connectionMethod: ConnectionMethod,
  options: PrinterOptions = {}
) => {
  if (connectionMethod === 'WEB_USB') {
    await printViaWebUsb(lines, options);
  } else if (connectionMethod === 'LOCAL_RELAY') {
    await printViaLocalRelay(lines, options);
  } else {
    throw new Error(`Unsupported printer connection method: ${connectionMethod}`);
  }
};

export const useThermalPrinter = (
  lines: string[],
  connectionMethod: ConnectionMethod,
  options: PrinterOptions = {}
) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);

  const fetchAvailablePrinters = async () => {
    try {
      const response = await fetch('http://localhost:5000/printers');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setAvailablePrinters(data);
        }
      }
    } catch (err) {
      console.warn('Could not fetch available printers from local relay:', err);
    }
  };

  useEffect(() => {
    if (connectionMethod === 'LOCAL_RELAY') {
      fetchAvailablePrinters();
    }
  }, [connectionMethod]);

  const print = async () => {
    setLoading(true);
    setError(null);

    try {
      await printDirect(lines, connectionMethod, options);
    } catch (err: any) {
      console.error('Thermal printer error:', err);
      setError(err.message || 'An unknown error occurred during printing');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { print, fetchAvailablePrinters, availablePrinters, loading, error };
};

/**
 * WebUSB ESC/POS Printer Implementation (ChromeOS)
 */
async function printViaWebUsb(lines: string[], options: PrinterOptions) {
  const nav = navigator as any;
  if (!nav.usb) {
    throw new Error('WebUSB is not supported in this browser. Please use Google Chrome, Edge, or a ChromeOS device.');
  }

  let device: any;
  try {
    // Prompt the user to select a USB device
    device = await nav.usb.requestDevice({ filters: [] });
  } catch (err: any) {
    if (
      err instanceof DOMException &&
      (err.name === 'NotFoundError' || 
       err.message.includes('No device selected') || 
       err.message.includes('cancelled'))
    ) {
      throw new Error('WebUSB connection cancelled: No device was selected or printer permission denied.');
    }
    throw err;
  }

  try {
    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    let interfaceNumber = 0;
    let endpointNumber = 0;

    // Scan for printer interface (Class 7) and Bulk Out endpoint
    for (const iface of device.configuration.interfaces) {
      for (const alternate of iface.alternates) {
        if (alternate.interfaceClass === 7) {
          interfaceNumber = iface.interfaceNumber;
          const outEndpoint = alternate.endpoints.find(
            (ep: any) => ep.direction === 'out' && ep.type === 'bulk'
          );
          if (outEndpoint) {
            endpointNumber = outEndpoint.endpointNumber;
            break;
          }
        }
      }
      if (endpointNumber !== 0) break;
    }

    // Fallback: use first interface and first out endpoint
    if (endpointNumber === 0) {
      const fallbackIface = device.configuration.interfaces[0];
      if (!fallbackIface) {
        throw new Error('No USB interfaces found on the selected device.');
      }
      interfaceNumber = fallbackIface.interfaceNumber;
      const outEndpoint = fallbackIface.alternates[0]?.endpoints.find(
        (ep: any) => ep.direction === 'out'
      );
      if (!outEndpoint) {
        throw new Error('No output Bulk USB endpoint found on the device.');
      }
      endpointNumber = outEndpoint.endpointNumber;
    }

    try {
      await device.claimInterface(interfaceNumber);
    } catch (claimErr: any) {
      if (claimErr.message && claimErr.message.includes('claimInterface')) {
        throw new Error('Unable to claim the printer interface. It may be in use by another application or browser tab.');
      }
      throw claimErr;
    }

    // Construct the ESC/POS print buffer
    const encoder = new TextEncoder();
    // ESC/POS Initialization command: ESC @ -> [0x1B, 0x40]
    const initCmd = new Uint8Array([0x1B, 0x40]);
    // Standard receipt text lines combined with newlines
    const textBytes = encoder.encode(lines.join('\n') + '\n');
    // Cash drawer open command: ESC p m t1 t2 -> [0x1B, 0x70, 0x00, 0x19, 0xFA]
    const drawerCmd = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
    // Paper cut command: GS V A n -> [0x1D, 0x56, 0x41, 0x10]
    const cutCmd = new Uint8Array([0x1D, 0x56, 0x41, 0x10]);

    // Calculate total buffer size based on configuration options
    let totalSize = initCmd.length + textBytes.length;
    if (options.openDrawer !== false) totalSize += drawerCmd.length;
    if (options.cutPaper !== false) totalSize += cutCmd.length;

    const buffer = new Uint8Array(totalSize);
    let offset = 0;

    buffer.set(initCmd, offset);
    offset += initCmd.length;

    buffer.set(textBytes, offset);
    offset += textBytes.length;

    if (options.openDrawer !== false) {
      buffer.set(drawerCmd, offset);
      offset += drawerCmd.length;
    }

    if (options.cutPaper !== false) {
      buffer.set(cutCmd, offset);
      offset += cutCmd.length;
    }

    // Send data to the USB endpoint
    await device.transferOut(endpointNumber, buffer);

    // Release the claimed interface
    try {
      await device.releaseInterface(interfaceNumber);
    } catch (releaseErr) {
      console.warn('Error releasing interface:', releaseErr);
    }
  } finally {
    // Make sure we always attempt to close the device connection
    try {
      await device.close();
    } catch (closeErr) {
      console.warn('Error closing device connection:', closeErr);
    }
  }
}

/**
 * Generic Local Relay Implementation (Windows C# Service)
 */
async function printViaLocalRelay(lines: string[], options: PrinterOptions) {
  try {
    const payload = {
      printerName: options.printerName || 'XP-80',
      textLines: lines,
      openDrawer: options.openDrawer !== false,
      cutPaper: options.cutPaper !== false
    };

    const response = await fetch('http://localhost:5000/print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      throw new Error(`Local relay error (${response.status}): ${responseText || response.statusText}`);
    }
  } catch (err: any) {
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new Error(
        'Failed to connect to the background printing service. Please check if your printer bridge software is running or not.'
      );
    }
    throw err;
  }
}
