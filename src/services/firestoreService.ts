import { 
  collection, 
  doc, 
  getDocs,
  getDocsFromServer,
  getDocFromServer,
  setDoc, 
  deleteDoc, 
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Boarder, Deposit, DailyMealLog, BazaarCost, MiscellaneousCosts, MessSettings } from '../types';

// Collection references
export const BOARDERS_COL = 'boarders';
export const DEPOSITS_COL = 'deposits';
export const BAZAAR_COL = 'bazaarCosts';
export const MEALS_COL = 'mealLogs';
export const SETTINGS_COL = 'settings';
export const MISC_COL = 'miscCosts';

// Default document IDs for singleton configs
export const GENERAL_DOC = 'general';

/**
 * Operation types for Firestore error diagnostics
 */
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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Recursively removes `undefined` properties from objects.
 * Firestore strictly rejects documents that contain `undefined` values.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined || obj === null) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Clears all local mess cache from browser localStorage.
 */
export function clearBrowserLocalStorageCache(): void {
  try {
    localStorage.removeItem('mess_boarders');
    localStorage.removeItem('mess_deposits');
    localStorage.removeItem('mess_bazaarCosts');
    localStorage.removeItem('mess_mealLogs');
    localStorage.removeItem('mess_settings');
    localStorage.removeItem('mess_miscCosts');
  } catch (err) {
    console.warn('Failed to clear localStorage keys:', err);
  }
}

/**
 * Loads all mess data directly from Firestore Server.
 * Firestore is the single source of truth.
 * If browser cache is deleted, this function rebuilds local state directly from Firestore.
 */
