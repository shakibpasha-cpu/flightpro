import { auth } from '../firebase';
import { safeStringify } from '../utils/safeJson';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  const errorMessage = safeStringify(errInfo);

  console.error('Firestore Error: ', errorMessage);
  throw new Error(errorMessage);
}

export interface ApiErrorInfo {
  error: string;
  service: string;
  endpoint?: string;
  status?: number;
  isQuotaExceeded: boolean;
  timestamp: string;
}

export function handleApiError(error: unknown, service: string, endpoint?: string, silent: boolean = false) {
  const message = error instanceof Error ? error.message : String(error);
  const isQuotaExceeded = 
    message.includes('429') || 
    message.includes('RESOURCE_EXHAUSTED') || 
    message.toLowerCase().includes('quota') ||
    message.toLowerCase().includes('exceeded quota') ||
    (error as any)?.status === 429;

  const errInfo: ApiErrorInfo = {
    error: message,
    service,
    endpoint,
    isQuotaExceeded,
    timestamp: new Date().toISOString()
  };

  console.error(`API Error [${service}]:`, safeStringify(errInfo));
  
  if (silent) return;

  // Return a user-friendly message
  if (isQuotaExceeded) {
    throw new Error(`The ${service} service is currently busy (quota exceeded). Please try again in a few minutes.`);
  }
  
  throw new Error(`An error occurred while communicating with ${service}. Please try again later.`);
}
