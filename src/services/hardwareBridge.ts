
export interface HWDevice {
  id: string;
  name: string;
  type: 'USB' | 'HID' | 'BLE' | 'INTERNAL';
  category: 'SECURITY' | 'COMPUTE' | 'MEMORY' | 'GRAPHICS';
  status: 'connected' | 'disconnected' | 'authenticating';
  accelerationFactor: number;
  serialNumber?: string;
}

class HardwareBridge {
  private devices: HWDevice[] = [];
  private listeners: ((devices: HWDevice[]) => void)[] = [];

  constructor() {
    // Check for WebUSB support
    if (typeof navigator !== 'undefined' && 'usb' in navigator) {
      navigator.usb.addEventListener('connect', (event) => {
        this.handleConnect(event.device);
      });
      navigator.usb.addEventListener('disconnect', (event) => {
        this.handleDisconnect(event.device);
      });
    }
  }

  private handleConnect(device: USBDevice) {
    const newDevice: HWDevice = {
      id: device.serialNumber || Math.random().toString(36).substr(2, 9),
      name: device.productName || 'Unknown LaurinHW',
      type: 'USB',
      category: 'SECURITY',
      status: 'connected',
      accelerationFactor: 2.5, // 250% boost
      serialNumber: device.serialNumber
    };
    this.devices.push(newDevice);
    this.notify();
  }

  private handleDisconnect(device: USBDevice) {
    this.devices = this.devices.filter(d => d.serialNumber !== device.serialNumber);
    this.notify();
  }

  public async requestDevice(): Promise<HWDevice | null> {
    try {
      if (typeof navigator === 'undefined' || !('usb' in navigator)) {
        throw new Error('WebUSB not supported in this browser');
      }

      const device = await navigator.usb.requestDevice({ 
        filters: [
          { vendorId: 0x1050 }, // Yubico
          { vendorId: 0x2581 }, // Ledger
          { vendorId: 0x1209 }  // Generic
        ] 
      });

      if (device) {
        this.handleConnect(device);
        return this.devices[this.devices.length - 1];
      }
      return null;
    } catch (err) {
      console.error('Hardware connection failed:', err);
      return null;
    }
  }

  public async pairInternalComponent(type: 'CPU' | 'GPU' | 'RAM'): Promise<HWDevice> {
    // Simulate pairing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const existing = this.devices.find(d => d.id === `internal_${type}`);
    if (existing) return existing;

    const component: HWDevice = {
      id: `internal_${type}`,
      name: `Phone ${type} Accelerator`,
      type: 'INTERNAL',
      category: type === 'CPU' ? 'COMPUTE' : (type === 'GPU' ? 'GRAPHICS' : 'MEMORY'),
      status: 'connected',
      accelerationFactor: type === 'GPU' ? 3.0 : (type === 'CPU' ? 2.0 : 1.5),
      serialNumber: `INT-${type}-001`
    };

    this.devices.push(component);
    this.notify();
    return component;
  }

  public getConnectedDevices(): HWDevice[] {
    return this.devices;
  }

  public subscribe(callback: (devices: HWDevice[]) => void) {
    this.listeners.push(callback);
    callback(this.devices);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.devices));
  }

  public getAccelerationMultiplier(): number {
    if (this.devices.length === 0) return 1.0;
    return this.devices.reduce((acc, dev) => acc + (dev.accelerationFactor - 1), 1.0);
  }
}

export const hardwareBridge = new HardwareBridge();
