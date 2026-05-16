/**
 * Safely stringifies an object to JSON, handling circular references and non-serializable types.
 */
export function safeStringify(obj: any, indent: number | string = 2): string {
  const cache = new WeakSet();
  
  // Defensive helper to pre-clone and clean objects before JSON.stringify
  // This bypasses many issues with custom toJSON methods and library-specific circularity
  const cleanObject = (val: any): any => {
    if (val === null || typeof val !== 'object') {
      if (typeof val === 'bigint') return val.toString() + 'n';
      if (typeof val === 'function') return '[Function]';
      return val;
    }

    // Handle circularity
    if (cache.has(val)) {
      return '[Circular]';
    }
    cache.add(val);

    // Handle special types
    if (val instanceof Error) {
      return {
        name: val.name,
        message: val.message,
        stack: val.stack
      };
    }
    
    if (val instanceof Date) return val.toISOString();
    if (val instanceof RegExp) return val.toString();
    
    // Detection for DOM nodes or Window
    if ('nodeType' in val && typeof val.nodeType === 'number') return '[DOM Node]';
    if (val === window) return '[Window]';
    if (val === document) return '[Document]';

    // Detection for Leaflet or similar library objects that often cause issues
    if (val._leaflet_id || val._latlng || val._icon || val._layers) {
      return `[Library Object: ${val.constructor?.name || 'Unknown'}]`;
    }

    if (Array.isArray(val)) {
      return val.map(item => cleanObject(item));
    }

    const result: any = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        // Skip common circular keys in events or library objects
        const suspiciousKeys = ['srcElement', 'target', 'view', 'parentElement', 'src', 'i'];
        if (suspiciousKeys.includes(key)) {
          result[key] = `[Suspicious Key: ${key}]`;
          continue;
        }
        result[key] = cleanObject(val[key]);
      }
    }
    return result;
  };

  try {
    const cleaned = cleanObject(obj);
    return JSON.stringify(cleaned, null, indent);
  } catch (error) {
    // Highly defensive error logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('safeStringify fallback triggered:', errorMessage);
    return '[Error Stringifying Object]';
  }
}
