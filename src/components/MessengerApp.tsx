import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { collection, query, addDoc, updateDoc, doc, or, where, orderBy, limit } from 'firebase/firestore';
import { onSnapshot } from '../firebase';
import { db } from '../firebase';

export const MessengerApp: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [activeContact, setActiveContact] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'users'), limit(30)); // Further limit contact list to save reads
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => ({
        email: doc.data().email,
        name: doc.data().displayName || doc.data().email?.split('@')[0] || 'Neznámy',
        photoURL: doc.data().photoURL,
        isOnline: doc.data().isOnline
      }));
      setContacts(fetchedUsers);
    }, (error) => {
      console.error("Error fetching users for messenger:", error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    // Fetch messages where the user is either sender or receiver - limited to last 100
    const q = query(
      collection(db, 'messages'),
      or(
        where('senderEmail', '==', currentUser.email),
        where('receiverEmail', '==', currentUser.email)
      ),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).reverse(); // Reverse to get asc order in UI while querying desc for limit
      setMessages(fetchedMessages);
    }, (error) => {
      console.error("Error fetching messages:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeContact]);

  useEffect(() => {
    if (!activeContact || !currentUser) return;
    
    // Mark unread messages as read
    const unreadMessages = messages.filter(m => m.receiverEmail === currentUser.email && m.senderEmail === activeContact.email && !m.read);
    
    unreadMessages.forEach(async (msg) => {
      try {
        await updateDoc(doc(db, 'messages', msg.id), { read: true });
      } catch (error) {
        console.error("Error updating message read status:", error);
      }
    });
  }, [activeContact, messages, currentUser]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeContact || !currentUser) return;

    const newMsg = {
      senderEmail: currentUser.email,
      receiverEmail: activeContact.email,
      text: inputText.trim(),
      timestamp: new Date().toISOString(),
      read: false
    };

    setInputText('');

    try {
      await addDoc(collection(db, 'messages'), newMsg);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full bg-transparent text-gray-900 dark:text-white">
        <p>Pre použitie Messengera sa musíte prihlásiť.</p>
      </div>
    );
  }

  const filteredMessages = messages.filter(m => 
    (m.senderEmail === currentUser.email && m.receiverEmail === activeContact?.email) ||
    (m.senderEmail === activeContact?.email && m.receiverEmail === currentUser.email)
  );

  const otherContacts = contacts.filter(c => c.email !== currentUser.email);

  return (
    <div className="flex h-full bg-transparent text-gray-900 dark:text-white font-sans">
      {/* Sidebar */}
      <div className="w-1/3 border-r border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md flex flex-col">
        <div className="p-4 border-b border-black/10 dark:border-white/10 font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          <span>Kontakty</span>
        </div>
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-black/10 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
          {otherContacts.map(contact => {
            const unreadCount = messages.filter(m => m.receiverEmail === currentUser.email && m.senderEmail === contact.email && !m.read).length;
            return (
              <div 
                key={contact.email}
                onClick={() => setActiveContact(contact)}
                className={`p-3 border-b border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors ${activeContact?.email === contact.email ? 'bg-purple-500/10 dark:bg-purple-500/20 border-l-4 border-l-purple-500' : 'border-l-4 border-l-transparent'}`}
              >
                <div className="relative">
                  {contact.photoURL ? (
                    <img src={contact.photoURL} alt={contact.name} className="w-10 h-10 rounded-full object-cover shadow-lg border border-white/10" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {contact.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#0f172a] rounded-full"></div>
                  )}
                  {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-[#0f172a] flex items-center justify-center text-[8px] font-bold text-white shadow-sm">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{contact.name}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{contact.email}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white/20 dark:bg-black/40 backdrop-blur-sm relative">
        {activeContact ? (
          <>
            <div className="p-4 border-b border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md flex items-center gap-3 shadow-md z-10">
              <div className="relative">
                {activeContact.photoURL ? (
                  <img src={activeContact.photoURL} alt={activeContact.name} className="w-8 h-8 rounded-full object-cover shadow-sm border border-white/10" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm">
                    {activeContact.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {activeContact.isOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#0f172a] rounded-full"></div>
                )}
              </div>
              <div className="font-bold">{activeContact.name}</div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-black/10 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
              {filteredMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 dark:text-white/20 text-sm">
                  Začnite konverzáciu s {activeContact.name}
                </div>
              ) : (
                filteredMessages.map(msg => {
                  const isMe = msg.senderEmail === currentUser.email;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl shadow-md ${isMe ? 'bg-purple-600 rounded-tr-sm text-white' : 'bg-white/60 dark:bg-white/10 backdrop-blur-md rounded-tl-sm text-gray-900 dark:text-gray-100 border border-black/5 dark:border-white/5'}`}>
                        <div className="text-sm break-words leading-relaxed">{msg.text}</div>
                        <div className={`text-[9px] mt-1 text-right ${isMe ? 'text-purple-200' : 'text-gray-500 dark:text-gray-400'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md flex gap-2">
              <input 
                type="text" 
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Napíš správu..." 
                className="flex-1 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full px-4 py-2 focus:outline-none focus:border-purple-500 transition-colors text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
              <button 
                type="submit" 
                className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={!inputText.trim()}
              >
                <Send className="w-4 h-4 ml-1" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 flex-col gap-4">
            <MessageCircle className="w-16 h-16 opacity-20" />
            <p className="text-sm">Vyberte kontakt pre začatie konverzácie</p>
          </div>
        )}
      </div>
    </div>
  );
};