export async function loadInitialData(fallbackData?: {
  boarders?: Boarder[];
  deposits?: Deposit[];
  mealLogs?: DailyMealLog[];
  bazaarCosts?: BazaarCost[];
  miscCosts?: MiscellaneousCosts;
  settings?: MessSettings;
}): Promise<{
  boarders: Boarder[];
  deposits: Deposit[];
  mealLogs: DailyMealLog[];
  bazaarCosts: BazaarCost[];
  miscCosts: MiscellaneousCosts;
  settings: MessSettings;
  isFromCloud: boolean;
  error?: string;
}> {
  try {
    // Attempt direct server query to bypass any stale browser cache
    const [boardersSnap, depositsSnap, bazaarSnap, mealsSnap, settingsSnap, miscSnap] = await Promise.all([
      getDocsFromServer(collection(db, BOARDERS_COL)).catch(() => getDocs(collection(db, BOARDERS_COL))),
      getDocsFromServer(collection(db, DEPOSITS_COL)).catch(() => getDocs(collection(db, DEPOSITS_COL))),
      getDocsFromServer(collection(db, BAZAAR_COL)).catch(() => getDocs(collection(db, BAZAAR_COL))),
      getDocsFromServer(collection(db, MEALS_COL)).catch(() => getDocs(collection(db, MEALS_COL))),
      getDocsFromServer(collection(db, SETTINGS_COL)).catch(() => getDocs(collection(db, SETTINGS_COL))),
      getDocsFromServer(collection(db, MISC_COL)).catch(() => getDocs(collection(db, MISC_COL))),
    ]);

    const boarders: Boarder[] = boardersSnap.docs.map(d => d.data() as Boarder);
    const deposits: Deposit[] = depositsSnap.docs.map(d => d.data() as Deposit);
    const bazaarCosts: BazaarCost[] = bazaarSnap.docs.map(d => d.data() as BazaarCost);
    const mealLogs: DailyMealLog[] = mealsSnap.docs.map(d => d.data() as DailyMealLog);

    // Auto-heal referenced boarders if they exist in deposits or bazaar costs but missing in boarders collection
    const existingBoarderIds = new Set(boarders.map(b => b.id));
    const missingBoarders: Boarder[] = [];
    let autoCounter = 1;

    deposits.forEach((dep) => {
      if (dep.boarderId && !existingBoarderIds.has(dep.boarderId)) {
        existingBoarderIds.add(dep.boarderId);
        const autoBoarder: Boarder = {
          id: dep.boarderId,
          name: dep.boarderId.startsWith('b_17935') ? `Boarder ${autoCounter++}` : `Boarder ${dep.boarderId}`,
          isActive: true,
          joinedDate: dep.date || '2026-11-01'
        };
        missingBoarders.push(autoBoarder);
        boarders.push(autoBoarder);
      }
    });

    bazaarCosts.forEach((c) => {
      if (c.spentById && !existingBoarderIds.has(c.spentById)) {
        existingBoarderIds.add(c.spentById);
        const autoBoarder: Boarder = {
          id: c.spentById,
          name: `Mess Manager`,
          isActive: true,
          joinedDate: c.date || '2026-11-01'
        };
        missingBoarders.push(autoBoarder);
        boarders.push(autoBoarder);
      }
    });

    // Save auto-healed boarders to Firestore so they are never lost again
    if (missingBoarders.length > 0) {
      try {
        const batch = writeBatch(db);
        missingBoarders.forEach(b => {
          batch.set(doc(db, BOARDERS_COL, b.id), sanitizeForFirestore(b));
        });
        await batch.commit();
      } catch (err) {
        console.warn('Auto-healing boarders batch commit warning:', err);
      }
    }

    const settingsDoc = settingsSnap.docs.find(d => d.id === GENERAL_DOC);
    const settings: MessSettings = settingsDoc 
      ? (settingsDoc.data() as MessSettings) 
      : (fallbackData?.settings || { messName: 'Shajahan Villa', currentMonth: '2026-11', managerPin: '1234' });

    const miscDoc = miscSnap.docs.find(d => d.id === GENERAL_DOC);
    const miscCosts: MiscellaneousCosts = miscDoc 
      ? (miscDoc.data() as MiscellaneousCosts) 
      : (fallbackData?.miscCosts || { cookerBill: 0, utilityBill: 0, gasBill: 0, wifiBill: 0, houseRent: 0, otherCosts: 0 });

    // Cache locally as backup so offline views work
    try {
      localStorage.setItem('mess_boarders', JSON.stringify(boarders));
      localStorage.setItem('mess_deposits', JSON.stringify(deposits));
      localStorage.setItem('mess_bazaarCosts', JSON.stringify(bazaarCosts));
      localStorage.setItem('mess_mealLogs', JSON.stringify(mealLogs));
      localStorage.setItem('mess_settings', JSON.stringify(settings));
      localStorage.setItem('mess_miscCosts', JSON.stringify(miscCosts));
    } catch {
      // ignore quota errors
    }

    return {
      boarders,
      deposits,
      bazaarCosts,
      mealLogs,
      miscCosts,
      settings,
      isFromCloud: true
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn('Could not load from Firestore, falling back to local data:', error);
    return {
      boarders: fallbackData?.boarders || [],
      deposits: fallbackData?.deposits || [],
      mealLogs: fallbackData?.mealLogs || [],
      bazaarCosts: fallbackData?.bazaarCosts || [],
      miscCosts: fallbackData?.miscCosts || { cookerBill: 0, utilityBill: 0, gasBill: 0, wifiBill: 0, houseRent: 0, otherCosts: 0 },
      settings: fallbackData?.settings || { messName: 'Shajahan Villa', currentMonth: '2026-11' },
      isFromCloud: false,
      error: errorMsg
    };
  }
}

/**
 * Explicitly forces a server fetch from Google Cloud Firestore, completely bypassing browser cache.
 */
export async function forceFetchFromServer(): Promise<{
  boarders: Boarder[];
  deposits: Deposit[];
  mealLogs: DailyMealLog[];
  bazaarCosts: BazaarCost[];
  miscCosts: MiscellaneousCosts;
  settings: MessSettings;
  stats: {
    boardersCount: number;
    depositsCount: number;
    bazaarCount: number;
    mealLogsCount: number;
    fetchedAt: string;
  };
  isFromCloud: boolean;
  error?: string;
}> {
  try {
    const [boardersSnap, depositsSnap, bazaarSnap, mealsSnap, settingsSnap, miscSnap] = await Promise.all([
      getDocsFromServer(collection(db, BOARDERS_COL)),
      getDocsFromServer(collection(db, DEPOSITS_COL)),
      getDocsFromServer(collection(db, BAZAAR_COL)),
      getDocsFromServer(collection(db, MEALS_COL)),
      getDocsFromServer(collection(db, SETTINGS_COL)),
      getDocsFromServer(collection(db, MISC_COL)),
    ]);

    const boarders: Boarder[] = boardersSnap.docs.map(d => d.data() as Boarder);
    const deposits: Deposit[] = depositsSnap.docs.map(d => d.data() as Deposit);
    const bazaarCosts: BazaarCost[] = bazaarSnap.docs.map(d => d.data() as BazaarCost);
    const mealLogs: DailyMealLog[] = mealsSnap.docs.map(d => d.data() as DailyMealLog);

    // Auto-heal referenced boarders
    const existingBoarderIds = new Set(boarders.map(b => b.id));
    const missingBoarders: Boarder[] = [];
    let autoCounter = 1;

    deposits.forEach((dep) => {
      if (dep.boarderId && !existingBoarderIds.has(dep.boarderId)) {
        existingBoarderIds.add(dep.boarderId);
        const autoBoarder: Boarder = {
          id: dep.boarderId,
          name: dep.boarderId.startsWith('b_17935') ? `Boarder ${autoCounter++}` : `Boarder ${dep.boarderId}`,
          isActive: true,
          joinedDate: dep.date || '2026-11-01'
        };
        missingBoarders.push(autoBoarder);
        boarders.push(autoBoarder);
      }
    });

    if (missingBoarders.length > 0) {
      try {
        const batch = writeBatch(db);
        missingBoarders.forEach(b => {
          batch.set(doc(db, BOARDERS_COL, b.id), sanitizeForFirestore(b));
        });
        await batch.commit();
      } catch (err) {
        console.warn('Auto-healing boarders batch commit warning:', err);
      }
    }

    const settingsDoc = settingsSnap.docs.find(d => d.id === GENERAL_DOC);
    const settings: MessSettings = settingsDoc 
      ? (settingsDoc.data() as MessSettings) 
      : { messName: 'Shajahan Villa', currentMonth: '2026-11', managerPin: '1234' };

    const miscDoc = miscSnap.docs.find(d => d.id === GENERAL_DOC);
    const miscCosts: MiscellaneousCosts = miscDoc 
      ? (miscDoc.data() as MiscellaneousCosts) 
      : { cookerBill: 0, utilityBill: 0, gasBill: 0, wifiBill: 0, houseRent: 0, otherCosts: 0 };

    // Update browser cache with freshly retrieved live server data
    try {
      localStorage.setItem('mess_boarders', JSON.stringify(boarders));
      localStorage.setItem('mess_deposits', JSON.stringify(deposits));
      localStorage.setItem('mess_bazaarCosts', JSON.stringify(bazaarCosts));
      localStorage.setItem('mess_mealLogs', JSON.stringify(mealLogs));
      localStorage.setItem('mess_settings', JSON.stringify(settings));
      localStorage.setItem('mess_miscCosts', JSON.stringify(miscCosts));
    } catch {
      // ignore
    }

    return {
      boarders,
      deposits,
      bazaarCosts,
      mealLogs,
      miscCosts,
      settings,
      stats: {
        boardersCount: boarders.length,
        depositsCount: deposits.length,
        bazaarCount: bazaarCosts.length,
        mealLogsCount: mealLogs.length,
        fetchedAt: new Date().toLocaleTimeString(),
      },
      isFromCloud: true
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('forceFetchFromServer failed:', error);
    throw new Error(errorMsg);
  }
}

/**
 * Seeds initial mock dataset into Firestore in batches.
 */
export async function seedFirestore(data: {
  boarders: Boarder[];
  deposits: Deposit[];
  mealLogs: DailyMealLog[];
  bazaarCosts: BazaarCost[];
  miscCosts: MiscellaneousCosts;
  settings: MessSettings;
}): Promise<void> {
  try {
    const batch = writeBatch(db);

    // Settings
    batch.set(doc(db, SETTINGS_COL, GENERAL_DOC), sanitizeForFirestore(data.settings));
    // Misc
    batch.set(doc(db, MISC_COL, GENERAL_DOC), sanitizeForFirestore(data.miscCosts));

    // Boarders
    data.boarders.forEach(b => {
      batch.set(doc(db, BOARDERS_COL, b.id), sanitizeForFirestore(b));
    });

    // Deposits
    data.deposits.forEach(d => {
      batch.set(doc(db, DEPOSITS_COL, d.id), sanitizeForFirestore(d));
    });

    // Bazaar
    data.bazaarCosts.forEach(c => {
      batch.set(doc(db, BAZAAR_COL, c.id), sanitizeForFirestore(c));
    });

    // Meals
    data.mealLogs.forEach(m => {
      batch.set(doc(db, MEALS_COL, m.date), sanitizeForFirestore(m));
    });

    await batch.commit();

    // Also update local cache
    localStorage.setItem('mess_boarders', JSON.stringify(data.boarders));
    localStorage.setItem('mess_deposits', JSON.stringify(data.deposits));
    localStorage.setItem('mess_bazaarCosts', JSON.stringify(data.bazaarCosts));
    localStorage.setItem('mess_mealLogs', JSON.stringify(data.mealLogs));
    localStorage.setItem('mess_settings', JSON.stringify(data.settings));
    localStorage.setItem('mess_miscCosts', JSON.stringify(data.miscCosts));
  } catch (error) {
    console.error('Error seeding Firestore database:', error);
    handleFirestoreError(error, OperationType.WRITE, 'batch_seed');
  }
}

/**
 * Wipes data from both Google Cloud Firestore and browser localStorage.
 * - If wipeAll is true: permanently removes all documents from boarders, deposits, bazaarCosts, and mealLogs.
 * - If currentMonthOnly is specified: removes only deposits, bazaar expenses, and meal logs for that month.
 */
export async function wipeFirestoreDatabase(options: { 
  wipeAll: boolean; 
  currentMonthOnly?: string;
  defaultSettings?: MessSettings;
  defaultMiscCosts?: MiscellaneousCosts;
}): Promise<void> {
  const { wipeAll, currentMonthOnly, defaultSettings, defaultMiscCosts } = options;

  try {
    if (wipeAll) {
      const [boardersSnap, depositsSnap, bazaarSnap, mealsSnap] = await Promise.all([
        getDocs(collection(db, BOARDERS_COL)),
        getDocs(collection(db, DEPOSITS_COL)),
        getDocs(collection(db, BAZAAR_COL)),
        getDocs(collection(db, MEALS_COL)),
      ]);

      const batch = writeBatch(db);

      boardersSnap.docs.forEach(d => batch.delete(d.ref));
      depositsSnap.docs.forEach(d => batch.delete(d.ref));
      bazaarSnap.docs.forEach(d => batch.delete(d.ref));
      mealsSnap.docs.forEach(d => batch.delete(d.ref));

      if (defaultSettings) {
        batch.set(doc(db, SETTINGS_COL, GENERAL_DOC), sanitizeForFirestore(defaultSettings));
      }
      if (defaultMiscCosts) {
        batch.set(doc(db, MISC_COL, GENERAL_DOC), sanitizeForFirestore(defaultMiscCosts));
      }

      await batch.commit();
      clearBrowserLocalStorageCache();
    } else if (currentMonthOnly) {
      const [depositsSnap, bazaarSnap, mealsSnap] = await Promise.all([
        getDocs(collection(db, DEPOSITS_COL)),
        getDocs(collection(db, BAZAAR_COL)),
        getDocs(collection(db, MEALS_COL)),
      ]);

      const batch = writeBatch(db);
      depositsSnap.docs.forEach(d => {
        const data = d.data() as Deposit;
        if (data.date && data.date.startsWith(currentMonthOnly)) {
          batch.delete(d.ref);
        }
      });
      bazaarSnap.docs.forEach(d => {
        const data = d.data() as BazaarCost;
        if (data.date && data.date.startsWith(currentMonthOnly)) {
          batch.delete(d.ref);
        }
      });
      mealsSnap.docs.forEach(d => {
        const data = d.data() as DailyMealLog;
        if (data.date && data.date.startsWith(currentMonthOnly)) {
          batch.delete(d.ref);
        }
      });

      await batch.commit();
    }
  } catch (error) {
    console.error('Error wiping Firestore database:', error);
    handleFirestoreError(error, OperationType.DELETE, 'wipe_database');
  }
}

/**
 * Real-time listeners for live updates across clients
 */
export function subscribeToFirestoreUpdates(callbacks: {
  onBoardersUpdate?: (boarders: Boarder[]) => void;
  onDepositsUpdate?: (deposits: Deposit[]) => void;
  onBazaarUpdate?: (bazaar: BazaarCost[]) => void;
  onMealsUpdate?: (meals: DailyMealLog[]) => void;
  onSettingsUpdate?: (settings: MessSettings) => void;
  onMiscUpdate?: (misc: MiscellaneousCosts) => void;
}): () => void {
  const unsubscribers: Array<() => void> = [];

  try {
    if (callbacks.onBoardersUpdate) {
      unsubscribers.push(
        onSnapshot(collection(db, BOARDERS_COL), (snapshot) => {
          callbacks.onBoardersUpdate!(snapshot.docs.map(d => d.data() as Boarder));
        }, (err) => console.warn('Boarders listener error:', err))
      );
    }

    if (callbacks.onDepositsUpdate) {
      unsubscribers.push(
        onSnapshot(collection(db, DEPOSITS_COL), (snapshot) => {
          callbacks.onDepositsUpdate!(snapshot.docs.map(d => d.data() as Deposit));
        }, (err) => console.warn('Deposits listener error:', err))
      );
    }

    if (callbacks.onBazaarUpdate) {
      unsubscribers.push(
        onSnapshot(collection(db, BAZAAR_COL), (snapshot) => {
          callbacks.onBazaarUpdate!(snapshot.docs.map(d => d.data() as BazaarCost));
        }, (err) => console.warn('Bazaar listener error:', err))
      );
    }

    if (callbacks.onMealsUpdate) {
      unsubscribers.push(
        onSnapshot(collection(db, MEALS_COL), (snapshot) => {
          callbacks.onMealsUpdate!(snapshot.docs.map(d => d.data() as DailyMealLog));
        }, (err) => console.warn('Meals listener error:', err))
      );
    }

    if (callbacks.onSettingsUpdate) {
      unsubscribers.push(
        onSnapshot(doc(db, SETTINGS_COL, GENERAL_DOC), (snapshot) => {
          if (snapshot.exists()) {
            callbacks.onSettingsUpdate!(snapshot.data() as MessSettings);
          }
        }, (err) => console.warn('Settings listener error:', err))
      );
    }

    if (callbacks.onMiscUpdate) {
      unsubscribers.push(
        onSnapshot(doc(db, MISC_COL, GENERAL_DOC), (snapshot) => {
          if (snapshot.exists()) {
            callbacks.onMiscUpdate!(snapshot.data() as MiscellaneousCosts);
          }
        }, (err) => console.warn('Misc listener error:', err))
      );
    }
  } catch (err) {
    console.warn('Could not attach Firestore real-time listeners:', err);
  }

  return () => {
    unsubscribers.forEach(u => u());
  };
}

// Single mutation helpers with automatic sanitization
export async function syncBoarderToFirestore(boarder: Boarder): Promise<void> {
  try {
    const clean = sanitizeForFirestore(boarder);
    await setDoc(doc(db, BOARDERS_COL, boarder.id), clean);
  } catch (err) {
    console.error('Failed to sync boarder to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `${BOARDERS_COL}/${boarder.id}`);
  }
}

export async function deleteBoarderFromFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, BOARDERS_COL, id));
  } catch (err) {
    console.error('Failed to delete boarder from Firestore:', err);
    handleFirestoreError(err, OperationType.DELETE, `${BOARDERS_COL}/${id}`);
  }
}

