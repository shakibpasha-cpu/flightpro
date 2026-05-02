import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { safeStringify } from '../utils/safeJson';

export interface AutomationTask {
  id?: string;
  userId?: string;
  name: string;
  type: 'scraper' | 'api-sync' | 'email-parser';
  schedule: string; // Cron expression or simple interval
  lastRun?: Date;
  status: 'active' | 'paused';
  config: any;
  dueDate?: string;
}

export const automationService = {
  async getTasks(): Promise<AutomationTask[]> {
    if (!auth.currentUser) return [];
    const q = query(collection(db, 'automation_tasks'), where('userId', '==', auth.currentUser.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AutomationTask));
  },

  async addTask(task: AutomationTask) {
    if (!auth.currentUser) throw new Error('User not authenticated');
    return await addDoc(collection(db, 'automation_tasks'), {
      ...task,
      userId: auth.currentUser.uid
    });
  },

  async updateTaskStatus(taskId: string, status: 'active' | 'paused') {
    await updateDoc(doc(db, 'automation_tasks', taskId), { status });
  },
  
  async deleteTask(taskId: string) {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'automation_tasks', taskId));
  },

  async scrapeAllAuthoritiesAOC() {
    try {
      const authRef = collection(db, 'aviation_authorities');
      const snapshot = await getDocs(authRef);
      
      const results = [];
      console.log(`Starting AOC scraping for ${snapshot.size} authorities`);

      for (const docSnap of snapshot.docs) {
        const authData = docSnap.data();
        const url = authData.website;
        
        if (!url) continue;

        console.log(`Scraping AOC list for: ${authData.authority_name} (${url})`);
        
        try {
          const response = await fetch('/api/scrape-authority', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: safeStringify({ url })
          });

          if (!response.ok) throw new Error(`Failed to scrape ${url}`);
          const data = await response.json();

          // Update authority record with new AOC data
          await updateDoc(doc(db, 'aviation_authorities', docSnap.id), {
            aoc_data: data.aoc_data || [],
            last_scraped: new Date().toISOString()
          });

          // Seed operators_master
          if (data.aoc_data && data.aoc_data.length > 0) {
            for (const op of data.aoc_data) {
              // Check if operator already exists to avoid duplicates
              const opQuery = query(
                collection(db, 'operators_master'), 
                where('operator_name', '==', op.operator_name),
                where('aoc_number', '==', op.aoc_number)
              );
              const opSnap = await getDocs(opQuery);
              
              if (opSnap.empty) {
                await addDoc(collection(db, 'operators_master'), {
                  operator_name: op.operator_name,
                  aoc_number: op.aoc_number,
                  operation_type: op.operation_type || 'Unknown',
                  country: data.country || authData.country,
                  source: data.authority_name || authData.authority_name,
                  status: 'Active',
                  last_updated: new Date().toISOString()
                });
              }
            }
          }

          results.push({ 
            authority: authData.authority_name, 
            status: 'Success', 
            aocCount: data.aoc_data?.length || 0 
          });
        } catch (e) {
          console.error(`Failed to scrape AOC for ${authData.authority_name}:`, e);
          results.push({ 
            authority: authData.authority_name, 
            status: 'Error', 
            error: String(e) 
          });
        }

        // Delay to avoid overwhelming the scraper/API and stay within quota
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      return results;
    } catch (error) {
      console.error('Error in scrapeAllAuthoritiesAOC:', error);
      throw error;
    }
  }
};
