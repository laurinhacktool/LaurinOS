import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { collection, query, where, limit } from 'firebase/firestore';
import { onSnapshot } from '../firebase';
import { db, auth } from '../firebase';
import { Users, X } from 'lucide-react';

interface ActiveUsersWidgetProps {
  onClose: () => void;
}

export const ActiveUsersWidget: React.FC<ActiveUsersWidgetProps> = ({ onClose }) => {
  const [activeUsers, setActiveUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'users'),
      where('isOnline', '==', true),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setActiveUsers(users);
    }, (error) => {
      console.error("Error fetching active users:", error);
    });

    return () => unsubscribe();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-64 bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
    >
      <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Users className="w-4 h-4 text-blue-400" />
          Aktívni používatelia
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
            {activeUsers.length}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {activeUsers.length === 0 ? (
          <div className="text-center text-xs text-gray-500 py-4">
            Nikto nie je online
          </div>
        ) : (
          activeUsers.map(user => (
            <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-colors">
              <div className="relative">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full object-cover border border-white/10" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs border border-white/10">
                    {user.displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#0a0a0a] rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {user.displayName || 'Neznámy'}
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  {user.email}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};