export async function syncDepositToFirestore(deposit: Deposit): Promise<void> {
  try {
    const clean = sanitizeForFirestore(deposit);
    await setDoc(doc(db, DEPOSITS_COL, deposit.id), clean);
  } catch (err) {
    console.error('Failed to sync deposit to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `${DEPOSITS_COL}/${deposit.id}`);
  }
}

export async function deleteDepositFromFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, DEPOSITS_COL, id));
  } catch (err) {
    console.error('Failed to delete deposit from Firestore:', err);
    handleFirestoreError(err, OperationType.DELETE, `${DEPOSITS_COL}/${id}`);
  }
}

export async function syncBazaarToFirestore(bazaar: BazaarCost): Promise<void> {
  try {
    const clean = sanitizeForFirestore(bazaar);
    await setDoc(doc(db, BAZAAR_COL, bazaar.id), clean);
  } catch (err) {
    console.error('Failed to sync bazaar to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `${BAZAAR_COL}/${bazaar.id}`);
  }
}

export async function deleteBazaarFromFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, BAZAAR_COL, id));
  } catch (err) {
    console.error('Failed to delete bazaar from Firestore:', err);
    handleFirestoreError(err, OperationType.DELETE, `${BAZAAR_COL}/${id}`);
  }
}

export async function syncMealLogToFirestore(mealLog: DailyMealLog): Promise<void> {
  try {
    const clean = sanitizeForFirestore(mealLog);
    await setDoc(doc(db, MEALS_COL, mealLog.date), clean);
  } catch (err) {
    console.error('Failed to sync meal log to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `${MEALS_COL}/${mealLog.date}`);
  }
}

export async function deleteMealLogFromFirestore(date: string): Promise<void> {
  try {
    await deleteDoc(doc(db, MEALS_COL, date));
  } catch (err) {
    console.error('Failed to delete meal log from Firestore:', err);
    handleFirestoreError(err, OperationType.DELETE, `${MEALS_COL}/${date}`);
  }
}

export async function syncSettingsToFirestore(settings: MessSettings): Promise<void> {
  try {
    const clean = sanitizeForFirestore(settings);
    await setDoc(doc(db, SETTINGS_COL, GENERAL_DOC), clean);
  } catch (err) {
    console.error('Failed to sync settings to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `${SETTINGS_COL}/${GENERAL_DOC}`);
  }
}

export async function syncMiscCostsToFirestore(miscCosts: MiscellaneousCosts): Promise<void> {
  try {
    const clean = sanitizeForFirestore(miscCosts);
    await setDoc(doc(db, MISC_COL, GENERAL_DOC), clean);
  } catch (err) {
    console.error('Failed to sync misc costs to Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `${MISC_COL}/${GENERAL_DOC}`);
  }
}
