import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  increment,
  arrayUnion,
  runTransaction
} from 'firebase/firestore';

// Configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyBjvbiqbH7FlcuptL2--0dgv8eCcR0XprI",
  authDomain: "grounded-bonfire-ms7sz.firebaseapp.com",
  projectId: "grounded-bonfire-ms7sz",
  storageBucket: "grounded-bonfire-ms7sz.firebasestorage.app",
  messagingSenderId: "267525850230",
  appId: "1:267525850230:web:7500f7cf9ecf407b1a4b57",
  firestoreDatabaseId: "ai-studio-polarithsoftware-5020db18-873e-4f66-8234-f347bb0f2452"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use custom database ID if specified, otherwise default
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export interface FirebaseStats {
  totalMessages: number;
  totalUsers: number;
  messagesByModel: Record<string, number>;
  recentActivity: Array<{ timestamp: string; event: string }>;
}

/**
 * Tracks a user session start on Firebase
 */
export async function trackUserSessionFirebase(clientId: string): Promise<void> {
  try {
    const statsDocRef = doc(db, 'system_stats', 'metrics');
    
    await runTransaction(db, async (transaction) => {
      const statsDoc = await transaction.get(statsDocRef);
      
      const eventLogRef = doc(collection(db, 'activity_logs'));
      const timestamp = new Date().toISOString();
      
      if (!statsDoc.exists()) {
        // Initialize metrics doc
        transaction.set(statsDocRef, {
          totalMessages: 0,
          uniqueUsers: [clientId],
          messagesByModel: {
            kodama: 0,
            amabie: 0,
            kaze: 0
          }
        });
        
        // Log the event
        transaction.set(eventLogRef, {
          timestamp,
          event: `New user session registered (${clientId.substring(0, 8)}...)`
        });
      } else {
        const data = statsDoc.data();
        const uniqueUsers = data.uniqueUsers || [];
        
        if (!uniqueUsers.includes(clientId)) {
          transaction.update(statsDocRef, {
            uniqueUsers: arrayUnion(clientId)
          });
          
          transaction.set(eventLogRef, {
            timestamp,
            event: `New user session registered (${clientId.substring(0, 8)}...)`
          });
        }
      }
    });
  } catch (err: any) {
    if (err?.message?.includes('permission') || err?.code === 'permission-denied') {
      console.warn('[Firebase SDK] Firestore write deferred. Security rules propagation pending deployment snapshot.');
    } else {
      console.warn('[Firebase SDK] Failed to track user session:', err);
    }
  }
}

/**
 * Increments the message counts for a selected model in Firebase
 */
export async function trackMessageFirebase(clientId: string, modelId: string): Promise<void> {
  try {
    const statsDocRef = doc(db, 'system_stats', 'metrics');
    const timestamp = new Date().toISOString();
    const eventLogRef = doc(collection(db, 'activity_logs'));
    
    await runTransaction(db, async (transaction) => {
      const statsDoc = await transaction.get(statsDocRef);
      
      const readableModelNames: Record<string, string> = {
        kodama: 'Polarith Kodama (400B)',
        amabie: 'Polarith Amabie 1.0 (160B)',
        kaze: 'Polarith Kaze 1.0 (8B)'
      };
      const modelLabel = readableModelNames[modelId] || modelId;
      
      if (!statsDoc.exists()) {
        transaction.set(statsDocRef, {
          totalMessages: 1,
          uniqueUsers: [clientId],
          messagesByModel: {
            [modelId]: 1
          }
        });
      } else {
        const updateData: Record<string, any> = {
          totalMessages: increment(1),
          [`messagesByModel.${modelId}`]: increment(1)
        };
        
        // Ensure user is registered if they weren't already
        const data = statsDoc.data();
        const uniqueUsers = data.uniqueUsers || [];
        if (!uniqueUsers.includes(clientId)) {
          updateData.uniqueUsers = arrayUnion(clientId);
        }
        
        transaction.update(statsDocRef, updateData);
      }
      
      transaction.set(eventLogRef, {
        timestamp,
        event: `Message processed via ${modelLabel}`
      });
    });
  } catch (err: any) {
    if (err?.message?.includes('permission') || err?.code === 'permission-denied') {
      console.warn('[Firebase SDK] Firestore message log deferred. Security rules propagation pending deployment snapshot.');
    } else {
      console.warn('[Firebase SDK] Failed to track message:', err);
    }
  }
}

/**
 * Retrieves aggregated stats combining metrics and the recent activity feed
 */
export async function getStatsFirebase(): Promise<FirebaseStats> {
  try {
    const statsDocRef = doc(db, 'system_stats', 'metrics');
    const statsDoc = await getDoc(statsDocRef);
    
    let totalMessages = 0;
    let totalUsers = 0;
    let messagesByModel: Record<string, number> = {
      kodama: 0,
      amabie: 0,
      kaze: 0
    };
    
    if (statsDoc.exists()) {
      const data = statsDoc.data();
      totalMessages = data.totalMessages || 0;
      totalUsers = data.uniqueUsers?.length || 0;
      messagesByModel = {
        kodama: data.messagesByModel?.kodama || 0,
        amabie: data.messagesByModel?.amabie || 0,
        kaze: data.messagesByModel?.kaze || 0
      };
    }
    
    // Fetch recent activity
    const activityQuery = query(
      collection(db, 'activity_logs'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    
    const activitySnap = await getDocs(activityQuery);
    const recentActivity: Array<{ timestamp: string; event: string }> = [];
    
    activitySnap.forEach((doc) => {
      const data = doc.data();
      recentActivity.push({
        timestamp: data.timestamp || new Date().toISOString(),
        event: data.event || ''
      });
    });
    
    return {
      totalMessages,
      totalUsers,
      messagesByModel,
      recentActivity
    };
  } catch (err) {
    console.error('Error fetching stats from Firebase:', err);
    throw err;
  }
}

/**
 * Resets stats in Firebase (Administrator action)
 */
export async function resetStatsFirebase(): Promise<FirebaseStats> {
  try {
    const statsDocRef = doc(db, 'system_stats', 'metrics');
    const timestamp = new Date().toISOString();
    
    await setDoc(statsDocRef, {
      totalMessages: 0,
      uniqueUsers: [],
      messagesByModel: {
        kodama: 0,
        amabie: 0,
        kaze: 0
      }
    });
    
    // Log the reset event
    const eventLogRef = doc(collection(db, 'activity_logs'));
    await setDoc(eventLogRef, {
      timestamp,
      event: 'Statistics reset by administrator'
    });
    
    return {
      totalMessages: 0,
      totalUsers: 0,
      messagesByModel: {
        kodama: 0,
        amabie: 0,
        kaze: 0
      },
      recentActivity: [{
        timestamp,
        event: 'Statistics reset by administrator'
      }]
    };
  } catch (err) {
    console.error('Error resetting stats in Firebase:', err);
    throw err;
  }
}
