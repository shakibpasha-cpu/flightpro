/**
 * Safely stringifies an object to JSON, handling circular references and non-serializable types.
 */
export function safeStringify(obj: any, indent: number | string = 2): string {
  const cache = new WeakSet();
  
  try {
    return JSON.stringify(
      obj,
      (key, value) => {
        // Handle basic types that JSON.stringify might struggle with or return {} for
        if (typeof value === 'bigint') {
          return value.toString() + 'n';
        }
        
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack
          };
        }

        // Handle circular references
        if (typeof value === 'object' && value !== null) {
          // Detect if it's a DOM node - these are never meaningful to stringify for AI
          if ('nodeType' in value && typeof value.nodeType === 'number') {
            return '[DOM Node]';
          }

          if (cache.has(value)) {
            return '[Circular]';
          }
          cache.add(value);
        }
        return value;
      },
      indent
    );
  } catch (error) {
    console.error('Final fallback in safeStringify failed:', error);
    return '[Error Stringifying Object]';
  }
}
