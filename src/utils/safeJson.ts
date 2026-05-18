/**
 * Safely stringifies an object to JSON, handling circular references and non-serializable types.
 * This version is designed to be extremely defensive, especially against minified Google Maps
 * and Leaflet objects that often cause "Converting circular structure to JSON" errors.
 */
export function safeStringify(obj: any, indent: number = 2): string {
  const cache = new WeakSet();
  const suspiciousKeys = [
    'parentElement', 'ownerDocument', 'parentNode', 'view', 'target', 
    'srcElement', 'gm_bindings_', '__gm', '_leaflet_id', '_map', '_layers',
    'delegateTarget', 'currentTarget', 'relatedTarget', 'i', 'j', 'src', 'owner'
  ];

  const cleanObject = (val: any, depth: number = 0): any => {
    // 1. Handle primitives immediately
    if (val === null || val === undefined) return val;
    const type = typeof val;
    if (type !== 'object' && type !== 'function') return val;
    if (type === 'function') return '[Function]';

    // 2. Depth limit to prevent stack overflow
    if (depth > 12) return '[Depth Limit]';

    // 3. Circularity check
    if (cache.has(val)) return '[Circular]';
    
    // Add to cache (objects and functions only)
    try {
      cache.add(val);
    } catch {
      return '[Invalid Object Reference]';
    }

    // 4. Handle specialized built-in types
    if (val instanceof Date) return val.toISOString();
    if (val instanceof RegExp) return val.toString();
    if (val instanceof Error) {
      return { 
        message: val.message, 
        name: val.name, 
        stack: depth === 0 ? val.stack : undefined 
      };
    }
    
    // 5. Handle Map and Set
    if (val instanceof Map) {
      return { _type: 'Map', entries: Array.from(val.entries()).map(([k, v]) => [String(k), cleanObject(v, depth + 1)]) };
    }
    if (val instanceof Set) {
      return { _type: 'Set', values: Array.from(val).map(v => cleanObject(v, depth + 1)) };
    }

    // 6. Defensive check against DOM and Browser objects
    try {
      if (typeof window !== 'undefined' && val === window) return '[Window]';
      if (typeof document !== 'undefined' && val === document) return '[Document]';
      if (val.nodeType && typeof val.nodeType === 'number') return `[DOM Node: ${val.nodeName || 'unknown'}]`;
    } catch { /* Ignore proxy/security access errors */ }

    // 7. Detect and filter known UI Library objects (Leaflet, Google Maps)
    try {
      const ctor = val.constructor;
      const ctorName = ctor?.name;
      
      const knownLibraryNames = [
        'Y2', 'Ka', 'La', 'Ma', 'Na', 'Oa', 'Pa', 'Qa', 'Ra', 'Sa', 'Ta', 'Ua', 'Va', 'Wa', 'Xa', 'Ya', 'Za',
        'Map', 'LatLng', 'LatLngBounds', 'Point', 'Bounds', 'Projection', 'TileLayer', 'Marker', 'Popup', 'Polyline', 'Polygon',
        'google.maps.Map', 'google.maps.LatLng'
      ];
      
      // Aggressive library object detection
      if (ctorName && (knownLibraryNames.includes(ctorName) || (ctorName.length <= 2 && ctorName !== 'Object'))) {
        return `[Library Object: ${ctorName}]`;
      }

      // Check for common library properties
      if (
        val._leaflet_id || val._latlng || val._icon || 
        val.gm_bindings_ || val.__gm || val.gm_accessors_ ||
        (val.getCenter && val.getZoom && val.setZoom) || 
        (val.lat && val.lng && typeof val.lat === 'function')
      ) {
        return `[Library Object: ${ctorName || 'Unknown'}]`;
      }
    } catch { /* Ignore */ }

    // 8. Handle Arrays
    if (Array.isArray(val)) {
      return val.map(item => cleanObject(item, depth + 1));
    }

    // 9. Handle standard Objects (Deep Clone)
    const cleaned: any = {};
    
    try {
      const keys = Object.keys(val);
      const keyLimit = depth > 5 ? 20 : 100;
      const keysToProcess = keys.slice(0, keyLimit);

      for (const key of keysToProcess) {
        if (suspiciousKeys.includes(key) || key.startsWith('__')) {
          const childVal = val[key];
          if (childVal && typeof childVal === 'object') {
            cleaned[key] = `[Filtered: ${key}]`;
            continue;
          }
        }

        try {
          cleaned[key] = cleanObject(val[key], depth + 1);
        } catch (e) {
          cleaned[key] = '[Property Access Error]';
        }
      }

      if (keys.length > keyLimit) {
        cleaned._truncated = `[Truncated ${keys.length - keyLimit} keys]`;
      }
    } catch (e) {
      return `[Object Processing Error]`;
    }
    
    return cleaned;
  };

  try {
    const cleaned = cleanObject(obj);
    return JSON.stringify(cleaned, null, indent);
  } catch (error) {
    try {
      return `[JSON.stringify Error: ${error instanceof Error ? error.message : String(error)}]`;
    } catch {
      return '[Critical Stringification Error]';
    }
  }
}

/**
 * Safely parses a JSON string, returning null if parsing fails.
 */
export function safeParseJson(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text.trim());
  } catch (error) {
    console.error('Safe JSON Parse Error:', error instanceof Error ? error.message : String(error));
    return null;
  }
}
